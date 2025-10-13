import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path
const dbPath = path.join(__dirname, 'gold_billing.db');

// Migration file path
const migrationPath = path.join(__dirname, 'migrate_add_product_category.sql');

// Check if database exists
if (!fs.existsSync(dbPath)) {
    console.error('Database file not found. Please ensure the database is initialized first.');
    process.exit(1);
}

// Check if migration file exists
if (!fs.existsSync(migrationPath)) {
    console.error('Migration file not found.');
    process.exit(1);
}

// Read migration SQL
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Open database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('Connected to the database.');
});

// Execute migration
db.exec(migrationSQL, (err) => {
    if (err) {
        console.error('Error executing migration:', err.message);
        process.exit(1);
    }
    console.log('Migration completed successfully!');
    console.log('Added product_category column to products table.');
    console.log('Created indexes and triggers for data validation.');
    console.log('Updated existing products with default categories.');
});

// Close database connection
db.close((err) => {
    if (err) {
        console.error('Error closing database:', err.message);
    } else {
        console.log('Database connection closed.');
    }
});
