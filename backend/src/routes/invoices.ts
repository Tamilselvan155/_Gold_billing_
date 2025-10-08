import express from 'express';
import { Database } from '../database/connection.js';

const router = express.Router();

// Get all invoices
router.get('/', (req, res) => {
  try {
    const { customer_id, payment_status, start_date, end_date, search } = req.query;
    
    let query = `
      SELECT i.*, c.name as customer_name, c.phone as customer_phone
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (customer_id) {
      query += ' AND i.customer_id = ?';
      params.push(customer_id);
    }
    
    if (payment_status) {
      query += ' AND i.payment_status = ?';
      params.push(payment_status);
    }
    
    if (start_date) {
      query += ' AND DATE(i.created_at) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND DATE(i.created_at) <= ?';
      params.push(end_date);
    }
    
    if (search) {
      query += ' AND (i.invoice_number LIKE ? OR i.customer_name LIKE ? OR i.customer_phone LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY i.created_at DESC';
    
    const stmt = Database.prepare(query);
    const invoices = stmt.all(...params);
    
    res.json({
      success: true,
      data: invoices,
      count: invoices.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoices'
    });
  }
});

// Get invoice by ID with items
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Get invoice details
    const invoiceStmt = Database.prepare(`
      SELECT i.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `);
    const invoice = invoiceStmt.get(id);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    // Get invoice items
    const itemsStmt = Database.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?');
    const items = itemsStmt.all(id);
    
    res.json({
      success: true,
      data: {
        ...invoice,
        items
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoice'
    });
  }
});

// Create new invoice
router.post('/', (req, res) => {
  try {
    const {
      customer_id,
      customer_name,
      customer_phone,
      customer_address,
      items,
      subtotal,
      tax_percentage = 0,
      tax_amount = 0,
      discount_percentage = 0,
      discount_amount = 0,
      total_amount,
      payment_method,
      notes
    } = req.body;
    
    // Validate required fields
    if (!customer_name || !items || !total_amount || !payment_method) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // Generate invoice number
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    
    const transaction = Database.getDatabase().transaction(() => {
      // Insert invoice
      const invoiceStmt = Database.prepare(`
        INSERT INTO invoices (invoice_number, customer_id, customer_name, customer_phone, customer_address, 
                            subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount, 
                            total_amount, payment_method, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const invoiceResult = invoiceStmt.run(
        invoiceNumber, customer_id || null, customer_name, customer_phone, customer_address,
        subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount,
        total_amount, payment_method, notes
      );
      
      const invoiceId = invoiceResult.lastInsertRowid;
      
      // Insert invoice items
      const itemStmt = Database.prepare(`
        INSERT INTO invoice_items (invoice_id, product_id, product_name, weight, rate, making_charge, quantity, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      items.forEach((item: any) => {
        itemStmt.run(
          invoiceId, item.product_id, item.product_name, item.weight, item.rate,
          item.making_charge, item.quantity, item.total
        );
        
        // Update product stock
        const updateStockStmt = Database.prepare(`
          UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?
        `);
        updateStockStmt.run(item.quantity, item.product_id);
        
        // Record stock transaction
        const stockTransactionStmt = Database.prepare(`
          INSERT INTO stock_transactions (product_id, transaction_type, quantity, previous_stock, new_stock, reason, reference_id, reference_type)
          VALUES (?, 'out', ?, ?, ?, 'Sale', ?, 'invoice')
        `);
        
        const productStmt = Database.prepare('SELECT stock_quantity FROM products WHERE id = ?');
        const product = productStmt.get(item.product_id);
        const newStock = product.stock_quantity;
        
        stockTransactionStmt.run(
          item.product_id, item.quantity, newStock + item.quantity, newStock, invoiceId
        );
      });
      
      return invoiceId;
    });
    
    const invoiceId = transaction();
    
    // Get the created invoice with items
    const getInvoice = Database.prepare(`
      SELECT i.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `);
    const invoice = getInvoice.get(invoiceId);
    
    const getItems = Database.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?');
    const invoiceItems = getItems.all(invoiceId);
    
    res.status(201).json({
      success: true,
      data: {
        ...invoice,
        items: invoiceItems
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create invoice'
    });
  }
});

// Update invoice payment status
router.patch('/:id/payment', (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status, amount_paid } = req.body;
    
    const stmt = Database.prepare(`
      UPDATE invoices 
      SET payment_status = ?, amount_paid = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const result = stmt.run(payment_status, amount_paid, id);
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Payment status updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update payment status'
    });
  }
});

export default router;
