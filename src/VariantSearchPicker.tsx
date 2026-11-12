import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { PackageSearch, Search, X } from "lucide-react";
import { matchesVariant } from "./search";
import type { Variant } from "./types";

interface Props {
  catalog: Variant[];
  excludeIds?: number[];
  onSelect: (variant: Variant) => void;
}
const money = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " FCFA";
const MAX_RESULTS = 30;

/** Recherche locale immédiate et limitée à 30 lignes DOM, même avec des milliers de variantes. */
export default function VariantSearchPicker({ catalog, excludeIds = [], onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const listId = useId();
  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const result = useMemo(() => {
    const found: Variant[] = [];
    let total = 0;
    for (const variant of catalog) {
      if (excluded.has(variant.id) || !matchesVariant(variant, query)) continue;
      total += 1;
      if (found.length < MAX_RESULTS) found.push(variant);
    }
    return { found, total };
  }, [catalog, excluded, query]);

  function choose(variant: Variant) {
    if (variant.quantity < 1) return;
    onSelect(variant);
    setQuery("");
    setActive(0);
    setOpened(false);
    ref.current?.focus();
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setOpened(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpened(true);
      setActive(i => result.found.length ? (i + (event.key === "ArrowDown" ? 1 : -1) + result.found.length) % result.found.length : 0);
    }
    if (event.key === "Enter" && opened) {
      event.preventDefault();
      const item = result.found[active];
      if (item?.quantity) choose(item);
    }
  }

  return <div className="variant-search-picker">
    <div className="variant-search-field">
      <Search size={17} aria-hidden="true"/>
      <input ref={ref} type="search" value={query} autoComplete="off"
        role="combobox" aria-label="Rechercher une variante à ajouter à la vente"
        aria-autocomplete="list" aria-controls={listId} aria-expanded={opened}
        aria-activedescendant={opened && result.found.length ? listId + "-" + active : undefined}
        placeholder="Nom, référence, catégorie, taille, couleur…"
        onFocus={() => setOpened(true)}
        onChange={e => { setQuery(e.target.value); setActive(0); setOpened(true); }}
        onKeyDown={onKeyDown}
      />
      {query && <button type="button" aria-label="Effacer" onClick={() => { setQuery(""); ref.current?.focus(); }}><X size={15}/></button>}
    </div>
    {opened && <div className="variant-search-menu" id={listId} role="listbox" aria-label="Résultats de la recherche">
      <p className="variant-search-counter">{result.total} variante(s) trouvée(s) — {result.total > MAX_RESULTS ? "30 premières affichées, précisez le nom" : "cliquez pour ajouter"}</p>
      {result.found.map((variant, index) => <button type="button" key={variant.id}
        id={listId + "-" + index} role="option" aria-selected={index === active}
        className={"variant-search-option" + (index === active ? " active" : "")}
        disabled={variant.quantity === 0}
        onMouseDown={e => e.preventDefault()} onClick={() => choose(variant)}
        onMouseEnter={() => setActive(index)}>
        <span className="variant-search-icon"><PackageSearch size={18}/></span>
        <span className="variant-search-details">
          <strong>{variant.name}</strong>
          <small>{variant.category} · {variant.size} / {variant.color} · {variant.sku}</small>
          <small>{variant.quantity ? variant.quantity + " en stock" : "Rupture de stock"}</small>
        </span>
        <strong className="variant-search-price">{money(variant.salePrice)}</strong>
      </button>)}
      {!result.found.length && <p className="variant-search-empty">Aucun article trouvé. Essayez un autre nom, une référence ou une catégorie.</p>}
      <button type="button" className="variant-search-close" onClick={() => setOpened(false)}>Fermer les résultats</button>
    </div>}
  </div>;
}
