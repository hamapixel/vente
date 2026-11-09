import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { Customer } from "./types";
import { matchesCustomer } from "./search";

interface Props {
  customers: Customer[];
  value: number | null;
  onChange: (id: number | null) => void;
}

const money = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " FCFA";

export default function CustomerSearchPicker({ customers, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = customers.find(c => c.id === value);
  const matches = useMemo(() => customers.filter(c => matchesCustomer(c, query)).slice(0, 20), [customers, query]);
  const offerPassingCustomer = !query.trim();
  const count = matches.length + (offerPassingCustomer ? 1 : 0);

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, []);

  function select(id: number | null) {
    onChange(id);
    setQuery("");
    setActive(0);
    setOpen(false);
  }
  function showOptions() {
    setQuery("");
    setActive(0);
    setOpen(true);
  }
  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        showOptions();
        return;
      }
      setActive(i => count === 0 ? 0 : (i + (event.key === "ArrowDown" ? 1 : -1) + count) % count);
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      if (offerPassingCustomer && active === 0) select(null);
      else {
        const choice = matches[active - (offerPassingCustomer ? 1 : 0)];
        if (choice) select(choice.id);
      }
    }
  }

  return <div className="customer-search-picker" ref={ref}>
    <div className={"customer-search-input " + (open ? "focused" : "")}>
      <Search size={16} aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Rechercher et sélectionner un client"
        aria-controls={listId}
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Rechercher nom ou numéro…"
        value={open ? query : selected?.name ?? ""}
        onFocus={showOptions}
        onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={keyboard}
      />
      {selected && !open && <button type="button" className="customer-search-clear" title="Retirer le client" aria-label="Retirer le client" onClick={() => { select(null); inputRef.current?.focus(); }}><X size={15}/></button>}
      <button type="button" className="customer-search-toggle" aria-label={open ? "Fermer la liste" : "Afficher les clients"} onClick={() => {
        if (open) { setOpen(false); setQuery(""); }
        else { showOptions(); inputRef.current?.focus(); }
      }}><ChevronDown size={15}/></button>
    </div>
    {open && <div className="customer-search-results" role="listbox" id={listId}>
      {offerPassingCustomer && <button type="button" role="option" aria-selected={value === null} className={"customer-search-option " + (active === 0 ? "active" : "")} onMouseDown={e => e.preventDefault()} onClick={() => select(null)}>
        <span className="customer-search-avatar">CP</span>
        <span className="customer-search-option-body"><strong>Client de passage</strong><small>Vente comptant, sans fiche client</small></span>
        {value === null && <Check size={16}/>}
      </button>}
      {matches.map((customer,index) => <button
        type="button" role="option" aria-selected={value === customer.id}
        key={customer.id}
        className={"customer-search-option " + (active === index + (offerPassingCustomer ? 1 : 0) ? "active" : "")}
        onMouseDown={e => e.preventDefault()} onClick={() => select(customer.id)}
      >
        <span className="customer-search-avatar">{customer.name.slice(0,1).toUpperCase()}</span>
        <span className="customer-search-option-body"><strong>{customer.name}</strong><small>{[customer.phone, customer.address].filter(Boolean).join(" · ") || "Sans téléphone"}</small></span>
        {customer.balance > 0 ? <span className="customer-search-debt">{money(customer.balance)} dus</span> : value === customer.id ? <Check size={16}/> : null}
      </button>)}
      {!matches.length && <p className="customer-search-empty">Aucun client trouvé. Utilisez le bouton + pour créer sa fiche.</p>}
      {matches.length >= 20 && <p className="customer-search-help">Affichage limité à 20 résultats : saisissez plus de caractères.</p>}
    </div>}
  </div>;
}
