-- Migration: Add product_category column to products table
-- Date: 2024-01-XX
-- Description: Add gender and age group classification to products

-- Step 1: Add the new product_category column
-- This column will be nullable to support existing data
ALTER TABLE products ADD COLUMN product_category TEXT CHECK (product_category IN ('Men', 'Women', 'Kids'));

-- Step 2: Create an index for better query performance on the new column
CREATE INDEX IF NOT EXISTS idx_products_product_category ON products(product_category);

-- Step 3: Create a trigger to validate product_category values on insert/update
-- This ensures data integrity for the new column
CREATE TRIGGER IF NOT EXISTS validate_product_category_insert
    BEFORE INSERT ON products
    BEGIN
        SELECT CASE
            WHEN NEW.product_category IS NOT NULL 
                 AND NEW.product_category NOT IN ('Men', 'Women', 'Kids')
            THEN RAISE(ABORT, 'Invalid product_category value. Must be Men, Women, or Kids.')
        END;
    END;

CREATE TRIGGER IF NOT EXISTS validate_product_category_update
    BEFORE UPDATE ON products
    BEGIN
        SELECT CASE
            WHEN NEW.product_category IS NOT NULL 
                 AND NEW.product_category NOT IN ('Men', 'Women', 'Kids')
            THEN RAISE(ABORT, 'Invalid product_category value. Must be Men, Women, or Kids.')
        END;
    END;

-- Step 4: Update existing products with default product_category based on current category
-- This is a data migration step to populate the new column
-- We'll use a mapping based on common jewelry categories

-- Update products with Men's categories
UPDATE products 
SET product_category = 'Men' 
WHERE category IN ('Chains', 'Rings', 'Bracelets', 'Pendants', 'Coins')
  AND product_category IS NULL;

-- Update products with Women's categories  
UPDATE products 
SET product_category = 'Women' 
WHERE category IN ('Earrings', 'Necklaces', 'Bangles', 'Sets')
  AND product_category IS NULL;

-- Update products with Kids' categories
UPDATE products 
SET product_category = 'Kids' 
WHERE category IN ('Kids', 'Children', 'Baby')
  AND product_category IS NULL;

-- For any remaining products, set to 'Women' as default (most jewelry is women's)
UPDATE products 
SET product_category = 'Women' 
WHERE product_category IS NULL;

-- Step 5: Create a view for backward compatibility
-- This view maintains the original structure while including the new column
CREATE VIEW IF NOT EXISTS products_with_category AS
SELECT 
    id,
    name,
    category,
    product_category,
    sku,
    barcode,
    weight,
    purity,
    making_charge,
    current_rate,
    stock_quantity,
    min_stock_level,
    status,
    description,
    image_url,
    created_at,
    updated_at
FROM products;

-- Step 6: Add comments for documentation
-- SQLite doesn't support comments on columns, but we can document this in the schema

-- Migration completed successfully
-- The product_category column has been added with:
-- - Nullable constraint to support existing data
-- - CHECK constraint to enforce valid values ('Men', 'Women', 'Kids')
-- - Index for query performance
-- - Triggers for data validation
-- - Data migration to populate existing records
-- - Backward compatibility view
