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
}
export interface Sale {
  id: number;
  reference: string;
  total: number;
  totalCost: number;
  paymentMethod: string;
  createdAt: string;
}
export interface ReportDay {
  day: string;
  total: number;
  grossProfit: number;
  count: number;
}
export interface Shop {
  name: string;
  phone: string;
  address: string;
}
export interface Receipt {
  id: number;
  reference: string;
  total: number;
  totalCost: number;
  createdAt: string;
}
export interface NewProduct {
  name: string;
  category: string;
  purchasePrice: number;
  salePrice: number;
  variants: { size: string; color: string; quantity: number }[];
}
export interface CartLine { variantId: number; quantity: number; }
