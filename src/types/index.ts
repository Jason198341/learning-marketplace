// === Grade Types ===
export type Grade =
  | 'elementary_1' | 'elementary_2' | 'elementary_3'
  | 'elementary_4' | 'elementary_5' | 'elementary_6'
  | 'middle_1' | 'middle_2' | 'middle_3'
  | 'high_1' | 'high_2' | 'high_3'
  | 'etc';

// === Subject Types ===
export type Subject =
  | 'korean' | 'math' | 'english' | 'science'
  | 'social' | 'art' | 'music' | 'etc';

// === Category Types ===
export type Category =
  | 'worksheet' | 'test' | 'activity' | 'template' | 'etc';

// === User Role ===
export type UserRole = 'user' | 'admin' | 'teacher' | 'parent';

// === Worksheet Status ===
export type WorksheetStatus = 'pending' | 'approved' | 'rejected';

// === Point Transaction Type ===
export type PointTransactionType =
  | 'signup_bonus'
  | 'signup'
  | 'purchase'
  | 'sale'
  | 'feedback_refund'
  | 'admin_charge';

// === Rating ===
export type Rating = 1 | 2 | 3 | 4 | 5;

// === User ===
export interface User {
  id: string;
  email: string;
  nickname: string;
  passwordHash: string;
  role: UserRole;
  points: number;
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
}

// Public user info (no sensitive data)
export interface PublicUser {
  id: string;
  nickname: string;
  profileImage?: string;
}

