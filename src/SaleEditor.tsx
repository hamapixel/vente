import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeftRight, Check, CircleAlert, RotateCcw, Trash2, X } from "lucide-react";
import { api } from "./api";
import type { Customer, Sale, SaleDetail, Variant } from "./types";

const money=(n:number)=>new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(n)+" FCFA";
const err=(e:unknown)=>typeof e==="string"?e:e instanceof Error?e.message:"Opération impossible.";
type Entry={variantId:number;quantity:number};
const methods=["Espèces","Orange Money","Moov Money","Autre"];

export default function SaleEditor({
  sale,customers,catalog,onSaved,onClose
}:{
  sale:Sale;customers:Customer[];catalog:Variant[];onSaved:()=>void;onClose:()=>void;
}){
  const [detail,setDetail]=useState<SaleDetail|null>(null);
  const [error,setError]=useState("");
  const [pending,setPending]=useState(false);
  const [mode,setMode]=useState<"edit"|"cancel">("edit");
  const [lines,setLines]=useState<Entry[]>([]);
  const [discount,setDiscount]=useState(0);
  const [customerId,setCustomerId]=useState<number|null>(sale.customerId);
  const [method,setMethod]=useState("Espèces");
  const [additionalPaid,setAdditionalPaid]=useState("0");
  const [refundConfirmed,setRefundConfirmed]=useState(false);
  const [cancelConfirm,setCancelConfirm]=useState("");
  const [reason,setReason]=useState("");
  const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
  useEffect(()=>{
    let alive=true;
    void api.getSaleDetail(sale.id).then(d=>{
      if(!alive)return;
      setDetail(d);setLines(d.lines.map(l=>({variantId:l.variantId,quantity:l.quantity})));
      setDiscount(d.discount);setCustomerId(d.customerId);
    }).catch(e=>{if(alive)setError(err(e));});
    return()=>{alive=false;};
  },[sale.id]);

  const prices=useMemo(()=>new Map(detail?.lines.map(l=>[l.variantId,l.unitPrice]) ?? []),[detail]);
  const total=lines.reduce((sum,line)=>{
    const price=prices.get(line.variantId) ?? catalog.find(v=>v.id===line.variantId)?.salePrice ?? 0;
    return sum+price*line.quantity;
  },0)-discount;
  const alreadyPaid=detail?.paid??0;
  const refundNeeded=Math.max(0,alreadyPaid-total);
  const extra=Number(additionalPaid);
  const newPaid=alreadyPaid-refundNeeded+(Number.isSafeInteger(extra)&&extra>0?extra:0);
  const remaining=Math.max(0,total-newPaid);
  const [search,setSearch]=useState("");
  const matching=catalog.filter(v=>
    [v.name,v.size,v.color,v.sku].join(" ").toLocaleLowerCase("fr")
    .includes(search.trim().toLocaleLowerCase("fr"))
  ).slice(0,40);
  const valid=!!detail&&!detail.cancelled&&lines.length>0&&lines.every(l=>l.quantity>0)
    &&discount>=0&&total>=0&&Number.isSafeInteger(extra)&&extra>=0
    &&!(refundNeeded>0&&extra>0)&&newPaid<=total
    &&(remaining===0||customerId!==null)&&reason.trim().length>=5
    &&(refundNeeded===0||refundConfirmed);
  function changeQty(id:number,qty:number){
    setRequestId(crypto.randomUUID());
    if(qty<1){setLines(x=>x.filter(l=>l.variantId!==id));return;}
    setLines(x=>x.map(l=>l.variantId===id?{...l,quantity:qty}:l));
  }
  function addLine(id:number){
    if(!id)return;
    setRequestId(crypto.randomUUID());
    setLines(x=>x.some(l=>l.variantId===id)
      ?x.map(l=>l.variantId===id?{...l,quantity:l.quantity+1}:l)
      :[...x,{variantId:id,quantity:1}]);
    setSearch("");
  }
  async function submit(e:FormEvent){
    e.preventDefault();
    if(pending||!detail)return;
    if(mode==="cancel"&&cancelConfirm!=="ANNULER"){
      setError("Saisissez ANNULER pour confirmer l'annulation.");return;
    }
    if(mode==="edit"&&!valid){setError("Vérifiez le total, la dette, le remboursement éventuel et la justification.");return;}
    if(mode==="cancel"&&alreadyPaid>0&&!refundConfirmed){
      setError("Confirmez le remboursement effectif avant d'annuler.");return;
    }
    setPending(true);setError("");
    try{
      if(mode==="cancel"){
        await api.cancelSale({
          saleId:sale.id,requestId,reason,
          refundedAmount:alreadyPaid,refundMethod:method
        });
      }else{
        await api.changeSale({
          saleId:sale.id,requestId,items:lines,discount,customerId,
          additionalPayment:extra,refundAmount:refundNeeded,paymentMethod:method,reason
        });
      }
      onSaved();
    }catch(e){setError(err(e));}
    finally{setPending(false);}
  }
  return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <form className="modal sale-edit-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Corriger ou annuler une vente">
      <div className="modal-header">
        <div><span className="eyebrow">CORRECTION AVEC HISTORIQUE</span><h2>{sale.reference}</h2>
          <p>Les paiements existants restent enregistrés. La modification ajuste uniquement articles, stocks et solde.</p></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><X size={18}/></button>
      </div>
      <div className="sale-editor-switch" role="group" aria-label="Type d'opération">
        <button type="button" className={mode==="edit"?"active":""} onClick={()=>{setMode("edit");setRequestId(crypto.randomUUID());}}><ArrowLeftRight size={15}/> Corriger les articles</button>
        <button type="button" className={mode==="cancel"?"active danger":""} onClick={()=>{setMode("cancel");setRequestId(crypto.randomUUID());}}><Trash2 size={15}/> Annuler la vente</button>
      </div>
      <div className="sale-edit-scroll">
        {error&&<div role="alert" className="auth-error"><CircleAlert size={16}/> {error}</div>}
        {!detail?<p>Chargement de la vente…</p>:mode==="edit"?<>
          <div className="sale-editor-numbers">
            <div><span>Total avant correction</span><strong>{money(detail.total)}</strong></div>
            <div><span>Déjà encaissé (conservé)</span><strong className="positive">{money(alreadyPaid)}</strong></div>
            <div><span>Nouveau total</span><strong>{money(total)}</strong></div>
            <div><span>Nouveau reste</span><strong className={remaining>0?"negative":"positive"}>{money(remaining)}</strong></div>
          </div>
          <div className="section-heading"><div><h2>Articles de la vente</h2><p>Diminuez, augmentez ou ajoutez des produits sans refaire le paiement initial.</p></div></div>
          <div className="sale-edit-lines">
            {lines.map(l=>{
              const v=catalog.find(x=>x.id===l.variantId);
              const old=detail.lines.find(x=>x.variantId===l.variantId);
              const unit=old?.unitPrice??v?.salePrice??0;
              const available=(v?.quantity??0)+(old?.quantity??0);
              return <div className="sale-edit-line" key={l.variantId}>
                <div><strong>{old?.name??v?.name??"Article"}</strong><small>{old?.variant??[v?.size,v?.color].join(" / ")} · {money(unit)} / unité · disponible avec retour : {available}</small></div>
                <input aria-label={"Quantité "+(old?.name??v?.name??"article")} type="number" min="1" max={available} value={l.quantity} onChange={e=>changeQty(l.variantId,Math.max(0,Math.floor(Number(e.target.value)||0)))}/>
                <button type="button" className="icon-button" title="Retirer la ligne" onClick={()=>changeQty(l.variantId,0)}><Trash2 size={16}/></button>
              </div>;
            })}
          </div>
          <div className="form-grid two-cols">
            <label>Ajouter un article
              <input placeholder="Rechercher nom, pointure, couleur…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </label>
            <label>Choisir une variante
              <select value="" onChange={e=>addLine(Number(e.target.value))}>
                <option value="">Sélectionner un produit…</option>
                {matching.map(v=><option value={v.id} key={v.id} disabled={v.quantity<1}>
                  {v.name} · {v.size}/{v.color} · {money(v.salePrice)} ({v.quantity} en stock)
                </option>)}
              </select>
            </label>
            <label>Remise totale (FCFA)
              <input type="number" min="0" max={total+discount} value={discount} onChange={e=>{setDiscount(Math.max(0,Number(e.target.value)||0));setRequestId(crypto.randomUUID());}}/>
            </label>
            <label>Client de la vente
              <select value={customerId??""} onChange={e=>{setCustomerId(e.target.value?Number(e.target.value):null);setRequestId(crypto.randomUUID());}}>
                <option value="">Client de passage (vente entièrement réglée)</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
              </select>
            </label>
            {refundNeeded===0&&<label>Encaissement complémentaire maintenant (FCFA)
              <input type="number" min="0" max={Math.max(0,total-alreadyPaid)} value={additionalPaid} onChange={e=>{setAdditionalPaid(e.target.value);setRequestId(crypto.randomUUID());}}/>
            </label>}
            {(refundNeeded>0||extra>0)&&<label>Moyen {refundNeeded>0?"du remboursement":"du paiement"}
              <select value={method} onChange={e=>{setMethod(e.target.value);setRequestId(crypto.randomUUID());}}>
                {methods.map(m=><option key={m}>{m}</option>)}
              </select>
            </label>}
          </div>
          {refundNeeded>0&&<div className="sale-refund-alert"><strong><RotateCcw size={16}/> Remboursement nécessaire : {money(refundNeeded)}</strong>
            <p>Cette somme doit être rendue physiquement au client. Aucun remboursement n'est exécuté automatiquement.</p>
            <label><input type="checkbox" checked={refundConfirmed} onChange={e=>setRefundConfirmed(e.target.checked)}/> Je confirme avoir effectivement remboursé ce montant.</label>
          </div>}
          {remaining>0&&customerId===null&&<p className="auth-error">Pour conserver {money(remaining)} comme dette, sélectionnez un client. Sinon, encaissez le complément.</p>}
        </>:<>
          <div className="sale-refund-alert">
            <strong>Annuler définitivement la vente {detail.reference}</strong>
            <p>Les articles seront remis en stock, la vente restera traçable comme « Annulée ». Aucun règlement ne sera supprimé de l'historique.</p>
            {alreadyPaid>0&&<><p><strong>À rembourser au client : {money(alreadyPaid)}</strong></p>
              <label><input type="checkbox" checked={refundConfirmed} onChange={e=>setRefundConfirmed(e.target.checked)}/> J'ai réellement remboursé ce montant.</label></>}
          </div>
          <label className="sale-confirm-label">Pour confirmer, écrivez ANNULER
            <input value={cancelConfirm} onChange={e=>setCancelConfirm(e.target.value)} placeholder="ANNULER"/>
          </label>
          {alreadyPaid>0&&<label className="sale-confirm-label">Moyen de remboursement
            <select value={method} onChange={e=>setMethod(e.target.value)}>{methods.map(m=><option key={m}>{m}</option>)}</select>
          </label>}
        </>}
        <label className="sale-confirm-label">Justification obligatoire (historisée)
          <textarea rows={2} maxLength={500} required minLength={5} value={reason} onChange={e=>{setReason(e.target.value);setRequestId(crypto.randomUUID());}} placeholder="Ex. Erreur de quantité saisie à la caisse"/>
        </label>
      </div>
      <div className="modal-actions">
        <button className="secondary-btn" type="button" onClick={onClose}>Retour</button>
        <button className={mode==="cancel"?"primary-btn sale-danger":"primary-btn"} type="submit" disabled={pending||!detail||detail.cancelled}>
          {pending?"Enregistrement…":mode==="cancel"?<><Trash2 size={16}/> Confirmer l'annulation</>:<><Check size={16}/> Enregistrer la correction</>}
        </button>
      </div>
    </form>
  </div>;
}
