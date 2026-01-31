import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Mail,
  MailOpen,
  Loader2,
  ChevronDown,
  Bell,
  MessageSquare,
  Reply,
} from 'lucide-react';
import { Badge } from '@/components/common';
import { useAuthStore } from '@/store';
import { api } from '@/services/api';

interface Message {
  id: string;
  senderId: string | null;
  senderNickname: string;
  messageType: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export function InboxPage() {
  const { isAuthenticated } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function fetchMessages() {
      try {
        const result = await api.messages.getInbox();
        setMessages(result);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchMessages();
  }, [isAuthenticated]);

  const handleToggle = async (messageId: string) => {
    if (expandedId === messageId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(messageId);

    // Mark as read
    const message = messages.find((m) => m.id === messageId);
    if (message && !message.isRead) {
      try {
        await api.messages.markAsRead(messageId);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isRead: true } : m))
        );
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }
  };

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const unreadCount = messages.filter((m) => !m.isRead).length;

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'notice':
        return <Bell className="w-4 h-4" />;
      case 'inquiry_reply':
        return <Reply className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getMessageTypeLabel = (type: string) => {
    switch (type) {
      case 'notice':
        return '공지';
      case 'inquiry_reply':
        return '답변';
      case 'inquiry':
        return '문의';
      default:
        return '메시지';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
              <Mail className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">쪽지함</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  읽지 않은 메시지 {unreadCount}개
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Messages List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {messages.length === 0 ? (
            <div className="text-center py-16">
              <MailOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                받은 메시지가 없습니다
              </h3>
              <p className="text-gray-500">
                관리자 공지나 문의 답변이 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {messages.map((message) => (
                <div key={message.id} className="hover:bg-gray-50 transition-colors">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => handleToggle(message.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Read indicator */}
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          message.isRead ? 'bg-gray-300' : 'bg-primary-500'
                        }`}
                      />

                      {/* Message type icon */}
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          message.messageType === 'notice'
                            ? 'bg-blue-100 text-blue-600'
                            : message.messageType === 'inquiry_reply'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {getMessageTypeIcon(message.messageType)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge
                            color={
                              message.messageType === 'notice'
                                ? 'blue'
                                : message.messageType === 'inquiry_reply'
                                ? 'green'
                                : 'gray'
                            }
                            size="sm"
                          >
                            {getMessageTypeLabel(message.messageType)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.createdAt).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                        <h4
                          className={`font-medium truncate ${
                            message.isRead ? 'text-gray-600' : 'text-gray-900'
                          }`}
                        >
                          {message.title}
                        </h4>
                      </div>
                    </div>

                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${
                        expandedId === message.id ? 'rotate-180' : ''
                      }`}
                    />
                  </div>

                  {/* Expanded content */}
                  {expandedId === message.id && (
                    <div className="px-4 pb-4">
                      <div className="ml-[52px] p-4 bg-gray-50 rounded-xl">
                        <p className="text-sm text-muted-foreground mb-2">
                          보낸 사람: {message.senderNickname || '관리자'}
                        </p>
                        <p className="text-gray-700 whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InboxPage;
