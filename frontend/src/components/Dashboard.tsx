import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  CreditCard,
  IndianRupee,
  Calendar,
  Receipt,
  Download,
  RefreshCw,
  Filter,
  CalendarDays,
  Clock,
  XCircle
} from 'lucide-react';
import jsPDF from 'jspdf';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Database from '../utils/database';
import { DashboardStats, Invoice, Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

const Dashboard: React.FC = () => {
  const { t } = useLanguage();
  const { success, error } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    total_sales: 0,
    total_products: 0,
    low_stock_alerts: 0,
    pending_payments: 0,
    today_sales: 0,
    this_month_sales: 0,
  });
  const [billStats, setBillStats] = useState({
    totalBills: 0,
    totalInvoices: 0,
    totalExchangeBills: 0,
    billsValue: 0,
    invoicesValue: 0,
    exchangeValue: 0
  });

  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [exchangeBills, setExchangeBills] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [salesData, setSalesData] = useState<Array<{ month: string; sales: number }>>([]);
  const [categoryData, setCategoryData] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<'week' | 'month' | 'custom'>('month');
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filteredSalesData, setFilteredSalesData] = useState<Array<{ period: string; sales: number }>>([]);
  const [filteredStats, setFilteredStats] = useState({
    totalSales: 0,
    totalTransactions: 0,
    averageSale: 0
  });
  const [activeTab, setActiveTab] = useState<'all' | 'invoices' | 'bills' | 'exchange'>('all');

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (recentInvoices.length > 0) {
      applyFilter();
    }
  }, [filterType, customDateRange, recentInvoices]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
    const db = Database.getInstance();
    
      // Load invoices, bills, and products
      const [invoices, bills, products] = await Promise.all([
        db.query('invoices'),
        db.query('bills'),
        db.query('products')
      ]);
      
      // Validate and filter data
      const validInvoices = (invoices || []).filter(inv => inv && inv.total_amount >= 0);
      const validBills = (bills || []).filter(bill => bill && bill.total_amount >= 0);
      const validProducts = (products || []).filter(p => p && p.stock_quantity >= 0);
      
      // Combine all sales data (both invoices and bills)
      const allSales = [...validInvoices, ...validBills];
      
      // Calculate stats with proper validation
      const totalSales = allSales.reduce((sum, sale) => {
        const amount = parseFloat(sale.total_amount) || 0;
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
      
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
      const todaySales = allSales
        .filter(sale => {
          const saleDate = new Date(sale.created_at);
          return !isNaN(saleDate.getTime()) && saleDate >= todayStart;
        })
        .reduce((sum, sale) => {
          const amount = parseFloat(sale.total_amount) || 0;
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0);
    
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
      const thisMonthSales = allSales
        .filter(sale => {
          const saleDate = new Date(sale.created_at);
          return !isNaN(saleDate.getTime()) && saleDate >= thisMonthStart;
        })
        .reduce((sum, sale) => {
          const amount = parseFloat(sale.total_amount) || 0;
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0);

      const lowStock = validProducts.filter(p => 
        p.stock_quantity <= p.min_stock_level && p.status === 'active'
      );
      const pendingPayments = allSales.filter(sale => 
        sale.payment_status && sale.payment_status !== 'paid'
      ).length;

    setStats({
        total_sales: Math.round(totalSales * 100) / 100, // Round to 2 decimal places
        total_products: validProducts.length,
      low_stock_alerts: lowStock.length,
      pending_payments: pendingPayments,
        today_sales: Math.round(todaySales * 100) / 100,
        this_month_sales: Math.round(thisMonthSales * 100) / 100,
      });

      // Separate invoices, bills, and exchange bills
      const recentInvoicesData = validInvoices
        .filter(inv => inv.created_at)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);
      
      const recentBillsData = validBills
        .filter(bill => bill.created_at && !bill.bill_number?.startsWith('EXCH-'))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);
      
      const exchangeBillsData = validBills
        .filter(bill => bill.created_at && bill.bill_number?.startsWith('EXCH-'))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);
      
      // Note: recentSales variable removed as it's no longer used
      
      setRecentInvoices(recentInvoicesData);
      setRecentBills(recentBillsData);
      setExchangeBills(exchangeBillsData);
    setLowStockProducts(lowStock);
      
      // Calculate bill statistics from ALL data, not just recent 10
      const allBills = validBills.filter(bill => !bill.bill_number?.startsWith('EXCH-'));
      const allExchangeBills = validBills.filter(bill => bill.bill_number?.startsWith('EXCH-'));
      
      const billsValue = allBills.reduce((sum, bill) => sum + (typeof bill.total_amount === 'number' ? bill.total_amount : parseFloat(bill.total_amount) || 0), 0);
      const invoicesValue = validInvoices.reduce((sum, invoice) => sum + (typeof invoice.total_amount === 'number' ? invoice.total_amount : parseFloat(invoice.total_amount) || 0), 0);
      const exchangeValue = allExchangeBills.reduce((sum, bill) => sum + (typeof bill.total_amount === 'number' ? bill.total_amount : parseFloat(bill.total_amount) || 0), 0);
      
      setBillStats({
        totalBills: allBills.length,
        totalInvoices: validInvoices.length,
        totalExchangeBills: allExchangeBills.length,
        billsValue: Math.round(billsValue * 100) / 100,
        invoicesValue: Math.round(invoicesValue * 100) / 100,
        exchangeValue: Math.round(exchangeValue * 100) / 100
      });
    
    // Calculate sales data for the last 6 months
      calculateSalesData(allSales);
    
    // Calculate category data from products
      calculateCategoryData(validProducts);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      error('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSalesData = (allSales: any[]) => {
    const now = new Date();
    const salesByMonth: { [key: string]: number } = {};
    
    // Initialize last 6 months with 0 sales
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
      salesByMonth[monthKey] = 0;
    }
    
    // Calculate sales for each month from all sales (invoices and bills)
    allSales.forEach(sale => {
      if (sale && sale.created_at && sale.total_amount) {
        const saleDate = new Date(sale.created_at);
        if (!isNaN(saleDate.getTime())) {
          const monthKey = saleDate.toLocaleDateString('en-US', { month: 'short' });
          const amount = parseFloat(sale.total_amount) || 0;
          
          if (salesByMonth.hasOwnProperty(monthKey) && !isNaN(amount)) {
            salesByMonth[monthKey] += amount;
          }
        }
      }
    });
    
    // Convert to array format
    const salesArray = Object.entries(salesByMonth).map(([month, sales]) => ({
      month,
      sales: Math.round(sales * 100) / 100 // Round to 2 decimal places
    }));
    
    setSalesData(salesArray);
  };

  const calculateCategoryData = (products: Product[]) => {
    const categoryColors: { [key: string]: string } = {
      'Men': '#3B82F6',
      'Women': '#EC4899', 
      'Kids': '#10B981',
      'Chains': '#F59E0B',
      'Rings': '#EAB308', 
      'Earrings': '#FCD34D',
      'Bracelets': '#FDE68A',
      'Necklaces': '#F97316',
      'Bangles': '#FB923C',
      'Pendants': '#F59E0B',
      'Sets': '#EAB308',
      'Coins': '#FCD34D',
      'Other': '#6B7280'
    };
    
    // Count products by product_category (gender/age) if available, otherwise by category
    const categoryCounts: { [key: string]: number } = {};
    products.forEach(product => {
      if (product.status === 'active') {
        // Prefer product_category over category for better classification
        const category = product.product_category || product.category;
        if (category) {
          const categoryName = category.trim();
          categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1;
        }
      }
    });
    
    // Calculate percentages
    const totalProducts = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
    
    if (totalProducts > 0) {
      const categoryArray = Object.entries(categoryCounts)
        .sort(([,a], [,b]) => b - a) // Sort by count descending
        .map(([name, count]) => ({
          name,
          value: Math.round((count / totalProducts) * 100),
          color: categoryColors[name] || '#6B7280'
        }));
      
      setCategoryData(categoryArray);
    } else {
      // Default data when no products
      setCategoryData([
        { name: 'No Products', value: 100, color: '#6B7280' }
      ]);
    }
  };

  const applyFilter = () => {
    const allSales = recentInvoices;
    let filteredData: Array<{ period: string; sales: number }> = [];
    let totalSales = 0;
    let totalTransactions = 0;

    if (filterType === 'week') {
      // Get last 8 weeks
      const weeksData: { [key: string]: number } = {};
      const now = new Date();
      
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (now.getDay() + (i * 7)));
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        const weekKey = `Week ${8 - i}`;
        weeksData[weekKey] = 0;
        
        allSales.forEach(sale => {
          const saleDate = new Date(sale.created_at);
          if (saleDate >= weekStart && saleDate <= weekEnd) {
            const amount = parseFloat(sale.total_amount) || 0;
            weeksData[weekKey] += amount;
            totalSales += amount;
            totalTransactions++;
          }
        });
      }
      
      filteredData = Object.entries(weeksData).map(([period, sales]) => ({
        period,
        sales: Math.round(sales * 100) / 100
      }));
      
    } else if (filterType === 'month') {
      // Get last 6 months
      const monthsData: { [key: string]: number } = {};
      const now = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        
        const monthKey = monthStart.toLocaleDateString('en-US', { month: 'short' });
        monthsData[monthKey] = 0;
        
        allSales.forEach(sale => {
          const saleDate = new Date(sale.created_at);
          if (saleDate >= monthStart && saleDate <= monthEnd) {
            const amount = parseFloat(sale.total_amount) || 0;
            monthsData[monthKey] += amount;
            totalSales += amount;
            totalTransactions++;
          }
        });
      }
      
      filteredData = Object.entries(monthsData).map(([period, sales]) => ({
        period,
        sales: Math.round(sales * 100) / 100
      }));
      
    } else if (filterType === 'custom') {
      if (customDateRange.startDate && customDateRange.endDate) {
        const startDate = new Date(customDateRange.startDate);
        const endDate = new Date(customDateRange.endDate);
        endDate.setHours(23, 59, 59, 999);
        
        // Group by days within the range
        const daysData: { [key: string]: number } = {};
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          const dayKey = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          daysData[dayKey] = 0;
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        allSales.forEach(sale => {
          const saleDate = new Date(sale.created_at);
          if (saleDate >= startDate && saleDate <= endDate) {
            const dayKey = saleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const amount = parseFloat(sale.total_amount) || 0;
            daysData[dayKey] += amount;
            totalSales += amount;
            totalTransactions++;
          }
        });
        
        filteredData = Object.entries(daysData).map(([period, sales]) => ({
          period,
          sales: Math.round(sales * 100) / 100
        }));
      }
    }

    setFilteredSalesData(filteredData);
    setFilteredStats({
      totalSales: Math.round(totalSales * 100) / 100,
      totalTransactions,
      averageSale: totalTransactions > 0 ? Math.round((totalSales / totalTransactions) * 100) / 100 : 0
    });
  };

  const handleFilterChange = (type: 'week' | 'month' | 'custom') => {
    setFilterType(type);
    if (type === 'custom') {
      setShowFilterModal(true);
    }
  };

  const handleCustomDateApply = () => {
    if (customDateRange.startDate && customDateRange.endDate) {
      setShowFilterModal(false);
      applyFilter();
    }
  };

  const generateInvoicePDF = (invoice: Invoice) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPosition = 20;

    // Header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(t('app.title'), pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('INVOICE', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    // Invoice Details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Invoice Number: ${invoice.invoice_number}`, margin, yPosition);
    yPosition += 8;
    doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString('en-IN')}`, margin, yPosition);
    yPosition += 8;
    doc.text(`Customer: ${invoice.customer_name}`, margin, yPosition);
    yPosition += 8;
    if (invoice.customer_phone) {
      doc.text(`Phone: ${invoice.customer_phone}`, margin, yPosition);
      yPosition += 8;
    }
    yPosition += 10;

    // Items Table Header
    doc.setFont('helvetica', 'bold');
    doc.text(t('billing.item'), margin, yPosition);
    doc.text(`${t('common.weight')} (g)`, margin + 60, yPosition);
    doc.text(t('common.rate'), margin + 90, yPosition);
    doc.text(t('billing.qty'), margin + 120, yPosition);
    doc.text(t('common.total'), margin + 140, yPosition);
    yPosition += 8;

    // Draw line
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;

    // Items
    doc.setFont('helvetica', 'normal');
    if (invoice.items && Array.isArray(invoice.items)) {
      invoice.items.forEach((item: any) => {
        doc.text(item.product_name || 'N/A', margin, yPosition);
        doc.text(item.weight?.toString() || '0', margin + 60, yPosition);
        doc.text(`₹${item.rate?.toLocaleString() || '0'}`, margin + 90, yPosition);
        doc.text(item.quantity?.toString() || '1', margin + 120, yPosition);
        doc.text(`₹${item.total?.toLocaleString() || '0'}`, margin + 140, yPosition);
        yPosition += 8;
      });
    }

    yPosition += 10;
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Totals
    doc.setFont('helvetica', 'bold');
    doc.text(`${t('common.subtotal')}: ₹${invoice.subtotal?.toLocaleString() || '0'}`, margin + 100, yPosition);
    yPosition += 8;
    if (invoice.discount_amount && invoice.discount_amount > 0) {
      doc.text(`${t('common.discount')} (${invoice.discount_percentage}%): -₹${invoice.discount_amount.toLocaleString()}`, margin + 100, yPosition);
      yPosition += 8;
    }
    if (invoice.tax_amount && invoice.tax_amount > 0) {
      doc.text(`${t('common.tax')} (${invoice.tax_percentage}%): ₹${invoice.tax_amount.toLocaleString()}`, margin + 100, yPosition);
      yPosition += 8;
    }
    doc.setFontSize(14);
    doc.text(`${t('billing.totalAmount')}: ₹${invoice.total_amount?.toLocaleString() || '0'}`, margin + 100, yPosition);
    yPosition += 15;

    // Payment Details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${t('billing.paymentMethod')}: ${invoice.payment_method?.toUpperCase() || 'CASH'}`, margin, yPosition);
    yPosition += 8;
    doc.text(`${t('billing.paymentStatus')}: ${invoice.payment_status?.toUpperCase() || 'PENDING'}`, margin, yPosition);
    if (invoice.amount_paid && invoice.amount_paid > 0) {
      yPosition += 8;
      doc.text(`${t('billing.amountPaid')}: ₹${invoice.amount_paid.toLocaleString()}`, margin, yPosition);
    }

    // Footer
    yPosition = doc.internal.pageSize.getHeight() - 30;
    doc.setFontSize(10);
    doc.text('Thank you for your business!', pageWidth / 2, yPosition, { align: 'center' });

    // Download
    doc.save(`Invoice-${invoice.invoice_number}.pdf`);
    success('Invoice PDF downloaded successfully!');
  };

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    change?: string;
  }> = ({ title, value, icon, color, change }) => (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 overflow-hidden h-full min-h-[120px]">
      <div className="flex items-start justify-between h-full">
        <div className="flex-1 min-w-0 pr-4 overflow-hidden">
          <p className="text-gray-600 text-sm font-medium mb-2 truncate">{title}</p>
          <div className="space-y-1">
            <p className={`font-bold text-gray-900 break-all leading-tight ${
              typeof value === 'number' && value > 1000000 
                ? 'text-lg sm:text-xl' 
                : 'text-xl sm:text-2xl'
            }`}>
              {typeof value === 'number' && title.includes('Sales') 
                ? `₹${value.toLocaleString()}` 
                : value}
            </p>
            {change && (
              <span className="text-green-600 text-sm font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="truncate">{change}</span>
              </span>
            )}
          </div>
        </div>
        <div className={`p-3 rounded-full ${color} flex-shrink-0`}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('dashboard.title')}</h1>
          <p className="text-gray-600 mt-1">{t('dashboard.welcomeMessage')}</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Filter Options */}
          <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg shadow-sm border">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => handleFilterChange(e.target.value as 'week' | 'month' | 'custom')}
              className="border-none outline-none text-sm font-medium text-gray-700 bg-transparent"
            >
              <option value="month">Last 6 Months</option>
              <option value="week">Last 8 Weeks</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>
          
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              isLoading 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            }`}
            title="Refresh dashboard data"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg shadow-sm border">
          <Calendar className="h-5 w-5 text-gray-500" />
          <span className="text-gray-700 font-medium">
            {new Date().toLocaleDateString('en-IN', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 min-h-0">
        <StatCard
          title={t('dashboard.todaysSales')}
          value={stats.today_sales}
          icon={<IndianRupee className="h-6 w-6 text-white" />}
          color="bg-green-500"
          change="+12%"
        />
        <StatCard
          title={t('dashboard.totalProducts')}
          value={stats.total_products}
          icon={<Package className="h-6 w-6 text-white" />}
          color="bg-blue-500"
        />
        <StatCard
          title={t('dashboard.lowStockAlerts')}
          value={stats.low_stock_alerts}
          icon={<AlertTriangle className="h-6 w-6 text-white" />}
          color="bg-red-500"
        />
        <StatCard
          title={t('dashboard.pendingPayments')}
          value={stats.pending_payments}
          icon={<CreditCard className="h-6 w-6 text-white" />}
          color="bg-yellow-500"
        />
      </div>

      {/* Bill Statistics */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Transaction Statistics</h2>
          <div className="text-sm text-gray-500">
            All Time Summary
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Invoices Stats */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-blue-900">Invoices</h3>
              <div className="p-2 bg-blue-100 rounded-full">
                <Receipt className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-blue-700">{billStats.totalInvoices}</p>
              <p className="text-sm text-blue-600">Total Invoices</p>
              <p className="text-lg font-semibold text-blue-800">₹{billStats.invoicesValue.toLocaleString()}</p>
              <p className="text-xs text-blue-600">Total Value</p>
            </div>
          </div>
          
          {/* Bills Stats */}
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-amber-900">Bills</h3>
              <div className="p-2 bg-amber-100 rounded-full">
                <Receipt className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-amber-700">{billStats.totalBills}</p>
              <p className="text-sm text-amber-600">Total Bills</p>
              <p className="text-lg font-semibold text-amber-800">₹{billStats.billsValue.toLocaleString()}</p>
              <p className="text-xs text-amber-600">Total Value</p>
            </div>
          </div>
          
          {/* Exchange Bills Stats */}
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-green-900">Exchange Bills</h3>
              <div className="p-2 bg-green-100 rounded-full">
                <Receipt className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-green-700">{billStats.totalExchangeBills}</p>
              <p className="text-sm text-green-600">Total Exchanges</p>
              <p className="text-lg font-semibold text-green-800">₹{billStats.exchangeValue.toLocaleString()}</p>
              <p className="text-xs text-green-600">Total Value</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtered Sales Stats */}
      {filteredStats.totalSales > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-amber-600" />
              Filtered Sales Analysis
            </h3>
            <span className="text-sm text-gray-600">
              {filterType === 'week' ? 'Last 8 Weeks' : 
               filterType === 'month' ? 'Last 6 Months' : 
               'Custom Date Range'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-700">₹{filteredStats.totalSales.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Total Sales</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-700">{filteredStats.totalTransactions}</div>
              <div className="text-sm text-gray-600">Transactions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-700">₹{filteredStats.averageSale.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Average Sale</div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">{t('dashboard.salesOverview')}</h2>
            <div className="text-sm text-gray-500">
              {filterType === 'week' ? 'Last 8 Weeks' : 
               filterType === 'month' ? 'Last 6 Months' : 
               'Custom Date Range'}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={filteredSalesData.length > 0 ? filteredSalesData : salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={filteredSalesData.length > 0 ? "period" : "month"} stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                formatter={(value) => [`₹${value.toLocaleString()}`, 'Sales']}
                labelStyle={{ color: '#374151' }}
              />
              <Bar dataKey="sales" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">{t('dashboard.salesByCategory')}</h2>
            <div className="text-sm text-gray-500">{t('dashboard.thisMonth')}</div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${name} (${value}%)`}
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Sales (Invoices & Bills) */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
            <div className="flex items-center space-x-2">
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                {activeTab === 'all' ? recentInvoices.length + recentBills.length + exchangeBills.length :
                 activeTab === 'invoices' ? recentInvoices.length :
                 activeTab === 'bills' ? recentBills.length :
                 exchangeBills.length} transactions
            </span>
          </div>
          </div>
          
          {/* Transaction Type Tabs */}
          <div className="flex space-x-1 mb-4 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'all'
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'invoices'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Invoices ({recentInvoices.length})
            </button>
            <button
              onClick={() => setActiveTab('bills')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'bills'
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Bills ({recentBills.length})
            </button>
            <button
              onClick={() => setActiveTab('exchange')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'exchange'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Exchange ({exchangeBills.length})
            </button>
          </div>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {(() => {
              let transactions: any[] = [];
              
              if (activeTab === 'all') {
                transactions = [...recentInvoices, ...recentBills, ...exchangeBills]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 10);
              } else if (activeTab === 'invoices') {
                transactions = recentInvoices;
              } else if (activeTab === 'bills') {
                transactions = recentBills;
              } else if (activeTab === 'exchange') {
                transactions = exchangeBills;
              }
              
              return transactions.map((transaction) => {
                const isExchange = transaction.bill_number?.startsWith('EXCH-');
                const isInvoice = transaction.invoice_number;
                
                return (
                  <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3 flex-1">
                      <div className={`p-2 rounded-full ${
                        isExchange ? 'bg-green-100' :
                        isInvoice ? 'bg-blue-100' :
                        'bg-amber-100'
                      }`}>
                        <Receipt className={`h-4 w-4 ${
                          isExchange ? 'text-green-600' :
                          isInvoice ? 'text-blue-600' :
                          'text-amber-600'
                        }`} />
                  </div>
                  <div>
                        <p className="font-medium text-gray-900">
                          {transaction.invoice_number || transaction.bill_number}
                        </p>
                        <p className="text-sm text-gray-600">{transaction.customer_name}</p>
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            isExchange ? 'bg-green-100 text-green-800' :
                            isInvoice ? 'bg-blue-100 text-blue-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {isExchange ? 'Exchange Bill' :
                             isInvoice ? 'Invoice' : 'Bill'}
                          </span>
                          {isExchange && (transaction as any).old_gold_weight && (
                            <span className="text-xs text-gray-500">
                              {(transaction as any).old_gold_weight}g ({(transaction as any).old_gold_purity})
                            </span>
                          )}
                        </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                        <p className="font-medium text-gray-900">₹{(transaction.total_amount || 0).toLocaleString()}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                          transaction.payment_status === 'paid' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                          {transaction.payment_status}
                    </span>
                        {isExchange && (transaction as any).exchange_difference !== undefined && (
                          <p className={`text-xs font-medium ${
                            (transaction as any).exchange_difference >= 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {(transaction as any).exchange_difference >= 0 ? 'Pay' : 'Receive'} ₹{Math.abs((transaction as any).exchange_difference).toLocaleString()}
                          </p>
                        )}
                  </div>
                  <button
                        onClick={() => generateInvoicePDF(transaction)}
                    className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
                        title="Download PDF"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
                );
              });
            })()}
            
            {(() => {
              let transactions: any[] = [];
              
              if (activeTab === 'all') {
                transactions = [...recentInvoices, ...recentBills, ...exchangeBills]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 10);
              } else if (activeTab === 'invoices') {
                transactions = recentInvoices;
              } else if (activeTab === 'bills') {
                transactions = recentBills;
              } else if (activeTab === 'exchange') {
                transactions = exchangeBills;
              }
              
              return transactions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No {activeTab === 'all' ? 'transactions' : activeTab + 's'} found</p>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">{t('dashboard.lowStockAlertsTitle')}</h2>
            <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
              {lowStockProducts.length} {t('dashboard.items')}
            </span>
          </div>
          <div className="space-y-4">
            {lowStockProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-full">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-sm text-gray-600">{product.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-red-600">{product.stock_quantity} {t('dashboard.left')}</p>
                  <p className="text-xs text-gray-600">{t('dashboard.min')}: {product.min_stock_level}</p>
                </div>
              </div>
            ))}
            {lowStockProducts.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>{t('dashboard.allProductsWellStocked')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Date Range Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <CalendarDays className="h-5 w-5 mr-2 text-amber-600" />
                Custom Date Range
              </h3>
              <button
                onClick={() => setShowFilterModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customDateRange.startDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={customDateRange.endDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomDateApply}
                  disabled={!customDateRange.startDate || !customDateRange.endDate}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    !customDateRange.startDate || !customDateRange.endDate
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                  }`}
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;