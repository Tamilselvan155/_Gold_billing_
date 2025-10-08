import express from 'express';
import { Database } from '../database/connection.js';

const router = express.Router();

// Get all bills
router.get('/', (req, res) => {
  try {
    const { customer_id, payment_status, start_date, end_date, search } = req.query;
    
    let query = `
      SELECT b.*, 
             COALESCE(c.name, b.customer_name) as customer_name,
             COALESCE(c.phone, b.customer_phone) as customer_phone
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (customer_id) {
      query += ' AND b.customer_id = ?';
      params.push(customer_id);
    }
    
    if (payment_status) {
      query += ' AND b.payment_status = ?';
      params.push(payment_status);
    }
    
    if (start_date) {
      query += ' AND DATE(b.created_at) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND DATE(b.created_at) <= ?';
      params.push(end_date);
    }
    
    if (search) {
      query += ' AND (b.bill_number LIKE ? OR b.customer_name LIKE ? OR b.customer_phone LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY b.created_at DESC';
    
    const stmt = Database.prepare(query);
    const bills = stmt.all(...params);
    
    res.json({
      success: true,
      data: bills,
      count: bills.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bills'
    });
  }
});

// Get bill by ID with items
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Get bill details
    const billStmt = Database.prepare(`
      SELECT b.*, 
             COALESCE(c.name, b.customer_name) as customer_name,
             COALESCE(c.phone, b.customer_phone) as customer_phone,
             COALESCE(c.address, b.customer_address) as customer_address
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE b.id = ?
    `);
    const bill = billStmt.get(id);
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }
    
    // Get bill items
    const itemsStmt = Database.prepare('SELECT * FROM bill_items WHERE bill_id = ?');
    const items = itemsStmt.all(id);
    
    res.json({
      success: true,
      data: {
        ...bill,
        items
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bill'
    });
  }
});

// Create new bill
router.post('/', (req, res) => {
  try {
    const {
      invoice_number,
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
      payment_status = 'pending',
      amount_paid = 0,
      notes
    } = req.body;
    
    console.log('Bill creation request:', {
      invoice_number,
      customer_name,
      customer_phone,
      subtotal,
      total_amount,
      payment_method
    });
    
    // Validate required fields
    if (!invoice_number || !customer_name || !items || !total_amount || !payment_method) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const transaction = Database.getDatabase().transaction(() => {
      // Insert bill
      const billStmt = Database.prepare(`
        INSERT INTO bills (
          bill_number, customer_id, customer_name, customer_phone, customer_address,
          subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount,
          total_amount, payment_method, payment_status, amount_paid, bill_type, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const now = new Date().toISOString();
      const billResult = billStmt.run(
        invoice_number,     // bill_number
        customer_id || null, // customer_id
        customer_name,      // customer_name
        customer_phone,     // customer_phone
        customer_address,   // customer_address
        subtotal,           // subtotal
        tax_percentage,     // tax_percentage
        tax_amount,         // tax_amount
        discount_percentage, // discount_percentage
        discount_amount,    // discount_amount
        total_amount,       // total_amount
        payment_method,     // payment_method
        payment_status,     // payment_status
        amount_paid,        // amount_paid
        'bill',             // bill_type
        notes,              // notes
        now,                // created_at
        now                 // updated_at
      );
      
      const billId = billResult.lastInsertRowid;
      
      // Insert bill items
      if (items && items.length > 0) {
        const itemStmt = Database.prepare(`
          INSERT INTO bill_items (
            bill_id, product_id, product_name, weight, rate, making_charge,
            quantity, total, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const item of items) {
          itemStmt.run(
            billId, item.product_id, item.product_name, item.weight, item.rate,
            item.making_charge, item.quantity, item.total, now
          );
        }
      }
      
      return billId;
    });
    
    const billId = transaction();
    
    // Get the created bill
    const getBillStmt = Database.prepare(`
      SELECT b.*, c.name as customer_name, c.phone as customer_phone
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE b.id = ?
    `);
    const createdBill = getBillStmt.get(billId);
    
    res.status(201).json({
      success: true,
      data: createdBill,
      message: 'Bill created successfully'
    });
  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create bill'
    });
  }
});

// Update bill payment status
router.patch('/:id/payment', (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status, amount_paid, payment_method } = req.body;
    
    const stmt = Database.prepare(`
      UPDATE bills 
      SET payment_status = ?, amount_paid = ?, payment_method = ?, updated_at = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(payment_status, amount_paid, payment_method, new Date().toISOString(), id);
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Bill payment updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update bill payment'
    });
  }
});

// Delete bill
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = Database.getDatabase().transaction(() => {
      // Delete bill items first
      const deleteItemsStmt = Database.prepare('DELETE FROM bill_items WHERE bill_id = ?');
      deleteItemsStmt.run(id);
      
      // Delete bill
      const deleteBillStmt = Database.prepare('DELETE FROM bills WHERE id = ?');
      const result = deleteBillStmt.run(id);
      
      return result.changes;
    });
    
    const changes = transaction();
    
    if (changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Bill deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete bill'
    });
  }
});

export default router;
