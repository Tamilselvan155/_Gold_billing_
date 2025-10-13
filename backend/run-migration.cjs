const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Read the migration file
const migrationPath = path.join(__dirname, 'database', 'migrate_gender_category.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Connect to database
const db = new sqlite3.Database('./database/gold_billing.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the database.');
});

// Execute migration
db.exec(migrationSQL, (err) => {
  if (err) {
    console.error('Error running migration:', err.message);
    process.exit(1);
  } else {
    console.log('Migration completed successfully!');
  }
});

// Close database connection
db.close((err) => {
  if (err) {
    console.error('Error closing database:', err.message);
  } else {
    console.log('Database connection closed.');
  }
});
