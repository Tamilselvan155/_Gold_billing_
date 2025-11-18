import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  User,
  ShoppingCart,
  Download,
  Trash2,
  Check,
  X,
  FileText,
  CreditCard,
  Scan,
  Eye,
  Package,
  Scale,
  Hash,
  Wrench,
  Calculator,
  Settings,
  Printer
} from 'lucide-react';
import jsPDF from 'jspdf';
import Database from '../utils/database';
import { Product, Bill, Invoice, InvoiceItem, Customer } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

const Billing: React.FC = () => {
  const { t } = useLanguage();
  const { success, error, loading, dismiss } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentBill, setCurrentBill] = useState<Partial<Bill>>({
    items: [],
    subtotal: 0,
    tax_percentage: 3,
    tax_amount: 0,
    discount_percentage: 0,
    discount_amount: 0,
    total_amount: 0,
    payment_method: 'cash',
    payment_status: 'pending',
    amount_paid: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalInitialView, setCustomerModalInitialView] = useState<'list' | 'add'>('list');
  const [customerFilter, setCustomerFilter] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [exchangeBills, setExchangeBills] = useState<Bill[]>([]);
  const [activeTab, setActiveTab] = useState<'billing' | 'invoice' | 'exchange'>('invoice');
  
  const handleWheel = useCallback((event: React.WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur();
  }, []);
  
  // Barcode scanner states
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [barcodeCache, setBarcodeCache] = useState<Map<string, Product>>(new Map());
  const [recentlyScanned, setRecentlyScanned] = useState<Set<string>>(new Set());
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Exchange material states (supports Gold, Silver, Platinum, Diamond, Other)
  const [exchangeMaterial, setExchangeMaterial] = useState({
    materialType: 'Gold' as 'Gold' | 'Silver' | 'Platinum' | 'Diamond' | 'Other',
    oldMaterialWeight: 0,
    oldMaterialPurity: '22K',
    oldMaterialRate: 0,
    oldMaterialValue: 0,
    exchangeRate: 0,
    exchangeValue: 0,
    difference: 0,
    exchangeItems: [] as InvoiceItem[],
  });

  // Form validation errors
  const [billFormErrors, setBillFormErrors] = useState<{
    tax_percentage?: string;
    discount_amount?: string;
    amount_paid?: string;
    payment_method?: string;
  }>({});

  const [itemErrors, setItemErrors] = useState<{
    [itemId: string]: {
      weight?: string;
      rate?: string;
      making_charge?: string;
      wastage_charge?: string;
      quantity?: string;
    };
  }>({});

  const [exchangeFormErrors, setExchangeFormErrors] = useState<{
    oldMaterialWeight?: string;
    oldMaterialRate?: string;
    exchangeRate?: string;
  }>({});

  // Memoized functions - declared before useEffect hooks
  const loadData = useCallback(async () => {
    try {
      const db = Database.getInstance();
      const [productData, customerData, billData, invoiceData] = await Promise.all([
        db.getProducts(),
        db.getCustomers(),
        db.getBills(),
        db.getInvoices()
      ]);
      
      setProducts(productData.filter((p: Product) => p.status === 'active'));
      setCustomers(customerData);
      
      // Separate exchange bills from regular bills
      const regularBills = billData.filter((bill: Bill) => !bill.bill_number?.startsWith('EXCH-'));
      const exchangeBillsData = billData.filter((bill: Bill) => bill.bill_number?.startsWith('EXCH-'));
      
      setRecentBills(regularBills.reverse());
      setExchangeBills(exchangeBillsData.reverse());
      setRecentInvoices(invoiceData.reverse());
      
      // Clear barcode cache when products are reloaded
      setBarcodeCache(new Map());
    } catch (err) {
      console.error('Error loading data:', err);
      error(t('billing.loadDataError'));
    }
  }, [error, t]);

  const calculateTotals = useCallback(() => {
    const items = currentBill.items || [];
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    
    const discountAmount = currentBill.discount_amount || 0;
    const discountedSubtotal = subtotal - discountAmount;
    const taxAmount = (discountedSubtotal * (currentBill.tax_percentage || 0)) / 100;
    const totalAmount = discountedSubtotal + taxAmount;

    setCurrentBill(prev => {
      // Only update if values actually changed to prevent unnecessary re-renders
      if (prev.subtotal === subtotal && prev.tax_amount === taxAmount && prev.total_amount === totalAmount) {
        return prev;
      }
      return {
        ...prev,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      };
    });
  }, [currentBill.items, currentBill.discount_amount, currentBill.tax_percentage]);

  const calculateExchangeTotals = useCallback(() => {
    const oldMaterialValue = exchangeMaterial.oldMaterialWeight * exchangeMaterial.oldMaterialRate;
    const exchangeItemsTotal = exchangeMaterial.exchangeItems.reduce((sum, item) => sum + item.total, 0);
    const difference = exchangeItemsTotal - oldMaterialValue;

    setExchangeMaterial(prev => {
      // Only update if values actually changed to prevent unnecessary re-renders
      if (prev.oldMaterialValue === oldMaterialValue && 
          prev.exchangeValue === exchangeItemsTotal && 
          prev.difference === difference) {
        return prev;
      }
      return {
        ...prev,
        oldMaterialValue,
        exchangeValue: exchangeItemsTotal,
        difference,
      };
    });
  }, [exchangeMaterial.oldMaterialWeight, exchangeMaterial.oldMaterialRate, exchangeMaterial.exchangeItems]);

  // useEffect hooks - placed after function declarations
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    calculateTotals();
  }, [calculateTotals]);

  useEffect(() => {
    calculateExchangeTotals();
  }, [calculateExchangeTotals]);

  // Get purity options based on material type - memoized
  const getPurityOptions = useCallback((materialType: string) => {
    switch (materialType) {
      case 'Gold':
        return ['24K', '22K', '18K', '14K'];
      case 'Silver':
        return ['999', '925', '900', '875'];
      case 'Platinum':
        return ['950', '900', '850'];
      case 'Diamond':
        return ['D', 'E', 'F', 'G', 'H', 'I', 'J'];
      default:
        return ['24K', '22K', '18K', '14K', '999', '925', 'Other'];
    }
  }, []);

  const addProductToBill = useCallback((product: Product) => {
    setCurrentBill(prev => {
      const items = prev.items || [];
      const existingItemIndex = items.findIndex(
        item => item.product_id === product.id
      );

      if (existingItemIndex >= 0) {
        const updatedItems = [...items];
        updatedItems[existingItemIndex].quantity += 1;
        updatedItems[existingItemIndex].total = 
          (updatedItems[existingItemIndex].weight * updatedItems[existingItemIndex].rate + 
           updatedItems[existingItemIndex].making_charge + 
           (updatedItems[existingItemIndex].wastage_charge || 0)) * updatedItems[existingItemIndex].quantity;
        
        return { ...prev, items: updatedItems };
      } else {
        const newItem: InvoiceItem = {
          id: Date.now().toString(),
          product_id: product.id,
          product_name: product.name,
          weight: product.weight,
          rate: 0, // Start with 0, user will enter in billing
          making_charge: 0, // Start with 0, user will enter in billing
          wastage_charge: 0,
          quantity: 1,
          total: 0, // Will be calculated when user enters rate
        };

        return {
          ...prev,
          items: [...items, newItem],
        };
      }
    });
  }, []);

  const updateBillItem = useCallback((itemId: string, updates: Partial<InvoiceItem>) => {
    setCurrentBill(prev => {
      const items = prev.items || [];
      const updatedItems = items.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, ...updates };
          
          // Validate numeric inputs
          if (updates.weight !== undefined && (isNaN(updates.weight) || updates.weight <= 0)) {
            return item;
          }
          if (updates.rate !== undefined && (isNaN(updates.rate) || updates.rate <= 0)) {
            return item;
          }
          if (updates.quantity !== undefined && (isNaN(updates.quantity) || updates.quantity <= 0)) {
            return item;
          }
          if (updates.making_charge !== undefined && (isNaN(updates.making_charge) || updates.making_charge < 0)) {
            return item;
          }
          if (updates.wastage_charge !== undefined && (isNaN(updates.wastage_charge) || updates.wastage_charge < 0)) {
            return item;
          }
          
          updatedItem.total = (updatedItem.weight * updatedItem.rate + updatedItem.making_charge + (updatedItem.wastage_charge || 0)) * updatedItem.quantity;
          return updatedItem;
        }
        return item;
      });

      return { ...prev, items: updatedItems };
    });
  }, []);

  const removeBillItem = useCallback((itemId: string) => {
    setCurrentBill(prev => ({
      ...prev,
      items: (prev.items || []).filter(item => item.id !== itemId),
    }));
  }, []);

  // Exchange material functions
  const addProductToExchange = useCallback((product: Product) => {
    setExchangeMaterial(prev => {
      const exchangeItems = prev.exchangeItems;
      const existingItemIndex = exchangeItems.findIndex(
        item => item.product_id === product.id
      );

      if (existingItemIndex >= 0) {
        const updatedItems = [...exchangeItems];
        updatedItems[existingItemIndex].quantity += 1;
        updatedItems[existingItemIndex].total = 
          (updatedItems[existingItemIndex].weight * updatedItems[existingItemIndex].rate + 
           updatedItems[existingItemIndex].making_charge + 
           (updatedItems[existingItemIndex].wastage_charge || 0)) * updatedItems[existingItemIndex].quantity;
        
        return { ...prev, exchangeItems: updatedItems };
      } else {
        const newItem: InvoiceItem = {
          id: Date.now().toString(),
          product_id: product.id,
          product_name: product.name,
          weight: product.weight,
          rate: 0, // Start with 0, user will enter in billing
          making_charge: 0, // Start with 0, user will enter in billing
          wastage_charge: 0,
          quantity: 1,
          total: 0, // Will be calculated when user enters rate
        };

        return {
          ...prev,
          exchangeItems: [...exchangeItems, newItem],
        };
      }
    });
  }, []);

  const updateExchangeItem = useCallback((itemId: string, updates: Partial<InvoiceItem>) => {
    setExchangeMaterial(prev => {
      const exchangeItems = prev.exchangeItems;
      const updatedItems = exchangeItems.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, ...updates };
          
          // Validate numeric inputs
          if (updates.weight !== undefined && (isNaN(updates.weight) || updates.weight <= 0)) {
            return item;
          }
          if (updates.rate !== undefined && (isNaN(updates.rate) || updates.rate <= 0)) {
            return item;
          }
          if (updates.quantity !== undefined && (isNaN(updates.quantity) || updates.quantity <= 0)) {
            return item;
          }
          if (updates.making_charge !== undefined && (isNaN(updates.making_charge) || updates.making_charge < 0)) {
            return item;
          }
          if (updates.wastage_charge !== undefined && (isNaN(updates.wastage_charge) || updates.wastage_charge < 0)) {
            return item;
          }
          
          updatedItem.total = (updatedItem.weight * updatedItem.rate + updatedItem.making_charge + (updatedItem.wastage_charge || 0)) * updatedItem.quantity;
          return updatedItem;
        }
        return item;
      });

      return { ...prev, exchangeItems: updatedItems };
    });
  }, []);

  const removeExchangeItem = useCallback((itemId: string) => {
    setExchangeMaterial(prev => ({
      ...prev,
      exchangeItems: prev.exchangeItems.filter(item => item.id !== itemId),
    }));
  }, []);

  // Barcode scanner functions
  // This implementation handles both dedicated barcode scanner hardware and manual input
  // Barcode scanners typically send input as rapid keyboard events, which this handles
  // with a timeout-based approach to distinguish between scanner and manual input
  
  const validateBarcode = useCallback((barcode: string): boolean => {
    // Basic barcode validation - can be enhanced based on barcode types
    if (!barcode || barcode.length < 3) return false;
    
    // Check if barcode contains only alphanumeric characters and common barcode characters
    const barcodeRegex = /^[A-Za-z0-9\-_]+$/;
    return barcodeRegex.test(barcode);
  }, []);

  const findProductByBarcode = useCallback(async (barcode: string): Promise<Product | null> => {
    // Check cache first
    const cached = barcodeCache.get(barcode);
    if (cached) {
      return cached;
    }

    // Search in products array
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      // Cache the result
      setBarcodeCache(prev => new Map(prev).set(barcode, product));
      return product;
    }

    return null;
  }, [products, barcodeCache]);

  const processBarcode = useCallback(async (barcode: string) => {
    if (!validateBarcode(barcode)) {
      error(t('billing.invalidBarcode'));
      setBarcodeInput('');
      return;
    }

    setIsScanning(true);
    
    try {
      const product = await findProductByBarcode(barcode);
      
      if (product) {
        // Check if product is active
        if (product.status !== 'active') {
          error(t('billing.productInactive'));
          setBarcodeInput('');
          return;
        }

        // Check stock availability for billing and exchange (both deduct stock)
        if ((activeTab === 'billing' || activeTab === 'exchange') && product.stock_quantity <= 0) {
          error(t('billing.productOutOfStock', { product: product.name }));
          setBarcodeInput('');
          return;
        }

        // Add product to bill/invoice or exchange
        if (activeTab === 'exchange') {
          addProductToExchange(product);
        } else {
          addProductToBill(product);
        }
        
        // Track recently scanned product
        setRecentlyScanned(prev => new Set(prev).add(product.id));
        
        // Clear recently scanned indicator after 3 seconds
        setTimeout(() => {
          setRecentlyScanned(prev => {
            const newSet = new Set(prev);
            newSet.delete(product.id);
            return newSet;
          });
        }, 3000);
        
        success(t('billing.scanSuccess'));
        setBarcodeInput('');
      } else {
        error(t('billing.barcodeNotFound'));
        setBarcodeInput('');
      }
    } catch (err) {
      console.error('Error processing barcode:', err);
      error(t('billing.barcodeProcessingError'));
      setBarcodeInput('');
    } finally {
      setIsScanning(false);
    }
  }, [validateBarcode, findProductByBarcode, activeTab, addProductToExchange, addProductToBill, error, success, t]);

  const handleBarcodeInput = useCallback(async (value: string) => {
    setBarcodeInput(value);
    
    // Clear existing timeout
    if (barcodeTimeoutRef.current) {
      clearTimeout(barcodeTimeoutRef.current);
    }

    // Set a timeout to process barcode after user stops typing (typical barcode scanner behavior)
    barcodeTimeoutRef.current = setTimeout(async () => {
      if (value.trim()) {
        await processBarcode(value.trim());
      }
    }, 100); // 100ms delay to handle rapid barcode scanner input
  }, [processBarcode]);

  const handleBarcodeKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Enter key for manual barcode entry
    if (e.key === 'Enter' && barcodeInput.trim()) {
      e.preventDefault();
      processBarcode(barcodeInput.trim());
    }
  }, [barcodeInput, processBarcode]);

  // Focus barcode input on component mount
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  // Keyboard shortcut to focus barcode scanner (Ctrl/Cmd + B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, []);

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.customer-filter-container')) {
        setShowCustomerDropdown(false);
      }
    };

    if (showCustomerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showCustomerDropdown]);

  const saveBill = async () => {
    if (!currentBill.items?.length) {
      error(t('billing.addAtLeastOneItem'));
      return;
    }

    if (!selectedCustomer && !currentBill.customer_name) {
      error(t('billing.selectCustomerOrEnter'));
      return;
    }

    // Check stock availability before creating bill (now deducts stock)
    for (const item of currentBill.items || []) {
      const product = products.find(p => p.id === item.product_id);
      if (product && product.stock_quantity < item.quantity) {
        error(`Insufficient stock for ${item.product_name}. Available: ${product.stock_quantity}, Required: ${item.quantity}`);
        return;
      }
    }

    loading(t('billing.creatingBill'));
    
    try {
      const db = Database.getInstance();
      const billNumber = `BILL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      
      const billData = {
        invoice_number: billNumber, // API expects invoice_number but stores as bill_number
        customer_id: selectedCustomer?.id,
        customer_name: selectedCustomer?.name || currentBill.customer_name,
        customer_phone: selectedCustomer?.phone || currentBill.customer_phone,
        items: currentBill.items,
        subtotal: currentBill.subtotal,
        tax_percentage: currentBill.tax_percentage,
        tax_amount: currentBill.tax_amount,
        discount_percentage: currentBill.discount_percentage,
        discount_amount: currentBill.discount_amount,
        total_amount: currentBill.total_amount,
        payment_method: currentBill.payment_method,
        payment_status: currentBill.payment_status,
        amount_paid: currentBill.amount_paid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const savedBill = await db.createBill(billData);
      
      // Deduct inventory for each item (now deducts stock)
      for (const item of currentBill.items || []) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          await db.updateProduct(item.product_id, {
            stock_quantity: product.stock_quantity - item.quantity
          });
        }
      }
      
      // Generate PDF automatically after saving
      try {
        const billWithNumber = {
          ...savedBill,
          bill_number: billNumber,
          created_at: savedBill.created_at || new Date().toISOString(),
        };
        generateBillPDF(billWithNumber as Bill);
      } catch (pdfError) {
        console.error('Error generating PDF:', pdfError);
        // Don't fail the save if PDF generation fails
      }
      
      // Reset the form
      setCurrentBill({
        items: [],
        subtotal: 0,
        tax_percentage: 3,
        tax_amount: 0,
        discount_percentage: 0,
        discount_amount: 0,
        total_amount: 0,
        payment_method: 'cash',
        payment_status: 'pending',
        amount_paid: 0,
      });
      setSelectedCustomer(null);
      
      // Reload recent bills
      await loadData();
      
      success(t('billing.billSavedSuccess'));
    } catch (err) {
      console.error('Error saving bill:', err);
      error(t('billing.billSaveError'));
    } finally {
      dismiss();
    }
  };

  const saveInvoice = async () => {
    if (!currentBill.items?.length) {
      error(t('billing.addAtLeastOneItem'));
      return;
    }

    if (!selectedCustomer && !currentBill.customer_name) {
      error(t('billing.selectCustomerOrEnter'));
      return;
    }

    loading(t('billing.creatingInvoice'));

    try {
      const db = Database.getInstance();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      
      const invoiceData = {
        invoice_number: invoiceNumber,
        customer_id: selectedCustomer?.id,
        customer_name: selectedCustomer?.name || currentBill.customer_name,
        customer_phone: selectedCustomer?.phone || currentBill.customer_phone,
        items: currentBill.items,
        subtotal: currentBill.subtotal,
        tax_percentage: currentBill.tax_percentage,
        tax_amount: currentBill.tax_amount,
        discount_percentage: currentBill.discount_percentage,
        discount_amount: currentBill.discount_amount,
        total_amount: currentBill.total_amount,
        payment_method: currentBill.payment_method,
        payment_status: currentBill.payment_status,
        amount_paid: currentBill.amount_paid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const savedInvoice = await db.createInvoice(invoiceData);
      
      // Generate PDF automatically after saving
      try {
        const invoiceWithNumber = {
          ...savedInvoice,
          invoice_number: invoiceNumber,
          created_at: savedInvoice.created_at || new Date().toISOString(),
        };
        generateInvoicePDF(invoiceWithNumber as Invoice);
      } catch (pdfError) {
        console.error('Error generating PDF:', pdfError);
        // Don't fail the save if PDF generation fails
      }
      
      // Reset the form
      setCurrentBill({
        items: [],
        subtotal: 0,
        tax_percentage: 3,
        tax_amount: 0,
        discount_percentage: 0,
        discount_amount: 0,
        total_amount: 0,
        payment_method: 'cash',
        payment_status: 'pending',
        amount_paid: 0,
      });
      setSelectedCustomer(null);
      
      // Reload data
      await loadData();
      
      success(t('billing.invoiceSavedSuccess'));
    } catch (err) {
      console.error('Error saving invoice:', err);
      error(t('billing.invoiceSaveError'));
    } finally {
      dismiss();
    }
  };

  const saveExchangeBill = async () => {
    if (!exchangeMaterial.exchangeItems.length) {
      error(t('billing.addExchangeItemsError'));
      return;
    }

    if (exchangeMaterial.oldMaterialWeight <= 0) {
      error(t('billing.enterOldMaterialWeight'));
      return;
    }

    if (!selectedCustomer && !currentBill.customer_name) {
      error(t('billing.selectCustomerOrEnter'));
      return;
    }

    // Check stock availability for exchange items
    for (const item of exchangeMaterial.exchangeItems || []) {
      const product = products.find(p => p.id === item.product_id);
      if (product && product.stock_quantity < item.quantity) {
        error(t('billing.insufficientStock', { product: item.product_name, available: product.stock_quantity, required: item.quantity }));
        return;
      }
    }

    loading(t('billing.creatingExchangeBill'));
    
    try {
      const db = Database.getInstance();
      const exchangeBillNumber = `EXCH-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      
      // Calculate totals for exchange items
      const exchangeSubtotal = exchangeMaterial.exchangeItems.reduce((sum, item) => sum + item.total, 0);
      const exchangeTaxAmount = (exchangeSubtotal * (currentBill.tax_percentage || 0)) / 100;
      const exchangeDiscountAmount = currentBill.discount_amount || 0;
      const exchangeTotalAmount = exchangeSubtotal - exchangeDiscountAmount + exchangeTaxAmount;
      
      const exchangeBillData = {
        invoice_number: exchangeBillNumber, // API expects invoice_number but stores as bill_number
        customer_id: selectedCustomer?.id,
        customer_name: selectedCustomer?.name || currentBill.customer_name,
        customer_phone: selectedCustomer?.phone || currentBill.customer_phone,
        items: exchangeMaterial.exchangeItems,
        subtotal: exchangeSubtotal,
        tax_percentage: currentBill.tax_percentage || 0,
        tax_amount: exchangeTaxAmount,
        discount_percentage: currentBill.discount_percentage || 0,
        discount_amount: exchangeDiscountAmount,
        total_amount: exchangeTotalAmount,
        payment_method: currentBill.payment_method || 'cash',
        payment_status: exchangeMaterial.difference >= 0 ? 'pending' : 'paid', // If customer pays, pending; if receives, paid
        amount_paid: exchangeMaterial.difference < 0 ? Math.abs(exchangeMaterial.difference) : 0,
        // Exchange-specific fields (will be stored in notes or as JSON)
        old_gold_weight: exchangeMaterial.oldMaterialWeight,
        old_gold_purity: exchangeMaterial.oldMaterialPurity,
        old_gold_rate: exchangeMaterial.oldMaterialRate,
        old_gold_value: exchangeMaterial.oldMaterialValue,
        exchange_rate: exchangeMaterial.exchangeRate,
        exchange_difference: exchangeMaterial.difference,
        material_type: exchangeMaterial.materialType, // Store material type
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const savedBill = await db.createBill(exchangeBillData);
      
      // Deduct inventory for exchange items (items given to customer) - same as Billing tab
      for (const item of exchangeMaterial.exchangeItems || []) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          const newStockQuantity = product.stock_quantity - item.quantity;
          if (newStockQuantity < 0) {
            error(`Cannot deduct more stock than available for ${item.product_name}`);
            return;
          }
          await db.updateProduct(item.product_id, {
            stock_quantity: newStockQuantity
          });
        }
      }
      
      // Generate PDF automatically after saving
      try {
        const billWithExchangeData = {
          ...savedBill,
          bill_number: exchangeBillNumber,
          created_at: savedBill.created_at || new Date().toISOString(),
          old_gold_weight: exchangeMaterial.oldMaterialWeight,
          old_gold_purity: exchangeMaterial.oldMaterialPurity,
          old_gold_rate: exchangeMaterial.oldMaterialRate,
          old_gold_value: exchangeMaterial.oldMaterialValue,
          exchange_rate: exchangeMaterial.exchangeRate,
          exchange_difference: exchangeMaterial.difference,
          material_type: exchangeMaterial.materialType,
        };
        generateBillPDF(billWithExchangeData as Bill);
      } catch (pdfError) {
        console.error('Error generating PDF:', pdfError);
        // Don't fail the save if PDF generation fails
      }
      
      // Reset the exchange form
      setExchangeMaterial({
        materialType: 'Gold',
        oldMaterialWeight: 0,
        oldMaterialPurity: '22K',
        oldMaterialRate: 0,
        oldMaterialValue: 0,
        exchangeRate: 0,
        exchangeValue: 0,
        difference: 0,
        exchangeItems: [],
      });
      setSelectedCustomer(null);
      setCurrentBill({
        items: [],
        subtotal: 0,
        tax_percentage: 3,
        tax_amount: 0,
        discount_percentage: 0,
        discount_amount: 0,
        total_amount: 0,
        payment_method: 'cash',
        payment_status: 'pending',
        amount_paid: 0,
      });
      
      // Reload data to refresh products with updated stock
      await loadData();
      
      success(t('billing.exchangeBillSavedSuccess'));
    } catch (err) {
      console.error('Error saving exchange bill:', err);
      error(t('billing.exchangeBillSaveError'));
    } finally {
      dismiss();
    }
  };

  const CustomerModal: React.FC<{
    onClose: () => void;
    onSelect: (customer: Customer) => void;
    initialView?: 'list' | 'add';
  }> = ({ onClose, onSelect, initialView = 'list' }) => {
    const [newCustomer, setNewCustomer] = useState({
      name: '',
      phone: '',
      email: '',
      address: '',
    });
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
    const [showAddForm, setShowAddForm] = useState(initialView === 'add');
    const [customerErrors, setCustomerErrors] = useState<{
      name?: string;
      phone?: string;
      email?: string;
    }>({});

    // Update view when initialView prop changes
    useEffect(() => {
      setShowAddForm(initialView === 'add');
    }, [initialView]);

    // Validate customer form
    const validateCustomer = (): boolean => {
      const errors: { name?: string; phone?: string; email?: string } = {};
      
      // Name validation
      if (!newCustomer.name.trim()) {
        errors.name = t('billing.nameRequired');
      } else if (newCustomer.name.trim().length < 2) {
        errors.name = t('billing.nameMinLength');
      }
      
      // Phone validation
      if (!newCustomer.phone.trim()) {
        errors.phone = t('billing.phoneRequired');
      } else {
        const phoneRegex = /^[0-9]{10}$/;
        const cleanedPhone = newCustomer.phone.replace(/[\s\-\(\)]/g, '');
        if (!phoneRegex.test(cleanedPhone) || cleanedPhone.length !== 10) {
          errors.phone = t('billing.phoneInvalid');
        }
      }
      
      // Email validation (optional but must be valid if provided)
      if (newCustomer.email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newCustomer.email.trim())) {
          errors.email = t('billing.emailInvalid');
        }
      }
      
      setCustomerErrors(errors);
      return Object.keys(errors).length === 0;
    };

    const handleAddCustomer = async () => {
      if (!validateCustomer()) {
        return;
      }

      try {
        const db = Database.getInstance();
        const customerData = await db.createCustomer(newCustomer);
        setCustomers([...customers, customerData]);
        // Reset form and errors
        setNewCustomer({ name: '', phone: '', email: '', address: '' });
        setCustomerErrors({});
        // Select the new customer and close modal
        onSelect(customerData);
        onClose();
        success(t('billing.customerCreatedSuccess'));
      } catch (err) {
        console.error('Error creating customer:', err);
        error(t('billing.customerCreateError'));
      }
    };

    // Filter customers based on search term
    const filteredCustomers = useMemo(() => {
      if (!customerSearchTerm.trim()) return customers;
      const searchLower = customerSearchTerm.toLowerCase().trim();
      return customers.filter(customer =>
        customer.name?.toLowerCase().includes(searchLower) ||
        customer.phone?.toLowerCase().includes(searchLower) ||
        customer.email?.toLowerCase().includes(searchLower)
      );
    }, [customers, customerSearchTerm]);

    const handleDeleteCustomer = async () => {
      if (!customerToDelete) return;

      try {
        const db = Database.getInstance();
        await db.deleteCustomer(customerToDelete.id);
        
        // Remove from customers list
        setCustomers(customers.filter(c => c.id !== customerToDelete.id));
        
        // If deleted customer was selected, clear selection
        if (selectedCustomer?.id === customerToDelete.id) {
          setSelectedCustomer(null);
          setCurrentBill(prev => ({
            ...prev,
            customer_name: '',
            customer_phone: ''
          }));
        }
        
        setCustomerToDelete(null);
        success('Customer deleted successfully!');
      } catch (err: any) {
        console.error('Error deleting customer:', err);
        // Extract error message from backend response
        const errorMessage = err?.response?.data?.error || err?.message || 'Failed to delete customer. Please try again.';
        error(errorMessage);
      }
    };

    return (
      <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-300">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {showAddForm ? t('billing.addNewCustomer') : t('billing.selectCustomer')}
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Navigation Tabs */}
            <div className="flex space-x-2 border-b border-gray-200">
              <button
                onClick={() => setShowAddForm(false)}
                className={`px-4 py-2 font-medium transition-colors ${
                  !showAddForm
                    ? 'text-amber-600 border-b-2 border-amber-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('billing.existingCustomers')}
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className={`px-4 py-2 font-medium transition-colors ${
                  showAddForm
                    ? 'text-amber-600 border-b-2 border-amber-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t('billing.addNewCustomer')}
              </button>
            </div>

            {showAddForm ? (
              /* Add New Customer Form */
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-4">{t('billing.addNewCustomer')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="text"
                    placeholder={`${t('billing.fullName')} *`}
                    value={newCustomer.name}
                    onChange={(e) => {
                      setNewCustomer({ ...newCustomer, name: e.target.value });
                      if (customerErrors.name) {
                        setCustomerErrors({ ...customerErrors, name: undefined });
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                      customerErrors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {customerErrors.name && (
                    <p className="mt-1 text-xs text-red-600">{customerErrors.name}</p>
                  )}
                </div>
                <div>
                  <input
                    type="tel"
                    placeholder={`${t('billing.phoneNumber')} *`}
                    value={newCustomer.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '').slice(0, 10);
                      setNewCustomer({ ...newCustomer, phone: value });
                      if (customerErrors.phone) {
                        setCustomerErrors({ ...customerErrors, phone: undefined });
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                      customerErrors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {customerErrors.phone && (
                    <p className="mt-1 text-xs text-red-600">{customerErrors.phone}</p>
                  )}
                </div>
                <div>
                  <input
                    type="email"
                    placeholder={t('billing.emailOptional')}
                    value={newCustomer.email}
                    onChange={(e) => {
                      setNewCustomer({ ...newCustomer, email: e.target.value });
                      if (customerErrors.email) {
                        setCustomerErrors({ ...customerErrors, email: undefined });
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                      customerErrors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {customerErrors.email && (
                    <p className="mt-1 text-xs text-red-600">{customerErrors.email}</p>
                  )}
                </div>
                <div>
                  <input
                    type="text"
                    placeholder={t('billing.addressOptional')}
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>
              <button
                onClick={handleAddCustomer}
                className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
              >
                {t('billing.addCustomer')}
              </button>
            </div>
            ) : (
            /* Existing Customers */
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">{t('billing.existingCustomers')}</h3>
                <span className="text-sm text-gray-500">
                  {filteredCustomers.length} {filteredCustomers.length === 1 ? 'customer' : 'customers'}
                </span>
              </div>
              
              {/* Customer Search Filter */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, phone, or email..."
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                  {customerSearchTerm && (
                    <button
                      onClick={() => setCustomerSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-amber-50 hover:border-amber-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div
                          onClick={() => {
                            onSelect(customer);
                            onClose();
                          }}
                          className="flex-1 cursor-pointer"
                        >
                          <p className="font-medium text-gray-900">{customer.name}</p>
                          <p className="text-sm text-gray-600">{customer.phone}</p>
                          {customer.email && (
                            <p className="text-xs text-gray-500">{customer.email}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Check className="h-5 w-5 text-amber-500" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomerToDelete(customer);
                            }}
                            className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            title="Delete customer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">
                      {customerSearchTerm ? 'No customers found matching your search' : 'No customers found'}
                    </p>
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Customer Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-300">
              <h3 className="text-lg font-bold text-gray-900">Delete Customer</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete <span className="font-semibold">{customerToDelete.name}</span>? This action cannot be undone.
              </p>
              <div className="flex space-x-3 justify-end">
                <button
                  onClick={() => setCustomerToDelete(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCustomer}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
    );
  };

  // Memoize filtered products to avoid recalculating on every render
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return products.filter(product =>
      product.name.toLowerCase().includes(lowerSearchTerm) ||
      product.sku.toLowerCase().includes(lowerSearchTerm)
    );
  }, [products, searchTerm]);

  // Filter customers based on search term in Customer Information section
  const filteredCustomersList = useMemo(() => {
    if (!customerFilter.trim()) {
      // Show first 10 customers if no filter and dropdown is open
      return showCustomerDropdown ? customers.slice(0, 10) : [];
    }
    const searchLower = customerFilter.toLowerCase().trim();
    return customers.filter(customer =>
      customer.name?.toLowerCase().includes(searchLower) ||
      customer.phone?.toLowerCase().includes(searchLower) ||
      customer.email?.toLowerCase().includes(searchLower)
    ).slice(0, 10); // Limit to 10 results
  }, [customers, customerFilter, showCustomerDropdown]);

  const generateBillPDF = (bill: Bill) => {
    try {
      if (!bill) {
        error('Invalid bill data');
        return;
      }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = 25;

    // Add gold/brown border strips (exact template colors)
    doc.setFillColor(218, 165, 32); // Gold color for borders
    doc.rect(0, 0, 10, pageHeight, 'F'); // Left border
    doc.rect(pageWidth - 10, 0, 10, pageHeight, 'F'); // Right border
    doc.rect(0, 0, pageWidth, 10, 'F'); // Top border
    doc.rect(0, pageHeight - 10, pageWidth, 10, 'F'); // Bottom border

    // Header with Tamil text (exact template text)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ஸ்ரீ காத்தாயி அம்மன் துணை', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    doc.text('வர்ணமிகு நகைகளுக்கு', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Left side business details (exact template layout)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // B15 Logo placeholder (blue triangle)
    doc.setFillColor(0, 0, 255); // Blue color
    doc.rect(margin, yPosition, 8, 8, 'F');
    doc.setFillColor(255, 255, 255); // White text
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('B15', margin + 2, yPosition + 6);
    
    // Reset font
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    doc.text('GSTIN: 33DIZPK7238G1ZP', margin, yPosition + 12);
    doc.text('Mobile: 98432 95615', margin, yPosition + 20);
    doc.text('Address: அகரம் சீகூர்', margin, yPosition + 28);
    doc.text('(பார்டர்) - 621 108.', margin, yPosition + 36);
    doc.text('பெரம்பலூர் Dt.', margin, yPosition + 44);

    // Right side branding (exact template layout)
    // VKV Logo placeholder (circular with yellow/red)
    const logoX = pageWidth - margin - 25;
    doc.setFillColor(255, 255, 0); // Yellow outer ring
    doc.circle(logoX, yPosition + 10, 8, 'F');
    doc.setFillColor(255, 0, 0); // Red inner circle
    doc.circle(logoX, yPosition + 10, 6, 'F');
    doc.setFillColor(255, 255, 255); // White text
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('VKV', logoX - 2, yPosition + 12);
    
    // Tamil words below logo
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('நம்பிக்கை', logoX - 4, yPosition + 18);
    doc.text('தரம்', logoX - 2, yPosition + 24);
    
    // Company name (exact Tamil text)
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ஸ்ரீ வண்ணமயில்', pageWidth - margin, yPosition + 35, { align: 'right' });
    doc.text('தங்கமாளிகை', pageWidth - margin, yPosition + 45, { align: 'right' });
    
    // Slogan in red
    doc.setFillColor(255, 0, 0); // Red text
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('916 KDM ஹால்மார்க் ஷோரூம்', pageWidth - margin, yPosition + 55, { align: 'right' });

    yPosition += 70;

    // Invoice Details section header (light gray box)
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition, pageWidth - 2 * margin, 15, 'F');
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice Details', pageWidth / 2, yPosition + 10, { align: 'center' });
    yPosition += 20;

    // Check if this is an exchange bill
    const isExchange = bill.bill_number?.startsWith('EXCH-');

    // Customer information box (left side)
    const customerBoxHeight = isExchange && (bill as any).old_gold_weight ? 60 : 45;
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition, 120, customerBoxHeight, 'F');
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Customer Name & address', margin + 5, yPosition + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.customer_name || '', margin + 5, yPosition + 18);
    if (bill.customer_phone) {
      doc.text(`Phone: ${bill.customer_phone}`, margin + 5, yPosition + 28);
    }
    
    // Add exchange details in customer box if applicable
    if (isExchange && (bill as any).old_gold_weight) {
      doc.setFont('helvetica', 'bold');
      doc.text('Old Gold:', margin + 5, yPosition + 38);
      doc.setFont('helvetica', 'normal');
      doc.text(`${(bill as any).old_gold_weight}g (${(bill as any).old_gold_purity || '22K'})`, margin + 5, yPosition + 48);
      if ((bill as any).exchange_difference !== undefined) {
        const diff = (bill as any).exchange_difference;
        doc.setFont('helvetica', 'bold');
        doc.text(`${diff >= 0 ? 'Pay' : 'Receive'}:`, margin + 5, yPosition + 56);
        doc.setFont('helvetica', 'normal');
        doc.text(`₹${Math.abs(diff).toLocaleString()}`, margin + 5, yPosition + 66);
      }
    }

    // Right side boxes (DATE, Time, NO)
    const rightBoxX = pageWidth - margin - 80;
    const boxWidth = 80;
    const boxHeight = 12;
    
    // DATE box
    doc.setFillColor(240, 240, 240);
    doc.rect(rightBoxX, yPosition, boxWidth, boxHeight, 'F');
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DATE', rightBoxX + 5, yPosition + 8);
    doc.setFont('helvetica', 'normal');
    const billDate = bill.created_at ? new Date(bill.created_at) : new Date();
    doc.text(billDate.toLocaleDateString('en-IN'), rightBoxX + 5, yPosition + 18);
    
    // Time box
    doc.setFillColor(240, 240, 240);
    doc.rect(rightBoxX, yPosition + 15, boxWidth, boxHeight, 'F');
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFont('helvetica', 'bold');
    doc.text('Time', rightBoxX + 5, yPosition + 23);
    doc.setFont('helvetica', 'normal');
    doc.text(billDate.toLocaleTimeString('en-IN'), rightBoxX + 5, yPosition + 33);
    
    // NO box
    doc.setFillColor(240, 240, 240);
    doc.rect(rightBoxX, yPosition + 30, boxWidth, boxHeight, 'F');
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFont('helvetica', 'bold');
    doc.text('NO', rightBoxX + 5, yPosition + 38);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.bill_number || '', rightBoxX + 5, yPosition + 48);

    yPosition += (isExchange && (bill as any).old_gold_weight ? 75 : 60);

    // First dotted line
    doc.setLineWidth(0.5);
    doc.setDrawColor(150, 150, 150);
    for (let i = margin; i < pageWidth - margin; i += 4) {
      doc.line(i, yPosition, i + 2, yPosition);
    }
    yPosition += 15;

    // Items table header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const colPositions = [margin + 5, margin + 30, margin + 95, margin + 130, margin + 165, margin + 190];
    
    doc.text('Qty', colPositions[0], yPosition);
    doc.text('Description', colPositions[1], yPosition);
    doc.text('HSN/SAC', colPositions[2], yPosition);
    doc.text('Rate', colPositions[3], yPosition);
    doc.text('Gross Wt.', colPositions[4], yPosition);
    doc.text('Taxable Amount', colPositions[5], yPosition);
    yPosition += 10;

    // Items table data
    doc.setFont('helvetica', 'normal');
    if (bill.items && Array.isArray(bill.items)) {
      bill.items.forEach((item: any) => {
        doc.text(item.quantity?.toString() || '1', colPositions[0], yPosition);
        doc.text(item.product_name || 'N/A', colPositions[1], yPosition);
        doc.text('711319', colPositions[2], yPosition); // HSN code for gold jewelry
        doc.text(`₹${item.rate?.toLocaleString() || '0'}`, colPositions[3], yPosition);
        doc.text(item.weight?.toString() || '0', colPositions[4], yPosition);
        doc.text(`₹${item.total?.toLocaleString() || '0'}`, colPositions[5], yPosition);
        yPosition += 8;
      });
    }

    yPosition += 10;

    // Second dotted line
    for (let i = margin; i < pageWidth - margin; i += 4) {
      doc.line(i, yPosition, i + 2, yPosition);
    }
    yPosition += 15;

    // Summary section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Total Qty: ${bill.items?.length || 0}`, margin + 5, yPosition);
    doc.text(`Total Gross Weight: ${bill.items?.reduce((sum: number, item: any) => sum + (item.weight || 0), 0).toFixed(3) || '0'}`, margin + 5, yPosition + 8);
    doc.text(`Total Taxable Amount: ₹${bill.subtotal?.toLocaleString() || '0'}`, margin + 5, yPosition + 16);
    
    if (bill.discount_amount && bill.discount_amount > 0) {
      doc.text(`Less Special Discount Rs 50/-PER GMS: ₹${Math.round(bill.discount_amount)}`, margin + 5, yPosition + 24);
      yPosition += 8;
    }
    
    doc.text(`Net Amount: ₹${bill.total_amount?.toLocaleString() || '0'}`, margin + 5, yPosition + 32);

    // Peacock watermark (simplified version)
    const watermarkY = pageHeight - 80;
    doc.setFillColor(240, 240, 240, 0.3); // Semi-transparent gray
    doc.setFontSize(60);
    doc.setFont('helvetica', 'bold');
    doc.text('🦚', pageWidth / 2, watermarkY, { align: 'center' });

    // Signature lines (right side)
    const signatureY = watermarkY + 20;
    doc.setLineWidth(0.5);
    doc.setDrawColor(150, 150, 150);
    doc.line(pageWidth - margin - 60, signatureY, pageWidth - margin, signatureY);
    doc.line(pageWidth - margin - 60, signatureY + 10, pageWidth - margin, signatureY + 10);

    // Footer messages (exact Tamil text)
    const footerY = pageHeight - 25;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setFillColor(0, 0, 0); // Black text
    doc.text('உங்களது வளர்ச்சி!', margin + 5, footerY);
    doc.text('எங்களுக்கு மகிழ்ச்சி!!', pageWidth - margin - 5, footerY, { align: 'right' });

    // Download
      const billNumber = bill.bill_number || (bill as any).invoice_number || 'BILL-UNKNOWN';
      doc.save(`Bill-${billNumber}.pdf`);
    success('Bill PDF downloaded successfully!');
    } catch (err) {
      console.error('Error generating bill PDF:', err);
      error('Failed to generate bill PDF. Please try again.');
    }
  };

  const generateInvoicePDF = (invoice: Invoice) => {
    try {
      if (!invoice) {
        error('Invalid invoice data');
        return;
      }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = 25;

    // Add gold/brown border strips (exact template colors)
    doc.setFillColor(218, 165, 32); // Gold color for borders
    doc.rect(0, 0, 10, pageHeight, 'F'); // Left border
    doc.rect(pageWidth - 10, 0, 10, pageHeight, 'F'); // Right border
    doc.rect(0, 0, pageWidth, 10, 'F'); // Top border
    doc.rect(0, pageHeight - 10, pageWidth, 10, 'F'); // Bottom border

    // Header with Tamil text (exact template text)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ஸ்ரீ காத்தாயி அம்மன் துணை', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    doc.text('வர்ணமிகு நகைகளுக்கு', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Left side business details (exact template layout)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // B15 Logo placeholder (blue triangle)
    doc.setFillColor(0, 0, 255); // Blue color
    doc.rect(margin, yPosition, 8, 8, 'F');
    doc.setFillColor(255, 255, 255); // White text
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('B15', margin + 2, yPosition + 6);
    
    // Reset font
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    doc.text('GSTIN: 33DIZPK7238G1ZP', margin, yPosition + 12);
    doc.text('Mobile: 98432 95615', margin, yPosition + 20);
    doc.text('Address: அகரம் சீகூர்', margin, yPosition + 28);
    doc.text('(பார்டர்) - 621 108.', margin, yPosition + 36);
    doc.text('பெரம்பலூர் Dt.', margin, yPosition + 44);

    // Right side branding (exact template layout)
    // VKV Logo placeholder (circular with yellow/red)
    const logoX = pageWidth - margin - 25;
    doc.setFillColor(255, 255, 0); // Yellow outer ring
    doc.circle(logoX, yPosition + 10, 8, 'F');
    doc.setFillColor(255, 0, 0); // Red inner circle
    doc.circle(logoX, yPosition + 10, 6, 'F');
    doc.setFillColor(255, 255, 255); // White text
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('VKV', logoX - 2, yPosition + 12);
    
    // Tamil words below logo
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('நம்பிக்கை', logoX - 4, yPosition + 18);
    doc.text('தரம்', logoX - 2, yPosition + 24);
    
    // Company name (exact Tamil text)
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ஸ்ரீ வண்ணமயில்', pageWidth - margin, yPosition + 35, { align: 'right' });
    doc.text('தங்கமாளிகை', pageWidth - margin, yPosition + 45, { align: 'right' });
    
    // Slogan in red
    doc.setFillColor(255, 0, 0); // Red text
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('916 KDM ஹால்மார்க் ஷோரூம்', pageWidth - margin, yPosition + 55, { align: 'right' });

    yPosition += 70;

    // Invoice Details section header (light gray box)
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition, pageWidth - 2 * margin, 15, 'F');
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice Details', pageWidth / 2, yPosition + 10, { align: 'center' });
    yPosition += 20;

    // Customer information box (left side)
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition, 120, 45, 'F');
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Customer Name & address', margin + 5, yPosition + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.customer_name || '', margin + 5, yPosition + 18);
    if (invoice.customer_phone) {
      doc.text(`Phone: ${invoice.customer_phone}`, margin + 5, yPosition + 28);
    }

    // Right side boxes (DATE, Time, NO)
    const rightBoxX = pageWidth - margin - 80;
    const boxWidth = 80;
    const boxHeight = 12;
    
    // DATE box
    doc.setFillColor(240, 240, 240);
    doc.rect(rightBoxX, yPosition, boxWidth, boxHeight, 'F');
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DATE', rightBoxX + 5, yPosition + 8);
    doc.setFont('helvetica', 'normal');
    const invoiceDate = invoice.created_at ? new Date(invoice.created_at) : new Date();
    doc.text(invoiceDate.toLocaleDateString('en-IN'), rightBoxX + 5, yPosition + 18);
    
    // Time box
    doc.setFillColor(240, 240, 240);
    doc.rect(rightBoxX, yPosition + 15, boxWidth, boxHeight, 'F');
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFont('helvetica', 'bold');
    doc.text('Time', rightBoxX + 5, yPosition + 23);
    doc.setFont('helvetica', 'normal');
    doc.text(invoiceDate.toLocaleTimeString('en-IN'), rightBoxX + 5, yPosition + 33);
    
    // NO box
    doc.setFillColor(240, 240, 240);
    doc.rect(rightBoxX, yPosition + 30, boxWidth, boxHeight, 'F');
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFont('helvetica', 'bold');
    doc.text('NO', rightBoxX + 5, yPosition + 38);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.invoice_number || '', rightBoxX + 5, yPosition + 48);

    yPosition += 60;

    // First dotted line
    doc.setLineWidth(0.5);
    doc.setDrawColor(150, 150, 150);
    for (let i = margin; i < pageWidth - margin; i += 4) {
      doc.line(i, yPosition, i + 2, yPosition);
    }
    yPosition += 15;

    // Items table header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const colPositions = [margin + 5, margin + 30, margin + 95, margin + 130, margin + 165, margin + 190];
    
    doc.text('Qty', colPositions[0], yPosition);
    doc.text('Description', colPositions[1], yPosition);
    doc.text('HSN/SAC', colPositions[2], yPosition);
    doc.text('Rate', colPositions[3], yPosition);
    doc.text('Gross Wt.', colPositions[4], yPosition);
    doc.text('Taxable Amount', colPositions[5], yPosition);
    yPosition += 10;

    // Items table data
    doc.setFont('helvetica', 'normal');
    if (invoice.items && Array.isArray(invoice.items)) {
      invoice.items.forEach((item: any) => {
        doc.text(item.quantity?.toString() || '1', colPositions[0], yPosition);
        doc.text(item.product_name || 'N/A', colPositions[1], yPosition);
        doc.text('711319', colPositions[2], yPosition); // HSN code for gold jewelry
        doc.text(`₹${item.rate?.toLocaleString() || '0'}`, colPositions[3], yPosition);
        doc.text(item.weight?.toString() || '0', colPositions[4], yPosition);
        doc.text(`₹${item.total?.toLocaleString() || '0'}`, colPositions[5], yPosition);
        yPosition += 8;
      });
    }

    yPosition += 10;

    // Second dotted line
    for (let i = margin; i < pageWidth - margin; i += 4) {
      doc.line(i, yPosition, i + 2, yPosition);
    }
    yPosition += 15;

    // Summary section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Total Qty: ${invoice.items?.length || 0}`, margin + 5, yPosition);
    doc.text(`Total Gross Weight: ${invoice.items?.reduce((sum: number, item: any) => sum + (item.weight || 0), 0).toFixed(3) || '0'}`, margin + 5, yPosition + 8);
    doc.text(`Total Taxable Amount: ₹${invoice.subtotal?.toLocaleString() || '0'}`, margin + 5, yPosition + 16);
    
    if (invoice.discount_amount && invoice.discount_amount > 0) {
      doc.text(`Less Special Discount Rs 50/-PER GMS: ₹${Math.round(invoice.discount_amount)}`, margin + 5, yPosition + 24);
      yPosition += 8;
    }
    
    doc.text(`Net Amount: ₹${invoice.total_amount?.toLocaleString() || '0'}`, margin + 5, yPosition + 32);

    // Peacock watermark (simplified version)
    const watermarkY = pageHeight - 80;
    doc.setFillColor(240, 240, 240, 0.3); // Semi-transparent gray
    doc.setFontSize(60);
    doc.setFont('helvetica', 'bold');
    doc.text('🦚', pageWidth / 2, watermarkY, { align: 'center' });

    // Signature lines (right side)
    const signatureY = watermarkY + 20;
    doc.setLineWidth(0.5);
    doc.setDrawColor(150, 150, 150);
    doc.line(pageWidth - margin - 60, signatureY, pageWidth - margin, signatureY);
    doc.line(pageWidth - margin - 60, signatureY + 10, pageWidth - margin, signatureY + 10);

    // Footer messages (exact Tamil text)
    const footerY = pageHeight - 25;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setFillColor(0, 0, 0); // Black text
    doc.text('உங்களது வளர்ச்சி!', margin + 5, footerY);
    doc.text('எங்களுக்கு மகிழ்ச்சி!!', pageWidth - margin - 5, footerY, { align: 'right' });

    // Download
      const invoiceNumber = invoice.invoice_number || 'INV-UNKNOWN';
      doc.save(`Invoice-${invoiceNumber}.pdf`);
    success('Invoice PDF downloaded successfully!');
    } catch (err) {
      console.error('Error generating invoice PDF:', err);
      error('Failed to generate invoice PDF. Please try again.');
    }
  };

  // Helper function to print PDF
  const printPDF = (doc: jsPDF) => {
    try {
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl, '_blank');
      
      if (printWindow) {
        // Use a more reliable approach for triggering print
        const checkPrint = setInterval(() => {
          try {
            if (printWindow.document.readyState === 'complete') {
              clearInterval(checkPrint);
              setTimeout(() => {
                printWindow.print();
                // Clean up the URL after a delay (but don't close the window)
                setTimeout(() => {
                  URL.revokeObjectURL(pdfUrl);
                }, 1000);
              }, 500);
            }
          } catch (e) {
            // If we can't access the window, try printing anyway
            clearInterval(checkPrint);
            setTimeout(() => {
              printWindow.print();
              setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
            }, 500);
          }
        }, 100);

        // Fallback timeout
        setTimeout(() => {
          clearInterval(checkPrint);
          try {
            printWindow.print();
            setTimeout(() => {
              URL.revokeObjectURL(pdfUrl);
            }, 1000);
          } catch (e) {
            URL.revokeObjectURL(pdfUrl);
          }
        }, 3000);
      } else {
        error('Please allow popups to print the document');
        URL.revokeObjectURL(pdfUrl);
      }
    } catch (err) {
      console.error('Error printing PDF:', err);
      error('Failed to print PDF. Please try again.');
    }
  };

  // Print Bill PDF function
  const printBillPDF = (bill: Bill) => {
    try {
      if (!bill) {
        error('Invalid bill data');
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = 25;

      // Add gold/brown border strips (exact template colors)
      doc.setFillColor(218, 165, 32); // Gold color for borders
      doc.rect(0, 0, 10, pageHeight, 'F'); // Left border
      doc.rect(pageWidth - 10, 0, 10, pageHeight, 'F'); // Right border
      doc.rect(0, 0, pageWidth, 10, 'F'); // Top border
      doc.rect(0, pageHeight - 10, pageWidth, 10, 'F'); // Bottom border

      // Header with Tamil text (exact template text)
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ஸ்ரீ காத்தாயி அம்மன் துணை', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
      doc.text('வர்ணமிகு நகைகளுக்கு', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Left side business details (exact template layout)
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      // B15 Logo placeholder (blue triangle)
      doc.setFillColor(0, 0, 255); // Blue color
      doc.rect(margin, yPosition, 8, 8, 'F');
      doc.setFillColor(255, 255, 255); // White text
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text('B15', margin + 2, yPosition + 6);
      
      // Reset font
      doc.setFillColor(0, 0, 0); // Black text
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      doc.text('GSTIN: 33DIZPK7238G1ZP', margin, yPosition + 12);
      doc.text('Mobile: 98432 95615', margin, yPosition + 20);
      doc.text('Address: அகரம் சீகூர்', margin, yPosition + 28);
      doc.text('(பார்டர்) - 621 108.', margin, yPosition + 36);
      doc.text('பெரம்பலூர் Dt.', margin, yPosition + 44);

      // Right side branding (exact template layout)
      const logoX = pageWidth - margin - 25;
      doc.setFillColor(255, 255, 0); // Yellow outer ring
      doc.circle(logoX, yPosition + 10, 8, 'F');
      doc.setFillColor(255, 0, 0); // Red inner circle
      doc.circle(logoX, yPosition + 10, 6, 'F');
      doc.setFillColor(255, 255, 255); // White text
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text('VKV', logoX - 2, yPosition + 12);
      
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text('நம்பிக்கை', logoX - 4, yPosition + 18);
      doc.text('தரம்', logoX - 2, yPosition + 24);
      
      doc.setFillColor(0, 0, 0); // Black text
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('ஸ்ரீ வண்ணமயில்', pageWidth - margin, yPosition + 35, { align: 'right' });
      doc.text('தங்கமாளிகை', pageWidth - margin, yPosition + 45, { align: 'right' });
      
      doc.setFillColor(255, 0, 0); // Red text
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('916 KDM ஹால்மார்க் ஷோரூம்', pageWidth - margin, yPosition + 55, { align: 'right' });

      yPosition += 70;

      // Invoice Details section header
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, 15, 'F');
      doc.setFillColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Invoice Details', pageWidth / 2, yPosition + 10, { align: 'center' });
      yPosition += 20;

      const isExchange = bill.bill_number?.startsWith('EXCH-');
      const customerBoxHeight = isExchange && (bill as any).old_gold_weight ? 60 : 45;
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPosition, 120, customerBoxHeight, 'F');
      doc.setFillColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Name & address', margin + 5, yPosition + 8);
      doc.setFont('helvetica', 'normal');
      doc.text(bill.customer_name || '', margin + 5, yPosition + 18);
      if (bill.customer_phone) {
        doc.text(`Phone: ${bill.customer_phone}`, margin + 5, yPosition + 28);
      }
      
      if (isExchange && (bill as any).old_gold_weight) {
        doc.setFont('helvetica', 'bold');
        doc.text('Old Gold:', margin + 5, yPosition + 38);
        doc.setFont('helvetica', 'normal');
        doc.text(`${(bill as any).old_gold_weight}g (${(bill as any).old_gold_purity || '22K'})`, margin + 5, yPosition + 48);
        if ((bill as any).exchange_difference !== undefined) {
          const diff = (bill as any).exchange_difference;
          doc.setFont('helvetica', 'bold');
          doc.text(`${diff >= 0 ? 'Pay' : 'Receive'}:`, margin + 5, yPosition + 56);
          doc.setFont('helvetica', 'normal');
          doc.text(`₹${Math.abs(diff).toLocaleString()}`, margin + 5, yPosition + 66);
        }
      }

      const rightBoxX = pageWidth - margin - 80;
      const boxWidth = 80;
      const boxHeight = 12;
      
      doc.setFillColor(240, 240, 240);
      doc.rect(rightBoxX, yPosition, boxWidth, boxHeight, 'F');
      doc.setFillColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('DATE', rightBoxX + 5, yPosition + 8);
      doc.setFont('helvetica', 'normal');
      const billDate = bill.created_at ? new Date(bill.created_at) : new Date();
      doc.text(billDate.toLocaleDateString('en-IN'), rightBoxX + 5, yPosition + 18);
      
      doc.setFillColor(240, 240, 240);
      doc.rect(rightBoxX, yPosition + 15, boxWidth, boxHeight, 'F');
      doc.setFillColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Time', rightBoxX + 5, yPosition + 23);
      doc.setFont('helvetica', 'normal');
      doc.text(billDate.toLocaleTimeString('en-IN'), rightBoxX + 5, yPosition + 33);
      
      doc.setFillColor(240, 240, 240);
      doc.rect(rightBoxX, yPosition + 30, boxWidth, boxHeight, 'F');
      doc.setFillColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('NO', rightBoxX + 5, yPosition + 38);
      doc.setFont('helvetica', 'normal');
      doc.text(bill.bill_number || '', rightBoxX + 5, yPosition + 48);

      yPosition += (isExchange && (bill as any).old_gold_weight ? 75 : 60);

      doc.setLineWidth(0.5);
      doc.setDrawColor(150, 150, 150);
      for (let i = margin; i < pageWidth - margin; i += 4) {
        doc.line(i, yPosition, i + 2, yPosition);
      }
      yPosition += 15;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const colPositions = [margin + 5, margin + 30, margin + 95, margin + 130, margin + 165, margin + 190];
      
      doc.text('Qty', colPositions[0], yPosition);
      doc.text('Description', colPositions[1], yPosition);
      doc.text('HSN/SAC', colPositions[2], yPosition);
      doc.text('Rate', colPositions[3], yPosition);
      doc.text('Gross Wt.', colPositions[4], yPosition);
      doc.text('Taxable Amount', colPositions[5], yPosition);
      yPosition += 10;

      doc.setFont('helvetica', 'normal');
      if (bill.items && Array.isArray(bill.items)) {
        bill.items.forEach((item: any) => {
          doc.text(item.quantity?.toString() || '1', colPositions[0], yPosition);
          doc.text(item.product_name || 'N/A', colPositions[1], yPosition);
          doc.text('711319', colPositions[2], yPosition);
          doc.text(`₹${item.rate?.toLocaleString() || '0'}`, colPositions[3], yPosition);
          doc.text(item.weight?.toString() || '0', colPositions[4], yPosition);
          doc.text(`₹${item.total?.toLocaleString() || '0'}`, colPositions[5], yPosition);
          yPosition += 8;
        });
      }

      yPosition += 10;

      for (let i = margin; i < pageWidth - margin; i += 4) {
        doc.line(i, yPosition, i + 2, yPosition);
      }
      yPosition += 15;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Total Qty: ${bill.items?.length || 0}`, margin + 5, yPosition);
      doc.text(`Total Gross Weight: ${bill.items?.reduce((sum: number, item: any) => sum + (item.weight || 0), 0).toFixed(3) || '0'}`, margin + 5, yPosition + 8);
      doc.text(`Total Taxable Amount: ₹${bill.subtotal?.toLocaleString() || '0'}`, margin + 5, yPosition + 16);
      
      if (bill.discount_amount && bill.discount_amount > 0) {
        doc.text(`Less Special Discount Rs 50/-PER GMS: ₹${Math.round(bill.discount_amount)}`, margin + 5, yPosition + 24);
        yPosition += 8;
      }
      
      doc.text(`Net Amount: ₹${bill.total_amount?.toLocaleString() || '0'}`, margin + 5, yPosition + 32);

      const watermarkY = pageHeight - 80;
      doc.setFillColor(240, 240, 240, 0.3);
      doc.setFontSize(60);
      doc.setFont('helvetica', 'bold');
      doc.text('🦚', pageWidth / 2, watermarkY, { align: 'center' });

      const signatureY = watermarkY + 20;
      doc.setLineWidth(0.5);
      doc.setDrawColor(150, 150, 150);
      doc.line(pageWidth - margin - 60, signatureY, pageWidth - margin, signatureY);
      doc.line(pageWidth - margin - 60, signatureY + 10, pageWidth - margin, signatureY + 10);

      const footerY = pageHeight - 25;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setFillColor(0, 0, 0);
      doc.text('உங்களது வளர்ச்சி!', margin + 5, footerY);
      doc.text('எங்களுக்கு மகிழ்ச்சி!!', pageWidth - margin - 5, footerY, { align: 'right' });

      printPDF(doc);
      success('Bill opened for printing!');
    } catch (err) {
      console.error('Error printing bill PDF:', err);
      error('Failed to print bill PDF. Please try again.');
    }
  };

  // Print Invoice PDF function
  const printInvoicePDF = (invoice: Invoice) => {
    try {
      if (!invoice) {
        error('Invalid invoice data');
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = 25;

      // Add gold/brown border strips
      doc.setFillColor(218, 165, 32);
      doc.rect(0, 0, 10, pageHeight, 'F');
      doc.rect(pageWidth - 10, 0, 10, pageHeight, 'F');
      doc.rect(0, 0, pageWidth, 10, 'F');
      doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ஸ்ரீ காத்தாயி அம்மன் துணை', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
      doc.text('வர்ணமிகு நகைகளுக்கு', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      doc.setFillColor(0, 0, 255);
      doc.rect(margin, yPosition, 8, 8, 'F');
      doc.setFillColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text('B15', margin + 2, yPosition + 6);
      
      doc.setFillColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      doc.text('GSTIN: 33DIZPK7238G1ZP', margin, yPosition + 12);
      doc.text('Mobile: 98432 95615', margin, yPosition + 20);
      doc.text('Address: அகரம் சீகூர்', margin, yPosition + 28);
      doc.text('(பார்டர்) - 621 108.', margin, yPosition + 36);
      doc.text('பெரம்பலூர் Dt.', margin, yPosition + 44);

      const logoX = pageWidth - margin - 25;
      doc.setFillColor(255, 255, 0);
      doc.circle(logoX, yPosition + 10, 8, 'F');
      doc.setFillColor(255, 0, 0);
      doc.circle(logoX, yPosition + 10, 6, 'F');
      doc.setFillColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text('VKV', logoX - 2, yPosition + 12);
      
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text('நம்பிக்கை', logoX - 4, yPosition + 18);
      doc.text('தரம்', logoX - 2, yPosition + 24);
      
      doc.setFillColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('ஸ்ரீ வண்ணமயில்', pageWidth - margin, yPosition + 35, { align: 'right' });
      doc.text('தங்கமாளிகை', pageWidth - margin, yPosition + 45, { align: 'right' });
      
      doc.setFillColor(255, 0, 0);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('916 KDM ஹால்மார்க் ஷோரூம்', pageWidth - margin, yPosition + 55, { align: 'right' });

      yPosition += 70;

      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, 15, 'F');
      doc.setFillColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Invoice Details', pageWidth / 2, yPosition + 10, { align: 'center' });
      yPosition += 20;

      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPosition, 120, 45, 'F');
      doc.setFillColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Name & address', margin + 5, yPosition + 8);
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.customer_name || '', margin + 5, yPosition + 18);
      if (invoice.customer_phone) {
        doc.text(`Phone: ${invoice.customer_phone}`, margin + 5, yPosition + 28);
      }

      const rightBoxX = pageWidth - margin - 80;
      const boxWidth = 80;
      const boxHeight = 12;
      
      doc.setFillColor(240, 240, 240);
      doc.rect(rightBoxX, yPosition, boxWidth, boxHeight, 'F');
      doc.setFillColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('DATE', rightBoxX + 5, yPosition + 8);
      doc.setFont('helvetica', 'normal');
      const invoiceDate = invoice.created_at ? new Date(invoice.created_at) : new Date();
      doc.text(invoiceDate.toLocaleDateString('en-IN'), rightBoxX + 5, yPosition + 18);
      
      doc.setFillColor(240, 240, 240);
      doc.rect(rightBoxX, yPosition + 15, boxWidth, boxHeight, 'F');
      doc.setFillColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Time', rightBoxX + 5, yPosition + 23);
      doc.setFont('helvetica', 'normal');
      doc.text(invoiceDate.toLocaleTimeString('en-IN'), rightBoxX + 5, yPosition + 33);
      
      doc.setFillColor(240, 240, 240);
      doc.rect(rightBoxX, yPosition + 30, boxWidth, boxHeight, 'F');
      doc.setFillColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('NO', rightBoxX + 5, yPosition + 38);
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.invoice_number || '', rightBoxX + 5, yPosition + 48);

      yPosition += 60;

      doc.setLineWidth(0.5);
      doc.setDrawColor(150, 150, 150);
      for (let i = margin; i < pageWidth - margin; i += 4) {
        doc.line(i, yPosition, i + 2, yPosition);
      }
      yPosition += 15;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const colPositions = [margin + 5, margin + 30, margin + 95, margin + 130, margin + 165, margin + 190];
      
      doc.text('Qty', colPositions[0], yPosition);
      doc.text('Description', colPositions[1], yPosition);
      doc.text('HSN/SAC', colPositions[2], yPosition);
      doc.text('Rate', colPositions[3], yPosition);
      doc.text('Gross Wt.', colPositions[4], yPosition);
      doc.text('Taxable Amount', colPositions[5], yPosition);
      yPosition += 10;

      doc.setFont('helvetica', 'normal');
      if (invoice.items && Array.isArray(invoice.items)) {
        invoice.items.forEach((item: any) => {
          doc.text(item.quantity?.toString() || '1', colPositions[0], yPosition);
          doc.text(item.product_name || 'N/A', colPositions[1], yPosition);
          doc.text('711319', colPositions[2], yPosition);
          doc.text(`₹${item.rate?.toLocaleString() || '0'}`, colPositions[3], yPosition);
          doc.text(item.weight?.toString() || '0', colPositions[4], yPosition);
          doc.text(`₹${item.total?.toLocaleString() || '0'}`, colPositions[5], yPosition);
          yPosition += 8;
        });
      }

      yPosition += 10;

      for (let i = margin; i < pageWidth - margin; i += 4) {
        doc.line(i, yPosition, i + 2, yPosition);
      }
      yPosition += 15;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Total Qty: ${invoice.items?.length || 0}`, margin + 5, yPosition);
      doc.text(`Total Gross Weight: ${invoice.items?.reduce((sum: number, item: any) => sum + (item.weight || 0), 0).toFixed(3) || '0'}`, margin + 5, yPosition + 8);
      doc.text(`Total Taxable Amount: ₹${invoice.subtotal?.toLocaleString() || '0'}`, margin + 5, yPosition + 16);
      
      if (invoice.discount_amount && invoice.discount_amount > 0) {
        doc.text(`Less Special Discount Rs 50/-PER GMS: ₹${Math.round(invoice.discount_amount)}`, margin + 5, yPosition + 24);
        yPosition += 8;
      }
      
      doc.text(`Net Amount: ₹${invoice.total_amount?.toLocaleString() || '0'}`, margin + 5, yPosition + 32);

      const watermarkY = pageHeight - 80;
      doc.setFillColor(240, 240, 240, 0.3);
      doc.setFontSize(60);
      doc.setFont('helvetica', 'bold');
      doc.text('🦚', pageWidth / 2, watermarkY, { align: 'center' });

      const signatureY = watermarkY + 20;
      doc.setLineWidth(0.5);
      doc.setDrawColor(150, 150, 150);
      doc.line(pageWidth - margin - 60, signatureY, pageWidth - margin, signatureY);
      doc.line(pageWidth - margin - 60, signatureY + 10, pageWidth - margin, signatureY + 10);

      const footerY = pageHeight - 25;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setFillColor(0, 0, 0);
      doc.text('உங்களது வளர்ச்சி!', margin + 5, footerY);
      doc.text('எங்களுக்கு மகிழ்ச்சி!!', pageWidth - margin - 5, footerY, { align: 'right' });

      printPDF(doc);
      success('Invoice opened for printing!');
    } catch (err) {
      console.error('Error printing invoice PDF:', err);
      error('Failed to print invoice PDF. Please try again.');
    }
  };

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('billing.title')}</h1>
          <p className="text-gray-600 mt-1">{t('billing.subtitle')}</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            <Download className="h-4 w-4" />
            <span>{t('billing.reports')}</span>
          </button>
          {activeTab === 'invoice' ? (
            <button
              onClick={saveInvoice}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>{t('billing.createInvoice')}</span>
            </button>
          ) : activeTab === 'billing' ? (
            <button
              onClick={saveBill}
              className="flex items-center space-x-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              <span>{t('billing.createBill')}</span>
            </button>
          ) : (
            <button
              onClick={saveExchangeBill}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Generate Exchange Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('invoice')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'invoice'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>{t('billing.invoiceQuoteEstimate')}</span>
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'billing'
                ? 'bg-amber-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>{t('billing.billingDeductStock')}</span>
          </button>
          <button
            onClick={() => setActiveTab('exchange')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'exchange'
                ? 'bg-green-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            <span>{t('billing.goldExchange')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900">{t('billing.customerInformation')}</h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setCustomerModalInitialView('add');
                    setShowCustomerModal(true);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('billing.addCustomer')}</span>
                </button>
                <button
                  onClick={() => {
                    setCustomerModalInitialView('list');
                    setShowCustomerModal(true);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
                >
                  <User className="h-4 w-4" />
                  <span>{t('billing.selectCustomer')}</span>
                </button>
              </div>
            </div>
            
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div>
                  <p className="font-medium text-gray-900">{selectedCustomer.name}</p>
                  <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
                  {selectedCustomer.email && (
                    <p className="text-sm text-gray-600">{selectedCustomer.email}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerFilter('');
                    setShowCustomerDropdown(false);
                  }}
                  className="text-amber-600 hover:text-amber-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Customer Filter/Search */}
                <div className="relative customer-filter-container">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search customer by name, phone, or email..."
                    value={customerFilter}
                    onChange={(e) => {
                      setCustomerFilter(e.target.value);
                      if (e.target.value.trim().length > 0 || customers.length > 0) {
                        setShowCustomerDropdown(true);
                      }
                    }}
                    onFocus={() => {
                      if (customers.length > 0) {
                        setShowCustomerDropdown(true);
                      }
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                  {customerFilter && (
                    <button
                      onClick={() => {
                        setCustomerFilter('');
                        setShowCustomerDropdown(false);
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  
                  {/* Customer Dropdown List */}
                  {showCustomerDropdown && filteredCustomersList.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {filteredCustomersList.map((customer) => (
                        <div
                          key={customer.id}
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setCurrentBill(prev => ({
                              ...prev,
                              customer_name: customer.name,
                              customer_phone: customer.phone || ''
                            }));
                            setCustomerFilter('');
                            setShowCustomerDropdown(false);
                          }}
                          className="p-3 border-b border-gray-200 cursor-pointer hover:bg-amber-50 transition-colors last:border-b-0"
                        >
                          <p className="font-medium text-gray-900">{customer.name}</p>
                          <p className="text-sm text-gray-600">{customer.phone}</p>
                          {customer.email && (
                            <p className="text-xs text-gray-500">{customer.email}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {showCustomerDropdown && customerFilter.trim().length > 0 && filteredCustomersList.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
                      <p className="text-sm text-gray-500 text-center">No customers found</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Exchange Material Section - Only show for exchange tab */}
          {activeTab === 'exchange' && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('billing.oldMaterialDetails')}</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inventory.materialType')} *
                  </label>
                  <select
                    value={exchangeMaterial.materialType}
                    onChange={(e) => {
                      const newMaterialType = e.target.value as 'Gold' | 'Silver' | 'Platinum' | 'Diamond' | 'Other';
                      const defaultPurity = newMaterialType === 'Gold' ? '22K' : 
                                           newMaterialType === 'Silver' ? '925' :
                                           newMaterialType === 'Platinum' ? '950' :
                                           newMaterialType === 'Diamond' ? 'G' : '22K';
                      setExchangeMaterial(prev => ({ 
                        ...prev, 
                        materialType: newMaterialType,
                        oldMaterialPurity: defaultPurity
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="Gold">{t('inventory.gold')}</option>
                    <option value="Silver">{t('inventory.silver')}</option>
                    <option value="Platinum">{t('inventory.platinum')}</option>
                    <option value="Diamond">{t('inventory.diamond')}</option>
                    <option value="Other">{t('inventory.other')}</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('billing.weightGrams')} *
                  </label>
                  <div className="flex flex-col space-y-1">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={exchangeMaterial.oldMaterialWeight || ''}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0) {
                          setExchangeMaterial(prev => ({ ...prev, oldMaterialWeight: value }));
                          if (exchangeFormErrors.oldMaterialWeight) {
                            setExchangeFormErrors(prev => ({ ...prev, oldMaterialWeight: undefined }));
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value);
                        if (e.target.value === '' || isNaN(value) || value <= 0) {
                          setExchangeFormErrors(prev => ({ ...prev, oldMaterialWeight: t('billing.weightRequired') }));
                        }
                      }}
                      onWheel={handleWheel}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                        exchangeFormErrors.oldMaterialWeight ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder={t('billing.enterWeightGrams')}
                    />
                    {exchangeFormErrors.oldMaterialWeight && (
                      <p className="text-xs text-red-600">{exchangeFormErrors.oldMaterialWeight}</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('billing.purity')} *
                  </label>
                  <select
                    value={exchangeMaterial.oldMaterialPurity}
                    onChange={(e) => setExchangeMaterial(prev => ({ ...prev, oldMaterialPurity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    {getPurityOptions(exchangeMaterial.materialType).map(purity => (
                      <option key={purity} value={purity}>{purity}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('billing.oldMaterialRate')} *
                  </label>
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={exchangeMaterial.oldMaterialRate || ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                          if (!isNaN(value) && value >= 0) {
                            setExchangeMaterial(prev => ({ ...prev, oldMaterialRate: value }));
                            if (exchangeFormErrors.oldMaterialRate) {
                              setExchangeFormErrors(prev => ({ ...prev, oldMaterialRate: undefined }));
                            }
                          }
                        }}
                        onBlur={(e) => {
                          if (e.target.value === '') {
                            setExchangeMaterial(prev => ({ ...prev, oldMaterialRate: 0 }));
                          } else {
                            const value = parseInt(e.target.value);
                            if (isNaN(value) || value <= 0) {
                              setExchangeFormErrors(prev => ({ ...prev, oldMaterialRate: t('billing.rateRequired') }));
                            }
                          }
                        }}
                        onWheel={handleWheel}
                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                          exchangeFormErrors.oldMaterialRate ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-600 font-medium">₹/g</span>
                    </div>
                    {exchangeFormErrors.oldMaterialRate && (
                      <p className="text-xs text-red-600">{exchangeFormErrors.oldMaterialRate}</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('billing.exchangeRate')} *
                  </label>
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={exchangeMaterial.exchangeRate || ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                          if (!isNaN(value) && value >= 0) {
                            setExchangeMaterial(prev => ({ ...prev, exchangeRate: value }));
                            if (exchangeFormErrors.exchangeRate) {
                              setExchangeFormErrors(prev => ({ ...prev, exchangeRate: undefined }));
                            }
                          }
                        }}
                        onBlur={(e) => {
                          if (e.target.value === '') {
                            setExchangeMaterial(prev => ({ ...prev, exchangeRate: 0 }));
                          } else {
                            const value = parseInt(e.target.value);
                            if (isNaN(value) || value <= 0) {
                              setExchangeFormErrors(prev => ({ ...prev, exchangeRate: t('billing.rateRequired') }));
                            }
                          }
                        }}
                        onWheel={handleWheel}
                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm ${
                          exchangeFormErrors.exchangeRate ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-600 font-medium">₹/g</span>
                    </div>
                    {exchangeFormErrors.exchangeRate && (
                      <p className="text-xs text-red-600">{exchangeFormErrors.exchangeRate}</p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Exchange Summary */}
              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600">{t('billing.oldMaterialValue')}</p>
                    <p className="text-lg font-semibold text-gray-900">₹{exchangeMaterial.oldMaterialValue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{t('billing.exchangeValue')}</p>
                    <p className="text-lg font-semibold text-gray-900">₹{exchangeMaterial.exchangeValue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{t('billing.difference')}</p>
                    <p className={`text-lg font-semibold ${
                      exchangeMaterial.difference >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {exchangeMaterial.difference >= 0 ? '+' : ''}₹{exchangeMaterial.difference.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Barcode Scanner */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Scan className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900">{t('billing.barcodeScanner')}</h2>
              </div>
              <div className="flex items-center space-x-2">
                {isScanning && (
                  <div className="flex items-center space-x-2 text-amber-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-500 border-t-transparent"></div>
                    <span className="text-sm">{t('billing.scanning')}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">{t('billing.scanInstructions')}</p>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                  {t('billing.ctrlBToFocus')}
                </span>
              </div>
              <div className="relative">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder={t('billing.barcodePlaceholder')}
                  value={barcodeInput}
                  onChange={(e) => handleBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-lg font-mono"
                  disabled={isScanning}
                  title={t('billing.scanBarcodeOrType')}
                />
                <div className="absolute right-3 top-3">
                  {isScanning ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-500 border-t-transparent"></div>
                  ) : (
                    <Scan className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Product Search */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Package className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900">{t('billing.addProducts')}</h2>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('billing.searchProducts')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 w-64"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 max-h-64 overflow-y-auto">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => activeTab === 'exchange' ? addProductToExchange(product) : addProductToBill(product)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all duration-300 ${
                    recentlyScanned.has(product.id)
                      ? 'border-green-300 bg-green-50 shadow-md'
                      : activeTab === 'exchange'
                      ? 'border-gray-200 hover:bg-green-50 hover:border-green-300'
                      : 'border-gray-200 hover:bg-amber-50 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                      <p className="font-medium text-gray-900">{product.name}</p>
                        {recentlyScanned.has(product.id) && (
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-600 font-medium">{t('billing.scanned')}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{product.weight}g • {product.purity} • {product.material_type || 'Gold'}</p>
                      <p className="text-sm text-gray-600">{product.category}</p>
                        {(activeTab === 'billing' || activeTab === 'exchange') && (
                        <p className="text-xs text-gray-500">{t('billing.stockLabel')}: {product.stock_quantity}</p>
                      )}
                      {product.barcode && (
                        <p className="text-xs text-gray-400 font-mono">Barcode: {product.barcode}</p>
                      )}
                    </div>
                    <Plus className="h-5 w-5 text-amber-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bill/Invoice/Exchange Items */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {activeTab === 'billing' ? t('billing.billItemsDeductStock') : 
               activeTab === 'invoice' ? t('billing.invoiceItemsQuoteEstimate') : 
               t('billing.exchangeItems')}
            </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-sm font-medium text-gray-500 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4" />
                        <span>{t('billing.item')}</span>
                      </div>
                    </th>
                    <th className="px-4 py-2.5 text-left text-sm font-medium text-gray-500 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Scale className="h-4 w-4" />
                        <span>{t('billing.weight')}</span>
                      </div>
                    </th>
                    <th className="px-4 py-2.5 text-left text-sm font-medium text-gray-500 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-bold">₹</span>
                        <span>{t('billing.rate')}</span>
                      </div>
                    </th>
                    <th className="px-4 py-2.5 text-left text-sm font-medium text-gray-500 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Wrench className="h-4 w-4" />
                        <span>{t('billing.making')}</span>
                      </div>
                    </th>
                    <th className="px-4 py-2.5 text-left text-sm font-medium text-gray-500 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Scale className="h-4 w-4" />
                        <span>{t('billing.wastage')}</span>
                      </div>
                    </th>
                    <th className="px-4 py-2.5 text-center text-sm font-medium text-gray-500 whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-2">
                        <Hash className="h-4 w-4" />
                        <span>{t('billing.qty')}</span>
                      </div>
                    </th>
                    <th className="px-4 py-2.5 text-left text-sm font-medium text-gray-500 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Calculator className="h-4 w-4" />
                        <span>{t('billing.total')}</span>
                      </div>
                    </th>
                    <th className="px-4 py-2.5 text-center text-sm font-medium text-gray-500 whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-2">
                        <Settings className="h-4 w-4" />
                        <span>{t('billing.action')}</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(activeTab === 'exchange' ? exchangeMaterial.exchangeItems : (currentBill.items || [])).map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center space-x-2 whitespace-nowrap">
                          <span className="font-medium text-gray-900 text-sm">{item.product_name}</span>
                          {(activeTab === 'billing' || activeTab === 'exchange') && (
                            <span className="text-xs text-gray-500">
                              ({t('billing.stock')}: {products.find(p => p.id === item.product_id)?.stock_quantity || 0})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.weight || ''}
                              onChange={(e) => {
                                const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                if (!isNaN(value) && value > 0) {
                                  if (activeTab === 'exchange') {
                                    updateExchangeItem(item.id, { weight: value });
                                  } else {
                                    updateBillItem(item.id, { weight: value });
                                  }
                                  // Clear error on valid input
                                  if (itemErrors[item.id]?.weight) {
                                    setItemErrors(prev => ({
                                      ...prev,
                                      [item.id]: { ...prev[item.id], weight: undefined }
                                    }));
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const value = parseFloat(e.target.value);
                                if (e.target.value === '' || isNaN(value) || value <= 0) {
                                  const defaultValue = item.weight || 0.01;
                                  if (activeTab === 'exchange') {
                                    updateExchangeItem(item.id, { weight: defaultValue });
                                  } else {
                                    updateBillItem(item.id, { weight: defaultValue });
                                  }
                                  setItemErrors(prev => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], weight: t('billing.weightRequired') }
                                  }));
                                }
                              }}
                              onWheel={handleWheel}
                              className={`w-20 px-2 py-1.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm ${
                                itemErrors[item.id]?.weight ? 'border-red-500' : 'border-gray-300'
                              }`}
                              placeholder="0.00"
                            />
                            <span className="text-sm text-gray-600 font-medium whitespace-nowrap">g</span>
                          </div>
                          {itemErrors[item.id]?.weight && (
                            <p className="text-xs text-red-600">{itemErrors[item.id].weight}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.rate || ''}
                              onChange={(e) => {
                                const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                                if (!isNaN(value) && value > 0) {
                                  if (activeTab === 'exchange') {
                                    updateExchangeItem(item.id, { rate: value });
                                  } else {
                                    updateBillItem(item.id, { rate: value });
                                  }
                                  // Clear error on valid input
                                  if (itemErrors[item.id]?.rate) {
                                    setItemErrors(prev => ({
                                      ...prev,
                                      [item.id]: { ...prev[item.id], rate: undefined }
                                    }));
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const value = parseInt(e.target.value);
                                if (e.target.value === '' || isNaN(value) || value <= 0) {
                                  setItemErrors(prev => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], rate: t('billing.rateRequired') }
                                  }));
                                  if (activeTab === 'exchange') {
                                    updateExchangeItem(item.id, { rate: 0 });
                                  } else {
                                    updateBillItem(item.id, { rate: 0 });
                                  }
                                }
                              }}
                              onWheel={handleWheel}
                              className={`w-24 px-2 py-1.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm ${
                                itemErrors[item.id]?.rate ? 'border-red-500' : 'border-gray-300'
                              }`}
                              placeholder="0"
                            />
                            <span className="text-sm text-gray-500 font-semibold whitespace-nowrap">₹</span>
                            <span className="text-sm text-gray-600 font-medium whitespace-nowrap">/g</span>
                          </div>
                          {itemErrors[item.id]?.rate && (
                            <p className="text-xs text-red-600">{itemErrors[item.id].rate}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center space-x-1.5">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.making_charge || ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                              if (!isNaN(value) && value >= 0) {
                                if (activeTab === 'exchange') {
                                  updateExchangeItem(item.id, { making_charge: value });
                                } else {
                                  updateBillItem(item.id, { making_charge: value });
                                }
                              }
                            }}
                            onBlur={(e) => {
                              if (e.target.value === '') {
                                if (activeTab === 'exchange') {
                                  updateExchangeItem(item.id, { making_charge: 0 });
                                } else {
                                  updateBillItem(item.id, { making_charge: 0 });
                                }
                              }
                            }}
                            onWheel={handleWheel}
                            className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                            placeholder="0"
                          />
                          <span className="text-sm text-gray-500 font-semibold whitespace-nowrap">₹</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center space-x-1.5">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.wastage_charge || ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                              if (!isNaN(value) && value >= 0) {
                                if (activeTab === 'exchange') {
                                  updateExchangeItem(item.id, { wastage_charge: value });
                                } else {
                                  updateBillItem(item.id, { wastage_charge: value });
                                }
                              }
                            }}
                            onBlur={(e) => {
                              if (e.target.value === '') {
                                if (activeTab === 'exchange') {
                                  updateExchangeItem(item.id, { wastage_charge: 0 });
                                } else {
                                  updateBillItem(item.id, { wastage_charge: 0 });
                                }
                              }
                            }}
                            onWheel={handleWheel}
                            className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                            placeholder="0"
                          />
                          <span className="text-sm text-gray-500 font-semibold whitespace-nowrap">₹</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col items-center space-y-1">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity || ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                              if (!isNaN(value) && value > 0) {
                                if (activeTab === 'exchange') {
                                  updateExchangeItem(item.id, { quantity: value });
                                } else {
                                  updateBillItem(item.id, { quantity: value });
                                }
                                // Clear error on valid input
                                if (itemErrors[item.id]?.quantity) {
                                  setItemErrors(prev => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], quantity: undefined }
                                  }));
                                }
                              }
                            }}
                            onBlur={(e) => {
                              const value = parseInt(e.target.value);
                              if (e.target.value === '' || isNaN(value) || value <= 0) {
                                const defaultValue = item.quantity || 1;
                                setItemErrors(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], quantity: t('billing.quantityRequired') }
                                }));
                                if (activeTab === 'exchange') {
                                  updateExchangeItem(item.id, { quantity: defaultValue });
                                } else {
                                  updateBillItem(item.id, { quantity: defaultValue });
                                }
                              }
                            }}
                            onWheel={handleWheel}
                            className={`w-16 px-2 py-1.5 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm text-center ${
                              itemErrors[item.id]?.quantity ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="1"
                          />
                          {itemErrors[item.id]?.quantity && (
                            <p className="text-xs text-red-600 text-center">{itemErrors[item.id].quantity}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center space-x-1.5">
                          <Calculator className="h-4 w-4 text-gray-400" />
                          <p className="font-medium text-gray-900 text-sm whitespace-nowrap">₹{item.total.toLocaleString()}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => activeTab === 'exchange' ? removeExchangeItem(item.id) : removeBillItem(item.id)}
                            className="text-red-600 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition-colors"
                            title={t('billing.removeItem')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {!((activeTab === 'exchange' ? exchangeMaterial.exchangeItems : (currentBill.items || [])).length) && (
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">
                    {activeTab === 'exchange' ? t('billing.noExchangeItems') : t('billing.noItemsAdded')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bill/Invoice/Exchange Summary */}
        <div className="space-y-6">
          {/* Exchange Summary - Only show for exchange tab */}
          {activeTab === 'exchange' && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center space-x-2 mb-4">
                <Calculator className="h-5 w-5 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900">{t('billing.exchangeSummary')}</h2>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                    <Scale className="h-4 w-4" />
                    <span>{t('billing.oldMaterialDetails')}</span>
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{t('inventory.materialType')}:</span>
                      <span className="font-medium text-gray-900">{t(`inventory.${exchangeMaterial.materialType.toLowerCase()}`)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{t('billing.weightGrams')}:</span>
                      <span className="font-medium text-gray-900">{exchangeMaterial.oldMaterialWeight}g ({exchangeMaterial.oldMaterialPurity})</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{t('billing.oldMaterialRate')}:</span>
                      <span className="font-medium text-gray-900">₹{exchangeMaterial.oldMaterialRate.toLocaleString()}/g</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-gray-300 pt-3 mt-3">
                      <span className="text-sm font-semibold text-gray-700">{t('billing.oldMaterialValue')}:</span>
                      <span className="text-lg font-bold text-gray-900">₹{exchangeMaterial.oldMaterialValue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                    <Package className="h-4 w-4" />
                    <span>{t('billing.exchangeItems')}</span>
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{t('billing.itemsValue')}:</span>
                      <span className="font-medium text-gray-900">₹{exchangeMaterial.exchangeValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-green-300 pt-3 mt-3">
                      <span className="text-sm font-semibold text-gray-700">{t('billing.difference')}:</span>
                      <span className={`text-lg font-bold ${
                        exchangeMaterial.difference >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {exchangeMaterial.difference >= 0 ? '+' : ''}₹{exchangeMaterial.difference.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-sm text-gray-600 mb-2">
                      {exchangeMaterial.difference >= 0 
                        ? t('billing.customerPayAdditional') 
                        : t('billing.customerReceiveCash')}
                    </p>
                    <p className={`text-2xl font-bold ${
                      exchangeMaterial.difference >= 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {exchangeMaterial.difference >= 0 ? t('billing.pay') : t('billing.receive')} ₹{Math.abs(exchangeMaterial.difference).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Calculation Panel - Only show for billing and invoice tabs */}
          {activeTab !== 'exchange' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center space-x-2 mb-4">
              <Calculator className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                {activeTab === 'billing' ? t('billing.billSummaryDeductStock') : t('billing.invoiceSummaryQuoteEstimate')}
              </h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-gray-700">{t('billing.subtotal')}:</span>
                <span className="text-base font-semibold text-gray-900">₹{(currentBill.subtotal || 0).toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">{t('billing.discount')}:</span>
                <div className="flex flex-col items-end space-y-1">
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentBill.discount_amount || ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0) {
                          setCurrentBill(prev => ({ ...prev, discount_amount: value }));
                          if (billFormErrors.discount_amount) {
                            setBillFormErrors(prev => ({ ...prev, discount_amount: undefined }));
                          }
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '') {
                          setCurrentBill(prev => ({ ...prev, discount_amount: 0 }));
                        } else {
                          const value = parseFloat(e.target.value);
                          if (isNaN(value) || value < 0) {
                            setBillFormErrors(prev => ({ ...prev, discount_amount: t('billing.discountAmountInvalid') }));
                          } else if (value > (currentBill.subtotal || 0)) {
                            setBillFormErrors(prev => ({ ...prev, discount_amount: t('billing.discountExceedsSubtotal') }));
                          }
                        }
                      }}
                      onWheel={handleWheel}
                      className={`w-28 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm ${
                        billFormErrors.discount_amount ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="0"
                    />
                    <span className="text-sm text-gray-600 font-medium">₹</span>
                  </div>
                  {billFormErrors.discount_amount && (
                    <p className="text-xs text-red-600">{billFormErrors.discount_amount}</p>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-gray-700">{t('billing.discountAmount')}:</span>
                <span className="text-base font-semibold text-green-600">-₹{Math.round(currentBill.discount_amount || 0).toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">{t('billing.gst')}:</span>
                <div className="flex flex-col items-end space-y-1">
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={Math.round(currentBill.tax_percentage || 3)}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value >= 0 && value <= 100) {
                          setCurrentBill(prev => ({ ...prev, tax_percentage: value }));
                          if (billFormErrors.tax_percentage) {
                            setBillFormErrors(prev => ({ ...prev, tax_percentage: undefined }));
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const value = parseInt(e.target.value);
                        if (isNaN(value) || value < 0 || value > 100) {
                          setBillFormErrors(prev => ({ ...prev, tax_percentage: t('billing.taxPercentageInvalid') }));
                        }
                      }}
                      onWheel={handleWheel}
                      className={`w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm text-center ${
                        billFormErrors.tax_percentage ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="3"
                    />
                    <span className="text-sm text-gray-600 font-medium">%</span>
                  </div>
                  {billFormErrors.tax_percentage && (
                    <p className="text-xs text-red-600">{billFormErrors.tax_percentage}</p>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-gray-700">{t('billing.taxAmount')}:</span>
                <span className="text-base font-semibold text-gray-900">₹{(currentBill.tax_amount || 0).toLocaleString()}</span>
              </div>
              
              <div className="border-t border-gray-300 pt-4 mt-2">
                <div className="flex justify-between items-center py-2 bg-amber-50 rounded-lg px-3">
                  <span className="text-lg font-semibold text-gray-900">{t('billing.totalAmount')}:</span>
                  <span className="text-xl font-bold text-amber-600">₹{(currentBill.total_amount || 0).toLocaleString()}</span>
                </div>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('billing.paymentMethod')}
                  </label>
                  <select
                    value={currentBill.payment_method || 'cash'}
                    onChange={(e) => setCurrentBill(prev => ({ ...prev, payment_method: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                  >
                    <option value="cash">{t('common.cash')}</option>
                    <option value="card">{t('common.card')}</option>
                    <option value="upi">{t('common.upi')}</option>
                    <option value="bank_transfer">{t('common.bankTransfer')}</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('billing.amountPaid')}
                  </label>
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={currentBill.amount_paid || ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          if (!isNaN(value) && value >= 0) {
                            setCurrentBill(prev => ({ ...prev, amount_paid: value }));
                            if (billFormErrors.amount_paid) {
                              setBillFormErrors(prev => ({ ...prev, amount_paid: undefined }));
                            }
                          }
                        }}
                        onBlur={(e) => {
                          if (e.target.value === '') {
                            setCurrentBill(prev => ({ ...prev, amount_paid: 0 }));
                          } else {
                            const value = parseFloat(e.target.value);
                            if (isNaN(value) || value < 0) {
                              setBillFormErrors(prev => ({ ...prev, amount_paid: t('billing.amountPaidInvalid') }));
                            } else if (value > (currentBill.total_amount || 0)) {
                              setBillFormErrors(prev => ({ ...prev, amount_paid: t('billing.amountPaidExceedsTotal') }));
                            }
                          }
                        }}
                        onWheel={handleWheel}
                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm ${
                          billFormErrors.amount_paid ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-600 font-medium">₹</span>
                    </div>
                    {billFormErrors.amount_paid && (
                      <p className="text-xs text-red-600">{billFormErrors.amount_paid}</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('billing.paymentStatus')}
                  </label>
                  <select
                    value={currentBill.payment_status || 'pending'}
                    onChange={(e) => setCurrentBill(prev => ({ ...prev, payment_status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                  >
                    <option value="pending">{t('common.pending')}</option>
                    <option value="partial">{t('common.partial')}</option>
                    <option value="paid">{t('common.paid')}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Actions Section - Only show for billing and invoice tabs */}
          {activeTab !== 'exchange' && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center space-x-2 mb-4">
                <Settings className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
              </div>
              
              <div className="flex flex-col space-y-3">
                <div className="flex space-x-3">
                  {/* Generate Bill Button */}
                  <button
                    onClick={activeTab === 'invoice' ? saveInvoice : saveBill}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <FileText className="h-5 w-5" />
                    <span>{activeTab === 'invoice' ? t('billing.generateInvoice') : t('billing.generateBill')}</span>
                  </button>

                  {/* View Invoice/Bill Button */}
                  <button
                    onClick={() => {
                      if (!currentBill.items || currentBill.items.length === 0) {
                        error('Please add items before viewing the PDF');
                        return;
                      }

                      if (!selectedCustomer && !currentBill.customer_name) {
                        error('Please select or enter customer information');
                        return;
                      }

                      // Generate temporary bill/invoice number if not saved yet
                      const tempNumber = activeTab === 'invoice' 
                        ? `INV-PREVIEW-${Date.now()}`
                        : `BILL-PREVIEW-${Date.now()}`;

                      const tempDocument: any = {
                        id: 'preview',
                        invoice_number: activeTab === 'invoice' ? tempNumber : undefined,
                        bill_number: activeTab === 'billing' ? tempNumber : undefined,
                        customer_name: selectedCustomer?.name || currentBill.customer_name || '',
                        customer_phone: selectedCustomer?.phone || currentBill.customer_phone || '',
                        items: currentBill.items || [],
                        subtotal: currentBill.subtotal || 0,
                        tax_percentage: currentBill.tax_percentage || 0,
                        tax_amount: currentBill.tax_amount || 0,
                        discount_percentage: currentBill.discount_percentage || 0,
                        discount_amount: currentBill.discount_amount || 0,
                        total_amount: currentBill.total_amount || 0,
                        payment_method: currentBill.payment_method || 'cash',
                        payment_status: currentBill.payment_status || 'pending',
                        amount_paid: currentBill.amount_paid || 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      };

                      if (activeTab === 'invoice') {
                        generateInvoicePDF(tempDocument as Invoice);
                      } else {
                        generateBillPDF(tempDocument as Bill);
                      }
                    }}
                    disabled={!currentBill.items || currentBill.items.length === 0}
                    className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                      !currentBill.items || currentBill.items.length === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-yellow-500 text-white hover:bg-yellow-600'
                    }`}
                  >
                    <Eye className="h-5 w-5" />
                    <span>{activeTab === 'invoice' ? t('billing.previewInvoicePDF') : t('billing.previewBillPDF')}</span>
                  </button>
                </div>

                {/* Print Button */}
                <button
                  onClick={() => {
                    if (!currentBill.items || currentBill.items.length === 0) {
                      error('Please add items before printing');
                      return;
                    }

                    if (!selectedCustomer && !currentBill.customer_name) {
                      error('Please select or enter customer information');
                      return;
                    }

                    // Generate temporary bill/invoice number if not saved yet
                    const tempNumber = activeTab === 'invoice' 
                      ? `INV-PREVIEW-${Date.now()}`
                      : `BILL-PREVIEW-${Date.now()}`;

                    const tempDocument: any = {
                      id: 'preview',
                      invoice_number: activeTab === 'invoice' ? tempNumber : undefined,
                      bill_number: activeTab === 'billing' ? tempNumber : undefined,
                      customer_name: selectedCustomer?.name || currentBill.customer_name || '',
                      customer_phone: selectedCustomer?.phone || currentBill.customer_phone || '',
                      items: currentBill.items || [],
                      subtotal: currentBill.subtotal || 0,
                      tax_percentage: currentBill.tax_percentage || 0,
                      tax_amount: currentBill.tax_amount || 0,
                      discount_percentage: currentBill.discount_percentage || 0,
                      discount_amount: currentBill.discount_amount || 0,
                      total_amount: currentBill.total_amount || 0,
                      payment_method: currentBill.payment_method || 'cash',
                      payment_status: currentBill.payment_status || 'pending',
                      amount_paid: currentBill.amount_paid || 0,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    };

                    if (activeTab === 'invoice') {
                      printInvoicePDF(tempDocument as Invoice);
                    } else {
                      printBillPDF(tempDocument as Bill);
                    }
                  }}
                  disabled={!currentBill.items || currentBill.items.length === 0}
                  className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                    !currentBill.items || currentBill.items.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-purple-500 text-white hover:bg-purple-600'
                  }`}
                >
                  <Printer className="h-5 w-5" />
                  <span>{activeTab === 'invoice' ? 'Print Invoice' : 'Print Bill'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Actions Section - Only show for exchange tab */}
          {activeTab === 'exchange' && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center space-x-2 mb-4">
                <Settings className="h-5 w-5 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
              </div>
              
              <div className="flex flex-col space-y-3">
                <div className="flex space-x-3">
                  {/* Generate Exchange Bill Button */}
                  <button
                    onClick={saveExchangeBill}
                    disabled={!exchangeMaterial.exchangeItems.length || exchangeMaterial.oldMaterialWeight <= 0}
                    className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                      !exchangeMaterial.exchangeItems.length || exchangeMaterial.oldMaterialWeight <= 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    <span>{t('billing.generateExchangeBill')}</span>
                  </button>

                  {/* Preview Exchange Bill PDF Button */}
                  <button
                    onClick={() => {
                      if (!exchangeMaterial.exchangeItems.length) {
                        error('Please add exchange items before viewing the PDF');
                        return;
                      }

                      if (exchangeMaterial.oldMaterialWeight <= 0) {
                        error(t('billing.enterOldMaterialWeight'));
                        return;
                      }

                      if (!selectedCustomer && !currentBill.customer_name) {
                        error('Please select or enter customer information');
                        return;
                      }

                      // Calculate totals for exchange items
                      const exchangeSubtotal = exchangeMaterial.exchangeItems.reduce((sum, item) => sum + item.total, 0);
                      const exchangeTaxAmount = (exchangeSubtotal * (currentBill.tax_percentage || 0)) / 100;
                      const exchangeDiscountAmount = currentBill.discount_amount || 0;
                      const exchangeTotalAmount = exchangeSubtotal - exchangeDiscountAmount + exchangeTaxAmount;

                      // Generate temporary exchange bill number
                      const tempNumber = `EXCH-PREVIEW-${Date.now()}`;

                      const tempDocument: any = {
                        id: 'preview',
                        bill_number: tempNumber,
                        customer_name: selectedCustomer?.name || currentBill.customer_name || '',
                        customer_phone: selectedCustomer?.phone || currentBill.customer_phone || '',
                        items: exchangeMaterial.exchangeItems || [],
                        subtotal: exchangeSubtotal,
                        tax_percentage: currentBill.tax_percentage || 0,
                        tax_amount: exchangeTaxAmount,
                        discount_percentage: currentBill.discount_percentage || 0,
                        discount_amount: exchangeDiscountAmount,
                        total_amount: exchangeTotalAmount,
                        payment_method: currentBill.payment_method || 'cash',
                        payment_status: exchangeMaterial.difference >= 0 ? 'pending' : 'paid',
                        amount_paid: exchangeMaterial.difference < 0 ? Math.abs(exchangeMaterial.difference) : 0,
                        old_gold_weight: exchangeMaterial.oldMaterialWeight,
                        old_gold_purity: exchangeMaterial.oldMaterialPurity,
                        old_gold_rate: exchangeMaterial.oldMaterialRate,
                        old_gold_value: exchangeMaterial.oldMaterialValue,
                        exchange_rate: exchangeMaterial.exchangeRate,
                        exchange_difference: exchangeMaterial.difference,
                        material_type: exchangeMaterial.materialType,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      };

                      generateBillPDF(tempDocument as Bill);
                    }}
                    disabled={!exchangeMaterial.exchangeItems.length || exchangeMaterial.oldMaterialWeight <= 0}
                    className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                      !exchangeMaterial.exchangeItems.length || exchangeMaterial.oldMaterialWeight <= 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-yellow-500 text-white hover:bg-yellow-600'
                    }`}
                  >
                    <Eye className="h-5 w-5" />
                    <span>{t('billing.previewExchangeBillPDF')}</span>
                  </button>
                </div>

                {/* Print Exchange Bill Button */}
                <button
                  onClick={() => {
                    if (!exchangeMaterial.exchangeItems.length) {
                      error('Please add exchange items before printing');
                      return;
                    }

                    if (exchangeMaterial.oldMaterialWeight <= 0) {
                      error(t('billing.enterOldMaterialWeight'));
                      return;
                    }

                    if (!selectedCustomer && !currentBill.customer_name) {
                      error('Please select or enter customer information');
                      return;
                    }

                    // Calculate totals for exchange items
                    const exchangeSubtotal = exchangeMaterial.exchangeItems.reduce((sum, item) => sum + item.total, 0);
                    const exchangeTaxAmount = (exchangeSubtotal * (currentBill.tax_percentage || 0)) / 100;
                    const exchangeDiscountAmount = currentBill.discount_amount || 0;
                    const exchangeTotalAmount = exchangeSubtotal - exchangeDiscountAmount + exchangeTaxAmount;

                    // Generate temporary exchange bill number
                    const tempNumber = `EXCH-PREVIEW-${Date.now()}`;

                    const tempDocument: any = {
                      id: 'preview',
                      bill_number: tempNumber,
                      customer_name: selectedCustomer?.name || currentBill.customer_name || '',
                      customer_phone: selectedCustomer?.phone || currentBill.customer_phone || '',
                      items: exchangeMaterial.exchangeItems || [],
                      subtotal: exchangeSubtotal,
                      tax_percentage: currentBill.tax_percentage || 0,
                      tax_amount: exchangeTaxAmount,
                      discount_percentage: currentBill.discount_percentage || 0,
                      discount_amount: exchangeDiscountAmount,
                      total_amount: exchangeTotalAmount,
                      payment_method: currentBill.payment_method || 'cash',
                      payment_status: exchangeMaterial.difference >= 0 ? 'pending' : 'paid',
                      amount_paid: exchangeMaterial.difference < 0 ? Math.abs(exchangeMaterial.difference) : 0,
                      old_gold_weight: exchangeMaterial.oldMaterialWeight,
                      old_gold_purity: exchangeMaterial.oldMaterialPurity,
                      old_gold_rate: exchangeMaterial.oldMaterialRate,
                      old_gold_value: exchangeMaterial.oldMaterialValue,
                      exchange_rate: exchangeMaterial.exchangeRate,
                      exchange_difference: exchangeMaterial.difference,
                      material_type: exchangeMaterial.materialType,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    };

                    printBillPDF(tempDocument as Bill);
                  }}
                  disabled={!exchangeMaterial.exchangeItems.length || exchangeMaterial.oldMaterialWeight <= 0}
                  className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                    !exchangeMaterial.exchangeItems.length || exchangeMaterial.oldMaterialWeight <= 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-purple-500 text-white hover:bg-purple-600'
                  }`}
                >
                  <Printer className="h-5 w-5" />
                  <span>Print Exchange Bill</span>
                </button>
              </div>
            </div>
          )}

          {/* Exchange Bills - Only show for exchange tab */}
          {activeTab === 'exchange' && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">{t('billing.allExchangeBills')}</h2>
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                  {exchangeBills.length} {t('billing.exchangeBills')}
                </span>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {exchangeBills.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{bill.bill_number}</p>
                      <p className="text-sm text-gray-600">{bill.customer_name}</p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-green-600 font-medium">{t('billing.exchangeBill')}</span>
                        {(bill as any).old_gold_weight && (
                          <span className="text-xs text-gray-500">
                            {t('billing.oldGold')}: {(bill as any).old_gold_weight}g ({(bill as any).old_gold_purity})
                          </span>
                        )}
                        {(bill as any).exchange_difference !== undefined && (
                          <span className={`text-xs font-medium ${
                            (bill as any).exchange_difference >= 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {(bill as any).exchange_difference >= 0 ? t('billing.pay') : t('billing.receive')} ₹{Math.abs((bill as any).exchange_difference).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <p className="font-medium">₹{bill.total_amount.toLocaleString()}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          bill.payment_status === 'paid' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {bill.payment_status}
                        </span>
                      </div>
                      <button
                        onClick={() => generateBillPDF(bill)}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                        title={t('billing.downloadExchangeBillPDF')}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {exchangeBills.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">{t('billing.noExchangeBillsFound')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All Bills/Invoices - Only show for billing and invoice tabs */}
          {activeTab !== 'exchange' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {activeTab === 'invoice' ? t('billing.allInvoices') : t('billing.allBills')}
              </h2>
              <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                {activeTab === 'invoice' ? recentInvoices.length : recentBills.length} {activeTab === 'invoice' ? t('billing.invoices') : t('billing.bills')}
              </span>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activeTab === 'invoice' ? (
                recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                      <p className="text-sm text-gray-600">{invoice.customer_name}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <p className="font-medium">₹{invoice.total_amount.toLocaleString()}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          invoice.payment_status === 'paid' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {invoice.payment_status}
                        </span>
                      </div>
                      <button
                        onClick={() => generateInvoicePDF(invoice)}
                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Download Invoice PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                recentBills.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{bill.bill_number}</p>
                      <p className="text-sm text-gray-600">{bill.customer_name}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <p className="font-medium">₹{bill.total_amount.toLocaleString()}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          bill.payment_status === 'paid' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {bill.payment_status}
                        </span>
                      </div>
                      <button
                        onClick={() => generateBillPDF(bill)}
                        className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Download Bill PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
              {((activeTab === 'invoice' && recentInvoices.length === 0) || 
                (activeTab === 'billing' && recentBills.length === 0)) && (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    {activeTab === 'invoice' ? t('billing.noInvoicesFound') : t('billing.noBillsFound')}
                  </p>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Customer Modal */}
      {showCustomerModal && (
        <CustomerModal
          onClose={() => setShowCustomerModal(false)}
          onSelect={setSelectedCustomer}
          initialView={customerModalInitialView}
        />
      )}
    </div>
    </>
  );
};

export default Billing;