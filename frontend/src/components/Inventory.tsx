import React, { useState, useEffect, useRef } from 'react';
import { Package, Plus, Search, Filter, CreditCard, Trash2, AlertTriangle, Scan, Download, Upload, Info, Scale, Barcode, User, Hash, IndianRupee, Sparkles, Clock, Gauge, Wrench } from 'lucide-react';
import Database from '../utils/database';
import { Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onSubmit, onCancel }) => {
  const { success, error } = useToast();
  const { t } = useLanguage();
  const [formData, setFormData] = useState<Omit<Product, 'id' | 'created_at' | 'updated_at'>>({
    name: product?.name || '',
    category: product?.category || 'Chains',
    product_category: product?.product_category || null,
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    weight: product?.weight || 0,
    purity: product?.purity || '22K',
    making_charge: product?.making_charge || 0,
    current_rate: product?.current_rate || 0,
    stock_quantity: product?.stock_quantity || 0,
    min_stock_level: product?.min_stock_level || 1,
    status: product?.status || 'active',
  });

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const validateBarcode = (barcode: string): boolean => {
    if (!barcode || barcode.length < 3) return false;
    const barcodeRegex = /^[A-Za-z0-9\-_]+$/;
    return barcodeRegex.test(barcode);
  };

  const handleBarcodeInput = (value: string) => {
    setFormData({ ...formData, barcode: value });

    if (barcodeTimeoutRef.current) {
      clearTimeout(barcodeTimeoutRef.current);
    }

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
    const timestamp = Date.now().toString().slice(-6);
    const productCode = formData.name.replace(/[^A-Z0-9]/gi, '').substring(0, 4).toUpperCase();
    const generatedBarcode = `${productCode}${timestamp}`;
    setFormData(prev => ({ ...prev, barcode: generatedBarcode }));
    success('Barcode generated successfully!');
  };

  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

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

  useEffect(() => {
    return () => {
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = () => {
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
        <div className="p-6 space-y-4">
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
                {['Chains', 'Rings', 'Earrings', 'Bracelets', 'Necklaces', 'Bangles'].map(category => (
                  <option key={category} value={category}>{t(`inventory.${category.toLowerCase()}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender/Age Category
              </label>
              <select
                value={formData.product_category || ''}
                onChange={(e) => setFormData({ ...formData, product_category: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">Select Gender/Age Category</option>
                {['Men', 'Women', 'Kids'].map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
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
                <label className="block text-sm font-medium text-gray-700">{t('inventory.barcode')}</label>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Ctrl+B to focus</span>
              </div>
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => handleBarcodeInput(e.target.value)}
                    onKeyDown={handleBarcodeKeyDown}
                    placeholder="Scan or enter barcode..."
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-monowarden-blockquotesono text-sm"
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
                  className={`px-3 py-2 rounded-lg transition-colors ${isScanning ? 'bg-amber-100 text-amber-600 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  title="Click to focus barcode scanner"
                >
                  <Scan className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={generateBarcode}
                  disabled={isScanning || !formData.name.trim()}
                  className={`px-3 py-2 rounded-lg transition-colors ${isScanning || !formData.name.trim() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
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
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (grams) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.weight || ''}
                onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purity *</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Rate (per gram) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.current_rate || ''}
                onChange={(e) => setFormData({ ...formData, current_rate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Making Charge</label>
              <input
                type="number"
                step="0.01"
                value={formData.making_charge || ''}
                onChange={(e) => setFormData({ ...formData, making_charge: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity *</label>
              <input
                type="number"
                value={formData.stock_quantity || ''}
                onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Stock Level *</label>
              <input
                type="number"
                value={formData.min_stock_level || ''}
                onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
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
              type="button"
              onClick={handleSubmit}
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
        </div>
      </div>
    </div>
  );
};

const Inventory: React.FC = () => {
  const { t } = useLanguage();
  const { success, error } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  const categories: string[] = ['all', t('inventory.chains'), t('inventory.rings'), t('inventory.earrings'), t('inventory.bracelets'), t('inventory.necklaces'), t('inventory.bangles')];
  const productCategories: string[] = ['all', 'Men', 'Women', 'Kids'];

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, selectedCategory, selectedProductCategory]);

  const loadProducts = async () => {
    try {
      const db = Database.getInstance();
      const productData = await db.query('products') as Product[];
      setProducts(productData);
    } catch (err: unknown) {
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
        (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
        if (err.response?.status === 400 && err.response?.data?.references) {
          const references = err.response.data.references;
          const message = `This product is referenced in ${references.bills} bill(s) and ${references.invoices} invoice(s). Do you want to delete it anyway? This will remove the product references from bills and invoices.`;

          if (window.confirm(message)) {
            try {
              await db.deleteWithCascade('products', id);
              setProducts(products.filter(p => p.id !== id));
              success('Product deleted successfully! References have been removed from bills and invoices.');
            } catch (cascadeErr: unknown) {
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

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
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
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">{t('inventory.product')}</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">{t('inventory.skuBarcode')}</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Gender/Age</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">{t('common.weight')}</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Stock</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">{t('common.status')}</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">{t('common.actions')}</th>
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
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${product.product_category === 'Men' ? 'bg-blue-100 text-blue-800' :
                            product.product_category === 'Women' ? 'bg-pink-100 text-pink-800' :
                              'bg-green-100 text-green-800'
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
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${product.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
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
                        <CreditCard className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete product"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setViewingProduct(product)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="View product details"
                      >
                        <Info className="h-4 w-4" />
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

      {viewingProduct && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[95vh] flex flex-col">

            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex flex-col">
                <h2 className="text-2xl font-semibold text-gray-900 flex items-center space-x-2">
                  <Package className="h-6 w-6 text-indigo-600 mr-2" />
                  {viewingProduct.name}
                </h2>

                <div className="mt-2 flex items-center space-x-4">
                  <span className="font-mono text-base font-semibold text-indigo-800 bg-indigo-50 px-3 py-1 rounded-md flex items-center">
                    <Hash className="inline h-4 w-4 mr-2 text-indigo-600" />
                    SKU: {viewingProduct.sku}
                  </span>
                  {viewingProduct.barcode && (
                    <span className="font-mono text-base font-semibold text-green-800 bg-green-50 px-3 py-1 rounded-md flex items-center">
                      <Barcode className="inline h-4 w-4 mr-2 text-green-600" />
                      Barcode: {viewingProduct.barcode}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setViewingProduct(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
                title="Close"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-8 overflow-y-auto flex-grow">

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Classification & Purity</h3>
                <div className="grid grid-cols-3 gap-6">

                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center space-x-1">
                      <User className="h-4 w-4 text-purple-500" />
                      Category
                    </label>
                    <p className="text-base font-medium text-gray-900">{viewingProduct.category}</p>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center space-x-1">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      Purity
                    </label>
                    <p className="text-base font-medium text-gray-900">{viewingProduct.purity}</p>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center space-x-1">
                      <User className="h-4 w-4 text-purple-500" />
                      Target Group
                    </label>
                    {viewingProduct.product_category ? (
                      <span
                        className={`px-2.5 py-0.5 text-sm font-medium rounded ${viewingProduct.product_category === 'Men' ? 'bg-blue-50 text-blue-800' :
                            viewingProduct.product_category === 'Women' ? 'bg-pink-50 text-pink-800' :
                              'bg-green-50 text-green-800'
                          }`}
                      >
                        {viewingProduct.product_category}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Not Specified</span>
                    )}
                  </div>
                </div>
              </div>

              <hr className="border-gray-100" />

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Financials</h3>
                <div className="grid grid-cols-2 gap-8">

                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm">
                    <label className="block text-sm font-medium text-indigo-700 mb-1 flex items-center space-x-1">
                      <IndianRupee className="h-5 w-5 text-indigo-700" />
                      Current Rate (per gram)
                    </label>
                    <p className="text-3xl font-bold text-indigo-900">₹{viewingProduct.current_rate}</p>
                  </div>

                  <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center space-x-1">
                      <Wrench className="h-4 w-4 text-indigo-600" />
                      Making Charge
                    </label>
                    <p className="text-2xl font-bold text-gray-900">₹{viewingProduct.making_charge || 0}</p>
                  </div>
                </div>
              </div>

              <hr className="border-gray-100" />

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Inventory Status</h3>
                <div className="grid grid-cols-3 gap-6">

                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center space-x-1">
                      <Scale className="h-4 w-4 text-teal-500" />
                      Unit Weight
                    </label>
                    <p className="text-base font-medium text-gray-900">{viewingProduct.weight}g</p>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center space-x-1">
                      <Package className="h-4 w-4 text-teal-500" />
                      Current Stock
                    </label>
                    <div className="flex items-center space-x-2">
                      <p className="text-base font-medium text-gray-900">{viewingProduct.stock_quantity}</p>
                      {viewingProduct.stock_quantity <= viewingProduct.min_stock_level && (
                        <span className="flex items-center text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Low
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center space-x-1">
                      <Gauge className="h-4 w-4 text-teal-500" />
                      Minimum Level
                    </label>
                    <p className="text-base font-medium text-gray-900">{viewingProduct.min_stock_level}</p>
                  </div>
                </div>
              </div>

              <hr className="border-gray-100" />

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Audit History</h3>
                <div className="grid grid-cols-2 gap-6">

                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center space-x-1">
                      <Clock className="h-4 w-4 text-blue-500" />
                      Record Created
                    </label>
                    <p className="text-sm text-gray-900">
                      {new Date(viewingProduct.created_at).toLocaleDateString()} at{' '}
                      <span className="font-mono">{new Date(viewingProduct.created_at).toLocaleTimeString()}</span>
                    </p>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center space-x-1">
                      <Clock className="h-4 w-4 text-blue-500" />
                      Last Modified
                    </label>
                    <p className="text-sm text-gray-900">
                      {new Date(viewingProduct.updated_at).toLocaleDateString()} at{' '}
                      <span className="font-mono">{new Date(viewingProduct.updated_at).toLocaleTimeString()}</span>
                    </p>
                  </div>
                </div>
              </div>

            </div>

            <div className="p-6 border-t border-gray-200 sticky bottom-0 bg-white z-10">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setViewingProduct(null)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setViewingProduct(null);
                    setEditingProduct(viewingProduct);
                  }}
                  className="flex items-center bg-amber-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md"
                >
                  <Wrench className="h-5 w-5 mr-2" />
                  Edit Product Details
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