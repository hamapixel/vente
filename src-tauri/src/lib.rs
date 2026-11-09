mod commerce;
use chrono::Local;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier, password_hash::{rand_core::OsRng, SaltString}};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fs, sync::Mutex, time::{Duration, Instant}};
use tauri::{Manager, State};

struct Db(Mutex<Connection>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionInfo { username: String, role: String }
struct Auth(Mutex<Option<SessionInfo>>);
#[derive(Default)]
struct LoginGuard(Mutex<FailedLogin>);

#[derive(Default)]
struct FailedLogin {
    attempts: u32,
    locked_until: Option<Instant>,
}
fn check_login_attempt(guard: &LoginGuard) -> Result<(), String> {
    let mut state = guard.0.lock().map_err(error)?;
    if let Some(until) = state.locked_until {
        if let Some(remaining) = until.checked_duration_since(Instant::now()) {
            return Err(format!("Trop de tentatives. Réessayez dans {} secondes.", remaining.as_secs()+1));
        }
        state.attempts = 0;
        state.locked_until = None;
    }
    Ok(())
}
fn record_failed_login(guard: &LoginGuard) -> Result<(), String> {
    let mut state = guard.0.lock().map_err(error)?;
    state.attempts = state.attempts.saturating_add(1);
    if state.attempts >= 5 {
        state.locked_until = Some(Instant::now() + Duration::from_secs(60));
    }
    Ok(())
}
fn clear_failed_login(guard: &LoginGuard) -> Result<(), String> {
    let mut state = guard.0.lock().map_err(error)?;
    *state = FailedLogin::default();
    Ok(())
}


fn require_auth(auth: &State<'_, Auth>) -> Result<SessionInfo, String> {
    auth.0.lock().map_err(error)?.clone().ok_or("Connexion requise.".to_string())
}
fn require_admin(auth: &State<'_, Auth>) -> Result<(), String> {
    if require_auth(auth)?.role != "admin" { return Err("Accès réservé à l'administrateur.".into()); }
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthStatus {
    setup_required: bool,
    user: Option<SessionInfo>,
}

#[tauri::command]
fn auth_status(db: State<'_, Db>, auth: State<'_, Auth>) -> Result<AuthStatus,String> {
    let conn=db.0.lock().map_err(error)?;
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM users",[],|r|r.get(0)).map_err(error)?;
    let user=auth.0.lock().map_err(error)?.clone();
    Ok(AuthStatus{setup_required:count==0,user})
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LoginBrand { name: String, logo_data: String }

#[tauri::command]
fn get_login_brand(db: State<'_, Db>) -> Result<LoginBrand,String> {
    let conn=db.0.lock().map_err(error)?;
    conn.query_row(
        "SELECT s.name, b.logo_data FROM shops s JOIN shop_branding b ON b.shop_id = s.id WHERE s.id=1",
        [], |row| Ok(LoginBrand{name:row.get(0)?,logo_data:row.get(1)?})
    ).map_err(error)
}

#[tauri::command]
fn register_admin(db: State<'_, Db>, auth: State<'_, Auth>, username: String, password: String) -> Result<SessionInfo,String> {
    let login=username.trim();
    if login.len()<3 || login.len()>50 || !login.chars().all(|c|c.is_alphanumeric() || c=='_' || c=='-' || c=='.') {
        return Err("Identifiant invalide (3 à 50 caractères, lettres, chiffres, . _ -).".into());
    }
    if password.chars().count()<8 || password.chars().count()>128 {
        return Err("Choisissez un mot de passe de 8 à 128 caractères.".into());
    }
    let mut conn=db.0.lock().map_err(error)?;
    let tx=conn.transaction().map_err(error)?;
    let count: i64=tx.query_row("SELECT COUNT(*) FROM users",[],|r|r.get(0)).map_err(error)?;
    if count!=0 { return Err("Un administrateur existe déjà. Connectez-vous.".into()); }
    let salt=SaltString::generate(&mut OsRng);
    let hash=Argon2::default().hash_password(password.as_bytes(),&salt).map_err(error)?.to_string();
    tx.execute("INSERT INTO users (username,password_hash,role) VALUES (?1,?2,'admin')",params![login,hash]).map_err(error)?;
    tx.commit().map_err(error)?;
    let session=SessionInfo{username:login.to_string(),role:"admin".into()};
    *auth.0.lock().map_err(error)?=Some(session.clone());
    Ok(session)
}

#[tauri::command]
fn login(db: State<'_, Db>, auth: State<'_, Auth>, guard: State<'_, LoginGuard>, username: String, password: String) -> Result<SessionInfo,String> {
    check_login_attempt(&guard)?;
    let conn=db.0.lock().map_err(error)?;
    let row=conn.query_row("SELECT username,password_hash,role FROM users WHERE username=?1 COLLATE NOCASE",
        params![username.trim()], |r| Ok((
            r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?
        ))
    ).optional().map_err(error)?;
    let credentials = row.and_then(|(name,hash,role)| {
        PasswordHash::new(&hash).ok().and_then(|parsed| {
            if Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok() {
                Some(SessionInfo {username:name,role})
            } else { None }
        })
    });
    let session = if let Some(session) = credentials {
        clear_failed_login(&guard)?;
        session
    } else {
        record_failed_login(&guard)?;
        return Err("Identifiant ou mot de passe incorrect.".into());
    };
    *auth.0.lock().map_err(error)?=Some(session.clone());
    Ok(session)
}

#[tauri::command]
fn logout(auth: State<'_, Auth>) -> Result<(),String> {
    *auth.0.lock().map_err(error)?=None;
    Ok(())
}

fn init_db(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS shops (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            name TEXT NOT NULL,
            phone TEXT NOT NULL DEFAULT '',
            address TEXT NOT NULL DEFAULT ''
        );
        INSERT OR IGNORE INTO shops (id, name) VALUES (1, 'Ma boutique');
        CREATE TABLE IF NOT EXISTS shop_branding (
            shop_id INTEGER PRIMARY KEY CHECK (shop_id=1) REFERENCES shops(id),
            logo_data TEXT NOT NULL DEFAULT '',
            receipt_header TEXT NOT NULL DEFAULT '',
            receipt_footer TEXT NOT NULL DEFAULT 'Merci pour votre achat !',
            receipt_format TEXT NOT NULL DEFAULT 'ticket' CHECK (receipt_format IN ('ticket','a4'))
        );
        INSERT OR IGNORE INTO shop_branding (shop_id) VALUES (1);
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin','vendeur'))
        );
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS variants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL REFERENCES products(id),
            size TEXT NOT NULL,
            color TEXT NOT NULL,
            sku TEXT NOT NULL UNIQUE,
            purchase_price INTEGER NOT NULL CHECK (purchase_price >= 0),
            sale_price INTEGER NOT NULL CHECK (sale_price >= 0),
            quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
            UNIQUE (product_id, size, color)
        );
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reference TEXT NOT NULL UNIQUE,
            request_id TEXT NOT NULL UNIQUE,
            subtotal INTEGER NOT NULL,
            discount INTEGER NOT NULL,
            total INTEGER NOT NULL,
            total_cost INTEGER NOT NULL,
            payment_method TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL REFERENCES sales(id),
            variant_id INTEGER NOT NULL REFERENCES variants(id),
            name_snapshot TEXT NOT NULL,
            variant_snapshot TEXT NOT NULL,
            quantity INTEGER NOT NULL CHECK (quantity > 0),
            unit_price INTEGER NOT NULL,
            unit_cost INTEGER NOT NULL,
            line_total INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS stock_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            variant_id INTEGER NOT NULL REFERENCES variants(id),
            delta INTEGER NOT NULL,
            reason TEXT NOT NULL,
            sale_id INTEGER REFERENCES sales(id),
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            amount INTEGER NOT NULL CHECK (amount > 0),
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
        CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);
        CREATE INDEX IF NOT EXISTS idx_stock_variant ON stock_movements(variant_id);
        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(created_at);
        "#
    )
}

