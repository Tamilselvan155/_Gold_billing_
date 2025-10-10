# Product Category Migration Guide

## Overview
This migration adds a new `product_category` column to the `products` table to classify products by gender and age group ('Men', 'Women', 'Kids').

## Migration Details

### Files Modified
1. `schema.sql` - Updated main schema with new column
2. `migrate_add_product_category.sql` - Migration script for existing databases
3. `run_migration.js` - Node.js script to execute migration
4. `frontend/src/types/index.ts` - Updated Product interface
5. `frontend/src/components/Inventory.tsx` - Updated UI to support new field

### Database Changes

#### New Column
- **Column Name**: `product_category`
- **Type**: `TEXT`
- **Constraints**: `CHECK (product_category IN ('Men', 'Women', 'Kids'))`
- **Nullable**: Yes (to support existing data)

#### New Index
- **Index Name**: `idx_products_product_category`
- **Purpose**: Improve query performance for filtering by product category

#### New Triggers
- `validate_product_category_insert` - Validates new records
- `validate_product_category_update` - Validates updates

### Data Migration Strategy

The migration automatically categorizes existing products based on their current `category` field:

- **Men's Categories**: Chains, Rings, Bracelets, Pendants, Coins
- **Women's Categories**: Earrings, Necklaces, Bangles, Sets
- **Kids' Categories**: Kids, Children, Baby
- **Default**: Women (for any uncategorized products)

## Running the Migration

### Prerequisites
- Node.js installed
- SQLite3 package installed (`npm install sqlite3`)
- Database file exists at `backend/database/gold_billing.db`

### Steps

1. **Backup Database** (Recommended)
   ```bash
   cp backend/database/gold_billing.db backend/database/gold_billing_backup.db
   ```

2. **Run Migration**
   ```bash
   cd backend/database
   node run_migration.js
   ```

3. **Verify Migration**
   ```sql
   -- Check if column exists
   PRAGMA table_info(products);
   
   -- Check data distribution
   SELECT product_category, COUNT(*) FROM products GROUP BY product_category;
   ```

## Frontend Changes

### New Features Added
1. **Product Form**: Added Gender/Age Category dropdown
2. **Product Table**: Added Gender/Age column with color-coded badges
3. **Filtering**: Added filter for product category
4. **Type Safety**: Updated TypeScript interfaces

### UI Components
- **Form Field**: Optional dropdown with Men/Women/Kids options
- **Table Column**: Color-coded badges (Blue for Men, Pink for Women, Green for Kids)
- **Filter**: Additional filter dropdown in search section

## Backward Compatibility

### Database Level
- Column is nullable, so existing queries continue to work
- No breaking changes to existing table structure
- Triggers only validate new/updated records

### Application Level
- Product interface includes optional `product_category` field
- All existing functionality preserved
- New features are additive only

## Validation Rules

### Database Constraints
- Only 'Men', 'Women', 'Kids' values allowed
- NULL values allowed for backward compatibility
- Triggers prevent invalid data entry

### Application Validation
- Frontend form validates selection
- TypeScript types enforce correct values
- UI provides clear visual feedback

## Performance Considerations

### Indexes
- New index on `product_category` for fast filtering
- Existing indexes remain unchanged
- No impact on current query performance

### Query Optimization
- Filter queries can now use product_category index
- Combined filtering (category + product_category) supported
- No breaking changes to existing queries

## Rollback Plan

If rollback is needed:

1. **Remove Column**
   ```sql
   ALTER TABLE products DROP COLUMN product_category;
   ```

2. **Remove Index**
   ```sql
   DROP INDEX IF EXISTS idx_products_product_category;
   ```

3. **Remove Triggers**
   ```sql
   DROP TRIGGER IF EXISTS validate_product_category_insert;
   DROP TRIGGER IF EXISTS validate_product_category_update;
   ```

4. **Revert Frontend Changes**
   - Remove product_category from Product interface
   - Remove UI components for product_category
   - Remove filtering logic

## Testing Checklist

### Database Testing
- [ ] Migration runs without errors
- [ ] Existing data preserved
- [ ] New column accepts valid values
- [ ] Triggers prevent invalid values
- [ ] Indexes improve query performance

### Frontend Testing
- [ ] Form accepts new field
- [ ] Table displays new column
- [ ] Filtering works correctly
- [ ] TypeScript compilation succeeds
- [ ] No breaking changes to existing features

### Integration Testing
- [ ] Product creation with new field
- [ ] Product editing preserves new field
- [ ] Filtering by product category
- [ ] Search functionality unchanged
- [ ] Export/import includes new field

## Future Enhancements

### Potential Improvements
1. **Additional Categories**: Could add more specific age groups
2. **Category Hierarchies**: Support for sub-categories
3. **Analytics**: Track sales by gender/age demographics
4. **Reporting**: Enhanced reporting with category breakdowns
5. **API Endpoints**: RESTful endpoints for category management

### Scalability Considerations
- Current design supports easy addition of new categories
- Index structure can handle large datasets
- UI components are reusable for future enhancements

## Support

For issues or questions regarding this migration:
1. Check the migration logs for errors
2. Verify database integrity after migration
3. Test all application functionality
4. Review this documentation for troubleshooting steps
