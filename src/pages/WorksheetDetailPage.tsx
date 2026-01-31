import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  ShoppingCart,
  Download,
  FileText,
  Calendar,
  User,
  CheckCircle,
  MessageSquare,
  Edit3,
  Upload,
  Image,
  History,
  Bell,
  Send,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button, Badge, Modal, Skeleton } from '@/components/common';
import { Rating } from '@/components/common/Rating';
import { useCartStore, useAuthStore } from '@/store';
import { useToast } from '@/components/common/Toast';
import { api, ApiError } from '@/services/api';
import {
  Worksheet,
  Feedback,
  GRADE_LABELS,
  SUBJECT_LABELS,
  CATEGORY_LABELS,
  formatPoints,
  formatDate,
} from '@/types';

export function WorksheetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { isAuthenticated, user, updatePoints } = useAuthStore();
  const { addItem, isInCart, toggleCart } = useCartStore();

  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isPurchased, setIsPurchased] = useState(false);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Edit modal state (for owners)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState(100);
  const [editChangeComment, setEditChangeComment] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editWorksheetFile, setEditWorksheetFile] = useState<File | null>(null);
  const [editPreviewImage, setEditPreviewImage] = useState<File | null>(null);
  const [editPreviewUrl, setEditPreviewUrl] = useState<string>('');
  const editWorksheetInputRef = useRef<HTMLInputElement>(null);
  const editPreviewInputRef = useRef<HTMLInputElement>(null);

  // Edit history state
  type EditHistory = {
    id: string;
    worksheetId: string;
    userId: string;
    editorNickname: string;
    changes: string;
    comment: string;
    isNotified: boolean;
    notifiedAt: string | null;
    notifiedCount: number;
    createdAt: string;
  };
  const [editHistory, setEditHistory] = useState<EditHistory[]>([]);
  const [sendingNotificationId, setSendingNotificationId] = useState<string | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // Feedback pagination
  const [feedbackPage, setFeedbackPage] = useState(1);
  const FEEDBACKS_PER_PAGE = 15;

  const inCart = worksheet ? isInCart(worksheet.id) : false;
  const isOwner = worksheet && user?.id === worksheet.sellerId;

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!id) return;

      setIsLoading(true);
      try {
        const [worksheetData, feedbacksData, historyData] = await Promise.all([
          api.worksheets.get(id),
          api.feedbacks.getByWorksheet(id),
          api.worksheets.getEditHistory(id),
        ]);

        if (!isMounted) return;

        setWorksheet(worksheetData);
        setFeedbacks(feedbacksData);
        setEditHistory(historyData);

        // Check purchase status if authenticated
        if (isAuthenticated) {
          const purchaseCheck = await api.purchases.check(id);
          if (isMounted) {
            setIsPurchased(purchaseCheck.purchased);
            setHasFeedback(purchaseCheck.hasFeedback);
          }
        }
      } catch (error) {
        console.error('Failed to fetch worksheet:', error);
        if (isMounted) {
          toast.error('워크시트를 불러오는데 실패했습니다.');
          navigate('/');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    return () => { isMounted = false; };
  }, [id, isAuthenticated]);

  const handleAddToCart = async () => {
    if (!worksheet) return;

    if (!isAuthenticated) {
      toast.error('로그인이 필요합니다.');
      navigate('/auth');
      return;
    }

    if (inCart) {
      toggleCart();
      return;
    }

    setIsAddingToCart(true);
    try {
      const cartItem = await api.cart.add(worksheet.id);
      addItem(cartItem);
      toast.success('장바구니에 담았습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('장바구니 담기에 실패했습니다.');
      }
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleDownload = async () => {
    if (!worksheet) return;
    // Allow download for purchasers OR owners
    if (!isPurchased && !isOwner) return;

    setIsDownloading(true);
    try {
      const result = await api.purchases.download(worksheet.id);
      window.open(result.downloadUrl, '_blank');
      toast.success('다운로드가 시작됩니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('다운로드에 실패했습니다.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!worksheet) return;
    setEditTitle(worksheet.title);
    setEditDescription(worksheet.description);
    setEditPrice(worksheet.price);
    setEditChangeComment('');
    setEditWorksheetFile(null);
    setEditPreviewImage(null);
    setEditPreviewUrl(worksheet.previewImage);
    setShowEditModal(true);
  };

  const handleEditPreviewChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditPreviewImage(file);
      setEditPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleEditWorksheetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditWorksheetFile(file);
    }
  };

  const handleSubmitEdit = async () => {
    if (!worksheet || !user) return;

    if (!editChangeComment.trim()) {
      toast.error('변경 사유를 입력해주세요.');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const updateData: {
        title?: string;
        description?: string;
        price?: number;
        fileUrl?: string;
        previewImage?: string;
      } = {};

      if (editTitle !== worksheet.title) {
        updateData.title = editTitle;
      }
      if (editDescription !== worksheet.description) {
        updateData.description = editDescription;
      }
      if (editPrice !== worksheet.price) {
        updateData.price = editPrice;
      }

      // Upload new worksheet file if provided
      if (editWorksheetFile) {
        const newFileUrl = await api.storage.uploadWorksheet(editWorksheetFile, user.id, {
          grade: worksheet.grade,
          subject: worksheet.subject,
          category: worksheet.category,
          pageCount: worksheet.pageCount,
        });
        updateData.fileUrl = newFileUrl;
      }

      // Upload new preview image if provided
      if (editPreviewImage) {
        const newPreviewUrl = await api.storage.uploadPreview(editPreviewImage, user.id);
        updateData.previewImage = newPreviewUrl;
      }

      if (Object.keys(updateData).length === 0) {
        toast.error('변경된 내용이 없습니다.');
        setIsSubmittingEdit(false);
        return;
      }

      await api.worksheets.update(worksheet.id, updateData, editChangeComment);

      // Update local worksheet state
      setWorksheet(prev => prev ? {
        ...prev,
        title: updateData.title ?? prev.title,
        description: updateData.description ?? prev.description,
        price: updateData.price ?? prev.price,
        fileUrl: updateData.fileUrl ?? prev.fileUrl,
        previewImage: updateData.previewImage ?? prev.previewImage,
        updatedAt: new Date().toISOString(),
      } : null);

      // Refetch edit history to get the real ID from database
      const updatedHistory = await api.worksheets.getEditHistory(worksheet.id);
      setEditHistory(updatedHistory);

      setShowEditModal(false);
      setEditChangeComment('');
      setEditWorksheetFile(null);
      setEditPreviewImage(null);
      toast.success('워크시트가 수정되었습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('수정에 실패했습니다.');
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleSendNotification = async (historyId: string) => {
    if (!confirm('구매자들에게 수정 알림을 보내시겠습니까?\n\n알림을 보내면 구매자들이 이 수정 내역을 볼 수 있습니다.')) {
      return;
    }

    setSendingNotificationId(historyId);
    try {
      const result = await api.worksheets.sendEditNotification(historyId);

      // Update local state
      setEditHistory(prev => prev.map(h =>
        h.id === historyId
          ? {
              ...h,
              isNotified: true,
              notifiedAt: new Date().toISOString(),
              notifiedCount: result.notifiedCount
            }
          : h
      ));

      toast.success(`${result.notifiedCount}명의 구매자에게 알림을 보냈습니다.`);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('알림 전송에 실패했습니다.');
      }
    } finally {
      setSendingNotificationId(null);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!worksheet) return;

    setIsSubmittingFeedback(true);
    try {
      const result = await api.feedbacks.create({
        worksheetId: worksheet.id,
        rating: feedbackRating,
        comment: feedbackComment,
      });

      // Update user points with refund
      updatePoints(result.newBalance);

      // Update local state
      setHasFeedback(true);
      setFeedbacks((prev) => [result.feedback, ...prev]);
      setWorksheet((prev) =>
        prev
          ? {
              ...prev,
              averageRating:
                (prev.averageRating * prev.reviewCount + feedbackRating) /
                (prev.reviewCount + 1),
              reviewCount: prev.reviewCount + 1,
            }
          : null
      );

      setShowFeedbackModal(false);
      setFeedbackComment('');
      setFeedbackRating(5);

      toast.success(`후기 작성 완료! ${formatPoints(30)} 환급되었습니다.`);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('후기 작성에 실패했습니다.');
      }
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Skeleton.Text className="w-24 h-8 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton.Card />
          <div className="space-y-4">
            <Skeleton.Text className="h-8" />
            <Skeleton.Text className="h-6 w-2/3" />
            <Skeleton.Text className="h-24" />
            <Skeleton.Card />
          </div>
        </div>
      </div>
    );
  }

  if (!worksheet) {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>뒤로 가기</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Preview Image */}
        <div className="space-y-4">
          <div className="aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden">
            <img
              src={worksheet.previewImage}
              alt={worksheet.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge color="blue">{GRADE_LABELS[worksheet.grade]}</Badge>
            <Badge color="purple">{SUBJECT_LABELS[worksheet.subject]}</Badge>
            <Badge color="green">{CATEGORY_LABELS[worksheet.category]}</Badge>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {worksheet.title}
            </h1>
            <Link
              to={`/?seller=${worksheet.sellerId}`}
              className="text-gray-600 hover:text-primary-600 transition-colors"
            >
              {worksheet.sellerNickname}
            </Link>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Star className="w-5 h-5 text-yellow-400 fill-current" />
              <span className="font-semibold text-lg">
                {worksheet.averageRating.toFixed(1)}
              </span>
            </div>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">
              후기 {worksheet.reviewCount}개
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">
              판매 {worksheet.salesCount}회
            </span>
          </div>

          {/* Description */}
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 whitespace-pre-wrap">
              {worksheet.description}
            </p>
          </div>

          {/* Meta Info */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              <span>{worksheet.pageCount}페이지</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(worksheet.createdAt)}</span>
            </div>
          </div>

          {/* Price & Action */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">가격</span>
              <span className="text-2xl font-bold text-primary-600">
                {formatPoints(worksheet.price)}
              </span>
            </div>

            {isOwner ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-primary-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">내가 등록한 자료</span>
                </div>
                <Button
                  fullWidth
                  size="lg"
                  onClick={handleDownload}
                  loading={isDownloading}
                >
                  <Download className="w-5 h-5 mr-2" />
                  다운로드 (테스트)
                </Button>
                <Button
                  fullWidth
                  variant="outline"
                  onClick={handleOpenEditModal}
                >
                  <Edit3 className="w-5 h-5 mr-2" />
                  자료 수정
                </Button>
              </div>
            ) : isPurchased ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-secondary-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">구매 완료</span>
                </div>
                <Button
                  fullWidth
                  size="lg"
                  onClick={handleDownload}
                  loading={isDownloading}
                >
                  <Download className="w-5 h-5 mr-2" />
                  다운로드
                </Button>
                {!hasFeedback && (
                  <Button
                    fullWidth
                    variant="outline"
                    onClick={() => setShowFeedbackModal(true)}
                  >
                    <MessageSquare className="w-5 h-5 mr-2" />
                    후기 작성하고 30P 받기
                  </Button>
                )}
              </div>
            ) : (
              <Button
                fullWidth
                size="lg"
                onClick={handleAddToCart}
                loading={isAddingToCart}
                disabled={inCart}
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                {inCart ? '장바구니에 담김' : '장바구니에 담기'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Edit History Section - Collapsible */}
      {editHistory.length > 0 && (
        <section className="mt-12">
          <button
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5" />
              수정 이력 ({editHistory.length})
            </h2>
            {isHistoryExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {isHistoryExpanded && (
            <div className="mt-3 space-y-3">
              {editHistory.map((history) => (
                <div
                  key={history.id}
                  className={`rounded-lg p-4 ${
                    history.isNotified
                      ? 'bg-amber-50 border border-amber-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Edit3 className={`w-4 h-4 ${history.isNotified ? 'text-amber-600' : 'text-gray-500'}`} />
                      <span className={`font-medium ${history.isNotified ? 'text-amber-800' : 'text-gray-700'}`}>
                        {history.editorNickname}
                      </span>
                      <span className={history.isNotified ? 'text-amber-600' : 'text-gray-500'}>님이 수정</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {history.isNotified ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          <Bell className="w-3 h-3" />
                          {history.notifiedCount}명에게 알림 완료
                        </span>
                      ) : isOwner && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendNotification(history.id);
                          }}
                          loading={sendingNotificationId === history.id}
                          className="text-xs"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          구매자에게 알림
                        </Button>
                      )}
                      <span className={`text-xs ${history.isNotified ? 'text-amber-600' : 'text-gray-500'}`}>
                        {formatDate(history.createdAt)}
                      </span>
                    </div>
                  </div>
                  <p className={`text-sm mb-1 ${history.isNotified ? 'text-amber-700' : 'text-gray-600'}`}>
                    <span className="font-medium">변경 내용:</span> {history.changes}
                  </p>
                  {history.comment && (
                    <p className={`text-sm ${history.isNotified ? 'text-amber-700' : 'text-gray-600'}`}>
                      <span className="font-medium">사유:</span> {history.comment}
                    </p>
                  )}
                  {!history.isNotified && isOwner && (
                    <p className="text-xs text-gray-400 mt-2">
                      * 알림을 보내야 구매자들이 이 수정 내역을 볼 수 있습니다
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Reviews Section with Pagination */}
      <section className="mt-12">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          구매 후기 ({feedbacks.length})
        </h2>

        {feedbacks.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">아직 후기가 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {feedbacks
                .slice((feedbackPage - 1) * FEEDBACKS_PER_PAGE, feedbackPage * FEEDBACKS_PER_PAGE)
                .map((feedback) => (
                  <div
                    key={feedback.id}
                    className="bg-white border border-gray-200 rounded-xl p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {feedback.buyerNickname}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDate(feedback.createdAt)}
                          </p>
                        </div>
                      </div>
                      <Rating value={feedback.rating} readonly size="sm" />
                    </div>
                    <p className="text-gray-600">{feedback.comment}</p>
                  </div>
                ))}
            </div>

            {/* Pagination */}
            {feedbacks.length > FEEDBACKS_PER_PAGE && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setFeedbackPage(p => Math.max(1, p - 1))}
                  disabled={feedbackPage === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.ceil(feedbacks.length / FEEDBACKS_PER_PAGE) }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setFeedbackPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium ${
                        feedbackPage === page
                          ? 'bg-primary-500 text-white'
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setFeedbackPage(p => Math.min(Math.ceil(feedbacks.length / FEEDBACKS_PER_PAGE), p + 1))}
                  disabled={feedbackPage >= Math.ceil(feedbacks.length / FEEDBACKS_PER_PAGE)}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Feedback Modal */}
      <Modal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        title="후기 작성"
      >
        <Modal.Body>
          <div className="space-y-4">
            <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-3 text-sm text-secondary-700">
              후기 작성 시 <span className="font-bold">30P</span>가 환급됩니다!
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                평점
              </label>
              <Rating
                value={feedbackRating}
                onChange={setFeedbackRating}
                size="lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                후기 내용
              </label>
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="자료에 대한 솔직한 후기를 작성해주세요."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline" onClick={() => setShowFeedbackModal(false)}>
            취소
          </Button>
          <Button
            onClick={handleSubmitFeedback}
            loading={isSubmittingFeedback}
            disabled={!feedbackComment.trim()}
          >
            작성 완료
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Modal (for owners) */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="워크시트 수정"
      >
        <Modal.Body>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              수정 시 변경 사유를 반드시 입력해주세요. 구매자가 변경 내역을 확인할 수 있습니다.
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                제목
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                설명
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                가격 (100~500P)
              </label>
              <input
                type="number"
                min={100}
                max={500}
                value={editPrice}
                onChange={(e) => setEditPrice(Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>

            {/* Preview Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                미리보기 이미지 변경
              </label>
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                  {editPreviewUrl ? (
                    <img
                      src={editPreviewUrl}
                      alt="미리보기"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    ref={editPreviewInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleEditPreviewChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => editPreviewInputRef.current?.click()}
                  >
                    <Image className="w-4 h-4 mr-2" />
                    이미지 선택
                  </Button>
                  {editPreviewImage && (
                    <p className="mt-2 text-sm text-green-600">
                      {editPreviewImage.name}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    JPG, PNG, WEBP (최대 5MB)
                  </p>
                </div>
              </div>
            </div>

            {/* Worksheet File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                워크시트 파일 변경
              </label>
              <input
                ref={editWorksheetInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                onChange={handleEditWorksheetChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => editWorksheetInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                파일 선택
              </Button>
              {editWorksheetFile && (
                <p className="mt-2 text-sm text-green-600">
                  {editWorksheetFile.name}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                PDF, DOC, DOCX, PPT, PPTX (최대 50MB)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                변경 사유 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={editChangeComment}
                onChange={(e) => setEditChangeComment(e.target.value)}
                placeholder="예: 오타 수정, 내용 보완, 가격 조정 등"
                rows={2}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline" onClick={() => setShowEditModal(false)}>
            취소
          </Button>
          <Button
            onClick={handleSubmitEdit}
            loading={isSubmittingEdit}
            disabled={!editChangeComment.trim()}
          >
            수정 완료
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default WorksheetDetailPage;