fn now() -> String {
    Local::now().format("%Y-%m-%dT%H:%M:%S%:z").to_string()
}

fn today() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn error(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Variant {
    id: i64,
    product_id: i64,
    name: String,
    category: String,
    size: String,
    color: String,
    sku: String,
    purchase_price: i64,
    sale_price: i64,
    quantity: i64,
}

#[tauri::command]
fn get_catalog(db: State<'_, Db>, auth: State<'_, Auth>) -> Result<Vec<Variant>, String> {
    require_auth(&auth)?;
    let conn = db.0.lock().map_err(error)?;
    let mut stmt = conn.prepare(
        "SELECT v.id, p.id, p.name, p.category, v.size, v.color, v.sku,
                v.purchase_price, v.sale_price, v.quantity
         FROM variants v JOIN products p ON p.id = v.product_id
         ORDER BY p.name COLLATE NOCASE, v.size, v.color"
    ).map_err(error)?;
    let rows = stmt.query_map([], |r| Ok(Variant {
        id: r.get(0)?, product_id: r.get(1)?, name: r.get(2)?,
        category: r.get(3)?, size: r.get(4)?, color: r.get(5)?,
        sku: r.get(6)?, purchase_price: r.get(7)?,
        sale_price: r.get(8)?, quantity: r.get(9)?,
    })).map_err(error)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(error)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NewVariant {
    size: String,
    color: String,
    quantity: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NewProduct {
    name: String,
    category: String,
    purchase_price: i64,
    sale_price: i64,
    variants: Vec<NewVariant>,
}

#[tauri::command]
fn create_product(db: State<'_, Db>, auth: State<'_, Auth>, input: NewProduct) -> Result<i64, String> {
    require_admin(&auth)?;
    let name = input.name.trim();
    if name.is_empty() || input.category.trim().is_empty() {
        return Err("Le nom et la catégorie sont obligatoires.".into());
    }
    if input.purchase_price < 0 || input.sale_price < 0 || input.variants.is_empty() {
        return Err("Prix ou variantes invalides.".into());
    }
    let mut conn = db.0.lock().map_err(error)?;
    let tx = conn.transaction().map_err(error)?;
    tx.execute("INSERT INTO products (name,category,created_at) VALUES (?1,?2,?3)",
        params![name, input.category.trim(), now()]).map_err(error)?;
    let product_id = tx.last_insert_rowid();
    for (index, variant) in input.variants.iter().enumerate() {
        if variant.quantity < 0 {
            return Err("Le stock initial ne peut pas être négatif.".into());
        }
        let size = if variant.size.trim().is_empty() { "Unique" } else { variant.size.trim() };
        let color = if variant.color.trim().is_empty() { "Standard" } else { variant.color.trim() };
        let sku = format!("MS-{}-{:03}", product_id, index + 1);
        tx.execute("INSERT INTO variants (product_id,size,color,sku,purchase_price,sale_price,quantity)
                    VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![product_id,size,color,sku,input.purchase_price,input.sale_price,variant.quantity]
        ).map_err(error)?;
        let variant_id = tx.last_insert_rowid();
        if variant.quantity > 0 {
            tx.execute("INSERT INTO stock_movements (variant_id,delta,reason,created_at)
                        VALUES (?1,?2,'Stock initial',?3)",
                params![variant_id,variant.quantity,now()]).map_err(error)?;
        }
    }
    tx.commit().map_err(error)?;
    Ok(product_id)
}

#[tauri::command]
fn adjust_stock(db: State<'_, Db>, auth: State<'_, Auth>, variant_id: i64, delta: i64, reason: String) -> Result<(), String> {
    require_admin(&auth)?;
    if delta == 0 || reason.trim().is_empty() {
        return Err("Indiquez une quantité et un motif.".into());
    }
    let mut conn = db.0.lock().map_err(error)?;
    let tx = conn.transaction().map_err(error)?;
    let changed = tx.execute(
        "UPDATE variants SET quantity = quantity + ?1
         WHERE id = ?2 AND quantity + ?1 >= 0",
        params![delta,variant_id]
    ).map_err(error)?;
    if changed == 0 { return Err("Stock insuffisant ou variante introuvable.".into()); }
    tx.execute("INSERT INTO stock_movements (variant_id,delta,reason,created_at)
                VALUES (?1,?2,?3,?4)",
        params![variant_id,delta,reason.trim(),now()]).map_err(error)?;
    tx.commit().map_err(error)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CartItem { variant_id: i64, quantity: i64 }

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CheckoutInput {
    request_id: String,
    items: Vec<CartItem>,
    discount: i64,
    payment_method: String,
    customer_id: Option<i64>,
    payment_received: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Receipt {
    id: i64,
    reference: String,
    total: i64,
    total_cost: i64,
    created_at: String,
    paid: i64,
    remaining: i64,
}

#[tauri::command]
fn checkout(db: State<'_, Db>, auth: State<'_, Auth>, input: CheckoutInput) -> Result<Receipt, String> {
    require_auth(&auth)?;
    if input.request_id.trim().is_empty() || input.items.is_empty() {
        return Err("Panier ou identifiant de vente invalide.".into());
    }
    if !["Espèces", "Orange Money", "Moov Money", "Autre"].contains(&input.payment_method.as_str()) {
        return Err("Mode de paiement invalide.".into());
    }
    let mut conn = db.0.lock().map_err(error)?;
    let tx = conn.transaction().map_err(error)?;
    let existing = tx.query_row(
        "SELECT id,reference,total,total_cost,created_at FROM sales WHERE request_id=?1",
        params![input.request_id], |r| Ok((
            r.get::<_,i64>(0)?,r.get::<_,String>(1)?,r.get::<_,i64>(2)?,
            r.get::<_,i64>(3)?,r.get::<_,String>(4)?
        ))
    ).optional().map_err(error)?;
    if let Some((id,reference,total,total_cost,created_at)) = existing {
        let paid:i64=tx.query_row(
            "SELECT COALESCE(SUM(amount),0) FROM sale_payments WHERE sale_id=?1",
            params![id],|r|r.get(0)
        ).map_err(error)?;
        return Ok(Receipt{id,reference,total,total_cost,created_at,paid,remaining:total-paid});
    }

    let mut quantities: BTreeMap<i64,i64> = BTreeMap::new();
    for item in input.items {
        if item.quantity <= 0 { return Err("Quantité invalide.".into()); }
        let current = quantities.entry(item.variant_id).or_insert(0);
        *current = current.checked_add(item.quantity).ok_or("Quantité excessive.")?;
    }
    let mut lines = Vec::new();
    let mut subtotal = 0i64;
    let mut total_cost = 0i64;
    for (variant_id, quantity) in &quantities {
        let row = tx.query_row(
            "SELECT p.name, v.size || ' / ' || v.color, v.quantity, v.sale_price, v.purchase_price
             FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=?1",
            params![variant_id],
            |r| Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,
                     r.get::<_,i64>(2)?,r.get::<_,i64>(3)?,r.get::<_,i64>(4)?))
        ).optional().map_err(error)?.ok_or("Produit introuvable.")?;
        if row.2 < *quantity { return Err(format!("Stock insuffisant pour {} ({}).",row.0,row.1)); }
        let line_total = row.3.checked_mul(*quantity).ok_or("Montant trop élevé.")?;
        let line_cost = row.4.checked_mul(*quantity).ok_or("Coût trop élevé.")?;
        subtotal = subtotal.checked_add(line_total).ok_or("Montant trop élevé.")?;
        total_cost = total_cost.checked_add(line_cost).ok_or("Coût trop élevé.")?;
        lines.push((*variant_id,*quantity,row.0,row.1,row.3,row.4,line_total));
    }
    if input.discount < 0 || input.discount > subtotal { return Err("Remise invalide.".into()); }
    let total = subtotal - input.discount;
    let received = input.payment_received.unwrap_or(total);
    if received<0 || received>total {
        return Err("Le paiement doit être compris entre zéro et le montant de la vente.".into());
    }
    if received<total && input.customer_id.is_none() {
        return Err("Sélectionnez un client pour une vente à crédit ou avec acompte.".into());
    }
    if let Some(customer_id)=input.customer_id {
        let exists:bool=tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM customers WHERE id=?1)",
            params![customer_id],|r|r.get(0)
        ).map_err(error)?;
        if !exists { return Err("Client introuvable.".into()); }
    }
    let created_at = now();
    tx.execute(
        "INSERT INTO sales (reference,request_id,subtotal,discount,total,total_cost,payment_method,created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params!["TMP",input.request_id,subtotal,input.discount,total,total_cost,input.payment_method,created_at]
    ).map_err(error)?;
    let sale_id = tx.last_insert_rowid();
    if let Some(customer_id)=input.customer_id {
        tx.execute("INSERT INTO sale_customers(sale_id,customer_id) VALUES (?1,?2)",
            params![sale_id,customer_id]).map_err(error)?;
    }
    if received>0 {
        tx.execute(
            "INSERT INTO sale_payments(sale_id,request_id,amount,method,created_at) VALUES (?1,?2,?3,?4,?5)",
            params![sale_id,format!("initial-{}",input.request_id),received,input.payment_method,created_at]
        ).map_err(error)?;
    }
    let reference = format!("VT-{}-{:05}", Local::now().format("%Y%m%d"),sale_id);
    tx.execute("UPDATE sales SET reference=?1 WHERE id=?2",params![reference,sale_id]).map_err(error)?;
    for (variant_id, quantity, name, label, unit_price, unit_cost, line_total) in lines {
        tx.execute(
            "INSERT INTO sale_items (sale_id,variant_id,name_snapshot,variant_snapshot,quantity,unit_price,unit_cost,line_total)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![sale_id,variant_id,name,label,quantity,unit_price,unit_cost,line_total]
        ).map_err(error)?;
        tx.execute("UPDATE variants SET quantity=quantity-?1 WHERE id=?2",params![quantity,variant_id]).map_err(error)?;
        tx.execute(
            "INSERT INTO stock_movements (variant_id,delta,reason,sale_id,created_at)
             VALUES (?1,?2,'Vente',?3,?4)",
            params![variant_id,-quantity,sale_id,created_at]
        ).map_err(error)?;
    }
    tx.commit().map_err(error)?;
    Ok(Receipt {id:sale_id,reference,total,total_cost,created_at,paid:received,remaining:total-received})
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Dashboard {
    sales_total: i64, gross_profit: i64, expenses: i64,
    sales_count: i64, low_stock: i64, variant_count: i64,
    collected_today: i64, outstanding: i64,
}

#[tauri::command]
fn get_dashboard(db: State<'_, Db>, auth: State<'_, Auth>) -> Result<Dashboard,String> {
    require_admin(&auth)?;
    let conn = db.0.lock().map_err(error)?;
    let (sales_total,gross_profit,sales_count): (i64,i64,i64) = conn.query_row(
        "SELECT COALESCE(SUM(total),0), COALESCE(SUM(total-total_cost),0), COUNT(*)
         FROM sales WHERE substr(created_at,1,10)=?1",
        params![today()],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))
    ).map_err(error)?;
    let expenses = conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE substr(created_at,1,10)=?1",
        params![today()],|r|r.get(0)
    ).map_err(error)?;
    let (low_stock,variant_count): (i64,i64) = conn.query_row(
        "SELECT COALESCE(SUM(CASE WHEN quantity<=3 THEN 1 ELSE 0 END),0),COUNT(*) FROM variants",
        [],|r|Ok((r.get(0)?,r.get(1)?))
    ).map_err(error)?;
    let collected_today:i64=conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM sale_payments WHERE substr(created_at,1,10)=?1",
        params![today()],|r|r.get(0)
    ).map_err(error)?;
    let outstanding:i64=conn.query_row(
        "SELECT COALESCE(SUM(s.total-COALESCE((SELECT SUM(p.amount) FROM sale_payments p WHERE p.sale_id=s.id),0)),0)
         FROM sales s",[],|r|r.get(0)
    ).map_err(error)?;
    Ok(Dashboard {sales_total,gross_profit,expenses,sales_count,low_stock,variant_count,collected_today,outstanding})
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Sale {
    id: i64, reference: String, total: i64, total_cost: i64,
    payment_method: String, created_at: String,
    paid: i64, remaining: i64, customer_id: Option<i64>, customer_name: Option<String>,
}

