import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add any auth tokens here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      console.error('Unauthorized access');
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const apiEndpoints = {
  // Products
  products: {
    getAll: () => api.get('/products'),
    getById: (id: string) => api.get(`/products/${id}`),
    create: (data: any) => api.post('/products', data),
    update: (id: string, data: any) => api.put(`/products/${id}`, data),
    delete: (id: string) => api.delete(`/products/${id}`),
  },
  
  // Customers
  customers: {
    getAll: () => api.get('/customers'),
    getById: (id: string) => api.get(`/customers/${id}`),
    create: (data: any) => api.post('/customers', data),
    update: (id: string, data: any) => api.put(`/customers/${id}`, data),
    delete: (id: string) => api.delete(`/customers/${id}`),
  },
  
  // Bills
  bills: {
    getAll: () => api.get('/bills'),
    getById: (id: string) => api.get(`/bills/${id}`),
    create: (data: any) => api.post('/bills', data),
    updatePayment: (id: string, data: any) => api.patch(`/bills/${id}/payment`, data),
  },
  
  // Invoices
  invoices: {
    getAll: () => api.get('/invoices'),
    getById: (id: string) => api.get(`/invoices/${id}`),
    create: (data: any) => api.post('/invoices', data),
    updatePayment: (id: string, data: any) => api.patch(`/invoices/${id}/payment`, data),
  },
  
  // Inventory
  inventory: {
    getOverview: () => api.get('/inventory/overview'),
    getLowStock: () => api.get('/inventory/low-stock'),
    getTransactions: (params?: any) => api.get('/inventory/transactions', { params }),
    adjustStock: (data: any) => api.post('/inventory/adjust', data),
  },
  
  // Dashboard
  dashboard: {
    getStats: (period?: string) => api.get('/dashboard/stats', { params: { period } }),
    getSalesChart: (period?: string) => api.get('/dashboard/sales-chart', { params: { period } }),
    getPaymentMethods: (period?: string) => api.get('/dashboard/payment-methods', { params: { period } }),
  },
};

export default api;
