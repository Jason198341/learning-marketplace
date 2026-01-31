import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Gift,
  Clock,
  MessageSquare,
  Users,
  Loader2,
  CheckCircle,
  Star,
  Sparkles,
} from 'lucide-react';
import { Button, Badge } from '@/components/common';
import { useToast } from '@/components/common/Toast';
import { useAuthStore } from '@/store';
import { api, ApiError } from '@/services/api';

interface Event {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  startAt: string | null;
  endAt: string | null;
  maxParticipants: number | null;
  currentParticipants: number;
  pointsReward: number;
  missionType: string | null;
}

interface EventDetail extends Event {
  questions?: Array<{
    id: string;
    question: string;
    questionType: string;
    choices: Record<string, string> | null;
    orderNum: number;
  }>;
  participated: boolean;
}

export function EventsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { isAuthenticated, updatePoints } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventDetail | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Quiz state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Comment state
  const [comment, setComment] = useState('');

  useEffect(() => {
    async function fetchEvents() {
      try {
        const result = await api.events.list('active');
        setEvents(result);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchEvents();
  }, []);

  const handleSelectEvent = async (event: Event) => {
    if (!isAuthenticated) {
      toast.error('로그인이 필요합니다.');
      navigate('/auth');
      return;
    }

    try {
      const detail = await api.events.get(event.id);
      setSelectedEvent(detail);
      setShowModal(true);
      setAnswers({});
      setComment('');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedEvent(null);
    setAnswers({});
    setComment('');
  };

  const handleQuizSubmit = async () => {
    if (!selectedEvent) return;

    // Check all questions are answered
    const unanswered = selectedEvent.questions?.filter(
      (q) => !answers[q.id]
    );
    if (unanswered && unanswered.length > 0) {
      toast.error('모든 문제에 답해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.events.submitQuiz(selectedEvent.id, answers);
      if (result.success) {
        toast.success(
          `정답 ${result.correctCount}/${result.totalQuestions}개! ${result.pointsEarned}P 획득!`
        );
        if (result.newBalance) {
          updatePoints(result.newBalance);
        }
        handleCloseModal();
        // Refresh events
        const updated = await api.events.list('active');
        setEvents(updated);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFirstComeSubmit = async () => {
    if (!selectedEvent) return;

    setIsSubmitting(true);
    try {
      const result = await api.events.participateFirstCome(
        selectedEvent.id,
        selectedEvent.missionType === 'comment_required' ? comment : undefined
      );

      if (result.success) {
        toast.success(`${result.position}등! ${result.points_earned}P 획득!`);
        if (result.new_balance) {
          updatePoints(result.new_balance);
        }
        handleCloseModal();
        // Refresh events
        const updated = await api.events.list('active');
        setEvents(updated);
      } else {
        toast.error(result.error || '참여에 실패했습니다.');
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!selectedEvent || !comment.trim()) {
      toast.error('댓글을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.events.participateFirstCome(selectedEvent.id, comment);

      if (result.success) {
        toast.success('참여 완료! 관리자 승인 후 포인트가 지급됩니다.');
        handleCloseModal();
        // Refresh events
        const updated = await api.events.list('active');
        setEvents(updated);
      } else {
        toast.error(result.error || '참여에 실패했습니다.');
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'quiz':
        return <Gift className="w-6 h-6" />;
      case 'first_come':
        return <Clock className="w-6 h-6" />;
      case 'comment':
        return <MessageSquare className="w-6 h-6" />;
      default:
        return <Trophy className="w-6 h-6" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'quiz':
        return 'from-purple-500 to-purple-600';
      case 'first_come':
        return 'from-yellow-500 to-orange-500';
      case 'comment':
        return 'from-blue-500 to-cyan-500';
      default:
        return 'from-primary-500 to-primary-600';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 text-white mb-4">
            <Trophy className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">이벤트</h1>
          <p className="text-muted-foreground">
            다양한 이벤트에 참여하고 포인트를 획득하세요!
          </p>
        </div>

        {/* Events Grid */}
        {events.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              진행 중인 이벤트가 없습니다
            </h3>
            <p className="text-gray-500">곧 새로운 이벤트가 시작됩니다!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleSelectEvent(event)}
              >
                {/* Header */}
                <div
                  className={`bg-gradient-to-r ${getEventColor(
                    event.type
                  )} p-4 text-white`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getEventIcon(event.type)}
                      <Badge color="gray" size="sm" className="bg-white/20 text-white border-0">
                        {event.type === 'quiz'
                          ? '퀴즈'
                          : event.type === 'first_come'
                          ? '선착순'
                          : '댓글'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-white" />
                      <span className="font-bold">{event.pointsReward}P</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                    {event.title}
                  </h3>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>
                        {event.currentParticipants}
                        {event.maxParticipants && `/${event.maxParticipants}`}명 참여
                      </span>
                    </div>
                    {event.type === 'first_come' && event.maxParticipants && (
                      <Badge
                        color={
                          event.currentParticipants >= event.maxParticipants
                            ? 'red'
                            : 'green'
                        }
                        size="sm"
                      >
                        {event.currentParticipants >= event.maxParticipants
                          ? '마감'
                          : `${event.maxParticipants - event.currentParticipants}명 남음`}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Event Modal */}
        {showModal && selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={handleCloseModal}
            />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div
                className={`bg-gradient-to-r ${getEventColor(
                  selectedEvent.type
                )} p-6 text-white`}
              >
                <div className="flex items-center gap-3 mb-2">
                  {getEventIcon(selectedEvent.type)}
                  <Badge color="gray" size="sm" className="bg-white/20 text-white border-0">
                    {selectedEvent.type === 'quiz'
                      ? '퀴즈 이벤트'
                      : selectedEvent.type === 'first_come'
                      ? '선착순 이벤트'
                      : '댓글 이벤트'}
                  </Badge>
                </div>
                <h2 className="text-xl font-bold">{selectedEvent.title}</h2>
                {selectedEvent.description && (
                  <p className="text-white/80 mt-2">{selectedEvent.description}</p>
                )}
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {selectedEvent.participated ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      이미 참여하셨습니다
                    </h3>
                    <p className="text-muted-foreground">
                      다음 이벤트를 기대해주세요!
                    </p>
                    <Button onClick={handleCloseModal} className="mt-4">
                      확인
                    </Button>
                  </div>
                ) : selectedEvent.type === 'quiz' && selectedEvent.questions ? (
                  // Quiz Event
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                      <span className="font-medium text-gray-900">
                        {selectedEvent.questions.length}개 문제
                      </span>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-primary-600 font-medium">
                        최대 {selectedEvent.pointsReward}P 획득
                      </span>
                    </div>

                    <div className="space-y-6">
                      {selectedEvent.questions.map((q, idx) => (
                        <div
                          key={q.id}
                          className="p-4 bg-gray-50 rounded-xl"
                        >
                          <p className="font-medium text-gray-900 mb-3">
                            {idx + 1}. {q.question}
                          </p>

                          {q.questionType === 'ox' ? (
                            <div className="flex gap-3">
                              {['O', 'X'].map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() =>
                                    setAnswers({ ...answers, [q.id]: opt })
                                  }
                                  className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                                    answers[q.id] === opt
                                      ? opt === 'O'
                                        ? 'bg-green-500 text-white'
                                        : 'bg-red-500 text-white'
                                      : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          ) : q.choices ? (
                            <div className="space-y-2">
                              {Object.entries(q.choices).map(([key, value]) => (
                                <button
                                  key={key}
                                  onClick={() =>
                                    setAnswers({ ...answers, [q.id]: key })
                                  }
                                  className={`w-full text-left p-3 rounded-xl transition-all ${
                                    answers[q.id] === key
                                      ? 'bg-primary-500 text-white'
                                      : 'bg-white border border-gray-200 text-gray-700 hover:border-primary-300'
                                  }`}
                                >
                                  <span className="font-medium">{key}.</span> {value}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3 mt-6">
                      <Button variant="outline" onClick={handleCloseModal} fullWidth>
                        취소
                      </Button>
                      <Button
                        onClick={handleQuizSubmit}
                        loading={isSubmitting}
                        fullWidth
                      >
                        제출하기
                      </Button>
                    </div>
                  </div>
                ) : selectedEvent.type === 'first_come' ? (
                  // First-come Event
                  <div>
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-100 mb-4">
                        <Clock className="w-10 h-10 text-yellow-600" />
                      </div>
                      <p className="text-lg font-medium text-gray-900">
                        {selectedEvent.maxParticipants &&
                        selectedEvent.currentParticipants >= selectedEvent.maxParticipants
                          ? '이미 마감되었습니다'
                          : `${selectedEvent.pointsReward}P 획득 기회!`}
                      </p>
                      <p className="text-muted-foreground">
                        현재 {selectedEvent.currentParticipants}
                        {selectedEvent.maxParticipants &&
                          `/${selectedEvent.maxParticipants}`}
                        명 참여
                      </p>
                    </div>

                    {selectedEvent.missionType === 'comment_required' && (
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          한마디 남기기
                        </label>
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="참여 소감을 남겨주세요"
                        />
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={handleCloseModal} fullWidth>
                        취소
                      </Button>
                      <Button
                        onClick={handleFirstComeSubmit}
                        loading={isSubmitting}
                        disabled={
                          selectedEvent.maxParticipants &&
                          selectedEvent.currentParticipants >= selectedEvent.maxParticipants
                            ? true
                            : selectedEvent.missionType === 'comment_required' &&
                              !comment.trim()
                        }
                        fullWidth
                      >
                        참여하기
                      </Button>
                    </div>
                  </div>
                ) : selectedEvent.type === 'comment' ? (
                  // Comment Event
                  <div>
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 mb-4">
                        <MessageSquare className="w-10 h-10 text-blue-600" />
                      </div>
                      <p className="text-lg font-medium text-gray-900">
                        댓글을 작성하고 포인트를 받으세요!
                      </p>
                      <p className="text-muted-foreground">
                        AI가 댓글 품질을 평가하고, 관리자 승인 후 포인트가 지급됩니다.
                      </p>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        댓글 작성
                      </label>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={5}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="이벤트 주제에 맞는 댓글을 작성해주세요. 성의있는 댓글일수록 더 많은 포인트를 받을 수 있습니다."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        * 최소 20자 이상 작성해주세요
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={handleCloseModal} fullWidth>
                        취소
                      </Button>
                      <Button
                        onClick={handleCommentSubmit}
                        loading={isSubmitting}
                        disabled={comment.trim().length < 20}
                        fullWidth
                      >
                        제출하기
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EventsPage;