#[tauri::command]
fn get_sales(db: State<'_, Db>, auth: State<'_, Auth>) -> Result<Vec<Sale>,String> {
    require_auth(&auth)?;
    let conn = db.0.lock().map_err(error)?;
    let mut stmt = conn.prepare(
        "SELECT s.id,s.reference,s.total,s.total_cost,s.payment_method,s.created_at,
            COALESCE((SELECT SUM(amount) FROM sale_payments WHERE sale_id=s.id),0),
            sc.customer_id,c.name
         FROM sales s
         LEFT JOIN sale_customers sc ON sc.sale_id=s.id
         LEFT JOIN customers c ON c.id=sc.customer_id
         ORDER BY s.id DESC LIMIT 1000"
    ).map_err(error)?;
    let rows=stmt.query_map([],|r|Ok(Sale {
        id:r.get(0)?,reference:r.get(1)?,total:r.get(2)?,
        total_cost:r.get(3)?,payment_method:r.get(4)?,created_at:r.get(5)?,
        paid:r.get(6)?,remaining:r.get::<_,i64>(2)?-r.get::<_,i64>(6)?,
        customer_id:r.get(7)?,customer_name:r.get(8)?
    })).map_err(error)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(error)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReportDay { day: String, total: i64, gross_profit: i64, count: i64 }

#[tauri::command]
fn get_report(db: State<'_, Db>, auth: State<'_, Auth>, from: String, to: String) -> Result<Vec<ReportDay>,String> {
    require_admin(&auth)?;
    if from.len()!=10 || to.len()!=10 || from>to { return Err("Période invalide.".into()); }
    let conn = db.0.lock().map_err(error)?;
    let mut stmt = conn.prepare(
        "SELECT substr(created_at,1,10),COALESCE(SUM(total),0),
                COALESCE(SUM(total-total_cost),0),COUNT(*)
         FROM sales WHERE substr(created_at,1,10) BETWEEN ?1 AND ?2
         GROUP BY substr(created_at,1,10) ORDER BY 1 DESC"
    ).map_err(error)?;
    let rows=stmt.query_map(params![from,to],|r|Ok(ReportDay {
        day:r.get(0)?,total:r.get(1)?,gross_profit:r.get(2)?,count:r.get(3)?
    })).map_err(error)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(error)
}

#[tauri::command]
fn add_expense(db: State<'_, Db>, auth: State<'_, Auth>, label: String, amount: i64) -> Result<(),String> {
    require_admin(&auth)?;
    if label.trim().is_empty() || amount <= 0 { return Err("Dépense invalide.".into()); }
    let conn = db.0.lock().map_err(error)?;
    conn.execute("INSERT INTO expenses (label,amount,created_at) VALUES (?1,?2,?3)",
        params![label.trim(),amount,now()]).map_err(error)?;
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Shop {
    name: String,
    phone: String,
    address: String,
    logo_data: String,
    receipt_header: String,
    receipt_footer: String,
    receipt_format: String,
}

#[tauri::command]
fn get_shop(db: State<'_, Db>, auth: State<'_, Auth>) -> Result<Shop,String> {
    require_auth(&auth)?;
    let conn=db.0.lock().map_err(error)?;
    conn.query_row(
        "SELECT s.name,s.phone,s.address,b.logo_data,b.receipt_header,b.receipt_footer,b.receipt_format
         FROM shops s JOIN shop_branding b ON b.shop_id=s.id WHERE s.id=1",
        [], |r| Ok(Shop{
            name:r.get(0)?,phone:r.get(1)?,address:r.get(2)?,
            logo_data:r.get(3)?,receipt_header:r.get(4)?,
            receipt_footer:r.get(5)?,receipt_format:r.get(6)?
        })
    ).map_err(error)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShopInput {
    name: String,
    phone: String,
    address: String,
    logo_data: String,
    receipt_header: String,
    receipt_footer: String,
    receipt_format: String,
}

#[tauri::command]
fn update_shop(db: State<'_, Db>, auth: State<'_, Auth>, shop: ShopInput) -> Result<(),String> {
    require_admin(&auth)?;
    if shop.name.trim().is_empty() || shop.name.len()>120 { return Err("Nom de boutique invalide.".into()); }
    if shop.phone.len()>80 || shop.address.len()>250 ||
        shop.receipt_header.len()>350 || shop.receipt_footer.len()>350 {
        return Err("En-tête, pied de page ou coordonnées trop longs.".into());
    }
    if !["ticket","a4"].contains(&shop.receipt_format.as_str()) {
        return Err("Format de document invalide.".into());
    }
    if shop.logo_data.len()>700_000 ||
       (!shop.logo_data.is_empty() && !["data:image/png;base64,","data:image/jpeg;base64,","data:image/webp;base64,"].iter().any(|prefix|shop.logo_data.starts_with(prefix))) {
        return Err("Logo invalide. Utilisez PNG, JPG ou WebP (maximum 500 Ko).".into());
    }
    let mut conn=db.0.lock().map_err(error)?;
    let tx=conn.transaction().map_err(error)?;
    tx.execute("UPDATE shops SET name=?1,phone=?2,address=?3 WHERE id=1",
        params![shop.name.trim(),shop.phone.trim(),shop.address.trim()]).map_err(error)?;
    tx.execute(
        "UPDATE shop_branding SET logo_data=?1,receipt_header=?2,receipt_footer=?3,receipt_format=?4 WHERE shop_id=1",
        params![shop.logo_data,shop.receipt_header.trim(),shop.receipt_footer.trim(),shop.receipt_format]
    ).map_err(error)?;
    tx.commit().map_err(error)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReceiptLine {
    name: String,
    variant: String,
    quantity: i64,
    unit_price: i64,
    line_total: i64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReceiptDocument {
    reference: String,
    created_at: String,
    payment_method: String,
    subtotal: i64,
    discount: i64,
    total: i64,
    paid: i64,
    remaining: i64,
    customer_name: Option<String>,
    lines: Vec<ReceiptLine>,
}
#[tauri::command]
fn get_receipt(db: State<'_, Db>, auth: State<'_, Auth>, sale_id: i64) -> Result<ReceiptDocument,String> {
    require_auth(&auth)?;
    let conn=db.0.lock().map_err(error)?;
    let (reference,created_at,payment_method,subtotal,discount,total)=conn.query_row(
        "SELECT reference,created_at,payment_method,subtotal,discount,total FROM sales WHERE id=?1",
        params![sale_id],
        |r| Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,
                r.get::<_,i64>(3)?,r.get::<_,i64>(4)?,r.get::<_,i64>(5)?))
    ).optional().map_err(error)?.ok_or("Vente introuvable.")?;
    let mut stmt=conn.prepare(
        "SELECT name_snapshot,variant_snapshot,quantity,unit_price,line_total
         FROM sale_items WHERE sale_id=?1 ORDER BY id"
    ).map_err(error)?;
    let lines=stmt.query_map(params![sale_id], |r| Ok(ReceiptLine {
        name:r.get(0)?,variant:r.get(1)?,quantity:r.get(2)?,
        unit_price:r.get(3)?,line_total:r.get(4)?
    })).map_err(error)?.collect::<rusqlite::Result<Vec<_>>>().map_err(error)?;
    let paid:i64=conn.query_row(
        "SELECT COALESCE(SUM(amount),0) FROM sale_payments WHERE sale_id=?1",
        params![sale_id],|r|r.get(0)
    ).map_err(error)?;
    let customer_name:Option<String>=conn.query_row(
        "SELECT c.name FROM customers c JOIN sale_customers sc ON sc.customer_id=c.id
         WHERE sc.sale_id=?1",params![sale_id],|r|r.get(0)
    ).optional().map_err(error)?;
    Ok(ReceiptDocument{reference,created_at,payment_method,subtotal,discount,total,
        paid,remaining:total-paid,customer_name,lines})
}

#[tauri::command]
fn backup_now(app: tauri::AppHandle, db: State<'_, Db>, auth: State<'_, Auth>) -> Result<String,String> {
    require_admin(&auth)?;
    let path=app.path().app_local_data_dir().map_err(error)?.join("backups");
    fs::create_dir_all(&path).map_err(error)?;
    let dest=path.join(format!("modestock-{}.db",Local::now().format("%Y%m%d-%H%M%S-%3f")));
    let conn=db.0.lock().map_err(error)?;
    conn.execute("VACUUM INTO ?1",params![dest.to_string_lossy().to_string()]).map_err(error)?;
    Ok(dest.to_string_lossy().to_string())
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let directory=app.path().app_local_data_dir()?;
            fs::create_dir_all(&directory)?;
            let mut conn=Connection::open(directory.join("modestock.db"))?;
            conn.busy_timeout(Duration::from_secs(5))?;
            init_db(&conn)?;
            commerce::migrate(&mut conn)?;
            app.manage(Db(Mutex::new(conn)));
            app.manage(Auth(Mutex::new(None)));
            app.manage(LoginGuard(Mutex::new(FailedLogin::default())));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_catalog,create_product,adjust_stock,checkout,
            get_dashboard,get_sales,get_report,add_expense,
            get_shop,update_shop,backup_now,get_receipt,
            auth_status,get_login_brand,register_admin,login,logout,
            commerce::create_customer,commerce::update_customer,
            commerce::list_customers,commerce::list_customer_payments,
            commerce::record_payment,commerce::update_product,
            commerce::product_history
        ])
        .run(tauri::generate_context!())
        .expect("Erreur de lancement de ModeStock Local");
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schema_migration_keeps_existing_shop_data() {
        let conn = Connection::open_in_memory().expect("Open memory DB");
        init_db(&conn).expect("Initial schema");
        conn.execute("UPDATE shops SET name='Boutique Démo' WHERE id=1", [])
            .expect("Update shop");
        init_db(&conn).expect("Idempotent schema setup");
        let name: String = conn.query_row("SELECT name FROM shops WHERE id=1", [], |r| r.get(0))
            .expect("Existing shop");
        assert_eq!(name, "Boutique Démo");
        let branding: i64 = conn.query_row("SELECT COUNT(*) FROM shop_branding", [], |r| r.get(0))
            .expect("Shop branding table");
        assert_eq!(branding, 1);
    }

    #[test]
    fn invalid_login_attempts_are_temporarily_limited() {
        let guard = LoginGuard(Mutex::new(FailedLogin::default()));
        assert!(check_login_attempt(&guard).is_ok());
        for _ in 0..5 { record_failed_login(&guard).expect("Register failure"); }
        assert!(check_login_attempt(&guard).is_err());
        clear_failed_login(&guard).expect("Clear lockout");
        assert!(check_login_attempt(&guard).is_ok());
    }

    #[test]
    fn argon2_password_hash_verifies_valid_password_only() {
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default().hash_password(b"MotDePasseDeTest123!", &salt)
            .expect("Hash").to_string();
        let parsed = PasswordHash::new(&hash).expect("Parse hash");
        assert!(Argon2::default().verify_password(b"MotDePasseDeTest123!", &parsed).is_ok());
        assert!(Argon2::default().verify_password(b"motdepassetest123!", &parsed).is_err());
    }
}
