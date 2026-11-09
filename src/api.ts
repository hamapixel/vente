import { invoke } from "@tauri-apps/api/core";
import type { AuthStatus, CartLine, Customer, CustomerInput, CustomerSale, Dashboard, LoginBrand, NewProduct, PaymentEntry, ProductEdit, ProductMovement, Receipt, ReceiptDocument, ReportDay, Sale, Settlement, Shop, UserSession, Variant } from "./types";

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
  authStatus: () => desktopInvoke<AuthStatus>("auth_status"),
  getLoginBrand: () => desktopInvoke<LoginBrand>("get_login_brand"),
  registerAdmin: (username: string, password: string) => desktopInvoke<UserSession>("register_admin", { username, password }),
  login: (username: string, password: string) => desktopInvoke<UserSession>("login", { username, password }),
  logout: () => desktopInvoke<void>("logout"),
  getReceipt: (saleId: number) => desktopInvoke<ReceiptDocument>("get_receipt", { saleId }),
  getCatalog: () => desktopInvoke<Variant[]>("get_catalog"),
  createProduct: (input: NewProduct) => desktopInvoke<number>("create_product", { input }),
  adjustStock: (variantId: number, delta: number, reason: string) =>
    desktopInvoke<void>("adjust_stock", { variantId, delta, reason }),
  checkout: (requestId: string, items: CartLine[], discount: number, paymentMethod: string, customerId: number | null, paymentReceived: number) =>
    desktopInvoke<Receipt>("checkout", { input: { requestId, items, discount, paymentMethod, customerId, paymentReceived } }),
  getDashboard: () => desktopInvoke<Dashboard>("get_dashboard"),
  listCustomers: () => desktopInvoke<Customer[]>("list_customers"),
  listCustomerSales: (customerId: number) => desktopInvoke<CustomerSale[]>("list_customer_sales", { customerId }),
  createCustomer: (input: CustomerInput) => desktopInvoke<number>("create_customer", { input }),
  updateCustomer: (id: number, input: CustomerInput) => desktopInvoke<void>("update_customer", { id, input }),
  listCustomerPayments: (customerId: number) => desktopInvoke<PaymentEntry[]>("list_customer_payments", { customerId }),
  recordPayment: (saleId: number, amount: number, method: string, requestId: string) =>
    desktopInvoke<Settlement>("record_payment", { saleId, amount, method, requestId }),
  updateProduct: (input: ProductEdit) => desktopInvoke<void>("update_product", { input }),
  productHistory: (productId: number) => desktopInvoke<ProductMovement[]>("product_history", { productId }),
  getSales: () => desktopInvoke<Sale[]>("get_sales"),
  getReport: (from: string, to: string) => desktopInvoke<ReportDay[]>("get_report", { from, to }),
  addExpense: (label: string, amount: number) => desktopInvoke<void>("add_expense", { label, amount }),
  getShop: () => desktopInvoke<Shop>("get_shop"),
  updateShop: (shop: Shop) => desktopInvoke<void>("update_shop", { shop }),
  backupNow: () => desktopInvoke<string>("backup_now"),
};
