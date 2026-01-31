import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, ChevronDown, ShoppingCart, Star, Loader2, Sparkles, BookOpen } from 'lucide-react';
import { Button, Badge, Select, Skeleton } from '@/components/common';
import { useCartStore, useAuthStore } from '@/store';
import { useToast } from '@/components/common/Toast';
import { api, ApiError } from '@/services/api';
import {
  Worksheet,
  Grade,
  Subject,
  Category,
  GRADE_LABELS,
  SUBJECT_LABELS,
  CATEGORY_LABELS,
  formatPoints,
} from '@/types';

type SortOption = 'newest' | 'popular' | 'price_low' | 'price_high' | 'rating';

interface WorksheetFilters {
  grade?: Grade;
  subject?: Subject;
  category?: Category;
  minPrice?: number;
  maxPrice?: number;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: '최신순' },
  { value: 'popular', label: '인기순' },
  { value: 'price_low', label: '가격 낮은순' },
  { value: 'price_high', label: '가격 높은순' },
  { value: 'rating', label: '평점순' },
];

function WorksheetCard({ worksheet }: { worksheet: Worksheet }) {
  const { isAuthenticated } = useAuthStore();
  const { addItem, isInCart } = useCartStore();
  const toast = useToast();
  const [isAdding, setIsAdding] = useState(false);

  const inCart = isInCart(worksheet.id);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    if (inCart) {
      toast.info('이미 장바구니에 담긴 상품입니다.');
      return;
    }

    setIsAdding(true);
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
      setIsAdding(false);
    }
  };

  return (
    <Link
      to={`/worksheet/${worksheet.id}`}
      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden
                 shadow-sm hover:shadow-lg hover:shadow-primary-500/5 hover:border-primary-100
                 transition-all duration-300"
    >
      {/* Preview Image */}
      <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
        <img
          src={worksheet.previewImage}
          alt={worksheet.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge color="blue" size="sm">
            {GRADE_LABELS[worksheet.grade]}
          </Badge>
          <Badge color="purple" size="sm">
            {SUBJECT_LABELS[worksheet.subject]}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1.5 group-hover:text-primary-600 transition-colors leading-snug">
          {worksheet.title}
        </h3>

        <p className="text-sm text-muted-foreground mb-3">{worksheet.sellerNickname}</p>

        {/* Rating */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="flex items-center gap-0.5">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-sm font-semibold text-gray-900">
              {worksheet.averageRating.toFixed(1)}
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            ({worksheet.reviewCount})
          </span>
        </div>

        {/* Price & Cart */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
          <div>
            <span className="text-lg font-bold text-primary-600">
              {formatPoints(worksheet.price)}
            </span>
          </div>
          <Button
            size="icon"
            variant={inCart ? 'outline' : 'primary'}
            onClick={handleAddToCart}
            disabled={isAdding || inCart}
            className="w-9 h-9 rounded-xl"
          >
            {isAdding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </Link>
  );
}

function FilterPanel({
  filters,
  onFilterChange,
}: {
  filters: WorksheetFilters;
  onFilterChange: (filters: WorksheetFilters) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const gradeOptions = [
    { value: '', label: '전체 학년' },
    ...Object.entries(GRADE_LABELS).map(([value, label]) => ({ value, label })),
  ];

  const subjectOptions = [
    { value: '', label: '전체 과목' },
    ...Object.entries(SUBJECT_LABELS).map(([value, label]) => ({ value, label })),
  ];

  const categoryOptions = [
    { value: '', label: '전체 유형' },
    ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
  ];

  const priceRangeOptions = [
    { value: '', label: '전체 가격' },
    { value: '0-100', label: '100P 이하' },
    { value: '100-200', label: '100P ~ 200P' },
    { value: '200-300', label: '200P ~ 300P' },
    { value: '300-500', label: '300P ~ 500P' },
  ];

  const handlePriceChange = (value: string) => {
    if (!value) {
      onFilterChange({ ...filters, minPrice: undefined, maxPrice: undefined });
    } else {
      const [min, max] = value.split('-').map(Number);
      onFilterChange({ ...filters, minPrice: min, maxPrice: max });
    }
  };

  const getPriceValue = () => {
    if (filters.minPrice === undefined && filters.maxPrice === undefined) return '';
    return `${filters.minPrice || 0}-${filters.maxPrice || 500}`;
  };

  const activeFilterCount = [
    filters.grade,
    filters.subject,
    filters.category,
    filters.minPrice !== undefined || filters.maxPrice !== undefined,
  ].filter(Boolean).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden flex items-center justify-between w-full p-4"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-900">필터</span>
          {activeFilterCount > 0 && (
            <Badge color="primary" size="sm">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Filter Content */}
      <div className={`${isOpen ? 'block' : 'hidden'} lg:block p-4 lg:pt-4 space-y-4 border-t lg:border-t-0 border-gray-100`}>
        <div className="hidden lg:flex items-center gap-2 pb-3 border-b border-gray-100">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900 text-sm">필터</span>
        </div>

        <Select
          label="학년"
          options={gradeOptions}
          value={filters.grade || ''}
          onChange={(value: string) =>
            onFilterChange({
              ...filters,
              grade: value ? (value as Grade) : undefined,
            })
          }
        />

        <Select
          label="과목"
          options={subjectOptions}
          value={filters.subject || ''}
          onChange={(value: string) =>
            onFilterChange({
              ...filters,
              subject: value ? (value as Subject) : undefined,
            })
          }
        />

        <Select
          label="유형"
          options={categoryOptions}
          value={filters.category || ''}
          onChange={(value: string) =>
            onFilterChange({
              ...filters,
              category: value ? (value as Category) : undefined,
            })
          }
        />

        <Select
          label="가격대"
          options={priceRangeOptions}
          value={getPriceValue()}
          onChange={handlePriceChange}
        />

        {activeFilterCount > 0 && (
          <Button
            variant="outline"
            fullWidth
            size="sm"
            onClick={() =>
              onFilterChange({
                grade: undefined,
                subject: undefined,
                category: undefined,
                minPrice: undefined,
                maxPrice: undefined,
              })
            }
            className="mt-2"
          >
            필터 초기화
          </Button>
        )}
      </div>
    </div>
  );
}

export function HomePage() {
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [filters, setFilters] = useState<WorksheetFilters>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 12;

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const fetchWorksheets = useCallback(async (currentPage: number, currentSort: string, currentFilters: WorksheetFilters, currentSearch: string) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    console.log('[HomePage] fetchWorksheets called');
    setIsLoading(true);

    try {
      const result = await api.worksheets.list({
        page: currentPage,
        limit,
        sort: currentSort,
        search: currentSearch || undefined,
        ...currentFilters,
      });

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        console.log('[HomePage] API result:', result);
        setWorksheets(result.worksheets);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      }
    } catch (error) {
      console.error('[HomePage] Failed to fetch worksheets:', error);
      if (isMountedRef.current) {
        setWorksheets([]);
        setTotal(0);
        setTotalPages(0);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchWorksheets(page, sort, filters, searchQuery);

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [page, sort, filters, fetchWorksheets]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchWorksheets(1, sort, filters, searchQuery);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-500 to-primary-600 rounded-3xl p-6 sm:p-8 lg:p-10 mb-8 text-white">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary-500/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-primary-200" />
              <span className="text-sm font-medium text-primary-100">검증된 학습 자료</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">
              학습 자료를 찾아보세요
            </h1>
            <p className="text-primary-100 mb-6 max-w-lg">
              초등부터 고등까지, 현직 선생님의 엄선된 학습 자료
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative max-w-xl">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="원하는 워크시트를 검색해보세요..."
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/95 backdrop-blur text-gray-900 placeholder-gray-400
                         shadow-lg shadow-primary-900/10 border border-white/20
                         focus:ring-4 focus:ring-white/30 focus:outline-none transition-all"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </form>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filter Sidebar */}
          <aside className="lg:w-64 shrink-0">
            <FilterPanel filters={filters} onFilterChange={setFilters} />
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Sort & Results Count */}
            <div className="flex items-center justify-between mb-5 gap-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-gray-400" />
                <p className="text-gray-600">
                  총 <span className="font-semibold text-gray-900">{total}</span>개
                </p>
              </div>
              <Select
                options={SORT_OPTIONS}
                value={sort}
                onChange={(value: string) => setSort(value as SortOption)}
                className="w-36"
              />
            </div>

            {/* Worksheet Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {[...Array(6)].map((_, i) => (
                  <Skeleton.Card key={i} />
                ))}
              </div>
            ) : worksheets.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                  <Search className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  검색 결과가 없습니다
                </h3>
                <p className="text-gray-500 max-w-sm mx-auto">
                  다른 검색어나 필터를 시도해보세요
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {worksheets.map((worksheet) => (
                    <WorksheetCard key={worksheet.id} worksheet={worksheet} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center mt-10 gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      이전
                    </Button>
                    <div className="flex items-center gap-1">
                      {[...Array(totalPages)].map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setPage(i + 1)}
                          className={`min-w-[36px] h-9 px-2 rounded-lg text-sm font-medium transition-all ${
                            page === i + 1
                              ? 'bg-primary-500 text-white shadow-sm shadow-primary-500/25'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      다음
                    </Button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
