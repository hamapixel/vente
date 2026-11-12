//! Corrections de ventes, annulations et remboursements : journal comptable non destructif.
//! Jamais de second encaissement automatique : les paiements existants sont immuables.
use std::collections::BTreeMap;
use rusqlite::{Connection, OptionalExtension, params, Transaction};
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::{Db, Auth, error, now, require_admin};

pub(crate) fn migrate(conn: &mut Connection) -> rusqlite::Result<()> {
    let tx=conn.transaction()?;
    tx.execute_batch(r#"
        CREATE TABLE IF NOT EXISTS sale_refunds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL REFERENCES sales(id),
            request_id TEXT NOT NULL UNIQUE,
            amount INTEGER NOT NULL CHECK(amount>0),
            method TEXT NOT NULL,
            reason TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sale_cancellations (
            sale_id INTEGER PRIMARY KEY REFERENCES sales(id),
            reason TEXT NOT NULL,
            actor TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sale_revisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL REFERENCES sales(id),
            request_id TEXT NOT NULL UNIQUE,
            actor TEXT NOT NULL,
            old_total INTEGER NOT NULL,
            new_total INTEGER NOT NULL,
            paid_before INTEGER NOT NULL,
            paid_after INTEGER NOT NULL,
            refund INTEGER NOT NULL,
            additional_payment INTEGER NOT NULL,
            old_items_json TEXT NOT NULL,
            new_items_json TEXT NOT NULL,
            reason TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sale_refunds_date ON sale_refunds(created_at);
        CREATE INDEX IF NOT EXISTS idx_sale_refunds_sale ON sale_refunds(sale_id);
        CREATE INDEX IF NOT EXISTS idx_sale_revision_sale ON sale_revisions(sale_id);
    "#)?;
    tx.commit()
}

pub(crate) fn cancelled(conn:&Connection,sale_id:i64)->Result<bool,String>{
    conn.query_row("SELECT EXISTS(SELECT 1 FROM sale_cancellations WHERE sale_id=?1)",
        params![sale_id],|r|r.get(0)).map_err(error)
}

pub(crate) fn paid_net(conn:&Connection,sale_id:i64)->Result<i64,String>{
    let p:i64=conn.query_row(
        "SELECT COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id=?1),0)
                -COALESCE((SELECT SUM(amount) FROM sale_refunds WHERE sale_id=?1),0)",
        params![sale_id],|r|r.get(0)).map_err(error)?;
    if p<0 {return Err("Le solde de cette vente est incohérent.".into());}
    Ok(p)
}

#[derive(Debug,Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct SaleDetail {
    pub id:i64, pub reference:String, pub total:i64, pub subtotal:i64,
    pub discount:i64, pub paid:i64, pub remaining:i64, pub customer_id:Option<i64>,
    pub cancelled:bool, pub lines:Vec<SaleDetailLine>,
}
#[derive(Debug,Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct SaleDetailLine {
    pub variant_id:i64, pub name:String, pub variant:String,
    pub quantity:i64, pub unit_price:i64, pub unit_cost:i64,
}
fn load_detail(conn:&Connection,sale_id:i64)->Result<SaleDetail,String>{
    let row=conn.query_row(
        "SELECT s.id,s.reference,s.subtotal,s.discount,s.total,sc.customer_id
         FROM sales s LEFT JOIN sale_customers sc ON sc.sale_id=s.id WHERE s.id=?1",
        params![sale_id],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?,r.get::<_,i64>(2)?,
            r.get::<_,i64>(3)?,r.get::<_,i64>(4)?,r.get::<_,Option<i64>>(5)?))
    ).optional().map_err(error)?.ok_or("Vente introuvable.")?;
    let mut stmt=conn.prepare(
        "SELECT variant_id,name_snapshot,variant_snapshot,quantity,unit_price,unit_cost
         FROM sale_items WHERE sale_id=?1 ORDER BY id"
    ).map_err(error)?;
    let lines=stmt.query_map(params![sale_id],|r|Ok(SaleDetailLine{
        variant_id:r.get(0)?,name:r.get(1)?,variant:r.get(2)?,quantity:r.get(3)?,
        unit_price:r.get(4)?,unit_cost:r.get(5)?
    })).map_err(error)?.collect::<rusqlite::Result<Vec<_>>>().map_err(error)?;
    let paid=paid_net(conn,sale_id)?;
    let is_cancelled=cancelled(conn,sale_id)?;
    Ok(SaleDetail{
        id:row.0,reference:row.1,subtotal:row.2,discount:row.3,total:row.4,
        paid:if is_cancelled {0} else {paid},
        remaining:if is_cancelled {0} else {row.4-paid},customer_id:row.5,
        cancelled:is_cancelled,lines
    })
}
#[tauri::command]
pub fn get_sale_detail(db:State<'_,Db>,auth:State<'_,Auth>,sale_id:i64)->Result<SaleDetail,String>{
    require_admin(&auth)?;
    let conn=db.0.lock().map_err(error)?;
    load_detail(&conn,sale_id)
}

