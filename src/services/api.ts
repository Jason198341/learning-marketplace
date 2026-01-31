import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

// Re-use types from database.ts
type WorksheetCardRow = Database['public']['Views']['worksheet_cards']['Row'];
type ProfilesUpdate = Database['public']['Tables']['profiles']['Update'];
type WorksheetsInsert = Database['public']['Tables']['worksheets']['Insert'];
type WorksheetsUpdate = Database['public']['Tables']['worksheets']['Update'];
type CartItemsInsert = Database['public']['Tables']['cart_items']['Insert'];

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Utility: Escape special characters for LIKE/ILIKE queries
function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, '\\$&');
}

// Utility: Validate price range
function validatePrice(price: number): void {
  if (price < 100 || price > 500) {
    throw new ApiError('가격은 100~500 포인트 사이여야 합니다.', 400, 'INVALID_PRICE');
  }
}

// Utility: Validate rating range
function validateRating(rating: number): void {
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new ApiError('평점은 1~5 사이의 정수여야 합니다.', 400, 'INVALID_RATING');
  }
}

// Utility: Sanitize error message for client
function sanitizeErrorMessage(error: { message?: string; code?: string }): string {
  // Don't expose internal database errors to client
  const safeMessages: Record<string, string> = {
    '23505': '이미 존재하는 데이터입니다.',
    '23503': '참조하는 데이터가 존재하지 않습니다.',
    '42501': '권한이 없습니다.',
    'PGRST116': '데이터를 찾을 수 없습니다.',
  };

  if (error.code && safeMessages[error.code]) {
    return safeMessages[error.code];
  }

  // Return generic message for unknown errors in production
  if (import.meta.env.PROD && error.message?.includes('violates')) {
    return '요청을 처리할 수 없습니다.';
  }

  return error.message || '알 수 없는 오류가 발생했습니다.';
}


