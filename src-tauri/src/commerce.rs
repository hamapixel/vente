//! Gestion locale des clients, dettes, acomptes et mise à jour du catalogue.
//! Toutes les opérations financières sont transactionnelles et historisées.
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::{Db, Auth, error, now, require_auth, require_admin};

pub(crate) fn migrate(conn: &mut Connection) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    tx.execute_batch(r#"
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL DEFAULT '',
            address TEXT NOT NULL DEFAULT '',
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sale_customers (
            sale_id INTEGER PRIMARY KEY REFERENCES sales(id),
            customer_id INTEGER NOT NULL REFERENCES customers(id)
        );
        CREATE TABLE IF NOT EXISTS sale_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL REFERENCES sales(id),
            request_id TEXT NOT NULL UNIQUE,
            amount INTEGER NOT NULL CHECK(amount > 0),
            method TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);
        CREATE INDEX IF NOT EXISTS idx_sale_payments_date ON sale_payments(created_at);
        CREATE INDEX IF NOT EXISTS idx_sale_customers_customer ON sale_customers(customer_id);
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name TEXT PRIMARY KEY
        );
    "#)?;
    // Les ventes enregistrées avant l'arrivée des acomptes étaient toutes payées.
    // Migration unique : ne pas convertir les nouvelles ventes à crédit en ventes payées lors du redémarrage.
    let done: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name='legacy_paid_sales_v1')",
        [],|row|row.get(0))?;
    if !done {
        tx.execute(
            "INSERT INTO sale_payments(sale_id,request_id,amount,method,created_at)
             SELECT s.id, 'legacy-sale-' || s.id, s.total, s.payment_method, s.created_at
             FROM sales s WHERE s.total>0
               AND NOT EXISTS (SELECT 1 FROM sale_payments p WHERE p.sale_id=s.id)",
            []
        )?;
        tx.execute("INSERT INTO schema_migrations(name) VALUES('legacy_paid_sales_v1')",[])?;
    }
    tx.commit()
}

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Customer {
    id: i64, name: String, phone: String, address: String, note: String,
    created_at: String, total_sales: i64, total_paid: i64, balance: i64,
    sale_count: i64
}
#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
pub struct CustomerInput {
    name: String, phone: String, address: String, note: String
}
fn validate_customer(input: &CustomerInput) -> Result<(), String> {
    if input.name.trim().is_empty() || input.name.chars().count() > 120 ||
       input.phone.chars().count() > 60 || input.address.chars().count() > 200 ||
       input.note.chars().count() > 500 {
        return Err("Fiche client invalide : vérifiez le nom et les longueurs des champs.".into());
    }
    Ok(())
}
#[tauri::command]
pub fn create_customer(db: State<'_, Db>, auth: State<'_, Auth>, input: CustomerInput) -> Result<i64,String> {
    require_auth(&auth)?;
    validate_customer(&input)?;
    let conn=db.0.lock().map_err(error)?;
    conn.execute(
        "INSERT INTO customers(name,phone,address,note,created_at) VALUES (?1,?2,?3,?4,?5)",
        params![input.name.trim(),input.phone.trim(),input.address.trim(),input.note.trim(),now()]
    ).map_err(error)?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_customer(db: State<'_, Db>, auth: State<'_, Auth>, id:i64,input: CustomerInput) -> Result<(),String> {
    require_auth(&auth)?;
    validate_customer(&input)?;
    let conn=db.0.lock().map_err(error)?;
    let changed=conn.execute(
        "UPDATE customers SET name=?1,phone=?2,address=?3,note=?4 WHERE id=?5",
        params![input.name.trim(),input.phone.trim(),input.address.trim(),input.note.trim(),id]
    ).map_err(error)?;
    if changed==0 { return Err("Client introuvable.".into()); }
    Ok(())
}

#[tauri::command]
pub fn list_customers(db: State<'_, Db>, auth: State<'_, Auth>) -> Result<Vec<Customer>,String> {
    require_auth(&auth)?;
    let conn=db.0.lock().map_err(error)?;
    let mut stmt=conn.prepare(r#"
        SELECT c.id,c.name,c.phone,c.address,c.note,c.created_at,
               COALESCE(SUM(s.total),0),
               COALESCE(SUM(
                   COALESCE((SELECT SUM(p.amount) FROM sale_payments p WHERE p.sale_id=s.id),0)
                   -COALESCE((SELECT SUM(r.amount) FROM sale_refunds r WHERE r.sale_id=s.id),0)),0),
               COUNT(s.id)
        FROM customers c
        LEFT JOIN sale_customers sc ON sc.customer_id=c.id
        LEFT JOIN sales s ON s.id=sc.sale_id AND NOT EXISTS(SELECT 1 FROM sale_cancellations cc WHERE cc.sale_id=s.id)
        GROUP BY c.id
        ORDER BY c.name COLLATE NOCASE
    "#).map_err(error)?;
    let rows=stmt.query_map([],|r|{
        let total_sales:i64=r.get(6)?;
        let paid:i64=r.get(7)?;
        Ok(Customer{
            id:r.get(0)?,name:r.get(1)?,phone:r.get(2)?,address:r.get(3)?,
            note:r.get(4)?,created_at:r.get(5)?,total_sales,total_paid:paid,
            balance:total_sales-paid,sale_count:r.get(8)?
        })
    }).map_err(error)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(error)
}


#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct CustomerSale {
    id:i64, reference:String, created_at:String,total:i64,paid:i64,
    remaining:i64,payment_method:String
}
#[tauri::command]
pub fn list_customer_sales(db:State<'_,Db>,auth:State<'_,Auth>,customer_id:i64)
  -> Result<Vec<CustomerSale>,String> {
    require_auth(&auth)?;
    let conn=db.0.lock().map_err(error)?;
    let mut stmt=conn.prepare(
        "SELECT s.id,s.reference,s.created_at,s.total,
                COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id=s.id),0)
                -COALESCE((SELECT SUM(amount) FROM sale_refunds WHERE sale_id=s.id),0),
                s.payment_method
         FROM sales s JOIN sale_customers sc ON sc.sale_id=s.id
         WHERE sc.customer_id=?1 AND NOT EXISTS(SELECT 1 FROM sale_cancellations cc WHERE cc.sale_id=s.id) ORDER BY s.id DESC"
    ).map_err(error)?;
    let rows=stmt.query_map(params![customer_id],|r|{
        let total:i64=r.get(3)?;
        let paid:i64=r.get(4)?;
        Ok(CustomerSale {
            id:r.get(0)?,reference:r.get(1)?,created_at:r.get(2)?,
            total,paid,remaining:total-paid,payment_method:r.get(5)?
        })
    }).map_err(error)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(error)
}

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct PaymentEntry {
    id:i64, sale_id:i64, reference:String, amount:i64, method:String, created_at:String
}