#[derive(Debug,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct ChangedLine { variant_id:i64, quantity:i64 }
#[derive(Debug,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct SaleChange {
    sale_id:i64, request_id:String, items:Vec<ChangedLine>, discount:i64,
    customer_id:Option<i64>, additional_payment:i64,
    refund_amount:i64, payment_method:String, reason:String,
}
fn payment_method_ok(v:&str)->bool{
    ["Espèces","Orange Money","Moov Money","Autre"].contains(&v)
}
fn money_sum(tx:&Transaction<'_>,sale_id:i64)->Result<i64,String>{paid_net(tx,sale_id)}
fn adjust_stock_for_change(tx:&Transaction<'_>,sale_id:i64,
    old:&BTreeMap<i64,i64>,new:&BTreeMap<i64,i64>,label:&str)->Result<(),String>{
    let mut all=old.clone();
    for (id,q) in new {all.entry(*id).or_insert(*q);}
    for id in all.keys(){
        let delta=old.get(id).copied().unwrap_or(0)-new.get(id).copied().unwrap_or(0);
        if delta==0 {continue;}
        let available:i64=tx.query_row("SELECT quantity FROM variants WHERE id=?1",
            params![id],|r|r.get(0)).optional().map_err(error)?
            .ok_or("Une variante est introuvable.")?;
        if available.checked_add(delta).ok_or("Stock hors limites.")?<0 {
            return Err(format!("Stock insuffisant pour la variante N° {}.",id));
        }
        tx.execute("UPDATE variants SET quantity=quantity+?1 WHERE id=?2",
            params![delta,id]).map_err(error)?;
        tx.execute(
            "INSERT INTO stock_movements(variant_id,delta,reason,sale_id,created_at)
             VALUES(?1,?2,?3,?4,?5)",
            params![id,delta,label,sale_id,now()]
        ).map_err(error)?;
    }
    Ok(())
}

pub(crate) fn change_sale_core(conn:&mut Connection,input:SaleChange,actor:&str)
 ->Result<SaleDetail,String>{
    if input.request_id.trim().is_empty()||input.request_id.len()>128 {
        return Err("Identifiant de correction invalide.".into());
    }
    if input.reason.trim().chars().count()<5||input.reason.len()>500 {
        return Err("Expliquez la raison de la correction (au moins 5 caractères).".into());
    }
    if !payment_method_ok(&input.payment_method){
        return Err("Mode de paiement invalide.".into());
    }
    if input.additional_payment<0||input.refund_amount<0 {
        return Err("Paiement et remboursement doivent être positifs.".into());
    }
    if input.additional_payment>0&&input.refund_amount>0 {
        return Err("Un règlement et un remboursement ne peuvent être enregistrés ensemble.".into());
    }
    if input.items.is_empty(){return Err("Pour supprimer tous les articles, annulez la vente.".into());}
    let tx=conn.transaction().map_err(error)?;
    let prev:Option<i64>=tx.query_row(
        "SELECT sale_id FROM sale_revisions WHERE request_id=?1",params![input.request_id],
        |r|r.get(0)).optional().map_err(error)?;
    if let Some(sale_id)=prev {
        if sale_id!=input.sale_id{return Err("Cette opération a déjà été utilisée.".into());}
        return load_detail(&tx,input.sale_id);
    }
    if cancelled(&tx,input.sale_id)? {return Err("Cette vente a été annulée.".into());}
    let before=load_detail(&tx,input.sale_id)?;
    let mut quantities:BTreeMap<i64,i64>=BTreeMap::new();
    for item in &input.items {
        if item.quantity<=0 {return Err("Quantité d'article invalide.".into());}
        let q=quantities.entry(item.variant_id).or_default();
        *q=q.checked_add(item.quantity).ok_or("Quantité trop élevée.")?;
    }
    let original:BTreeMap<i64,i64>=before.lines.iter().map(|l|(l.variant_id,l.quantity)).collect();
    let mut new_lines=Vec::<SaleDetailLine>::new();
    let mut subtotal=0i64;
    let mut total_cost=0i64;
    for (&id,&qty) in &quantities {
        // La ligne d'origine garde ses prix d'origine si la fiche produit a été modifiée.
        let snapshot=before.lines.iter().find(|l|l.variant_id==id);
        let line=if let Some(l)=snapshot { l.clone() } else {
            tx.query_row(
                "SELECT p.name,v.size || ' / ' || v.color,v.sale_price,v.purchase_price
                 FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=?1",
                params![id],|r|Ok(SaleDetailLine{
                    variant_id:id,name:r.get(0)?,variant:r.get(1)?,quantity:qty,
                    unit_price:r.get(2)?,unit_cost:r.get(3)?
                })).optional().map_err(error)?.ok_or("Article introuvable.")?
        };
        let line_total=line.unit_price.checked_mul(qty).ok_or("Montant trop élevé.")?;
        let cost=line.unit_cost.checked_mul(qty).ok_or("Coût trop élevé.")?;
        subtotal=subtotal.checked_add(line_total).ok_or("Montant trop élevé.")?;
        total_cost=total_cost.checked_add(cost).ok_or("Coût trop élevé.")?;
        new_lines.push(SaleDetailLine{quantity:qty,..line});
    }
    if input.discount<0||input.discount>subtotal{return Err("Remise invalide.".into());}
    let total=subtotal-input.discount;
    let paid_before=money_sum(&tx,input.sale_id)?;
    let to_refund=(paid_before-total).max(0);
    if input.refund_amount!=to_refund {
        return Err(format!("Le nouveau total exige le remboursement exact de {} FCFA.",to_refund));
    }
    let paid_after=paid_before-to_refund+input.additional_payment;
    if paid_after>total {
        return Err("Montant supplémentaire supérieur au nouveau solde.".into());
    }
    let customer=input.customer_id;
    if let Some(cid)=customer {
        let exists:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM customers WHERE id=?1)",
            params![cid],|r|r.get(0)).map_err(error)?;
        if !exists{return Err("Client introuvable.".into());}
    }
    if paid_after<total&&customer.is_none(){
        return Err("Sélectionnez un client pour le solde restant, ou encaissez ce solde.".into());
    }
    let old_items=serde_json::to_string(&before.lines).map_err(error)?;
    let new_items=serde_json::to_string(&new_lines).map_err(error)?;
    adjust_stock_for_change(&tx,input.sale_id,&original,&quantities,"Correction de vente")?;
    tx.execute("DELETE FROM sale_items WHERE sale_id=?1",params![input.sale_id]).map_err(error)?;
    for line in &new_lines {
        tx.execute(
            "INSERT INTO sale_items(sale_id,variant_id,name_snapshot,variant_snapshot,quantity,unit_price,unit_cost,line_total)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",
            params![input.sale_id,line.variant_id,line.name,line.variant,line.quantity,
                line.unit_price,line.unit_cost,line.quantity*line.unit_price]
        ).map_err(error)?;
    }
    tx.execute("UPDATE sales SET subtotal=?1,discount=?2,total=?3,total_cost=?4 WHERE id=?5",
        params![subtotal,input.discount,total,total_cost,input.sale_id]).map_err(error)?;
    tx.execute("DELETE FROM sale_customers WHERE sale_id=?1",params![input.sale_id]).map_err(error)?;
    if let Some(cid)=customer {
        tx.execute("INSERT INTO sale_customers(sale_id,customer_id) VALUES(?1,?2)",
            params![input.sale_id,cid]).map_err(error)?;
    }
    if to_refund>0 {
        tx.execute(
            "INSERT INTO sale_refunds(sale_id,request_id,amount,method,reason,created_at)
             VALUES(?1,?2,?3,?4,?5,?6)",
            params![input.sale_id,format!("refund-{}",input.request_id),
                to_refund,input.payment_method,input.reason,now()]
        ).map_err(error)?;
    }
    if input.additional_payment>0 {
        tx.execute(
            "INSERT INTO sale_payments(sale_id,request_id,amount,method,created_at)
             VALUES(?1,?2,?3,?4,?5)",
            params![input.sale_id,format!("extra-{}",input.request_id),
                input.additional_payment,input.payment_method,now()]
        ).map_err(error)?;
    }
    tx.execute(
        "INSERT INTO sale_revisions(sale_id,request_id,actor,old_total,new_total,paid_before,paid_after,
            refund,additional_payment,old_items_json,new_items_json,reason,created_at)
         VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
        params![input.sale_id,input.request_id,actor,before.total,total,paid_before,paid_after,
            to_refund,input.additional_payment,old_items,new_items,input.reason,now()]
    ).map_err(error)?;
    tx.commit().map_err(error)?;
    load_detail(conn,input.sale_id)
}

