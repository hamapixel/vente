export interface Variant {
  id: number;
  productId: number;
  name: string;
  category: string;
  size: string;
  color: string;
  sku: string;
  purchasePrice: number;
  salePrice: number;
  quantity: number;
}
export interface Dashboard {
  salesTotal: number;
  grossProfit: number;
  expenses: number;
  salesCount: number;
  lowStock: number;
  variantCount: number;
  collectedToday: number;
  outstanding: number;
  creditCreated: number;
  refunds: number;
  cashMarginEstimate: number;
}
export interface Sale {
  id: number;
  reference: string;
  total: number;
  totalCost: number;
  paymentMethod: string;
  createdAt: string;
  paid: number;
  remaining: number;
  customerId: number | null;
  customerName: string | null;
  cancelled: boolean;
}
export interface ReportDay {
  day: string;
  total: number;
  grossProfit: number;
  count: number;
  collected: number;
  refunds: number;
  creditCreated: number;
  expenses: number;
  cashMarginEstimate: number;
}
export interface LoginBrand {
  name: string;
  logoData: string;
}
export interface Shop {
  name: string;
  phone: string;
  address: string;
  logoData: string;
  receiptHeader: string;
  receiptFooter: string;
  receiptFormat: "ticket" | "a4";
}
export interface UserSession { username: string; role: "admin" | "vendeur"; }
export interface AuthStatus { setupRequired: boolean; user: UserSession | null; }
export interface ReceiptLine {
  name: string;
  variant: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}
export interface ReceiptDocument {
  reference: string;
  createdAt: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
  customerName: string | null;
  lines: ReceiptLine[];
}
export interface Receipt {
  id: number;
  reference: string;
  total: number;
  totalCost: number;
  createdAt: string;
  paid: number;
  remaining: number;
}
export interface NewProduct {
  name: string;
  category: string;
  purchasePrice: number;
  salePrice: number;
  variants: { size: string; color: string; quantity: number }[];
}
export interface CartLine { variantId: number; quantity: number; }


export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  note: string;
  createdAt: string;
  totalSales: number;
  totalPaid: number;
  balance: number;
  saleCount: number;
}
export interface CustomerInput {
  name: string;
  phone: string;
  address: string;
  note: string;
}
export interface Settlement {
  saleId: number;
  amountReceived: number;
  paid: number;
  remaining: number;
  reference: string;
}
export interface PaymentEntry {
  id: number;
  saleId: number;
  reference: string;
  amount: number;
  method: string;
  createdAt: string;
  kind: "encaissement" | "remboursement";
}
export interface ProductEdit {
  productId: number;
  name: string;
  category: string;
  variants: Array<{
    id: number | null;
    size: string;
    color: string;
    purchasePrice: number;
    salePrice: number;
    initialQuantity: number | null;
  }>;
}
export interface ProductMovement {
  date: string;
  name: string;
  size: string;
  color: string;
  delta: number;
  reason: string;
}

export interface CustomerSale {
  id: number;
  reference: string;
  createdAt: string;
  total: number;
  paid: number;
  remaining: number;
  paymentMethod: string;
}

export interface SaleDetailLine {
  variantId: number; name: string; variant: string;
  quantity: number; unitPrice: number; unitCost: number;
}
export interface SaleDetail {
  id: number; reference: string; total: number; subtotal: number;
  discount: number; paid: number; remaining: number;
  customerId: number | null; cancelled: boolean;
  lines: SaleDetailLine[];
}
export interface SaleChange {
  saleId: number; requestId: string;
  items: { variantId: number; quantity: number }[];
  discount: number; customerId: number | null; additionalPayment: number;
  refundAmount: number; paymentMethod: string; reason: string;
}
export interface SaleCancellation {
  saleId: number; requestId: string; reason: string;
  refundedAmount: number; refundMethod: string;
}
export interface DaySummary {
  day: string; salesTotal: number; grossProfit: number;
  salesCount: number; collected: number; refunds: number;
  creditCreated: number; expenses: number; cashMarginEstimate: number;
}
export interface RestoreResult { safetyCopy: string; message: string; }
