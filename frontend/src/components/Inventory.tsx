import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Package, Plus, Search, CreditCard, Trash2, AlertTriangle, Scan, Download, Upload, Info, Scale, Barcode, User, Hash, Sparkles, Clock, Gauge, Wrench, X, RotateCcw, FolderPlus, Trash } from 'lucide-react';
import Database from '../utils/database';
import { Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
  availableCategories?: string[];
  onCategoryAdded?: (category: string) => void;
  onCategoryDeleted?: (category: string) => void;
  products?: Product[];
}

const ProductForm: React.FC<ProductFormProps> = ({ product, onSubmit, onCancel, availableCategories = [], onCategoryAdded, onCategoryDeleted, products = [] }) => {
  const { success, error } = useToast();
  const { t } = useLanguage();

  const [formData, setFormData] = useState<Omit<Product, 'id' | 'created_at' | 'updated_at'>>({
    name: product?.name || '',
    category: product?.category || 'Chains',
    product_category: product?.product_category || undefined,
    material_type: product?.material_type || 'Gold',
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    weight: product?.weight || 0,
    purity: product?.purity || '22K',
    making_charge: 0, // Will be set in billing module
    current_rate: 0, // Will be set in billing module
    stock_quantity: product?.stock_quantity || 0,
    min_stock_level: product?.min_stock_level || 1,
    status: product?.status || 'active',
  });

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    sku?: string;
    weight?: string;
    stock_quantity?: string;
    min_stock_level?: string;
    barcode?: string;
  }>({});

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
      error(t('inventory.invalidBarcode'));
      return;
    }

    setIsScanning(true);

    setTimeout(() => {
      setFormData(prev => ({ ...prev, barcode }));
      success(t('inventory.barcodeScanSuccess'));
      setIsScanning(false);
    }, 300);
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && formData.barcode && formData.barcode.trim()) {
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
    success(t('inventory.barcodeGenerateSuccess'));
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

  const validateForm = (): boolean => {
    const errors: {
      name?: string;
      sku?: string;
      weight?: string;
      stock_quantity?: string;
      min_stock_level?: string;
      barcode?: string;
    } = {};

    // Name validation
    if (!formData.name.trim()) {
      errors.name = t('inventory.productNameRequired');
    } else if (formData.name.trim().length < 2) {
      errors.name = t('inventory.productNameMinLength');
    }

    // SKU validation
    if (!formData.sku.trim()) {
      errors.sku = t('inventory.skuRequired');
    } else if (formData.sku.trim().length < 2) {
      errors.sku = t('inventory.skuMinLength');
    }

    // Weight validation
    if (!formData.weight || formData.weight <= 0) {
      errors.weight = t('inventory.weightRequired');
    } else if (formData.weight > 10000) {
      errors.weight = t('inventory.weightMaxValue');
    }

    // Stock quantity validation
    if (formData.stock_quantity === undefined || formData.stock_quantity < 0) {
      errors.stock_quantity = t('inventory.stockQuantityRequired');
    } else if (formData.stock_quantity > 1000000) {
      errors.stock_quantity = t('inventory.stockQuantityMaxValue');
    }

    // Min stock level validation
    if (formData.min_stock_level === undefined || formData.min_stock_level < 0) {
      errors.min_stock_level = t('inventory.minStockLevelRequired');
    } else if (formData.min_stock_level > 100000) {
      errors.min_stock_level = t('inventory.minStockLevelMaxValue');
    }

    // Barcode validation (optional but must be valid if provided)
    if (formData.barcode && formData.barcode.trim()) {
      if (!validateBarcode(formData.barcode.trim())) {
        errors.barcode = t('inventory.barcodeInvalid');
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }
    onSubmit(formData);
  };

  const handleWheel = (event: React.WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur();
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      error(t('inventory.categoryNameRequired'));
      return;
    }

    const trimmedCategory = newCategoryName.trim();
    
    // Check if category already exists
    const allCategories = ['Chains', 'Rings', 'Earrings', 'Bracelets', 'Necklaces', 'Bangles', ...availableCategories];
    if (allCategories.some(cat => cat.toLowerCase() === trimmedCategory.toLowerCase())) {
      error(t('inventory.categoryAlreadyExists'));
      return;
    }

    // Add the new category
    if (onCategoryAdded) {
      onCategoryAdded(trimmedCategory);
    }
    
    // Set the new category as selected
    setFormData({ ...formData, category: trimmedCategory });
    setNewCategoryName('');
    setShowAddCategoryModal(false);
    success(t('inventory.categoryAddedSuccess'));
  };

  return createPortal(
    <div className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] m-0" style={{ margin: 0 }}>
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
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) {
                    setFormErrors({ ...formErrors, name: undefined });
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                  formErrors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {formErrors.name && (
                <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-800">
                  {t('common.category')} *
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(true)}
                  className="flex items-center space-x-1 px-2 py-1 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                  title={t('inventory.addNewCategory')}
                >
                  <FolderPlus className="h-3 w-3" />
                  <span>{t('inventory.addCategory')}</span>
                </button>
              </div>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {['Chains', 'Rings', 'Earrings', 'Bracelets', 'Necklaces', 'Bangles', ...availableCategories].map(category => {
                  const translationKey = `inventory.${category.toLowerCase()}`;
                  const translatedName = t(translationKey);
                  // If translation exists and is different from key, use it; otherwise use category name
                  const displayName = translatedName !== translationKey ? translatedName : category;
                  return (
                    <option key={category} value={category}>{displayName}</option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('inventory.genderAgeCategory')}
              </label>
              <select
                value={formData.product_category || ''}
                onChange={(e) => setFormData({ ...formData, product_category: (e.target.value as 'Men' | 'Women' | 'Kids') || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">{t('inventory.selectGenderAgeCategory')}</option>
                {['Men', 'Women', 'Kids'].map(category => (
                  <option key={category} value={category}>{t(`inventory.${category.toLowerCase()}`)}</option>
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
                onChange={(e) => {
                  setFormData({ ...formData, sku: e.target.value });
                  if (formErrors.sku) {
                    setFormErrors({ ...formErrors, sku: undefined });
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                  formErrors.sku ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {formErrors.sku && (
                <p className="mt-1 text-xs text-red-600">{formErrors.sku}</p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">{t('inventory.barcode')}</label>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">{t('inventory.barcodeFocusShortcut')}</span>
              </div>
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => handleBarcodeInput(e.target.value)}
                    onKeyDown={handleBarcodeKeyDown}
                    placeholder={t('inventory.barcodePlaceholder')}
                    className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-monowarden-blockquotesono text-sm ${
                      formErrors.barcode ? 'border-red-500' : 'border-gray-300'
                    }`}
                    disabled={isScanning}
                    title={t('inventory.barcodeInputTitle')}
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
                  title={t('inventory.focusBarcodeInput')}
                >
                  <Scan className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={generateBarcode}
                  disabled={isScanning || !formData.name.trim()}
                  className={`px-3 py-2 rounded-lg transition-colors ${isScanning || !formData.name.trim() ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  title={t('inventory.generateBarcodeHint')}
                >
                  <Package className="h-4 w-4" />
                </button>
              </div>
              {formErrors.barcode && (
                <p className="mt-1 text-xs text-red-600">{formErrors.barcode}</p>
              )}
              {isScanning && !formErrors.barcode && (
                <div className="text-xs text-amber-600 mt-1 flex items-center">
                  <div className="animate-spin rounded-full h-3 w-3 border border-amber-500 border-t-transparent mr-2"></div>
                  {t('inventory.barcodeScanning')}
                </div>
              )}
              {formData.barcode && !isScanning && !formErrors.barcode && (
                <div className="text-xs text-green-600 mt-1 flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  {t('inventory.barcodeReady')}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.weightGrams')} *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="10000"
                value={formData.weight || ''}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setFormData({ ...formData, weight: value });
                  if (formErrors.weight) {
                    setFormErrors({ ...formErrors, weight: undefined });
                  }
                }}
                onWheel={handleWheel}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                  formErrors.weight ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {formErrors.weight && (
                <p className="mt-1 text-xs text-red-600">{formErrors.weight}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.materialType')} *</label>
              <select
                value={formData.material_type || 'Gold'}
                onChange={(e) => setFormData({ ...formData, material_type: e.target.value as 'Gold' | 'Silver' | 'Platinum' | 'Diamond' | 'Other' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="Gold">{t('inventory.gold')}</option>
                <option value="Silver">{t('inventory.silver')}</option>
                <option value="Platinum">{t('inventory.platinum')}</option>
                <option value="Diamond">{t('inventory.diamond')}</option>
                <option value="Other">{t('inventory.other')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.purity')} *</label>
              <select
                value={formData.purity}
                onChange={(e) => {
                  const newPurity = e.target.value;
                  setFormData({ 
                    ...formData, 
                    purity: newPurity
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="24K">24K</option>
                <option value="22K">22K</option>
                <option value="18K">18K</option>
                <option value="14K">14K</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.stockQuantity')} *</label>
              <input
                type="number"
                min="0"
                max="1000000"
                value={formData.stock_quantity || ''}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  setFormData({ ...formData, stock_quantity: value });
                  if (formErrors.stock_quantity) {
                    setFormErrors({ ...formErrors, stock_quantity: undefined });
                  }
                }}
                onWheel={handleWheel}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                  formErrors.stock_quantity ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {formErrors.stock_quantity && (
                <p className="mt-1 text-xs text-red-600">{formErrors.stock_quantity}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.minStockLevel')} *</label>
              <input
                type="number"
                min="0"
                max="100000"
                value={formData.min_stock_level || ''}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  setFormData({ ...formData, min_stock_level: value });
                  if (formErrors.min_stock_level) {
                    setFormErrors({ ...formErrors, min_stock_level: undefined });
                  }
                }}
                onWheel={handleWheel}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                  formErrors.min_stock_level ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {formErrors.min_stock_level && (
                <p className="mt-1 text-xs text-red-600">{formErrors.min_stock_level}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.status')} *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="active">{t('common.active')}</option>
                <option value="inactive">{t('common.inactive')}</option>
              </select>
            </div>
          </div>
          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 bg-amber-500 text-white py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors"
            >
              {product ? t('inventory.updateProduct') : t('inventory.addProduct')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddCategoryModal && createPortal(
        <div className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] m-0" style={{ margin: 0 }}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                  <FolderPlus className="h-5 w-5 text-amber-500" />
                  <span>{t('inventory.manageCategories')}</span>
                </h3>
                <button
                  onClick={() => {
                    setShowAddCategoryModal(false);
                    setNewCategoryName('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Add New Category Section */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">{t('inventory.addNewCategory')}</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('inventory.categoryName')} *
                  </label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                    placeholder={t('inventory.categoryNamePlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('inventory.categoryNameHint')}</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="mt-3 w-full bg-amber-500 text-white py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors"
                >
                  {t('inventory.addCategory')}
                </button>
              </div>

              {/* Custom Categories List */}
              {availableCategories.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">{t('inventory.customCategories')}</h4>
                  <div className="space-y-2">
                    {availableCategories.map((category) => {
                      const translationKey = `inventory.${category.toLowerCase()}`;
                      const translatedName = t(translationKey);
                      const displayName = translatedName !== translationKey ? translatedName : category;
                      const isInUse = products.some(p => p.category === category);
                      
                      return (
                        <div
                          key={category}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <span className="text-sm font-medium text-gray-900">{displayName}</span>
                          <div className="flex items-center space-x-2">
                            {isInUse && (
                              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                {t('inventory.inUse')}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (onCategoryDeleted) {
                                  onCategoryDeleted(category);
                                }
                              }}
                              disabled={isInUse}
                              className={`p-2 rounded-lg transition-colors ${
                                isInUse
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                              }`}
                              title={isInUse ? t('inventory.cannotDeleteInUse') : t('inventory.deleteCategory')}
                            >
                              <Trash className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCategoryModal(false);
                    setNewCategoryName('');
                  }}
                  className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
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
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [cascadeDeleteInfo, setCascadeDeleteInfo] = useState<{ product: Product; message: string } | null>(null);

  // Build categories list including custom categories
  const baseCategories = ['Chains', 'Rings', 'Earrings', 'Bracelets', 'Necklaces', 'Bangles'];
  const allCategories = [...baseCategories, ...customCategories];
  const productCategories: string[] = ['all', 'Men', 'Women', 'Kids'];
  const productCategoryLabels: { [key: string]: string } = {
    'all': t('inventory.allGenderAge'),
    'Men': t('inventory.men'),
    'Women': t('inventory.women'),
    'Kids': t('inventory.kids')
  };

  useEffect(() => {
    loadProducts();
    loadCustomCategories();
  }, []);

  const loadCustomCategories = () => {
    // Load custom categories from localStorage
    const stored = localStorage.getItem('customCategories');
    if (stored) {
      try {
        const categories = JSON.parse(stored);
        setCustomCategories(categories);
      } catch (err) {
        console.error('Error loading custom categories:', err);
      }
    }
  };

  const saveCustomCategories = (categories: string[]) => {
    // Save custom categories to localStorage
    localStorage.setItem('customCategories', JSON.stringify(categories));
    setCustomCategories(categories);
  };

  const handleCategoryAdded = (category: string) => {
    // Add the new category to the list if it doesn't exist
    if (!customCategories.includes(category)) {
      const updated = [...customCategories, category];
      saveCustomCategories(updated);
    }
  };

  const handleCategoryDeleted = (category: string) => {
    // Check if category is in use
    const isInUse = products.some(p => p.category === category);
    
    if (isInUse) {
      error(t('inventory.cannotDeleteInUse'));
      return;
    }
    
    // Open confirmation modal instead of browser confirm
    setCategoryToDelete(category);
  };

  const confirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    
    const category = categoryToDelete;
    const updated = customCategories.filter(cat => cat !== category);
    saveCustomCategories(updated);
    success(t('inventory.categoryDeletedSuccess'));
    
    // If the deleted category was selected, reset to default
    if (selectedCategory === category) {
      setSelectedCategory('all');
    }
    
    setCategoryToDelete(null);
  };

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, selectedCategory, selectedProductCategory]);

  const loadProducts = async () => {
    try {
      const db = Database.getInstance();
      const productData = await db.query('products') as Product[];
      // Sort by created_at descending (newest first)
      const sortedProducts = productData.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA; // Descending order (newest first)
      });
      setProducts(sortedProducts);
    } catch (err: unknown) {
      console.error('Error loading products:', err);
      error(t('inventory.loadError'));
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
      // Add new product at the top of the list (newest first)
      setProducts([newProduct, ...products]);
      setShowAddModal(false);
      success(t('inventory.productAddSuccess'));
    } catch (err: unknown) {
      console.error('Error adding product:', err);
      error(t('inventory.productAddError'));
    }
  };

  const handleEditProduct = async (id: string, productData: Partial<Product>) => {
    try {
      const db = Database.getInstance();
      const updatedProduct = await db.update('products', id, productData);
      if (updatedProduct) {
        // Update product while maintaining newest-first order
        const updatedProducts = products.map(p => p.id === id ? updatedProduct : p);
        // Re-sort to maintain newest-first order (in case updated_at changed)
        const sortedProducts = updatedProducts.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA; // Descending order (newest first)
        });
        setProducts(sortedProducts);
        setEditingProduct(null);
        success(t('inventory.productUpdateSuccess'));
      }
    } catch (err: unknown) {
      console.error('Error updating product:', err);
      error(t('inventory.productUpdateError'));
    }
  };

  const handleDeleteProduct = (id: string) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    // Open confirmation modal instead of browser confirm
    setProductToDelete(product);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;

    try {
      const db = Database.getInstance();
      await db.delete('products', productToDelete.id);
      setProducts(products.filter(p => p.id !== productToDelete.id));
      success(t('inventory.productDeleteSuccess'));
      setProductToDelete(null);
    } catch (err: any) {
      console.error('Error deleting product:', err);
      if (err.response?.status === 400 && err.response?.data?.references) {
        const references = err.response.data.references;
        const message = t('inventory.deleteReferencesMessage', {
          bills: references.bills,
          invoices: references.invoices
        });
        // Open cascade confirmation modal
        setCascadeDeleteInfo({ product: productToDelete, message });
        setProductToDelete(null);
      } else {
        error(t('inventory.productDeleteError'));
        setProductToDelete(null);
      }
    }
  };

  const confirmCascadeDeleteProduct = async () => {
    if (!cascadeDeleteInfo) return;
    const { product } = cascadeDeleteInfo;

    try {
      const dbInstance = Database.getInstance();
      await dbInstance.deleteWithCascade('products', product.id);
      setProducts(products.filter(p => p.id !== product.id));
      success(t('inventory.productDeleteCascadeSuccess'));
    } catch (cascadeErr: unknown) {
      console.error('Error in cascade delete:', cascadeErr);
      error(t('inventory.productDeleteCascadeError'));
    } finally {
      setCascadeDeleteInfo(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
            title={t('inventory.addNewProductTooltip')}
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
              {/* <Filter className="h-4 w-4 text-gray-400" /> */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="all">{t('common.allCategories')}</option>
                {allCategories.map(category => {
                  const translationKey = `inventory.${category.toLowerCase()}`;
                  const translated = t(translationKey);
                  const displayName = translated !== translationKey ? translated : category;
                  return (
                    <option key={category} value={category}>
                      {displayName}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              {/* <Filter className="h-4 w-4 text-gray-400" /> */}
              <select
                value={selectedProductCategory}
                onChange={(e) => setSelectedProductCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {productCategories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? t('inventory.allGenderAge') : productCategoryLabels[category] || category}
                  </option>
                ))}
              </select>
            </div>
            {(searchTerm || selectedCategory !== 'all' || selectedProductCategory !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedProductCategory('all');
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                title={t('inventory.resetFiltersTooltip')}
              >
                <RotateCcw className="h-4 w-4" />
                <span>{t('inventory.resetFilters')}</span>
              </button>
            )}
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
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">{t('inventory.genderAge')}</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">{t('common.weight')}</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">{t('inventory.stock')}</th>
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
                        <p className="text-sm text-gray-600">
                          {product.category} • {product.material_type ? t(`inventory.${product.material_type.toLowerCase()}`) : t('inventory.gold')} • {product.purity}
                        </p>
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
                          {productCategoryLabels[product.product_category] || product.product_category}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{t('inventory.notSet')}</span>
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
                      {t(`common.${product.status}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                        title={t('inventory.editProductTooltip')}
                      >
                        <CreditCard className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title={t('inventory.deleteProductTooltip')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setViewingProduct(product)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title={t('inventory.viewProductDetailsTooltip')}
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
          availableCategories={customCategories}
          onCategoryAdded={handleCategoryAdded}
          onCategoryDeleted={handleCategoryDeleted}
          products={products}
        />
      )}

      {editingProduct && (
        <ProductForm
          product={editingProduct}
          onSubmit={(data) => handleEditProduct(editingProduct.id, data)}
          onCancel={() => setEditingProduct(null)}
          availableCategories={customCategories}
          onCategoryAdded={handleCategoryAdded}
          onCategoryDeleted={handleCategoryDeleted}
          products={products}
        />
      )}

      {viewingProduct && createPortal(
      <div className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] m-0" style={{ margin: 0 }}>
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header Section */}
          <div className="p-6 border-b border-gray-200 flex items-start justify-between gap-4">
            <div className="flex flex-col flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-3">
                <Package className="h-6 w-6 text-amber-600 flex-shrink-0" />
                <span className="truncate">{viewingProduct.name}</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                <span className="font-mono text-sm font-semibold px-3 py-1.5 rounded-md flex items-center gap-2 border border-gray-200 bg-gray-50">
                  <Hash className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <span className="text-gray-700">SKU:</span>
                  <span className="text-gray-900">{viewingProduct.sku}</span>
                </span>
                {viewingProduct.barcode && (
                  <span className="font-mono text-sm font-semibold px-3 py-1.5 rounded-md flex items-center gap-2 border border-gray-200 bg-gray-50">
                    <Barcode className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <span className="text-gray-700">Barcode:</span>
                    <span className="text-gray-900">{viewingProduct.barcode}</span>
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setViewingProduct(null)}
              className="text-gray-400 hover:text-gray-600 transition p-2 rounded-full hover:bg-gray-100 flex-shrink-0"
              title={t('inventory.close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content Section */}
          <div className="p-6 space-y-8 overflow-y-auto flex-grow">
            {/* Classification & Purity */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2.5">
                {t('inventory.classificationPurity')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    {t('common.category')}
                  </label>
                  <p className="text-base font-semibold text-gray-900 mt-1">{viewingProduct.category}</p>
                </div>
                <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t('inventory.materialType')}
                  </label>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    {viewingProduct.material_type ? t(`inventory.${viewingProduct.material_type.toLowerCase()}`) : t('inventory.gold')}
                  </p>
                </div>
                <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t('inventory.purity')}
                  </label>
                  <p className="text-base font-semibold text-gray-900 mt-1">{viewingProduct.purity}</p>
                </div>
                <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    {t('inventory.targetGroup')}
                  </label>
                  <div className="mt-1">
                  {viewingProduct.product_category ? (
                      <span className="inline-block px-2.5 py-1 text-sm font-medium rounded border border-gray-200 bg-gray-50 text-gray-900">
                      {productCategoryLabels[viewingProduct.product_category] || viewingProduct.product_category}
                    </span>
                  ) : (
                      <span className="text-sm text-gray-400 italic">{t('inventory.notSpecified')}</span>
                  )}
                  </div>
                </div>
              </div>
            </div>

            {/* Inventory Status */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2.5">
                {t('inventory.inventoryStatus')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5" />
                    {t('inventory.unitWeight')}
                  </label>
                  <p className="text-base font-semibold text-gray-900 mt-1">{viewingProduct.weight}g</p>
                </div>
                <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    {t('inventory.currentStock')}
                  </label>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-base font-semibold text-gray-900">{viewingProduct.stock_quantity}</p>
                    {viewingProduct.stock_quantity <= viewingProduct.min_stock_level && (
                      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {t('inventory.low')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Gauge className="h-3.5 w-3.5" />
                    {t('inventory.minimumLevel')}
                  </label>
                  <p className="text-base font-semibold text-gray-900 mt-1">{viewingProduct.min_stock_level}</p>
                </div>
              </div>
            </div>

            <hr className="border-gray-200 my-2" />

            {/* Audit History */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2.5">
                {t('inventory.auditHistory')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {t('inventory.recordCreated')}
                  </label>
                  <p className="text-sm text-gray-900 mt-1 leading-relaxed">
                    <span className="font-medium">{new Date(viewingProduct.created_at).toLocaleDateString('en-IN')}</span>
                    <span className="text-gray-500 mx-2">at</span>
                    <span className="font-mono text-gray-700">{new Date(viewingProduct.created_at).toLocaleTimeString('en-IN')}</span>
                  </p>
                </div>
                <div className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {t('inventory.lastModified')}
                  </label>
                  <p className="text-sm text-gray-900 mt-1 leading-relaxed">
                    <span className="font-medium">{new Date(viewingProduct.updated_at).toLocaleDateString('en-IN')}</span>
                    <span className="text-gray-500 mx-2">at</span>
                    <span className="font-mono text-gray-700">{new Date(viewingProduct.updated_at).toLocaleTimeString('en-IN')}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Section */}
          <div className="p-6 border-t border-gray-200 sticky bottom-0 bg-white z-10">
            <div className="flex justify-end items-center gap-3">
              <button
                onClick={() => setViewingProduct(null)}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {t('inventory.close')}
              </button>
              <button
                onClick={() => {
                  setViewingProduct(null);
                  setEditingProduct(viewingProduct);
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium shadow-md"
              >
                <Wrench className="h-5 w-5" />
                {t('inventory.editProductDetails')}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}

      {/* Delete product confirmation modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-900">
                {t('inventory.confirmDelete')}
              </h3>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              {t('inventory.confirmDeleteCategory', { category: productToDelete.name || '' })}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cascade delete confirmation modal */}
      {cascadeDeleteInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-900">
                {t('inventory.productHasReferences')}
              </h3>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              {cascadeDeleteInfo.message}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setCascadeDeleteInfo(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmCascadeDeleteProduct}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                {t('inventory.deleteWithReferences')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete category confirmation modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-gray-900">
                {t('inventory.confirmDeleteCategoryTitle')}
              </h3>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              {t('inventory.confirmDeleteCategory', { category: categoryToDelete })}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDeleteCategory}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;