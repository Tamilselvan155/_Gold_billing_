import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Receipt, 
  Settings,
  Crown,
  Bell,
  User,
  Menu,
  ChevronLeft,
  MoreVertical,
  Search,
  Moon,
  Sun,
  HelpCircle
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import KeyboardShortcuts from './KeyboardShortcuts';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const navigation = [
    { name: t('common.dashboard'), href: '/', icon: LayoutDashboard },
    { name: t('common.inventory'), href: '/inventory', icon: Package },
    { name: t('common.billing'), href: '/billing', icon: Receipt },
    { name: t('common.settings'), href: '/settings', icon: Settings },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobile && sidebarOpen) {
        const sidebar = document.getElementById('sidebar');
        const toggleButton = document.getElementById('sidebar-toggle');
        if (sidebar && !sidebar.contains(event.target as Node) && 
            toggleButton && !toggleButton.contains(event.target as Node)) {
          setSidebarOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, sidebarOpen]);

  // Close header menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerMenuOpen) {
        const menu = document.getElementById('header-menu');
        const toggleButton = document.getElementById('header-toggle');
        if (menu && !menu.contains(event.target as Node) && 
            toggleButton && !toggleButton.contains(event.target as Node)) {
          setHeaderMenuOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [headerMenuOpen]);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Toggle sidebar with Ctrl/Cmd + B
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        toggleSidebar();
      }
      
      // Toggle header menu with Ctrl/Cmd + U
      if ((event.ctrlKey || event.metaKey) && event.key === 'u') {
        event.preventDefault();
        toggleHeaderMenu();
      }
      
      // Toggle dark mode with Ctrl/Cmd + D
      if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        toggleDarkMode();
      }
      
      // Show keyboard shortcuts with Ctrl/Cmd + ?
      if ((event.ctrlKey || event.metaKey) && event.key === '?') {
        event.preventDefault();
        setShowShortcuts(true);
      }
      
      // Close menus with Escape
      if (event.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false);
        } else {
          setHeaderMenuOpen(false);
          if (isMobile) {
            setSidebarOpen(false);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, showShortcuts]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleHeaderMenu = () => {
    setHeaderMenuOpen(!headerMenuOpen);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    // Apply dark mode class to document
    if (!darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 via-amber-50/30 to-yellow-50/20 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-all duration-300 ${darkMode ? 'dark' : ''}`}>
      {/* Header */}
      <header className="gradient-bg shadow-soft-lg curved-header fixed top-0 left-0 right-0 z-40 backdrop-blur-sm gradient-transition">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left side - Logo and Sidebar Toggle */}
            <div className="flex items-center space-x-3">
              {/* Sidebar Toggle Button */}
              {/* <button
                id="sidebar-toggle"
                onClick={toggleSidebar}
                className="toggle-button p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                aria-expanded={sidebarOpen}
                aria-controls="sidebar"
              >
                {sidebarOpen ? (
                  <ChevronLeft className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button> */}
              
              <div className="flex items-center space-x-3">
                <Crown className="h-8 w-8 text-white icon-glow floating" />
                <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">{t('app.title')}</h1>
              </div>
            </div>

            {/* Right side - Actions and Header Toggle */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Search Button */}
              {/* <button 
                className="toggle-button p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-xl transition-all duration-200 hidden sm:block focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button> */}

              {/* Language Switcher */}
              <div className="hidden sm:block">
              <LanguageSwitcher />
              </div>

              {/* Dark Mode Toggle */}
              {/* <button
                onClick={toggleDarkMode}
                className="toggle-button p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                aria-pressed={darkMode}
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button> */}

              {/* Help Button */}
              <button
                onClick={() => setShowShortcuts(true)}
                className="toggle-button p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                aria-label="Show keyboard shortcuts"
                title="Keyboard shortcuts (Ctrl/Cmd + ?)"
              >
                <HelpCircle className="h-5 w-5" />
              </button>

              {/* Header Menu Toggle */}
              <div className="relative">
                <button
                  id="header-toggle"
                  onClick={toggleHeaderMenu}
                  className="toggle-button flex items-center space-x-2 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                  aria-label="Toggle user menu"
                  aria-expanded={headerMenuOpen}
                  aria-haspopup="true"
                >
                  <User className="h-5 w-5" />
                  <span className="hidden sm:block font-medium">{t('common.admin')}</span>
                  <MoreVertical className="h-4 w-4" />
                </button>

                {/* Header Dropdown Menu */}
                {headerMenuOpen && (
                  <div
                    id="header-menu"
                    className="absolute right-0 mt-2 w-48 bg-white/95 dark:bg-gray-800/95 rounded-xl shadow-soft-lg border border-amber-200/20 dark:border-gray-700/50 py-2 z-50 animate-scale-in backdrop-blur-md"
                    role="menu"
                    aria-orientation="vertical"
                  >
                    <div className="px-4 py-2 border-b border-amber-200/30 dark:border-gray-700/50">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{t('common.adminUser')}</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">admin@example.com</p>
                    </div>
                    <Link
                      to="/profile"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-amber-50 hover:to-yellow-50 dark:hover:from-amber-900/20 dark:hover:to-yellow-900/20 hover:text-amber-700 dark:hover:text-amber-300 focus:outline-none focus:bg-amber-50 dark:focus:bg-amber-900/20 transition-all duration-200"
                      role="menuitem"
                    >
                      <User className="h-4 w-4 mr-3" />
                      {t('common.profile')}
                    </Link>
                    <Link
                      to="/settings"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-amber-50 hover:to-yellow-50 dark:hover:from-amber-900/20 dark:hover:to-yellow-900/20 hover:text-amber-700 dark:hover:text-amber-300 focus:outline-none focus:bg-amber-50 dark:focus:bg-amber-900/20 transition-all duration-200"
                      role="menuitem"
                    >
                      <Settings className="h-4 w-4 mr-3" />
                      {t('common.settings')}
                    </Link>
                    <div className="border-t border-amber-200/30 dark:border-gray-700/50 mt-2 pt-2">
                      <button 
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:bg-red-50 dark:focus:bg-red-900/20 transition-all duration-200"
                        role="menuitem"
                      >
                        {t('common.signOut')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Mobile Overlay */}
        {isMobile && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <nav
          id="sidebar"
          className={`
            ${sidebarOpen ? 'translate-x-0' : isMobile ? '-translate-x-full' : 'translate-x-0'}
            ${isMobile ? 'fixed inset-y-0 left-0 z-40 mobile-sidebar' : 'fixed top-16 left-0 bottom-0 z-30'}
            ${sidebarOpen ? 'w-64' : 'w-16'} bg-white/95 dark:bg-gray-800/95 shadow-soft-lg curved-sidebar sidebar-transition backdrop-blur-md border-r border-amber-200/20 dark:border-gray-700/50
            ${isMobile ? (sidebarOpen ? 'open' : '') : ''}
          `}
          role="navigation"
          aria-label="Main navigation"
        >
          <div className="flex flex-col h-full">
            {/* Sidebar Header */}
            {sidebarOpen && (
              <div className="p-6 border-b border-amber-200/30 dark:border-gray-700/50">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold gradient-text">{t('common.navigation')}</h2>
                  {!isMobile && (
                    <button
                      onClick={toggleSidebar}
                      className="toggle-button p-1 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      aria-label="Collapse sidebar"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* Collapsed Sidebar Header */}
            {!sidebarOpen && !isMobile && (
              <div className="p-4 border-b border-amber-200/30 dark:border-gray-700/50">
                <button
                  onClick={toggleSidebar}
                  className="toggle-button p-2 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 w-full flex justify-center hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:shadow-glow"
                  aria-label="Expand sidebar"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Navigation Links */}
            <div className="flex-1 p-4 sidebar-scroll overflow-y-auto">
              <div className="space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => isMobile && setSidebarOpen(false)}
                      className={`
                        flex items-center ${sidebarOpen ? 'space-x-3 px-4' : 'justify-center px-2'} py-3 rounded-xl transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 sidebar-item-hover
                        ${isActive(item.href)
                          ? 'bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 text-amber-700 dark:text-amber-300 border-r-4 border-amber-500 shadow-soft shadow-glow'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gradient-to-r hover:from-amber-50 hover:to-yellow-50 dark:hover:from-amber-900/20 dark:hover:to-yellow-900/20 hover:text-amber-700 dark:hover:text-amber-300 hover:shadow-soft'
                        }
                      `}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      title={!sidebarOpen ? item.name : undefined}
                    >
                      <Icon className={`h-5 w-5 transition-all duration-200 ${isActive(item.href) ? 'scale-110 icon-glow' : 'group-hover:scale-105 group-hover:icon-glow'}`} />
                      {sidebarOpen && <span className="font-medium">{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Sidebar Footer */}
            {sidebarOpen && (
              <div className="p-4 border-t border-amber-200/30 dark:border-gray-700/50">
                <div className="text-xs text-amber-600 dark:text-amber-400 text-center font-medium">
                  Gold Billing System v1.0
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Main Content */}
        <main className={`
          flex-1 transition-all duration-300 ease-in-out page-transition
          ${sidebarOpen && !isMobile ? 'ml-64' : !isMobile ? 'ml-16' : 'ml-0'}
        `}>
          <div className="p-4 sm:p-6 lg:p-8 relative">
            {/* Background decoration */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-200/20 to-yellow-200/20 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-yellow-200/20 to-amber-200/20 rounded-full blur-3xl"></div>
            </div>
            {children}
          </div>
        </main>
      </div>
      
      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcuts 
        isOpen={showShortcuts} 
        onClose={() => setShowShortcuts(false)} 
      />
    </div>
  );
};

export default Layout;