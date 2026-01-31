import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import { api, ApiError } from '@/services/api';
import { useToast } from '@/components/common/Toast';

type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  worksheetId: string | null;
  editHistoryId: string | null;
  isRead: boolean;
  createdAt: string;
};

export function NotificationDropdown() {
  const navigate = useNavigate();
  const toast = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch unread count on mount and periodically
  useEffect(() => {
    const fetchUnreadCount = async () => {
      const count = await api.notifications.getUnreadCount();
      setUnreadCount(count);
    };

    fetchUnreadCount();

    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await api.notifications.list();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.isRead).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      try {
        await api.notifications.markAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }

    // Navigate to worksheet if available
    if (notification.worksheetId) {
      setIsOpen(false);
      navigate(`/worksheet/${notification.worksheetId}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.notifications.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('모든 알림을 읽음 처리했습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    try {
      await api.notifications.delete(notificationId);
      const deleted = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (deleted && !deleted.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm animate-pulse-soft">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 z-20 max-h-[70vh] flex flex-col overflow-hidden animate-scale-in origin-top-right">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
              <h3 className="font-semibold text-gray-900">알림</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary-50 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    모두 읽음
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground mt-3">불러오는 중...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <Bell className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-muted-foreground">알림이 없습니다</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                        !notification.isRead ? 'bg-primary-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`shrink-0 w-2 h-2 mt-2 rounded-full transition-colors ${
                          notification.isRead ? 'bg-transparent' : 'bg-primary-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${
                            notification.isRead ? 'text-gray-600' : 'text-gray-900 font-medium'
                          }`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1.5">
                            {formatTimeAgo(notification.createdAt)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleDelete(e, notification.id)}
                          className="shrink-0 p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer - optional link to full notifications page */}
            {notifications.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50/50">
                <p className="text-xs text-center text-muted-foreground">
                  최근 50개 알림만 표시됩니다
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default NotificationDropdown;
