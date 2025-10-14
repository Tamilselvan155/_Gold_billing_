import React, { useState, useEffect, useRef } from 'react';
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
  Settings
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
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [exchangeBills, setExchangeBills] = useState<Bill[]>([]);
  const [activeTab, setActiveTab] = useState<'billing' | 'invoice' | 'exchange'>('invoice');
  
  // Barcode scanner states
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [barcodeCache, setBarcodeCache] = useState<Map<string, Product>>(new Map());
  const [recentlyScanned, setRecentlyScanned] = useState<Set<string>>(new Set());
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Exchange gold states
  const [exchangeGold, setExchangeGold] = useState({
    oldGoldWeight: 0,
    oldGoldPurity: '22K',
    oldGoldRate: 5500,
    oldGoldValue: 0,
    exchangeRate: 5500,
    exchangeValue: 0,
    difference: 0,
    exchangeItems: [] as InvoiceItem[],
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateTotals();
  }, [currentBill.items, currentBill.tax_percentage, currentBill.discount_amount]);

  useEffect(() => {
    calculateExchangeTotals();
  }, [exchangeGold.oldGoldWeight, exchangeGold.oldGoldRate, exchangeGold.exchangeRate, exchangeGold.exchangeItems]);

  const loadData = async () => {
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
      error('Failed to load data. Please try again.');
    }
  };

  const calculateTotals = () => {
    const items = currentBill.items || [];
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    
    const discountAmount = currentBill.discount_amount || 0;
    const discountedSubtotal = subtotal - discountAmount;
    const taxAmount = (discountedSubtotal * (currentBill.tax_percentage || 0)) / 100;
    const totalAmount = discountedSubtotal + taxAmount;

    setCurrentBill(prev => ({
      ...prev,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
    }));
  };

  const calculateExchangeTotals = () => {
    const oldGoldValue = exchangeGold.oldGoldWeight * exchangeGold.oldGoldRate;
    const exchangeItemsTotal = exchangeGold.exchangeItems.reduce((sum, item) => sum + item.total, 0);
    const difference = exchangeItemsTotal - oldGoldValue;

    setExchangeGold(prev => ({
      ...prev,
      oldGoldValue,
      exchangeValue: exchangeItemsTotal,
      difference,
    }));
  };

  const addProductToBill = (product: Product) => {
    const existingItemIndex = (currentBill.items || []).findIndex(
      item => item.product_id === product.id
    );

    if (existingItemIndex >= 0) {
      const updatedItems = [...(currentBill.items || [])];
      updatedItems[existingItemIndex].quantity += 1;
      updatedItems[existingItemIndex].total = 
        (updatedItems[existingItemIndex].weight * updatedItems[existingItemIndex].rate + 
         updatedItems[existingItemIndex].making_charge) * updatedItems[existingItemIndex].quantity;
      
      setCurrentBill(prev => ({ ...prev, items: updatedItems }));
    } else {
      const newItem: InvoiceItem = {
        id: Date.now().toString(),
        product_id: product.id,
        product_name: product.name,
        weight: product.weight,
        rate: product.current_rate,
        making_charge: product.making_charge,
        quantity: 1,
        total: (product.weight * product.current_rate) + product.making_charge,
      };

      setCurrentBill(prev => ({
        ...prev,
        items: [...(prev.items || []), newItem],
      }));
    }
  };

  const updateBillItem = (itemId: string, updates: Partial<InvoiceItem>) => {
    const updatedItems = (currentBill.items || []).map(item => {
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
        
        updatedItem.total = (updatedItem.weight * updatedItem.rate + updatedItem.making_charge) * updatedItem.quantity;
        return updatedItem;
      }
      return item;
    });

    setCurrentBill(prev => ({ ...prev, items: updatedItems }));
  };

  const removeBillItem = (itemId: string) => {
    setCurrentBill(prev => ({
      ...prev,
      items: (prev.items || []).filter(item => item.id !== itemId),
    }));
  };

  // Exchange gold functions
  const addProductToExchange = (product: Product) => {
    const existingItemIndex = exchangeGold.exchangeItems.findIndex(
      item => item.product_id === product.id
    );

    if (existingItemIndex >= 0) {
      const updatedItems = [...exchangeGold.exchangeItems];
      updatedItems[existingItemIndex].quantity += 1;
      updatedItems[existingItemIndex].total = 
        (updatedItems[existingItemIndex].weight * updatedItems[existingItemIndex].rate + 
         updatedItems[existingItemIndex].making_charge) * updatedItems[existingItemIndex].quantity;
      
      setExchangeGold(prev => ({ ...prev, exchangeItems: updatedItems }));
    } else {
      const newItem: InvoiceItem = {
        id: Date.now().toString(),
        product_id: product.id,
        product_name: product.name,
        weight: product.weight,
        rate: product.current_rate,
        making_charge: product.making_charge,
        quantity: 1,
        total: (product.weight * product.current_rate) + product.making_charge,
      };

      setExchangeGold(prev => ({
        ...prev,
        exchangeItems: [...prev.exchangeItems, newItem],
      }));
    }
  };

  const updateExchangeItem = (itemId: string, updates: Partial<InvoiceItem>) => {
    const updatedItems = exchangeGold.exchangeItems.map(item => {
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
        
        updatedItem.total = (updatedItem.weight * updatedItem.rate + updatedItem.making_charge) * updatedItem.quantity;
        return updatedItem;
      }
      return item;
    });

    setExchangeGold(prev => ({ ...prev, exchangeItems: updatedItems }));
  };

  const removeExchangeItem = (itemId: string) => {
    setExchangeGold(prev => ({
      ...prev,
      exchangeItems: prev.exchangeItems.filter(item => item.id !== itemId),
    }));
  };

  // Barcode scanner functions
  // This implementation handles both dedicated barcode scanner hardware and manual input
  // Barcode scanners typically send input as rapid keyboard events, which this handles
  // with a timeout-based approach to distinguish between scanner and manual input
  
  const validateBarcode = (barcode: string): boolean => {
    // Basic barcode validation - can be enhanced based on barcode types
    if (!barcode || barcode.length < 3) return false;
    
    // Check if barcode contains only alphanumeric characters and common barcode characters
    const barcodeRegex = /^[A-Za-z0-9\-_]+$/;
    return barcodeRegex.test(barcode);
  };

  const findProductByBarcode = async (barcode: string): Promise<Product | null> => {
    // Check cache first
    if (barcodeCache.has(barcode)) {
      return barcodeCache.get(barcode) || null;
    }

    // Search in products array
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      // Cache the result
      setBarcodeCache(prev => new Map(prev).set(barcode, product));
      return product;
    }

    return null;
  };

  const handleBarcodeInput = async (value: string) => {
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
  };

  const processBarcode = async (barcode: string) => {
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
          error('Product is inactive');
          setBarcodeInput('');
          return;
        }

        // Check stock availability for billing
        if (activeTab === 'billing' && product.stock_quantity <= 0) {
          error(`Product "${product.name}" is out of stock`);
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
      error('Error processing barcode. Please try again.');
      setBarcodeInput('');
    } finally {
      setIsScanning(false);
    }
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Enter key for manual barcode entry
    if (e.key === 'Enter' && barcodeInput.trim()) {
      e.preventDefault();
      processBarcode(barcodeInput.trim());
    }
  };

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

    loading('Creating bill...');
    
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

      await db.createBill(billData);
      
      // Deduct inventory for each item (now deducts stock)
      for (const item of currentBill.items || []) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          await db.updateProduct(item.product_id, {
            stock_quantity: product.stock_quantity - item.quantity
          });
        }
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
      
      success('Bill saved successfully and inventory updated!');
    } catch (err) {
      console.error('Error saving bill:', err);
      error('Failed to save bill. Please try again.');
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

    loading('Creating invoice...');

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

      await db.createInvoice(invoiceData);
      
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
      
      success('Invoice saved successfully!');
    } catch (err) {
      console.error('Error saving invoice:', err);
      error('Failed to save invoice. Please try again.');
    } finally {
      dismiss();
    }
  };

  const CustomerModal: React.FC<{
    onClose: () => void;
    onSelect: (customer: Customer) => void;
  }> = ({ onClose, onSelect }) => {
    const [newCustomer, setNewCustomer] = useState({
      name: '',
      phone: '',
      email: '',
      address: '',
    });

    const handleAddCustomer = async () => {
      if (!newCustomer.name || !newCustomer.phone) {
        error(t('billing.nameAndPhoneRequired'));
        return;
      }

      try {
        const db = Database.getInstance();
        const customerData = await db.createCustomer(newCustomer);
        setCustomers([...customers, customerData]);
        onSelect(customerData);
        onClose();
        success('Customer created successfully!');
      } catch (err) {
        console.error('Error creating customer:', err);
        error('Failed to create customer. Please try again.');
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-300">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{t('billing.selectCustomer')}</h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Add New Customer */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-4">{t('billing.addNewCustomer')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder={`${t('billing.fullName')} *`}
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <input
                  type="tel"
                  placeholder={`${t('billing.phoneNumber')} *`}
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <input
                  type="email"
                  placeholder={t('billing.emailOptional')}
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <input
                  type="text"
                  placeholder={t('billing.addressOptional')}
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <button
                onClick={handleAddCustomer}
                className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
              >
                {t('billing.addCustomer')}
              </button>
            </div>

            {/* Existing Customers */}
            <div>
              <h3 className="font-medium text-gray-900 mb-4">{t('billing.existingCustomers')}</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {customers.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => {
                      onSelect(customer);
                      onClose();
                    }}
                    className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-amber-50 hover:border-amber-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{customer.name}</p>
                        <p className="text-sm text-gray-600">{customer.phone}</p>
                      </div>
                      <Check className="h-5 w-5 text-amber-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateBillPDF = (bill: Bill) => {
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
    doc.text(bill.customer_name || '', margin + 5, yPosition + 18);
    if (bill.customer_phone) {
      doc.text(`Phone: ${bill.customer_phone}`, margin + 5, yPosition + 28);
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
    doc.text(new Date(bill.created_at).toLocaleDateString('en-IN'), rightBoxX + 5, yPosition + 18);
    
    // Time box
    doc.setFillColor(240, 240, 240);
    doc.rect(rightBoxX, yPosition + 15, boxWidth, boxHeight, 'F');
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFont('helvetica', 'bold');
    doc.text('Time', rightBoxX + 5, yPosition + 23);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(bill.created_at).toLocaleTimeString('en-IN'), rightBoxX + 5, yPosition + 33);
    
    // NO box
    doc.setFillColor(240, 240, 240);
    doc.rect(rightBoxX, yPosition + 30, boxWidth, boxHeight, 'F');
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFont('helvetica', 'bold');
    doc.text('NO', rightBoxX + 5, yPosition + 38);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.bill_number || '', rightBoxX + 5, yPosition + 48);

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
    doc.save(`Bill-${bill.bill_number}.pdf`);
    success('Bill PDF downloaded successfully!');
  };

  const generateInvoicePDF = (invoice: Invoice) => {
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
    doc.text(new Date(invoice.created_at).toLocaleDateString('en-IN'), rightBoxX + 5, yPosition + 18);
    
    // Time box
    doc.setFillColor(240, 240, 240);
    doc.rect(rightBoxX, yPosition + 15, boxWidth, boxHeight, 'F');
    doc.setFillColor(0, 0, 0); // Black text
    doc.setFont('helvetica', 'bold');
    doc.text('Time', rightBoxX + 5, yPosition + 23);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(invoice.created_at).toLocaleTimeString('en-IN'), rightBoxX + 5, yPosition + 33);
    
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
    doc.save(`Invoice-${invoice.invoice_number}.pdf`);
    success('Invoice PDF downloaded successfully!');
  };

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
              onClick={() => {/* TODO: Implement exchange save */}}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Process Exchange</span>
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
            <span>Gold Exchange</span>
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
              <button
                onClick={() => setShowCustomerModal(true)}
                className="flex items-center space-x-2 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
              >
                <User className="h-4 w-4" />
                <span>{t('billing.selectCustomer')}</span>
              </button>
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
                  onClick={() => setSelectedCustomer(null)}
                  className="text-amber-600 hover:text-amber-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder={t('billing.customerName')}
                  value={currentBill.customer_name || ''}
                  onChange={(e) => setCurrentBill(prev => ({ ...prev, customer_name: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <input
                  type="tel"
                  placeholder={t('billing.phoneNumber')}
                  value={currentBill.customer_phone || ''}
                  onChange={(e) => setCurrentBill(prev => ({ ...prev, customer_phone: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            )}
          </div>

          {/* Exchange Gold Section - Only show for exchange tab */}
          {activeTab === 'exchange' && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Old Gold Details</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weight (grams) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={exchangeGold.oldGoldWeight || ''}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        setExchangeGold(prev => ({ ...prev, oldGoldWeight: value }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter weight in grams"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purity *
                  </label>
                  <select
                    value={exchangeGold.oldGoldPurity}
                    onChange={(e) => setExchangeGold(prev => ({ ...prev, oldGoldPurity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="24K">24K</option>
                    <option value="22K">22K</option>
                    <option value="18K">18K</option>
                    <option value="14K">14K</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Old Gold Rate (₹/g) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={exchangeGold.oldGoldRate || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value > 0) {
                        setExchangeGold(prev => ({ ...prev, oldGoldRate: value }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Rate per gram"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Exchange Rate (₹/g) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={exchangeGold.exchangeRate || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value > 0) {
                        setExchangeGold(prev => ({ ...prev, exchangeRate: value }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Current rate per gram"
                  />
                </div>
              </div>
              
              {/* Exchange Summary */}
              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600">Old Gold Value</p>
                    <p className="text-lg font-semibold text-gray-900">₹{exchangeGold.oldGoldValue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Exchange Value</p>
                    <p className="text-lg font-semibold text-gray-900">₹{exchangeGold.exchangeValue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Difference</p>
                    <p className={`text-lg font-semibold ${
                      exchangeGold.difference >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {exchangeGold.difference >= 0 ? '+' : ''}₹{exchangeGold.difference.toLocaleString()}
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
                  Ctrl+B to focus
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
                  title="Scan barcode or type manually. Press Enter to process."
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
                            <span className="text-xs text-green-600 font-medium">Scanned</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{product.weight}g • {product.purity}</p>
                      <p className="text-sm font-medium text-amber-600">
                        ₹{((product.weight * product.current_rate) + product.making_charge).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        Rate: ₹{product.current_rate}/g • Making: ₹{product.making_charge}
                      </p>
                      {activeTab === 'billing' && (
                        <p className="text-xs text-gray-500">Stock: {product.stock_quantity}</p>
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
            <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {activeTab === 'billing' ? t('billing.billItemsDeductStock') : 
               activeTab === 'invoice' ? t('billing.invoiceItemsQuoteEstimate') : 
               'Exchange Items'}
            </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4" />
                        <span>{t('billing.item')}</span>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                      <div className="flex items-center space-x-2">
                        <Scale className="h-4 w-4" />
                        <span>{t('billing.weight')}</span>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg font-bold">₹</span>
                        <span>{t('billing.rate')}</span>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                      <div className="flex items-center space-x-2">
                        <Wrench className="h-4 w-4" />
                        <span>{t('billing.making')}</span>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                      <div className="flex items-center space-x-2">
                        <Hash className="h-4 w-4" />
                        <span>{t('billing.qty')}</span>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                      <div className="flex items-center space-x-2">
                        <Calculator className="h-4 w-4" />
                        <span>{t('billing.total')}</span>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">
                      <div className="flex items-center space-x-2">
                        <Settings className="h-4 w-4" />
                        <span>{t('billing.action')}</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(activeTab === 'exchange' ? exchangeGold.exchangeItems : (currentBill.items || [])).map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{item.product_name}</p>
                        {activeTab === 'billing' && (
                          <p className="text-xs text-gray-500">
                            {t('billing.stock')}: {products.find(p => p.id === item.product_id)?.stock_quantity || 0}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Scale className="h-4 w-4 text-gray-400" />
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.weight}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value > 0) {
                                if (activeTab === 'exchange') {
                                  updateExchangeItem(item.id, { weight: value });
                                } else {
                                updateBillItem(item.id, { weight: value });
                                }
                              }
                            }}
                            className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                          />
                          <span className="text-sm text-gray-600">g</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400 font-bold">₹</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.rate}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              if (!isNaN(value) && value > 0) {
                                if (activeTab === 'exchange') {
                                  updateExchangeItem(item.id, { rate: value });
                                } else {
                                updateBillItem(item.id, { rate: value });
                                }
                              }
                            }}
                            className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Wrench className="h-4 w-4 text-gray-400" />
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.making_charge}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              if (!isNaN(value) && value >= 0) {
                                if (activeTab === 'exchange') {
                                  updateExchangeItem(item.id, { making_charge: value });
                                } else {
                                  updateBillItem(item.id, { making_charge: value });
                                }
                              }
                            }}
                            className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Hash className="h-4 w-4 text-gray-400" />
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              if (!isNaN(value) && value > 0) {
                                if (activeTab === 'exchange') {
                                  updateExchangeItem(item.id, { quantity: value });
                                } else {
                                updateBillItem(item.id, { quantity: value });
                                }
                              }
                            }}
                            className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Calculator className="h-4 w-4 text-gray-400" />
                          <p className="font-medium text-gray-900">₹{item.total.toLocaleString()}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Settings className="h-4 w-4 text-gray-400" />
                          <button
                            onClick={() => activeTab === 'exchange' ? removeExchangeItem(item.id) : removeBillItem(item.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {!((activeTab === 'exchange' ? exchangeGold.exchangeItems : (currentBill.items || [])).length) && (
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">
                    {activeTab === 'exchange' ? 'No exchange items added' : t('billing.noItemsAdded')}
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Exchange Summary</h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Old Gold Details</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Weight:</span>
                      <span className="font-medium">{exchangeGold.oldGoldWeight}g ({exchangeGold.oldGoldPurity})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Rate:</span>
                      <span className="font-medium">₹{exchangeGold.oldGoldRate}/g</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-600 font-medium">Old Gold Value:</span>
                      <span className="font-bold text-gray-900">₹{exchangeGold.oldGoldValue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Exchange Items</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Items Value:</span>
                      <span className="font-medium">₹{exchangeGold.exchangeValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-600 font-medium">Difference:</span>
                      <span className={`font-bold ${
                        exchangeGold.difference >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {exchangeGold.difference >= 0 ? '+' : ''}₹{exchangeGold.difference.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">
                      {exchangeGold.difference >= 0 
                        ? 'Customer needs to pay additional amount' 
                        : 'Customer will receive cash back'}
                    </p>
                    <p className={`text-xl font-bold ${
                      exchangeGold.difference >= 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {exchangeGold.difference >= 0 ? 'Pay' : 'Receive'} ₹{Math.abs(exchangeGold.difference).toLocaleString()}
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
              <div className="flex justify-between">
                <span className="text-gray-600">{t('billing.subtotal')}:</span>
                <span className="font-medium">₹{(currentBill.subtotal || 0).toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('billing.discount')}:</span>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={currentBill.discount_amount || 0}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        setCurrentBill(prev => ({ ...prev, discount_amount: value }));
                      }
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                  <span className="text-sm">₹</span>
                </div>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">{t('billing.discountAmount')}:</span>
                <span className="font-medium text-green-600">-₹{Math.round(currentBill.discount_amount || 0).toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('billing.gst')}:</span>
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
                      }
                    }}
                    className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                  <span className="text-sm">%</span>
                </div>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">{t('billing.taxAmount')}:</span>
                <span className="font-medium">₹{(currentBill.tax_amount || 0).toLocaleString()}</span>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">{t('billing.totalAmount')}:</span>
                  <span className="text-xl font-bold text-amber-600">₹{(currentBill.total_amount || 0).toLocaleString()}</span>
                </div>
              </div>
              
              <div className="space-y-3 pt-4 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('billing.paymentMethod')}
                  </label>
                  <select
                    value={currentBill.payment_method || 'cash'}
                    onChange={(e) => setCurrentBill(prev => ({ ...prev, payment_method: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="cash">{t('common.cash')}</option>
                    <option value="card">{t('common.card')}</option>
                    <option value="upi">{t('common.upi')}</option>
                    <option value="bank_transfer">{t('common.bankTransfer')}</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('billing.amountPaid')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={currentBill.amount_paid || 0}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        setCurrentBill(prev => ({ ...prev, amount_paid: value }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('billing.paymentStatus')}
                  </label>
                  <select
                    value={currentBill.payment_status || 'pending'}
                    onChange={(e) => setCurrentBill(prev => ({ ...prev, payment_status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
              
              <div className="flex space-x-3">
                {/* Generate Bill Button */}
                <button
                  onClick={activeTab === 'invoice' ? saveInvoice : saveBill}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <FileText className="h-5 w-5" />
                  <span>{activeTab === 'invoice' ? 'Generate Invoice' : 'Generate Bill'}</span>
                </button>

                {/* View Invoice Button */}
                <button
                  onClick={() => {
                    // TODO: Implement view invoice functionality
                    if (activeTab === 'invoice' && recentInvoices.length > 0) {
                      generateInvoicePDF(recentInvoices[0]);
                    } else if (activeTab === 'billing' && recentBills.length > 0) {
                      generateBillPDF(recentBills[0]);
                    } else {
                      error('No recent documents to view');
                    }
                  }}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  <Eye className="h-5 w-5" />
                  <span>View {activeTab === 'invoice' ? 'Invoice' : 'Bill'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Exchange Bills - Only show for exchange tab */}
          {activeTab === 'exchange' && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">All Exchange Bills</h2>
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                  {exchangeBills.length} exchange bills
                </span>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {exchangeBills.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{bill.bill_number}</p>
                      <p className="text-sm text-gray-600">{bill.customer_name}</p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-green-600 font-medium">Exchange Bill</span>
                        {(bill as any).old_gold_weight && (
                          <span className="text-xs text-gray-500">
                            Old Gold: {(bill as any).old_gold_weight}g ({(bill as any).old_gold_purity})
                          </span>
                        )}
                        {(bill as any).exchange_difference !== undefined && (
                          <span className={`text-xs font-medium ${
                            (bill as any).exchange_difference >= 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {(bill as any).exchange_difference >= 0 ? 'Pay' : 'Receive'} ₹{Math.abs((bill as any).exchange_difference).toLocaleString()}
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
                        title="Download Exchange Bill PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {exchangeBills.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No exchange bills found</p>
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
        />
      )}
    </div>
    </>
  );
};

export default Billing;