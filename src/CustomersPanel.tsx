import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, CircleAlert, CreditCard, FileText, Pencil, Plus, Search, UserRound, Wallet, X } from "lucide-react";
import { api } from "./api";
import type { Customer, CustomerInput, CustomerSale, PaymentEntry, Sale } from "./types";

const money = (n:number) => new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(n)+" FCFA";
export const blankCustomer: CustomerInput = { name:"", phone:"", address:"", note:"" };

interface EditorProps {
  customer: Customer | null;
  onClose: () => void;
  onSaved: (id:number) => void;
}
export function CustomerEditor({customer,onClose,onSaved}:EditorProps) {
  const [draft,setDraft] = useState<CustomerInput>(customer
    ? {name:customer.name,phone:customer.phone,address:customer.address,note:customer.note}
    : {...blankCustomer});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);setError("");
    try {
      if (customer) {
        await api.updateCustomer(customer.id,draft);
        onSaved(customer.id);
      } else {
        const id=await api.createCustomer(draft);
        onSaved(id);
      }
    } catch(e) {setError(typeof e==="string"?e:e instanceof Error?e.message:"Impossible d'enregistrer le client.");}
    finally {setBusy(false);}
  }
  return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <form className="modal small-modal" onSubmit={submit}>
      <div className="modal-header"><div><span className="eyebrow">FICHE CLIENT</span><h2>{customer?"Modifier un client":"Nouveau client"}</h2><p>La fiche permet le suivi des achats et des dettes.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fermer"><X size={19}/></button></div>
      {error&&<div className="auth-error" role="alert">{error}</div>}
      <div className="form-grid">
        <label>Nom du client *<input required maxLength={120} autoFocus placeholder="Ex. Moussa Traoré" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
        <label>Numéro de téléphone<input maxLength={60} placeholder="Ex. +223 ..." value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})}/></label>
        <label>Adresse<input maxLength={200} placeholder="Ex. Bamako, Kalaban-Coura" value={draft.address} onChange={e=>setDraft({...draft,address:e.target.value})}/></label>
        <label>Notes<textarea rows={3} maxLength={500} value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/></label>
      </div>
      <div className="modal-actions"><button className="secondary-btn" type="button" onClick={onClose}>Annuler</button><button className="primary-btn" type="submit" disabled={busy}>{busy?"Enregistrement…":"Enregistrer le client"}</button></div>
    </form>
  </div>;
}

interface CustomersProps {
  customers: Customer[];
  onAdd: () => void;
  onEdit: (customer:Customer) => void;
  onPay: (sale:PaymentTarget) => void;
  onReceipt: (id:number) => void;
  onSell: (id:number) => void;
}

