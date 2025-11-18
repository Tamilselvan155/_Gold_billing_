import { Database } from './connection.js';
import bcrypt from 'bcryptjs';

const seedDatabase = async () => {
  try {
    console.log('🌱 Seeding database with initial data...');
    
    // Initialize database
    Database.initialize();
    
    // Seed users
    console.log('Seeding users...');
    const db = Database.getDatabase();
    
    // Check if users table exists and if users already exist
    let existingUsers: { count: number };
    try {
      existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    } catch (error) {
      console.log('Users table does not exist yet, skipping user seeding');
      existingUsers = { count: 1 }; // Skip user seeding if table doesn't exist
    }
    
    if (existingUsers.count === 0) {
      // Hash passwords (default password is 'password123' for all users)
      const defaultPassword = await bcrypt.hash('password123', 10);
      
      const insertUser = db.prepare(`
        INSERT INTO users (username, email, password_hash, role, full_name, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `);
      
      const users = [
        ['superadmin', 'superadmin@goldbilling.com', defaultPassword, 'superadmin', 'Super Admin'],
        ['admin', 'admin@goldbilling.com', defaultPassword, 'admin', 'Administrator'],
        ['finance', 'finance@goldbilling.com', defaultPassword, 'finance_manager', 'Finance Manager'],
      ];
      
      users.forEach(user => {
        insertUser.run(...user);
      });
      
      console.log('✅ Users seeded successfully');
      console.log('📝 Default credentials:');
      console.log('   - Superadmin: superadmin / password123');
      console.log('   - Admin: admin / password123');
      console.log('   - Finance Manager: finance / password123');
    } else {
      console.log('ℹ️  Users already exist, skipping user seeding');
    }
    
    // Insert sample products (only if they don't exist)
    try {
      const existingProducts = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
      
      if (existingProducts.count === 0) {
        const insertProduct = db.prepare(`
          INSERT INTO products (name, category, sku, barcode, weight, purity, making_charge, current_rate, stock_quantity, min_stock_level, description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const products = [
          ['Gold Chain 22K', 'Chains', 'GC001', '1234567890123', 15.5, '22K', 500, 5500, 5, 2, 'Beautiful 22K gold chain'],
          ['Gold Ring 18K', 'Rings', 'GR001', '1234567890124', 8.2, '18K', 300, 4800, 3, 1, 'Elegant 18K gold ring'],
          ['Gold Earrings 22K', 'Earrings', 'GE001', '1234567890125', 12.0, '22K', 400, 5500, 4, 2, 'Traditional 22K gold earrings'],
          ['Gold Bracelet 18K', 'Bracelets', 'GB001', '1234567890126', 20.0, '18K', 600, 4800, 2, 1, 'Stylish 18K gold bracelet'],
          ['Gold Pendant 22K', 'Pendants', 'GP001', '1234567890127', 6.5, '22K', 250, 5500, 8, 3, 'Intricate 22K gold pendant']
        ];
        
        products.forEach(product => {
          insertProduct.run(...product);
        });
      } else {
        console.log('ℹ️  Products already exist, skipping product seeding');
      }
    } catch (error: any) {
      console.log('ℹ️  Products table may not exist or products already seeded');
    }
    
    // Insert sample customers (only if they don't exist)
    try {
      const existingCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number };
      
      if (existingCustomers.count === 0) {
        const insertCustomer = db.prepare(`
          INSERT INTO customers (name, phone, email, address, city, state, pincode, customer_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const customers = [
          ['Rajesh Kumar', '+91 9876543210', 'rajesh@example.com', '123 Main Street', 'Chennai', 'Tamil Nadu', '600001', 'individual'],
          ['Priya Sharma', '+91 9876543211', 'priya@example.com', '456 Park Avenue', 'Mumbai', 'Maharashtra', '400001', 'individual'],
          ['Gold Palace Jewellers', '+91 9876543212', 'info@goldpalace.com', '789 Business District', 'Delhi', 'Delhi', '110001', 'business'],
          ['Anita Singh', '+91 9876543213', 'anita@example.com', '321 Garden Street', 'Bangalore', 'Karnataka', '560001', 'individual']
        ];
        
        customers.forEach(customer => {
          insertCustomer.run(...customer);
        });
      } else {
        console.log('ℹ️  Customers already exist, skipping customer seeding');
      }
    } catch (error: any) {
      console.log('ℹ️  Customers table may not exist or customers already seeded');
    }
    
    // Insert sample gold rates (only if they don't exist)
    try {
      const today = new Date().toISOString().split('T')[0];
      const existingRates = db.prepare('SELECT COUNT(*) as count FROM gold_rates WHERE date = ?').get(today) as { count: number };
      
      if (existingRates.count === 0) {
        const insertGoldRate = db.prepare(`
          INSERT INTO gold_rates (purity, rate, date)
          VALUES (?, ?, ?)
        `);
        
        const goldRates = [
          ['22K', 5500, today],
          ['18K', 4800, today],
          ['14K', 3800, today],
          ['24K', 6000, today]
        ];
        
        goldRates.forEach(rate => {
          try {
            insertGoldRate.run(...rate);
          } catch (error: any) {
            // Skip if already exists
          }
        });
      } else {
        console.log('ℹ️  Gold rates already exist for today, skipping gold rate seeding');
      }
    } catch (error: any) {
      console.log('ℹ️  Gold rates table may not exist or rates already seeded');
    }
    
    // Insert sample settings (only if they don't exist)
    try {
      const existingSettings = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
      
      if (existingSettings.count === 0) {
        const insertSetting = db.prepare(`
          INSERT INTO settings (key, value, description)
          VALUES (?, ?, ?)
        `);
        
        const settings = [
          ['company_name', 'Vannamiyal Thangamaligai', 'Company name for invoices'],
          ['company_address', '123 Business Street, City, State - 123456', 'Company address for invoices'],
          ['company_phone', '+91 9876543210', 'Company phone number'],
          ['company_email', 'info@goldbilling.com', 'Company email address'],
          ['gst_number', '29ABCDE1234F1Z5', 'GST registration number'],
          ['default_tax_rate', '3', 'Default tax rate percentage'],
          ['currency_symbol', '₹', 'Currency symbol for display'],
          ['invoice_prefix', 'INV', 'Prefix for invoice numbers'],
          ['low_stock_threshold', '5', 'Threshold for low stock alerts']
        ];
        
        settings.forEach(setting => {
          try {
            insertSetting.run(...setting);
          } catch (error: any) {
            // Skip if already exists
          }
        });
      } else {
        console.log('ℹ️  Settings already exist, skipping settings seeding');
      }
    } catch (error: any) {
      console.log('ℹ️  Settings table may not exist or settings already seeded');
    }
    
    console.log('✅ Database seeded successfully');
    
    // Close database connection
    Database.close();
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

// Run seeding if this file is executed directly
seedDatabase();

export { seedDatabase };
