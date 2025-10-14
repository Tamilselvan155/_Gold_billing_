import React, { createContext, useContext } from 'react';
import toast, { Toaster } from 'react-hot-toast';

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  loading: (message: string) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const success = (message: string) => {
    toast.success(message, {
      duration: 6000,
      position: 'top-right',
      style: {
        background: '#10B981',
        color: '#fff',
        fontWeight: '500',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
    });
  };

  const error = (message: string) => {
    toast.error(message, {
      duration: 7000,
      position: 'top-right',
      style: {
        background: '#EF4444',
        color: '#fff',
        fontWeight: '500',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
    });
  };

  const loading = (message: string) => {
    return toast.loading(message, {
      position: 'top-right',
      style: {
        background: '#F59E0B',
        color: '#fff',
        fontWeight: '500',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
    });
  };

  const dismiss = () => {
    toast.dismiss();
  };

  return (
    <ToastContext.Provider value={{ success, error, loading, dismiss }}>
      {children}
      <Toaster
        toastOptions={{
          duration: 6000,
          style: {
            background: '#363636',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          },
          success: {
            duration: 6000,
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 7000,
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </ToastContext.Provider>
  );
};
