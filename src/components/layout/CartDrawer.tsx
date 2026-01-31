import { useState } from 'react';
import { X, ShoppingCart, Trash2, Loader2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCartStore, useAuthStore } from '@/store';
import { Button, Modal } from '../common';
import { formatPoints } from '@/types';
import { api, ApiError } from '@/services/api';
import { useToast } from '../common/Toast';

export function CartDrawer() {
  const navigate = useNavigate();
  const { isOpen, items, removeItem, clearCart, closeCart } = useCartStore();
  const { user, updatePoints } = useAuthStore();
  const toast = useToast();

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Filter out items where worksheet is null
  const validItems = items.filter(item => item.worksheet !== null);
  const totalPrice = validItems.reduce((sum, item) => sum + (item.worksheet?.price ?? 0), 0);
  const userPoints = user?.points ?? 0;
  const remainingPoints = userPoints - totalPrice;
  const canAfford = remainingPoints >= 0;

  const handleRemove = async (worksheetId: string) => {
    setRemovingId(worksheetId);
    try {
      await api.cart.remove(worksheetId);
      removeItem(worksheetId);
    } catch (error) {
      toast.error('장바구니에서 제거하는데 실패했습니다.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleCheckout = async () => {
    if (!canAfford) {
      toast.error('포인트가 부족합니다.');
      return;
    }

    setShowConfirmModal(true);
  };

  const confirmCheckout = async () => {
    setShowConfirmModal(false);
    setIsCheckingOut(true);

    try {
      const result = await api.purchases.create() as {
        newBalance: number;
        totalSpent: number;
        downloads: Array<{ title: string }>;
      };

      updatePoints(result.newBalance);
      clearCart();
      closeCart();

      toast.success(`구매 완료! ${formatPoints(result.totalSpent)} 사용`);

      // Navigate to purchase success or my purchases
      navigate('/my/purchases');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('구매 중 오류가 발생했습니다.');
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
        onClick={closeCart}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-slide-in-bottom sm:animate-slide-in-top">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">장바구니</h2>
              <p className="text-xs text-muted-foreground">{validItems.length}개 상품</p>
            </div>
          </div>
          <button
            onClick={closeCart}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {validItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-5">
                <ShoppingBag className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-lg font-medium text-gray-900">장바구니가 비어있어요</p>
              <p className="text-sm text-muted-foreground mt-1.5 text-center">
                마음에 드는 워크시트를 담아보세요!
              </p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => {
                  closeCart();
                  navigate('/');
                }}
              >
                둘러보기
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {validItems.map((item) => {
                const worksheet = item.worksheet!;
                return (
                  <div
                    key={item.id}
                    className="flex gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100/80 transition-colors group"
                  >
                    {/* Preview Image */}
                    <img
                      src={worksheet.previewImage}
                      alt={worksheet.title}
                      className="w-16 h-20 object-cover rounded-lg bg-gray-200 ring-1 ring-gray-200"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0 py-0.5">
                      <h3 className="font-medium text-gray-900 truncate text-sm">
                        {worksheet.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {worksheet.sellerNickname}
                      </p>
                      <p className="text-primary-600 font-semibold mt-2.5 text-sm">
                        {formatPoints(worksheet.price)}
                      </p>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => handleRemove(item.worksheetId)}
                      disabled={removingId === item.worksheetId}
                      className="p-2 h-fit rounded-lg hover:bg-gray-200 text-gray-400 hover:text-red-500
                               transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                    >
                      {removingId === item.worksheetId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {validItems.length > 0 && (
          <div className="border-t border-gray-100 p-5 space-y-4 bg-gradient-to-t from-gray-50 to-white">
            {/* Summary */}
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">총 결제 금액</span>
                <span className="font-semibold text-gray-900">
                  {formatPoints(totalPrice)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">보유 포인트</span>
                <span className="font-semibold text-gray-900">
                  {formatPoints(userPoints)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <span className="text-muted-foreground">결제 후 잔액</span>
                <span
                  className={`font-bold ${
                    canAfford ? 'text-secondary-600' : 'text-destructive'
                  }`}
                >
                  {canAfford
                    ? formatPoints(remainingPoints)
                    : `${formatPoints(Math.abs(remainingPoints))} 부족`}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <Button
              fullWidth
              size="lg"
              disabled={!canAfford || isCheckingOut}
              loading={isCheckingOut}
              onClick={handleCheckout}
              className="rounded-xl"
            >
              {canAfford
                ? `${formatPoints(totalPrice)} 결제하기`
                : '포인트 부족'}
            </Button>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="구매 확인"
        size="sm"
      >
        <Modal.Body>
          <div className="text-center py-2">
            <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-primary-500" />
            </div>
            <p className="text-gray-700">
              <span className="font-bold text-primary-600 text-lg">
                {formatPoints(totalPrice)}
              </span>
              <span className="text-gray-500 text-sm ml-1">를 사용하여</span>
            </p>
            <p className="text-gray-900 font-medium mt-1">
              {validItems.length}개의 워크시트를 구매하시겠습니까?
            </p>
            <p className="text-sm text-muted-foreground mt-3 px-4 py-2 bg-gray-50 rounded-lg inline-block">
              구매 후 잔여 포인트: <span className="font-medium text-secondary-600">{formatPoints(remainingPoints)}</span>
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
            취소
          </Button>
          <Button onClick={confirmCheckout}>확인</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default CartDrawer;
