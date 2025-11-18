import React, { useState, useEffect } from 'react';
import {
  Store,
  Download,
  Upload,
  Trash2,
  Save,
  FileText,
  AlertTriangle,
  Cloud,
  CheckCircle,
  XCircle,
  Database as DatabaseIcon,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useGoogleLogin } from '@react-oauth/google';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import Database from '../utils/database';
import { apiEndpoints } from '../services/api';

const Settings: React.FC = () => {
  const { t } = useLanguage();
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState('business');
  const [businessInfo, setBusinessInfo] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    gstin: '',
    license: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [exportStats, setExportStats] = useState<{products: number, customers: number, invoices: number, bills: number} | null>(null);
  const [importStats, setImportStats] = useState<{imported: number, total: number, errors: number} | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  
  // Google Drive state
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const tabs = [
    { id: 'business', name: t('settings.businessInfo'), icon: Store },
    { id: 'data', name: t('settings.dataManagement'), icon: Download },
  ];

  // Helper function to clear authentication
  const clearAuth = () => {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('drive_file_id');
    localStorage.removeItem('google_token_expiry');
    setAccessToken(null);
    setIsGoogleAuthenticated(false);
    setDriveFileId(null);
  };

  // Google Drive Authentication
  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      setIsGoogleAuthenticated(true);
      localStorage.setItem('google_access_token', tokenResponse.access_token);
      
      // Store token expiry time (tokens typically expire in 1 hour)
      const expiryTime = Date.now() + (3600 * 1000); // 1 hour from now
      localStorage.setItem('google_token_expiry', expiryTime.toString());
      
      success('Successfully connected to Google Drive!');
    },
    onError: (errorResponse) => {
      console.error('Google OAuth error:', errorResponse);
      const errorMessage = errorResponse?.error || '';
      if (errorMessage.includes('popup_closed') || errorMessage.includes('cancelled')) {
        error('Authentication cancelled. Please try again.');
      } else {
        error('Failed to authenticate with Google Drive. Please ensure http://localhost:5173 is added as Authorized JavaScript origin in Google Cloud Console.');
      }
    },
    scope: 'https://www.googleapis.com/auth/drive.file',
  });

  // Load business information from database
  useEffect(() => {
    const loadBusinessInfo = async () => {
      setIsLoading(true);
      try {
        const db = Database.getInstance();
        const settings = await db.getSettings();
        
        // Map settings keys to businessInfo fields
        setBusinessInfo({
          name: settings.company_name || '',
          address: settings.company_address || '',
          phone: settings.company_phone || '',
          email: settings.company_email || '',
          gstin: settings.gst_number || '',
          license: settings.bis_license || '',
        });
      } catch (err) {
        console.error('Error loading business info:', err);
        error('Failed to load business information');
      } finally {
        setIsLoading(false);
      }
    };

    loadBusinessInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for existing Google authentication on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('google_access_token');
    const storedFileId = localStorage.getItem('drive_file_id');
    const expiryTime = localStorage.getItem('google_token_expiry');
    
    // Check if token is expired
    if (expiryTime && Date.now() > parseInt(expiryTime)) {
      // Token expired, clear it
      clearAuth();
      return;
    }
    
    if (storedToken) {
      setAccessToken(storedToken);
      setIsGoogleAuthenticated(true);
    }
    
    if (storedFileId) {
      setDriveFileId(storedFileId);
    }
  }, []);

  const handleSave = async () => {
    if (!businessInfo.name.trim() || !businessInfo.address.trim() || !businessInfo.phone.trim()) {
      error('Please fill in all required fields (Name, Address, Phone)');
      return;
    }

    setIsSaving(true);
    try {
      const db = Database.getInstance();
      
      // Map businessInfo to settings keys
      const settingsToUpdate: Record<string, string> = {
        company_name: businessInfo.name,
        company_address: businessInfo.address,
        company_phone: businessInfo.phone,
        company_email: businessInfo.email || '',
        gst_number: businessInfo.gstin || '',
        bis_license: businessInfo.license || '',
      };

      await db.updateSettings(settingsToUpdate);
      success(t('settings.settingsSavedSuccessfully'));
    } catch (err) {
      console.error('Error saving business info:', err);
      error('Failed to save business information. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Enhanced Data Export Functions
  const exportAllData = async () => {
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      const db = Database.getInstance();
      
      // Progress: 20%
      setExportProgress(20);
      const [products, customers, invoices, bills] = await Promise.all([
        db.query('products'),
        db.query('customers'),
        db.query('invoices'),
        db.query('bills')
      ]);

      // Progress: 40%
      setExportProgress(40);

      // Separate regular bills from exchange bills
      const regularBills = bills?.filter((bill: any) => {
        const billNumber = bill.bill_number || bill.invoice_number || '';
        return !billNumber.startsWith('EXCH-');
      }) || [];
      
      const exchangeBills = bills?.filter((bill: any) => {
        const billNumber = bill.bill_number || bill.invoice_number || '';
        return billNumber.startsWith('EXCH-');
      }) || [];

      // Progress: 50%
      setExportProgress(50);

      // Create workbook with separate sheets for each data type
      const workbook = XLSX.utils.book_new();

      // ========== SHEET 1: PRODUCTS ==========
      if (products && products.length > 0) {
        const productsData = products.map((product: any) => ({
            'ID': product.id,
          'Product Name': product.name,
          'Category': product.category,
          'SKU': product.sku,
          'Barcode': product.barcode || '',
          'Weight (g)': product.weight,
          'Purity': product.purity,
          'Material Type': product.material_type || '',
          'Making Charge (₹)': product.making_charge,
          'Current Rate (₹/g)': product.current_rate,
          'Stock Quantity': product.stock_quantity,
          'Min Stock Level': product.min_stock_level,
          'Status': product.status,
          'Created At': new Date(product.created_at).toLocaleString('en-IN'),
          'Updated At': new Date(product.updated_at).toLocaleString('en-IN')
        }));
        const productsSheet = XLSX.utils.json_to_sheet(productsData);
        XLSX.utils.book_append_sheet(workbook, productsSheet, 'Products');
      } else {
        const productsSheet = XLSX.utils.json_to_sheet([{ 'Message': 'No products found' }]);
        XLSX.utils.book_append_sheet(workbook, productsSheet, 'Products');
      }

      // Progress: 60%
      setExportProgress(60);

      // ========== SHEET 2: CUSTOMERS ==========
      if (customers && customers.length > 0) {
        const customersData = customers.map((customer: any) => ({
            'ID': customer.id,
          'Name': customer.name,
          'Customer Type': customer.customer_type || 'individual',
          'Phone': customer.phone || '',
          'Email': customer.email || '',
          'Address': customer.address || '',
          'City': customer.city || '',
          'State': customer.state || '',
          'Pincode': customer.pincode || '',
          'GST Number': customer.gst_number || '',
          'Status': customer.status || 'active',
          'Created At': new Date(customer.created_at).toLocaleString('en-IN'),
          'Updated At': new Date(customer.updated_at || customer.created_at).toLocaleString('en-IN')
        }));
        const customersSheet = XLSX.utils.json_to_sheet(customersData);
        XLSX.utils.book_append_sheet(workbook, customersSheet, 'Customers');
      } else {
        const customersSheet = XLSX.utils.json_to_sheet([{ 'Message': 'No customers found' }]);
        XLSX.utils.book_append_sheet(workbook, customersSheet, 'Customers');
      }

      // Progress: 70%
      setExportProgress(70);

      // ========== SHEET 3: INVOICES ==========
      if (invoices && invoices.length > 0) {
        const invoicesData = invoices.map((invoice: any) => ({
            'ID': invoice.id,
          'Invoice Number': invoice.invoice_number,
          'Customer Name': invoice.customer_name,
          'Customer Phone': invoice.customer_phone || '',
          'Subtotal (₹)': invoice.subtotal,
          'Tax %': invoice.tax_percentage,
          'Tax Amount (₹)': invoice.tax_amount,
          'Discount %': invoice.discount_percentage,
          'Discount Amount (₹)': invoice.discount_amount,
          'Total Amount (₹)': invoice.total_amount,
          'Payment Method': invoice.payment_method,
          'Payment Status': invoice.payment_status,
          'Amount Paid (₹)': invoice.amount_paid,
          'Created At': new Date(invoice.created_at).toLocaleString('en-IN'),
          'Updated At': new Date(invoice.updated_at).toLocaleString('en-IN')
        }));
        const invoicesSheet = XLSX.utils.json_to_sheet(invoicesData);
        XLSX.utils.book_append_sheet(workbook, invoicesSheet, 'Invoices');
      } else {
        const invoicesSheet = XLSX.utils.json_to_sheet([{ 'Message': 'No invoices found' }]);
        XLSX.utils.book_append_sheet(workbook, invoicesSheet, 'Invoices');
      }

      // Progress: 80%
      setExportProgress(80);

      // ========== SHEET 4: BILLS ==========
      if (regularBills && regularBills.length > 0) {
        const billsData = regularBills.map((bill: any) => ({
            'ID': bill.id,
          'Bill Number': bill.bill_number || bill.invoice_number,
          'Customer Name': bill.customer_name,
          'Customer Phone': bill.customer_phone || '',
          'Subtotal (₹)': bill.subtotal,
          'Tax %': bill.tax_percentage,
          'Tax Amount (₹)': bill.tax_amount,
          'Discount %': bill.discount_percentage,
          'Discount Amount (₹)': bill.discount_amount,
          'Total Amount (₹)': bill.total_amount,
          'Payment Method': bill.payment_method,
          'Payment Status': bill.payment_status,
          'Amount Paid (₹)': bill.amount_paid,
          'Created At': new Date(bill.created_at).toLocaleString('en-IN'),
          'Updated At': new Date(bill.updated_at).toLocaleString('en-IN')
        }));
        const billsSheet = XLSX.utils.json_to_sheet(billsData);
        XLSX.utils.book_append_sheet(workbook, billsSheet, 'Bills');
      } else {
        const billsSheet = XLSX.utils.json_to_sheet([{ 'Message': 'No bills found' }]);
        XLSX.utils.book_append_sheet(workbook, billsSheet, 'Bills');
      }

      // Progress: 90%
      setExportProgress(90);

      // ========== SHEET 5: EXCHANGE BILLS ==========
      if (exchangeBills && exchangeBills.length > 0) {
        const exchangeBillsData = exchangeBills.map((bill: any) => ({
            'ID': bill.id,
          'Exchange Bill Number': bill.bill_number || bill.invoice_number,
          'Customer Name': bill.customer_name,
          'Customer Phone': bill.customer_phone || '',
          'Old Gold Weight (g)': bill.old_gold_weight || 0,
          'Old Gold Purity': bill.old_gold_purity || '',
          'Old Gold Rate (₹/g)': bill.old_gold_rate || 0,
          'Old Gold Value (₹)': bill.old_gold_value || 0,
          'Exchange Rate (₹/g)': bill.exchange_rate || 0,
          'Exchange Difference (₹)': bill.exchange_difference || 0,
          'Subtotal (₹)': bill.subtotal,
          'Tax %': bill.tax_percentage,
          'Tax Amount (₹)': bill.tax_amount,
          'Discount %': bill.discount_percentage,
          'Discount Amount (₹)': bill.discount_amount,
          'Total Amount (₹)': bill.total_amount,
          'Payment Method': bill.payment_method,
          'Payment Status': bill.payment_status,
          'Amount Paid (₹)': bill.amount_paid,
          'Created At': new Date(bill.created_at).toLocaleString('en-IN'),
          'Updated At': new Date(bill.updated_at).toLocaleString('en-IN')
        }));
        const exchangeBillsSheet = XLSX.utils.json_to_sheet(exchangeBillsData);
        XLSX.utils.book_append_sheet(workbook, exchangeBillsSheet, 'Exchange Bills');
      } else {
        const exchangeBillsSheet = XLSX.utils.json_to_sheet([{ 'Message': 'No exchange bills found' }]);
        XLSX.utils.book_append_sheet(workbook, exchangeBillsSheet, 'Exchange Bills');
      }

      // Progress: 95%
      setExportProgress(95);
        
      // Generate Excel file with proper options
      const excelBuffer = XLSX.write(workbook, { 
        bookType: 'xlsx', 
        type: 'array',
        cellStyles: true,
        compression: true
      });
      const dataBlob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `gold-billing-backup-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
      const totalRecords = (products?.length || 0) + (customers?.length || 0) + 
                          (invoices?.length || 0) + regularBills.length + exchangeBills.length;
      success(`All data exported successfully! ${totalRecords} records across 5 sheets.`);
      
      // Progress: 100%
      setExportProgress(100);
      setLastBackup(new Date().toISOString());
      
      // Set export statistics
      setExportStats({
        products: products?.length || 0,
        customers: customers?.length || 0,
        invoices: invoices?.length || 0,
        bills: regularBills.length + exchangeBills.length
      });
      
    } catch (err) {
      console.error('Export error:', err);
      error('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(0), 2000);
    }
  };

  const exportInvoices = async () => {
    setIsExporting(true);
    try {
      const db = Database.getInstance();
      const invoices = await db.query('invoices');

      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      
      // Invoices sheet
      if (invoices && invoices.length > 0) {
        const invoicesData = invoices.map((invoice: any) => ({
          'ID': invoice.id,
          'Invoice Number': invoice.invoice_number,
          'Customer Name': invoice.customer_name,
          'Customer Phone': invoice.customer_phone || '',
          'Subtotal (₹)': invoice.subtotal,
          'Tax %': invoice.tax_percentage,
          'Tax Amount (₹)': invoice.tax_amount,
          'Discount %': invoice.discount_percentage,
          'Discount Amount (₹)': invoice.discount_amount,
          'Total Amount (₹)': invoice.total_amount,
          'Payment Method': invoice.payment_method,
          'Payment Status': invoice.payment_status,
          'Amount Paid (₹)': invoice.amount_paid,
          'Created At': new Date(invoice.created_at).toLocaleDateString('en-IN'),
          'Updated At': new Date(invoice.updated_at).toLocaleDateString('en-IN')
        }));
        const invoicesSheet = XLSX.utils.json_to_sheet(invoicesData);
        XLSX.utils.book_append_sheet(workbook, invoicesSheet, 'Invoices');
      }

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoices-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      success('Invoices exported to Excel successfully!');
    } catch (err) {
      console.error('Export error:', err);
      error('Failed to export invoices. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportBills = async () => {
    setIsExporting(true);
    try {
      const db = Database.getInstance();
      const bills = await db.query('bills');

      // Filter out exchange bills (bills with bill_number starting with 'EXCH-')
      const regularBills = bills.filter((bill: any) => {
        const billNumber = bill.bill_number || bill.invoice_number || '';
        return !billNumber.startsWith('EXCH-');
      });

      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      
      // Bills sheet
      if (regularBills && regularBills.length > 0) {
        const billsData = regularBills.map((bill: any) => ({
          'ID': bill.id,
          'Bill Number': bill.bill_number || bill.invoice_number,
          'Customer Name': bill.customer_name,
          'Customer Phone': bill.customer_phone || '',
          'Subtotal (₹)': bill.subtotal,
          'Tax %': bill.tax_percentage,
          'Tax Amount (₹)': bill.tax_amount,
          'Discount %': bill.discount_percentage,
          'Discount Amount (₹)': bill.discount_amount,
          'Total Amount (₹)': bill.total_amount,
          'Payment Method': bill.payment_method,
          'Payment Status': bill.payment_status,
          'Amount Paid (₹)': bill.amount_paid,
          'Created At': new Date(bill.created_at).toLocaleDateString('en-IN'),
          'Updated At': new Date(bill.updated_at).toLocaleDateString('en-IN')
        }));
        const billsSheet = XLSX.utils.json_to_sheet(billsData);
        XLSX.utils.book_append_sheet(workbook, billsSheet, 'Bills');
      }

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `bills-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      success('Bills exported to Excel successfully!');
    } catch (err) {
      console.error('Export error:', err);
      error('Failed to export bills. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportExchangeBills = async () => {
    setIsExporting(true);
    try {
      const db = Database.getInstance();
      const bills = await db.query('bills');

      // Filter only exchange bills (bills with bill_number starting with 'EXCH-')
      const exchangeBills = bills.filter((bill: any) => {
        const billNumber = bill.bill_number || bill.invoice_number || '';
        return billNumber.startsWith('EXCH-');
      });

      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      
      // Exchange Bills sheet
      if (exchangeBills && exchangeBills.length > 0) {
        const exchangeBillsData = exchangeBills.map((bill: any) => ({
          'ID': bill.id,
          'Exchange Bill Number': bill.bill_number || bill.invoice_number,
          'Customer Name': bill.customer_name,
          'Customer Phone': bill.customer_phone || '',
          'Old Gold Weight (g)': bill.old_gold_weight || '',
          'Old Gold Purity': bill.old_gold_purity || '',
          'Old Gold Rate (₹/g)': bill.old_gold_rate || '',
          'Old Gold Value (₹)': bill.old_gold_value || '',
          'Exchange Rate (₹/g)': bill.exchange_rate || '',
          'Exchange Difference (₹)': bill.exchange_difference || '',
          'Subtotal (₹)': bill.subtotal,
          'Tax %': bill.tax_percentage,
          'Tax Amount (₹)': bill.tax_amount,
          'Discount %': bill.discount_percentage,
          'Discount Amount (₹)': bill.discount_amount,
          'Total Amount (₹)': bill.total_amount,
          'Payment Method': bill.payment_method,
          'Payment Status': bill.payment_status,
          'Amount Paid (₹)': bill.amount_paid,
          'Created At': new Date(bill.created_at).toLocaleDateString('en-IN'),
          'Updated At': new Date(bill.updated_at).toLocaleDateString('en-IN')
        }));
        const exchangeBillsSheet = XLSX.utils.json_to_sheet(exchangeBillsData);
        XLSX.utils.book_append_sheet(workbook, exchangeBillsSheet, 'Exchange Bills');
      }

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `exchange-bills-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      success('Exchange bills exported to Excel successfully!');
    } catch (err) {
      console.error('Export error:', err);
      error('Failed to export exchange bills. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportCustomers = async () => {
    setIsExporting(true);
    try {
      const db = Database.getInstance();
      const customers = await db.query('customers');

      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      
      if (customers && customers.length > 0) {
        const customersData = customers.map((customer: any) => ({
          'ID': customer.id,
          'Name': customer.name,
          'Phone': customer.phone,
          'Email': customer.email || '',
          'Address': customer.address || '',
          'City': customer.city || '',
          'State': customer.state || '',
          'Pincode': customer.pincode || '',
          'GST Number': customer.gst_number || '',
          'Customer Type': customer.customer_type || 'individual',
          'Status': customer.status || 'active',
          'Created At': new Date(customer.created_at).toLocaleDateString('en-IN'),
          'Updated At': new Date(customer.updated_at).toLocaleDateString('en-IN')
        }));
        const customersSheet = XLSX.utils.json_to_sheet(customersData);
        XLSX.utils.book_append_sheet(workbook, customersSheet, 'Customers');
      }

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `customers-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      success('Customers exported to Excel successfully!');
    } catch (err) {
      console.error('Export error:', err);
      error('Failed to export customers. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportProducts = async () => {
    setIsExporting(true);
    try {
      const db = Database.getInstance();
      const products = await db.query('products');

      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      
      if (products && products.length > 0) {
        const productsData = products.map((product: any) => ({
          'ID': product.id,
          'Name': product.name,
          'Category': product.category,
          'SKU': product.sku,
          'Barcode': product.barcode || '',
          'Weight (g)': product.weight,
          'Purity': product.purity,
          'Making Charge (₹)': product.making_charge,
          'Current Rate (₹/g)': product.current_rate,
          'Stock Quantity': product.stock_quantity,
          'Min Stock Level': product.min_stock_level,
          'Status': product.status,
          'Created At': new Date(product.created_at).toLocaleDateString('en-IN'),
          'Updated At': new Date(product.updated_at).toLocaleDateString('en-IN')
        }));
        const productsSheet = XLSX.utils.json_to_sheet(productsData);
        XLSX.utils.book_append_sheet(workbook, productsSheet, 'Products');
      }

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `products-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      success('Products exported to Excel successfully!');
    } catch (err) {
      console.error('Export error:', err);
      error('Failed to export products. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };


  // Enhanced Data Import Functions
  const handleFileImport = (type: 'products' | 'customers' | 'invoices' | 'bills' | 'exchangeBills' | 'all') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        importData(file, type);
      }
    };
    input.click();
  };

  const importData = async (file: File, type: 'products' | 'customers' | 'invoices' | 'bills' | 'exchangeBills' | 'all') => {
    setIsImporting(true);
    setImportProgress(0);
    
    try {
      const db = Database.getInstance();
      let importData: any = {};

        // Handle Excel file
        setImportProgress(20);
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Convert Excel sheets to JSON - match exact export structure
        const sheetNames = workbook.SheetNames;
        importData = {
          products: [],
          customers: [],
          invoices: [],
          bills: [],
          exchangeBills: []
        };
        
        sheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '',
          blankrows: false
        });
        
          // Skip empty sheets or sheets with only headers
        if (jsonData.length <= 1) return;
        
          // Convert array of arrays to array of objects using exact column headers from export
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as any[][];
        const objects = rows.map((row: any[]) => {
          const obj: any = {};
          headers.forEach((header, index) => {
              if (header && row[index] !== undefined && row[index] !== '') {
              obj[header] = row[index];
            }
          });
          return obj;
          }).filter(obj => Object.keys(obj).length > 0); // Remove empty objects
          
          // Match exact sheet names from export structure
          if (sheetName === 'Products') {
          importData.products = objects;
          } else if (sheetName === 'Customers') {
          importData.customers = objects;
          } else if (sheetName === 'Invoices') {
          importData.invoices = objects;
          } else if (sheetName === 'Bills') {
          importData.bills = objects;
          } else if (sheetName === 'Exchange Bills') {
            importData.exchangeBills = objects;
          }
          // Fallback for case-insensitive matching (for backward compatibility)
          else if (sheetName.toLowerCase() === 'products') {
            importData.products = objects;
          } else if (sheetName.toLowerCase() === 'customers') {
            importData.customers = objects;
          } else if (sheetName.toLowerCase() === 'invoices') {
            importData.invoices = objects;
          } else if (sheetName.toLowerCase() === 'bills') {
            importData.bills = objects;
          } else if (sheetName.toLowerCase() === 'exchange bills') {
            importData.exchangeBills = objects;
          }
        });
        
        setImportProgress(40);

      // Validate and clean data
      setImportProgress(60);
      const cleanedData = validateAndCleanData(importData);
      
      // Import data based on type
      if (type === 'all') {
        let importedCount = 0;
        const totalRecords = (cleanedData.products?.length || 0) + 
                           (cleanedData.customers?.length || 0) + 
                           (cleanedData.invoices?.length || 0) + 
                           (cleanedData.bills?.length || 0);
        
        if (cleanedData.products && cleanedData.products.length > 0) {
          setImportProgress(70);
          for (let i = 0; i < cleanedData.products.length; i++) {
            try {
              await db.insert('products', cleanedData.products[i]);
            importedCount++;
              setImportProgress(70 + (i / cleanedData.products.length) * 10);
            } catch (err) {
              console.error(`Error importing product ${i + 1}:`, err);
            }
          }
        }
        
        if (cleanedData.customers && cleanedData.customers.length > 0) {
          setImportProgress(80);
          for (let i = 0; i < cleanedData.customers.length; i++) {
            try {
              await db.insert('customers', cleanedData.customers[i]);
            importedCount++;
              setImportProgress(80 + (i / cleanedData.customers.length) * 10);
            } catch (err) {
              console.error(`Error importing customer ${i + 1}:`, err);
            }
          }
        }

        // Build customer lookup map (name + phone → id) for linking invoices/bills
        let allCustomersForLookup: any[] = [];
        try {
          allCustomersForLookup = await db.getCustomers();
        } catch (err) {
          console.error('Error fetching customers for invoice/bill import:', err);
        }
        const customerLookup = new Map<string, any>();
        if (Array.isArray(allCustomersForLookup)) {
          for (const c of allCustomersForLookup) {
            const nameKey = (c.name || '').toString().toLowerCase().trim();
            const phoneKey = (c.phone || '').toString().replace(/\s+/g, '');
            if (nameKey || phoneKey) {
              customerLookup.set(`${nameKey}__${phoneKey}`, c);
            }
          }
        }
        
        if (cleanedData.invoices && cleanedData.invoices.length > 0) {
          setImportProgress(90);
          for (let i = 0; i < cleanedData.invoices.length; i++) {
            try {
              // Remove fields that backend doesn't expect
              const { id, ...invoiceData } = cleanedData.invoices[i];

              // Ensure numeric fields
              invoiceData.subtotal = parseFloat(invoiceData.subtotal) || 0;
              invoiceData.tax_percentage = parseFloat(invoiceData.tax_percentage) || 0;
              invoiceData.tax_amount = parseFloat(invoiceData.tax_amount) || 0;
              invoiceData.discount_percentage = parseFloat(invoiceData.discount_percentage) || 0;
              invoiceData.discount_amount = parseFloat(invoiceData.discount_amount) || 0;
              invoiceData.total_amount = parseFloat(invoiceData.total_amount) || 0;
              invoiceData.amount_paid = parseFloat(invoiceData.amount_paid) || 0;

              // Customer name / phone
              if (!invoiceData.customer_name || invoiceData.customer_name.trim() === '') {
                invoiceData.customer_name = 'Unknown Customer';
              }
              if (!invoiceData.customer_phone) {
                invoiceData.customer_phone = '';
              } else {
                invoiceData.customer_phone = invoiceData.customer_phone.toString().trim();
              }

              // Payment method default
              if (!invoiceData.payment_method) {
                invoiceData.payment_method = 'cash';
              }

              // Compute total_amount if needed
              if (!invoiceData.total_amount || invoiceData.total_amount <= 0) {
                const computedTotal =
                  (invoiceData.subtotal || 0) +
                  (invoiceData.tax_amount || 0) -
                  (invoiceData.discount_amount || 0);
                if (computedTotal > 0) {
                  invoiceData.total_amount = computedTotal;
                }
              }

              // Resolve customer_id via lookup (name + phone)
              const nameKey = invoiceData.customer_name.toString().toLowerCase().trim();
              const phoneKey = invoiceData.customer_phone.toString().replace(/\s+/g, '');
              const lookupKey = `${nameKey}__${phoneKey}`;
              let customerMatch = customerLookup.get(lookupKey);

              // If no exact match, try by name only
              if (!customerMatch && nameKey) {
                for (const c of customerLookup.values()) {
                  const cNameKey = (c.name || '').toString().toLowerCase().trim();
                  if (cNameKey === nameKey) {
                    customerMatch = c;
                    break;
                  }
                }
              }

              // If still no match, create a new customer on-the-fly
              if (!customerMatch) {
                try {
                  const newCustomer = await db.insert('customers', {
                    name: invoiceData.customer_name || 'Unknown Customer',
                    phone: invoiceData.customer_phone || `PHONE-${generateId()}`,
                    email: '',
                    address: invoiceData.customer_address || '',
                    customer_type: 'individual',
                    status: 'active'
                  });
                  customerMatch = newCustomer;
                  const newNameKey = (newCustomer.name || '').toString().toLowerCase().trim();
                  const newPhoneKey = (newCustomer.phone || '').toString().replace(/\s+/g, '');
                  customerLookup.set(`${newNameKey}__${newPhoneKey}`, newCustomer);
                } catch (createCustomerErr) {
                  console.error('Failed to create customer for imported invoice:', invoiceData, createCustomerErr);
                }
              }

              if (customerMatch && customerMatch.id != null) {
                invoiceData.customer_id = customerMatch.id;
                if (!invoiceData.customer_phone) {
                  invoiceData.customer_phone = customerMatch.phone || `PHONE-${generateId()}`;
                }
              }

              // Final validation (match backend /api/invoices expectations)
              if (
                !invoiceData.customer_id ||
                !invoiceData.customer_name ||
                !invoiceData.total_amount ||
                !invoiceData.payment_method
              ) {
                console.warn(
                  `Skipping invoice ${i + 1}: missing required fields for /api/invoices`,
                  invoiceData
                );
                continue;
              }

              // Log dates for debugging (first invoice only)
              if (i === 0) {
                console.log('First invoice being imported:', {
                  invoice_number: invoiceData.invoice_number,
                  created_at: invoiceData.created_at,
                  updated_at: invoiceData.updated_at,
                  created_at_type: typeof invoiceData.created_at
                });
              }
              
              await db.insert('invoices', invoiceData);
            importedCount++;
              setImportProgress(90 + (i / cleanedData.invoices.length) * 5);
            } catch (err) {
              console.error(`Error importing invoice ${i + 1}:`, err);
            }
          }
        }
        
        if (cleanedData.bills && cleanedData.bills.length > 0) {
          for (let i = 0; i < cleanedData.bills.length; i++) {
            try {
              // Remove fields that backend doesn't expect
              const { id, ...billData } = cleanedData.bills[i];

              // Ensure numeric fields
              billData.subtotal = parseFloat(billData.subtotal) || 0;
              billData.tax_percentage = parseFloat(billData.tax_percentage) || 0;
              billData.tax_amount = parseFloat(billData.tax_amount) || 0;
              billData.discount_percentage = parseFloat(billData.discount_percentage) || 0;
              billData.discount_amount = parseFloat(billData.discount_amount) || 0;
              billData.total_amount = parseFloat(billData.total_amount) || 0;
              billData.amount_paid = parseFloat(billData.amount_paid) || 0;

              // Customer name / phone
              if (!billData.customer_name || billData.customer_name.trim() === '') {
                billData.customer_name = 'Unknown Customer';
              }
              if (!billData.customer_phone) {
                billData.customer_phone = '';
              }

              // Payment method default
              if (!billData.payment_method) {
                billData.payment_method = 'cash';
              }

              // Compute total_amount if needed
              if (!billData.total_amount || billData.total_amount <= 0) {
                const computedTotal =
                  (billData.subtotal || 0) +
                  (billData.tax_amount || 0) -
                  (billData.discount_amount || 0);
                if (computedTotal > 0) {
                  billData.total_amount = computedTotal;
                }
              }

              // Build payload matching backend /api/bills
              const billPayload: any = {
                invoice_number: billData.bill_number || billData['Bill Number'] || generateBillNumber(),
                customer_id: billData.customer_id || null,
                customer_name: billData.customer_name,
                customer_phone: billData.customer_phone || '',
                customer_address: billData.customer_address || '',
                items: Array.isArray(billData.items) ? billData.items : [],
                subtotal: billData.subtotal || 0,
                tax_percentage: billData.tax_percentage || 0,
                tax_amount: billData.tax_amount || 0,
                discount_percentage: billData.discount_percentage || 0,
                discount_amount: billData.discount_amount || 0,
                total_amount: billData.total_amount || 0,
                payment_method: billData.payment_method,
                payment_status: billData.payment_status || 'pending',
                amount_paid: billData.amount_paid || 0,
                notes: billData.notes || '',
                created_at: billData.created_at,
                updated_at: billData.updated_at
              };

              // Final validation to avoid 400 from backend
              if (
                !billPayload.invoice_number ||
                !billPayload.customer_name ||
                !billPayload.payment_method ||
                !billPayload.total_amount ||
                billPayload.total_amount <= 0
              ) {
                console.warn(
                  `Skipping bill ${i + 1}: missing or invalid required fields for /api/bills`,
                  billPayload
                );
                continue;
              }

              // Log dates for debugging (first bill only)
              if (i === 0) {
                console.log('First bill being imported:', {
                  bill_number: billPayload.invoice_number,
                  created_at: billPayload.created_at,
                  updated_at: billPayload.updated_at,
                  created_at_type: typeof billPayload.created_at
                });
              }
              
              await db.insert('bills', billPayload);
            importedCount++;
            } catch (err: any) {
              const backendError = err?.response?.data?.error || err.message || 'Unknown error';
              console.error(`Error importing bill ${i + 1}:`, backendError, err);
            }
          }
        }
        
        success(`Data import completed! ${importedCount} out of ${totalRecords} records imported successfully.`);
        setImportStats({
          imported: importedCount,
          total: totalRecords,
          errors: totalRecords - importedCount
        });
      } else if (type === 'products') {
        if (cleanedData.products && cleanedData.products.length > 0) {
          setImportProgress(70);
          let successCount = 0;
          for (let i = 0; i < cleanedData.products.length; i++) {
            try {
              await db.insert('products', cleanedData.products[i]);
              successCount++;
              setImportProgress(70 + (i / cleanedData.products.length) * 30);
            } catch (err) {
              console.error(`Error importing product ${i + 1}:`, err);
            }
          }
          success(`${successCount} out of ${cleanedData.products.length} products imported successfully!`);
        } else {
          error('Invalid file format. No products found.');
        }
      } else if (type === 'customers') {
        if (cleanedData.customers && cleanedData.customers.length > 0) {
          setImportProgress(70);
          let successCount = 0;
          for (let i = 0; i < cleanedData.customers.length; i++) {
            try {
              await db.insert('customers', cleanedData.customers[i]);
              successCount++;
              setImportProgress(70 + (i / cleanedData.customers.length) * 30);
            } catch (err) {
              console.error(`Error importing customer ${i + 1}:`, err);
            }
          }
          success(`${successCount} out of ${cleanedData.customers.length} customers imported successfully!`);
        } else {
          error('Invalid file format. No customers found.');
        }
      } else if (type === 'invoices') {
        if (cleanedData.invoices && cleanedData.invoices.length > 0) {
          setImportProgress(70);
          let successCount = 0;

          // Build customer lookup map (name + phone → id)
          let allCustomersForLookup: any[] = [];
          try {
            allCustomersForLookup = await db.getCustomers();
          } catch (err) {
            console.error('Error fetching customers for invoice import:', err);
          }
          const customerLookup = new Map<string, any>();
          if (Array.isArray(allCustomersForLookup)) {
            for (const c of allCustomersForLookup) {
              const nameKey = (c.name || '').toString().toLowerCase().trim();
              const phoneKey = (c.phone || '').toString().replace(/\s+/g, '');
              if (nameKey || phoneKey) {
                customerLookup.set(`${nameKey}__${phoneKey}`, c);
              }
            }
          }

          for (let i = 0; i < cleanedData.invoices.length; i++) {
            try {
              // Remove fields that backend doesn't expect
              const { id, ...invoiceData } = cleanedData.invoices[i];

              // Ensure numeric fields
              invoiceData.subtotal = parseFloat(invoiceData.subtotal) || 0;
              invoiceData.tax_percentage = parseFloat(invoiceData.tax_percentage) || 0;
              invoiceData.tax_amount = parseFloat(invoiceData.tax_amount) || 0;
              invoiceData.discount_percentage = parseFloat(invoiceData.discount_percentage) || 0;
              invoiceData.discount_amount = parseFloat(invoiceData.discount_amount) || 0;
              invoiceData.total_amount = parseFloat(invoiceData.total_amount) || 0;
              invoiceData.amount_paid = parseFloat(invoiceData.amount_paid) || 0;

              // Customer name / phone
              if (!invoiceData.customer_name || invoiceData.customer_name.trim() === '') {
                invoiceData.customer_name = 'Unknown Customer';
              }
              if (!invoiceData.customer_phone) {
                invoiceData.customer_phone = '';
              } else {
                invoiceData.customer_phone = invoiceData.customer_phone.toString().trim();
              }

              // Payment method default
              if (!invoiceData.payment_method) {
                invoiceData.payment_method = 'cash';
              }

              // Compute total_amount if needed
              if (!invoiceData.total_amount || invoiceData.total_amount <= 0) {
                const computedTotal =
                  (invoiceData.subtotal || 0) +
                  (invoiceData.tax_amount || 0) -
                  (invoiceData.discount_amount || 0);
                if (computedTotal > 0) {
                  invoiceData.total_amount = computedTotal;
                }
              }

              // Resolve customer_id via lookup (name + phone)
              const nameKey = invoiceData.customer_name.toString().toLowerCase().trim();
              const phoneKey = invoiceData.customer_phone.toString().replace(/\s+/g, '');
              const lookupKey = `${nameKey}__${phoneKey}`;
              let customerMatch = customerLookup.get(lookupKey);

              // If no exact match, try by name only
              if (!customerMatch && nameKey) {
                for (const c of customerLookup.values()) {
                  const cNameKey = (c.name || '').toString().toLowerCase().trim();
                  if (cNameKey === nameKey) {
                    customerMatch = c;
                    break;
                  }
                }
              }

              // If still no match, create a new customer on-the-fly
              if (!customerMatch) {
                try {
                  const newCustomer = await db.insert('customers', {
                    name: invoiceData.customer_name || 'Unknown Customer',
                    phone: invoiceData.customer_phone || `PHONE-${generateId()}`,
                    email: '',
                    address: invoiceData.customer_address || '',
                    customer_type: 'individual',
                    status: 'active'
                  });
                  customerMatch = newCustomer;
                  const newNameKey = (newCustomer.name || '').toString().toLowerCase().trim();
                  const newPhoneKey = (newCustomer.phone || '').toString().replace(/\s+/g, '');
                  customerLookup.set(`${newNameKey}__${newPhoneKey}`, newCustomer);
                } catch (createCustomerErr) {
                  console.error('Failed to create customer for imported invoice:', invoiceData, createCustomerErr);
                }
              }

              if (customerMatch && customerMatch.id != null) {
                invoiceData.customer_id = customerMatch.id;
                if (!invoiceData.customer_phone) {
                  invoiceData.customer_phone = customerMatch.phone || `PHONE-${generateId()}`;
                }
              }

              // Final validation (match backend /api/invoices expectations)
              if (
                !invoiceData.customer_id ||
                !invoiceData.customer_name ||
                !invoiceData.total_amount ||
                !invoiceData.payment_method
              ) {
                console.warn(
                  `Skipping invoice ${i + 1}: missing required fields for /api/invoices`,
                  invoiceData
                );
                continue;
              }

              await db.insert('invoices', invoiceData);
              successCount++;
              setImportProgress(70 + (i / cleanedData.invoices.length) * 30);
            } catch (err) {
              console.error(`Error importing invoice ${i + 1}:`, err);
            }
          }
          success(`${successCount} out of ${cleanedData.invoices.length} invoices imported successfully!`);
        } else {
          error('Invalid file format. No invoices found.');
        }
      } else if (type === 'bills') {
        // Import only regular bills (not exchange bills)
        const regularBills = cleanedData.bills?.filter((bill: any) => {
          const billNumber = bill.bill_number || bill['Bill Number'] || '';
          return !billNumber.startsWith('EXCH-');
        }) || [];
        
        if (regularBills.length > 0) {
          setImportProgress(70);
          let successCount = 0;
          for (let i = 0; i < regularBills.length; i++) {
            try {
              // Remove fields that backend doesn't expect
              const { id, ...billData } = regularBills[i];

              // Ensure numeric fields
              billData.subtotal = parseFloat(billData.subtotal) || 0;
              billData.tax_percentage = parseFloat(billData.tax_percentage) || 0;
              billData.tax_amount = parseFloat(billData.tax_amount) || 0;
              billData.discount_percentage = parseFloat(billData.discount_percentage) || 0;
              billData.discount_amount = parseFloat(billData.discount_amount) || 0;
              billData.total_amount = parseFloat(billData.total_amount) || 0;
              billData.amount_paid = parseFloat(billData.amount_paid) || 0;

              // Customer name / phone
              if (!billData.customer_name || billData.customer_name.trim() === '') {
                billData.customer_name = 'Unknown Customer';
              }
              if (!billData.customer_phone) {
                billData.customer_phone = '';
              }

              // Payment method default
              if (!billData.payment_method) {
                billData.payment_method = 'cash';
              }

              // Compute total_amount if needed
              if (!billData.total_amount || billData.total_amount <= 0) {
                const computedTotal =
                  (billData.subtotal || 0) +
                  (billData.tax_amount || 0) -
                  (billData.discount_amount || 0);
                if (computedTotal > 0) {
                  billData.total_amount = computedTotal;
                }
              }

              // Build payload matching backend /api/bills
              const billPayload: any = {
                invoice_number: billData.bill_number || billData['Bill Number'] || generateBillNumber(),
                customer_id: billData.customer_id || null,
                customer_name: billData.customer_name,
                customer_phone: billData.customer_phone || '',
                customer_address: billData.customer_address || '',
                items: Array.isArray(billData.items) ? billData.items : [],
                subtotal: billData.subtotal || 0,
                tax_percentage: billData.tax_percentage || 0,
                tax_amount: billData.tax_amount || 0,
                discount_percentage: billData.discount_percentage || 0,
                discount_amount: billData.discount_amount || 0,
                total_amount: billData.total_amount || 0,
                payment_method: billData.payment_method,
                payment_status: billData.payment_status || 'pending',
                amount_paid: billData.amount_paid || 0,
                notes: billData.notes || '',
                created_at: billData.created_at,
                updated_at: billData.updated_at
              };

              // Final validation to avoid 400 from backend
              if (
                !billPayload.invoice_number ||
                !billPayload.customer_name ||
                !billPayload.total_amount ||
                !billPayload.payment_method ||
                !billPayload.items
              ) {
                console.error(
                  `Skipping bill ${i + 1}: missing required fields`,
                  billPayload
                );
                continue;
              }

              await db.insert('bills', billPayload);
              successCount++;
              setImportProgress(70 + (i / regularBills.length) * 30);
            } catch (err) {
              console.error(`Error importing bill ${i + 1}:`, err);
            }
          }
          success(`${successCount} out of ${regularBills.length} bills imported successfully!`);
        } else {
          error('Invalid file format. No bills found.');
        }
      } else if (type === 'exchangeBills') {
        // Import only exchange bills
        const exchangeBills = cleanedData.exchangeBills || 
          (cleanedData.bills?.filter((bill: any) => {
            const billNumber = bill.bill_number || bill['Exchange Bill Number'] || '';
            return billNumber.startsWith('EXCH-');
          }) || []);
        
        if (exchangeBills.length > 0) {
          setImportProgress(70);
          let successCount = 0;
          for (let i = 0; i < exchangeBills.length; i++) {
            try {
              // Remove fields that backend doesn't expect
              const { id, ...billData } = exchangeBills[i];

              // Ensure bill_number starts with EXCH-
              if (!billData.bill_number?.startsWith('EXCH-')) {
                billData.bill_number = `EXCH-${billData.bill_number || generateBillNumber()}`;
              }

              // Ensure numeric fields
              billData.subtotal = parseFloat(billData.subtotal) || 0;
              billData.tax_percentage = parseFloat(billData.tax_percentage) || 0;
              billData.tax_amount = parseFloat(billData.tax_amount) || 0;
              billData.discount_percentage = parseFloat(billData.discount_percentage) || 0;
              billData.discount_amount = parseFloat(billData.discount_amount) || 0;
              billData.total_amount = parseFloat(billData.total_amount) || 0;
              billData.amount_paid = parseFloat(billData.amount_paid) || 0;

              // Customer name / phone
              if (!billData.customer_name || billData.customer_name.trim() === '') {
                billData.customer_name = 'Unknown Customer';
              }
              if (!billData.customer_phone) {
                billData.customer_phone = '';
              }

              // Payment method default
              if (!billData.payment_method) {
                billData.payment_method = 'cash';
              }

              // Compute total_amount if needed
              if (!billData.total_amount || billData.total_amount <= 0) {
                const computedTotal =
                  (billData.subtotal || 0) +
                  (billData.tax_amount || 0) -
                  (billData.discount_amount || 0);
                if (computedTotal > 0) {
                  billData.total_amount = computedTotal;
                }
              }

              // Build payload matching backend /api/bills
              const billPayload: any = {
                invoice_number: billData.bill_number || billData['Exchange Bill Number'] || generateBillNumber(),
                customer_id: billData.customer_id || null,
                customer_name: billData.customer_name,
                customer_phone: billData.customer_phone || '',
                customer_address: billData.customer_address || '',
                items: Array.isArray(billData.items) ? billData.items : [],
                subtotal: billData.subtotal || 0,
                tax_percentage: billData.tax_percentage || 0,
                tax_amount: billData.tax_amount || 0,
                discount_percentage: billData.discount_percentage || 0,
                discount_amount: billData.discount_amount || 0,
                total_amount: billData.total_amount || 0,
                payment_method: billData.payment_method,
                payment_status: billData.payment_status || 'pending',
                amount_paid: billData.amount_paid || 0,
                notes: billData.notes || '',
                created_at: billData.created_at,
                updated_at: billData.updated_at
              };

              // Final validation
              if (
                !billPayload.invoice_number ||
                !billPayload.customer_name ||
                !billPayload.total_amount ||
                !billPayload.payment_method
              ) {
                console.warn(
                  `Skipping exchange bill ${i + 1}: missing required fields`,
                  billPayload
                );
                continue;
              }

              await db.insert('bills', billPayload);
              successCount++;
              setImportProgress(70 + (i / exchangeBills.length) * 30);
            } catch (err) {
              console.error(`Error importing exchange bill ${i + 1}:`, err);
            }
          }
          success(`${successCount} out of ${exchangeBills.length} exchange bills imported successfully!`);
        } else {
          error('Invalid file format. No exchange bills found.');
        }
      }
      
      // Update business info if available
      if (cleanedData.business_info) {
        setBusinessInfo(prev => ({
          ...prev,
          ...cleanedData.business_info
        }));
      }
      
      setImportProgress(100);
      
    } catch (err) {
      console.error('Import error:', err);
      if (err instanceof Error) {
        error(`Import failed: ${err.message}`);
      } else {
      error('Failed to import data. Please check the file format and try again.');
      }
    } finally {
      setIsImporting(false);
      setTimeout(() => setImportProgress(0), 2000);
    }
  };

  // Data validation and cleaning function
  // Helper to safely parse dates coming from Excel/JSON into ISO strings
  const parseExcelDate = (value: any, fallback?: string): string => {
    if (!value && fallback) return fallback;
    if (!value) {
      console.warn('parseExcelDate: No value provided, using current date');
      return new Date().toISOString();
    }

    // If already a Date
    if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        console.warn('parseExcelDate: Invalid Date object, using fallback');
        return fallback || new Date().toISOString();
      }
      return value.toISOString();
    }

    // If numeric (Excel serial date)
    if (typeof value === 'number' && !isNaN(value)) {
      // Excel serial date (days since 1899-12-30)
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const ms = value * 24 * 60 * 60 * 1000;
      const dateFromSerial = new Date(excelEpoch.getTime() + ms);
      if (!isNaN(dateFromSerial.getTime())) {
        return dateFromSerial.toISOString();
      }
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        console.warn('parseExcelDate: Empty string, using fallback');
        return fallback || new Date().toISOString();
      }

      // Try native Date parsing first
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed)) {
        const result = new Date(parsed).toISOString();
        return result;
      }

      // Try to parse common en-IN format: DD/MM/YYYY, HH:MM:SS am/pm
      const match = trimmed.match(
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:,\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i
      );
      if (match) {
        const [, dStr, mStr, yStr, hStr, minStr, sStr, ampm] = match;
        let day = parseInt(dStr, 10);
        let month = parseInt(mStr, 10) - 1; // JS months 0-11
        const year = parseInt(yStr, 10);
        let hours = hStr ? parseInt(hStr, 10) : 0;
        const minutes = minStr ? parseInt(minStr, 10) : 0;
        const seconds = sStr ? parseInt(sStr, 10) : 0;

        if (ampm) {
          const isPM = ampm.toLowerCase() === 'pm';
          if (isPM && hours < 12) hours += 12;
          if (!isPM && hours === 12) hours = 0;
        }

        const date = new Date(year, month, day, hours, minutes, seconds);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        } else {
          console.warn('parseExcelDate: Failed to create date from match:', { dStr, mStr, yStr, hStr, minStr, sStr, ampm });
        }
      } else {
        console.warn('parseExcelDate: Could not parse date string:', trimmed);
      }
    }

    // Fallback
    console.warn('parseExcelDate: Using fallback for value:', value);
    return fallback || new Date().toISOString();
  };

  const validateAndCleanData = (data: any) => {
    const cleaned: any = {};
    
    if (data.products && Array.isArray(data.products)) {
      cleaned.products = data.products.map((product: any) => {
        // Handle Excel column mapping - check for both export format and direct format
        const mappedProduct = {
          id: product.ID || product.id || generateId(),
          name: product['Product Name'] || product.Name || product.name || '',
          category: product.Category || product.category || 'Chains',
          sku: product.SKU || product.sku || generateId(),
          barcode: product.Barcode || product.barcode || '',
          weight: parseFloat(product['Weight (g)'] || product.weight || 0) || 0,
          purity: product.Purity || product.purity || '22K',
          material_type: product['Material Type'] || product.material_type || 'Gold',
          making_charge: parseFloat(product['Making Charge (₹)'] || product.making_charge || 0) || 0,
          current_rate: parseFloat(product['Current Rate (₹/g)'] || product.current_rate || 0) || 0,
          stock_quantity: parseInt(product['Stock Quantity'] || product.stock_quantity || 0) || 0,
          min_stock_level: parseInt(product['Min Stock Level'] || product.min_stock_level || 1) || 1,
          status: (product.Status || product.status || 'active').toLowerCase(),
          created_at: product['Created At'] || product.created_at || new Date().toISOString(),
          updated_at: product['Updated At'] || product.updated_at || new Date().toISOString()
        };
        
        // Validate required fields - skip rows with "No products found" or empty name
        if (!mappedProduct.name || mappedProduct.name === 'No products found' || !mappedProduct.sku) {
          // If name is missing but we have other data, generate a name
          if (!mappedProduct.name || mappedProduct.name === 'No products found') {
            if (mappedProduct.sku) {
              mappedProduct.name = `Product ${mappedProduct.sku}`;
            } else {
              // Skip this product if both name and SKU are missing
              return null;
            }
          }
          // If SKU is missing but we have a name, generate SKU
          if (!mappedProduct.sku) {
            mappedProduct.sku = generateId();
          }
        }
        
        return mappedProduct;
      }).filter((product: any) => product !== null); // Remove null entries
    }
    
    if (data.customers && Array.isArray(data.customers)) {
      cleaned.customers = data.customers.map((customer: any) => {
        const mappedCustomer = {
          id: customer.ID || customer.id || generateId(),
          name: customer.Name || customer.name || '',
          phone: customer.Phone || customer.phone || '',
          email: customer.Email || customer.email || '',
          address: customer.Address || customer.address || '',
          city: customer.City || customer.city || '',
          state: customer.State || customer.state || '',
          pincode: customer.Pincode || customer.pincode || '',
          gst_number: customer['GST Number'] || customer.gst_number || '',
          customer_type: customer['Customer Type'] || customer.customer_type || 'individual',
          status: (customer.Status || customer.status || 'active').toLowerCase(),
          created_at: customer['Created At'] || customer.created_at || new Date().toISOString(),
          updated_at: customer['Updated At'] || customer.updated_at || customer['Created At'] || customer.created_at || new Date().toISOString()
        };
        
        // Validate required fields - skip rows with "No customers found" or empty name
        if (!mappedCustomer.name || mappedCustomer.name === 'No customers found' || !mappedCustomer.phone) {
          // Skip this customer if both name and phone are missing
          if ((!mappedCustomer.name || mappedCustomer.name === 'No customers found') && !mappedCustomer.phone) {
            return null;
          }
          // Generate defaults if missing
          if (!mappedCustomer.name || mappedCustomer.name === 'No customers found') {
            mappedCustomer.name = mappedCustomer.phone ? `Customer ${mappedCustomer.phone}` : 'Unknown Customer';
          }
          if (!mappedCustomer.phone) {
            mappedCustomer.phone = `PHONE-${generateId()}`;
          }
        }
        
        return mappedCustomer;
      }).filter((customer: any) => customer !== null); // Remove null entries
    }
    
    if (data.invoices && Array.isArray(data.invoices)) {
      cleaned.invoices = data.invoices.map((invoice: any) => {
        const rawCreatedAt = invoice['Created At'] || invoice.created_at;
        const rawUpdatedAt = invoice['Updated At'] || invoice.updated_at || rawCreatedAt;

        const mappedInvoice = {
          id: invoice.ID || invoice.id || generateId(),
          invoice_number: invoice['Invoice Number'] || invoice.invoice_number || generateInvoiceNumber(),
          customer_name: invoice['Customer Name'] || invoice.customer_name || '',
          customer_phone: invoice['Customer Phone'] || invoice.customer_phone || '',
          subtotal: parseFloat(invoice['Subtotal (₹)'] || invoice.subtotal || 0) || 0,
          tax_percentage: parseFloat(invoice['Tax %'] || invoice.tax_percentage || 0) || 0,
          tax_amount: parseFloat(invoice['Tax Amount (₹)'] || invoice.tax_amount || 0) || 0,
          discount_percentage: parseFloat(invoice['Discount %'] || invoice.discount_percentage || 0) || 0,
          discount_amount: parseFloat(invoice['Discount Amount (₹)'] || invoice.discount_amount || 0) || 0,
          total_amount: parseFloat(invoice['Total Amount (₹)'] || invoice.total_amount || 0) || 0,
          payment_method: (invoice['Payment Method'] || invoice.payment_method || 'cash').toLowerCase(),
          payment_status: (invoice['Payment Status'] || invoice.payment_status || 'pending').toLowerCase(),
          amount_paid: parseFloat(invoice['Amount Paid (₹)'] || invoice.amount_paid || 0) || 0,
          items: invoice.items || [],
          created_at: parseExcelDate(rawCreatedAt),
          updated_at: parseExcelDate(rawUpdatedAt, parseExcelDate(rawCreatedAt))
        };
        
        // Validate required fields - skip rows with "No invoices found"
        if (!mappedInvoice.invoice_number || mappedInvoice.invoice_number === 'No invoices found' || !mappedInvoice.customer_name) {
          // Skip this invoice if both invoice_number and customer_name are missing
          if ((!mappedInvoice.invoice_number || mappedInvoice.invoice_number === 'No invoices found') && !mappedInvoice.customer_name) {
            return null;
          }
          // Generate defaults if missing
          if (!mappedInvoice.invoice_number || mappedInvoice.invoice_number === 'No invoices found') {
            mappedInvoice.invoice_number = generateInvoiceNumber();
          }
          if (!mappedInvoice.customer_name) {
            mappedInvoice.customer_name = 'Unknown Customer';
          }
        }
        
        return mappedInvoice;
      }).filter((invoice: any) => invoice !== null); // Remove null entries
    }
    
    if (data.bills && Array.isArray(data.bills)) {
      cleaned.bills = data.bills.map((bill: any) => {
        const rawCreatedAt = bill['Created At'] || bill.created_at;
        const rawUpdatedAt = bill['Updated At'] || bill.updated_at || rawCreatedAt;

        const mappedBill = {
          id: bill.ID || bill.id || generateId(),
          bill_number: bill['Bill Number'] || bill.bill_number || generateBillNumber(),
          customer_name: bill['Customer Name'] || bill.customer_name || '',
          customer_phone: bill['Customer Phone'] || bill.customer_phone || '',
          subtotal: parseFloat(bill['Subtotal (₹)'] || bill.subtotal || 0) || 0,
          tax_percentage: parseFloat(bill['Tax %'] || bill.tax_percentage || 0) || 0,
          tax_amount: parseFloat(bill['Tax Amount (₹)'] || bill.tax_amount || 0) || 0,
          discount_percentage: parseFloat(bill['Discount %'] || bill.discount_percentage || 0) || 0,
          discount_amount: parseFloat(bill['Discount Amount (₹)'] || bill.discount_amount || 0) || 0,
          total_amount: parseFloat(bill['Total Amount (₹)'] || bill.total_amount || 0) || 0,
          payment_method: (bill['Payment Method'] || bill.payment_method || 'cash').toLowerCase(),
          payment_status: (bill['Payment Status'] || bill.payment_status || 'pending').toLowerCase(),
          amount_paid: parseFloat(bill['Amount Paid (₹)'] || bill.amount_paid || 0) || 0,
          items: bill.items || [],
          created_at: parseExcelDate(rawCreatedAt),
          updated_at: parseExcelDate(rawUpdatedAt, parseExcelDate(rawCreatedAt))
        };
        
        // Validate required fields - skip rows with "No bills found"
        if (!mappedBill.bill_number || mappedBill.bill_number === 'No bills found' || !mappedBill.customer_name) {
          // Skip this bill if both bill_number and customer_name are missing
          if ((!mappedBill.bill_number || mappedBill.bill_number === 'No bills found') && !mappedBill.customer_name) {
            return null;
          }
          // Generate defaults if missing
          if (!mappedBill.bill_number || mappedBill.bill_number === 'No bills found') {
            mappedBill.bill_number = generateBillNumber();
          }
          if (!mappedBill.customer_name) {
            mappedBill.customer_name = 'Unknown Customer';
          }
        }
        
        return mappedBill;
      }).filter((bill: any) => bill !== null); // Remove null entries
    }

    // Handle Exchange Bills (separate from regular bills)
    if (data.exchangeBills && Array.isArray(data.exchangeBills)) {
      cleaned.exchangeBills = data.exchangeBills.map((bill: any) => {
        const rawCreatedAt = bill['Created At'] || bill.created_at;
        const rawUpdatedAt = bill['Updated At'] || bill.updated_at || rawCreatedAt;
        
        const mappedBill = {
          id: bill.ID || bill.id || generateId(),
          bill_number: bill['Exchange Bill Number'] || bill.bill_number || `EXCH-${generateBillNumber()}`,
          customer_name: bill['Customer Name'] || bill.customer_name || '',
          customer_phone: bill['Customer Phone'] || bill.customer_phone || '',
          old_gold_weight: parseFloat(bill['Old Gold Weight (g)'] || bill.old_gold_weight || 0) || 0,
          old_gold_purity: bill['Old Gold Purity'] || bill.old_gold_purity || '',
          old_gold_rate: parseFloat(bill['Old Gold Rate (₹/g)'] || bill.old_gold_rate || 0) || 0,
          old_gold_value: parseFloat(bill['Old Gold Value (₹)'] || bill.old_gold_value || 0) || 0,
          exchange_rate: parseFloat(bill['Exchange Rate (₹/g)'] || bill.exchange_rate || 0) || 0,
          exchange_difference: parseFloat(bill['Exchange Difference (₹)'] || bill.exchange_difference || 0) || 0,
          subtotal: parseFloat(bill['Subtotal (₹)'] || bill.subtotal || 0) || 0,
          tax_percentage: parseFloat(bill['Tax %'] || bill.tax_percentage || 0) || 0,
          tax_amount: parseFloat(bill['Tax Amount (₹)'] || bill.tax_amount || 0) || 0,
          discount_percentage: parseFloat(bill['Discount %'] || bill.discount_percentage || 0) || 0,
          discount_amount: parseFloat(bill['Discount Amount (₹)'] || bill.discount_amount || 0) || 0,
          total_amount: parseFloat(bill['Total Amount (₹)'] || bill.total_amount || 0) || 0,
          payment_method: (bill['Payment Method'] || bill.payment_method || 'cash').toLowerCase(),
          payment_status: (bill['Payment Status'] || bill.payment_status || 'pending').toLowerCase(),
          amount_paid: parseFloat(bill['Amount Paid (₹)'] || bill.amount_paid || 0) || 0,
          items: bill.items || [],
          created_at: parseExcelDate(rawCreatedAt),
          updated_at: parseExcelDate(rawUpdatedAt, parseExcelDate(rawCreatedAt))
        };
        
        // Ensure bill_number starts with EXCH-
        if (!mappedBill.bill_number.startsWith('EXCH-')) {
          mappedBill.bill_number = `EXCH-${mappedBill.bill_number}`;
        }
        
        // Validate required fields - skip rows with "No exchange bills found"
        if (!mappedBill.bill_number || mappedBill.bill_number === 'EXCH-No exchange bills found' || !mappedBill.customer_name) {
          // Skip this bill if both bill_number and customer_name are missing
          if ((!mappedBill.bill_number || mappedBill.bill_number === 'EXCH-No exchange bills found') && !mappedBill.customer_name) {
            return null;
          }
          // Generate defaults if missing
          if (!mappedBill.bill_number || mappedBill.bill_number === 'EXCH-No exchange bills found') {
            mappedBill.bill_number = `EXCH-${generateBillNumber()}`;
          }
          if (!mappedBill.customer_name) {
            mappedBill.customer_name = 'Unknown Customer';
          }
        }
        
        return mappedBill;
      }).filter((bill: any) => bill !== null); // Remove null entries
      
      // Merge exchange bills into bills array for import
      if (!cleaned.bills) {
        cleaned.bills = [];
      }
      cleaned.bills = [...(cleaned.bills || []), ...cleaned.exchangeBills];
    }
    
    // Handle business info
    if (data.business_info) {
      cleaned.business_info = data.business_info;
    }
    
    return cleaned;
  };

  // Helper functions
  const generateId = () => `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const generateInvoiceNumber = () => `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const generateBillNumber = () => `BILL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  // Helper function to create Excel workbook (reused from exportAllData)
  const createExcelWorkbook = async () => {
    try {
      const db = Database.getInstance();
      
      if (!db) {
        throw new Error('Database instance is not available');
      }

      const [products, customers, invoices, bills] = await Promise.all([
        db.query('products').catch(err => {
          console.error('Error querying products:', err);
          return [];
        }),
        db.query('customers').catch(err => {
          console.error('Error querying customers:', err);
          return [];
        }),
        db.query('invoices').catch(err => {
          console.error('Error querying invoices:', err);
          return [];
        }),
        db.query('bills').catch(err => {
          console.error('Error querying bills:', err);
          return [];
        })
      ]);

      // Ensure we have arrays
      const productsArray = Array.isArray(products) ? products : [];
      const customersArray = Array.isArray(customers) ? customers : [];
      const invoicesArray = Array.isArray(invoices) ? invoices : [];
      const billsArray = Array.isArray(bills) ? bills : [];

      // Separate regular bills from exchange bills
      const regularBills = billsArray.filter((bill: any) => {
        const billNumber = bill?.bill_number || bill?.invoice_number || '';
        return !billNumber.startsWith('EXCH-');
      });
      
      const exchangeBills = billsArray.filter((bill: any) => {
        const billNumber = bill?.bill_number || bill?.invoice_number || '';
        return billNumber.startsWith('EXCH-');
      });

      const workbook = XLSX.utils.book_new();

      // Products sheet
      if (productsArray.length > 0) {
        const productsData = productsArray.map((product: any) => ({
          'ID': product.id || '',
          'Product Name': product.name || '',
          'Category': product.category || '',
          'SKU': product.sku || '',
          'Barcode': product.barcode || '',
          'Weight (g)': product.weight || 0,
          'Purity': product.purity || '',
          'Material Type': product.material_type || '',
          'Making Charge (₹)': product.making_charge || 0,
          'Current Rate (₹/g)': product.current_rate || 0,
          'Stock Quantity': product.stock_quantity || 0,
          'Min Stock Level': product.min_stock_level || 0,
          'Status': product.status || 'active',
          'Created At': product.created_at ? new Date(product.created_at).toLocaleString('en-IN') : '',
          'Updated At': product.updated_at ? new Date(product.updated_at).toLocaleString('en-IN') : ''
        }));
        const productsSheet = XLSX.utils.json_to_sheet(productsData);
        XLSX.utils.book_append_sheet(workbook, productsSheet, 'Products');
      } else {
        // Add empty sheet with headers
        const productsSheet = XLSX.utils.json_to_sheet([{
          'ID': '',
          'Product Name': 'No products found',
          'Category': '',
          'SKU': '',
          'Barcode': '',
          'Weight (g)': '',
          'Purity': '',
          'Material Type': '',
          'Making Charge (₹)': '',
          'Current Rate (₹/g)': '',
          'Stock Quantity': '',
          'Min Stock Level': '',
          'Status': '',
          'Created At': '',
          'Updated At': ''
        }]);
        XLSX.utils.book_append_sheet(workbook, productsSheet, 'Products');
      }

      // Customers sheet
      if (customersArray.length > 0) {
        const customersData = customersArray.map((customer: any) => ({
          'ID': customer.id || '',
          'Name': customer.name || '',
          'Customer Type': customer.customer_type || 'individual',
          'Phone': customer.phone || '',
          'Email': customer.email || '',
          'Address': customer.address || '',
          'City': customer.city || '',
          'State': customer.state || '',
          'Pincode': customer.pincode || '',
          'GST Number': customer.gst_number || '',
          'Status': customer.status || 'active',
          'Created At': customer.created_at ? new Date(customer.created_at).toLocaleString('en-IN') : '',
          'Updated At': (customer.updated_at || customer.created_at) ? new Date(customer.updated_at || customer.created_at).toLocaleString('en-IN') : ''
        }));
        const customersSheet = XLSX.utils.json_to_sheet(customersData);
        XLSX.utils.book_append_sheet(workbook, customersSheet, 'Customers');
      } else {
        const customersSheet = XLSX.utils.json_to_sheet([{
          'ID': '',
          'Name': 'No customers found',
          'Customer Type': '',
          'Phone': '',
          'Email': '',
          'Address': '',
          'City': '',
          'State': '',
          'Pincode': '',
          'GST Number': '',
          'Status': '',
          'Created At': '',
          'Updated At': ''
        }]);
        XLSX.utils.book_append_sheet(workbook, customersSheet, 'Customers');
      }

      // Invoices sheet
      if (invoicesArray.length > 0) {
        const invoicesData = invoicesArray.map((invoice: any) => ({
          'ID': invoice.id || '',
          'Invoice Number': invoice.invoice_number || '',
          'Customer Name': invoice.customer_name || '',
          'Customer Phone': invoice.customer_phone || '',
          'Subtotal (₹)': invoice.subtotal || 0,
          'Tax %': invoice.tax_percentage || 0,
          'Tax Amount (₹)': invoice.tax_amount || 0,
          'Discount %': invoice.discount_percentage || 0,
          'Discount Amount (₹)': invoice.discount_amount || 0,
          'Total Amount (₹)': invoice.total_amount || 0,
          'Payment Method': invoice.payment_method || '',
          'Payment Status': invoice.payment_status || '',
          'Amount Paid (₹)': invoice.amount_paid || 0,
          'Created At': invoice.created_at ? new Date(invoice.created_at).toLocaleString('en-IN') : '',
          'Updated At': invoice.updated_at ? new Date(invoice.updated_at).toLocaleString('en-IN') : ''
        }));
        const invoicesSheet = XLSX.utils.json_to_sheet(invoicesData);
        XLSX.utils.book_append_sheet(workbook, invoicesSheet, 'Invoices');
      } else {
        const invoicesSheet = XLSX.utils.json_to_sheet([{
          'ID': '',
          'Invoice Number': 'No invoices found',
          'Customer Name': '',
          'Customer Phone': '',
          'Subtotal (₹)': '',
          'Tax %': '',
          'Tax Amount (₹)': '',
          'Discount %': '',
          'Discount Amount (₹)': '',
          'Total Amount (₹)': '',
          'Payment Method': '',
          'Payment Status': '',
          'Amount Paid (₹)': '',
          'Created At': '',
          'Updated At': ''
        }]);
        XLSX.utils.book_append_sheet(workbook, invoicesSheet, 'Invoices');
      }

      // Bills sheet
      if (regularBills.length > 0) {
        const billsData = regularBills.map((bill: any) => ({
          'ID': bill.id || '',
          'Bill Number': bill.bill_number || bill.invoice_number || '',
          'Customer Name': bill.customer_name || '',
          'Customer Phone': bill.customer_phone || '',
          'Subtotal (₹)': bill.subtotal || 0,
          'Tax %': bill.tax_percentage || 0,
          'Tax Amount (₹)': bill.tax_amount || 0,
          'Discount %': bill.discount_percentage || 0,
          'Discount Amount (₹)': bill.discount_amount || 0,
          'Total Amount (₹)': bill.total_amount || 0,
          'Payment Method': bill.payment_method || '',
          'Payment Status': bill.payment_status || '',
          'Amount Paid (₹)': bill.amount_paid || 0,
          'Created At': bill.created_at ? new Date(bill.created_at).toLocaleString('en-IN') : '',
          'Updated At': bill.updated_at ? new Date(bill.updated_at).toLocaleString('en-IN') : ''
        }));
        const billsSheet = XLSX.utils.json_to_sheet(billsData);
        XLSX.utils.book_append_sheet(workbook, billsSheet, 'Bills');
      } else {
        const billsSheet = XLSX.utils.json_to_sheet([{
          'ID': '',
          'Bill Number': 'No bills found',
          'Customer Name': '',
          'Customer Phone': '',
          'Subtotal (₹)': '',
          'Tax %': '',
          'Tax Amount (₹)': '',
          'Discount %': '',
          'Discount Amount (₹)': '',
          'Total Amount (₹)': '',
          'Payment Method': '',
          'Payment Status': '',
          'Amount Paid (₹)': '',
          'Created At': '',
          'Updated At': ''
        }]);
        XLSX.utils.book_append_sheet(workbook, billsSheet, 'Bills');
      }

      // Exchange Bills sheet
      if (exchangeBills.length > 0) {
        const exchangeBillsData = exchangeBills.map((bill: any) => ({
          'ID': bill.id || '',
          'Exchange Bill Number': bill.bill_number || bill.invoice_number || '',
          'Customer Name': bill.customer_name || '',
          'Customer Phone': bill.customer_phone || '',
          'Old Gold Weight (g)': bill.old_gold_weight || 0,
          'Old Gold Purity': bill.old_gold_purity || '',
          'Old Gold Rate (₹/g)': bill.old_gold_rate || 0,
          'Old Gold Value (₹)': bill.old_gold_value || 0,
          'Exchange Rate (₹/g)': bill.exchange_rate || 0,
          'Exchange Difference (₹)': bill.exchange_difference || 0,
          'Subtotal (₹)': bill.subtotal || 0,
          'Tax %': bill.tax_percentage || 0,
          'Tax Amount (₹)': bill.tax_amount || 0,
          'Discount %': bill.discount_percentage || 0,
          'Discount Amount (₹)': bill.discount_amount || 0,
          'Total Amount (₹)': bill.total_amount || 0,
          'Payment Method': bill.payment_method || '',
          'Payment Status': bill.payment_status || '',
          'Amount Paid (₹)': bill.amount_paid || 0,
          'Created At': bill.created_at ? new Date(bill.created_at).toLocaleString('en-IN') : '',
          'Updated At': bill.updated_at ? new Date(bill.updated_at).toLocaleString('en-IN') : ''
        }));
        const exchangeBillsSheet = XLSX.utils.json_to_sheet(exchangeBillsData);
        XLSX.utils.book_append_sheet(workbook, exchangeBillsSheet, 'Exchange Bills');
      } else {
        const exchangeBillsSheet = XLSX.utils.json_to_sheet([{
          'ID': '',
          'Exchange Bill Number': 'No exchange bills found',
          'Customer Name': '',
          'Customer Phone': '',
          'Old Gold Weight (g)': '',
          'Old Gold Purity': '',
          'Old Gold Rate (₹/g)': '',
          'Old Gold Value (₹)': '',
          'Exchange Rate (₹/g)': '',
          'Exchange Difference (₹)': '',
          'Subtotal (₹)': '',
          'Tax %': '',
          'Tax Amount (₹)': '',
          'Discount %': '',
          'Discount Amount (₹)': '',
          'Total Amount (₹)': '',
          'Payment Method': '',
          'Payment Status': '',
          'Amount Paid (₹)': '',
          'Created At': '',
          'Updated At': ''
        }]);
        XLSX.utils.book_append_sheet(workbook, exchangeBillsSheet, 'Exchange Bills');
      }

      // Ensure workbook has at least one sheet
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Workbook has no sheets');
      }

      return workbook;
    } catch (err) {
      console.error('Error creating Excel workbook:', err);
      throw new Error(`Failed to create Excel workbook: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Google Drive Sync Functions
  const syncToDrive = async () => {
    if (!accessToken) {
      error('Please connect to Google Drive first');
      return;
    }

    // Check if token is expired
    const expiryTime = localStorage.getItem('google_token_expiry');
    if (expiryTime && Date.now() > parseInt(expiryTime)) {
      error('Your Google Drive session has expired. Please reconnect.');
      clearAuth();
      return;
    }

    setIsSyncing(true);
    setSyncStatus('syncing');
    
    try {
      // Create Excel workbook
      const workbook = await createExcelWorkbook();
      
      // Validate workbook
      if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Workbook is invalid or has no sheets');
      }

      // Convert workbook to buffer
      let excelBuffer: Uint8Array;
      try {
        const excelOutput = XLSX.write(workbook, { 
          bookType: 'xlsx', 
          type: 'array'
        });

        // Handle both ArrayBuffer and regular array
        let arrayBuffer: ArrayBuffer;
        if (excelOutput instanceof ArrayBuffer) {
          arrayBuffer = excelOutput;
        } else if (Array.isArray(excelOutput)) {
          // Convert array to ArrayBuffer
          arrayBuffer = new ArrayBuffer(excelOutput.length);
          const view = new Uint8Array(arrayBuffer);
          for (let i = 0; i < excelOutput.length; i++) {
            view[i] = excelOutput[i];
          }
        } else {
          console.error('Unexpected excelOutput type:', typeof excelOutput, excelOutput);
          throw new Error(`Unexpected output type: ${typeof excelOutput}`);
        }
        excelBuffer = new Uint8Array(arrayBuffer);
      } catch (writeError) {
        console.error('XLSX.write error:', writeError);
        throw new Error(`Failed to convert workbook to buffer: ${writeError instanceof Error ? writeError.message : 'Unknown error'}`);
      }

      // Validate buffer
      if (!excelBuffer || excelBuffer.length === 0) {
        throw new Error('Generated Excel file buffer is empty');
      }

      const bufferLength = excelBuffer.length;

      // Upload to Google Drive
      const fileName = `gold-billing-backup-${new Date().toISOString().split('T')[0]}.xlsx`;
      const fileMetadata = {
        name: fileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };

      let fileId = driveFileId;
      
      if (fileId) {
        // Update existing file using resumable upload
        // Step 1: Initialize resumable upload for update
        const initResponse = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=resumable`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(fileMetadata),
          }
        );
        
        if (!initResponse.ok) {
          if (initResponse.status === 401) {
            clearAuth();
            throw new Error('Authentication expired. Please reconnect to Google Drive.');
          }
          const errorData = await initResponse.json();
          throw new Error(errorData.error?.message || 'Failed to initiate file update');
        }
        
        const uploadUrl = initResponse.headers.get('Location');
        if (!uploadUrl) {
          throw new Error('Failed to get upload URL');
        }
        
        // Step 2: Upload file content
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Length': bufferLength.toString(),
          },
          body: excelBuffer.buffer.slice(excelBuffer.byteOffset, excelBuffer.byteOffset + excelBuffer.byteLength) as ArrayBuffer,
        });
        
        if (!uploadResponse.ok) {
          if (uploadResponse.status === 401) {
            clearAuth();
            throw new Error('Authentication expired. Please reconnect to Google Drive.');
          }
          const errorText = await uploadResponse.text();
          throw new Error(`Failed to upload file: ${errorText}`);
        }
      } else {
        // Create new file using resumable upload (simpler and more reliable)
        // Step 1: Initialize resumable upload
        const initResponse = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(fileMetadata),
          }
        );
        
        if (!initResponse.ok) {
          if (initResponse.status === 401) {
            clearAuth();
            throw new Error('Authentication expired. Please reconnect to Google Drive.');
          }
          const errorData = await initResponse.json();
          throw new Error(errorData.error?.message || 'Failed to initiate file upload');
        }
        
        const uploadUrl = initResponse.headers.get('Location');
        if (!uploadUrl) {
          throw new Error('Failed to get upload URL');
        }
        
        // Step 2: Upload file content
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Length': bufferLength.toString(),
          },
          body: excelBuffer.buffer.slice(excelBuffer.byteOffset, excelBuffer.byteOffset + excelBuffer.byteLength) as ArrayBuffer,
        });
        
        if (!uploadResponse.ok) {
          if (uploadResponse.status === 401) {
            clearAuth();
            throw new Error('Authentication expired. Please reconnect to Google Drive.');
          }
          const errorText = await uploadResponse.text();
          throw new Error(`Failed to upload file: ${errorText}`);
        }
        
        const fileData = await uploadResponse.json();
        fileId = fileData.id;
        if (fileId) {
          setDriveFileId(fileId);
          localStorage.setItem('drive_file_id', fileId);
        }
      }
      
      setSyncStatus('success');
      setLastBackup(new Date().toISOString());
      success('Data synced to Google Drive successfully!');
      
    } catch (err: any) {
      console.error('Drive sync error:', err);
      setSyncStatus('error');
      error(err.message || 'Failed to sync to Google Drive. Please try again.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const restoreFromDrive = async () => {
    if (!accessToken) {
      error('Please connect to Google Drive first');
      return;
    }

    // Check if token is expired
    const expiryTime = localStorage.getItem('google_token_expiry');
    if (expiryTime && Date.now() > parseInt(expiryTime)) {
      error('Your Google Drive session has expired. Please reconnect.');
      clearAuth();
      return;
    }

    if (!driveFileId) {
      error('No backup file found in Google Drive. Please sync first.');
      return;
    }

      setIsSyncing(true);
      setSyncStatus('syncing');
      
      try {
      // Download file from Google Drive
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          clearAuth();
          throw new Error('Authentication expired. Please reconnect to Google Drive.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to download file');
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // Parse Excel file - match exact export structure
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Import data - use same structure as import function
      const sheetNames = workbook.SheetNames;
      let importData: any = {
        products: [],
        customers: [],
        invoices: [],
        bills: [],
        exchangeBills: []
      };
      
      sheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '',
          blankrows: false
        });
        
        // Skip empty sheets or sheets with only headers
        if (jsonData.length <= 1) return;
        
        // Convert array of arrays to array of objects using exact column headers from export
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as any[][];
        const objects = rows.map((row: any[]) => {
          const obj: any = {};
          headers.forEach((header, index) => {
            if (header && row[index] !== undefined && row[index] !== '') {
              obj[header] = row[index];
            }
          });
          return obj;
        }).filter(obj => Object.keys(obj).length > 0); // Remove empty objects
        
        // Match exact sheet names from export structure
        if (sheetName === 'Products') {
          importData.products = objects;
        } else if (sheetName === 'Customers') {
          importData.customers = objects;
        } else if (sheetName === 'Invoices') {
          importData.invoices = objects;
        } else if (sheetName === 'Bills') {
          importData.bills = objects;
        } else if (sheetName === 'Exchange Bills') {
          importData.exchangeBills = objects;
        }
        // Fallback for case-insensitive matching (for backward compatibility)
        else if (sheetName.toLowerCase() === 'products') {
          importData.products = objects;
        } else if (sheetName.toLowerCase() === 'customers') {
          importData.customers = objects;
        } else if (sheetName.toLowerCase() === 'invoices') {
          importData.invoices = objects;
        } else if (sheetName.toLowerCase() === 'bills') {
          importData.bills = objects;
        } else if (sheetName.toLowerCase() === 'exchange bills') {
          importData.exchangeBills = objects;
        }
      });

      // Validate and clean data
      const cleanedData = validateAndCleanData(importData);
      
      // Log what we're about to restore for debugging
      console.log('Data to restore:', {
        products: cleanedData.products?.length || 0,
        customers: cleanedData.customers?.length || 0,
        invoices: cleanedData.invoices?.length || 0,
        bills: cleanedData.bills?.length || 0,
        exchangeBills: cleanedData.exchangeBills?.length || 0
      });
      
        const db = Database.getInstance();
      
      // Clear existing data
        await db.query('DELETE FROM bills');
        await db.query('DELETE FROM invoices');
        await db.query('DELETE FROM customers');
        await db.query('DELETE FROM products');
        
      // Restore data with error handling
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Restore products
      if (cleanedData.products && cleanedData.products.length > 0) {
        console.log('Restoring products, sample:', cleanedData.products[0]);
        for (const product of cleanedData.products) {
          try {
            // Remove fields that backend doesn't expect
            const { id, created_at, updated_at, ...productData } = product;
            
            // Skip if name is missing or is placeholder
            if (!productData.name || productData.name === 'No products found' || productData.name.trim() === '') {
              errorCount++;
              errors.push(`Product: Missing name`);
              continue;
            }
            
            // validateAndCleanData already mapped and parsed the data correctly
            // Only provide defaults for fields that are truly missing (undefined/null/empty string)
            // Don't change values that are 0 or valid empty strings - preserve original Excel data
            
            // SKU - only generate if completely missing
            if (!productData.sku || (typeof productData.sku === 'string' && productData.sku.trim() === '')) {
              productData.sku = generateId();
            }
            
            // Category - only default if missing
            if (!productData.category || (typeof productData.category === 'string' && productData.category.trim() === '')) {
              productData.category = 'Chains';
            }
            
            // Weight - backend requires weight > 0, so ensure it's at least 1
            if (productData.weight === undefined || productData.weight === null || productData.weight === '') {
              productData.weight = 1;
            } else {
              // Ensure it's a number
              const weightNum = typeof productData.weight === 'number' ? productData.weight : parseFloat(productData.weight);
              // Backend requires weight > 0, so if it's 0 or invalid, set to 1
              productData.weight = (weightNum && weightNum > 0) ? weightNum : 1;
            }
            
            // Purity - backend requires non-empty string
            if (!productData.purity || (typeof productData.purity === 'string' && productData.purity.trim() === '')) {
              productData.purity = '22K';
            } else {
              // Ensure it's a string
              productData.purity = String(productData.purity).trim() || '22K';
            }
            
            // Material type - only default if missing
            if (!productData.material_type || (typeof productData.material_type === 'string' && productData.material_type.trim() === '')) {
              productData.material_type = 'Gold';
            }
            
            // Making charge - preserve 0, only default if truly missing
            if (productData.making_charge === undefined || productData.making_charge === null || productData.making_charge === '') {
              productData.making_charge = 0;
            } else {
              productData.making_charge = typeof productData.making_charge === 'number' ? productData.making_charge : parseFloat(productData.making_charge) || 0;
            }
            
            // Current rate - preserve 0 if it was in Excel, only set default if truly missing
            if (productData.current_rate === undefined || productData.current_rate === null || productData.current_rate === '') {
              // Truly missing, set default based on purity
              const defaultRates: { [key: string]: number } = {
                '24K': 6000,
                '22K': 5500,
                '18K': 4800,
                '14K': 3800,
              };
              productData.current_rate = defaultRates[productData.purity] || 5500;
            } else {
              // Ensure it's a number, but preserve the value (even if 0)
              productData.current_rate = typeof productData.current_rate === 'number' ? productData.current_rate : parseFloat(productData.current_rate) || 0;
            }
            
            // Stock quantity - preserve 0, only default if truly missing
            if (productData.stock_quantity === undefined || productData.stock_quantity === null || productData.stock_quantity === '') {
              productData.stock_quantity = 0;
            } else {
              productData.stock_quantity = typeof productData.stock_quantity === 'number' ? productData.stock_quantity : parseInt(productData.stock_quantity) || 0;
            }
            
            // Min stock level - preserve values, only default if truly missing or invalid
            if (productData.min_stock_level === undefined || productData.min_stock_level === null || productData.min_stock_level === '' || productData.min_stock_level < 0) {
              productData.min_stock_level = 1;
            } else {
              productData.min_stock_level = typeof productData.min_stock_level === 'number' ? productData.min_stock_level : parseInt(productData.min_stock_level) || 1;
            }
            
            // Final validation before sending - ensure all required fields are present and valid
            if (!productData.name || !productData.category || !productData.sku || 
                !productData.weight || productData.weight <= 0 || 
                !productData.purity || productData.purity.trim() === '') {
              errorCount++;
              errors.push(`Product ${productData.name || 'Unknown'}: Missing or invalid required fields (name: ${!!productData.name}, category: ${!!productData.category}, sku: ${!!productData.sku}, weight: ${productData.weight}, purity: ${productData.purity})`);
              console.error('Product missing required fields:', {
                name: productData.name,
                category: productData.category,
                sku: productData.sku,
                weight: productData.weight,
                purity: productData.purity,
                fullData: productData
              });
              continue;
            }
            
            // Log the product being inserted for debugging
            if (successCount === 0) {
              console.log('First product being inserted:', productData);
            }
            
            await db.insert('products', productData);
            successCount++;
          } catch (err: any) {
            errorCount++;
            const errorMsg = err?.response?.data?.error || err?.message || 'Unknown error';
            errors.push(`Product ${product.name || product.sku || 'Unknown'}: ${errorMsg}`);
            console.error('Error restoring product:', product, 'Error:', err);
          }
        }
      }

      // Restore customers
      let restoredCustomers: any[] = [];
      if (cleanedData.customers && cleanedData.customers.length > 0) {
        for (const customer of cleanedData.customers) {
          try {
            // Remove fields that backend doesn't expect
            const { id, created_at, updated_at, ...customerData } = customer;
            
            // Ensure required fields are present
            if (!customerData.name || !customerData.phone) {
              errorCount++;
              errors.push(`Customer ${customerData.name || 'Unknown'}: Missing required fields`);
              continue;
            }
            
            const savedCustomer = await db.insert('customers', customerData);
            restoredCustomers.push(savedCustomer);
            successCount++;
          } catch (err: any) {
            errorCount++;
            const errorMsg = err?.response?.data?.error || err?.message || 'Unknown error';
            errors.push(`Customer ${customer.name || customer.phone || 'Unknown'}: ${errorMsg}`);
            console.error('Error restoring customer:', customer, err);
          }
        }
      }

      // Build customer lookup map (name + phone → id) after restoring customers
      if (restoredCustomers.length === 0) {
        try {
          restoredCustomers = await db.getCustomers();
      } catch (err) {
          console.error('Error fetching customers after restore:', err);
        }
      }
      const customerLookup = new Map<string, any>();
      if (restoredCustomers && Array.isArray(restoredCustomers)) {
        for (const c of restoredCustomers) {
          const nameKey = (c.name || '').toString().toLowerCase().trim();
          const phoneKey = (c.phone || '').toString().replace(/\s+/g, '');
          if (nameKey || phoneKey) {
            customerLookup.set(`${nameKey}__${phoneKey}`, c);
          }
        }
      }

      // Restore invoices
      if (cleanedData.invoices && cleanedData.invoices.length > 0) {
        console.log('Restoring invoices, sample:', cleanedData.invoices[0]);
        for (const invoice of cleanedData.invoices) {
          try {
            // Remove fields that backend doesn't expect
            const { id, ...invoiceData } = invoice;
            
            // Ensure numeric fields are numbers (0 is allowed!)
            invoiceData.subtotal = parseFloat(invoiceData.subtotal) || 0;
            invoiceData.tax_percentage = parseFloat(invoiceData.tax_percentage) || 0;
            invoiceData.tax_amount = parseFloat(invoiceData.tax_amount) || 0;
            invoiceData.discount_percentage = parseFloat(invoiceData.discount_percentage) || 0;
            invoiceData.discount_amount = parseFloat(invoiceData.discount_amount) || 0;
            invoiceData.total_amount = parseFloat(invoiceData.total_amount) || 0;
            invoiceData.amount_paid = parseFloat(invoiceData.amount_paid) || 0;

            // Backend requires customer_id (NOT NULL), customer_name, customer_phone, total_amount (>0), payment_method, items (truthy)
            if (!invoiceData.customer_name || invoiceData.customer_name.trim() === '') {
              invoiceData.customer_name = 'Unknown Customer';
            }

            // Normalize phone
            if (!invoiceData.customer_phone || invoiceData.customer_phone.toString().trim() === '') {
              invoiceData.customer_phone = '';
            } else {
              invoiceData.customer_phone = invoiceData.customer_phone.toString().trim();
            }

            if (!invoiceData.payment_method) {
              invoiceData.payment_method = 'cash';
            }

            // If total_amount is missing/0, try to recompute from other fields
            if (!invoiceData.total_amount || invoiceData.total_amount <= 0) {
              const computedTotal =
                (invoiceData.subtotal || 0) +
                (invoiceData.tax_amount || 0) -
                (invoiceData.discount_amount || 0);
              if (computedTotal > 0) {
                invoiceData.total_amount = computedTotal;
              }
            }

            // Resolve customer_id via lookup (name + phone)
            const nameKey = invoiceData.customer_name.toString().toLowerCase().trim();
            const phoneKey = invoiceData.customer_phone.toString().replace(/\s+/g, '');
            const lookupKey = `${nameKey}__${phoneKey}`;
            let customerMatch = customerLookup.get(lookupKey);

            // If no exact match, try matching by name only
            if (!customerMatch && nameKey) {
              for (const c of customerLookup.values()) {
                const cNameKey = (c.name || '').toString().toLowerCase().trim();
                if (cNameKey === nameKey) {
                  customerMatch = c;
                  break;
                }
              }
            }

            // If still no match, create a new customer on-the-fly
            if (!customerMatch) {
              try {
                const newCustomer = await db.insert('customers', {
                  name: invoiceData.customer_name || 'Unknown Customer',
                  phone: invoiceData.customer_phone || `PHONE-${generateId()}`,
                  email: '',
                  address: invoiceData.customer_address || '',
                  customer_type: 'individual',
                  status: 'active'
                });
                customerMatch = newCustomer;
                const newNameKey = (newCustomer.name || '').toString().toLowerCase().trim();
                const newPhoneKey = (newCustomer.phone || '').toString().replace(/\s+/g, '');
                customerLookup.set(`${newNameKey}__${newPhoneKey}`, newCustomer);
              } catch (createCustomerErr) {
                console.error('Failed to create customer for invoice:', invoiceData, createCustomerErr);
              }
            }

            // Attach customer_id (required by invoices table)
            if (customerMatch && customerMatch.id != null) {
              invoiceData.customer_id = customerMatch.id;
              if (!invoiceData.customer_phone) {
                invoiceData.customer_phone = customerMatch.phone || `PHONE-${generateId()}`;
              }
            }

            // If still no customer_id, we cannot insert due to NOT NULL constraint
            if (!invoiceData.customer_id) {
              errorCount++;
              errors.push(
                `Invoice ${invoiceData.invoice_number || 'Unknown'}: Could not resolve customer_id`
              );
              console.error('Invoice missing customer_id after lookup:', invoiceData);
              continue;
            }

            // Final validation: match backend required fields
            if (
              !invoiceData.customer_id ||
              !invoiceData.customer_name ||
              !invoiceData.customer_phone ||
              !invoiceData.total_amount ||
              !invoiceData.payment_method
            ) {
              errorCount++;
              errors.push(
                `Invoice ${invoiceData.invoice_number || 'Unknown'}: Missing required fields after processing`
              );
              console.error('Invoice missing required fields:', invoiceData);
              continue;
            }
            
            // Ensure items is an array (can be empty, backend only checks truthiness)
            if (!Array.isArray(invoiceData.items)) {
              invoiceData.items = [];
            }
            
            // Log dates for debugging (first invoice only)
            if (successCount === 0 && cleanedData.invoices.length > 0) {
              console.log('First invoice being restored:', {
                invoice_number: invoiceData.invoice_number,
                created_at: invoiceData.created_at,
                updated_at: invoiceData.updated_at,
                created_at_type: typeof invoiceData.created_at
              });
            }
            
            await db.insert('invoices', invoiceData);
            successCount++;
          } catch (err: any) {
            errorCount++;
            const errorMsg = err?.response?.data?.error || err?.message || 'Unknown error';
            errors.push(`Invoice ${invoice.invoice_number || 'Unknown'}: ${errorMsg}`);
            console.error('Error restoring invoice:', invoice, err);
          }
        }
      }

      // Restore bills (including merged exchange bills)
      if (cleanedData.bills && cleanedData.bills.length > 0) {
        console.log('Restoring bills (including exchange bills), sample:', cleanedData.bills[0]);
        for (const bill of cleanedData.bills) {
          try {
            // Remove fields that backend doesn't expect
            const { id, ...billData } = bill;
            
            // Ensure numeric fields are numbers (0 is allowed!)
            billData.subtotal = parseFloat(billData.subtotal) || 0;
            billData.tax_percentage = parseFloat(billData.tax_percentage) || 0;
            billData.tax_amount = parseFloat(billData.tax_amount) || 0;
            billData.discount_percentage = parseFloat(billData.discount_percentage) || 0;
            billData.discount_amount = parseFloat(billData.discount_amount) || 0;
            billData.total_amount = parseFloat(billData.total_amount) || 0;
            billData.amount_paid = parseFloat(billData.amount_paid) || 0;

            // Backend requires invoice_number, customer_name, total_amount (>0), payment_method, items (truthy)
            if (!billData.customer_name || billData.customer_name.trim() === '') {
              billData.customer_name = 'Unknown Customer';
            }

            if (!billData.payment_method) {
              billData.payment_method = 'cash';
            }

            // Compute total_amount if missing/0
            if (!billData.total_amount || billData.total_amount <= 0) {
              const computedTotal =
                (billData.subtotal || 0) +
                (billData.tax_amount || 0) -
                (billData.discount_amount || 0);
              if (computedTotal > 0) {
                billData.total_amount = computedTotal;
              }
            }

            // Map to backend payload shape (uses invoice_number but stores as bill_number)
            const billPayload: any = {
              invoice_number: billData.bill_number || billData.invoice_number || generateBillNumber(),
              customer_id: billData.customer_id || null,
              customer_name: billData.customer_name,
              customer_phone: billData.customer_phone || '',
              customer_address: billData.customer_address || '',
              items: Array.isArray(billData.items) ? billData.items : [],
              subtotal: billData.subtotal || 0,
              tax_percentage: billData.tax_percentage || 0,
              tax_amount: billData.tax_amount || 0,
              discount_percentage: billData.discount_percentage || 0,
              discount_amount: billData.discount_amount || 0,
              total_amount: billData.total_amount || 0,
              payment_method: billData.payment_method,
              payment_status: billData.payment_status || 'pending',
              amount_paid: billData.amount_paid || 0,
              notes: billData.notes || '',
              created_at: billData.created_at,
              updated_at: billData.updated_at
            };

            // Final validation for bills
            if (
              !billPayload.invoice_number ||
              !billPayload.customer_name ||
              !billPayload.total_amount ||
              !billPayload.payment_method
            ) {
              errorCount++;
              errors.push(
                `Bill ${billData.bill_number || 'Unknown'}: Missing required fields after processing`
              );
              console.error('Bill missing required fields:', billPayload);
              continue;
            }
            
            // Log dates for debugging (first bill only)
            if (successCount === 0 && cleanedData.bills && cleanedData.bills.length > 0) {
              console.log('First bill being restored:', {
                bill_number: billPayload.invoice_number,
                created_at: billPayload.created_at,
                updated_at: billPayload.updated_at,
                created_at_type: typeof billPayload.created_at
              });
            }
            
            await db.insert('bills', billPayload);
            successCount++;
          } catch (err: any) {
            errorCount++;
            const errorMsg = err?.response?.data?.error || err?.message || 'Unknown error';
            errors.push(`Bill ${bill.bill_number || 'Unknown'}: ${errorMsg}`);
            console.error('Error restoring bill:', bill, err);
          }
        }
      }

      // Show summary
      if (errorCount > 0) {
        console.warn('Restore completed with errors:', errors);
        if (successCount > 0) {
          setSyncStatus('success');
          success(`Restored ${successCount} items successfully. ${errorCount} items failed. Check console for details.`);
        } else {
          throw new Error(`Failed to restore data. ${errorCount} errors occurred. First error: ${errors[0]}`);
        }
      } else {
        setSyncStatus('success');
        success(`Successfully restored ${successCount} items from Google Drive!`);
      }
      
    } catch (err: any) {
      console.error('Drive restore error:', err);
        setSyncStatus('error');
      error(err.message || 'Failed to restore from Google Drive. Please try again.');
      } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const clearAllData = async () => {
      try {
        const db = Database.getInstance();
      setIsSyncing(true);
      setSyncStatus('syncing');

      let deletedCount = 0;
      let errorCount = 0;

      // Step 1: Delete all bills (including exchange bills) - must be first due to foreign keys
      try {
        const bills = await db.getBills();
        if (bills && bills.length > 0) {
          for (const bill of bills) {
            try {
              // Use API directly to delete bills
              await apiEndpoints.bills.delete(bill.id);
              deletedCount++;
            } catch (err) {
              console.error(`Error deleting bill ${bill.id}:`, err);
              errorCount++;
            }
          }
        }
      } catch (err) {
        console.error('Error fetching bills:', err);
      }

      // Step 2: Delete all invoices - must be before customers/products
      try {
        const invoices = await db.getInvoices();
        if (invoices && invoices.length > 0) {
          for (const invoice of invoices) {
            try {
              // Use API directly to delete invoices
              await apiEndpoints.invoices.delete(invoice.id);
              deletedCount++;
            } catch (err) {
              console.error(`Error deleting invoice ${invoice.id}:`, err);
              errorCount++;
            }
          }
        }
      } catch (err) {
        console.error('Error fetching invoices:', err);
      }

      // Step 3: Delete all customers
      try {
        const customers = await db.getCustomers();
        if (customers && customers.length > 0) {
          for (const customer of customers) {
            try {
              await db.deleteCustomer(customer.id);
              deletedCount++;
            } catch (err) {
              console.error(`Error deleting customer ${customer.id}:`, err);
              errorCount++;
            }
          }
        }
      } catch (err) {
        console.error('Error fetching customers:', err);
      }

      // Step 4: Delete all products (with cascade to handle references)
      try {
        const products = await db.getProducts();
        if (products && products.length > 0) {
          for (const product of products) {
            try {
              // Use cascade delete to handle foreign key references
              await db.deleteProductWithCascade(product.id);
              deletedCount++;
            } catch (err) {
              console.error(`Error deleting product ${product.id}:`, err);
              errorCount++;
            }
          }
        }
      } catch (err) {
        console.error('Error fetching products:', err);
      }

      setIsSyncing(false);
      setSyncStatus('idle');

      if (errorCount > 0) {
        setSyncStatus('error');
        error(`Cleared ${deletedCount} items, but ${errorCount} items failed to delete. Check console for details.`);
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        setSyncStatus('success');
        success(`All data cleared successfully! Deleted ${deletedCount} items.`);
        setTimeout(() => setSyncStatus('idle'), 3000);
      }
      } catch (err) {
        console.error('Clear data error:', err);
      setIsSyncing(false);
      setSyncStatus('error');
        error('Failed to clear data. Please try again.');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('settings.title')}</h1>
          <p className="text-gray-600 mt-1">{t('settings.subtitle')}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            isSaving || isLoading
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-amber-500 text-white hover:bg-amber-600'
          }`}
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>{t('settings.saveChanges')}</span>
            </>
          )}
        </button>
      </div>

      {/* Horizontal Tabs Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center space-x-2 px-6 py-4 border-b-2 transition-all ${
                    activeTab === tab.id
                      ? 'border-amber-500 text-amber-600 bg-amber-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="p-6">
          {activeTab === 'business' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
                <Store className="h-6 w-6 text-amber-600" />
                <h2 className="text-xl font-semibold text-gray-900">{t('settings.businessInformation')}</h2>
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent"></div>
                  <span className="ml-3 text-gray-600">Loading business information...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.businessName')} *
                    </label>
                    <input
                      type="text"
                      value={businessInfo.name}
                      onChange={(e) => setBusinessInfo({ ...businessInfo, name: e.target.value })}
                      disabled={isSaving}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="Enter business name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.phoneNumber')} *
                    </label>
                    <input
                      type="tel"
                      value={businessInfo.phone}
                      onChange={(e) => setBusinessInfo({ ...businessInfo, phone: e.target.value })}
                      disabled={isSaving}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.businessAddress')} *
                    </label>
                    <textarea
                      value={businessInfo.address}
                      onChange={(e) => setBusinessInfo({ ...businessInfo, address: e.target.value })}
                      disabled={isSaving}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      rows={3}
                      placeholder="Enter complete business address"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.emailAddress')}
                    </label>
                    <input
                      type="email"
                      value={businessInfo.email}
                      onChange={(e) => setBusinessInfo({ ...businessInfo, email: e.target.value })}
                      disabled={isSaving}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="info@business.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.gstin')}
                    </label>
                    <input
                      type="text"
                      value={businessInfo.gstin}
                      onChange={(e) => setBusinessInfo({ ...businessInfo, gstin: e.target.value })}
                      disabled={isSaving}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="33AAAAA0000A1Z5"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.bisLicenseNumber')}
                    </label>
                    <input
                      type="text"
                      value={businessInfo.license}
                      onChange={(e) => setBusinessInfo({ ...businessInfo, license: e.target.value })}
                      disabled={isSaving}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="BIS-123456"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
                <Download className="h-6 w-6 text-amber-600" />
                <h2 className="text-xl font-semibold text-gray-900">{t('settings.dataManagementTitle')}</h2>
              </div>
              
              <div className="space-y-6">
                {/* Google Drive Sync Section */}
                <div className="p-6 border border-blue-200 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-4">
                    <Cloud className="h-5 w-5 text-blue-600" />
                    <h3 className="font-medium text-gray-900">Google Drive Sync</h3>
                    <div className="flex items-center space-x-2">
                      {syncStatus === 'syncing' && (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                      )}
                      {syncStatus === 'success' && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {syncStatus === 'error' && (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  
                  {!isGoogleAuthenticated ? (
                    <>
                  <p className="text-sm text-gray-600 mb-4">
                        Connect your Google Drive account to automatically sync your data backup as an Excel file.
                      </p>
                      <button 
                        onClick={() => loginWithGoogle()}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        <Cloud className="h-4 w-4" />
                        <span>Connect Google Drive</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600 mb-4">
                        Your data will be synced to Google Drive as an Excel file. You can view and edit it directly in Drive.
                    {lastBackup && (
                      <span className="block mt-1 text-xs text-gray-500">
                        Last backup: {new Date(lastBackup).toLocaleString()}
                      </span>
                    )}
                  </p>
                      <div className="flex flex-wrap gap-4">
                    <button 
                          onClick={syncToDrive}
                      disabled={isSyncing}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                        isSyncing 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      <Cloud className="h-4 w-4" />
                          <span>Sync to Drive</span>
                    </button>
                    <button 
                          onClick={() => setShowRestoreConfirm(true)}
                          disabled={isSyncing || !driveFileId}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                            isSyncing || !driveFileId
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-amber-500 text-white hover:bg-amber-600'
                      }`}
                    >
                      <DatabaseIcon className="h-4 w-4" />
                          <span>Restore from Drive</span>
                        </button>
                        <button 
                          onClick={() => {
                            clearAuth();
                            success('Disconnected from Google Drive');
                          }}
                          className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>Disconnect</span>
                    </button>
                  </div>
                    </>
                  )}
                </div>

                {/* Backup & Export Section */}
                <div className="p-6 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-4">
                    <FileText className="h-5 w-5 text-green-600" />
                    <h3 className="font-medium text-gray-900">{t('settings.backupExport')}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Export your data in Excel format for backup purposes or data migration.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button 
                      onClick={exportAllData}
                      disabled={isExporting}
                      className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                        isExporting 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Export All (Excel)</span>
                    </button>
                    <button 
                      onClick={exportProducts}
                      disabled={isExporting}
                      className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                        isExporting 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-purple-500 text-white hover:bg-purple-600'
                      }`}
                    >
                      <Download className="h-4 w-4" />
                      <span>{t('settings.exportProducts')}</span>
                    </button>
                    <button 
                      onClick={exportInvoices}
                      disabled={isExporting}
                      className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                        isExporting 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      <Download className="h-4 w-4" />
                      <span>Export Invoices</span>
                    </button>
                    <button 
                      onClick={exportBills}
                      disabled={isExporting}
                      className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                        isExporting 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-amber-500 text-white hover:bg-amber-600'
                      }`}
                    >
                      <Download className="h-4 w-4" />
                      <span>Export Bills</span>
                    </button>
                    <button 
                      onClick={exportExchangeBills}
                      disabled={isExporting}
                      className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                        isExporting 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-emerald-500 text-white hover:bg-emerald-600'
                      }`}
                    >
                      <Download className="h-4 w-4" />
                      <span>Export Exchange Bills</span>
                    </button>
                    <button 
                      onClick={exportCustomers}
                      disabled={isExporting}
                      className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                        isExporting 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-teal-500 text-white hover:bg-teal-600'
                      }`}
                    >
                      <Download className="h-4 w-4" />
                      <span>Export Customers</span>
                    </button>
                  </div>
                  {isExporting && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center space-x-2 text-amber-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-500 border-t-transparent"></div>
                        <span className="text-sm">Exporting data...</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${exportProgress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">{exportProgress}% complete</span>
                    </div>
                  )}
                  
                  {exportStats && !isExporting && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-2 text-green-700 mb-2">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Export Completed Successfully!</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="text-center">
                          <div className="font-semibold text-green-800">{exportStats.products}</div>
                          <div className="text-green-600">Products</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-green-800">{exportStats.customers}</div>
                          <div className="text-green-600">Customers</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-green-800">{exportStats.invoices}</div>
                          <div className="text-green-600">Invoices</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-green-800">{exportStats.bills}</div>
                          <div className="text-green-600">Bills</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Import Data Section */}
                <div className="p-6 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-4">
                    <Upload className="h-5 w-5 text-amber-600" />
                    <h3 className="font-medium text-gray-900">{t('settings.importData')}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Import data from previously exported Excel files. Make sure the file format matches the export format.
                  </p>

                  {/* Excel Import */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Excel Import</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button 
                        onClick={() => handleFileImport('all')}
                        disabled={isImporting}
                        className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                          isImporting 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-green-500 text-white hover:bg-green-600'
                        }`}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Import All (Excel)</span>
                      </button>
                      <button 
                        onClick={() => handleFileImport('products')}
                        disabled={isImporting}
                        className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                          isImporting 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-green-500 text-white hover:bg-green-600'
                        }`}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Import Products (Excel)</span>
                      </button>
                      <button 
                        onClick={() => handleFileImport('customers')}
                        disabled={isImporting}
                        className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                          isImporting 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-green-500 text-white hover:bg-green-600'
                        }`}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Import Customers (Excel)</span>
                      </button>
                      <button 
                        onClick={() => handleFileImport('invoices')}
                        disabled={isImporting}
                        className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                          isImporting 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-green-500 text-white hover:bg-green-600'
                        }`}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Import Invoices (Excel)</span>
                      </button>
                      <button 
                        onClick={() => handleFileImport('bills')}
                        disabled={isImporting}
                        className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                          isImporting 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-green-500 text-white hover:bg-green-600'
                        }`}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Import Bills (Excel)</span>
                      </button>
                      <button 
                        onClick={() => handleFileImport('exchangeBills')}
                        disabled={isImporting}
                        className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                          isImporting 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-green-500 text-white hover:bg-green-600'
                        }`}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Import Exchange Bills (Excel)</span>
                      </button>
                    </div>
                  </div>

                  {isImporting && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center space-x-2 text-amber-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-500 border-t-transparent"></div>
                        <span className="text-sm">Importing data...</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${importProgress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">{importProgress}% complete</span>
                    </div>
                  )}
                  
                  {importStats && !isImporting && (
                    <div className={`mt-4 p-3 border rounded-lg ${
                      importStats.errors === 0 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className={`flex items-center space-x-2 mb-2 ${
                        importStats.errors === 0 ? 'text-green-700' : 'text-yellow-700'
                      }`}>
                        {importStats.errors === 0 ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                        <span className="text-sm font-medium">
                          {importStats.errors === 0 ? 'Import Completed Successfully!' : 'Import Completed with Warnings'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <div className={`font-semibold ${
                            importStats.errors === 0 ? 'text-green-800' : 'text-yellow-800'
                          }`}>
                            {importStats.imported}
                          </div>
                          <div className={importStats.errors === 0 ? 'text-green-600' : 'text-yellow-600'}>
                            Imported
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`font-semibold ${
                            importStats.errors === 0 ? 'text-green-800' : 'text-yellow-800'
                          }`}>
                            {importStats.total}
                          </div>
                          <div className={importStats.errors === 0 ? 'text-green-600' : 'text-yellow-600'}>
                            Total
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`font-semibold ${
                            importStats.errors === 0 ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {importStats.errors}
                          </div>
                          <div className={importStats.errors === 0 ? 'text-green-600' : 'text-red-600'}>
                            Errors
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Danger Zone */}
                <div className="p-6 border border-red-200 bg-red-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <h3 className="font-medium text-red-900">{t('settings.dangerZone')}</h3>
                  </div>
                  <p className="text-sm text-red-700 mb-4">
                    {t('settings.irreversibleActions')}
                  </p>
                  <button 
                    onClick={() => setShowClearConfirm(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{t('settings.clearAllData')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Restore from Drive confirmation modal */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-gray-900">
                Restore data from Google Drive?
              </h3>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              This will replace your current products, customers, invoices, and bills with the data
              from your latest backup in Google Drive. This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowRestoreConfirm(false);
                  await restoreFromDrive();
                }}
                className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700"
              >
                Yes, restore data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear all data confirmation modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-900">
                Clear all data?
              </h3>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              This will permanently delete <strong>all</strong> products, customers, invoices, and
              bills from this system.
            </p>
            <p className="text-sm text-red-600 mb-4 font-medium">
              This action cannot be undone. Make sure you have exported or backed up your data
              before continuing.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowClearConfirm(false);
                  await clearAllData();
                }}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Yes, delete everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;