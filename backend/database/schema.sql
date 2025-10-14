-- Gold Billing System Database Schema
-- SQLite Database for offline gold jewelry billing system

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    product_category TEXT CHECK (product_category IN ('Men', 'Women', 'Kids')),
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT UNIQUE,
    weight REAL NOT NULL,
    purity TEXT NOT NULL,
    making_charge REAL DEFAULT 0,
    current_rate REAL NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
    description TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    gst_number TEXT,
    customer_type TEXT DEFAULT 'individual' CHECK (customer_type IN ('individual', 'business')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bills table (for quotes/estimates - no inventory deduction)
CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_address TEXT,
    subtotal REAL NOT NULL,
    tax_percentage REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    discount_percentage REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'upi', 'bank_transfer', 'cheque')),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial', 'cancelled')),
    amount_paid REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- Invoices table (for actual sales - deducts inventory)
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT,
    subtotal REAL NOT NULL,
    tax_percentage REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    discount_percentage REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'upi', 'bank_transfer', 'cheque')),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial', 'cancelled')),
    amount_paid REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- Bill items table (for quotes/estimates)
CREATE TABLE IF NOT EXISTS bill_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    weight REAL NOT NULL,
    rate REAL NOT NULL,
    making_charge REAL DEFAULT 0,
    quantity INTEGER DEFAULT 1,
    total REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Invoice items table (for actual sales)
CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    weight REAL NOT NULL,
    rate REAL NOT NULL,
    making_charge REAL DEFAULT 0,
    quantity INTEGER DEFAULT 1,
    total REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Stock transactions table
CREATE TABLE IF NOT EXISTS stock_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('in', 'out', 'adjustment', 'return')),
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reason TEXT,
    reference_id INTEGER, -- Can reference invoice_id or other relevant IDs
    reference_type TEXT, -- 'invoice', 'adjustment', 'return', etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Gold rates table for historical tracking
CREATE TABLE IF NOT EXISTS gold_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purity TEXT NOT NULL,
    rate REAL NOT NULL,
    date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(purity, date)
);

-- Settings table for app configuration
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_product_category ON products(product_category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_bills_number ON bills(invoice_number);
CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(created_at);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_product ON bill_items(product_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_product ON stock_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_date ON stock_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_gold_rates_purity_date ON gold_rates(purity, date);

-- Create triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_products_timestamp 
    AFTER UPDATE ON products
    BEGIN
        UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_customers_timestamp 
    AFTER UPDATE ON customers
    BEGIN
        UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_bills_timestamp 
    AFTER UPDATE ON bills
    BEGIN
        UPDATE bills SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_invoices_timestamp 
    AFTER UPDATE ON invoices
    BEGIN
        UPDATE invoices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_settings_timestamp 
    AFTER UPDATE ON settings
    BEGIN
        UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;