// API methods
export const api = {
  // Auth
  auth: {
    signup: async (data: { email: string; password: string; nickname: string; role?: string }) => {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            nickname: data.nickname,
            role: data.role || 'teacher',
          },
        },
      });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 400, error.code);
      if (!authData.user) throw new ApiError('회원가입에 실패했습니다.', 500);

      // Wait for profile to be created by trigger with retry logic
      let profile = null;
      const maxRetries = 5;
      const retryDelay = 200;

      for (let i = 0; i < maxRetries; i++) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (profileData) {
          profile = profileData;
          break;
        }

        if (profileError && profileError.code !== 'PGRST116') {
          throw new ApiError(sanitizeErrorMessage(profileError), 500, profileError.code);
        }
      }

      if (!profile) {
        throw new ApiError('프로필 생성 중 오류가 발생했습니다. 다시 시도해주세요.', 500, 'PROFILE_CREATION_TIMEOUT');
      }

      return {
        user: profile,
        token: authData.session?.access_token || '',
      };
    },

    login: async (email: string, password: string) => {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 401, error.code);
      if (!authData.user) throw new ApiError('로그인에 실패했습니다.', 401);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) throw new ApiError(sanitizeErrorMessage(profileError), 500, profileError.code);

      return {
        user: profile,
        token: authData.session?.access_token || '',
      };
    },

    logout: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return { success: true };
    },

    me: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return profile;
    },

    updateNickname: async (nickname: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // Validate nickname
      const trimmedNickname = nickname.trim();
      if (trimmedNickname.length < 2 || trimmedNickname.length > 20) {
        throw new ApiError('닉네임은 2~20자 사이여야 합니다.', 400, 'INVALID_NICKNAME');
      }

      // Check for forbidden characters
      if (!/^[가-힣a-zA-Z0-9_]+$/.test(trimmedNickname)) {
        throw new ApiError('닉네임은 한글, 영문, 숫자, 밑줄만 사용 가능합니다.', 400, 'INVALID_NICKNAME_CHARS');
      }

      const updateData: ProfilesUpdate = {
        nickname: trimmedNickname,
        updated_at: new Date().toISOString(),
      };

      // Note: Type assertion needed due to Supabase client generic typing limitations
      // Runtime validation is performed above (nickname length, format checks)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('profiles') as any)
        .update(updateData)
        .eq('id', user.id);

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return { nickname: trimmedNickname };
    },

    getSession: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    },

    onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
      return supabase.auth.onAuthStateChange(callback);
    },
  },

  // Worksheets
  worksheets: {
    list: async (params?: {
      page?: number;
      limit?: number;
      sort?: string;
      search?: string;
      grade?: string;
      subject?: string;
      category?: string;
      minPrice?: number;
      maxPrice?: number;
    }) => {
      const page = params?.page || 1;
      const limit = params?.limit || 12;
      const offset = (page - 1) * limit;

      // Note: Temporarily removed { count: 'exact' } to debug hanging query
      let query = supabase
        .from('worksheet_cards')
        .select('*')
        .eq('status', 'approved');

      // Apply filters (escape special characters to prevent SQL injection)
      if (params?.search) {
        const safeSearch = escapeLikePattern(params.search);
        query = query.or(`title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
      }
      if (params?.grade) {
        query = query.eq('grade', params.grade);
      }
      if (params?.subject) {
        query = query.eq('subject', params.subject);
      }
      if (params?.category) {
        query = query.eq('category', params.category);
      }
      if (params?.minPrice !== undefined) {
        query = query.gte('price', params.minPrice);
      }
      if (params?.maxPrice !== undefined) {
        query = query.lte('price', params.maxPrice);
      }

      // Apply sorting
      switch (params?.sort) {
        case 'popular':
          query = query.order('sales_count', { ascending: false });
          break;
        case 'price_low':
          query = query.order('price', { ascending: true });
          break;
        case 'price_high':
          query = query.order('price', { ascending: false });
          break;
        case 'rating':
          query = query.order('average_rating', { ascending: false });
          break;
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      // Debug: Log query start time
      console.log('[api.worksheets.list] Starting query at:', new Date().toISOString());
      console.log('[api.worksheets.list] Query params:', { page, limit, offset, sort: params?.sort, search: params?.search });

      let data, error, count;
      try {
        const result = await query;
        data = result.data;
        error = result.error;
        count = result.count;
        console.log('[api.worksheets.list] Query completed successfully');
      } catch (queryError) {
        console.error('[api.worksheets.list] Query threw exception:', queryError);
        throw new ApiError('쿼리 실행 중 오류가 발생했습니다.', 500);
      }

      // Debug log
      console.log('[api.worksheets.list] Response received at:', new Date().toISOString());
      console.log('[api.worksheets.list] Response:', { data, error, count });

      if (error) {
        console.error('[api.worksheets.list] Error:', error);
        throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      }

      // Transform to match expected format
      const worksheets = ((data || []) as WorksheetCardRow[]).map(w => ({
        id: w.id,
        sellerId: w.seller_id,
        sellerNickname: w.seller_nickname,
        title: w.title,
        description: w.description,
        price: w.price,
        grade: w.grade,
        subject: w.subject,
        category: w.category,
        tags: w.tags,
        fileUrl: w.file_url,
        previewImage: w.preview_image,
        previewImages: [w.preview_image],
        pageCount: w.page_count,
        downloadCount: w.download_count,
        salesCount: w.sales_count,
        averageRating: Number(w.average_rating),
        reviewCount: w.review_count,
        status: w.status,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
      }));

      // Note: count is null because we removed { count: 'exact' } - using data length as fallback
      const total = count ?? worksheets.length;
      return {
        worksheets,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        page,
      };
    },

    get: async (id: string) => {
      const { data, error } = await supabase
        .from('worksheet_cards')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) throw new ApiError('워크시트를 찾을 수 없습니다.', 404);

      const w = data as WorksheetCardRow;

      return {
        id: w.id,
        sellerId: w.seller_id,
        sellerNickname: w.seller_nickname,
        title: w.title,
        description: w.description,
        price: w.price,
        grade: w.grade,
        subject: w.subject,
        category: w.category,
        tags: w.tags,
        fileUrl: w.file_url,
        previewImage: w.preview_image,
        previewImages: [w.preview_image],
        pageCount: w.page_count,
        downloadCount: w.download_count,
        salesCount: w.sales_count,
        averageRating: Number(w.average_rating),
        reviewCount: w.review_count,
        status: w.status,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
      };
    },

    create: async (data: {
      title: string;
      description: string;
      price: number;
      category: string;
      grade: string;
      subject: string;
      pageCount?: number;
      fileUrl?: string;
      previewImage?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // Validate price range
      validatePrice(data.price);

      // Validate title length
      if (!data.title || data.title.trim().length < 2 || data.title.length > 100) {
        throw new ApiError('제목은 2~100자 사이여야 합니다.', 400, 'INVALID_TITLE');
      }

      // Validate description length
      if (!data.description || data.description.trim().length < 10) {
        throw new ApiError('설명은 최소 10자 이상이어야 합니다.', 400, 'INVALID_DESCRIPTION');
      }

      const insertData: WorksheetsInsert = {
        seller_id: user.id,
        title: data.title.trim(),
        description: data.description.trim(),
        price: data.price,
        grade: data.grade,
        subject: data.subject,
        category: data.category,
        page_count: data.pageCount || 1,
        file_url: data.fileUrl || '',
        preview_image: data.previewImage || '',
        status: 'approved', // Auto-approve for demo
      };

      // Note: Type assertion needed due to Supabase client generic typing limitations
      // Runtime validation is performed above (price, title, description checks)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: worksheet, error } = await (supabase.from('worksheets') as any)
        .insert(insertData)
        .select()
        .single();

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return worksheet as { id: string };
    },

    update: async (id: string, data: Partial<{
      title: string;
      description: string;
      price: number;
      fileUrl: string;
      previewImage: string;
    }>, changeComment?: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // Verify ownership
      const { data: existing } = await supabase
        .from('worksheets')
        .select('seller_id, title, description, price, file_url, preview_image')
        .eq('id', id)
        .maybeSingle();

      if (!existing) throw new ApiError('워크시트를 찾을 수 없습니다.', 404);

      const existingData = existing as {
        seller_id: string;
        title: string;
        description: string;
        price: number;
        file_url: string;
        preview_image: string;
      };
      if (existingData.seller_id !== user.id) {
        throw new ApiError('수정 권한이 없습니다.', 403);
      }

      // Validate price if provided
      if (data.price !== undefined) {
        validatePrice(data.price);
      }

      // Validate title if provided
      if (data.title !== undefined && (data.title.trim().length < 2 || data.title.length > 100)) {
        throw new ApiError('제목은 2~100자 사이여야 합니다.', 400, 'INVALID_TITLE');
      }

      // Validate description if provided
      if (data.description !== undefined && data.description.trim().length < 10) {
        throw new ApiError('설명은 최소 10자 이상이어야 합니다.', 400, 'INVALID_DESCRIPTION');
      }

      // Build change log entry
      const changes: string[] = [];
      if (data.title && data.title !== existingData.title) {
        changes.push(`제목: "${existingData.title}" → "${data.title}"`);
      }
      if (data.description && data.description !== existingData.description) {
        changes.push('설명 변경');
      }
      if (data.price !== undefined && data.price !== existingData.price) {
        changes.push(`가격: ${existingData.price}P → ${data.price}P`);
      }
      if (data.fileUrl && data.fileUrl !== existingData.file_url) {
        changes.push('워크시트 파일 변경');
      }
      if (data.previewImage && data.previewImage !== existingData.preview_image) {
        changes.push('미리보기 이미지 변경');
      }

      // Build update data with snake_case keys for database
      const updateData: WorksheetsUpdate = {
        updated_at: new Date().toISOString(),
      };
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.price !== undefined) updateData.price = data.price;
      if (data.fileUrl !== undefined) updateData.file_url = data.fileUrl;
      if (data.previewImage !== undefined) updateData.preview_image = data.previewImage;

      // Note: Type assertion needed due to Supabase client generic typing limitations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: worksheet, error } = await (supabase.from('worksheets') as any)
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);

      // Record edit history if there are changes
      if (changes.length > 0) {
        const historyEntry = {
          worksheet_id: id,
          user_id: user.id,
          changes: changes.join(', '),
          comment: changeComment || '',
          created_at: new Date().toISOString(),
        };

        // Try to insert edit history (table may not exist yet)
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('worksheet_edit_history') as any).insert(historyEntry);
        } catch {
          // Table may not exist, just log for now
          console.log('Edit history:', historyEntry);
        }
      }

      return worksheet;
    },

    // Delete is disabled - buyers need to be able to re-download
    delete: async (_id: string) => {
      throw new ApiError('워크시트 삭제는 구매자 보호를 위해 비활성화되어 있습니다.', 403, 'DELETE_DISABLED');
    },

    // Get edit history for a worksheet
    getEditHistory: async (worksheetId: string) => {
      const { data, error } = await supabase
        .from('worksheet_edit_history')
        .select('*, editor:profiles!worksheet_edit_history_user_id_fkey(nickname)')
        .eq('worksheet_id', worksheetId)
        .order('created_at', { ascending: false });

      if (error) {
        // Table might not exist yet
        console.warn('Edit history fetch failed:', error);
        return [];
      }

      type EditHistoryRow = {
        id: string;
        worksheet_id: string;
        user_id: string;
        changes: string;
        comment: string;
        is_notified: boolean;
        notified_at: string | null;
        notified_count: number;
        created_at: string;
        editor: { nickname: string } | null;
      };

      return ((data || []) as EditHistoryRow[]).map(h => ({
        id: h.id,
        worksheetId: h.worksheet_id,
        userId: h.user_id,
        editorNickname: h.editor?.nickname || '알 수 없음',
        changes: h.changes,
        comment: h.comment,
        isNotified: h.is_notified,
        notifiedAt: h.notified_at,
        notifiedCount: h.notified_count,
        createdAt: h.created_at,
      }));
    },

    // Send notification to buyers for an edit history entry
    sendEditNotification: async (editHistoryId: string) => {
      const { data, error } = await (supabase as any).rpc('send_edit_notification', {
        p_edit_history_id: editHistoryId,
      });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 400, error.code);
      return data as { success: boolean; notifiedCount: number };
    },
  },

  // Notifications
  notifications: {
    // Get user's notifications
    list: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.warn('Notifications fetch failed:', error);
        return [];
      }

      type NotificationRow = {
        id: string;
        user_id: string;
        type: string;
        title: string;
        message: string;
        worksheet_id: string | null;
        edit_history_id: string | null;
        is_read: boolean;
        created_at: string;
      };

      return ((data || []) as NotificationRow[]).map(n => ({
        id: n.id,
        userId: n.user_id,
        type: n.type,
        title: n.title,
        message: n.message,
        worksheetId: n.worksheet_id,
        editHistoryId: n.edit_history_id,
        isRead: n.is_read,
        createdAt: n.created_at,
      }));
    },

    // Get unread count
    getUnreadCount: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) return 0;
      return count || 0;
    },

    // Mark notification as read
    markAsRead: async (notificationId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('notifications') as any)
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return { success: true };
    },

    // Mark all as read
    markAllAsRead: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('notifications') as any)
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return { success: true };
    },

    // Delete notification
    delete: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return { success: true };
    },
  },

  // Cart
  cart: {
    get: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          worksheet_id,
          created_at,
          worksheets (
            id,
            title,
            price,
            preview_image,
            download_count,
            average_rating,
            review_count,
            grade,
            subject,
            category,
            seller_id
          )
        `)
        .eq('user_id', user.id);

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);

      type CartItemResult = {
        id: string;
        worksheet_id: string;
        created_at: string;
        worksheets: {
          id: string;
          title: string;
          price: number;
          preview_image: string;
          download_count: number;
          average_rating: number;
          review_count: number;
          grade: string;
          subject: string;
          category: string;
          seller_id: string;
        } | null;
      };

      const items = ((data || []) as CartItemResult[]).map(item => {
        const ws = item.worksheets;
        return {
          id: item.id,
          userId: user.id,
          worksheetId: item.worksheet_id,
          addedAt: item.created_at,
          worksheet: ws ? {
            id: ws.id,
            title: ws.title,
            price: ws.price,
            sellerNickname: '', // Will be filled from profiles if needed
            previewImage: ws.preview_image,
            downloadCount: ws.download_count,
            averageRating: Number(ws.average_rating),
            reviewCount: ws.review_count,
            grade: ws.grade,
            subject: ws.subject,
            category: ws.category,
          } : null,
        };
      });

      return { items };
    },

    add: async (worksheetId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // Check if already in cart
      const { data: existing } = await supabase
        .from('cart_items')
        .select('id')
        .eq('user_id', user.id)
        .eq('worksheet_id', worksheetId)
        .maybeSingle();

      if (existing) throw new ApiError('이미 장바구니에 있습니다.');

      // Check if already purchased
      const { data: purchased } = await supabase
        .from('purchases')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('worksheet_id', worksheetId)
        .maybeSingle();

      if (purchased) throw new ApiError('이미 구매한 자료입니다.', 400, 'ALREADY_PURCHASED');

      // Check if trying to buy own worksheet
      const { data: worksheetData } = await supabase
        .from('worksheets')
        .select('seller_id')
        .eq('id', worksheetId)
        .maybeSingle();

      const worksheetSellerId = (worksheetData as { seller_id: string } | null)?.seller_id;
      if (worksheetSellerId && worksheetSellerId === user.id) {
        throw new ApiError('본인의 자료는 구매할 수 없습니다.', 400, 'CANNOT_BUY_OWN');
      }

      const insertData: CartItemsInsert = {
        user_id: user.id,
        worksheet_id: worksheetId,
      };

      // Note: Type assertion needed due to Supabase client generic typing limitations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('cart_items') as any)
        .insert(insertData)
        .select(`
          id,
          worksheet_id,
          created_at,
          worksheets (
            id,
            title,
            price,
            preview_image,
            download_count,
            average_rating,
            review_count,
            grade,
            subject,
            category
          )
        `)
        .single();

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);

      type CartItemResult = {
        id: string;
        worksheet_id: string;
        created_at: string;
        worksheets: {
          id: string;
          title: string;
          price: number;
          preview_image: string;
          download_count: number;
          average_rating: number;
          review_count: number;
          grade: string;
          subject: string;
          category: string;
        } | null;
      };

      const item = data as CartItemResult;
      const ws = item.worksheets;

      return {
        id: item.id,
        userId: user.id,
        worksheetId: item.worksheet_id,
        addedAt: item.created_at,
        worksheet: ws ? {
          id: ws.id,
          title: ws.title,
          price: ws.price,
          sellerNickname: '',
          previewImage: ws.preview_image,
          downloadCount: ws.download_count,
          averageRating: Number(ws.average_rating),
          reviewCount: ws.review_count,
          grade: ws.grade,
          subject: ws.subject,
          category: ws.category,
        } : null,
      };
    },

    remove: async (worksheetId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id)
        .eq('worksheet_id', worksheetId);

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return { success: true };
    },

    clear: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return { success: true };
    },
  },

  // Purchases
  purchases: {
    list: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      const { data, error } = await supabase
        .from('purchases')
        .select(`
          id,
          worksheet_id,
          price,
          has_feedback,
          created_at,
          worksheets (
            id,
            title,
            price,
            preview_image,
            download_count,
            average_rating,
            review_count,
            grade,
            subject,
            category
          )
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);

      type PurchaseResult = {
        id: string;
        worksheet_id: string;
        price: number;
        has_feedback: boolean;
        created_at: string;
        worksheets: {
          id: string;
          title: string;
          price: number;
          preview_image: string;
          download_count: number;
          average_rating: number;
          review_count: number;
          grade: string;
          subject: string;
          category: string;
        } | null;
      };

      return ((data || []) as PurchaseResult[]).map(p => {
        const ws = p.worksheets;
        return {
          id: p.id,
          buyerId: user.id,
          worksheetId: p.worksheet_id,
          price: p.price,
          pointsSpent: p.price,
          pointsRefunded: p.has_feedback ? 30 : 0,
          feedbackGiven: p.has_feedback,
          hasFeedback: p.has_feedback,
          purchasedAt: p.created_at,
          worksheet: ws ? {
            id: ws.id,
            title: ws.title,
            price: ws.price,
            sellerNickname: '',
            previewImage: ws.preview_image,
            downloadCount: ws.download_count,
            averageRating: Number(ws.average_rating),
            reviewCount: ws.review_count,
            grade: ws.grade,
            subject: ws.subject,
            category: ws.category,
          } : null,
        };
      });
    },

    create: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // Note: Type assertion needed due to Supabase client generic typing limitations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('purchase_worksheets', {
        p_user_id: user.id,
      });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 400, error.code);

      const result = data as {
        success: boolean;
        totalSpent: number;
        newBalance: number;
        purchases: Array<{ worksheetId: string; title: string; price: number }>;
      };

      return {
        purchaseIds: result.purchases.map(p => p.worksheetId),
        totalSpent: result.totalSpent,
        newBalance: result.newBalance,
        downloads: result.purchases.map(p => ({
          worksheetId: p.worksheetId,
          title: p.title,
          downloadUrl: '#', // URL would come from storage
        })),
      };
    },

    download: async (worksheetId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // Check if purchased OR owner
      const { data: worksheet } = await supabase
        .from('worksheets')
        .select('file_url, seller_id')
        .eq('id', worksheetId)
        .maybeSingle();

      if (!worksheet) throw new ApiError('워크시트를 찾을 수 없습니다.', 404);

      const worksheetData = worksheet as { file_url: string; seller_id: string };
      const isOwner = worksheetData.seller_id === user.id;

      // If not owner, check if purchased
      if (!isOwner) {
        const { data: purchase } = await supabase
          .from('purchases')
          .select('id')
          .eq('buyer_id', user.id)
          .eq('worksheet_id', worksheetId)
          .maybeSingle();

        if (!purchase) throw new ApiError('구매 내역이 없습니다.', 403);
      }

      const fileUrl = worksheetData.file_url;

      // If the file_url is a Supabase storage path (not a full URL), generate signed URL
      if (fileUrl && !fileUrl.startsWith('http')) {
        const signedUrl = await api.storage.getWorksheetUrl(fileUrl);
        return { downloadUrl: signedUrl };
      }

      // Otherwise return the URL directly (for external URLs)
      return { downloadUrl: fileUrl };
    },

    check: async (worksheetId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { purchased: false, hasFeedback: false };

      const { data: purchase } = await supabase
        .from('purchases')
        .select('id, has_feedback')
        .eq('buyer_id', user.id)
        .eq('worksheet_id', worksheetId)
        .maybeSingle();

      return {
        purchased: !!purchase,
        hasFeedback: (purchase as { has_feedback?: boolean } | null)?.has_feedback || false,
      };
    },
  },

  // Feedbacks
  feedbacks: {
    create: async (data: { worksheetId?: string; rating: number; comment: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      if (!data.worksheetId) throw new ApiError('워크시트 ID가 필요합니다.', 400, 'MISSING_WORKSHEET_ID');

      // Validate rating
      validateRating(data.rating);

      // Validate comment
      if (!data.comment || data.comment.trim().length < 5) {
        throw new ApiError('후기는 최소 5자 이상이어야 합니다.', 400, 'INVALID_COMMENT');
      }

      if (data.comment.length > 1000) {
        throw new ApiError('후기는 1000자를 초과할 수 없습니다.', 400, 'COMMENT_TOO_LONG');
      }

      // Note: Type assertion needed due to Supabase client generic typing limitations
      // Runtime validation is performed above (rating, comment checks)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: result, error } = await (supabase as any).rpc('submit_feedback', {
        p_user_id: user.id,
        p_worksheet_id: data.worksheetId,
        p_rating: data.rating,
        p_comment: data.comment.trim(),
      });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 400, error.code);

      const res = result as {
        success: boolean;
        feedbackId: string;
        pointsRefunded: number;
        newBalance: number;
      };

      // Get the created feedback with buyer info
      const { data: feedback } = await supabase
        .from('feedbacks')
        .select('*, buyer:profiles!feedbacks_buyer_id_fkey(nickname)')
        .eq('id', res.feedbackId)
        .single();

      type FeedbackWithBuyer = {
        id: string;
        purchase_id: string;
        created_at: string;
        buyer: { nickname: string } | null;
      };

      const fb = feedback as FeedbackWithBuyer | null;

      return {
        feedback: {
          id: fb?.id || res.feedbackId,
          purchaseId: fb?.purchase_id || '',
          worksheetId: data.worksheetId,
          buyerId: user.id,
          buyerNickname: fb?.buyer?.nickname || '',
          rating: data.rating,
          comment: data.comment,
          createdAt: fb?.created_at || new Date().toISOString(),
        },
        pointsRefunded: res.pointsRefunded,
        newBalance: res.newBalance,
      };
    },

    getByWorksheet: async (worksheetId: string) => {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*, buyer:profiles!feedbacks_buyer_id_fkey(nickname)')
        .eq('worksheet_id', worksheetId)
        .order('created_at', { ascending: false });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);

      type FeedbackRow = {
        id: string;
        purchase_id: string;
        worksheet_id: string;
        buyer_id: string;
        rating: number;
        comment: string;
        created_at: string;
        buyer: { nickname: string } | null;
      };

      return ((data || []) as FeedbackRow[]).map(f => ({
        id: f.id,
        purchaseId: f.purchase_id,
        worksheetId: f.worksheet_id,
        buyerId: f.buyer_id,
        buyerNickname: f.buyer?.nickname || '',
        rating: f.rating,
        comment: f.comment,
        createdAt: f.created_at,
      }));
    },

    getMy: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      const { data, error } = await supabase
        .from('feedbacks')
        .select('*')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return data || [];
    },
  },

  // Points
  points: {
    getBalance: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('points')
        .eq('id', user.id)
        .single();

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return { balance: (profile as { points: number } | null)?.points || 0 };
    },

    getTransactions: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      const { data, error } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);

      type TransactionRow = {
        id: string;
        user_id: string;
        type: string;
        amount: number;
        balance: number;
        description: string;
        related_id: string | null;
        created_at: string;
      };

      return ((data || []) as TransactionRow[]).map(t => ({
        id: t.id,
        userId: t.user_id,
        type: t.type,
        amount: t.amount,
        balance: t.balance,
        description: t.description,
        relatedId: t.related_id,
        createdAt: t.created_at,
      }));
    },
  },

  // My page
  my: {
    worksheets: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      const { data, error } = await supabase
        .from('worksheet_cards')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);

      return ((data || []) as WorksheetCardRow[]).map(w => ({
        id: w.id,
        sellerId: w.seller_id,
        sellerNickname: w.seller_nickname,
        title: w.title,
        description: w.description,
        price: w.price,
        grade: w.grade,
        subject: w.subject,
        category: w.category,
        tags: w.tags,
        fileUrl: w.file_url,
        previewImage: w.preview_image,
        previewImages: [w.preview_image],
        pageCount: w.page_count,
        downloadCount: w.download_count,
        salesCount: w.sales_count,
        averageRating: Number(w.average_rating),
        reviewCount: w.review_count,
        status: w.status,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
      }));
    },

    sales: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // Get worksheets with their sales
      const { data: worksheets, error } = await supabase
        .from('worksheets')
        .select('id, title, sales_count, price')
        .eq('seller_id', user.id);

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);

      type WorksheetSalesRow = {
        id: string;
        title: string;
        sales_count: number;
        price: number;
      };

      const worksheetStats = ((worksheets || []) as WorksheetSalesRow[]).map(w => ({
        worksheetId: w.id,
        title: w.title,
        salesCount: w.sales_count,
        earnings: w.sales_count * w.price,
      }));

      const totalSales = worksheetStats.reduce((sum, w) => sum + w.salesCount, 0);
      const totalEarnings = worksheetStats.reduce((sum, w) => sum + w.earnings, 0);

      return {
        totalSales,
        totalEarnings,
        worksheets: worksheetStats,
      };
    },

    summary: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('points')
        .eq('id', user.id)
        .single();

      // Get worksheet count
      const { count: worksheetCount } = await supabase
        .from('worksheets')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', user.id);

      // Get purchase count
      const { count: purchaseCount } = await supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_id', user.id);

      // Get sales stats
      const { data: worksheets } = await supabase
        .from('worksheets')
        .select('sales_count, price')
        .eq('seller_id', user.id);

      type WorksheetStatsRow = {
        sales_count: number;
        price: number;
      };

      const worksheetData = (worksheets || []) as WorksheetStatsRow[];
      const totalSales = worksheetData.reduce((sum, w) => sum + w.sales_count, 0);
      const totalEarnings = worksheetData.reduce((sum, w) => sum + w.sales_count * w.price, 0);

      return {
        points: (profile as { points: number } | null)?.points || 0,
        purchaseCount: purchaseCount || 0,
        worksheetCount: worksheetCount || 0,
        totalSales,
        totalEarnings,
      };
    },
  },

  // Storage
  storage: {
    // Allowed file types and size limits
    // PDF, Word, PowerPoint 문서 허용
    _allowedWorksheetTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    _allowedWorksheetExtensions: ['.pdf', '.doc', '.docx', '.ppt', '.pptx'],
    _allowedPreviewTypes: ['image/jpeg', 'image/png', 'image/webp'],
    _allowedPreviewExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    _maxWorksheetSize: 50 * 1024 * 1024, // 50MB
    _maxPreviewSize: 5 * 1024 * 1024, // 5MB

    // Validate filename - allow Korean, English, numbers, underscore, hyphen
    _validateFileName: (filename: string): boolean => {
      const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
      const validPattern = /^[가-힣a-zA-Z0-9_\- ]+$/;
      return validPattern.test(nameWithoutExt);
    },

    // Format datetime as YYYYMMDD_HHmmss
    _formatDateTime: (): string => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const sec = String(now.getSeconds()).padStart(2, '0');
      return `${year}${month}${day}_${hour}${min}${sec}`;
    },

    // Sanitize text for storage path - only ASCII allowed (Supabase limitation)
    _sanitizeText: (text: string): string => {
      return text
        .replace(/[^a-zA-Z0-9\s_-]/g, '') // Remove non-ASCII characters including Korean
        .replace(/\s+/g, '_')
        .trim()
        .slice(0, 30) || 'file'; // Fallback if all characters removed
    },

    // Generate worksheet filename
    // Format: 학년_과목_유형_페이지수p_아이디_올린시각.확장자
    // Note: 제목은 한글이 포함될 수 있어 Supabase Storage에서 지원 안 되므로 제외
    _generateWorksheetFileName: (
      originalFilename: string,
      metadata: {
        grade: string;
        subject: string;
        category: string;
        pageCount: number;
        userId: string;
      }
    ): string => {
      const lastDot = originalFilename.lastIndexOf('.');
      const ext = lastDot > 0 ? originalFilename.slice(lastDot).toLowerCase() : '';

      // Only allow specific extensions
      const allowedExts = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.webp'];
      if (!allowedExts.includes(ext)) {
        throw new ApiError(
          `허용되지 않는 파일 확장자입니다. (PDF, DOC, DOCX, PPT, PPTX, JPG, PNG, WEBP만 가능)`,
          400,
          'INVALID_EXTENSION'
        );
      }

      const shortUserId = metadata.userId.slice(0, 8);
      const dateTime = api.storage._formatDateTime();

      // Format: 학년_과목_유형_페이지수p_아이디_올린시각.확장자
      return `${metadata.grade}_${metadata.subject}_${metadata.category}_${metadata.pageCount}p_${shortUserId}_${dateTime}${ext}`;
    },

    // Sanitize preview image filename (simpler format)
    _sanitizePreviewFileName: (filename: string, userId: string): string => {
      const lastDot = filename.lastIndexOf('.');
      const ext = lastDot > 0 ? filename.slice(lastDot).toLowerCase() : '';

      const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
      if (!allowedExts.includes(ext)) {
        throw new ApiError(
          `허용되지 않는 이미지 형식입니다. (JPG, PNG, WEBP만 가능)`,
          400,
          'INVALID_EXTENSION'
        );
      }

      const shortUserId = userId.slice(0, 8);
      const dateTime = api.storage._formatDateTime();
      return `preview_${shortUserId}_${dateTime}${ext}`;
    },

    // Validate file before upload
    _validateFile: (file: File, allowedTypes: string[], maxSize: number, allowedExtensions?: string[]): void => {
      // Check MIME type
      if (!allowedTypes.includes(file.type)) {
        throw new ApiError(
          `허용되지 않는 파일 형식입니다. PDF, Word 문서만 업로드 가능합니다.`,
          400,
          'INVALID_FILE_TYPE'
        );
      }

      // Check file extension
      if (allowedExtensions) {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
          throw new ApiError(
            `허용되지 않는 파일 확장자입니다. (${allowedExtensions.join(', ')}만 가능)`,
            400,
            'INVALID_EXTENSION'
          );
        }
      }

      // Check file size
      if (file.size > maxSize) {
        const maxMB = Math.round(maxSize / (1024 * 1024));
        throw new ApiError(
          `파일 크기는 ${maxMB}MB를 초과할 수 없습니다.`,
          400,
          'FILE_TOO_LARGE'
        );
      }

      // Check filename characters (warning only, will be sanitized)
      if (!api.storage._validateFileName(file.name)) {
        console.warn('Filename contains non-English characters, will be sanitized:', file.name);
      }
    },

    uploadWorksheet: async (
      file: File,
      userId: string,
      metadata: {
        grade: string;
        subject: string;
        category: string;
        pageCount: number;
      }
    ): Promise<string> => {
      // Validate file with extension check
      api.storage._validateFile(
        file,
        api.storage._allowedWorksheetTypes,
        api.storage._maxWorksheetSize,
        api.storage._allowedWorksheetExtensions
      );

      // Generate filename with metadata
      const safeFileName = api.storage._generateWorksheetFileName(file.name, {
        ...metadata,
        userId,
      });
      const filePath = `${userId}/${safeFileName}`;

      const { data, error } = await supabase.storage
        .from('worksheets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, 'UPLOAD_FAILED');
      return data.path;
    },

    uploadPreview: async (file: File, userId: string): Promise<string> => {
      // Validate file with extension check
      api.storage._validateFile(
        file,
        api.storage._allowedPreviewTypes,
        api.storage._maxPreviewSize,
        api.storage._allowedPreviewExtensions
      );

      const safeFileName = api.storage._sanitizePreviewFileName(file.name, userId);
      const filePath = `${userId}/${safeFileName}`;

      const { data, error } = await supabase.storage
        .from('previews')
        .upload(filePath, file, {
          cacheControl: '86400',
          upsert: false,
          contentType: file.type,
        });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, 'UPLOAD_FAILED');

      const { data: urlData } = supabase.storage
        .from('previews')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    },

    getWorksheetUrl: async (path: string): Promise<string> => {
      // Validate path to prevent path traversal
      if (path.includes('..') || path.startsWith('/')) {
        throw new ApiError('잘못된 파일 경로입니다.', 400, 'INVALID_PATH');
      }

      // Extract filename from path for download
      const fileName = path.split('/').pop() || 'worksheet';

      // Create signed URL with download option - use the stored filename
      const { data, error } = await supabase.storage
        .from('worksheets')
        .createSignedUrl(path, 60 * 60, {
          download: fileName, // Use the actual filename for download
        });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, 'SIGNED_URL_FAILED');
      return data.signedUrl;
    },
  },

  // Daily activities (attendance, roulette)
  daily: {
    // Check attendance
    checkAttendance: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('check_attendance');

      if (error) throw new ApiError(sanitizeErrorMessage(error), 400, error.code);

      return data as {
        success: boolean;
        error?: string;
        streak?: number;
        base_points?: number;
        bonus_points?: number;
        total_points?: number;
        new_balance?: number;
        points_earned?: number;
      };
    },

    // Get today's attendance status
    getAttendanceStatus: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('check_date', today)
        .maybeSingle();

      if (error) {
        console.warn('Attendance status fetch failed:', error);
        return { checkedIn: false, streak: 0 };
      }

      if (!data) {
        // Get last streak
        const { data: lastRecord } = await supabase
          .from('attendance')
          .select('streak_days, check_date')
          .eq('user_id', user.id)
          .order('check_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const lastData = lastRecord as { streak_days: number; check_date: string } | null;
        const streak = lastData?.check_date === yesterdayStr ? lastData.streak_days : 0;

        return { checkedIn: false, streak };
      }

      const attendanceData = data as { streak_days: number; points_earned: number; bonus_points: number };
      return {
        checkedIn: true,
        streak: attendanceData.streak_days,
        pointsEarned: attendanceData.points_earned + attendanceData.bonus_points,
      };
    },

    // Spin roulette
    spinRoulette: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('spin_roulette');

      if (error) throw new ApiError(sanitizeErrorMessage(error), 400, error.code);

      return data as {
        success: boolean;
        error?: string;
        points_won?: number;
        new_balance?: number;
      };
    },

    // Get today's roulette status
    getRouletteStatus: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('roulette_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('spin_date', today)
        .maybeSingle();

      if (error) {
        console.warn('Roulette status fetch failed:', error);
        return { spun: false };
      }

      if (!data) return { spun: false };

      return {
        spun: true,
        pointsWon: (data as { points_won: number }).points_won,
      };
    },
  },

  // Events
  events: {
    // List active events
    list: async (status?: 'active' | 'scheduled' | 'ended') => {
      let query = supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      } else {
        query = query.in('status', ['active', 'scheduled']);
      }

      const { data, error } = await query;

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);

      type EventRow = {
        id: string;
        type: string;
        title: string;
        description: string | null;
        status: string;
        start_at: string | null;
        end_at: string | null;
        max_participants: number | null;
        current_participants: number;
        target_grades: string[] | null;
        quiz_type: string | null;
        difficulty: string | null;
        points_reward: number;
        mission_type: string | null;
        min_length: number | null;
        min_points: number | null;
        max_points: number | null;
        created_at: string;
      };

      return ((data || []) as EventRow[]).map(e => ({
        id: e.id,
        type: e.type,
        title: e.title,
        description: e.description,
        status: e.status,
        startAt: e.start_at,
        endAt: e.end_at,
        maxParticipants: e.max_participants,
        currentParticipants: e.current_participants,
        targetGrades: e.target_grades,
        quizType: e.quiz_type,
        difficulty: e.difficulty,
        pointsReward: e.points_reward,
        missionType: e.mission_type,
        minLength: e.min_length,
        minPoints: e.min_points,
        maxPoints: e.max_points,
        createdAt: e.created_at,
      }));
    },

    // Get event detail with questions (for quiz)
    get: async (eventId: string) => {
      const { data: event, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);

      // Get questions if quiz event
      let questions: Array<{
        id: string;
        question: string;
        questionType: string;
        choices: Record<string, string> | null;
        orderNum: number;
      }> = [];

      if ((event as { type: string }).type === 'quiz') {
        const { data: questionsData } = await supabase
          .from('quiz_questions')
          .select('id, question, question_type, choices, order_num')
          .eq('event_id', eventId)
          .order('order_num');

        type QuestionRow = {
          id: string;
          question: string;
          question_type: string;
          choices: Record<string, string> | null;
          order_num: number;
        };

        questions = ((questionsData || []) as QuestionRow[]).map(q => ({
          id: q.id,
          question: q.question,
          questionType: q.question_type,
          choices: q.choices,
          orderNum: q.order_num,
        }));
      }

      // Check if user already participated
      const { data: { user } } = await supabase.auth.getUser();
      let participated = false;

      if (user) {
        const { data: participation } = await supabase
          .from('event_participations')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .maybeSingle();

        participated = !!participation;
      }

      const e = event as {
        id: string;
        type: string;
        title: string;
        description: string | null;
        status: string;
        start_at: string | null;
        end_at: string | null;
        max_participants: number | null;
        current_participants: number;
        points_reward: number;
        mission_type: string | null;
      };

      return {
        id: e.id,
        type: e.type,
        title: e.title,
        description: e.description,
        status: e.status,
        startAt: e.start_at,
        endAt: e.end_at,
        maxParticipants: e.max_participants,
        currentParticipants: e.current_participants,
        pointsReward: e.points_reward,
        missionType: e.mission_type,
        questions,
        participated,
      };
    },

    // Participate in first-come event
    participateFirstCome: async (eventId: string, comment?: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('participate_first_come', {
        p_event_id: eventId,
        p_comment: comment || null,
      });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 400, error.code);

      return data as {
        success: boolean;
        error?: string;
        points_earned?: number;
        new_balance?: number;
        position?: number;
      };
    },

    // Submit quiz answers
    submitQuiz: async (eventId: string, answers: Record<string, string>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // Get event and questions
      const { data: event } = await supabase
        .from('events')
        .select('*, quiz_questions(*)')
        .eq('id', eventId)
        .single();

      if (!event) throw new ApiError('이벤트를 찾을 수 없습니다.', 404);

      const eventData = event as {
        status: string;
        points_reward: number;
        quiz_questions: Array<{
          id: string;
          correct_answer: string;
        }>;
      };

      if (eventData.status !== 'active') {
        throw new ApiError('진행 중인 이벤트가 아닙니다.', 400);
      }

      // Check if already participated
      const { data: existing } = await supabase
        .from('event_participations')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) throw new ApiError('이미 참여했습니다.', 400);

      // Check answers
      let correctCount = 0;
      const questions = eventData.quiz_questions;

      for (const q of questions) {
        if (answers[q.id] === q.correct_answer) {
          correctCount++;
        }
      }

      const isCorrect = correctCount === questions.length;
      const pointsEarned = isCorrect ? eventData.points_reward : 0;

      // Record participation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('event_participations') as any).insert({
        event_id: eventId,
        user_id: user.id,
        is_correct: isCorrect,
        submitted_answer: JSON.stringify(answers),
        points_earned: pointsEarned,
      });

      // Update event participants
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('events') as any)
        .update({ current_participants: (event as { current_participants: number }).current_participants + 1 })
        .eq('id', eventId);

      // Give points if correct
      let newBalance = 0;
      if (isCorrect) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', user.id)
          .single();

        newBalance = ((profile as { points: number } | null)?.points || 0) + pointsEarned;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({ points: newBalance })
          .eq('id', user.id);

        // Record transaction
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('point_transactions') as any).insert({
          user_id: user.id,
          type: 'quiz',
          amount: pointsEarned,
          balance: newBalance,
          description: `퀴즈 이벤트 정답: ${(event as { title: string }).title}`,
          related_id: eventId,
        });
      }

      return {
        success: true,
        isCorrect,
        correctCount,
        totalQuestions: questions.length,
        pointsEarned,
        newBalance,
      };
    },
  },

  // User interests (grade preferences)
  interests: {
    get: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      const { data, error } = await supabase
        .from('user_interests')
        .select('grade_group')
        .eq('user_id', user.id);

      if (error) {
        console.warn('Interests fetch failed:', error);
        return [];
      }

      return ((data || []) as { grade_group: string }[]).map(i => i.grade_group);
    },

    update: async (grades: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // Delete existing
      await supabase
        .from('user_interests')
        .delete()
        .eq('user_id', user.id);

      // Insert new
      if (grades.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('user_interests') as any).insert(
          grades.map(g => ({ user_id: user.id, grade_group: g }))
        );
      }

      return { success: true };
    },
  },

  // Messages
  messages: {
    // Get received messages
    getInbox: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(nickname)')
        .or(`recipient_id.eq.${user.id},and(recipient_id.is.null,recipient_type.eq.all)`)
        .order('created_at', { ascending: false });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);

      type MessageRow = {
        id: string;
        sender_id: string | null;
        recipient_id: string | null;
        recipient_type: string | null;
        message_type: string;
        title: string;
        content: string;
        is_read: boolean;
        created_at: string;
        sender: { nickname: string } | null;
      };

      return ((data || []) as MessageRow[]).map(m => ({
        id: m.id,
        senderId: m.sender_id,
        senderNickname: m.sender?.nickname || '관리자',
        recipientType: m.recipient_type,
        messageType: m.message_type,
        title: m.title,
        content: m.content,
        isRead: m.is_read,
        createdAt: m.created_at,
      }));
    },

    // Send message to admin (inquiry)
    sendInquiry: async (data: { type: string; title: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // Get admin user id
      const { data: admin } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', 'skypeople41@gmail.com')
        .maybeSingle();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('messages') as any).insert({
        sender_id: user.id,
        recipient_id: (admin as { id: string } | null)?.id || null,
        recipient_type: 'individual',
        message_type: 'inquiry',
        inquiry_type: data.type,
        title: data.title,
        content: data.content,
      });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return { success: true };
    },

    // Mark as read
    markAsRead: async (messageId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('messages') as any)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return { success: true };
    },
  },

  // Worksheet inquiries (buyer <-> seller)
  worksheetInquiries: {
    // Get inquiries for a worksheet (seller view)
    getByWorksheet: async (worksheetId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      const { data, error } = await supabase
        .from('worksheet_inquiries')
        .select('*, sender:profiles!worksheet_inquiries_sender_id_fkey(nickname)')
        .eq('worksheet_id', worksheetId)
        .order('created_at', { ascending: true });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);

      type InquiryRow = {
        id: string;
        worksheet_id: string;
        buyer_id: string;
        seller_id: string;
        sender_id: string;
        content: string;
        thread_id: string | null;
        is_read: boolean;
        created_at: string;
        sender: { nickname: string } | null;
      };

      return ((data || []) as InquiryRow[]).map(i => ({
        id: i.id,
        worksheetId: i.worksheet_id,
        buyerId: i.buyer_id,
        sellerId: i.seller_id,
        senderId: i.sender_id,
        senderNickname: i.sender?.nickname || '',
        content: i.content,
        threadId: i.thread_id,
        isRead: i.is_read,
        createdAt: i.created_at,
        isMine: i.sender_id === user.id,
      }));
    },

    // Send inquiry
    send: async (worksheetId: string, content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // Get worksheet seller
      const { data: worksheet } = await supabase
        .from('worksheets')
        .select('seller_id')
        .eq('id', worksheetId)
        .single();

      if (!worksheet) throw new ApiError('워크시트를 찾을 수 없습니다.', 404);

      const sellerId = (worksheet as { seller_id: string }).seller_id;
      const isBuyer = user.id !== sellerId;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('worksheet_inquiries') as any).insert({
        worksheet_id: worksheetId,
        buyer_id: isBuyer ? user.id : null,
        seller_id: sellerId,
        sender_id: user.id,
        content,
      });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return { success: true };
    },
  },

  // Admin functions
  admin: {
    // Check if current user is admin
    isAdmin: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      return (data as { email: string } | null)?.email === 'skypeople41@gmail.com';
    },

    // Create event
    createEvent: async (eventData: {
      type: 'quiz' | 'first_come' | 'comment';
      title: string;
      description?: string;
      startAt?: string;
      endAt?: string;
      maxParticipants?: number;
      targetGrades?: string[];
      quizType?: 'ox' | 'multiple_choice';
      difficulty?: 'easy' | 'normal' | 'hard';
      pointsReward: number;
      missionType?: 'button_only' | 'comment_required';
      minLength?: number;
      minPoints?: number;
      maxPoints?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('events') as any)
        .insert({
          type: eventData.type,
          title: eventData.title,
          description: eventData.description,
          status: eventData.startAt ? 'scheduled' : 'draft',
          start_at: eventData.startAt,
          end_at: eventData.endAt,
          max_participants: eventData.maxParticipants,
          target_grades: eventData.targetGrades,
          quiz_type: eventData.quizType,
          difficulty: eventData.difficulty,
          points_reward: eventData.pointsReward,
          mission_type: eventData.missionType,
          min_length: eventData.minLength,
          min_points: eventData.minPoints,
          max_points: eventData.maxPoints,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return data;
    },

    // Add quiz questions
    addQuizQuestions: async (eventId: string, questions: Array<{
      question: string;
      questionType: 'ox' | 'multiple_choice';
      correctAnswer: string;
      choices?: Record<string, string>;
      explanation?: string;
      grade?: string;
      subject?: string;
    }>) => {
      const questionsToInsert = questions.map((q, idx) => ({
        event_id: eventId,
        question: q.question,
        question_type: q.questionType,
        correct_answer: q.correctAnswer,
        choices: q.choices || null,
        explanation: q.explanation || null,
        grade: q.grade || null,
        subject: q.subject || null,
        order_num: idx,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('quiz_questions') as any).insert(questionsToInsert);

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return { success: true };
    },

    // Activate event
    activateEvent: async (eventId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('events') as any)
        .update({ status: 'active', start_at: new Date().toISOString() })
        .eq('id', eventId);

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return { success: true };
    },

    // End event
    endEvent: async (eventId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('events') as any)
        .update({ status: 'ended', end_at: new Date().toISOString() })
        .eq('id', eventId);

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return { success: true };
    },

    // Send message to users
    sendMessage: async (data: {
      recipientType: 'all' | 'grade_group' | 'individual';
      recipientId?: string;
      recipientGrades?: string[];
      title: string;
      content: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('messages') as any).insert({
        sender_id: user.id,
        recipient_id: data.recipientType === 'individual' ? data.recipientId : null,
        recipient_type: data.recipientType,
        recipient_grades: data.recipientGrades || null,
        message_type: 'notice',
        title: data.title,
        content: data.content,
      });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);
      return { success: true };
    },

    // Get all inquiries (admin view)
    getInquiries: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(nickname, email)')
        .eq('message_type', 'inquiry')
        .order('created_at', { ascending: false });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);

      type InquiryMessageRow = {
        id: string;
        sender_id: string;
        inquiry_type: string | null;
        title: string;
        content: string;
        is_read: boolean;
        created_at: string;
        sender: { nickname: string; email: string } | null;
      };

      return ((data || []) as InquiryMessageRow[]).map(m => ({
        id: m.id,
        senderId: m.sender_id,
        senderNickname: m.sender?.nickname || '',
        senderEmail: m.sender?.email || '',
        inquiryType: m.inquiry_type,
        title: m.title,
        content: m.content,
        isRead: m.is_read,
        createdAt: m.created_at,
      }));
    },

    // Reply to inquiry
    replyInquiry: async (originalMessageId: string, content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new ApiError('인증이 필요합니다.', 401);

      // Get original message
      const { data: original } = await supabase
        .from('messages')
        .select('sender_id, title')
        .eq('id', originalMessageId)
        .single();

      if (!original) throw new ApiError('원본 메시지를 찾을 수 없습니다.', 404);

      const originalData = original as { sender_id: string; title: string };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('messages') as any).insert({
        sender_id: user.id,
        recipient_id: originalData.sender_id,
        recipient_type: 'individual',
        message_type: 'inquiry_reply',
        parent_id: originalMessageId,
        title: `Re: ${originalData.title}`,
        content,
      });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);

      // Mark original as read
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('messages') as any)
        .update({ is_read: true })
        .eq('id', originalMessageId);

      return { success: true };
    },

    // Get comment event participations for approval
    getCommentParticipations: async (eventId: string) => {
      const { data, error } = await supabase
        .from('event_participations')
        .select('*, user:profiles!event_participations_user_id_fkey(nickname)')
        .eq('event_id', eventId)
        .not('comment_text', 'is', null)
        .order('participated_at', { ascending: false });

      if (error) throw new ApiError(sanitizeErrorMessage(error), 500, error.code);

      type ParticipationRow = {
        id: string;
        user_id: string;
        comment_text: string;
        ai_score: number | null;
        ai_feedback: string | null;
        admin_approved: boolean | null;
        admin_adjusted_score: number | null;
        points_earned: number;
        participated_at: string;
        user: { nickname: string } | null;
      };

      return ((data || []) as ParticipationRow[]).map(p => ({
        id: p.id,
        userId: p.user_id,
        userNickname: p.user?.nickname || '',
        commentText: p.comment_text,
        aiScore: p.ai_score,
        aiFeedback: p.ai_feedback,
        adminApproved: p.admin_approved,
        adminAdjustedScore: p.admin_adjusted_score,
        pointsEarned: p.points_earned,
        participatedAt: p.participated_at,
      }));
    },

    // Approve/reject comment participation
    approveCommentParticipation: async (participationId: string, approved: boolean, adjustedScore?: number) => {
      const { data: participation } = await supabase
        .from('event_participations')
        .select('*, events(*)')
        .eq('id', participationId)
        .single();

      if (!participation) throw new ApiError('참여 기록을 찾을 수 없습니다.', 404);

      const p = participation as {
        user_id: string;
        ai_score: number;
        events: { min_points: number; max_points: number; title: string; id: string };
      };

      const score = adjustedScore ?? p.ai_score ?? 0;
      const minP = p.events.min_points || 10;
      const maxP = p.events.max_points || 50;
      const pointsEarned = approved ? Math.round((score / 100) * (maxP - minP) + minP) : 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('event_participations') as any)
        .update({
          admin_approved: approved,
          admin_adjusted_score: adjustedScore,
          points_earned: pointsEarned,
        })
        .eq('id', participationId);

      // Give points if approved
      if (approved && pointsEarned > 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', p.user_id)
          .single();

        const newBalance = ((profile as { points: number } | null)?.points || 0) + pointsEarned;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({ points: newBalance })
          .eq('id', p.user_id);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('point_transactions') as any).insert({
          user_id: p.user_id,
          type: 'comment_event',
          amount: pointsEarned,
          balance: newBalance,
          description: `댓글 이벤트: ${p.events.title}`,
          related_id: p.events.id,
        });
      }

      return { success: true, pointsEarned };
    },
  },
};

export default api;