// === Worksheet ===
export interface Worksheet {
  id: string;
  sellerId: string;
  sellerNickname: string;
  title: string;
  description: string;
  price: number; // 100-500
  category: string;
  grade: string;
  subject: string;
  tags: string[];
  fileUrl: string;
  previewImage: string; // Main preview image
  previewImages: string[];
  pageCount: number;
  downloadCount: number;
  salesCount: number;
  averageRating: number;
  reviewCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Worksheet card for list display
export interface WorksheetCard {
  id: string;
  title: string;
  price: number;
  sellerNickname: string;
  previewImage: string;
  downloadCount: number;
  averageRating: number;
  reviewCount: number;
  grade: string;
  subject: string;
  category: string;
}

// === Cart Item ===
export interface CartItem {
  id: string;
  userId: string;
  worksheetId: string;
  worksheet: WorksheetCard | null;
  addedAt: string;
}

// === Purchase ===
export interface Purchase {
  id: string;
  buyerId: string;
  worksheetId: string;
  worksheet: WorksheetCard | null;
  price: number;
  pointsSpent: number;
  pointsRefunded: number;
  feedbackGiven: boolean;
  hasFeedback: boolean;
  purchasedAt: string;
}

// === Feedback ===
export interface Feedback {
  id: string;
  purchaseId: string;
  worksheetId: string;
  buyerId: string;
  buyerNickname: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

// === Point Transaction ===
export interface PointTransaction {
  id: string;
  userId: string;
  type: string; // PointTransactionType
  amount: number; // positive for credit, negative for debit
  balance: number;
  relatedId?: string | null;
  description: string;
  createdAt: string;
}

// === API Response Types ===
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
}

export interface WorksheetsResponse {
  worksheets: WorksheetCard[];
  pagination: PaginationInfo;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>;
  token: string;
}

export interface CartResponse {
  items: CartItem[];
  summary: {
    totalItems: number;
    totalPrice: number;
  };
}

export interface PurchaseResponse {
  purchaseIds: string[];
  totalSpent: number;
  newBalance: number;
  downloads: Array<{
    worksheetId: string;
    title: string;
    downloadUrl: string;
  }>;
}

export interface FeedbackResponse {
  feedback: Feedback;
  pointsRefunded: number;
  newBalance: number;
}

// === Filter Types ===
export type SortOption = 'popular' | 'latest' | 'rating' | 'price_low' | 'price_high';

export interface WorksheetFilters {
  grade?: Grade;
  subject?: Subject;
  category?: Category;
  minPrice?: number;
  maxPrice?: number;
  sort?: SortOption;
  search?: string;
  page?: number;
  limit?: number;
}

// === Form Types ===
export interface SignupForm {
  email: string;
  password: string;
  confirmPassword: string;
  nickname: string;
  role?: 'teacher' | 'parent';
  agreeTerms: boolean;
}

export interface LoginForm {
  email: string;
  password: string;
}

export interface FeedbackForm {
  purchaseId?: string;
  worksheetId?: string;
  rating: number; // 1-5
  comment: string;
}

export interface WorksheetUploadForm {
  title: string;
  description: string;
  price: number;
  category: Category;
  grade: Grade;
  subject: Subject;
  tags: string[];
  file: File | null;
  previewImages: File[];
}

// === Constants ===
export const GRADES: { value: Grade; label: string }[] = [
  { value: 'elementary_1', label: '초등 1학년' },
  { value: 'elementary_2', label: '초등 2학년' },
  { value: 'elementary_3', label: '초등 3학년' },
  { value: 'elementary_4', label: '초등 4학년' },
  { value: 'elementary_5', label: '초등 5학년' },
  { value: 'elementary_6', label: '초등 6학년' },
  { value: 'middle_1', label: '중등 1학년' },
  { value: 'middle_2', label: '중등 2학년' },
  { value: 'middle_3', label: '중등 3학년' },
  { value: 'high_1', label: '고등 1학년' },
  { value: 'high_2', label: '고등 2학년' },
  { value: 'high_3', label: '고등 3학년' },
  { value: 'etc', label: '기타' },
];

export const SUBJECTS: { value: Subject; label: string }[] = [
  { value: 'korean', label: '국어' },
  { value: 'math', label: '수학' },
  { value: 'english', label: '영어' },
  { value: 'science', label: '과학' },
  { value: 'social', label: '사회' },
  { value: 'art', label: '미술' },
  { value: 'music', label: '음악' },
  { value: 'etc', label: '기타' },
];

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'worksheet', label: '워크시트' },
  { value: 'test', label: '시험지' },
  { value: 'activity', label: '활동지' },
  { value: 'template', label: '템플릿' },
  { value: 'etc', label: '기타' },
];

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'popular', label: '인기순' },
  { value: 'latest', label: '최신순' },
  { value: 'rating', label: '평점순' },
  { value: 'price_low', label: '가격 낮은순' },
  { value: 'price_high', label: '가격 높은순' },
];

// === Label Maps (for easy lookup) ===
export const GRADE_LABELS: Record<string, string> = {
  elementary_1: '초등 1학년',
  elementary_2: '초등 2학년',
  elementary_3: '초등 3학년',
  elementary_4: '초등 4학년',
  elementary_5: '초등 5학년',
  elementary_6: '초등 6학년',
  middle_1: '중등 1학년',
  middle_2: '중등 2학년',
  middle_3: '중등 3학년',
  high_1: '고등 1학년',
  high_2: '고등 2학년',
  high_3: '고등 3학년',
  etc: '기타',
};

export const SUBJECT_LABELS: Record<string, string> = {
  korean: '국어',
  math: '수학',
  english: '영어',
  science: '과학',
  social: '사회',
  art: '미술',
  music: '음악',
  etc: '기타',
};

export const CATEGORY_LABELS: Record<string, string> = {
  worksheet: '워크시트',
  test: '시험지',
  activity: '활동지',
  template: '템플릿',
  etc: '기타',
};

// === Helper functions ===
export function getGradeLabel(grade: Grade): string {
  return GRADE_LABELS[grade] ?? grade;
}

export function getSubjectLabel(subject: Subject): string {
  return SUBJECT_LABELS[subject] ?? subject;
}

export function getCategoryLabel(category: Category): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function formatPoints(points: number): string {
  return `${points.toLocaleString()}P`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;

  return formatDate(dateString);
}