#[tauri::command]
pub fn list_customer_payments(db:State<'_,Db>,auth:State<'_,Auth>,customer_id:i64)
  -> Result<Vec<PaymentEntry>,String> {
    require_auth(&auth)?;
    let conn=db.0.lock().map_err(error)?;
    let mut stmt=conn.prepare(r#"
        SELECT p.id,p.sale_id,s.reference,p.amount,p.method,p.created_at
        FROM sale_payments p
        JOIN sales s ON s.id=p.sale_id
        JOIN sale_customers sc ON sc.sale_id=s.id
        WHERE sc.customer_id=?1 ORDER BY p.id DESC
    "#).map_err(error)?;
    let rows=stmt.query_map(params![customer_id],|r|Ok(PaymentEntry{
        id:r.get(0)?,sale_id:r.get(1)?,reference:r.get(2)?,
        amount:r.get(3)?,method:r.get(4)?,created_at:r.get(5)?
    })).map_err(error)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(error)
}

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Settlement {
    sale_id:i64, amount_received:i64, paid:i64, pub(crate) remaining:i64, reference:String
}

pub(crate) fn settle(conn:&mut Connection, sale_id:i64, amount:i64, method:&str, request_id:&str)
  -> Result<Settlement,String> {
    if amount<=0 || request_id.trim().is_empty() || request_id.len()>128 {
        return Err("Montant ou référence de règlement invalide.".into());
    }
    if !["Espèces","Orange Money","Moov Money","Autre"].contains(&method) {
        return Err("Moyen de paiement invalide.".into());
    }
    let tx=conn.transaction().map_err(error)?;
    let (total,reference): (i64,String)=tx.query_row(
        "SELECT total,reference FROM sales WHERE id=?1",params![sale_id],
        |r|Ok((r.get(0)?,r.get(1)?))
    ).optional().map_err(error)?.ok_or("Vente introuvable.")?;
    if crate::sales_management::cancelled(&tx,sale_id)? {
        return Err("Cette vente est annulée, aucun règlement ne peut être ajouté.".into());
    }
    let paid:i64=tx.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM sale_payments WHERE sale_id=?1",
        params![sale_id],|r|r.get(0)
    ).map_err(error)?;
    let previous=tx.query_row(
        "SELECT sale_id,amount FROM sale_payments WHERE request_id=?1",
        params![request_id],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,i64>(1)?))
    ).optional().map_err(error)?;
    if let Some((old_sale,old_amount))=previous {
        if old_sale!=sale_id || old_amount!=amount {
            return Err("Référence de règlement déjà utilisée.".into());
        }
        return Ok(Settlement{sale_id,amount_received:old_amount,paid,remaining:total-paid,reference});
    }
    let remaining=total.checked_sub(paid).ok_or("Total des paiements incohérent.")?;
    if remaining<=0 { return Err("Cette vente est déjà entièrement payée.".into()); }
    if amount>remaining { return Err(format!("Le règlement dépasse le solde de {} FCFA.",remaining)); }
    tx.execute(
        "INSERT INTO sale_payments(sale_id,request_id,amount,method,created_at) VALUES (?1,?2,?3,?4,?5)",
        params![sale_id,request_id,amount,method,now()]
    ).map_err(error)?;
    tx.commit().map_err(error)?;
    Ok(Settlement{sale_id,amount_received:amount,paid:paid+amount,remaining:remaining-amount,reference})
}

