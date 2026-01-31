import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Shield,
  Gift,
  MessageSquare,
  Users,
  Trophy,
  Plus,
  Send,
  Check,
  X,
  Loader2,
  Clock,
  CheckCircle,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { Button, Badge } from '@/components/common';
import { QuizGenerator } from '@/components/admin';
import { useToast } from '@/components/common/Toast';
import { useAuthStore } from '@/store';
import { api, ApiError } from '@/services/api';
import { GRADE_LABELS } from '@/types';

type Tab = 'events' | 'messages' | 'comments' | 'inquiries';
type EventType = 'quiz' | 'first_come' | 'comment';

interface Event {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  pointsReward: number;
  maxParticipants: number | null;
  currentParticipants: number;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
}

interface CommentParticipation {
  id: string;
  userId: string;
  userNickname: string;
  commentText: string;
  aiScore: number | null;
  aiFeedback: string | null;
  adminApproved: boolean | null;
  adminAdjustedScore: number | null;
  pointsEarned: number;
  participatedAt: string;
}

interface Inquiry {
  id: string;
  senderId: string;
  senderNickname: string;
  senderEmail: string;
  inquiryType: string | null;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export function AdminPage() {
  const toast = useToast();
  const { user, isAuthenticated } = useAuthStore();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const [isLoading, setIsLoading] = useState(true);

  // Events state
  const [events, setEvents] = useState<Event[]>([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    type: 'quiz' as EventType,
    pointsReward: 50,
    maxParticipants: 100,
    startAt: '',
    endAt: '',
    // Comment event specific
    reviewCriteria: '',
    minLength: 20,
    minPoints: 10,
    maxPoints: 50,
  });

  // Messages state
  const [messageForm, setMessageForm] = useState({
    recipientType: 'all' as 'all' | 'grade_group' | 'individual',
    recipientGrades: [] as string[],
    recipientId: '',
    title: '',
    content: '',
  });

  // Comments state
  const [pendingComments, setPendingComments] = useState<CommentParticipation[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  // Inquiries state
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  // Quiz generator state
  const [showQuizGenerator, setShowQuizGenerator] = useState(false);
  const [selectedQuizEventId, setSelectedQuizEventId] = useState<string>('');

  // Check admin status
  useEffect(() => {
    async function checkAdmin() {
      if (!isAuthenticated) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const result = await api.admin.isAdmin();
        setIsAdmin(result);
      } catch {
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    }
    checkAdmin();
  }, [isAuthenticated]);

  // Fetch data based on active tab
  useEffect(() => {
    if (!isAdmin) return;

    async function fetchData() {
      try {
        switch (activeTab) {
          case 'events':
            const eventResult = await api.events.list();
            setEvents(eventResult);
            break;
          case 'inquiries':
            const inqs = await api.admin.getInquiries();
            setInquiries(inqs);
            break;
        }
      } catch (error) {
        console.error('Failed to fetch admin data:', error);
      }
    }
    fetchData();
  }, [activeTab, isAdmin]);

  // Fetch comments when event is selected
  useEffect(() => {
    if (!isAdmin || activeTab !== 'comments' || !selectedEventId) return;

    async function fetchComments() {
      try {
        const comments = await api.admin.getCommentParticipations(selectedEventId);
        setPendingComments(comments);
      } catch (error) {
        console.error('Failed to fetch comments:', error);
      }
    }
    fetchComments();
  }, [activeTab, selectedEventId, isAdmin]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleCreateEvent = async () => {
    if (!eventForm.title || !eventForm.startAt || !eventForm.endAt) {
      toast.error('필수 항목을 입력해주세요.');
      return;
    }

    if (eventForm.type === 'comment' && !eventForm.reviewCriteria) {
      toast.error('댓글 이벤트는 심사 기준을 입력해주세요.');
      return;
    }

    try {
      await api.admin.createEvent({
        title: eventForm.title,
        description: eventForm.type === 'comment'
          ? `${eventForm.description}\n\n📋 심사 기준: ${eventForm.reviewCriteria}`
          : eventForm.description,
        type: eventForm.type,
        pointsReward: eventForm.pointsReward,
        maxParticipants: eventForm.type === 'first_come' ? eventForm.maxParticipants : undefined,
        startAt: eventForm.startAt,
        endAt: eventForm.endAt,
        minLength: eventForm.type === 'comment' ? eventForm.minLength : undefined,
        minPoints: eventForm.type === 'comment' ? eventForm.minPoints : undefined,
        maxPoints: eventForm.type === 'comment' ? eventForm.maxPoints : undefined,
      });

      toast.success('이벤트가 생성되었습니다.');
      setShowEventForm(false);
      setEventForm({
        title: '',
        description: '',
        type: 'quiz',
        pointsReward: 50,
        maxParticipants: 100,
        startAt: '',
        endAt: '',
        reviewCriteria: '',
        minLength: 20,
        minPoints: 10,
        maxPoints: 50,
      });

      // Refresh events
      const eventResult = await api.events.list();
      setEvents(eventResult);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    }
  };

  const handleActivateEvent = async (eventId: string) => {
    try {
      await api.admin.activateEvent(eventId);
      toast.success('이벤트가 활성화되었습니다.');
      const eventResult = await api.events.list();
      setEvents(eventResult);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    }
  };

  const handleEndEvent = async (eventId: string) => {
    try {
      await api.admin.endEvent(eventId);
      toast.success('이벤트가 종료되었습니다.');
      const eventResult = await api.events.list();
      setEvents(eventResult);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!messageForm.title || !messageForm.content) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }

    try {
      await api.admin.sendMessage({
        recipientType: messageForm.recipientType,
        recipientGrades: messageForm.recipientGrades.length > 0 ? messageForm.recipientGrades : undefined,
        recipientId: messageForm.recipientId || undefined,
        title: messageForm.title,
        content: messageForm.content,
      });

      toast.success('메시지가 전송되었습니다.');
      setMessageForm({
        recipientType: 'all',
        recipientGrades: [],
        recipientId: '',
        title: '',
        content: '',
      });
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    }
  };

  const handleApproveComment = async (participationId: string, approve: boolean) => {
    try {
      await api.admin.approveCommentParticipation(participationId, approve);
      toast.success(approve ? '승인되었습니다.' : '거부되었습니다.');
      if (selectedEventId) {
        const comments = await api.admin.getCommentParticipations(selectedEventId);
        setPendingComments(comments);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    }
  };

  const handleReplyInquiry = async (inquiryId: string, reply: string) => {
    try {
      await api.admin.replyInquiry(inquiryId, reply);
      toast.success('답변이 전송되었습니다.');
      const inqs = await api.admin.getInquiries();
      setInquiries(inqs);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'events', label: '이벤트 관리', icon: <Trophy className="w-4 h-4" /> },
    { id: 'messages', label: '메시지 발송', icon: <Send className="w-4 h-4" /> },
    { id: 'comments', label: '댓글 승인', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'inquiries', label: '문의 관리', icon: <Users className="w-4 h-4" /> },
  ];

  // Get comment events for the dropdown
  const commentEvents = events.filter(e => e.type === 'comment');

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Events Tab */}
          {activeTab === 'events' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">이벤트 목록</h2>
                <Button onClick={() => setShowEventForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  새 이벤트
                </Button>
              </div>

              {/* Event Form Modal */}
              {showEventForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={() => setShowEventForm(false)}
                  />
                  <div className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                    <h3 className="text-lg font-semibold mb-4">새 이벤트 생성</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          이벤트 유형
                        </label>
                        <select
                          value={eventForm.type}
                          onChange={(e) =>
                            setEventForm({ ...eventForm, type: e.target.value as EventType })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value="quiz">퀴즈 이벤트</option>
                          <option value="first_come">선착순 이벤트</option>
                          <option value="comment">댓글 이벤트</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          이벤트 제목 *
                        </label>
                        <input
                          type="text"
                          value={eventForm.title}
                          onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="이벤트 제목을 입력하세요"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          설명
                        </label>
                        <textarea
                          value={eventForm.description}
                          onChange={(e) =>
                            setEventForm({ ...eventForm, description: e.target.value })
                          }
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="이벤트 설명을 입력하세요"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            보상 포인트
                          </label>
                          <input
                            type="number"
                            value={eventForm.pointsReward}
                            onChange={(e) =>
                              setEventForm({
                                ...eventForm,
                                pointsReward: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>

                        {eventForm.type === 'first_come' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              최대 참여자
                            </label>
                            <input
                              type="number"
                              value={eventForm.maxParticipants}
                              onChange={(e) =>
                                setEventForm({
                                  ...eventForm,
                                  maxParticipants: Number(e.target.value),
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            시작일시 *
                          </label>
                          <input
                            type="datetime-local"
                            value={eventForm.startAt}
                            onChange={(e) =>
                              setEventForm({ ...eventForm, startAt: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            종료일시 *
                          </label>
                          <input
                            type="datetime-local"
                            value={eventForm.endAt}
                            onChange={(e) => setEventForm({ ...eventForm, endAt: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      {/* Comment Event Specific Fields */}
                      {eventForm.type === 'comment' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              심사 기준 *
                            </label>
                            <textarea
                              value={eventForm.reviewCriteria}
                              onChange={(e) =>
                                setEventForm({ ...eventForm, reviewCriteria: e.target.value })
                              }
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              placeholder="예: 주제와의 관련성, 창의적인 표현, 성의있는 내용 등"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                최소 글자수
                              </label>
                              <input
                                type="number"
                                value={eventForm.minLength}
                                onChange={(e) =>
                                  setEventForm({ ...eventForm, minLength: Number(e.target.value) })
                                }
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                최소 포인트
                              </label>
                              <input
                                type="number"
                                value={eventForm.minPoints}
                                onChange={(e) =>
                                  setEventForm({ ...eventForm, minPoints: Number(e.target.value) })
                                }
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                최대 포인트
                              </label>
                              <input
                                type="number"
                                value={eventForm.maxPoints}
                                onChange={(e) =>
                                  setEventForm({ ...eventForm, maxPoints: Number(e.target.value) })
                                }
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex gap-3 mt-6">
                      <Button variant="outline" onClick={() => setShowEventForm(false)} fullWidth>
                        취소
                      </Button>
                      <Button onClick={handleCreateEvent} fullWidth>
                        생성
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Events List */}
              <div className="space-y-4">
                {events.length === 0 ? (
                  <div className="text-center py-12">
                    <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">등록된 이벤트가 없습니다.</p>
                  </div>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            event.type === 'quiz'
                              ? 'bg-purple-100 text-purple-600'
                              : event.type === 'first_come'
                              ? 'bg-yellow-100 text-yellow-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}
                        >
                          {event.type === 'quiz' ? (
                            <Gift className="w-5 h-5" />
                          ) : event.type === 'first_come' ? (
                            <Clock className="w-5 h-5" />
                          ) : (
                            <MessageSquare className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{event.title}</h4>
                            <Badge
                              color={
                                event.status === 'active'
                                  ? 'green'
                                  : event.status === 'ended'
                                  ? 'gray'
                                  : 'yellow'
                              }
                              size="sm"
                            >
                              {event.status === 'active'
                                ? '진행중'
                                : event.status === 'ended'
                                ? '종료'
                                : '대기'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {event.pointsReward}P | 참여: {event.currentParticipants}
                            {event.maxParticipants && `/${event.maxParticipants}`}명
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {event.type === 'quiz' && (event.status === 'draft' || event.status === 'scheduled') && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedQuizEventId(event.id);
                              setShowQuizGenerator(true);
                            }}
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            문제 생성
                          </Button>
                        )}
                        {(event.status === 'draft' || event.status === 'scheduled') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleActivateEvent(event.id)}
                          >
                            활성화
                          </Button>
                        )}
                        {event.status === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEndEvent(event.id)}
                          >
                            종료
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Quiz Generator Modal */}
              {showQuizGenerator && selectedQuizEventId && (
                <QuizGenerator
                  eventId={selectedQuizEventId}
                  onComplete={() => {
                    setShowQuizGenerator(false);
                    setSelectedQuizEventId('');
                    toast.success('퀴즈가 이벤트에 추가되었습니다.');
                  }}
                  onClose={() => {
                    setShowQuizGenerator(false);
                    setSelectedQuizEventId('');
                  }}
                />
              )}
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">메시지 발송</h2>

              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    수신자 유형
                  </label>
                  <select
                    value={messageForm.recipientType}
                    onChange={(e) =>
                      setMessageForm({
                        ...messageForm,
                        recipientType: e.target.value as 'all' | 'grade_group' | 'individual',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="all">전체 회원</option>
                    <option value="grade_group">학년별</option>
                    <option value="individual">개별 회원</option>
                  </select>
                </div>

                {messageForm.recipientType === 'grade_group' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">학년</label>
                    <select
                      value={messageForm.recipientGrades[0] || ''}
                      onChange={(e) =>
                        setMessageForm({
                          ...messageForm,
                          recipientGrades: e.target.value ? [e.target.value] : [],
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">선택하세요</option>
                      {Object.entries(GRADE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {messageForm.recipientType === 'individual' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      회원 ID
                    </label>
                    <input
                      type="text"
                      value={messageForm.recipientId}
                      onChange={(e) =>
                        setMessageForm({ ...messageForm, recipientId: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="회원 UUID를 입력하세요"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                  <input
                    type="text"
                    value={messageForm.title}
                    onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="메시지 제목"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">내용 *</label>
                  <textarea
                    value={messageForm.content}
                    onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="메시지 내용을 입력하세요"
                  />
                </div>

                <Button onClick={handleSendMessage}>
                  <Send className="w-4 h-4 mr-2" />
                  발송하기
                </Button>
              </div>
            </div>
          )}

          {/* Comments Tab */}
          {activeTab === 'comments' && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">댓글 승인 대기</h2>

              {/* Event Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이벤트 선택
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">이벤트를 선택하세요</option>
                  {commentEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                {!selectedEventId ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">이벤트를 선택해주세요.</p>
                  </div>
                ) : pendingComments.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">승인 대기 중인 댓글이 없습니다.</p>
                  </div>
                ) : (
                  pendingComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-4 bg-gray-50 rounded-xl"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900">
                              {comment.userNickname || '익명'}
                            </span>
                            {comment.aiScore !== null && (
                              <Badge color="purple" size="sm">
                                AI 점수: {comment.aiScore}점
                              </Badge>
                            )}
                            {comment.adminApproved === true && (
                              <Badge color="green" size="sm">승인됨</Badge>
                            )}
                            {comment.adminApproved === false && (
                              <Badge color="red" size="sm">거부됨</Badge>
                            )}
                          </div>
                          <p className="text-gray-600 whitespace-pre-wrap">{comment.commentText}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(comment.participatedAt).toLocaleString('ko-KR')}
                          </p>
                        </div>

                        {comment.adminApproved === null && (
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproveComment(comment.id, false)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApproveComment(comment.id, true)}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Inquiries Tab */}
          {activeTab === 'inquiries' && (
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">문의 관리</h2>

              <div className="space-y-4">
                {inquiries.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">접수된 문의가 없습니다.</p>
                  </div>
                ) : (
                  inquiries.map((inquiry) => (
                    <InquiryCard
                      key={inquiry.id}
                      inquiry={inquiry}
                      onReply={handleReplyInquiry}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InquiryCard({
  inquiry,
  onReply,
}: {
  inquiry: Inquiry;
  onReply: (id: string, reply: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [reply, setReply] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reply.trim()) return;
    setIsSubmitting(true);
    await onReply(inquiry.id, reply);
    setReply('');
    setIsSubmitting(false);
    setIsExpanded(false);
  };

  return (
    <div className="p-4 bg-gray-50 rounded-xl">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full ${inquiry.isRead ? 'bg-green-500' : 'bg-yellow-500'}`}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{inquiry.senderNickname || '익명'}</span>
              <Badge color={inquiry.isRead ? 'green' : 'yellow'} size="sm">
                {inquiry.isRead ? '읽음' : '새 문의'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{inquiry.title}</p>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-gray-600 whitespace-pre-wrap mb-4">{inquiry.content}</p>

          <div className="space-y-3">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="답변을 입력하세요"
            />
            <Button onClick={handleSubmit} loading={isSubmitting} disabled={!reply.trim()}>
              <Send className="w-4 h-4 mr-2" />
              답변 보내기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
