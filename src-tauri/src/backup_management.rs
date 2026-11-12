//! Sauvegarde/Restoration d'une boutique SQLite sans écraser silencieusement le fichier en cours.
//! Export via VACUUM INTO, restauration via l'API Online Backup (connexion vivante).
use std::{fs, path::{Path,PathBuf},time::Duration};
use rusqlite::{backup::Backup,params,Connection,OpenFlags};
use serde::Serialize;
use tauri::{Manager, State};
use crate::{Auth,Db,require_admin,error,now};

fn inspect_backup(path:&Path)->Result<(),String>{
    if !path.is_file() {return Err("Le fichier de sauvegarde n'existe pas.".into());}
    if path.extension().and_then(|x|x.to_str()).map(|x|x.to_ascii_lowercase())!=Some("db".into()){
        return Err("Sélectionnez un fichier de sauvegarde SQLite .db.".into());
    }
    if fs::metadata(path).map_err(error)?.len()<1024 {
        return Err("La sauvegarde est vide ou trop petite.".into());
    }
    let src=Connection::open_with_flags(path,OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(error)?;
    src.busy_timeout(Duration::from_secs(3)).map_err(error)?;
    let integrity:String=src.query_row("PRAGMA integrity_check",[],|r|r.get(0)).map_err(error)?;
    if integrity!="ok" {return Err("La sauvegarde SQLite est corrompue.".into());}
    let fk:i64=src.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check",[],|r|r.get(0)).map_err(error)?;
    if fk!=0 {return Err("La sauvegarde contient des références incohérentes.".into());}
    for name in ["shops","users","products","variants","sales","sale_items","customers","sale_payments"] {
        let has:bool=src.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
            params![name],|r|r.get(0)
        ).map_err(error)?;
        if !has{return Err(format!("Ce fichier n'est pas une sauvegarde VestiFlow valide ({} absent).",name));}
    }
    let shop_count:i64=src.query_row("SELECT COUNT(*) FROM shops WHERE id=1",[],|r|r.get(0)).map_err(error)?;
    let admin_count:i64=src.query_row("SELECT COUNT(*) FROM users WHERE role='admin'",[],|r|r.get(0)).map_err(error)?;
    if shop_count!=1||admin_count<1{return Err("Sauvegarde sans boutique ou sans administrateur.".into());}
    Ok(())
}
fn clean_target(path:&Path,live_dir:&Path)->Result<PathBuf,String>{
    let parent=path.parent().ok_or("Destination invalide.")?;
    let real_parent=fs::canonicalize(parent).map_err(error)?;
    let dir=fs::canonicalize(live_dir).map_err(error)?;
    let file_name=path.file_name().ok_or("Nom de fichier invalide.")?;
    let resolved=real_parent.join(file_name);
    if resolved==dir.join("modestock.db")||resolved==dir.join("modestock.db-wal")||
       resolved==dir.join("modestock.db-shm") {
        return Err("N'écrasez jamais la base SQLite active.".into());
    }
    Ok(resolved)
}
fn export_core(conn:&Connection,dest:&Path,live_dir:&Path)->Result<String,String>{
    let path=clean_target(dest,live_dir)?;
    if path.exists(){return Err("Ce fichier existe déjà. Choisissez un autre nom pour ne pas écraser de sauvegarde.".into());}
    if path.extension().and_then(|x|x.to_str())!=Some("db"){
        return Err("Le fichier doit porter l'extension .db.".into());
    }
    conn.execute("VACUUM INTO ?1",params![path.to_string_lossy().to_string()]).map_err(error)?;
    if let Err(e)=inspect_backup(&path){
        let _=fs::remove_file(&path);
        return Err(format!("Sauvegarde rejetée après vérification : {}",e));
    }
    Ok(path.to_string_lossy().to_string())
}
fn online_restore(source:&Path,destination:&mut Connection)->Result<(),String>{
    let src=Connection::open_with_flags(source,OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(error)?;
    let backup=Backup::new(&src,destination).map_err(error)?;
    backup.run_to_completion(64,Duration::from_millis(50),None).map_err(error)
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct RestoreResult { pub safety_copy:String, pub message:String }

fn restore_core(conn:&mut Connection,source:&Path,live_dir:&Path)->Result<RestoreResult,String>{
    let real_source=fs::canonicalize(source).map_err(error)?;
    let dir=fs::canonicalize(live_dir).map_err(error)?;
    if real_source==dir.join("modestock.db") {
        return Err("Ne restaurez pas la base active sur elle-même.".into());
    }
    inspect_backup(&real_source)?;
    let backup_dir=dir.join("backups");
    fs::create_dir_all(&backup_dir).map_err(error)?;
    let safety=backup_dir.join(format!("avant-restauration-{}.db",
        chrono::Local::now().format("%Y%m%d-%H%M%S-%3f")));
    export_core(conn,&safety,&dir)?;
    // Restaurer vers la connexion SQLite ouverte ; évite de recopier un .db derrière un WAL actif.
    if let Err(e)=online_restore(&real_source,conn){
        let rolled=online_restore(&safety,conn);
        return Err(match rolled{
            Ok(_)=>format!("Restauration interrompue, ancienne base rétablie : {}",e),
            Err(x)=>format!("Restauration interrompue et récupération automatique échouée : {}. Sauvegarde de secours : {}. Erreur : {}",e,safety.display(),x)
        });
    }
    let migrate=crate::init_db(conn)
        .and_then(|_|crate::commerce::migrate(conn))
        .and_then(|_|crate::sales_management::migrate(conn));
    if let Err(e)=migrate {
        let rolled=online_restore(&safety,conn);
        return Err(match rolled{
            Ok(_)=>format!("Sauvegarde incompatible, données précédentes rétablies : {}",e),
            Err(x)=>format!("Migration impossible et retour automatique échoué : {} / {}. Conservez {}",e,x,safety.display())
        });
    }
    Ok(RestoreResult {
        safety_copy:safety.to_string_lossy().to_string(),
        message:"Restauration terminée. Fermez puis rouvrez VestiFlow et reconnectez-vous.".into()
    })
}
#[tauri::command]
pub fn export_backup(
    app:tauri::AppHandle, db:State<'_,Db>,auth:State<'_,Auth>,destination:String
)->Result<String,String>{
    require_admin(&auth)?;
    if destination.trim().is_empty(){return Err("Choisissez l'emplacement de sauvegarde.".into());}
    let dir=app.path().app_local_data_dir().map_err(error)?;
    let conn=db.0.lock().map_err(error)?;
    export_core(&conn,Path::new(&destination),&dir)
}
#[tauri::command]
pub fn restore_backup(
    app:tauri::AppHandle, db:State<'_,Db>,auth:State<'_,Auth>,source:String,confirmation:String
)->Result<RestoreResult,String>{
    require_admin(&auth)?;
    if confirmation!="RESTAURER"{
        return Err("Saisissez RESTAURER pour confirmer l'écrasement de la base actuelle.".into());
    }
    let dir=app.path().app_local_data_dir().map_err(error)?;
    let mut conn=db.0.lock().map_err(error)?;
    let result=restore_core(&mut conn,Path::new(&source),&dir)?;
    // La session ne peut pas survivre à une restauration des comptes utilisateurs.
    *auth.0.lock().map_err(error)?=None;
    Ok(result)
}

#[cfg(test)]
mod tests{
    use super::*;
    use crate::init_db;
    use std::sync::atomic::{AtomicU64, Ordering};

    // Les tests Rust s'exécutent en parallèle. Sous Windows, deux appels
    // à l'horloge peuvent retourner le même instant : ne jamais partager
    // accidentellement le même fichier SQLite entre deux tests.
    static NEXT_SANDBOX: AtomicU64 = AtomicU64::new(0);
    fn sandbox()->PathBuf{
        let path=std::env::temp_dir().join(format!("vestiflow-restore-{}-{}-{}",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0),
            NEXT_SANDBOX.fetch_add(1, Ordering::Relaxed)));
        fs::create_dir(&path).unwrap();
        path
    }
    #[test]
    fn backup_and_restore_roundtrip_recovers_product_sales_and_login(){
        let dir=sandbox();
        let mut conn=Connection::open(dir.join("modestock.db")).unwrap();
        init_db(&conn).unwrap();
        crate::commerce::migrate(&mut conn).unwrap();
        crate::sales_management::migrate(&mut conn).unwrap();
        conn.execute("INSERT INTO users(username,password_hash,role) VALUES('admin','testhash','admin')",[]).unwrap();
        conn.execute("INSERT INTO products(name,category,created_at) VALUES('Article avant panne','Robes',?1)",params![now()]).unwrap();
        let source=dir.join("save.db");
        export_core(&conn,&source,&dir).unwrap();
        conn.execute("DELETE FROM products",[]).unwrap();
        assert_eq!(conn.query_row("SELECT COUNT(*) FROM products",[],|r|r.get::<_,i64>(0)).unwrap(),0);
        let restored=restore_core(&mut conn,&source,&dir).unwrap();
        assert!(Path::new(&restored.safety_copy).exists());
        assert_eq!(conn.query_row("SELECT COUNT(*) FROM products",[],|r|r.get::<_,i64>(0)).unwrap(),1);
        assert_eq!(conn.query_row("SELECT COUNT(*) FROM users",[],|r|r.get::<_,i64>(0)).unwrap(),1);
        drop(conn);fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn reject_invalid_backup_and_refuse_overwrite(){
        let dir=sandbox();let mut conn=Connection::open(dir.join("modestock.db")).unwrap();
        init_db(&conn).unwrap();crate::commerce::migrate(&mut conn).unwrap();
        crate::sales_management::migrate(&mut conn).unwrap();
        conn.execute("INSERT INTO users(username,password_hash,role) VALUES('admin','hash','admin')",[]).unwrap();
        let dest=dir.join("saved.db");
        export_core(&conn,&dest,&dir).unwrap();
        assert!(export_core(&conn,&dest,&dir).is_err());
        let invalid=dir.join("invalid.db");fs::write(&invalid,b"this is not sqlite").unwrap();
        assert!(restore_core(&mut conn,&invalid,&dir).is_err());
        assert!(restore_core(&mut conn,&dir.join("modestock.db"),&dir).is_err());
        drop(conn);fs::remove_dir_all(dir).unwrap();
    }
}
