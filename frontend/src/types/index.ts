export interface Product {
  id: string;
  name: string;
  category: string;
  product_category?: 'Men' | 'Women' | 'Kids';
  sku: string;
  barcode?: string;
  weight: number; // in grams
  purity: string; // 22K, 18K, etc.
  making_charge: number;
  current_rate: number; // per gram
  stock_quantity: number;
  min_stock_level: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface StockTransaction {
  id: string;
  product_id: string;
  type: 'in' | 'out';
  quantity: number;
  reference: string;
  notes?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  created_at: string;
}

export interface Bill {
  id: string;
  bill_number: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax_percentage: number;
  tax_amount: number;
  discount_percentage: number;
  discount_amount: number;
  total_amount: number;
  payment_method: 'cash' | 'card' | 'upi' | 'bank_transfer';
  payment_status: 'paid' | 'partial' | 'pending';
  amount_paid: number;
  // Exchange-specific fields
  old_gold_weight?: number;
  old_gold_purity?: string;
  old_gold_rate?: number;
  old_gold_value?: number;
  exchange_rate?: number;
  exchange_difference?: number;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax_percentage: number;
  tax_amount: number;
  discount_percentage: number;
  discount_amount: number;
  total_amount: number;
  payment_method: 'cash' | 'card' | 'upi' | 'bank_transfer';
  payment_status: 'paid' | 'partial' | 'pending';
  amount_paid: number;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  product_id: string;
  product_name: string;
  weight: number;
  rate: number;
  making_charge: number;
  quantity: number;
  total: number;
}

export interface DashboardStats {
  total_sales: number;
  total_products: number;
  low_stock_alerts: number;
  pending_payments: number;
  today_sales: number;
  this_month_sales: number;
}