import React, { useState } from 'react';
import {
  User,
  Store,
  CreditCard,
  Bell,
  Shield,
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
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import Database from '../utils/database';

const Settings: React.FC = () => {
  const { t } = useLanguage();
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState('business');
  const [businessInfo, setBusinessInfo] = useState({
    name: 'Golden Jewelers',
    address: '123 Jewelry Street, Chennai - 600001',
    phone: '+91 98765 43210',
    email: 'info@goldenjewelers.com',
    gstin: '33AAAAA0000A1Z5',
    license: 'BIS-123456',
  });

  const [taxSettings, setTaxSettings] = useState({
    gst_rate: 3,
    making_charge_tax: true,
    discount_before_tax: true,
  });

  const [userProfile, setUserProfile] = useState({
    name: t('common.adminUser'),
    email: 'admin@goldenjewelers.com',
    role: 'Owner',
    phone: '+91 98765 43210',
  });

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [exportStats, setExportStats] = useState<{products: number, customers: number, invoices: number, bills: number} | null>(null);
  const [importStats, setImportStats] = useState<{imported: number, total: number, errors: number} | null>(null);

  const tabs = [
    { id: 'business', name: t('settings.businessInfo'), icon: Store },
    { id: 'user', name: t('settings.userProfile'), icon: User },
    { id: 'tax', name: t('settings.taxSettings'), icon: CreditCard },
    { id: 'notifications', name: t('settings.notifications'), icon: Bell },
    { id: 'security', name: t('settings.security'), icon: Shield },
    { id: 'data', name: t('settings.dataManagement'), icon: Download },
  ];

  const handleSave = () => {
    success(t('settings.settingsSavedSuccessfully'));
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

      // Progress: 60%
      setExportProgress(60);
      
      const exportData = {
        export_date: new Date().toISOString(),
        business_info: businessInfo,
        tax_settings: taxSettings,
        user_profile: userProfile,
        data: {
          products,
          customers,
          invoices,
          bills
        }
      };

        // Create Excel workbook with multiple sheets
        const workbook = XLSX.utils.book_new();
        
      // Progress: 50%
      setExportProgress(50);
      
      // Products sheet with proper formatting
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
      
      // Customers sheet with proper formatting
      if (customers && customers.length > 0) {
        const customersData = customers.map((customer: any) => ({
          'ID': customer.id,
          'Name': customer.name,
          'Phone': customer.phone,
          'Email': customer.email || '',
          'Address': customer.address || '',
          'Created At': new Date(customer.created_at).toLocaleDateString('en-IN')
        }));
        const customersSheet = XLSX.utils.json_to_sheet(customersData);
        XLSX.utils.book_append_sheet(workbook, customersSheet, 'Customers');
      }
      
      // Invoices sheet with proper formatting
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
      
      // Bills sheet with proper formatting
      if (bills && bills.length > 0) {
        const billsData = bills.map((bill: any) => ({
          'ID': bill.id,
          'Bill Number': bill.bill_number,
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
        
        // Business info sheet
      const businessData = [{
        'Business Name': businessInfo.name,
        'Address': businessInfo.address,
        'Phone': businessInfo.phone,
        'Email': businessInfo.email,
        'GSTIN': businessInfo.gstin,
        'BIS License': businessInfo.license,
        'Export Date': new Date().toLocaleDateString('en-IN')
      }];
      const businessSheet = XLSX.utils.json_to_sheet(businessData);
        XLSX.utils.book_append_sheet(workbook, businessSheet, 'Business Info');
      
      // Tax settings sheet
      const taxData = [{
        'GST Rate (%)': taxSettings.gst_rate,
        'Apply Tax on Making Charges': taxSettings.making_charge_tax ? 'Yes' : 'No',
        'Apply Discount Before Tax': taxSettings.discount_before_tax ? 'Yes' : 'No',
        'Export Date': new Date().toLocaleDateString('en-IN')
      }];
      const taxSheet = XLSX.utils.json_to_sheet(taxData);
      XLSX.utils.book_append_sheet(workbook, taxSheet, 'Tax Settings');
        
        // Progress: 80%
        setExportProgress(80);
        
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
        
      success(`All data exported to Excel successfully! ${workbook.SheetNames.length} sheets created.`);
      
      // Progress: 100%
      setExportProgress(100);
      setLastBackup(new Date().toISOString());
      
      // Set export statistics
      setExportStats({
        products: products?.length || 0,
        customers: customers?.length || 0,
        invoices: invoices?.length || 0,
        bills: bills?.length || 0
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
      const [invoices, bills] = await Promise.all([
        db.query('invoices'),
        db.query('bills')
      ]);

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
      
      // Bills sheet
      if (bills && bills.length > 0) {
        const billsData = bills.map((bill: any) => ({
          'ID': bill.id,
          'Bill Number': bill.bill_number,
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
      link.download = `invoices-bills-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      success('Invoices and bills exported to Excel successfully!');
    } catch (err) {
      console.error('Export error:', err);
      error('Failed to export invoices. Please try again.');
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

  const exportProductsCSV = async () => {
    setIsExporting(true);
    try {
      const db = Database.getInstance();
      const products = await db.query('products');

      // Create CSV header
      const headers = ['ID', 'Name', 'Category', 'SKU', 'Barcode', 'Weight', 'Purity', 'Making Charge', 'Current Rate', 'Stock Quantity', 'Min Stock Level', 'Status', 'Created At'];
      
      // Create CSV rows
      const csvRows = [
        headers.join(','),
        ...products.map((product: any) => [
          product.id,
          `"${product.name}"`,
          `"${product.category}"`,
          `"${product.sku}"`,
          `"${product.barcode || ''}"`,
          product.weight,
          `"${product.purity}"`,
          product.making_charge,
          product.current_rate,
          product.stock_quantity,
          product.min_stock_level,
          `"${product.status}"`,
          `"${product.created_at}"`
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const dataBlob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      success('Products exported as CSV successfully!');
    } catch (err) {
      console.error('CSV Export error:', err);
      error('Failed to export products as CSV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Enhanced Data Import Functions
  const handleFileImport = (type: 'products' | 'customers' | 'all') => {
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

  const importData = async (file: File, type: 'products' | 'customers' | 'all') => {
    setIsImporting(true);
    setImportProgress(0);
    
    try {
      const db = Database.getInstance();
      let importData: any = {};

        // Handle Excel file
        setImportProgress(20);
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Convert Excel sheets to JSON
        const sheetNames = workbook.SheetNames;
        importData = {};
        
        sheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '',
          blankrows: false
        });
        
        // Skip empty sheets
        if (jsonData.length <= 1) return;
        
        // Convert array of arrays to array of objects
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1);
        const objects = rows.map((row: any[]) => {
          const obj: any = {};
          headers.forEach((header, index) => {
            if (header && row[index] !== undefined) {
              obj[header] = row[index];
            }
          });
          return obj;
        });
          
          if (sheetName.toLowerCase().includes('product')) {
          importData.products = objects;
          } else if (sheetName.toLowerCase().includes('customer')) {
          importData.customers = objects;
          } else if (sheetName.toLowerCase().includes('invoice')) {
          importData.invoices = objects;
          } else if (sheetName.toLowerCase().includes('bill')) {
          importData.bills = objects;
          } else if (sheetName.toLowerCase().includes('business')) {
          importData.business_info = objects[0];
        } else if (sheetName.toLowerCase().includes('tax')) {
          importData.tax_settings = objects[0];
          }
        });
        
        setImportProgress(40);

      // Validate and clean data
      setImportProgress(60);
      const cleanedData = validateAndCleanData(importData, type);
      
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
        
        if (cleanedData.invoices && cleanedData.invoices.length > 0) {
          setImportProgress(90);
          for (let i = 0; i < cleanedData.invoices.length; i++) {
            try {
              await db.insert('invoices', cleanedData.invoices[i]);
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
              await db.insert('bills', cleanedData.bills[i]);
            importedCount++;
            } catch (err) {
              console.error(`Error importing bill ${i + 1}:`, err);
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
      }
      
      // Update business info and tax settings if available
      if (cleanedData.business_info) {
        setBusinessInfo(prev => ({
          ...prev,
          ...cleanedData.business_info
        }));
      }
      
      if (cleanedData.tax_settings) {
        setTaxSettings(prev => ({
          ...prev,
          gst_rate: parseFloat(cleanedData.tax_settings['GST Rate (%)']) || prev.gst_rate,
          making_charge_tax: cleanedData.tax_settings['Apply Tax on Making Charges'] === 'Yes' || prev.making_charge_tax,
          discount_before_tax: cleanedData.tax_settings['Apply Discount Before Tax'] === 'Yes' || prev.discount_before_tax
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
  const validateAndCleanData = (data: any, type: string) => {
    const cleaned: any = {};
    
    if (data.products && Array.isArray(data.products)) {
      cleaned.products = data.products.map((product: any) => {
        // Handle Excel column mapping
        const mappedProduct = {
          id: product.ID || product.id || generateId(),
          name: product.Name || product.name || '',
          category: product.Category || product.category || 'Chains',
          sku: product.SKU || product.sku || generateId(),
          barcode: product.Barcode || product.barcode || '',
          weight: parseFloat(product['Weight (g)'] || product.weight) || 0,
          purity: product.Purity || product.purity || '22K',
          making_charge: parseFloat(product['Making Charge (₹)'] || product.making_charge) || 0,
          current_rate: parseFloat(product['Current Rate (₹/g)'] || product.current_rate) || 0,
          stock_quantity: parseInt(product['Stock Quantity'] || product.stock_quantity) || 0,
          min_stock_level: parseInt(product['Min Stock Level'] || product.min_stock_level) || 1,
          status: (product.Status || product.status || 'active').toLowerCase(),
          created_at: product['Created At'] || product.created_at || new Date().toISOString(),
          updated_at: product['Updated At'] || product.updated_at || new Date().toISOString()
        };
        
        // Validate required fields
        if (!mappedProduct.name || !mappedProduct.sku) {
          throw new Error(`Invalid product data: Missing required fields (Name, SKU)`);
        }
        
        return mappedProduct;
      });
    }
    
    if (data.customers && Array.isArray(data.customers)) {
      cleaned.customers = data.customers.map((customer: any) => {
        const mappedCustomer = {
          id: customer.ID || customer.id || generateId(),
          name: customer.Name || customer.name || '',
          phone: customer.Phone || customer.phone || '',
          email: customer.Email || customer.email || '',
          address: customer.Address || customer.address || '',
          created_at: customer['Created At'] || customer.created_at || new Date().toISOString()
        };
        
        // Validate required fields
        if (!mappedCustomer.name || !mappedCustomer.phone) {
          throw new Error(`Invalid customer data: Missing required fields (Name, Phone)`);
        }
        
        return mappedCustomer;
      });
    }
    
    if (data.invoices && Array.isArray(data.invoices)) {
      cleaned.invoices = data.invoices.map((invoice: any) => {
        const mappedInvoice = {
          id: invoice.ID || invoice.id || generateId(),
          invoice_number: invoice['Invoice Number'] || invoice.invoice_number || generateInvoiceNumber(),
          customer_name: invoice['Customer Name'] || invoice.customer_name || '',
          customer_phone: invoice['Customer Phone'] || invoice.customer_phone || '',
          subtotal: parseFloat(invoice['Subtotal (₹)'] || invoice.subtotal) || 0,
          tax_percentage: parseFloat(invoice['Tax %'] || invoice.tax_percentage) || 0,
          tax_amount: parseFloat(invoice['Tax Amount (₹)'] || invoice.tax_amount) || 0,
          discount_percentage: parseFloat(invoice['Discount %'] || invoice.discount_percentage) || 0,
          discount_amount: parseFloat(invoice['Discount Amount (₹)'] || invoice.discount_amount) || 0,
          total_amount: parseFloat(invoice['Total Amount (₹)'] || invoice.total_amount) || 0,
          payment_method: (invoice['Payment Method'] || invoice.payment_method || 'cash').toLowerCase(),
          payment_status: (invoice['Payment Status'] || invoice.payment_status || 'pending').toLowerCase(),
          amount_paid: parseFloat(invoice['Amount Paid (₹)'] || invoice.amount_paid) || 0,
          items: invoice.items || [],
          created_at: invoice['Created At'] || invoice.created_at || new Date().toISOString(),
          updated_at: invoice['Updated At'] || invoice.updated_at || new Date().toISOString()
        };
        
        // Validate required fields
        if (!mappedInvoice.invoice_number || !mappedInvoice.customer_name) {
          throw new Error(`Invalid invoice data: Missing required fields (Invoice Number, Customer Name)`);
        }
        
        return mappedInvoice;
      });
    }
    
    if (data.bills && Array.isArray(data.bills)) {
      cleaned.bills = data.bills.map((bill: any) => {
        const mappedBill = {
          id: bill.ID || bill.id || generateId(),
          bill_number: bill['Bill Number'] || bill.bill_number || generateBillNumber(),
          customer_name: bill['Customer Name'] || bill.customer_name || '',
          customer_phone: bill['Customer Phone'] || bill.customer_phone || '',
          subtotal: parseFloat(bill['Subtotal (₹)'] || bill.subtotal) || 0,
          tax_percentage: parseFloat(bill['Tax %'] || bill.tax_percentage) || 0,
          tax_amount: parseFloat(bill['Tax Amount (₹)'] || bill.tax_amount) || 0,
          discount_percentage: parseFloat(bill['Discount %'] || bill.discount_percentage) || 0,
          discount_amount: parseFloat(bill['Discount Amount (₹)'] || bill.discount_amount) || 0,
          total_amount: parseFloat(bill['Total Amount (₹)'] || bill.total_amount) || 0,
          payment_method: (bill['Payment Method'] || bill.payment_method || 'cash').toLowerCase(),
          payment_status: (bill['Payment Status'] || bill.payment_status || 'pending').toLowerCase(),
          amount_paid: parseFloat(bill['Amount Paid (₹)'] || bill.amount_paid) || 0,
          items: bill.items || [],
          created_at: bill['Created At'] || bill.created_at || new Date().toISOString(),
          updated_at: bill['Updated At'] || bill.updated_at || new Date().toISOString()
        };
        
        // Validate required fields
        if (!mappedBill.bill_number || !mappedBill.customer_name) {
          throw new Error(`Invalid bill data: Missing required fields (Bill Number, Customer Name)`);
        }
        
        return mappedBill;
      });
    }
    
    // Handle business info and tax settings
    if (data.business_info) {
      cleaned.business_info = data.business_info;
    }
    
    if (data.tax_settings) {
      cleaned.tax_settings = data.tax_settings;
    }
    
    return cleaned;
  };

  // Helper functions
  const generateId = () => `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const generateInvoiceNumber = () => `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const generateBillNumber = () => `BILL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  // Cloud Sync Functions
  const syncToCloud = async () => {
    setIsSyncing(true);
    setSyncStatus('syncing');
    
    try {
      // Simulate cloud sync (in real implementation, this would connect to cloud storage)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Export data and simulate upload to cloud
      const db = Database.getInstance();
      const [products, customers, invoices, bills] = await Promise.all([
        db.query('products'),
        db.query('customers'),
        db.query('invoices'),
        db.query('bills')
      ]);

      const syncData = {
        sync_date: new Date().toISOString(),
        business_info: businessInfo,
        tax_settings: taxSettings,
        user_profile: userProfile,
        data: {
          products,
          customers,
          invoices,
          bills
        }
      };

      // In a real implementation, this would upload to cloud storage
      // For now, we'll store in localStorage as a simulation
      localStorage.setItem('cloud_backup', JSON.stringify(syncData));
      
      setSyncStatus('success');
      setLastBackup(new Date().toISOString());
      success('Data synced to cloud successfully!');
      
    } catch (err) {
      console.error('Cloud sync error:', err);
      setSyncStatus('error');
      error('Failed to sync to cloud. Please try again.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const restoreFromCloud = async () => {
    if (window.confirm('Are you sure you want to restore from cloud? This will replace your current data!')) {
      setIsSyncing(true);
      setSyncStatus('syncing');
      
      try {
        // In a real implementation, this would download from cloud storage
        const cloudData = localStorage.getItem('cloud_backup');
        
        if (!cloudData) {
          throw new Error('No cloud backup found');
        }
        
        const syncData = JSON.parse(cloudData);
        
        // Clear existing data
        const db = Database.getInstance();
        await db.query('DELETE FROM bills');
        await db.query('DELETE FROM invoices');
        await db.query('DELETE FROM customers');
        await db.query('DELETE FROM products');
        
        // Restore data
        if (syncData.data.products) {
          for (const product of syncData.data.products) {
            await db.insert('products', product);
          }
        }
        
        if (syncData.data.customers) {
          for (const customer of syncData.data.customers) {
            await db.insert('customers', customer);
          }
        }
        
        if (syncData.data.invoices) {
          for (const invoice of syncData.data.invoices) {
            await db.insert('invoices', invoice);
          }
        }
        
        if (syncData.data.bills) {
          for (const bill of syncData.data.bills) {
            await db.insert('bills', bill);
          }
        }
        
        setSyncStatus('success');
        success('Data restored from cloud successfully!');
        
      } catch (err) {
        console.error('Cloud restore error:', err);
        setSyncStatus('error');
        error('Failed to restore from cloud. Please try again.');
      } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncStatus('idle'), 3000);
      }
    }
  };

  const clearAllData = async () => {
    if (window.confirm('Are you sure you want to clear all data? This action cannot be undone!')) {
      try {
        const db = Database.getInstance();
        
        // Clear all data in reverse order to handle foreign key constraints
        await db.query('DELETE FROM bills');
        await db.query('DELETE FROM invoices');
        await db.query('DELETE FROM customers');
        await db.query('DELETE FROM products');
        
        success('All data cleared successfully!');
      } catch (err) {
        console.error('Clear data error:', err);
        error('Failed to clear data. Please try again.');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('settings.title')}</h1>
          <p className="text-gray-600 mt-1">{t('settings.subtitle')}</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center space-x-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
        >
          <Save className="h-4 w-4" />
          <span>{t('settings.saveChanges')}</span>
        </button>
      </div>

      <div className="flex space-x-6">
        {/* Settings Navigation */}
        <div className="w-64 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-amber-100 text-amber-700 border-r-4 border-amber-500'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          {activeTab === 'business' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">{t('settings.businessInformation')}</h2>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.businessName')} *
                  </label>
                  <input
                    type="text"
                    value={businessInfo.name}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.businessAddress')} *
                  </label>
                  <textarea
                    value={businessInfo.address}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    rows={3}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'user' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">{t('settings.userProfileTitle')}</h2>
              
              <div className="flex items-center space-x-6">
                <div className="h-20 w-20 bg-amber-100 rounded-full flex items-center justify-center">
                  <User className="h-10 w-10 text-amber-600" />
                </div>
                <div>
                  <button className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
                    {t('settings.uploadPhoto')}
                  </button>
                  <p className="text-sm text-gray-600 mt-2">{t('settings.photoRequirements')}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.fullName')} *
                  </label>
                  <input
                    type="text"
                    value={userProfile.name}
                    onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.userEmailAddress')} *
                  </label>
                  <input
                    type="email"
                    value={userProfile.email}
                    onChange={(e) => setUserProfile({ ...userProfile, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.userPhoneNumber')}
                  </label>
                  <input
                    type="tel"
                    value={userProfile.phone}
                    onChange={(e) => setUserProfile({ ...userProfile, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('settings.role')}
                  </label>
                  <select
                    value={userProfile.role}
                    onChange={(e) => setUserProfile({ ...userProfile, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="Owner">{t('settings.owner')}</option>
                    <option value="Manager">{t('settings.manager')}</option>
                    <option value="Staff">{t('settings.staff')}</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tax' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">{t('settings.taxConfiguration')}</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.defaultGstRate')}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={taxSettings.gst_rate}
                      onChange={(e) => setTaxSettings({ ...taxSettings, gst_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">{t('settings.applyTaxOnMakingCharges')}</h3>
                      <p className="text-sm text-gray-600">{t('settings.includeMakingChargesInTax')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={taxSettings.making_charge_tax}
                        onChange={(e) => setTaxSettings({ ...taxSettings, making_charge_tax: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">{t('settings.applyDiscountBeforeTax')}</h3>
                      <p className="text-sm text-gray-600">{t('settings.calculateTaxOnDiscountedAmount')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={taxSettings.discount_before_tax}
                        onChange={(e) => setTaxSettings({ ...taxSettings, discount_before_tax: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">{t('settings.dataManagementTitle')}</h2>
              
              <div className="space-y-6">
                {/* Cloud Sync Section */}
                <div className="p-6 border border-blue-200 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-4">
                    <Cloud className="h-5 w-5 text-blue-600" />
                    <h3 className="font-medium text-gray-900">Cloud Sync</h3>
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
                  <p className="text-sm text-gray-600 mb-4">
                    Sync your data to the cloud for automatic backup and access from anywhere.
                    {lastBackup && (
                      <span className="block mt-1 text-xs text-gray-500">
                        Last backup: {new Date(lastBackup).toLocaleString()}
                      </span>
                    )}
                  </p>
                  <div className="flex space-x-4">
                    <button 
                      onClick={syncToCloud}
                      disabled={isSyncing}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                        isSyncing 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      <Cloud className="h-4 w-4" />
                      <span>Sync to Cloud</span>
                    </button>
                    <button 
                      onClick={restoreFromCloud}
                      disabled={isSyncing}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                        isSyncing 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-amber-500 text-white hover:bg-amber-600'
                      }`}
                    >
                      <DatabaseIcon className="h-4 w-4" />
                      <span>Restore from Cloud</span>
                    </button>
                  </div>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                      onClick={exportInvoices}
                      disabled={isExporting}
                      className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                        isExporting 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      <Download className="h-4 w-4" />
                      <span>{t('settings.exportInvoices')}</span>
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
                      onClick={exportProductsCSV}
                      disabled={isExporting}
                      className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                        isExporting 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-indigo-500 text-white hover:bg-indigo-600'
                      }`}
                    >
                      <Download className="h-4 w-4" />
                      <span>Export Products (CSV)</span>
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
                    onClick={clearAllData}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{t('settings.clearAllData')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'notifications' || activeTab === 'security') && (
            <div className="text-center py-12">
              <div className="h-12 w-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                {activeTab === 'notifications' ? (
                  <Bell className="h-6 w-6 text-gray-400" />
                ) : (
                  <Shield className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {activeTab === 'notifications' ? t('settings.notificationsTitle') : t('settings.securitySettings')}
              </h3>
              <p className="text-gray-600">
                {t('settings.futureUpdates')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;