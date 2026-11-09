import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Activity, ArrowLeft, ArrowRight, BadgeCheck, BarChart3,
  CalendarDays, Check, ChevronDown, CircleAlert, CreditCard, DatabaseBackup,
  Download, FileText, LayoutDashboard, LogOut, Minus, MoreHorizontal, Package, Printer,
  PackageCheck, Plus, Search, Settings2, Shirt, ShoppingBag, ShoppingCart,
  TrendingUp, Trash2, Wallet, X
} from "lucide-react";
import { api } from "./api";
import LoginScreen from "./LoginScreen";
import ReceiptView from "./ReceiptView";
import type { CartLine, Dashboard, NewProduct, Receipt, ReceiptDocument, ReportDay, Sale, Shop, UserSession, Variant } from "./types";

type Page = "dashboard" | "pos" | "products" | "stock" | "sales" | "reports" | "settings";
type ProductGroup = { id: number; name: string; category: string; variants: Variant[] };
type VariantRow = { id: number; size: string; color: string; quantity: string };
type ProductDraft = Omit<NewProduct, "purchasePrice" | "salePrice"> & { purchasePrice: string; salePrice: string };
type Notice = { text: string; kind: "success" | "error" } | null;
const money = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " FCFA";
const localDate = (d = new Date()) =>
  [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
const number = (n: string) => Math.max(0, Math.floor(Number(n) || 0));
const showError = (e: unknown) => typeof e === "string" ? e : e instanceof Error ? e.message : "Une erreur est survenue.";
const blankDashboard: Dashboard = { salesTotal: 0, grossProfit: 0, expenses: 0, salesCount: 0, lowStock: 0, variantCount: 0 };
const blankShop: Shop = { name: "Ma boutique", phone: "", address: "", logoData: "", receiptHeader: "", receiptFooter: "Merci pour votre achat !", receiptFormat: "ticket" };
const sampleReceipt: ReceiptDocument = {
  reference: "VT-EXEMPLE", createdAt: "2026-11-09T12:00:00", paymentMethod: "Espèces",
  subtotal: 10000, discount: 500, total: 9500,
  lines: [{ name: "Maillot de football", variant: "L / Bleu", quantity: 1, unitPrice: 10000, lineTotal: 10000 }]
};
const isBrowserPreview = typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window);
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
  const [navHistory, setNavHistory] = useState<Page[]>([]);
  const [session, setSession] = useState<UserSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [ticketView, setTicketView] = useState<ReceiptDocument | null>(null);
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
  const [draft, setDraft] = useState<ProductDraft>({ name: "", category: "Maillots", purchasePrice: "", salePrice: "", variants: [] });
  const [variantRows, setVariantRows] = useState<VariantRow[]>([{ id: 1, size: "", color: "", quantity: "" }]);

  const notify = (text: string, kind: "success" | "error" = "success") => setNotice({ text, kind });
  const reload = useCallback(async () => {
    const [items, stats, history, profile] = await Promise.all([api.getCatalog(), api.getDashboard(), api.getSales(), api.getShop()]);
    setCatalog(items); setDashboard(stats); setSales(history); setShop(profile); setLoaded(true);
  }, []);
  const loadReport = useCallback(async () => setReport(await api.getReport(from, to)), [from, to]);
  useEffect(() => {
    if (isBrowserPreview) { setAuthReady(true); return; }
    void api.authStatus().then(status => {
      setSetupRequired(status.setupRequired);
      setSession(status.user);
      setAuthReady(true);
    }).catch(e => { notify(showError(e), "error"); setAuthReady(true); });
  }, []);
  useEffect(() => {
    if (!session || isBrowserPreview) return;
    void reload().catch(e => notify(showError(e), "error"));
  }, [session, reload]);
  useEffect(() => {
    if (!session || isBrowserPreview) return;
    void loadReport().catch(e => notify(showError(e), "error"));
  }, [session, loadReport]);

  function navigate(target: Page) {
    if (target === page) return;
    setNavHistory(history => [...history.slice(-14), page]);
    setPage(target);
  }
  function goBack() {
    if (!navHistory.length) return;
    const last = navHistory[navHistory.length - 1];
    setNavHistory(history => history.slice(0, -1));
    setPage(last);
  }
  async function doLogout() {
    try {
      await api.logout();
      setSession(null); setAuthReady(true); setNavHistory([]); setPage("dashboard");
      setCatalog([]); setSales([]); setDashboard(blankDashboard); setShop(blankShop);
      setCart([]); setReceipt(null); setTicketView(null); setNotice(null); setLoaded(false);
    } catch (e) { notify(showError(e), "error"); }
  }
  async function openTicket(id: number) {
    try {
      const doc = await api.getReceipt(id);
      setTicketView(doc);
    } catch (e) { notify(showError(e), "error"); }
  }
  function loadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 450 * 1024) {
      notify("Choisissez un logo PNG, JPG ou WebP de moins de 450 Ko.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setShop(current => ({ ...current, logoData: reader.result as string }));
    };
    reader.onerror = () => notify("Impossible de lire le logo.", "error");
    reader.readAsDataURL(file);
  }

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
  function updateVariantRow(id: number, field: "size" | "color" | "quantity", value: string) {
    setVariantRows(rows => rows.map(row => row.id === id ? { ...row, [field]: value } : row));
  }
  function addVariantRow() {
    setVariantRows(rows => [...rows, {
      id: Math.max(0, ...rows.map(row => row.id)) + 1,
      size: "", color: rows[rows.length - 1]?.color ?? "", quantity: ""
    }]);
  }
  async function doAddProduct(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!draft.purchasePrice.trim() || !draft.salePrice.trim()) {
      notify("Renseignez les prix d'achat et de vente.", "error");
      return;
    }
    const purchasePrice = Number(draft.purchasePrice);
    const salePrice = Number(draft.salePrice);
    if (![purchasePrice, salePrice].every(value => Number.isSafeInteger(value) && value >= 0)) {
      notify("Les prix doivent être des montants entiers positifs ou nuls.", "error");
      return;
    }
    if (variantRows.some(row => row.quantity.trim() === "")) {
      notify("Renseignez une quantité pour chaque taille et couleur.", "error");
      return;
    }
    const variants = variantRows.map(row => ({
      size: row.size.trim(),
      color: row.color.trim() || "Standard",
      quantity: Number(row.quantity)
    }));
    if (!variants.length || variants.some(v => !v.size || !Number.isSafeInteger(v.quantity) || v.quantity < 0)) {
      notify("Renseignez une taille et une quantité entière positive ou nulle sur chaque ligne.", "error");
      return;
    }
    const keys = variants.map(v => v.size.toLocaleLowerCase() + "|" + v.color.toLocaleLowerCase());
    if (new Set(keys).size !== keys.length) {
      notify("La même taille et couleur apparaît plusieurs fois.", "error");
      return;
    }
    setBusy(true);
    try {
      await api.createProduct({ ...draft, purchasePrice, salePrice, variants });
      setAddModal(false);
      setDraft({ name: "", category: "Maillots", purchasePrice: "", salePrice: "", variants: [] });
      setVariantRows([{ id: 1, size: "", color: "", quantity: "" }]);
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
  const recentTable = (rows: Sale[]) => <div className="table-wrap"><table><thead><tr><th>Référence</th><th>Date</th><th>Paiement</th><th>Vente</th><th>Marge brute</th><th>Ticket</th></tr></thead><tbody>
    {rows.map(s => <tr key={s.id}><td className="strong-cell">{s.reference}</td><td>{s.createdAt.slice(0, 16).replace("T", " ")}</td><td><span className="mini-pill">{s.paymentMethod}</span></td><td className="strong-cell">{money(s.total)}</td><td className={s.total - s.totalCost >= 0 ? "positive" : "negative"}>{money(s.total - s.totalCost)}</td><td><button className="table-action" onClick={()=>void openTicket(s.id)}><Printer size={15}/> Ticket</button></td></tr>)}
  </tbody></table></div>;

  if (!authReady) return <div className="loading-cover"><div className="brand-mark"><Shirt size={24}/></div><strong>Initialisation de ModeStock Local…</strong></div>;
  if (!session) return <LoginScreen setup={setupRequired} browserPreview={isBrowserPreview} onSuccess={user => { setSetupRequired(false); setSession(user); }}/>;
  return <>
  <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Shirt size={23} strokeWidth={2.2}/></div><div><strong>ModeStock</strong><span>LOCAL · BOUTIQUE</span></div></div>
      <div className="sidebar-label">ESPACE DE GESTION</div>
      <nav className="nav-list">{navigation.map(item => {
        const Icon = item.icon;
        return <button key={item.id} className={"nav-link " + (page === item.id ? "active" : "")} onClick={() => navigate(item.id)}>
          <Icon size={19} strokeWidth={1.9}/><span>{item.label}</span>{page === item.id && <span className="active-dot"/>}
        </button>;
      })}</nav>
      <div className="sidebar-bottom"><div className="offline-indicator"><span className="live-dot"/> Mode hors ligne actif</div><button className="logout-sidebar" onClick={()=>void doLogout()}><LogOut size={17}/> Déconnexion</button><div className="sidebar-footer"><span className="avatar-small"><Shirt size={18}/></span><span><strong>{shop.name}</strong><small>{session.username} · Administrateur</small></span><MoreHorizontal size={18}/></div></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="breadcrumb"><button type="button" className="back-nav" onClick={goBack} disabled={!navHistory.length} aria-label="Retour à la page précédente" title="Retour"><ArrowLeft size={18}/></button><span>ModeStock Local</span><span>/</span><strong>{navigation.find(n => n.id === page)?.label}</strong></div>
        <div className="topbar-actions"><div className="date-badge"><CalendarDays size={16}/>{new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div><span className="top-avatar">{session.username.slice(0,2).toUpperCase()}</span></div>
      </header>
      <div className="content">
        {isBrowserPreview && <div className="browser-warning"><CircleAlert size={19}/><span><strong>Aperçu navigateur uniquement.</strong> Pour enregistrer des ventes et accéder à SQLite, lancez <code>npm run tauri dev</code> et utilisez la fenêtre de l'application, pas l'onglet localhost.</span></div>}
        {page === "dashboard" && <>
          <div className="page-heading"><div><div className="eyebrow">TABLEAU DE BORD</div><h1>Bonjour, bienvenue <span className="wave">✦</span></h1><p>Voici l'activité de votre boutique aujourd'hui.</p></div><button className="primary-btn" onClick={() => navigate("pos")}><Plus size={18}/> Nouvelle vente</button></div>
          <div className="stats-grid">{cards.map(c => <Stat key={c.title} {...c}/>)}</div>
          <div className="dashboard-grid">
            <section className="panel"><div className="section-heading"><div><h2>Activité commerciale</h2><p>Les chiffres clés de votre boutique</p></div><span className="soft-label">Aujourd'hui</span></div>
              <div className="overview-summary"><div><span>Articles en stock</span><strong>{itemsInStock}</strong></div><div><span>Variantes</span><strong>{dashboard.variantCount}</strong></div><div><span>Ventes</span><strong>{dashboard.salesCount}</strong></div></div>
              <div className="callout"><div className="callout-icon"><BadgeCheck size={20}/></div><div><strong>Vos chiffres sont enregistrés localement</strong><p>ModeStock fonctionne sans connexion Internet, directement sur cet ordinateur.</p></div></div>
            </section>
            <section className="panel quick-panel"><div className="section-heading"><div><h2>Actions rapides</h2><p>Gagnez du temps au quotidien</p></div></div>
              <button className="quick-action" onClick={() => navigate("pos")}><span className="quick-icon blue"><ShoppingCart size={20}/></span><span><strong>Effectuer une vente</strong><small>Ouvrir la caisse</small></span><ArrowRight size={17}/></button>
              <button className="quick-action" onClick={() => setAddModal(true)}><span className="quick-icon green"><Plus size={20}/></span><span><strong>Ajouter un vêtement</strong><small>Tailles, couleurs et quantités</small></span><ArrowRight size={17}/></button>
              <button className="quick-action" onClick={() => setExpenseModal(true)}><span className="quick-icon orange"><Wallet size={20}/></span><span><strong>Enregistrer une dépense</strong><small>Suivre votre résultat</small></span><ArrowRight size={17}/></button>
            </section>
          </div>
          <section className="panel"><div className="section-heading"><div><h2>Dernières ventes</h2><p>Historique des transactions récentes</p></div><button className="text-link" onClick={() => navigate("sales")}>Tout voir <ArrowRight size={16}/></button></div>
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
          <div className="page-heading"><div><div className="eyebrow">IDENTITÉ DE VOTRE BOUTIQUE</div><h1>Profil et documents</h1><p>Personnalisez le logo, les coordonnées, les factures et les tickets.</p></div></div>
          <div className="settings-layout branding-layout">
            <section className="panel">
              <div className="section-heading"><div><h2>Identité commerciale</h2><p>Informations imprimées sur les documents</p></div></div>
              <form className="form-grid" onSubmit={doSaveShop}>
                <label>Nom de la boutique<input required maxLength={120} value={shop.name} onChange={e=>setShop({...shop,name:e.target.value})}/></label>
                <label>Téléphone<input maxLength={80} value={shop.phone} placeholder="Ex. +223 ..." onChange={e=>setShop({...shop,phone:e.target.value})}/></label>
                <label>Adresse<input maxLength={250} value={shop.address} placeholder="Ex. Bamako, quartier..." onChange={e=>setShop({...shop,address:e.target.value})}/></label>
                <div className="logo-chooser"><div className="logo-current">{shop.logoData ? <img src={shop.logoData} alt="Logo actuel"/> : <Shirt size={28}/>}</div><div><strong>Logo de la boutique</strong><p>PNG, JPG ou WebP · 450 Ko maximum</p><label className="logo-upload">Choisir un logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={loadLogo}/></label>{shop.logoData && <button type="button" className="logo-remove" onClick={()=>setShop({...shop,logoData:""})}>Supprimer le logo</button>}</div></div>
                <label>En-tête de la facture / du ticket<textarea rows={3} maxLength={350} placeholder="Ex. Prêt-à-porter pour toute la famille" value={shop.receiptHeader} onChange={e=>setShop({...shop,receiptHeader:e.target.value})}/></label>
                <label>Message en pied de ticket<textarea rows={2} maxLength={350} placeholder="Ex. Merci pour votre confiance !" value={shop.receiptFooter} onChange={e=>setShop({...shop,receiptFooter:e.target.value})}/></label>
                <label>Format de document<select value={shop.receiptFormat} onChange={e=>setShop({...shop,receiptFormat:e.target.value as Shop["receiptFormat"]})}><option value="ticket">Ticket thermique (80 mm)</option><option value="a4">Facture / Reçu A4</option></select></label>
                <button type="submit" disabled={busy} className="primary-btn"><Check size={17}/> Enregistrer les paramètres</button>
              </form>
            </section>
            <div className="settings-side">
              <section className="panel"><div className="section-heading"><div><h2>Aperçu du document</h2><p>Prévisualisation avec des données d'exemple</p></div><Printer size={19}/></div><div className="settings-ticket-preview"><ReceiptView shop={shop} receipt={sampleReceipt}/></div><p className="settings-preview-hint">Enregistrez les paramètres pour les utiliser sur les prochains tickets.</p></section>
              <section className="panel"><div className="section-heading"><div><h2>Sauvegardes locales</h2><p>Protégez votre historique de vente</p></div><DatabaseBackup size={23} className="accent-icon"/></div><p className="backup-copy">Créez une copie cohérente de SQLite et transférez-la ensuite sur une clé USB distincte.</p><button className="secondary-btn" type="button" disabled={busy} onClick={doBackup}><Download size={17}/> Créer une sauvegarde locale</button><div className="warning-note"><CircleAlert size={17}/> La restauration et l'export direct sur clé USB restent à finaliser.</div></section>
            </div>
          </div>
        </>}
        <footer className="footer"><span>ModeStock Local <b>v0.1.0</b> · Votre boutique, vos données.</span><span>100 % local · FCFA</span></footer>
      </div>
    </main>

    {selected && <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedId(null);}}><div className="modal"><div className="modal-header"><div><span className="eyebrow">CHOISIR UNE VARIANTE</span><h2>{selected.name}</h2><p>{selected.category} · Choisissez la taille et la couleur</p></div><button className="icon-button" onClick={()=>setSelectedId(null)} aria-label="Fermer"><X size={20}/></button></div><div className="variant-list">{selected.variants.map(v=><button key={v.id} disabled={v.quantity===0} onClick={()=>addToCart(v)} className="variant-choice"><span className="variant-square">{v.size}</span><span><strong>{v.color}</strong><small>{v.quantity ? v.quantity+" disponible(s)" : "En rupture"}</small></span><strong>{money(v.salePrice)}</strong><Plus size={17}/></button>)}</div></div></div>}

    {addModal && <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setAddModal(false);}}>
      <form className="modal product-modal" onSubmit={doAddProduct}>
        <div className="modal-header">
          <div><span className="eyebrow">NOUVEAU VÊTEMENT</span><h2>Ajouter un produit</h2><p>Renseignez le vêtement et ses variantes de stock.</p></div>
          <button type="button" className="icon-button" onClick={()=>setAddModal(false)} aria-label="Fermer"><X size={20}/></button>
        </div>
        <div className="form-grid two-cols">
          <label>Nom du produit<input required placeholder="Ex. Maillot domicile" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
          <label>Catégorie<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
          <label>Prix d'achat (FCFA)<input type="number" required min="0" placeholder="Ex. 5000" value={draft.purchasePrice} onChange={e=>setDraft({...draft,purchasePrice:e.target.value})}/></label>
          <label>Prix de vente (FCFA)<input type="number" required min="0" placeholder="Ex. 8500" value={draft.salePrice} onChange={e=>setDraft({...draft,salePrice:e.target.value})}/></label>
        </div>
        <div className="variants-editor">
          <div className="variants-heading">
            <div><strong>Tailles, couleurs et quantités</strong><p>Une combinaison taille/couleur correspond à un stock distinct.</p></div>
            <span className="variants-count">{variantRows.length} variante{variantRows.length>1?"s":""}</span>
          </div>
          <datalist id="size-options">
            {["Unique","XS","S","M","L","XL","XXL","3XL","4XL","28","30","32","34","36","38","40","42","44"].map(size=><option value={size} key={size}/>)}
          </datalist>
          <div className="variant-grid-head" aria-hidden="true"><span>Taille</span><span>Couleur</span><span>Quantité</span><span></span></div>
          <div className="variant-editor-list">
            {variantRows.map(row => <div className="variant-editor-row" key={row.id}>
              <input aria-label="Taille" required list="size-options" placeholder="Ex. M, XL, 32…" value={row.size} onChange={e=>updateVariantRow(row.id,"size",e.target.value)}/>
              <input aria-label="Couleur" placeholder="Ex. Bleu" value={row.color} onChange={e=>updateVariantRow(row.id,"color",e.target.value)}/>
              <input aria-label="Quantité" type="number" required min="0" step="1" placeholder="Ex. 5" value={row.quantity} onChange={e=>updateVariantRow(row.id,"quantity",e.target.value)}/>
              <button type="button" className="remove-variant" aria-label="Supprimer cette variante" title="Supprimer la variante" disabled={variantRows.length===1} onClick={()=>setVariantRows(rows=>rows.filter(r=>r.id!==row.id))}><Trash2 size={17}/></button>
            </div>)}
          </div>
          <button type="button" className="add-variant-btn" onClick={addVariantRow}><Plus size={17}/> Ajouter une taille / couleur</button>
          <p className="variant-hint">Astuce : vous pouvez saisir les tailles textiles (M, L, XL) ou numériques (30, 32, 34). Couleur vide = Standard.</p>
        </div>
        <div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setAddModal(false)}>Annuler</button><button type="submit" disabled={busy} className="primary-btn"><Plus size={17}/> Enregistrer le produit</button></div>
      </form>
    </div>}

    {stockVariant && <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setStockVariant(null);}}><form className="modal small-modal" onSubmit={doAdjustStock}><div className="modal-header"><div><span className="eyebrow">MOUVEMENT DE STOCK</span><h2>{stockVariant.name}</h2><p>{stockVariant.size} / {stockVariant.color} · {stockVariant.quantity} pièce(s) actuellement</p></div><button type="button" className="icon-button" onClick={()=>setStockVariant(null)}><X size={20}/></button></div><div className="form-grid"><label>Variation (+ entrée, − sortie)<input required type="number" value={stockDelta} onChange={e=>setStockDelta(e.target.value)}/></label><label>Motif<input required value={stockReason} onChange={e=>setStockReason(e.target.value)}/></label></div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setStockVariant(null)}>Annuler</button><button disabled={busy} className="primary-btn">Enregistrer</button></div></form></div>}

    {expenseModal && <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setExpenseModal(false);}}><form className="modal small-modal" onSubmit={doAddExpense}><div className="modal-header"><div><span className="eyebrow">DÉPENSE DE BOUTIQUE</span><h2>Nouvelle dépense</h2><p>Suivez les frais qui réduisent votre résultat net.</p></div><button type="button" className="icon-button" onClick={()=>setExpenseModal(false)}><X size={20}/></button></div><div className="form-grid"><label>Description<input required placeholder="Ex. Transport des marchandises" value={expenseLabel} onChange={e=>setExpenseLabel(e.target.value)}/></label><label>Montant (FCFA)<input required type="number" min="1" value={expenseAmount} onChange={e=>setExpenseAmount(e.target.value)}/></label></div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setExpenseModal(false)}>Annuler</button><button disabled={busy} className="primary-btn">Enregistrer</button></div></form></div>}

    {receipt && <div className="modal-overlay"><div className="modal small-modal receipt-modal"><div className="receipt-check"><Check size={30}/></div><h2>Vente enregistrée !</h2><p>La transaction a été sauvegardée localement.</p><div className="receipt-details"><span>Référence</span><strong>{receipt.reference}</strong><span>Montant encaissé</span><strong>{money(receipt.total)}</strong></div><div className="receipt-buttons"><button type="button" className="secondary-btn" onClick={()=>setReceipt(null)}>Continuer</button><button type="button" className="primary-btn" onClick={()=>{const id=receipt.id;setReceipt(null);void openTicket(id);}}><Printer size={17}/> Voir le ticket</button></div></div></div>}
    {ticketView && <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setTicketView(null);}}><div className="modal ticket-modal"><div className="modal-header"><div><span className="eyebrow">DOCUMENT DE VENTE</span><h2>{shop.receiptFormat==="a4"?"Facture / Reçu":"Ticket de caisse"}</h2><p>Vente {ticketView.reference}</p></div><button className="icon-button" type="button" onClick={()=>setTicketView(null)} aria-label="Fermer"><X size={20}/></button></div><div className="ticket-modal-scroll"><ReceiptView shop={shop} receipt={ticketView}/></div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setTicketView(null)}><ArrowLeft size={16}/> Retour</button><button type="button" className="primary-btn" onClick={()=>window.print()}><Printer size={17}/> Imprimer</button></div></div></div>}


    {notice && <div className={"toast "+notice.kind}><span>{notice.kind === "success" ? <Check size={17}/> : <CircleAlert size={17}/>}</span><div>{notice.text}</div><button onClick={()=>setNotice(null)} aria-label="Fermer"><X size={16}/></button></div>}
    {!loaded && !notice && <div className="loading-cover"><div className="brand-mark"><Shirt size={24}/></div><strong>Ouverture de ModeStock Local…</strong></div>}
  </div>
  {ticketView && <div className="print-only"><ReceiptView shop={shop} receipt={ticketView}/></div>}
  </>;
}
