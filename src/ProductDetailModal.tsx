import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDownRight, ArrowUpRight, FileClock, Package, Pencil, Plus, Save, Shirt, X } from "lucide-react";
import { api } from "./api";
import type { ProductEdit, ProductMovement, Variant } from "./types";
const money=(n:number)=>new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(n)+" FCFA";
type Row={key:number;id:number|null;size:string;color:string;purchasePrice:string;salePrice:string;initialQuantity:string;stock:number;sku:string};

interface Props {
  product:{id:number;name:string;category:string;variants:Variant[]};
  categories:string[];
  onClose:()=>void;
  onSaved:()=>void;
}
export default function ProductDetailModal({product,categories,onClose,onSaved}:Props) {
  const [edit,setEdit]=useState(false);
  const [name,setName]=useState(product.name);
  const [category,setCategory]=useState(product.category);
  const [rows,setRows]=useState<Row[]>(product.variants.map(v=>({
    key:v.id,id:v.id,size:v.size,color:v.color,purchasePrice:String(v.purchasePrice),
    salePrice:String(v.salePrice),initialQuantity:"",stock:v.quantity,sku:v.sku
  })));
  const [history,setHistory]=useState<ProductMovement[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const total=useMemo(()=>product.variants.reduce((n,v)=>n+v.quantity,0),[product.variants]);
  useEffect(()=>{
    let active=true;
    void api.productHistory(product.id).then(items=>{if(active)setHistory(items);}).catch(()=>{});
    return()=>{active=false;};
  },[product.id]);
  function change(key:number,field:keyof Row,value:string){
    setRows(current=>current.map(r=>r.key===key?{...r,[field]:value}:r));
  }
  function addRow(){
    setRows(current=>[...current,{
      key:Math.min(-1,...current.map(r=>r.key))-1,id:null,size:"",color:"Standard",
      purchasePrice:current[0]?.purchasePrice||"",salePrice:current[0]?.salePrice||"",
      initialQuantity:"0",stock:0,sku:"Nouvelle variante"
    }]);
  }
  async function submit(e:FormEvent){
    e.preventDefault();
    if(busy)return;
    const variants:ProductEdit["variants"]=[];
    for(const row of rows){
      if(!row.size.trim()||!row.color.trim()||row.purchasePrice.trim()===""||row.salePrice.trim()===""){
        setError("Renseignez la taille, la couleur et les prix de chaque variante.");return;
      }
      const purchasePrice=Number(row.purchasePrice),salePrice=Number(row.salePrice);
      const initialQuantity=row.id===null?Number(row.initialQuantity):null;
      if(!Number.isSafeInteger(purchasePrice)||purchasePrice<0||!Number.isSafeInteger(salePrice)||salePrice<0||
        (initialQuantity!==null&&(!Number.isSafeInteger(initialQuantity)||initialQuantity<0))){
        setError("Prix ou quantité initiale invalide.");return;
      }
      variants.push({id:row.id,size:row.size,color:row.color,purchasePrice,salePrice,initialQuantity});
    }
    setBusy(true);setError("");
    try{
      await api.updateProduct({productId:product.id,name,category,variants});
      onSaved();
    }catch(e){setError(typeof e==="string"?e:e instanceof Error?e.message:"Modification impossible.");}
    finally{setBusy(false);}
  }
  return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="modal product-detail-modal">
      <div className="modal-header"><div><span className="eyebrow">FICHE DÉTAILLÉE</span><h2>{product.name}</h2><p>{product.category} · {product.variants.length} variante(s) · {total} pièce(s)</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><X size={20}/></button></div>
      {error&&<div className="auth-error" role="alert">{error}</div>}
      {!edit ? <>
        <div className="product-insight-grid"><div><Shirt size={20}/><span>Référence produit</span><strong>PROD-{product.id}</strong></div><div><Package size={20}/><span>Stock total</span><strong>{total} pièces</strong></div><div><FileClock size={20}/><span>Variantes</span><strong>{product.variants.length}</strong></div></div>
        <div className="section-heading"><div><h2>Tailles, couleurs et prix</h2><p>Chaque variante possède son propre stock</p></div><button type="button" className="secondary-btn" onClick={()=>setEdit(true)}><Pencil size={16}/> Modifier le produit</button></div>
        <div className="table-wrap"><table><thead><tr><th>Référence</th><th>Taille</th><th>Couleur</th><th>Achat</th><th>Vente</th><th>Stock</th></tr></thead><tbody>{product.variants.map(v=><tr key={v.id}><td>{v.sku}</td><td><span className="size-badge">{v.size}</span></td><td>{v.color}</td><td>{money(v.purchasePrice)}</td><td className="strong-cell">{money(v.salePrice)}</td><td className={v.quantity<=3?"negative":"positive"}>{v.quantity}</td></tr>)}</tbody></table></div>
        <div className="section-heading customer-subheading"><div><h2>Historique du produit</h2><p>Derniers mouvements de stock enregistrés</p></div></div>
        {!history.length?<p className="muted-cell">Aucun mouvement enregistré.</p>:<div className="product-history">{history.map((m,i)=><div key={i}><span className={m.delta>0?"history-icon green":"history-icon orange"}>{m.delta>=0?<ArrowUpRight size={16}/>:<ArrowDownRight size={16}/>}</span><span><strong>{m.reason}</strong><small>{m.size} / {m.color} · {m.date.slice(0,16).replace("T"," ")}</small></span><b className={m.delta>0?"positive":"negative"}>{m.delta>0?"+":""}{m.delta}</b></div>)}</div>}
      </> : <form onSubmit={submit}>
        <div className="form-grid two-cols"><label>Nom du produit<input required maxLength={150} value={name} onChange={e=>setName(e.target.value)}/></label><label>Catégorie<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div>
        <div className="variants-heading edit-variant-title"><div><strong>Modifier les variantes</strong><p>Les prix modifiés ne changent pas les anciennes ventes.</p></div></div>
        <div className="edit-product-list">{rows.map(r=><div className="edit-product-row" key={r.key}>
          <label>Taille<input required value={r.size} onChange={e=>change(r.key,"size",e.target.value)}/></label>
          <label>Couleur<input required value={r.color} onChange={e=>change(r.key,"color",e.target.value)}/></label>
          <label>Prix achat<input required type="number" min="0" step="1" value={r.purchasePrice} onChange={e=>change(r.key,"purchasePrice",e.target.value)}/></label>
          <label>Prix vente<input required type="number" min="0" step="1" value={r.salePrice} onChange={e=>change(r.key,"salePrice",e.target.value)}/></label>
          <label>{r.id===null?"Stock initial":"Stock actuel"}{r.id===null
            ? <input type="number" min="0" step="1" required value={r.initialQuantity} onChange={e=>change(r.key,"initialQuantity",e.target.value)}/>
            : <strong className="read-only-stock">{r.stock}</strong>}
          </label>
        </div>)}</div>
        <p className="variant-hint">Les stocks existants ne sont pas modifiés ici. Utilisez « Gestion du stock » pour une entrée ou correction traçable.</p>
        <button type="button" className="add-variant-btn" onClick={addRow}><Plus size={16}/> Ajouter une variante</button>
        <div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>{setEdit(false);setError("");}}>Retour</button><button className="primary-btn" type="submit" disabled={busy}><Save size={16}/>{busy?"Enregistrement…":"Enregistrer les modifications"}</button></div>
      </form>}
    </div>
  </div>;
}
