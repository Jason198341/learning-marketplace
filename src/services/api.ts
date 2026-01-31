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
};

export default api;
