import type { Request, Response } from 'express';
import { Database } from '../database/connection.js';

export const getAllCustomers = async (req: Request, res: Response) => {
  try {
    const { search, customer_type, status } = req.query;
    
    let query = 'SELECT * FROM customers WHERE 1=1';
    const params: any[] = [];
    
    if (customer_type) {
      query += ' AND customer_type = ?';
      params.push(customer_type);
    }
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const stmt = Database.prepare(query);
    const customers = stmt.all(...params);
    
    res.json({
      success: true,
      data: customers,
      count: customers.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customers'
    });
  }
};

export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const stmt = Database.prepare('SELECT * FROM customers WHERE id = ?');
    const customer = stmt.get(id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer'
    });
  }
};

export const createCustomer = async (req: Request, res: Response) => {
  try {
    const {
      name,
      phone,
      email,
      address,
      city,
      state,
      pincode,
      gst_number,
      customer_type = 'individual'
    } = req.body;
    
    // Validate required fields
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Name and phone are required'
      });
    }
    
    const stmt = Database.prepare(`
      INSERT INTO customers (name, phone, email, address, city, state, pincode, gst_number, customer_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(name, phone, email, address, city, state, pincode, gst_number, customer_type);
    
    // Get the created customer
    const getCustomer = Database.prepare('SELECT * FROM customers WHERE id = ?');
    const customer = getCustomer.get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      data: customer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create customer'
    });
  }
};

export const updateCustomer = async (req: Request, res: Response) => {
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
    const stmt = Database.prepare(`UPDATE customers SET ${setClause} WHERE id = ?`);
    
    const result = stmt.run(...values, id);
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Get the updated customer
    const getCustomer = Database.prepare('SELECT * FROM customers WHERE id = ?');
    const customer = getCustomer.get(id);
    
    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update customer'
    });
  }
};

export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if customer exists
    const checkCustomer = Database.prepare('SELECT * FROM customers WHERE id = ?');
    const customer = checkCustomer.get(id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Check if customer has invoices (invoices have NOT NULL customer_id constraint)
    const checkInvoices = Database.prepare('SELECT COUNT(*) as count FROM invoices WHERE customer_id = ?');
    const invoiceCount = checkInvoices.get(id) as { count: number };
    
    if (invoiceCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete customer. This customer has ${invoiceCount.count} invoice(s) associated. Please delete or reassign the invoices first.`
      });
    }
    
    // Check if customer has bills (bills can have NULL customer_id, so we can delete)
    // But we'll still inform the user
    const checkBills = Database.prepare('SELECT COUNT(*) as count FROM bills WHERE customer_id = ?');
    const billCount = checkBills.get(id) as { count: number };
    
    // Use transaction to delete customer
    const transaction = Database.getDatabase().transaction(() => {
      // Delete customer (bills will have customer_id set to NULL due to ON DELETE SET NULL)
      const stmt = Database.prepare('DELETE FROM customers WHERE id = ?');
      const result = stmt.run(id);
      return result.changes;
    });
    
    const changes = transaction();
    
    if (changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    const message = billCount.count > 0 
      ? `Customer deleted successfully. ${billCount.count} bill(s) associated with this customer have been updated.`
      : 'Customer deleted successfully';
    
    res.json({
      success: true,
      message: message
    });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete customer'
    });
  }
};