#[tauri::command]
pub fn record_payment(
    db:State<'_,Db>,auth:State<'_,Auth>,
    sale_id:i64,amount:i64,method:String,request_id:String
) -> Result<Settlement,String> {
    require_auth(&auth)?;
    let mut conn=db.0.lock().map_err(error)?;
    settle(&mut conn,sale_id,amount,&method,&request_id)
}

#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
pub struct ProductEdit {
    product_id:i64, name:String, category:String, variants:Vec<VariantEdit>
}
#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
pub struct VariantEdit {
    id:Option<i64>, size:String, color:String,
    purchase_price:i64, sale_price:i64, initial_quantity:Option<i64>
}
pub(crate) fn edit_product(conn:&mut Connection,input:ProductEdit)->Result<(),String>{
    if input.product_id<=0 || input.name.trim().is_empty() || input.category.trim().is_empty() ||
        input.name.chars().count()>150 || input.category.chars().count()>60 || input.variants.is_empty() {
        return Err("Fiche produit invalide.".into());
    }
    let mut combinations=std::collections::HashSet::new();
    let mut ids=std::collections::HashSet::new();
    for v in &input.variants {
        if v.size.trim().is_empty() || v.color.trim().is_empty() ||
           v.purchase_price<0 || v.sale_price<0 ||
           v.initial_quantity.unwrap_or(0)<0 ||
           !combinations.insert((v.size.trim().to_lowercase(),v.color.trim().to_lowercase())) {
            return Err("Tailles, couleurs, prix ou variantes en double invalides.".into());
        }
        if let Some(id)=v.id { if !ids.insert(id) { return Err("Variante en double.".into()); } }
    }
    let tx=conn.transaction().map_err(error)?;
    let n=tx.execute("UPDATE products SET name=?1,category=?2 WHERE id=?3",
        params![input.name.trim(),input.category.trim(),input.product_id]).map_err(error)?;
    if n==0 { return Err("Produit introuvable.".into()); }
    let current_count:i64=tx.query_row(
        "SELECT COUNT(*) FROM variants WHERE product_id=?1",
        params![input.product_id],|r|r.get(0)
    ).map_err(error)?;
    if ids.len() as i64 != current_count {
        return Err("Toutes les variantes existantes doivent être conservées.".into());
    }
    // Valider la propriété de toutes les variantes avant les modifications.
    for id in &ids {
        let exists:bool=tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM variants WHERE id=?1 AND product_id=?2)",
            params![id,input.product_id],|r|r.get(0)
        ).map_err(error)?;
        if !exists { return Err("Variante inexistante ou liée à un autre produit.".into()); }
    }
    for v in &input.variants {
        if let Some(id)=v.id {
            tx.execute(
                "UPDATE variants SET size=?1,color=?2,purchase_price=?3,sale_price=?4 WHERE id=?5 AND product_id=?6",
                params![v.size.trim(),v.color.trim(),v.purchase_price,v.sale_price,id,input.product_id]
            ).map_err(error)?;
        } else {
            let suffix:i64=tx.query_row(
                "SELECT COALESCE(MAX(CAST(SUBSTR(sku, LENGTH('MS-' || ?1 || '-')+1) AS INTEGER)),0)+1
                 FROM variants WHERE product_id=?1",
                params![input.product_id],|r|r.get(0)
            ).map_err(error)?;
            let sku=format!("MS-{}-{:03}",input.product_id,suffix);
            let qty=v.initial_quantity.unwrap_or(0);
            tx.execute(
                "INSERT INTO variants(product_id,size,color,sku,purchase_price,sale_price,quantity)
                 VALUES (?1,?2,?3,?4,?5,?6,?7)",
                params![input.product_id,v.size.trim(),v.color.trim(),sku,v.purchase_price,v.sale_price,qty]
            ).map_err(error)?;
            if qty>0 {
                tx.execute("INSERT INTO stock_movements(variant_id,delta,reason,created_at) VALUES (?1,?2,'Stock initial nouvelle variante',?3)",
                params![tx.last_insert_rowid(),qty,now()]).map_err(error)?;
            }
        }
    }
    tx.commit().map_err(error)
}
#[tauri::command]
pub fn update_product(db:State<'_,Db>,auth:State<'_,Auth>,input:ProductEdit)->Result<(),String>{
    require_admin(&auth)?;
    let mut conn=db.0.lock().map_err(error)?;
    edit_product(&mut conn,input)
}

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct ProductMovement {
    date:String, name:String, size:String, color:String, delta:i64, reason:String
}
#[tauri::command]
pub fn product_history(db:State<'_,Db>,auth:State<'_,Auth>,product_id:i64)
  ->Result<Vec<ProductMovement>,String>{
    require_auth(&auth)?;
    let conn=db.0.lock().map_err(error)?;
    let mut stmt=conn.prepare(
        "SELECT m.created_at,p.name,v.size,v.color,m.delta,m.reason
         FROM stock_movements m JOIN variants v ON m.variant_id=v.id
         JOIN products p ON p.id=v.product_id
         WHERE p.id=?1 ORDER BY m.id DESC LIMIT 40"
    ).map_err(error)?;
    let rows=stmt.query_map(params![product_id],|r|Ok(ProductMovement{
        date:r.get(0)?,name:r.get(1)?,size:r.get(2)?,
        color:r.get(3)?,delta:r.get(4)?,reason:r.get(5)?
    })).map_err(error)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(error)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> Connection {
        let mut c=Connection::open_in_memory().unwrap();
        crate::init_db(&c).unwrap();
        migrate(&mut c).unwrap();
        c
    }
    fn sale(c:&Connection,total:i64,request:&str)->i64 {
        c.execute(
            "INSERT INTO sales(reference,request_id,subtotal,discount,total,total_cost,payment_method,created_at)
             VALUES (?1,?2,?3,0,?3,0,'Espèces',?4)",
            params![request,request,total,now()]
        ).unwrap();
        c.last_insert_rowid()
    }
    #[test]
    fn legacy_migration_only_once() {
        let mut c=Connection::open_in_memory().unwrap();
        crate::init_db(&c).unwrap();
        let old=sale(&c,10000,"legacy");
        migrate(&mut c).unwrap();
        let paid:i64=c.query_row("SELECT SUM(amount) FROM sale_payments WHERE sale_id=?1",
            params![old],|r|r.get(0)).unwrap();
        assert_eq!(paid,10000);
        let new=sale(&c,8000,"credit");
        migrate(&mut c).unwrap();
        let payments:i64=c.query_row(
            "SELECT COUNT(*) FROM sale_payments WHERE sale_id=?1",params![new],|r|r.get(0)
        ).unwrap();
        assert_eq!(payments,0);
    }
    #[test]
    fn partial_then_full_and_overpayment_rejected() {
        let mut c=setup();
        let id=sale(&c,10000,"sale1");
        let a=settle(&mut c,id,2000,"Espèces","receipt1").unwrap();
        assert_eq!(a.remaining,8000);
        let again=settle(&mut c,id,2000,"Espèces","receipt1").unwrap();
        assert_eq!(again.paid,2000);
        assert!(settle(&mut c,id,9000,"Espèces","receipt-over").is_err());
        let b=settle(&mut c,id,8000,"Moov Money","receipt2").unwrap();
        assert_eq!(b.remaining,0);
        assert_eq!(b.paid,10000);
        assert!(settle(&mut c,id,1,"Espèces","receipt3").is_err());
    }
    #[test]
    fn edit_product_preserves_quantity_and_sales_snapshot() {
        let mut c=setup();
        c.execute("INSERT INTO products(name,category,created_at) VALUES ('Ancien','Maillots',?1)",
            params![now()]).unwrap();
        let id=c.last_insert_rowid();
        c.execute("INSERT INTO variants(product_id,size,color,sku,purchase_price,sale_price,quantity)
                   VALUES (?1,'M','Bleu','ABC',4000,7000,5)",
            params![id]).unwrap();
        let variant_id=c.last_insert_rowid();
        edit_product(&mut c,ProductEdit {
            product_id:id,name:"Nouveau".into(),category:"Chemises".into(),
            variants:vec![VariantEdit {id:Some(variant_id),size:"L".into(),color:"Noir".into(),
                purchase_price:5000,sale_price:9000,initial_quantity:None}]
        }).unwrap();
        let (qty,price):(i64,i64)=c.query_row("SELECT quantity,sale_price FROM variants WHERE id=?1",
            params![variant_id],|r|Ok((r.get(0)?,r.get(1)?))).unwrap();
        assert_eq!((qty,price),(5,9000));
    }
}
