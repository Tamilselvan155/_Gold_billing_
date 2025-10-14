const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to the database file
const dbPath = path.join(__dirname, 'database', 'gold_billing.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Migration SQL
const migrationSQL = `
-- Add gender_category column to products table
ALTER TABLE products ADD COLUMN gender_category TEXT DEFAULT 'Men' CHECK (gender_category IN ('Men', 'Women', 'Kids'));

-- Create index for better performance on gender_category filtering
CREATE INDEX IF NOT EXISTS idx_products_gender_category ON products(gender_category);

-- Update existing products to have 'Men' as default gender category
UPDATE products SET gender_category = 'Men' WHERE gender_category IS NULL;
`;

// Run migration
db.exec(migrationSQL, (err) => {
  if (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
  console.log('✅ Migration completed successfully - gender_category column added to products table');
  
  // Close database connection
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
  });
});
