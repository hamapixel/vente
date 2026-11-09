import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, BadgeCheck, BarChart3,
  CalendarDays, Check, ChevronDown, CircleAlert, CreditCard, DatabaseBackup,
  Download, FileText, LayoutDashboard, Minus, MoreHorizontal, Package,
  PackageCheck, Plus, Search, Settings2, Shirt, ShoppingBag, ShoppingCart,
  TrendingUp, Wallet, X
} from "lucide-react";
import { api } from "./api";
import type { CartLine, Dashboard, NewProduct, Receipt, ReportDay, Sale, Shop, Variant } from "./types";

type Page = "dashboard" | "pos" | "products" | "stock" | "sales" | "reports" | "settings";
type ProductGroup = { id: number; name: string; category: string; variants: Variant[] };
type Notice = { text: string; kind: "success" | "error" } | null;
const money = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " FCFA";
const localDate = (d = new Date()) =>
  [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
const number = (n: string) => Math.max(0, Math.floor(Number(n) || 0));
const showError = (e: unknown) => typeof e === "string" ? e : e instanceof Error ? e.message : "Une erreur est survenue.";
const blankDashboard: Dashboard = { salesTotal: 0, grossProfit: 0, expenses: 0, salesCount: 0, lowStock: 0, variantCount: 0 };
const blankShop: Shop = { name: "Ma boutique", phone: "", address: "" };
const categories = ["Maillots", "T-shirts", "Chemises", "Polos", "Jeans", "Pantalons", "Robes", "Chaussures", "Accessoires", "Autres"];
const navigation = [
  { id: "dashboard" as const, label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: "pos" as const, label: "Caisse & ventes", icon: ShoppingBag },
  { id: "products" as const, label: "Catalogue produits", icon: Shirt },
  { id: "stock" as const, label: "Gestion du stock", icon: Package },
  { id: "sales" as const, label: "Historique ventes", icon: FileText },
  { id: "reports" as const, label: "Rapports", icon: BarChart3 },
  { id: "settings" as const, label: "Paramètres", icon: Settings2 },
];

function Empty({ title, description, icon: Icon = Package }: { title: string; description: string; icon?: typeof Package }) {
  return <div className="empty"><span className="empty-icon"><Icon size={25} /></span><strong>{title}</strong><p>{description}</p></div>;
}
function Stat({ title, value, hint, icon: Icon, variant = "" }: { title: string; value: string; hint: string; icon: typeof Package; variant?: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{title}</span><span className={"stat-icon " + variant}><Icon size={19} /></span></div><strong className="stat-value">{value}</strong><span className="stat-hint">{hint}</span></div>;
}

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [catalog, setCatalog] = useState<Variant[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard>(blankDashboard);
  const [sales, setSales] = useState<Sale[]>([]);
  const [shop, setShop] = useState<Shop>(blankShop);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tous");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState("Espèces");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [stockVariant, setStockVariant] = useState<Variant | null>(null);
  const [stockDelta, setStockDelta] = useState("1");
  const [stockReason, setStockReason] = useState("Réapprovisionnement");
  const [expenseModal, setExpenseModal] = useState(false);
  const [expenseLabel, setExpenseLabel] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return localDate(d); });
  const [to, setTo] = useState(localDate());
  const [report, setReport] = useState<ReportDay[]>([]);
  const [draft, setDraft] = useState<NewProduct>({ name: "", category: "Maillots", purchasePrice: 0, salePrice: 0, variants: [] });
  const [variantText, setVariantText] = useState("M, Bleu, 5\nL, Bleu, 5\nXL, Bleu, 3");

  const notify = (text: string, kind: "success" | "error" = "success") => setNotice({ text, kind });
  const reload = useCallback(async () => {
    const [items, stats, history, profile] = await Promise.all([api.getCatalog(), api.getDashboard(), api.getSales(), api.getShop()]);
    setCatalog(items); setDashboard(stats); setSales(history); setShop(profile); setLoaded(true);
  }, []);
  const loadReport = useCallback(async () => setReport(await api.getReport(from, to)), [from, to]);
  useEffect(() => { void reload().catch(e => notify(showError(e), "error")); }, [reload]);
  useEffect(() => { void loadReport().catch(e => notify(showError(e), "error")); }, [loadReport]);

  const products = useMemo<ProductGroup[]>(() => {
    const map = new Map<number, ProductGroup>();
    for (const v of catalog) {
      if (!map.has(v.productId)) map.set(v.productId, { id: v.productId, name: v.name, category: v.category, variants: [] });
      map.get(v.productId)!.variants.push(v);
    }
    return Array.from(map.values());
  }, [catalog]);
  const filtered = products.filter(p =>
    (category === "Tous" || p.category === category) &&
    (p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ||
      p.variants.some(v => v.sku.toLocaleLowerCase().includes(query.toLocaleLowerCase()))));
  const selected = products.find(p => p.id === selectedId);
  const subtotal = cart.reduce((sum, item) => sum + (catalog.find(v => v.id === item.variantId)?.salePrice || 0) * item.quantity, 0);
  const total = Math.max(0, subtotal - discount);
  const itemsInStock = catalog.reduce((sum, v) => sum + v.quantity, 0);
  const cards = [
    { title: "Chiffre d'affaires du jour", value: money(dashboard.salesTotal), hint: dashboard.salesCount + " vente(s) enregistrée(s)", icon: Wallet, variant: "blue" },
    { title: "Bénéfice brut du jour", value: money(dashboard.grossProfit), hint: "Ventes moins coût des articles", icon: TrendingUp, variant: "green" },
    { title: "Résultat net estimé", value: money(dashboard.grossProfit - dashboard.expenses), hint: "Après dépenses enregistrées", icon: Activity, variant: "purple" },
    { title: "Variantes en stock faible", value: String(dashboard.lowStock), hint: "Quantité inférieure ou égale à 3", icon: CircleAlert, variant: "orange" },
  ];

  function addToCart(v: Variant) {
    const existing = cart.find(c => c.variantId === v.id)?.quantity || 0;
    if (existing >= v.quantity) { notify("Stock insuffisant pour cette taille et couleur.", "error"); return; }
    setCart(previous => existing
      ? previous.map(c => c.variantId === v.id ? { ...c, quantity: c.quantity + 1 } : c)
      : [...previous, { variantId: v.id, quantity: 1 }]);
    setSelectedId(null);
  }
  function changeQuantity(id: number, diff: number) {
    const v = catalog.find(v => v.id === id);
    setCart(previous => previous.map(c => c.variantId === id
      ? { ...c, quantity: Math.max(0, Math.min(v?.quantity || 0, c.quantity + diff)) }
      : c).filter(c => c.quantity > 0));
  }
  async function doCheckout() {
    if (busy || !cart.length) return;
    if (discount > subtotal) { notify("La remise dépasse le montant de la vente.", "error"); return; }
    setBusy(true);
    try {
      const result = await api.checkout(crypto.randomUUID(), cart, discount, payment);
      setReceipt(result); setCart([]); setDiscount(0); await reload();
      await loadReport();
      notify("Vente " + result.reference + " enregistrée avec succès.");
    } catch (e) { notify(showError(e), "error"); } finally { setBusy(false); }
  }
  async function doAddProduct(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const variants = variantText.trim().split("\n").filter(Boolean).map(line => {
      const [size = "Unique", color = "Standard", quantity = "0"] = line.split(",").map(x => x.trim());
      return { size, color, quantity: number(quantity) };
    });
    if (!variants.length || variants.some(v => !v.size || !v.color)) { notify("Ajoutez au moins une variante valide.", "error"); return; }
    setBusy(true);
    try {
      await api.createProduct({ ...draft, variants });
      setAddModal(false); setDraft({ name: "", category: "Maillots", purchasePrice: 0, salePrice: 0, variants: [] });
      await reload(); notify("Produit ajouté au catalogue.");
    } catch (e) { notify(showError(e), "error"); } finally { setBusy(false); }
  }
  async function doAdjustStock(event: FormEvent) {
    event.preventDefault();
    if (!stockVariant || busy) return;
    const delta = Number(stockDelta);
    if (!Number.isSafeInteger(delta) || delta === 0) { notify("Quantité invalide.", "error"); return; }
    setBusy(true);
    try {
      await api.adjustStock(stockVariant.id, delta, stockReason);
      setStockVariant(null); await reload(); notify("Stock mis à jour.");
    } catch (e) { notify(showError(e), "error"); } finally { setBusy(false); }
  }
  async function doAddExpense(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.addExpense(expenseLabel, number(expenseAmount));
      setExpenseModal(false); setExpenseLabel(""); setExpenseAmount("");
      await reload(); notify("Dépense enregistrée.");
    } catch (e) { notify(showError(e), "error"); } finally { setBusy(false); }
  }
  async function doSaveShop(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await api.updateShop(shop); notify("Profil boutique enregistré."); }
    catch (e) { notify(showError(e), "error"); }
    finally { setBusy(false); }
  }
  async function doBackup() {
    setBusy(true);
    try { const path = await api.backupNow(); notify("Copie locale créée : " + path + ". Copiez-la ensuite sur un support externe."); }
    catch (e) { notify(showError(e), "error"); }
    finally { setBusy(false); }
  }
  const recentTable = (rows: Sale[]) => <div className="table-wrap"><table><thead><tr><th>Référence</th><th>Date</th><th>Paiement</th><th>Vente</th><th>Marge brute</th></tr></thead><tbody>
    {rows.map(s => <tr key={s.id}><td className="strong-cell">{s.reference}</td><td>{s.createdAt.slice(0, 16).replace("T", " ")}</td><td><span className="mini-pill">{s.paymentMethod}</span></td><td className="strong-cell">{money(s.total)}</td><td className={s.total - s.totalCost >= 0 ? "positive" : "negative"}>{money(s.total - s.totalCost)}</td></tr>)}
  </tbody></table></div>;

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Shirt size={23} strokeWidth={2.2}/></div><div><strong>ModeStock</strong><span>LOCAL · BOUTIQUE</span></div></div>
      <div className="sidebar-label">ESPACE DE GESTION</div>
      <nav className="nav-list">{navigation.map(item => {
        const Icon = item.icon;
        return <button key={item.id} className={"nav-link " + (page === item.id ? "active" : "")} onClick={() => setPage(item.id)}>
          <Icon size={19} strokeWidth={1.9}/><span>{item.label}</span>{page === item.id && <span className="active-dot"/>}
        </button>;
      })}</nav>
      <div className="sidebar-bottom"><div className="offline-indicator"><span className="live-dot"/> Mode hors ligne actif</div><div className="sidebar-footer"><span className="avatar-small"><Shirt size={18}/></span><span><strong>{shop.name}</strong><small>Gestion locale sécurisée</small></span><MoreHorizontal size={18}/></div></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="breadcrumb"><span>ModeStock Local</span><span>/</span><strong>{navigation.find(n => n.id === page)?.label}</strong></div>
        <div className="topbar-actions"><div className="date-badge"><CalendarDays size={16}/>{new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div><span className="top-avatar">ML</span></div>
      </header>
      <div className="content">
        {page === "dashboard" && <>
          <div className="page-heading"><div><div className="eyebrow">TABLEAU DE BORD</div><h1>Bonjour, bienvenue <span className="wave">✦</span></h1><p>Voici l'activité de votre boutique aujourd'hui.</p></div><button className="primary-btn" onClick={() => setPage("pos")}><Plus size={18}/> Nouvelle vente</button></div>
          <div className="stats-grid">{cards.map(c => <Stat key={c.title} {...c}/>)}</div>
          <div className="dashboard-grid">
            <section className="panel"><div className="section-heading"><div><h2>Activité commerciale</h2><p>Les chiffres clés de votre boutique</p></div><span className="soft-label">Aujourd'hui</span></div>
              <div className="overview-summary"><div><span>Articles en stock</span><strong>{itemsInStock}</strong></div><div><span>Variantes</span><strong>{dashboard.variantCount}</strong></div><div><span>Ventes</span><strong>{dashboard.salesCount}</strong></div></div>
              <div className="callout"><div className="callout-icon"><BadgeCheck size={20}/></div><div><strong>Vos chiffres sont enregistrés localement</strong><p>ModeStock fonctionne sans connexion Internet, directement sur cet ordinateur.</p></div></div>
            </section>
            <section className="panel quick-panel"><div className="section-heading"><div><h2>Actions rapides</h2><p>Gagnez du temps au quotidien</p></div></div>
              <button className="quick-action" onClick={() => setPage("pos")}><span className="quick-icon blue"><ShoppingCart size={20}/></span><span><strong>Effectuer une vente</strong><small>Ouvrir la caisse</small></span><ArrowRight size={17}/></button>
              <button className="quick-action" onClick={() => setAddModal(true)}><span className="quick-icon green"><Plus size={20}/></span><span><strong>Ajouter un vêtement</strong><small>Tailles, couleurs et quantités</small></span><ArrowRight size={17}/></button>
              <button className="quick-action" onClick={() => setExpenseModal(true)}><span className="quick-icon orange"><Wallet size={20}/></span><span><strong>Enregistrer une dépense</strong><small>Suivre votre résultat</small></span><ArrowRight size={17}/></button>
            </section>
          </div>
          <section className="panel"><div className="section-heading"><div><h2>Dernières ventes</h2><p>Historique des transactions récentes</p></div><button className="text-link" onClick={() => setPage("sales")}>Tout voir <ArrowRight size={16}/></button></div>
            {sales.length ? recentTable(sales.slice(0, 6)) : <Empty title="Aucune vente pour le moment" description="Ouvrez la caisse pour enregistrer votre première vente." icon={ShoppingBag}/>}
          </section>
        </>}

        {page === "pos" && <>
          <div className="page-heading"><div><div className="eyebrow">POINT DE VENTE</div><h1>Caisse & ventes</h1><p>Sélectionnez des articles, leurs tailles et couleurs, puis encaissez.</p></div><span className="count-chip"><ShoppingCart size={17}/> {cart.reduce((a,b) => a+b.quantity,0)} article(s)</span></div>
          <div className="pos-layout">
            <div className="pos-catalog"><div className="catalog-toolbar"><div className="search-field"><Search size={18}/><input placeholder="Rechercher un vêtement ou une référence…" value={query} onChange={e => setQuery(e.target.value)}/></div><div className="select-wrap"><select value={category} onChange={e => setCategory(e.target.value)}><option>Tous</option>{categories.map(c => <option key={c}>{c}</option>)}</select><ChevronDown size={16}/></div></div>
              {filtered.length ? <div className="product-grid">{filtered.map(p => <button className="product-card" key={p.id} onClick={() => setSelectedId(p.id)}><div className="product-picture"><Shirt size={38} strokeWidth={1.3}/><span className="product-badge">{p.variants.reduce((a,v) => a+v.quantity,0)} en stock</span></div><div className="product-body"><span className="product-category">{p.category}</span><strong>{p.name}</strong><div className="product-foot"><span>{money(Math.min(...p.variants.map(v => v.salePrice)))}</span><span className="add-circle"><Plus size={17}/></span></div></div></button>)}</div> : <Empty title={products.length ? "Aucun résultat" : "Votre catalogue est vide"} description={products.length ? "Essayez une autre recherche." : "Ajoutez d'abord des vêtements dans l'onglet Catalogue."} icon={Shirt}/>}
            </div>
            <aside className="cart-panel"><div className="cart-header"><div><h2>Panier actuel</h2><p>{cart.length} ligne(s) dans cette vente</p></div><span className="cart-icon"><ShoppingCart size={21}/></span></div>
              <div className="cart-lines">{cart.length ? cart.map(c => {const v=catalog.find(v=>v.id===c.variantId); if (!v) return null; return <div className="cart-line" key={c.variantId}><div className="cart-mini"><Shirt size={18}/></div><div className="cart-line-main"><strong>{v.name}</strong><small>{v.size} · {v.color}</small><div className="quantity-control"><button aria-label="Diminuer" onClick={() => changeQuantity(c.variantId,-1)}><Minus size={13}/></button><span>{c.quantity}</span><button aria-label="Augmenter" onClick={() => changeQuantity(c.variantId,1)}><Plus size={13}/></button></div></div><strong className="line-price">{money(v.salePrice*c.quantity)}</strong></div>; }) : <div className="cart-empty"><ShoppingBag size={35}/><strong>Votre panier est vide</strong><span>Choisissez un produit pour commencer.</span></div>}</div>
              <div className="cart-summary"><div className="summary-row"><span>Sous-total</span><strong>{money(subtotal)}</strong></div><label className="discount-field">Remise (FCFA)<input type="number" min="0" max={subtotal} value={discount} onChange={e => setDiscount(number(e.target.value))}/></label><div className="summary-row big-total"><span>Total à encaisser</span><strong>{money(total)}</strong></div><label className="field-label">Moyen de paiement</label><div className="select-wrap full"><select value={payment} onChange={e => setPayment(e.target.value)}>{["Espèces","Orange Money","Moov Money","Autre"].map(p=><option key={p}>{p}</option>)}</select><ChevronDown size={16}/></div><button className="primary-btn checkout-btn" disabled={busy || !cart.length || discount > subtotal} onClick={doCheckout}><CreditCard size={18}/>{busy ? "Enregistrement…" : "Valider la vente"}<ArrowRight size={18}/></button></div>
            </aside>
          </div>
        </>}

        {page === "products" && <>
          <div className="page-heading"><div><div className="eyebrow">VOTRE CATALOGUE</div><h1>Produits & variantes</h1><p>Un même vêtement peut être disponible en plusieurs tailles et couleurs.</p></div><button className="primary-btn" onClick={()=>setAddModal(true)}><Plus size={18}/> Ajouter un produit</button></div>
          <section className="panel"><div className="section-heading"><div><h2>Tous les vêtements</h2><p>{products.length} produit(s), {catalog.length} variante(s)</p></div><span className="soft-label"><PackageCheck size={15}/> Stock local</span></div>
            {catalog.length ? <div className="table-wrap"><table><thead><tr><th>Produit</th><th>Catégorie</th><th>Taille</th><th>Couleur</th><th>Prix de vente</th><th>Quantité</th></tr></thead><tbody>{catalog.map(v=><tr key={v.id}><td className="strong-cell">{v.name}<small className="sku-line">{v.sku}</small></td><td>{v.category}</td><td><span className="size-badge">{v.size}</span></td><td>{v.color}</td><td className="strong-cell">{money(v.salePrice)}</td><td><span className={"stock-pill " + (v.quantity <= 3 ? "low" : "")}>{v.quantity} pcs</span></td></tr>)}</tbody></table></div> : <Empty title="Votre boutique prend forme ici" description="Ajoutez votre premier produit avec ses tailles, couleurs et prix." icon={Shirt}/>}
          </section>
        </>}

        {page === "stock" && <>
          <div className="page-heading"><div><div className="eyebrow">INVENTAIRE</div><h1>Gestion du stock</h1><p>Suivez les quantités disponibles pour chaque taille et couleur.</p></div><span className="count-chip"><Package size={17}/> {itemsInStock} pièces</span></div>
          <div className="stats-grid two"><Stat title="Pièces disponibles" value={String(itemsInStock)} hint="Toutes variantes confondues" icon={PackageCheck} variant="blue"/><Stat title="Stock faible ou épuisé" value={String(dashboard.lowStock)} hint="Variantes de 3 pièces ou moins" icon={CircleAlert} variant="orange"/></div>
          <section className="panel"><div className="section-heading"><div><h2>État des stocks</h2><p>Les corrections sont enregistrées dans l'historique SQLite.</p></div></div>
            {catalog.length ? <div className="table-wrap"><table><thead><tr><th>Référence</th><th>Article</th><th>Variante</th><th>Stock</th><th>Action</th></tr></thead><tbody>{catalog.map(v=><tr key={v.id}><td className="muted-cell">{v.sku}</td><td className="strong-cell">{v.name}</td><td>{v.size} / {v.color}</td><td><span className={"stock-pill " + (v.quantity <= 3 ? "low" : "")}>{v.quantity} pcs</span></td><td><button className="table-action" onClick={()=>{setStockVariant(v);setStockDelta("1");setStockReason("Réapprovisionnement");}}>Ajuster <ArrowRight size={15}/></button></td></tr>)}</tbody></table></div> : <Empty title="Aucun stock à afficher" description="Créez vos premiers produits pour commencer le suivi."/>}
          </section>
        </>}

        {page === "sales" && <>
          <div className="page-heading"><div><div className="eyebrow">HISTORIQUE</div><h1>Historique des ventes</h1><p>Consultez les transactions enregistrées sur cet ordinateur.</p></div><button className="primary-btn" onClick={()=>setPage("pos")}><Plus size={18}/> Nouvelle vente</button></div>
          <section className="panel"><div className="section-heading"><div><h2>Transactions récentes</h2><p>Les 100 dernières ventes enregistrées</p></div></div>{sales.length ? recentTable(sales) : <Empty title="Aucune transaction" description="Les ventes apparaîtront ici après votre premier encaissement." icon={FileText}/>}</section>
        </>}

        {page === "reports" && <>
          <div className="page-heading"><div><div className="eyebrow">ANALYSE COMMERCIALE</div><h1>Rapports de ventes</h1><p>Analysez votre activité et les marges réalisées.</p></div><button className="secondary-btn" onClick={()=>setExpenseModal(true)}><Plus size={17}/> Enregistrer une dépense</button></div>
          <section className="panel report-filter"><div className="period-controls"><label>Du <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Au <input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div><span className="muted-cell">Les montants représentent les ventes enregistrées, hors annulations et retours (à venir).</span></section>
          <div className="stats-grid two"><Stat title="Ventes de la période" value={money(report.reduce((s,r)=>s+r.total,0))} hint={report.reduce((s,r)=>s+r.count,0)+" transaction(s)"} icon={Wallet} variant="blue"/><Stat title="Bénéfice brut de la période" value={money(report.reduce((s,r)=>s+r.grossProfit,0))} hint="Coûts d'achat déduits" icon={TrendingUp} variant="green"/></div>
          <section className="panel"><div className="section-heading"><div><h2>Rapport journalier</h2><p>Regroupement par date locale du poste</p></div></div>{report.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Nombre de ventes</th><th>Chiffre d'affaires</th><th>Marge brute</th></tr></thead><tbody>{report.map(r=><tr key={r.day}><td className="strong-cell">{r.day}</td><td>{r.count}</td><td className="strong-cell">{money(r.total)}</td><td className={r.grossProfit >= 0 ? "positive" : "negative"}>{money(r.grossProfit)}</td></tr>)}</tbody></table></div> : <Empty title="Aucune vente sur cette période" description="Choisissez une autre période ou réalisez votre première vente." icon={BarChart3}/>}</section>
        </>}

        {page === "settings" && <>
          <div className="page-heading"><div><div className="eyebrow">CONFIGURATION LOCALE</div><h1>Paramètres de la boutique</h1><p>Personnalisez les informations qui apparaîtront sur vos documents.</p></div></div>
          <div className="settings-layout">
            <section className="panel"><div className="section-heading"><div><h2>Profil de la boutique</h2><p>Informations générales</p></div></div><form className="form-grid" onSubmit={doSaveShop}><label>Nom de la boutique<input required value={shop.name} onChange={e=>setShop({...shop,name:e.target.value})}/></label><label>Téléphone<input value={shop.phone} onChange={e=>setShop({...shop,phone:e.target.value})}/></label><label>Adresse<input value={shop.address} onChange={e=>setShop({...shop,address:e.target.value})}/></label><button className="primary-btn" disabled={busy}><Check size={17}/> Enregistrer</button></form></section>
            <section className="panel"><div className="section-heading"><div><h2>Sauvegardes locales</h2><p>Protégez votre historique de vente</p></div><DatabaseBackup size={23} className="accent-icon"/></div><p className="backup-copy">Créer une copie cohérente de votre base SQLite. Cette copie reste sur le même ordinateur : transférez-la régulièrement sur une clé USB externe.</p><button className="secondary-btn" disabled={busy} onClick={doBackup}><Download size={17}/> Créer une sauvegarde locale</button><div className="warning-note"><CircleAlert size={17}/> La restauration et l'export direct vers un disque externe seront ajoutés avant la version commerciale.</div></section>
          </div>
        </>}
        <footer className="footer"><span>ModeStock Local <b>v0.1.0</b> · Votre boutique, vos données.</span><span>100 % local · FCFA</span></footer>
      </div>
    </main>

    {selected && <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedId(null);}}><div className="modal"><div className="modal-header"><div><span className="eyebrow">CHOISIR UNE VARIANTE</span><h2>{selected.name}</h2><p>{selected.category} · Choisissez la taille et la couleur</p></div><button className="icon-button" onClick={()=>setSelectedId(null)} aria-label="Fermer"><X size={20}/></button></div><div className="variant-list">{selected.variants.map(v=><button key={v.id} disabled={v.quantity===0} onClick={()=>addToCart(v)} className="variant-choice"><span className="variant-square">{v.size}</span><span><strong>{v.color}</strong><small>{v.quantity ? v.quantity+" disponible(s)" : "En rupture"}</small></span><strong>{money(v.salePrice)}</strong><Plus size={17}/></button>)}</div></div></div>}

    {addModal && <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setAddModal(false);}}><form className="modal product-modal" onSubmit={doAddProduct}><div className="modal-header"><div><span className="eyebrow">NOUVEAU VÊTEMENT</span><h2>Ajouter un produit</h2><p>Un produit peut avoir plusieurs tailles et couleurs.</p></div><button type="button" className="icon-button" onClick={()=>setAddModal(false)}><X size={20}/></button></div><div className="form-grid two-cols"><label>Nom du produit<input required placeholder="Ex. Maillot domicile" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Catégorie<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Prix d'achat (FCFA)<input type="number" required min="0" value={draft.purchasePrice} onChange={e=>setDraft({...draft,purchasePrice:number(e.target.value)})}/></label><label>Prix de vente (FCFA)<input type="number" required min="0" value={draft.salePrice} onChange={e=>setDraft({...draft,salePrice:number(e.target.value)})}/></label></div><label className="textarea-label">Variantes (une par ligne : taille, couleur, quantité)<textarea rows={4} value={variantText} onChange={e=>setVariantText(e.target.value)}/><small>Exemple : XL, Blanc, 12</small></label><div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setAddModal(false)}>Annuler</button><button type="submit" disabled={busy} className="primary-btn"><Plus size={17}/> Enregistrer le produit</button></div></form></div>}

    {stockVariant && <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setStockVariant(null);}}><form className="modal small-modal" onSubmit={doAdjustStock}><div className="modal-header"><div><span className="eyebrow">MOUVEMENT DE STOCK</span><h2>{stockVariant.name}</h2><p>{stockVariant.size} / {stockVariant.color} · {stockVariant.quantity} pièce(s) actuellement</p></div><button type="button" className="icon-button" onClick={()=>setStockVariant(null)}><X size={20}/></button></div><div className="form-grid"><label>Variation (+ entrée, − sortie)<input required type="number" value={stockDelta} onChange={e=>setStockDelta(e.target.value)}/></label><label>Motif<input required value={stockReason} onChange={e=>setStockReason(e.target.value)}/></label></div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setStockVariant(null)}>Annuler</button><button disabled={busy} className="primary-btn">Enregistrer</button></div></form></div>}

    {expenseModal && <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setExpenseModal(false);}}><form className="modal small-modal" onSubmit={doAddExpense}><div className="modal-header"><div><span className="eyebrow">DÉPENSE DE BOUTIQUE</span><h2>Nouvelle dépense</h2><p>Suivez les frais qui réduisent votre résultat net.</p></div><button type="button" className="icon-button" onClick={()=>setExpenseModal(false)}><X size={20}/></button></div><div className="form-grid"><label>Description<input required placeholder="Ex. Transport des marchandises" value={expenseLabel} onChange={e=>setExpenseLabel(e.target.value)}/></label><label>Montant (FCFA)<input required type="number" min="1" value={expenseAmount} onChange={e=>setExpenseAmount(e.target.value)}/></label></div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setExpenseModal(false)}>Annuler</button><button disabled={busy} className="primary-btn">Enregistrer</button></div></form></div>}

    {receipt && <div className="modal-overlay"><div className="modal small-modal receipt-modal"><div className="receipt-check"><Check size={30}/></div><h2>Vente enregistrée !</h2><p>La transaction a été sauvegardée localement.</p><div className="receipt-details"><span>Référence</span><strong>{receipt.reference}</strong><span>Montant encaissé</span><strong>{money(receipt.total)}</strong></div><p className="receipt-warning">L'impression du reçu sera intégrée avant la version commerciale.</p><button className="primary-btn full-width" onClick={()=>setReceipt(null)}>Continuer <ArrowRight size={18}/></button></div></div>}

    {notice && <div className={"toast "+notice.kind}><span>{notice.kind === "success" ? <Check size={17}/> : <CircleAlert size={17}/>}</span><div>{notice.text}</div><button onClick={()=>setNotice(null)} aria-label="Fermer"><X size={16}/></button></div>}
    {!loaded && !notice && <div className="loading-cover"><div className="brand-mark"><Shirt size={24}/></div><strong>Ouverture de ModeStock Local…</strong></div>}
  </div>;
}
