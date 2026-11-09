import { invoke } from "@tauri-apps/api/core";
import type { CartLine, Dashboard, NewProduct, Receipt, ReportDay, Sale, Shop, Variant } from "./types";

export const api = {
  getCatalog: () => invoke<Variant[]>("get_catalog"),
  createProduct: (input: NewProduct) => invoke<number>("create_product", { input }),
  adjustStock: (variantId: number, delta: number, reason: string) =>
    invoke<void>("adjust_stock", { variantId, delta, reason }),
  checkout: (requestId: string, items: CartLine[], discount: number, paymentMethod: string) =>
    invoke<Receipt>("checkout", { input: { requestId, items, discount, paymentMethod } }),
  getDashboard: () => invoke<Dashboard>("get_dashboard"),
  getSales: () => invoke<Sale[]>("get_sales"),
  getReport: (from: string, to: string) => invoke<ReportDay[]>("get_report", { from, to }),
  addExpense: (label: string, amount: number) => invoke<void>("add_expense", { label, amount }),
  getShop: () => invoke<Shop>("get_shop"),
  updateShop: (shop: Shop) => invoke<void>("update_shop", { shop }),
  backupNow: () => invoke<string>("backup_now"),
};
