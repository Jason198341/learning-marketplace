import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const icons: Record<ToastType, ReactNode> = {
  success: <CheckCircle className="w-5 h-5" />,
  error: <AlertCircle className="w-5 h-5" />,
  info: <Info className="w-5 h-5" />,
  warning: <AlertTriangle className="w-5 h-5" />,
};

const toastStyles: Record<ToastType, { bg: string; icon: string; text: string }> = {
  success: {
    bg: 'bg-white border-green-200 shadow-lg shadow-green-500/5',
    icon: 'text-green-500',
    text: 'text-green-800',
  },
  error: {
    bg: 'bg-white border-red-200 shadow-lg shadow-red-500/5',
    icon: 'text-red-500',
    text: 'text-red-800',
  },
  info: {
    bg: 'bg-white border-blue-200 shadow-lg shadow-blue-500/5',
    icon: 'text-blue-500',
    text: 'text-blue-800',
  },
  warning: {
    bg: 'bg-white border-amber-200 shadow-lg shadow-amber-500/5',
    icon: 'text-amber-500',
    text: 'text-amber-800',
  },
};

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const [isLeaving, setIsLeaving] = useState(false);

  const handleRemove = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 150);
  }, [toast.id, onRemove]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleRemove();
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, handleRemove]);

  const style = toastStyles[toast.type];

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3.5 rounded-xl border backdrop-blur-sm
        transform transition-all duration-200 ease-out
        ${style.bg}
        ${isLeaving ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
    >
      <div className={`shrink-0 ${style.icon}`}>
        {icons[toast.type]}
      </div>
      <p className={`flex-1 text-sm font-medium ${style.text}`}>{toast.message}</p>
      <button
        onClick={handleRemove}
        className="shrink-0 p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, duration?: number) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);
    },
    []
  );

  const contextValue: ToastContextType = {
    showToast,
    success: (message, duration) => showToast('success', message, duration),
    error: (message, duration) => showToast('error', message, duration),
    info: (message, duration) => showToast('info', message, duration),
    warning: (message, duration) => showToast('warning', message, duration),
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {createPortal(
        <div className="fixed top-4 right-4 z-[60] space-y-2 max-w-sm">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export default ToastProvider;
