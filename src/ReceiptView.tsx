import type { ReceiptDocument, Shop } from "./types";

const money = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " FCFA";

interface Props {
  shop: Shop;
  receipt: ReceiptDocument;
}

export default function ReceiptView({ shop, receipt }: Props) {
  return <article className={"ticket-preview " + shop.receiptFormat} aria-label="Document de vente">
    <header className="ticket-head">
      {shop.logoData && <img className="ticket-logo" src={shop.logoData} alt="Logo de la boutique" />}
      <h2>{shop.name || "Ma boutique"}</h2>
      {shop.address && <p>{shop.address}</p>}
      {shop.phone && <p>Tél. : {shop.phone}</p>}
      {shop.receiptHeader && <p className="ticket-custom-header">{shop.receiptHeader}</p>}
    </header>
    <div className="ticket-meta"><strong>{shop.receiptFormat === "a4" ? "FACTURE / REÇU DE VENTE" : "TICKET DE CAISSE"}</strong><span>N° {receipt.reference}</span><span>{receipt.createdAt.replace("T", " ").slice(0, 16)}</span></div>
    <table className="ticket-table"><thead><tr><th>Désignation</th><th>Qté</th><th>Montant</th></tr></thead><tbody>{receipt.lines.map((item, index)=><tr key={index}><td><strong>{item.name}</strong><small>{item.variant} · {money(item.unitPrice)} / u.</small></td><td>{item.quantity}</td><td>{money(item.lineTotal)}</td></tr>)}</tbody></table>
    <div className="ticket-totals"><div><span>Sous-total</span><strong>{money(receipt.subtotal)}</strong></div>{receipt.discount>0 && <div><span>Remise</span><strong>− {money(receipt.discount)}</strong></div>}<div className="ticket-grand"><span>Total payé</span><strong>{money(receipt.total)}</strong></div><div><span>Paiement</span><strong>{receipt.paymentMethod}</strong></div></div>
    <footer className="ticket-footer">{shop.receiptFooter || "Merci pour votre achat !"}</footer>
  </article>;
}
