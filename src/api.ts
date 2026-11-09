import { invoke } from "@tauri-apps/api/core";
import type { CartLine, Dashboard, NewProduct, Receipt, ReportDay, Sale, Shop, Variant } from "./types";

// Dans un onglet navigateur ordinaire, l'API Tauri/SQLite n'est pas disponible.
function desktopInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window)) {
    return Promise.reject(new Error(
      "Aperçu navigateur : ouvrez la fenêtre ModeStock démarrée avec npm run tauri dev pour enregistrer des données."
    ));
  }
  return invoke<T>(command, args);
}

export const api = {
  getCatalog: () => desktopInvoke<Variant[]>("get_catalog"),
  createProduct: (input: NewProduct) => desktopInvoke<number>("create_product", { input }),
  adjustStock: (variantId: number, delta: number, reason: string) =>
    invoke<void>("adjust_stock", { variantId, delta, reason }),
  checkout: (requestId: string, items: CartLine[], discount: number, paymentMethod: string) =>
    invoke<Receipt>("checkout", { input: { requestId, items, discount, paymentMethod } }),
  getDashboard: () => desktopInvoke<Dashboard>("get_dashboard"),
  getSales: () => desktopInvoke<Sale[]>("get_sales"),
  getReport: (from: string, to: string) => desktopInvoke<ReportDay[]>("get_report", { from, to }),
  addExpense: (label: string, amount: number) => desktopInvoke<void>("add_expense", { label, amount }),
  getShop: () => desktopInvoke<Shop>("get_shop"),
  updateShop: (shop: Shop) => desktopInvoke<void>("update_shop", { shop }),
  backupNow: () => desktopInvoke<string>("backup_now"),
};
