import { describe, expect, it } from "vitest";
import { matchesCustomer, matchesProduct, matchesVariant, normalizeSearch } from "./search";
import type { Variant } from "./types";

const shoe: Variant = {
  id: 1, productId: 1, name: "Basket Nike", category: "Chaussures", size: "42",
  color: "Noir", sku: "MS-001", purchasePrice: 8000, salePrice: 12000, quantity: 3
};
const shirt: Variant = {
  id: 2, productId: 2, name: "Maillot Brésil", category: "Maillots", size: "L",
  color: "Bleu", sku: "MS-002", purchasePrice: 5000, salePrice: 9000, quantity: 7
};

describe("recherche produits instantanée", () => {
  it("recherche les chaussures par catégorie, au singulier et au pluriel", () => {
    expect(matchesVariant(shoe, "chaussure")).toBe(true);
    expect(matchesVariant(shoe, "CHAUSSURES")).toBe(true);
    expect(matchesVariant(shoe, "basket")).toBe(true);
    expect(matchesVariant(shirt, "chaussures")).toBe(false);
  });

  it("recherche une pointure et une couleur, même avec des mots combinés", () => {
    expect(matchesVariant(shoe, "Chaussure 42 noir")).toBe(true);
    expect(matchesVariant(shoe, "pointure 42")).toBe(true);
    expect(matchesVariant(shirt, "taille L")).toBe(true);
    expect(matchesVariant(shoe, "chaussure 43")).toBe(false);
    expect(matchesVariant(shirt, "L Bleu")).toBe(true);
  });

  it("ignore les accents, espaces de trop et majuscules", () => {
    expect(normalizeSearch("  BRÉSIL  ")).toBe("bresil");
    expect(matchesVariant(shirt, "  mailLOT   bresil  ")).toBe(true);
  });

  it("recherche les références et n'affiche pas les autres articles", () => {
    expect(matchesVariant(shoe, "MS-001")).toBe(true);
    expect(matchesVariant(shoe, "MS-002")).toBe(false);
  });

  it("filtre le produit sur les champs des différentes variantes", () => {
    const product = { name: "Basket Nike", category: "Chaussures", variants: [shoe] };
    expect(matchesProduct(product, "nike 42")).toBe(true);
    expect(matchesProduct(product, "noir chaussure")).toBe(true);
    expect(matchesProduct(product, "pointure 43")).toBe(false);
  });
});

describe("recherche instantanée des clients", () => {
  const clients = [
    { name: "Moussa Traoré", phone: "+223 76 45 12 90", address: "Bamako, Kalaban-Coura" },
    { name: "Aïssata Diarra", phone: "+223 70 22 33 44", address: "Hamdallaye ACI 2000" },
  ];

  it("filtre au fil de la saisie par nom, même sans accent", () => {
    expect(clients.filter(c => matchesCustomer(c, "mous")).length).toBe(1);
    expect(matchesCustomer(clients[0], "moussa traore")).toBe(true);
    expect(matchesCustomer(clients[1], "aissata")).toBe(true);
    expect(matchesCustomer(clients[0], "aissata")).toBe(false);
  });
  it("retrouve instantanément un téléphone et un quartier", () => {
    expect(matchesCustomer(clients[0], "76 45 12")).toBe(true);
    expect(matchesCustomer(clients[1], "70 22")).toBe(true);
    expect(matchesCustomer(clients[0], "Kalaban")).toBe(true);
    expect(matchesCustomer(clients[1], "hamdallaye aci")).toBe(true);
  });
  it("cherche plusieurs mots sur différents champs", () => {
    expect(matchesCustomer(clients[0], "moussa 76")).toBe(true);
    expect(matchesCustomer(clients[0], "moussa 70")).toBe(false);
    expect(clients.every(c => matchesCustomer(c, ""))).toBe(true);
  });
});
