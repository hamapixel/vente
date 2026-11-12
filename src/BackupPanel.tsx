import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { DatabaseBackup, Download, FileWarning, FolderOpen, ShieldCheck, Upload, X } from "lucide-react";
import { api } from "./api";

const dateCode = () => new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

export default function BackupPanel() {
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [selected,setSelected]=useState<string|null>(null);
  const [confirmation,setConfirmation]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const problem=(e:unknown)=>typeof e==="string"?e:e instanceof Error?e.message:"Opération impossible.";

  async function exportUsb(){
    if(pending)return;
    setError("");setMessage("");
    try{
      const path=await save({
        title:"Enregistrer une sauvegarde VestiFlow (clé USB ou dossier)",
        defaultPath:"VestiFlow-sauvegarde-"+dateCode()+".db",
        filters:[{name:"Base VestiFlow (.db)",extensions:["db"]}]
      });
      if(!path)return;
      setPending(true);
      const result=await api.exportBackup(path);
      setMessage("Sauvegarde vérifiée et enregistrée : "+result);
    }catch(e){setError(problem(e));}
    finally{setPending(false);}
  }
  async function chooseRestore(){
    if(pending)return;
    setError("");setMessage("");
    try{
      const path=await open({
        title:"Sélectionnez une sauvegarde VestiFlow fiable sur clé USB",
        multiple:false,directory:false,
        filters:[{name:"Sauvegarde VestiFlow (.db)",extensions:["db"]}]
      });
      if(typeof path==="string"){setSelected(path);setConfirmation("");setConfirmed(false);}
    }catch(e){setError(problem(e));}
  }
  async function restore(){
    if(!selected||pending)return;
    if(confirmation!=="RESTAURER"||!confirmed){
      setError("Confirmez la restauration et saisissez RESTAURER exactement.");return;
    }
    setPending(true);setError("");
    try{
      const result=await api.restoreBackup(selected,confirmation);
      setSelected(null);
      setMessage(result.message+" Copie de secours : "+result.safetyCopy);
      // Les anciens identifiants deviennent invalides : l'utilisateur doit se reconnecter.
      window.location.reload();
    }catch(e){setError(problem(e));}
    finally{setPending(false);}
  }
  return <section className="panel backup-usb-panel">
    <div className="section-heading"><div><h2>Sauvegarde et restauration professionnelles</h2><p>Copiez une boutique sur clé USB et récupérez-la après une panne du PC.</p></div><DatabaseBackup className="accent-icon" size={23}/></div>
    <div className="backup-usb-actions">
      <button className="primary-btn" type="button" disabled={pending} onClick={()=>void exportUsb()}><Download size={17}/> Sauvegarder sur clé USB…</button>
      <button className="secondary-btn" type="button" disabled={pending} onClick={()=>void chooseRestore()}><FolderOpen size={17}/> Restaurer un fichier .db…</button>
    </div>
    <div className="callout"><ShieldCheck size={18}/><div><strong>Protection intégrée</strong>
      <p>Le logiciel vérifie l'intégrité SQLite et refuse d'écraser une sauvegarde existante. Avant toute restauration, il crée automatiquement une copie de secours de la boutique actuelle.</p></div></div>
    {error&&<div className="auth-error" role="alert"><FileWarning size={16}/> {error}</div>}
    {message&&<p className="backup-success" role="status"><ShieldCheck size={16}/> {message}</p>}
    {selected&&<div className="modal-overlay">
      <div className="modal small-modal backup-restore-confirm" role="dialog" aria-modal="true" aria-label="Confirmer la restauration">
        <div className="modal-header"><div><span className="eyebrow">RESTAURATION SENSIBLE</span><h2>Récupérer une boutique</h2>
          <p>La base actuelle sera remplacée par le fichier choisi, après vérification et sauvegarde de sécurité.</p></div>
          <button className="icon-button" type="button" disabled={pending} aria-label="Fermer" onClick={()=>setSelected(null)}><X size={17}/></button>
        </div>
        <p className="backup-selected-file"><Upload size={16}/> {selected}</p>
        <div className="sale-refund-alert"><strong><FileWarning size={16}/> Attention aux données actuelles</strong>
          <p>Les produits, ventes, clients, dettes et comptes de cet ordinateur seront remplacés par ceux de la sauvegarde. Les données ajoutées après cette sauvegarde ne seront pas fusionnées.</p></div>
        <label className="sale-confirm-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> J'ai compris que les données actuelles seront remplacées.</label>
        <label className="sale-confirm-label">Tapez RESTAURER
          <input value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" placeholder="RESTAURER"/>
        </label>
        {error&&<p className="auth-error" role="alert">{error}</p>}
        <div className="modal-actions"><button className="secondary-btn" type="button" disabled={pending} onClick={()=>setSelected(null)}>Annuler</button>
          <button className="primary-btn sale-danger" type="button" disabled={!confirmed||confirmation!=="RESTAURER"||pending} onClick={()=>void restore()}><Upload size={16}/>{pending?"Vérification…":"Restaurer et reconnecter"}</button>
        </div>
      </div>
    </div>}
  </section>;
}
