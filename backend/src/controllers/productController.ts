import type { Request, Response } from 'express';
import { Database } from '../database/connection.js';

export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const { category, status, search } = req.query;
    
    let query = 'SELECT * FROM products WHERE 1=1';
    const params: any[] = [];
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (search) {
      query += ' AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const stmt = Database.prepare(query);
    const products = stmt.all(...params);
    
    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const stmt = Database.prepare('SELECT * FROM products WHERE id = ?');
    const product = stmt.get(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      name,
      category,
      product_category,
      sku,
      barcode,
      weight,
      purity,
      making_charge = 0,
      current_rate,
      stock_quantity = 0,
      min_stock_level = 0,
      description
    } = req.body;
    
    // Validate required fields
    if (!name || !category || !sku || !weight || !purity || !current_rate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const stmt = Database.prepare(`
      INSERT INTO products (name, category, product_category, sku, barcode, weight, purity, making_charge, current_rate, stock_quantity, min_stock_level, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(name, category, product_category, sku, barcode, weight, purity, making_charge, current_rate, stock_quantity, min_stock_level, description);
    
    // Get the created product
    const getProduct = Database.prepare('SELECT * FROM products WHERE id = ?');
    const product = getProduct.get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create product'
    });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Remove id and timestamps from update data
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.updated_at;
    
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const stmt = Database.prepare(`UPDATE products SET ${setClause} WHERE id = ?`);
    
    const result = stmt.run(...values, id);
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    // Get the updated product
    const getProduct = Database.prepare('SELECT * FROM products WHERE id = ?');
    const product = getProduct.get(id);
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update product'
    });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { cascade = false } = req.query;
    
    // Check if product exists first
    const checkStmt = Database.prepare('SELECT id FROM products WHERE id = ?');
    const product = checkStmt.get(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    // Check for foreign key references before deletion
    const billItemsStmt = Database.prepare('SELECT COUNT(*) as count FROM bill_items WHERE product_id = ?');
    const invoiceItemsStmt = Database.prepare('SELECT COUNT(*) as count FROM invoice_items WHERE product_id = ?');
    const stockTransactionsStmt = Database.prepare('SELECT COUNT(*) as count FROM stock_transactions WHERE product_id = ?');
    
    const billItemsCount = billItemsStmt.get(id).count;
    const invoiceItemsCount = invoiceItemsStmt.get(id).count;
    const stockTransactionsCount = stockTransactionsStmt.get(id).count;
    
    if ((billItemsCount > 0 || invoiceItemsCount > 0) && !cascade) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete product. It is referenced in ${billItemsCount} bill(s) and ${invoiceItemsCount} invoice(s). Use cascade=true to force deletion.`,
        references: {
          bills: billItemsCount,
          invoices: invoiceItemsCount,
          stockTransactions: stockTransactionsCount
        }
      });
    }
    
    // If cascade is true, delete the product and let foreign keys handle the references
    const stmt = Database.prepare('DELETE FROM products WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: cascade 
        ? `Product deleted successfully. ${billItemsCount} bill references and ${invoiceItemsCount} invoice references were set to NULL.`
        : 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: `Failed to delete product: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
};
