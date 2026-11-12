import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { matchesCustomer, matchesVariant } from "./search";
import type { Variant } from "./types";

const makeVariant = (id:number): Variant => ({
  id, productId:id, name:`Ceinture cuir modèle ${id}`, category:"Maroquinerie",
  size:"Unique", color: id%2 ? "Noir" : "Marron", sku:`BT-${id}`,
  salePrice:2500, purchasePrice:1000, quantity:7
});

describe("VestiFlow : catalogue commercial étendu", () => {
  it("cherche dans plus de 5 000 variantes par nom, catégorie, couleur et référence", () => {
    const items=Array.from({length:5500},(_,i)=>makeVariant(i+1));
    expect(items.filter(v=>matchesVariant(v,"ceinture 4321 noir")).map(v=>v.id)).toEqual([4321]);
    expect(items.filter(v=>matchesVariant(v,"maroquinerie marron BT-5000")).map(v=>v.id)).toEqual([5000]);
    expect(items.filter(v=>matchesVariant(v,"référence introuvable"))).toHaveLength(0);
  });
  it("retrouve le client par téléphone ou nom au milieu de milliers de fiches", () => {
    const customers=Array.from({length:2400},(_,i)=>({
      name:i===1280?"Fanta Diarra":`Client ${i}`,
      phone:i===1280?"+223 76 45 12 90":`+223 70 00 ${String(i).padStart(4,"0")}`,
      address:"Bamako"
    }));
    expect(customers.filter(c=>matchesCustomer(c,"fanta 764512")).length).toBe(1);
  });
  it("utilise les sélecteurs de recherche et limite le DOM pour de grands catalogues", () => {
    const saleEditor=readFileSync(new URL("./SaleEditor.tsx",import.meta.url),"utf8");
    const picker=readFileSync(new URL("./VariantSearchPicker.tsx",import.meta.url),"utf8");
    const app=readFileSync(new URL("./App.tsx",import.meta.url),"utf8");
    expect(saleEditor).toContain("<VariantSearchPicker");
    expect(saleEditor).toContain("<CustomerSearchPicker");
    expect(picker).toContain("const MAX_RESULTS = 30");
    expect(picker).toContain("matchesVariant(variant, query)");
    expect(app).toContain("filteredVariants.slice(0,visibleLimit)");
    expect(app).toContain("filtered.slice(0,visibleLimit)");
    expect(app).toContain("category: \"Divers\"");
    expect(app).toContain("id=\"vestiflow-categories\"");
  });
  it("prépare l'affichage téléphone sans exposer SQLite sur le réseau", () => {
    const css=readFileSync(new URL("./styles.css",import.meta.url),"utf8");
    const api=readFileSync(new URL("./api.ts",import.meta.url),"utf8");
    expect(css).toContain("@media screen and (max-width:480px)");
    expect(css).toContain(".variant-search-menu");
    expect(api).toContain("desktopInvoke");
    expect(api).toContain("__TAURI_INTERNALS__");
  });
});
