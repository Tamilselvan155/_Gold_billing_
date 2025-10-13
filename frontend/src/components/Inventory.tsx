import React, { useState, useEffect, useRef } from 'react';
import { Package, Plus, Search, Filter, CreditCard as Edit, Trash2, AlertTriangle, Scan, Download, Upload, Info, Scale, Barcode, User, Hash, Warehouse } from 'lucide-react';
import Database from '../utils/database';
import { Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

const Inventory: React.FC = () => {
  const { t } = useLanguage();
  const { success, error } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProductCategory, setSelectedProductCategory] = useState('all');
  const [selectedProductCategory, setSelectedProductCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  const categories = ['all', t('inventory.chains'), t('inventory.rings'), t('inventory.earrings'), t('inventory.bracelets'), t('inventory.necklaces'), t('inventory.bangles')];
  const productCategories = ['all', 'Men', 'Women', 'Kids'];
  const productCategories = ['all', 'Men', 'Women', 'Kids'];

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, selectedCategory, selectedProductCategory]);
  }, [products, searchTerm, selectedCategory, selectedProductCategory]);

  const loadProducts = async () => {
    try {
      const db = Database.getInstance();
      const productData = await db.query('products') as Product[];
      setProducts(productData);
    } catch (err) {
      console.error('Error loading products:', err);
      error('Failed to load products. Please try again.');
    }
  };

  const filterProducts = () => {
    let filtered = products;
    
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }
    
    if (selectedProductCategory !== 'all') {
      filtered = filtered.filter(product => product.product_category === selectedProductCategory);
    }
    
    if (selectedProductCategory !== 'all') {
      filtered = filtered.filter(product => product.product_category === selectedProductCategory);
    }
    
    setFilteredProducts(filtered);
  };

  const handleAddProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const db = Database.getInstance();
      const newProduct = await db.insert('products', productData);
      setProducts([...products, newProduct]);
      setShowAddModal(false);
      success('Product added successfully!');
    } catch (err) {
      console.error('Error adding product:', err);
      error('Failed to add product. Please try again.');
    }
  };

  const handleEditProduct = async (id: string, productData: Partial<Product>) => {
    try {
      const db = Database.getInstance();
      const updatedProduct = await db.update('products', id, productData);
      if (updatedProduct) {
        setProducts(products.map(p => p.id === id ? updatedProduct : p));
        setEditingProduct(null);
        success('Product updated successfully!');
      }
    } catch (err) {
      console.error('Error updating product:', err);
      error('Failed to update product. Please try again.');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm(t('inventory.confirmDelete'))) {
      try {
        const db = Database.getInstance();
        await db.delete('products', id);
        setProducts(products.filter(p => p.id !== id));
        success('Product deleted successfully!');
      } catch (err: any) {
        console.error('Error deleting product:', err);
        
        // Check if it's a foreign key constraint error
        if (err.response?.status === 400 && err.response?.data?.references) {
          const references = err.response.data.references;
          const message = `This product is referenced in ${references.bills} bill(s) and ${references.invoices} invoice(s). Do you want to delete it anyway? This will remove the product references from bills and invoices.`;
          
          if (window.confirm(message)) {
            try {
              // Try cascade deletion
              const db = Database.getInstance();
              await db.deleteWithCascade('products', id);
              setProducts(products.filter(p => p.id !== id));
              success('Product deleted successfully! References have been removed from bills and invoices.');
            } catch (cascadeErr) {
              console.error('Error in cascade delete:', cascadeErr);
              error('Failed to delete product even with cascade. Please try again.');
            }
          }
        } else {
          error('Failed to delete product. Please try again.');
        }
      }
    }
  };

  const ProductForm: React.FC<{
    product?: Product;
    onSubmit: (data: any) => void;
    onCancel: () => void;
  }> = ({ product, onSubmit, onCancel }) => {
    const { success, error } = useToast();
    const { success, error } = useToast();
    const [formData, setFormData] = useState({
      name: product?.name || '',
      category: product?.category || 'Chains',
      product_category: product?.product_category || null,
      sku: product?.sku || '',
      barcode: product?.barcode || '',
      weight: product?.weight || 0,
      purity: product?.purity || '22K',
      making_charge: product?.making_charge || 0,
      current_rate: product?.current_rate || 0,
      current_rate: product?.current_rate || 0,
      stock_quantity: product?.stock_quantity || 0,
      min_stock_level: product?.min_stock_level || 1,
      status: product?.status || 'active',
    });

    // Barcode scanner states
    const [isScanning, setIsScanning] = useState(false);
    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Barcode scanner functions
    const validateBarcode = (barcode: string): boolean => {
      if (!barcode || barcode.length < 3) return false;
      const barcodeRegex = /^[A-Za-z0-9\-_]+$/;
      return barcodeRegex.test(barcode);
    };

    const handleBarcodeInput = (value: string) => {
      setFormData({ ...formData, barcode: value });
      
      // Clear existing timeout
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }

      // Set a timeout to process barcode after user stops typing
      barcodeTimeoutRef.current = setTimeout(() => {
        if (value.trim()) {
          processBarcode(value.trim());
        }
      }, 100);
    };

    const processBarcode = (barcode: string) => {
      if (!validateBarcode(barcode)) {
        error('Invalid barcode format');
        return;
      }

      setIsScanning(true);
      
      // Check if barcode already exists (excluding current product if editing)
      const existingProduct = products.find(p => p.barcode === barcode && p.id !== product?.id);
      
      if (existingProduct) {
        error(`Barcode "${barcode}" already exists for product "${existingProduct.name}"`);
        setIsScanning(false);
        return;
      }
      
      // Simulate barcode processing delay
      setTimeout(() => {
        setFormData(prev => ({ ...prev, barcode }));
        success('Barcode scanned successfully!');
        setIsScanning(false);
      }, 300);
    };

    const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && formData.barcode.trim()) {
        e.preventDefault();
        processBarcode(formData.barcode.trim());
      }
    };

    const handleScanClick = () => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    };

    const generateBarcode = () => {
      // Generate a simple barcode based on product name and timestamp
      const timestamp = Date.now().toString().slice(-6);
      const productCode = formData.name.replace(/[^A-Z0-9]/gi, '').substring(0, 4).toUpperCase();
      const generatedBarcode = `${productCode}${timestamp}`;
      
      setFormData(prev => ({ ...prev, barcode: generatedBarcode }));
      success('Barcode generated successfully!');
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

    // Barcode scanner states
    const [isScanning, setIsScanning] = useState(false);
    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Barcode scanner functions
    const validateBarcode = (barcode: string): boolean => {
      if (!barcode || barcode.length < 3) return false;
      const barcodeRegex = /^[A-Za-z0-9\-_]+$/;
      return barcodeRegex.test(barcode);
    };

    const handleBarcodeInput = (value: string) => {
      setFormData({ ...formData, barcode: value });
      
      // Clear existing timeout
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }

      // Set a timeout to process barcode after user stops typing
      barcodeTimeoutRef.current = setTimeout(() => {
        if (value.trim()) {
          processBarcode(value.trim());
        }
      }, 100);
    };

    const processBarcode = (barcode: string) => {
      if (!validateBarcode(barcode)) {
        error('Invalid barcode format');
        return;
      }

      setIsScanning(true);
      
      // Check if barcode already exists (excluding current product if editing)
      const existingProduct = products.find(p => p.barcode === barcode && p.id !== product?.id);
      
      if (existingProduct) {
        error(`Barcode "${barcode}" already exists for product "${existingProduct.name}"`);
        setIsScanning(false);
        return;
      }
      
      // Simulate barcode processing delay
      setTimeout(() => {
        setFormData(prev => ({ ...prev, barcode }));
        success('Barcode scanned successfully!');
        setIsScanning(false);
      }, 300);
    };

    const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && formData.barcode.trim()) {
        e.preventDefault();
        processBarcode(formData.barcode.trim());
      }
    };

    const handleScanClick = () => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    };

    const generateBarcode = () => {
      // Generate a simple barcode based on product name and timestamp
      const timestamp = Date.now().toString().slice(-6);
      const productCode = formData.name.replace(/[^A-Z0-9]/gi, '').substring(0, 4).toUpperCase();
      const generatedBarcode = `${productCode}${timestamp}`;
      
      setFormData(prev => ({ ...prev, barcode: generatedBarcode }));
      success('Barcode generated successfully!');
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

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              {product ? t('inventory.editProduct') : t('inventory.addNewProduct')}
            </h2>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('inventory.productName')} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  {t('common.category')} *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  {categories.filter(cat => cat !== 'all').map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender/Age Category
                </label>
                <select
                  value={formData.product_category || ''}
                  onChange={(e) => setFormData({ ...formData, product_category: (e.target.value as 'Men' | 'Women' | 'Kids' | null) || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="">Select Gender/Age Category</option>
                  <option value="Men">Men</option>
                  <option value="Women">Women</option>
                  <option value="Kids">Kids</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('inventory.sku')} *
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                  {t('inventory.barcode')}
                </label>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                    Ctrl+B to focus
                  </span>
                </div>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                    Ctrl+B to focus
                  </span>
                </div>
                <div className="flex space-x-2">
                  <div className="flex-1 relative">
                  <div className="flex-1 relative">
                  <input
                      ref={barcodeInputRef}
                      ref={barcodeInputRef}
                    type="text"
                    value={formData.barcode}
                      onChange={(e) => handleBarcodeInput(e.target.value)}
                      onKeyDown={handleBarcodeKeyDown}
                      placeholder="Scan or enter barcode..."
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono text-sm"
                      disabled={isScanning}
                      title="Scan barcode or type manually. Press Enter to process."
                    />
                    {isScanning && (
                      <div className="absolute right-3 top-2.5">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-500 border-t-transparent"></div>
                      </div>
                    )}
                  </div>
                      onChange={(e) => handleBarcodeInput(e.target.value)}
                      onKeyDown={handleBarcodeKeyDown}
                      placeholder="Scan or enter barcode..."
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono text-sm"
                      disabled={isScanning}
                      title="Scan barcode or type manually. Press Enter to process."
                    />
                    {isScanning && (
                      <div className="absolute right-3 top-2.5">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-500 border-t-transparent"></div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleScanClick}
                    disabled={isScanning}
                    className={`px-3 py-2 rounded-lg transition-colors ${
                      isScanning 
                        ? 'bg-amber-100 text-amber-600 cursor-not-allowed' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title="Click to focus barcode scanner"
                    onClick={handleScanClick}
                    disabled={isScanning}
                    className={`px-3 py-2 rounded-lg transition-colors ${
                      isScanning 
                        ? 'bg-amber-100 text-amber-600 cursor-not-allowed' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title="Click to focus barcode scanner"
                  >
                    <Scan className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={generateBarcode}
                    disabled={isScanning || !formData.name.trim()}
                    className={`px-3 py-2 rounded-lg transition-colors ${
                      isScanning || !formData.name.trim()
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                    title="Generate barcode based on product name"
                  >
                    <Package className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={generateBarcode}
                    disabled={isScanning || !formData.name.trim()}
                    className={`px-3 py-2 rounded-lg transition-colors ${
                      isScanning || !formData.name.trim()
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                    title="Generate barcode based on product name"
                  >
                    <Package className="h-4 w-4" />
                  </button>
                </div>
                {isScanning && (
                  <div className="text-xs text-amber-600 mt-1 flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border border-amber-500 border-t-transparent mr-2"></div>
                    Scanning barcode...
                  </div>
                )}
                {formData.barcode && !isScanning && (
                  <div className="text-xs text-green-600 mt-1 flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Barcode ready
                  </div>
                )}
                {isScanning && (
                  <div className="text-xs text-amber-600 mt-1 flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border border-amber-500 border-t-transparent mr-2"></div>
                    Scanning barcode...
                  </div>
                )}
                {formData.barcode && !isScanning && (
                  <div className="text-xs text-green-600 mt-1 flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Barcode ready
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (grams) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.weight || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, weight: value === '' ? 0 : parseFloat(value) || 0 });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purity *
                </label>
                <select
                  value={formData.purity}
                  onChange={(e) => setFormData({ ...formData, purity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="24K">24K</option>
                  <option value="22K">22K</option>
                  <option value="18K">18K</option>
                  <option value="14K">14K</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Rate (per gram) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.current_rate || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, current_rate: value === '' ? 0 : parseFloat(value) || 0 });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Making Charge
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.making_charge || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, making_charge: value === '' ? 0 : parseFloat(value) || 0 });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Quantity *
                </label>
                <input
                  type="number"
                  value={formData.stock_quantity || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, stock_quantity: value === '' ? 0 : parseInt(value) || 0 });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Stock Level *
                </label>
                <input
                  type="number"
                  value={formData.min_stock_level || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, min_stock_level: value === '' ? 0 : parseInt(value) || 0 });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              
            </div>
            
            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                className="flex-1 bg-amber-500 text-white py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors"
              >
                {product ? 'Update Product' : 'Add Product'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('inventory.title')}</h1>
          <p className="text-gray-600 mt-1">{t('inventory.subtitle')}</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            <Download className="h-4 w-4" />
            <span>{t('common.export')}</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            <Upload className="h-4 w-4" />
            <span>{t('common.import')}</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
            title="Add new product to inventory"
          >
            <Plus className="h-4 w-4" />
            <span>{t('inventory.addProduct')}</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('inventory.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? t('common.allCategories') : category}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={selectedProductCategory}
                onChange={(e) => setSelectedProductCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {productCategories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Gender/Age' : category}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={selectedProductCategory}
                onChange={(e) => setSelectedProductCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {productCategories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Gender/Age' : category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">
                  {t('inventory.product')}
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">
                  {t('inventory.skuBarcode')}
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">
                  Gender/Age
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">
                  {t('common.weight')}
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">
                  Stock
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">
                  <span>{t('common.status')}</span>
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">
                  <span>{t('common.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4 text-[#4A90E2]" />
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-600">{product.category} • {product.purity}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Hash className="h-4 w-4 text-[#3B82F6]" />
                        <p className="text-sm font-medium text-gray-900">{product.sku}</p>
                      </div>
                      {product.barcode && (
                        <div className="flex items-center space-x-2">
                          <Barcode className="h-4 w-4 text-[#10B981]" />
                          <p className="text-xs text-gray-600">{product.barcode}</p>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-[#F59E0B]" />
                      {product.product_category ? (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          product.product_category === 'Men' 
                            ? 'bg-blue-100 text-blue-800' 
                            : product.product_category === 'Women'
                            ? 'bg-pink-100 text-pink-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {product.product_category}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Not set</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <Scale className="h-4 w-4 text-[#2E7D32]" />
                      <p className="text-sm text-gray-900">{product.weight}g</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">{product.stock_quantity}</span>
                      {product.stock_quantity <= product.min_stock_level && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      product.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                        title="Edit product"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete product"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">{t('inventory.noProductsFound')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <ProductForm
          onSubmit={handleAddProduct}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {editingProduct && (
        <ProductForm
          product={editingProduct}
          onSubmit={(data) => handleEditProduct(editingProduct.id, data)}
          onCancel={() => setEditingProduct(null)}
        />
      )}

      {/* Product Details Modal */}
      {viewingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                  Product Details
                  <Info className="h-5 w-5 text-blue-600" />
                </h2>
                <button
                  onClick={() => setViewingProduct(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Product Header */}
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Package className="h-8 w-8 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                    {viewingProduct.name}
                    <Info className="h-4 w-4 text-blue-600" />
                  </h3>
                  <p className="text-sm text-gray-600">{viewingProduct.category} • {viewingProduct.purity}</p>
                  <div className="mt-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      viewingProduct.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {viewingProduct.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Product Details Grid */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center space-x-1">
                      SKU
                      <Info className="h-4 w-4 text-blue-600" />
                    </label>
                    <p className="text-sm text-gray-900 font-mono">{viewingProduct.sku}</p>
                  </div>
                  
                  {viewingProduct.barcode && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center space-x-1">
                        Barcode
                        <Info className="h-4 w-4 text-blue-600" />
                      </label>
                      <p className="text-sm text-gray-900 font-mono">{viewingProduct.barcode}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center space-x-1">
                      Weight
                      <Info className="h-4 w-4 text-blue-600" />
                    </label>
                    <p className="text-sm text-gray-900">{viewingProduct.weight}g</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center space-x-1">
                      Purity
                      <Info className="h-4 w-4 text-blue-600" />
                    </label>
                    <p className="text-sm text-gray-900">{viewingProduct.purity}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center space-x-1">
                      Current Rate
                      <Info className="h-4 w-4 text-blue-600" />
                    </label>
                    <p className="text-sm text-gray-900">₹{viewingProduct.current_rate}/g</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center space-x-1">
                      Making Charge
                      <Info className="h-4 w-4 text-blue-600" />
                    </label>
                    <p className="text-sm text-gray-900">₹{viewingProduct.making_charge || 0}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center space-x-1">
                      Stock Quantity
                      <Info className="h-4 w-4 text-blue-600" />
                    </label>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm text-gray-900">{viewingProduct.stock_quantity}</p>
                      {viewingProduct.stock_quantity <= viewingProduct.min_stock_level && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center space-x-1">
                      Min Stock Level
                      <Info className="h-4 w-4 text-blue-600" />
                    </label>
                    <p className="text-sm text-gray-900">{viewingProduct.min_stock_level}</p>
                  </div>
                </div>
              </div>

              {/* Gender/Age Category */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center space-x-1">
                  Gender/Age Category
                  <Info className="h-4 w-4 text-blue-600" />
                </label>
                {viewingProduct.product_category ? (
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                    viewingProduct.product_category === 'Men' 
                      ? 'bg-blue-100 text-blue-800' 
                      : viewingProduct.product_category === 'Women'
                      ? 'bg-pink-100 text-pink-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {viewingProduct.product_category}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">Not set</span>
                )}
              </div>

              {/* Timestamps */}
              <div className="pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                  <div>
                    <label className="block font-medium mb-1 flex items-center space-x-1">
                      Created
                      <Info className="h-4 w-4 text-blue-600" />
                    </label>
                    <p>{new Date(viewingProduct.created_at).toLocaleDateString()} at {new Date(viewingProduct.created_at).toLocaleTimeString()}</p>
                  </div>
                  <div>
                    <label className="block font-medium mb-1 flex items-center space-x-1">
                      Last Updated
                      <Info className="h-4 w-4 text-blue-600" />
                    </label>
                    <p>{new Date(viewingProduct.updated_at).toLocaleDateString()} at {new Date(viewingProduct.updated_at).toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200">
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setViewingProduct(null);
                    setEditingProduct(viewingProduct);
                  }}
                  className="flex-1 bg-amber-500 text-white py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors"
                >
                  Edit Product
                </button>
                <button
                  onClick={() => setViewingProduct(null)}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
