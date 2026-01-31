import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, X, Trophy, Mail, FileEdit } from 'lucide-react';
import { api, ApiError } from '@/services/api';
import { useToast } from '@/components/common/Toast';
import { useAuthStore } from '@/store';

type NotificationType = 'worksheet_update' | 'event' | 'message';

type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  linkTo?: string;
  isRead: boolean;
  createdAt: string;
  // Original data for different types
  worksheetId?: string | null;
  eventId?: string;
  messageId?: string;
};

export function NotificationDropdown() {
  const navigate = useNavigate();
  const toast = useToast();
  const { isAuthenticated } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch unread count on mount and periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchUnreadCount = async () => {
      try {
        // Get worksheet notification count
        const worksheetCount = await api.notifications.getUnreadCount();

        // Get unread messages count
        let messageCount = 0;
        try {
          const messages = await api.messages.getInbox();
          messageCount = messages.filter(m => !m.isRead).length;
        } catch { /* ignore */ }

        // Get active events count (check if user hasn't participated)
        let eventCount = 0;
        try {
          const events = await api.events.list('active');
          for (const event of events.slice(0, 5)) {
            try {
              const detail = await api.events.get(event.id);
              if (!detail.participated) eventCount++;
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }

        setUnreadCount(worksheetCount + messageCount + eventCount);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchUnreadCount();

    // Poll every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Fetch all notifications when dropdown opens
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchAllNotifications();
    }
  }, [isOpen, isAuthenticated]);

  const fetchAllNotifications = async () => {
    setIsLoading(true);
    try {
      const allNotifications: Notification[] = [];

      // 1. Worksheet update notifications
      try {
        const worksheetNotifs = await api.notifications.list();
        allNotifications.push(...worksheetNotifs.map(n => ({
          id: `ws_${n.id}`,
          type: 'worksheet_update' as NotificationType,
          title: n.title,
          message: n.message,
          linkTo: n.worksheetId ? `/worksheet/${n.worksheetId}` : undefined,
          isRead: n.isRead,
          createdAt: n.createdAt,
          worksheetId: n.worksheetId,
        })));
      } catch { /* ignore */ }

      // 2. Messages (notices, inquiry replies)
      try {
        const messages = await api.messages.getInbox();
        allNotifications.push(...messages.slice(0, 10).map(m => ({
          id: `msg_${m.id}`,
          type: 'message' as NotificationType,
          title: m.messageType === 'notice' ? '📢 ' + m.title : '💬 ' + m.title,
          message: m.content.slice(0, 100) + (m.content.length > 100 ? '...' : ''),
          linkTo: '/inbox',
          isRead: m.isRead,
          createdAt: m.createdAt,
          messageId: m.id,
        })));
      } catch { /* ignore */ }

      // 3. Active events user can participate in
      try {
        const events = await api.events.list('active');
        for (const event of events.slice(0, 5)) {
          try {
            const detail = await api.events.get(event.id);
            if (!detail.participated) {
              allNotifications.push({
                id: `evt_${event.id}`,
                type: 'event' as NotificationType,
                title: '🎉 ' + event.title,
                message: `${event.pointsReward}P 획득 기회! 지금 참여하세요.`,
                linkTo: '/events',
                isRead: false,
                createdAt: event.createdAt,
                eventId: event.id,
              });
            }
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }

      // Sort by date (newest first)
      allNotifications.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setNotifications(allNotifications);
      setUnreadCount(allNotifications.filter(n => !n.isRead).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read based on type
    if (!notification.isRead) {
      try {
        if (notification.type === 'worksheet_update' && notification.worksheetId) {
          const originalId = notification.id.replace('ws_', '');
          await api.notifications.markAsRead(originalId);
        } else if (notification.type === 'message' && notification.messageId) {
          await api.messages.markAsRead(notification.messageId);
        }
        // Events don't need marking - they disappear after participation

        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }

    // Navigate
    if (notification.linkTo) {
      setIsOpen(false);
      navigate(notification.linkTo);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.notifications.markAllAsRead();
      // Mark messages as read too
      for (const n of notifications.filter(n => n.type === 'message' && !n.isRead)) {
        if (n.messageId) {
          try {
            await api.messages.markAsRead(n.messageId);
          } catch { /* ignore */ }
        }
      }
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('모든 알림을 읽음 처리했습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    try {
      if (notification.type === 'worksheet_update') {
        const originalId = notification.id.replace('ws_', '');
        await api.notifications.delete(originalId);
      }
      // Messages and events can't be deleted from here

      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      if (!notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    }
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'event':
        return <Trophy className="w-4 h-4 text-yellow-500" />;
      case 'message':
        return <Mail className="w-4 h-4 text-blue-500" />;
      case 'worksheet_update':
      default:
        return <FileEdit className="w-4 h-4 text-primary-500" />;
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

  if (!isAuthenticated) return null;

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm animate-pulse">
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
                      className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors group ${
                        !notification.isRead ? 'bg-primary-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                          {getIcon(notification.type)}
                        </div>
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
                        {notification.type === 'worksheet_update' && (
                          <button
                            onClick={(e) => handleDelete(e, notification)}
                            className="shrink-0 p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50/50 flex justify-between">
                <Link
                  to="/inbox"
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  쪽지함 보기
                </Link>
                <Link
                  to="/events"
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  이벤트 보기
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default NotificationDropdown;
