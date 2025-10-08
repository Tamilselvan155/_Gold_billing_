// API service wrapper for database operations
// This replaces the mock localStorage implementation with actual API calls

import { apiEndpoints } from '../services/api';

class Database {
  private static instance: Database;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  // Products
  public async getProducts(filters?: any) {
    try {
      const response = await apiEndpoints.products.getAll();
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  }

  public async getProduct(id: string) {
    try {
      const response = await apiEndpoints.products.getById(id);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  }

  public async createProduct(data: any) {
    try {
      const response = await apiEndpoints.products.create(data);
      return response.data.data;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  public async updateProduct(id: string, data: any) {
    try {
      const response = await apiEndpoints.products.update(id, data);
      return response.data.data;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  public async deleteProduct(id: string) {
    try {
      await apiEndpoints.products.delete(id);
      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // Customers
  public async getCustomers(filters?: any) {
    try {
      const response = await apiEndpoints.customers.getAll();
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching customers:', error);
      return [];
    }
  }

  public async getCustomer(id: string) {
    try {
      const response = await apiEndpoints.customers.getById(id);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching customer:', error);
      return null;
    }
  }

  public async createCustomer(data: any) {
    try {
      const response = await apiEndpoints.customers.create(data);
      return response.data.data;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  public async updateCustomer(id: string, data: any) {
    try {
      const response = await apiEndpoints.customers.update(id, data);
      return response.data.data;
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  public async deleteCustomer(id: string) {
    try {
      await apiEndpoints.customers.delete(id);
      return true;
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }

  // Bills
  public async getBills(filters?: any) {
    try {
      const response = await apiEndpoints.bills.getAll();
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching bills:', error);
      return [];
    }
  }

  public async getBill(id: string) {
    try {
      const response = await apiEndpoints.bills.getById(id);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching bill:', error);
      return null;
    }
  }

  public async createBill(data: any) {
    try {
      const response = await apiEndpoints.bills.create(data);
      return response.data.data;
    } catch (error) {
      console.error('Error creating bill:', error);
      throw error;
    }
  }

  public async updateBillPayment(id: string, data: any) {
    try {
      const response = await apiEndpoints.bills.updatePayment(id, data);
      return response.data;
    } catch (error) {
      console.error('Error updating bill payment:', error);
      throw error;
    }
  }

  // Invoices
  public async getInvoices(filters?: any) {
    try {
      const response = await apiEndpoints.invoices.getAll();
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching invoices:', error);
      return [];
    }
  }

  public async getInvoice(id: string) {
    try {
      const response = await apiEndpoints.invoices.getById(id);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching invoice:', error);
      return null;
    }
  }

  public async createInvoice(data: any) {
    try {
      const response = await apiEndpoints.invoices.create(data);
      return response.data.data;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  }

  public async updateInvoicePayment(id: string, data: any) {
    try {
      const response = await apiEndpoints.invoices.updatePayment(id, data);
      return response.data;
    } catch (error) {
      console.error('Error updating invoice payment:', error);
      throw error;
    }
  }

  // Inventory
  public async getInventoryOverview() {
    try {
      const response = await apiEndpoints.inventory.getOverview();
      return response.data.data;
    } catch (error) {
      console.error('Error fetching inventory overview:', error);
      return null;
    }
  }

  public async getLowStockProducts() {
    try {
      const response = await apiEndpoints.inventory.getLowStock();
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching low stock products:', error);
      return [];
    }
  }

  public async getStockTransactions(filters?: any) {
    try {
      const response = await apiEndpoints.inventory.getTransactions(filters);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching stock transactions:', error);
      return [];
    }
  }

  public async adjustStock(data: any) {
    try {
      const response = await apiEndpoints.inventory.adjustStock(data);
      return response.data.data;
    } catch (error) {
      console.error('Error adjusting stock:', error);
      throw error;
    }
  }

  // Dashboard
  public async getDashboardStats(period?: string) {
    try {
      const response = await apiEndpoints.dashboard.getStats(period);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return null;
    }
  }

  public async getSalesChartData(period?: string) {
    try {
      const response = await apiEndpoints.dashboard.getSalesChart(period);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching sales chart data:', error);
      return [];
    }
  }

  public async getPaymentMethodData(period?: string) {
    try {
      const response = await apiEndpoints.dashboard.getPaymentMethods(period);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching payment method data:', error);
      return [];
    }
  }

  // Legacy methods for backward compatibility
  public async query(table: string, conditions?: any) {
    switch (table) {
      case 'products':
        return this.getProducts(conditions);
      case 'customers':
        return this.getCustomers(conditions);
      case 'bills':
        return this.getBills(conditions);
      case 'invoices':
        return this.getInvoices(conditions);
      default:
        return [];
    }
  }

  public async insert(table: string, data: any) {
    switch (table) {
      case 'products':
        return this.createProduct(data);
      case 'customers':
        return this.createCustomer(data);
      case 'bills':
        return this.createBill(data);
      case 'invoices':
        return this.createInvoice(data);
      default:
        throw new Error(`Unknown table: ${table}`);
    }
  }

  public async update(table: string, id: string, data: any) {
    switch (table) {
      case 'products':
        return this.updateProduct(id, data);
      case 'customers':
        return this.updateCustomer(id, data);
      default:
        throw new Error(`Unknown table: ${table}`);
    }
  }

  public async delete(table: string, id: string) {
    switch (table) {
      case 'products':
        return this.deleteProduct(id);
      case 'customers':
        return this.deleteCustomer(id);
      default:
        throw new Error(`Unknown table: ${table}`);
    }
  }
}

export default Database;