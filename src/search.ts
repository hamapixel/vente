import type { Variant } from "./types";

/**
 * Recherche instantanée, insensible à la casse et aux accents.
 * Tous les mots sont recherchés, même s'ils concernent différents champs.
 * Ex : "chaussure 42 noir" filtre sur catégorie, taille et couleur.
 */
export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").trim();
}

function searchTerms(query: string): string[] {
  return normalizeSearch(query).split(/\s+/).filter(Boolean);
}

const footwearTerms = ["chaussure", "chaussures", "basket", "baskets", "sneaker", "sneakers", "souliers"];
function searchableCategory(category: string): string {
  const normalized = normalizeSearch(category);
  return normalized.includes("chaussure") ? category + " " + footwearTerms.join(" ") : category;
}

export function matchesVariant(variant: Variant, query: string): boolean {
  const words = searchTerms(query);
  if (!words.length) return true;
  const data = normalizeSearch([
    variant.name, variant.category, searchableCategory(variant.category),
    variant.sku, variant.size, variant.color,
    "taille " + variant.size, "pointure " + variant.size
  ].join(" "));
  return words.every(word => data.includes(word));
}

interface ProductWithVariants {
  name: string;
  category: string;
  variants: Array<Pick<Variant, "name" | "category" | "sku" | "size" | "color">>;
}

export function matchesProduct(product: ProductWithVariants, query: string): boolean {
  const words = searchTerms(query);
  if (!words.length) return true;
  const data = normalizeSearch([
    product.name, product.category, searchableCategory(product.category),
    ...product.variants.flatMap(variant => [
      variant.sku, variant.size, variant.color,
      "taille " + variant.size, "pointure " + variant.size
    ])
  ].join(" "));
  return words.every(word => data.includes(word));
}

/** Recherche instantanée dans les fiches clients : nom, téléphone, adresse. */
export function matchesCustomer(
  customer: { name: string; phone: string; address: string },
  query: string
): boolean {
  const words = searchTerms(query);
  if (!words.length) return true;
  const searchable = normalizeSearch([customer.name, customer.phone, customer.address].join(" "));
  return words.every(word => searchable.includes(word));
}
