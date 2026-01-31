import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  User,
  ShoppingBag,
  FileText,
  BarChart3,
  Coins,
  ChevronRight,
  Download,
  Star,
  Calendar,
  LogOut,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { Button, Badge, Skeleton, Modal } from '@/components/common';
import { useAuthStore } from '@/store';
import { useToast } from '@/components/common/Toast';
import { api, ApiError } from '@/services/api';
import {
  Purchase,
  Worksheet,
  PointTransaction,
  GRADE_LABELS,
  SUBJECT_LABELS,
  formatPoints,
  formatDate,
} from '@/types';

// Tab Navigation
function TabNav() {
  const location = useLocation();

  const tabs = [
    { path: '/my', label: '대시보드', icon: User, exact: true },
    { path: '/my/purchases', label: '구매 내역', icon: ShoppingBag },
    { path: '/my/worksheets', label: '내 자료', icon: FileText },
    { path: '/my/sales', label: '판매 현황', icon: BarChart3 },
    { path: '/my/points', label: '포인트', icon: Coins },
  ];

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="bg-white border-b">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex items-center gap-2 px-4 py-4 border-b-2 whitespace-nowrap transition-colors ${
                isActive(tab.path, tab.exact)
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

// Dashboard Page
function DashboardPage() {
  const { user, logout, updateNickname } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [summary, setSummary] = useState<{
    purchaseCount: number;
    worksheetCount: number;
    totalSales: number;
    totalEarnings: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState(user?.nickname || '');
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchSummary = async () => {
      try {
        const data = await api.my.summary();
        if (isMounted) {
          setSummary(data);
        }
      } catch (error) {
        console.error('Failed to fetch summary:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    fetchSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveNickname = async () => {
    if (!newNickname.trim() || newNickname === user?.nickname) {
      setIsEditingNickname(false);
      return;
    }

    setIsSavingNickname(true);
    try {
      await api.auth.updateNickname(newNickname.trim());
      updateNickname(newNickname.trim());
      toast.success('닉네임이 변경되었습니다.');
      setIsEditingNickname(false);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('닉네임 변경에 실패했습니다.');
      }
    } finally {
      setIsSavingNickname(false);
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    navigate('/');
    toast.success('로그아웃되었습니다.');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton.Card className="h-32" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton.Card key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              {isEditingNickname ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-lg font-semibold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveNickname();
                      if (e.key === 'Escape') setIsEditingNickname(false);
                    }}
                  />
                  <button
                    onClick={handleSaveNickname}
                    disabled={isSavingNickname}
                    className="p-1.5 text-secondary-600 hover:bg-secondary-50 rounded-lg"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingNickname(false);
                      setNewNickname(user?.nickname || '');
                    }}
                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {user?.nickname}
                  </h2>
                  <button
                    onClick={() => setIsEditingNickname(true)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              <p className="text-gray-500">{user?.email}</p>
              <Badge color={user?.role === 'teacher' ? 'blue' : 'green'} className="mt-2">
                {user?.role === 'teacher' ? '선생님' : '학부모'}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">보유 포인트</p>
            <p className="text-2xl font-bold text-primary-600">
              {formatPoints(user?.points || 0)}
            </p>
          </div>
        </div>

        {/* Settings & Logout */}
        <div className="mt-6 pt-4 border-t flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLogoutModal(true)}
          >
            <LogOut className="w-4 h-4 mr-2" />
            로그아웃
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/my/purchases"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-200 hover:shadow-sm transition-all"
        >
          <ShoppingBag className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            {summary?.purchaseCount || 0}
          </p>
          <p className="text-sm text-gray-500">구매한 자료</p>
        </Link>
        <Link
          to="/my/worksheets"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-200 hover:shadow-sm transition-all"
        >
          <FileText className="w-8 h-8 text-purple-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            {summary?.worksheetCount || 0}
          </p>
          <p className="text-sm text-gray-500">등록한 자료</p>
        </Link>
        <Link
          to="/my/sales"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-200 hover:shadow-sm transition-all"
        >
          <BarChart3 className="w-8 h-8 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            {summary?.totalSales || 0}
          </p>
          <p className="text-sm text-gray-500">총 판매 횟수</p>
        </Link>
        <Link
          to="/my/points"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-200 hover:shadow-sm transition-all"
        >
          <Coins className="w-8 h-8 text-yellow-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            {formatPoints(summary?.totalEarnings || 0)}
          </p>
          <p className="text-sm text-gray-500">총 수익</p>
        </Link>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-medium text-gray-900">빠른 메뉴</h3>
        </div>
        <div className="divide-y">
          <Link
            to="/upload"
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-gray-700">새 자료 등록하기</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
          <Link
            to="/"
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-gray-700">자료 둘러보기</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="로그아웃"
        size="sm"
      >
        <Modal.Body>
          <p className="text-gray-600">정말 로그아웃 하시겠습니까?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline" onClick={() => setShowLogoutModal(false)}>
            취소
          </Button>
          <Button variant="danger" onClick={handleLogout}>
            로그아웃
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

// Purchases Page
function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    let isMounted = true;

    const fetchPurchases = async () => {
      try {
        const data = await api.purchases.list();
        if (isMounted) setPurchases(data);
      } catch (error) {
        console.error('Failed to fetch purchases:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchPurchases();

    return () => { isMounted = false; };
  }, []);

  const handleDownload = async (worksheetId: string) => {
    try {
      const result = await api.purchases.download(worksheetId);
      window.open(result.downloadUrl, '_blank');
      toast.success('다운로드가 시작됩니다.');
    } catch (error) {
      toast.error('다운로드에 실패했습니다.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton.Card key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="text-center py-16">
        <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          구매 내역이 없습니다
        </h3>
        <p className="text-gray-500 mb-4">
          마음에 드는 자료를 구매해보세요
        </p>
        <Link to="/">
          <Button>자료 둘러보기</Button>
        </Link>
      </div>
    );
  }

  // Filter out purchases where worksheet is null
  const validPurchases = purchases.filter(p => p.worksheet !== null);

  return (
    <div className="space-y-4">
      {validPurchases.map((purchase) => {
        const worksheet = purchase.worksheet!;
        return (
          <div
            key={purchase.id}
            className="bg-white rounded-xl border border-gray-200 p-4"
          >
            <div className="flex gap-4">
              <img
                src={worksheet.previewImage}
                alt={worksheet.title}
                className="w-20 h-24 object-cover rounded-lg bg-gray-100"
              />
              <div className="flex-1 min-w-0">
                <Link
                  to={`/worksheet/${purchase.worksheetId}`}
                  className="font-medium text-gray-900 hover:text-primary-600 transition-colors line-clamp-1"
                >
                  {worksheet.title}
                </Link>
                <p className="text-sm text-gray-500 mt-1">
                  {worksheet.sellerNickname}
                </p>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(purchase.purchasedAt)}</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="font-semibold text-primary-600">
                    {formatPoints(purchase.price)}
                  </span>
                  <div className="flex items-center gap-2">
                    {!purchase.hasFeedback && (
                      <Link to={`/worksheet/${purchase.worksheetId}`}>
                        <Button size="sm" variant="outline">
                          후기 작성
                        </Button>
                      </Link>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleDownload(purchase.worksheetId)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      다운로드
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// My Worksheets Page
function MyWorksheetsPage() {
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchWorksheets = async () => {
      try {
        const data = await api.my.worksheets();
        if (isMounted) setWorksheets(data);
      } catch (error) {
        console.error('Failed to fetch worksheets:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchWorksheets();

    return () => { isMounted = false; };
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton.Card key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (worksheets.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          등록한 자료가 없습니다
        </h3>
        <p className="text-gray-500 mb-4">
          학습 자료를 등록하고 수익을 창출해보세요
        </p>
        <Link to="/upload">
          <Button>자료 등록하기</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {worksheets.map((worksheet) => (
        <Link
          key={worksheet.id}
          to={`/worksheet/${worksheet.id}`}
          className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-200 hover:shadow-sm transition-all"
        >
          <div className="flex gap-4">
            <img
              src={worksheet.previewImage}
              alt={worksheet.title}
              className="w-20 h-24 object-cover rounded-lg bg-gray-100"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 line-clamp-1">
                {worksheet.title}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <Badge color="blue" size="sm">
                  {GRADE_LABELS[worksheet.grade]}
                </Badge>
                <Badge color="purple" size="sm">
                  {SUBJECT_LABELS[worksheet.subject]}
                </Badge>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span>{worksheet.averageRating.toFixed(1)}</span>
                  </div>
                  <span>판매 {worksheet.salesCount}회</span>
                </div>
                <span className="font-semibold text-primary-600">
                  {formatPoints(worksheet.price)}
                </span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// Sales Page
function SalesPage() {
  const [sales, setSales] = useState<{
    totalSales: number;
    totalEarnings: number;
    worksheets: Array<{
      worksheetId: string;
      title: string;
      salesCount: number;
      earnings: number;
    }>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchSales = async () => {
      try {
        const data = await api.my.sales();
        if (isMounted) setSales(data);
      } catch (error) {
        console.error('Failed to fetch sales:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchSales();

    return () => { isMounted = false; };
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton.Card className="h-24" />
          <Skeleton.Card className="h-24" />
        </div>
        <Skeleton.Card className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">총 판매 횟수</p>
          <p className="text-2xl font-bold text-gray-900">
            {sales?.totalSales || 0}회
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">총 수익</p>
          <p className="text-2xl font-bold text-secondary-600">
            {formatPoints(sales?.totalEarnings || 0)}
          </p>
        </div>
      </div>

      {/* Sales by Worksheet */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-medium text-gray-900">자료별 판매 현황</h3>
        </div>
        {sales?.worksheets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            판매 내역이 없습니다
          </div>
        ) : (
          <div className="divide-y">
            {sales?.worksheets.map((item) => (
              <Link
                key={item.worksheetId}
                to={`/worksheet/${item.worksheetId}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-500">
                    {item.salesCount}회 판매
                  </p>
                </div>
                <span className="font-semibold text-secondary-600">
                  +{formatPoints(item.earnings)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Points Page
function PointsPage() {
  const { user } = useAuthStore();
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchTransactions = async () => {
      try {
        const data = await api.points.getTransactions();
        if (isMounted) setTransactions(data);
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchTransactions();

    return () => { isMounted = false; };
  }, []);

  const getTypeLabel = (type: PointTransaction['type']) => {
    const labels: Record<string, string> = {
      signup_bonus: '가입 보너스',
      signup: '가입 보너스',
      purchase: '자료 구매',
      sale: '판매 수익',
      feedback_refund: '후기 작성 보상',
      admin_charge: '관리자 충전',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: PointTransaction['type']) => {
    const colors: Record<string, string> = {
      signup_bonus: 'text-blue-600',
      signup: 'text-blue-600',
      purchase: 'text-red-600',
      sale: 'text-secondary-600',
      feedback_refund: 'text-secondary-600',
      admin_charge: 'text-purple-600',
    };
    return colors[type] || 'text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton.Card className="h-32" />
        {[...Array(5)].map((_, i) => (
          <Skeleton.Card key={i} className="h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl p-6 text-white">
        <p className="text-primary-100 mb-1">보유 포인트</p>
        <p className="text-3xl font-bold">{formatPoints(user?.points || 0)}</p>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-medium text-gray-900">포인트 내역</h3>
        </div>
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            포인트 내역이 없습니다
          </div>
        ) : (
          <div className="divide-y">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {getTypeLabel(transaction.type)}
                  </p>
                  {transaction.description && (
                    <p className="text-sm text-gray-500">
                      {transaction.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(transaction.createdAt)}
                  </p>
                </div>
                <span className={`font-semibold ${getTypeColor(transaction.type)}`}>
                  {transaction.amount > 0 ? '+' : ''}
                  {formatPoints(transaction.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Main MyPage Component
export function MyPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <TabNav />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Routes>
          <Route index element={<DashboardPage />} />
          <Route path="purchases" element={<PurchasesPage />} />
          <Route path="worksheets" element={<MyWorksheetsPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="points" element={<PointsPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default MyPage;