#[tauri::command]
pub fn change_sale(db:State<'_,Db>,auth:State<'_,Auth>,input:SaleChange)->Result<SaleDetail,String>{
    require_admin(&auth)?;
    let actor=auth.0.lock().map_err(error)?.as_ref().ok_or("Session expirée.")?.username.clone();
    let mut conn=db.0.lock().map_err(error)?;
    change_sale_core(&mut conn,input,&actor)
}

#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
pub struct CancelSaleInput{
    sale_id:i64,request_id:String,reason:String,refunded_amount:i64,refund_method:String
}
pub(crate) fn cancel_sale_core(conn:&mut Connection,input:CancelSaleInput,actor:&str)
 ->Result<(),String>{
    if input.request_id.trim().is_empty()||input.request_id.len()>128||input.reason.trim().len()<5 {
        return Err("Référence de demande et justification obligatoire.".into());
    }
    if !payment_method_ok(&input.refund_method){return Err("Moyen de remboursement invalide.".into());}
    let tx=conn.transaction().map_err(error)?;
    if cancelled(&tx,input.sale_id)?{return Err("Cette vente est déjà annulée.".into());}
    let before=load_detail(&tx,input.sale_id)?;
    if input.refunded_amount!=before.paid {
        return Err(format!("Confirmez le remboursement physique de {} FCFA avant d'annuler.",before.paid));
    }
    let old:BTreeMap<i64,i64>=before.lines.iter().map(|l|(l.variant_id,l.quantity)).collect();
    adjust_stock_for_change(&tx,input.sale_id,&old,&BTreeMap::new(),"Annulation de vente")?;
    if before.paid>0 {
        tx.execute("INSERT INTO sale_refunds(sale_id,request_id,amount,method,reason,created_at)
                    VALUES(?1,?2,?3,?4,?5,?6)",
            params![input.sale_id,format!("cancel-{}",input.request_id),before.paid,
                input.refund_method,input.reason,now()]).map_err(error)?;
    }
    tx.execute("INSERT INTO sale_cancellations(sale_id,reason,actor,created_at) VALUES(?1,?2,?3,?4)",
        params![input.sale_id,input.reason,actor,now()]).map_err(error)?;
    tx.commit().map_err(error)
}
#[tauri::command]
pub fn cancel_sale(db:State<'_,Db>,auth:State<'_,Auth>,input:CancelSaleInput)->Result<(),String>{
    require_admin(&auth)?;
    let actor=auth.0.lock().map_err(error)?.as_ref().ok_or("Session expirée.")?.username.clone();
    let mut conn=db.0.lock().map_err(error)?;
    cancel_sale_core(&mut conn,input,&actor)
}

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct DailySummary{
    pub day:String, pub sales_total:i64, pub gross_profit:i64, pub sales_count:i64,
    pub collected:i64, pub refunds:i64, pub credit_created:i64,
    pub expenses:i64, pub cash_margin_estimate:i64
}
pub(crate) fn summary_for_day(conn:&Connection,day:&str)->Result<DailySummary,String>{
    chrono::NaiveDate::parse_from_str(day,"%Y-%m-%d")
        .map_err(|_|"Date invalide. Utilisez AAAA-MM-JJ.".to_string())?;
    let (sales_total,gross_profit,sales_count,credit_created):(i64,i64,i64,i64)=
    conn.query_row(
        "SELECT COALESCE(SUM(s.total),0),COALESCE(SUM(s.total-s.total_cost),0),COUNT(*),
                COALESCE(SUM(MAX(0,s.total-COALESCE(
                   (SELECT SUM(p.amount) FROM sale_payments p
                    WHERE p.sale_id=s.id AND (p.request_id LIKE 'initial-%' OR p.request_id LIKE 'legacy-sale-%')),0))),0)
         FROM sales s WHERE substr(s.created_at,1,10)=?1
           AND NOT EXISTS(SELECT 1 FROM sale_cancellations c WHERE c.sale_id=s.id)",
        params![day],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))
    ).map_err(error)?;
    let collected:i64=conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM sale_payments WHERE substr(created_at,1,10)=?1",
        params![day],|r|r.get(0)).map_err(error)?;
    let refunds:i64=conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM sale_refunds WHERE substr(created_at,1,10)=?1",
        params![day],|r|r.get(0)).map_err(error)?;
    let expenses:i64=conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE substr(created_at,1,10)=?1",
        params![day],|r|r.get(0)).map_err(error)?;
    let margin_pays:i64=conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN s.total>0
             THEN CAST((p.amount * 1.0 * (s.total-s.total_cost) / s.total) AS INTEGER)
             ELSE 0 END),0)
         FROM sale_payments p JOIN sales s ON s.id=p.sale_id
         WHERE substr(p.created_at,1,10)=?1",params![day],|r|r.get(0)).map_err(error)?;
    let margin_refunds:i64=conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN s.total>0
             THEN CAST((r.amount * 1.0 * (s.total-s.total_cost) / s.total) AS INTEGER)
             ELSE 0 END),0)
         FROM sale_refunds r JOIN sales s ON s.id=r.sale_id
         WHERE substr(r.created_at,1,10)=?1",params![day],|r|r.get(0)).map_err(error)?;
    Ok(DailySummary{day:day.to_string(),sales_total,gross_profit,sales_count,
        collected:collected-refunds,refunds,credit_created,expenses,
        cash_margin_estimate:margin_pays-margin_refunds})
}
#[tauri::command]
pub fn day_summary(db:State<'_,Db>,auth:State<'_,Auth>,day:String)->Result<DailySummary,String>{
    require_admin(&auth)?;
    let conn=db.0.lock().map_err(error)?;
    summary_for_day(&conn,&day)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{init_db,checkout_core,CheckoutInput,CartItem};
    fn seed()->(Connection,i64,i64,i64){
        let mut c=Connection::open_in_memory().unwrap();
        init_db(&c).unwrap();crate::commerce::migrate(&mut c).unwrap();migrate(&mut c).unwrap();
        c.execute("INSERT INTO customers(name,phone,created_at) VALUES('Awa','7000000',?1)",params![now()]).unwrap();
        let cid=c.last_insert_rowid();
        c.execute("INSERT INTO products(name,category,created_at) VALUES('Robe','Robes',?1)",params![now()]).unwrap();
        let pid=c.last_insert_rowid();
        c.execute("INSERT INTO variants(product_id,size,color,sku,purchase_price,sale_price,quantity)
                   VALUES(?1,'M','Bleu','R1',3000,10000,10)",params![pid]).unwrap();
        let v1=c.last_insert_rowid();
        c.execute("INSERT INTO variants(product_id,size,color,sku,purchase_price,sale_price,quantity)
                   VALUES(?1,'L','Rouge','R2',2000,5000,10)",params![pid]).unwrap();
        let v2=c.last_insert_rowid();
        (c,cid,v1,v2)
    }
    fn sale(c:&mut Connection,cid:Option<i64>,v:i64,received:i64,key:&str)->i64{
        checkout_core(c,CheckoutInput{
            request_id:key.into(),items:vec![CartItem{variant_id:v,quantity:1}],
            discount:0,payment_method:"Espèces".into(),customer_id:cid,payment_received:Some(received)
        }).unwrap().id
    }
    fn change(id:i64,cid:Option<i64>,v:i64,qty:i64,key:&str)->SaleChange{
        SaleChange{sale_id:id,request_id:key.into(),items:vec![ChangedLine{variant_id:v,quantity:qty}],
            discount:0,customer_id:cid,additional_payment:0,refund_amount:0,
            payment_method:"Espèces".into(),reason:"Correction de quantité".into()}
    }
    #[test]
    fn edit_credit_only_changes_items_and_keeps_original_deposit(){
        let (mut c,cid,v1,_)=seed();
        let id=sale(&mut c,Some(cid),v1,2000,"credit-001");
        let first=change_sale_core(&mut c,change(id,Some(cid),v1,2,"chg-1"),"Admin").unwrap();
        assert_eq!((first.total,first.paid,first.remaining),(20000,2000,18000));
        let replay=change_sale_core(&mut c,change(id,Some(cid),v1,2,"chg-1"),"Admin").unwrap();
        assert_eq!(replay.remaining,18000);
        let count:i64=c.query_row("SELECT COUNT(*) FROM sale_payments WHERE sale_id=?1",params![id],|r|r.get(0)).unwrap();
        assert_eq!(count,1);
        let stock:i64=c.query_row("SELECT quantity FROM variants WHERE id=?1",params![v1],|r|r.get(0)).unwrap();
        assert_eq!(stock,8);
    }
    #[test]
    fn paid_sale_add_items_only_collects_incremental_amount(){
        let (mut c,cid,v1,_)=seed();
        let id=sale(&mut c,None,v1,10000,"paid");
        let mut input=change(id,Some(cid),v1,2,"change-paid");
        input.additional_payment=3000;
        let detail=change_sale_core(&mut c,input,"Admin").unwrap();
        assert_eq!((detail.total,detail.paid,detail.remaining),(20000,13000,7000));
    }
    #[test]
    fn paid_sale_reduction_requires_exact_refund_and_never_erases_payments(){
        let (mut c,cid,v1,_)=seed();
        let id=sale(&mut c,Some(cid),v1,10000,"paid-red");
        let double=change(id,Some(cid),v1,2,"up");
        change_sale_core(&mut c,double,"Admin").unwrap();
        let down=change(id,Some(cid),v1,1,"down");
        // 10 000 déjà payés et 10 000 nouveau total : aucun remboursement.
        change_sale_core(&mut c,down,"Admin").unwrap();
        let paid=paid_net(&c,id).unwrap();assert_eq!(paid,10000);
        let mut zero=change(id,Some(cid),v1,1,"down-2");
        zero.discount=6000;
        assert!(change_sale_core(&mut c,zero,"Admin").is_err());
        let mut refund=change(id,Some(cid),v1,1,"down-3");
        refund.discount=6000;refund.refund_amount=6000;
        let result=change_sale_core(&mut c,refund,"Admin").unwrap();
        assert_eq!((result.total,result.paid,result.remaining),(4000,4000,0));
        let count:i64=c.query_row("SELECT COUNT(*) FROM sale_payments WHERE sale_id=?1",params![id],|r|r.get(0)).unwrap();
        assert_eq!(count,1);
    }
    #[test]
    fn cancel_unpaid_sale_restores_stock_and_marks_immutable_audit(){
        let (mut c,cid,v1,_)=seed();let id=sale(&mut c,Some(cid),v1,0,"unpaid");
        cancel_sale_core(&mut c,CancelSaleInput{sale_id:id,request_id:"cancel-1".into(),
            reason:"Annulation à la demande du client".into(),
            refunded_amount:0,refund_method:"Espèces".into()},"Admin").unwrap();
        assert!(cancelled(&c,id).unwrap());
        let stock:i64=c.query_row("SELECT quantity FROM variants WHERE id=?1",params![v1],|r|r.get(0)).unwrap();
        assert_eq!(stock,10);
        assert!(cancel_sale_core(&mut c,CancelSaleInput{sale_id:id,request_id:"cancel-1".into(),
            reason:"Annulation à la demande du client".into(),
            refunded_amount:0,refund_method:"Espèces".into()},"Admin").is_err());
    }
    #[test]
    fn cancel_paid_requires_physical_refund_and_no_second_refund(){
        let (mut c,_cid,v1,_)=seed();let id=sale(&mut c,None,v1,10000,"paid-cancel");
        let mk=|amount|CancelSaleInput{sale_id:id,request_id:"cancel-2".into(),
            reason:"Vente saisie par erreur".into(),refunded_amount:amount,refund_method:"Espèces".into()};
        assert!(cancel_sale_core(&mut c,mk(0),"Admin").is_err());
        cancel_sale_core(&mut c,mk(10000),"Admin").unwrap();
        assert_eq!(paid_net(&c,id).unwrap(),0);
        let count:i64=c.query_row("SELECT COUNT(*) FROM sale_refunds WHERE sale_id=?1",params![id],|r|r.get(0)).unwrap();
        assert_eq!(count,1);
    }
    #[test]
    fn date_summary_separates_credit_sale_and_cash_receipts(){
        let (mut c,cid,v1,_)=seed();let id=sale(&mut c,Some(cid),v1,2000,"date");
        let a=summary_for_day(&c,&crate::today()).unwrap();
        assert_eq!((a.sales_total,a.collected,a.credit_created),(10000,2000,8000));
        crate::commerce::settle(&mut c,id,3000,"Espèces","follow").unwrap();
        let b=summary_for_day(&c,&crate::today()).unwrap();
        assert_eq!(b.collected,5000);
    }
}