export type PaymentTarget = Pick<Sale, "id" | "reference" | "remaining" | "customerName">;
export default function CustomersPanel({customers,onAdd,onEdit,onPay,onReceipt,onSell}:CustomersProps) {
  const [query,setQuery]=useState("");
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [payments,setPayments]=useState<PaymentEntry[]>([]);
  const [relatedSales,setRelatedSales]=useState<CustomerSale[]>([]);
  const [paymentError,setPaymentError]=useState("");
  const filtered=useMemo(()=>customers.filter(c=>[c.name,c.phone,c.address].join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),[customers,query]);
  const selected=customers.find(c=>c.id===selectedId) || filtered[0];
  const debt=customers.reduce((n,c)=>n+c.balance,0);

  useEffect(()=>{
    if(!selected){setPayments([]);setRelatedSales([]);return;}
    let active=true;
    setPaymentError("");
    void api.listCustomerSales(selected.id).then(rows=>{if(active)setRelatedSales(rows);}).catch(()=>{if(active)setRelatedSales([]);});
    void api.listCustomerPayments(selected.id).then(rows=>{if(active)setPayments(rows);}).catch(e=>{
      if(active)setPaymentError(typeof e==="string"?e:"Impossible de charger les règlements.");
    });
    return()=>{active=false;};
  },[selected?.id,selected?.totalPaid,selected?.balance]);

  return <>
    <div className="page-heading"><div><div className="eyebrow">RELATION CLIENT</div><h1>Clients & créances</h1><p>Retrouvez les coordonnées, les achats, les acomptes et les dettes.</p></div><button className="primary-btn" onClick={onAdd}><Plus size={18}/> Ajouter un client</button></div>
    <div className="customer-summary-grid">
      <div className="panel compact-stat"><span>Clients enregistrés</span><strong>{customers.length}</strong><small>Fiches de vos acheteurs</small></div>
      <div className="panel compact-stat"><span>Créances clients</span><strong className={debt>0?"negative":""}>{money(debt)}</strong><small>Reste à recouvrer</small></div>
      <div className="panel compact-stat"><span>Clients débiteurs</span><strong>{customers.filter(c=>c.balance>0).length}</strong><small>Avec solde non réglé</small></div>
    </div>
    <div className="clients-layout">
      <section className="panel customer-list-panel">
        <div className="section-heading"><h2>Répertoire clients</h2></div>
        <div className="search-field"><Search size={17}/><input value={query} placeholder="Nom, numéro, quartier…" onChange={e=>setQuery(e.target.value)}/></div>
        <div className="customer-picker-list">
          {filtered.length===0&&<div className="empty"><UserRound size={28}/><strong>Aucun client</strong><p>Ajoutez une fiche client pour gérer les ventes à crédit.</p></div>}
          {filtered.map(c=><button key={c.id} className={"customer-picker "+(c.id===selected?.id?"selected":"")} onClick={()=>setSelectedId(c.id)}>
            <span className="customer-initials">{c.name.slice(0,1).toUpperCase()}</span>
            <span className="customer-picker-body"><strong>{c.name}</strong><small>{c.phone||"Téléphone non renseigné"}</small></span>
            <span className={"customer-picker-debt "+(c.balance>0?"negative":"positive")}>{c.balance>0?money(c.balance):"À jour"}</span>
          </button>)}
        </div>
      </section>
      <section className="panel customer-details-panel">
        {!selected?<div className="empty"><UserRound size={28}/><strong>Créer votre premier client</strong><p>Ses ventes et paiements apparaîtront dans sa fiche.</p></div>:<>
          <div className="customer-detail-head"><div><span className="eyebrow">FICHE CLIENT N° {selected.id}</span><h2>{selected.name}</h2><p>{selected.phone||"Sans téléphone"} · {selected.address||"Adresse non renseignée"}</p></div><button className="secondary-btn" onClick={()=>onEdit(selected)}><Pencil size={15}/> Modifier</button></div>
          {selected.note&&<p className="customer-note">{selected.note}</p>}
          <div className="customer-financials"><div><span>Total des achats</span><strong>{money(selected.totalSales)}</strong></div><div><span>Déjà payé</span><strong className="positive">{money(selected.totalPaid)}</strong></div><div><span>Dette restante</span><strong className={selected.balance>0?"negative":"positive"}>{money(selected.balance)}</strong></div></div>
          <div className="client-actionbar"><button className="primary-btn" onClick={()=>onSell(selected.id)}><Plus size={16}/> Nouvelle vente</button></div>
          <div className="section-heading"><div><h2>Ventes du client</h2><p>{relatedSales.length} transaction(s) parmi les ventes récentes</p></div></div>
          {!relatedSales.length?<p className="muted-cell">Aucune vente récente pour ce client.</p>:<div className="table-wrap"><table><thead><tr><th>Vente</th><th>Montant</th><th>Payé</th><th>Reste</th><th>Action</th></tr></thead><tbody>
            {relatedSales.map(s=><tr key={s.id}><td>{s.reference}</td><td>{money(s.total)}</td><td>{money(s.paid)}</td><td className={s.remaining>0?"negative":"positive"}>{money(s.remaining)}</td><td><div className="inline-actions">{s.remaining>0&&<button className="table-action" onClick={()=>onPay({id:s.id,reference:s.reference,remaining:s.remaining,customerName:selected.name})}><CreditCard size={14}/> Régler</button>}<button className="table-action" onClick={()=>onReceipt(s.id)}><FileText size={14}/> Ticket</button></div></td></tr>)}
          </tbody></table></div>}
          <div className="section-heading customer-subheading"><div><h2>Historique des paiements</h2><p>Chaque règlement est conservé dans SQLite</p></div></div>
          {paymentError&&<p className="negative"><CircleAlert size={14}/> {paymentError}</p>}
          {!payments.length?<p className="muted-cell">Aucun règlement enregistré pour le moment.</p>:<div className="table-wrap"><table><thead><tr><th>Date</th><th>Vente</th><th>Moyen</th><th>Montant</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td>{p.createdAt.slice(0,16).replace("T"," ")}</td><td>{p.reference}</td><td>{p.method}</td><td className="positive">{money(p.amount)}</td></tr>)}</tbody></table></div>}
        </>}
      </section>
    </div>
  </>;
}

export function PaymentDialog({sale,onClose,onSaved}:{sale:PaymentTarget;onClose:()=>void;onSaved:()=>void}) {
  const [amount,setAmount]=useState(String(sale.remaining));
  const [method,setMethod]=useState("Espèces");
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
  async function submit(e:FormEvent) {
    e.preventDefault();
    if(pending)return;
    const n=Number(amount);
    if(!Number.isSafeInteger(n)||n<=0||n>sale.remaining){setError("Montant invalide ou supérieur à la dette restante.");return;}
    setPending(true);setError("");
    try {
      await api.recordPayment(sale.id,n,method,requestId);
      onSaved();
    }catch(e){
      setError(typeof e==="string"?e:e instanceof Error?e.message:"Paiement non enregistré.");
    }finally{setPending(false);}
  }
  return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><form className="modal small-modal" onSubmit={submit}>
    <div className="modal-header"><div><span className="eyebrow">RÈGLEMENT DE CRÉANCE</span><h2>Encaisser un paiement</h2><p>{sale.reference} · {sale.customerName||"Client"}</p></div><button type="button" className="icon-button" onClick={onClose}><X size={19}/></button></div>
    <div className="debt-summary"><span>Reste à payer</span><strong>{money(sale.remaining)}</strong></div>
    {error&&<div className="auth-error" role="alert">{error}</div>}
    <div className="form-grid"><label>Montant reçu (FCFA)<input required type="number" min="1" max={sale.remaining} step="1" value={amount} onChange={e=>{setAmount(e.target.value);setRequestId(crypto.randomUUID());}}/></label><label>Moyen de paiement<select value={method} onChange={e=>{setMethod(e.target.value);setRequestId(crypto.randomUUID());}}>{["Espèces","Orange Money","Moov Money","Autre"].map(m=><option key={m}>{m}</option>)}</select></label></div>
    <p className="payment-hint"><Wallet size={16}/> Après enregistrement, le solde sera recalculé automatiquement.</p>
    <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Annuler</button><button type="submit" disabled={pending} className="primary-btn"><ArrowRight size={16}/>{pending?"Enregistrement…":"Valider le règlement"}</button></div>
  </form></div>;
}
