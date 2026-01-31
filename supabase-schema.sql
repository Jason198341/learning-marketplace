-- =====================================================
-- 학습장터 (Learning Marketplace) Database Schema
-- Run this in Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROFILES TABLE (extends auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    nickname TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'parent', 'admin')),
    points INTEGER NOT NULL DEFAULT 1000, -- Signup bonus
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON public.profiles(nickname);

-- =====================================================
-- 2. WORKSHEETS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.worksheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 100 AND price <= 500),
    grade TEXT NOT NULL,
    subject TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    file_url TEXT NOT NULL,
    preview_image TEXT NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 1,
    download_count INTEGER NOT NULL DEFAULT 0,
    sales_count INTEGER NOT NULL DEFAULT 0,
    average_rating DECIMAL(2,1) NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_worksheets_seller ON public.worksheets(seller_id);
CREATE INDEX IF NOT EXISTS idx_worksheets_status ON public.worksheets(status);
CREATE INDEX IF NOT EXISTS idx_worksheets_grade ON public.worksheets(grade);
CREATE INDEX IF NOT EXISTS idx_worksheets_subject ON public.worksheets(subject);
CREATE INDEX IF NOT EXISTS idx_worksheets_category ON public.worksheets(category);
CREATE INDEX IF NOT EXISTS idx_worksheets_created ON public.worksheets(created_at DESC);

-- =====================================================
-- 3. CART_ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    worksheet_id UUID NOT NULL REFERENCES public.worksheets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, worksheet_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_cart_user ON public.cart_items(user_id);

-- =====================================================
-- 4. PURCHASES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    worksheet_id UUID NOT NULL REFERENCES public.worksheets(id) ON DELETE CASCADE,
    price INTEGER NOT NULL,
    has_feedback BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(buyer_id, worksheet_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON public.purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_worksheet ON public.purchases(worksheet_id);
CREATE INDEX IF NOT EXISTS idx_purchases_created ON public.purchases(created_at DESC);

-- =====================================================
-- 5. FEEDBACKS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    worksheet_id UUID NOT NULL REFERENCES public.worksheets(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(purchase_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedbacks_worksheet ON public.feedbacks(worksheet_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created ON public.feedbacks(created_at DESC);

-- =====================================================
-- 6. POINT_TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.point_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('signup_bonus', 'purchase', 'sale', 'feedback_refund', 'admin_charge')),
    amount INTEGER NOT NULL,
    balance INTEGER NOT NULL,
    description TEXT NOT NULL,
    related_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON public.point_transactions(created_at DESC);

-- =====================================================
-- 7. WORKSHEET_EDIT_HISTORY TABLE (수정 이력)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.worksheet_edit_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worksheet_id UUID NOT NULL REFERENCES public.worksheets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    changes TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    is_notified BOOLEAN NOT NULL DEFAULT FALSE,
    notified_at TIMESTAMPTZ,
    notified_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_edit_history_worksheet ON public.worksheet_edit_history(worksheet_id);
CREATE INDEX IF NOT EXISTS idx_edit_history_created ON public.worksheet_edit_history(created_at DESC);

-- =====================================================
-- 7-2. NOTIFICATIONS TABLE (알림)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'worksheet_updated',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    worksheet_id UUID REFERENCES public.worksheets(id) ON DELETE CASCADE,
    edit_history_id UUID REFERENCES public.worksheet_edit_history(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;

-- =====================================================
-- 8. VIEW: worksheet_cards (with seller info)
-- Note: security_invoker = true ensures RLS policies are applied
-- =====================================================
DROP VIEW IF EXISTS public.worksheet_cards;

CREATE VIEW public.worksheet_cards
WITH (security_invoker = true)
AS
SELECT
    w.id,
    w.seller_id,
    p.nickname as seller_nickname,
    w.title,
    w.description,
    w.price,
    w.grade,
    w.subject,
    w.category,
    w.tags,
    w.file_url,
    w.preview_image,
    w.page_count,
    w.download_count,
    w.sales_count,
    w.average_rating,
    w.review_count,
    w.status,
    w.created_at,
    w.updated_at
FROM public.worksheets w
JOIN public.profiles p ON w.seller_id = p.id;

-- =====================================================
-- 8. FUNCTION: Create profile on signup
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, nickname, role, points)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'),
        1000
    );

    -- Record signup bonus transaction
    INSERT INTO public.point_transactions (user_id, type, amount, balance, description)
    VALUES (NEW.id, 'signup_bonus', 1000, 1000, '회원가입 축하 포인트');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 9. FUNCTION: Purchase worksheets from cart
-- =====================================================
CREATE OR REPLACE FUNCTION public.purchase_worksheets(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_cart_items RECORD;
    v_total_price INTEGER := 0;
    v_user_points INTEGER;
    v_new_balance INTEGER;
    v_worksheet RECORD;
    v_seller RECORD;
    v_purchase_id UUID;
    v_results JSON[];
BEGIN
    -- Get user's current points (with lock to prevent race condition)
    SELECT points INTO v_user_points FROM public.profiles WHERE id = p_user_id FOR UPDATE;

    -- Calculate total price from cart
    SELECT COALESCE(SUM(w.price), 0) INTO v_total_price
    FROM public.cart_items c
    JOIN public.worksheets w ON c.worksheet_id = w.id
    WHERE c.user_id = p_user_id AND w.status = 'approved';

    -- Check if cart is empty
    IF v_total_price = 0 THEN
        RAISE EXCEPTION '장바구니가 비어있습니다.';
    END IF;

    -- Check if user has enough points
    IF v_user_points < v_total_price THEN
        RAISE EXCEPTION '포인트가 부족합니다. (필요: %, 보유: %)', v_total_price, v_user_points;
    END IF;

    -- Check if trying to buy own worksheet
    IF EXISTS (
        SELECT 1 FROM public.cart_items c
        JOIN public.worksheets w ON c.worksheet_id = w.id
        WHERE c.user_id = p_user_id AND w.seller_id = p_user_id
    ) THEN
        RAISE EXCEPTION '본인의 자료는 구매할 수 없습니다.';
    END IF;

    v_results := ARRAY[]::JSON[];

    -- Process each cart item
    FOR v_cart_items IN
        SELECT c.id as cart_id, c.worksheet_id, w.price, w.seller_id, w.title
        FROM public.cart_items c
        JOIN public.worksheets w ON c.worksheet_id = w.id
        WHERE c.user_id = p_user_id AND w.status = 'approved'
    LOOP
        -- Create purchase record
        INSERT INTO public.purchases (buyer_id, worksheet_id, price)
        VALUES (p_user_id, v_cart_items.worksheet_id, v_cart_items.price)
        RETURNING id INTO v_purchase_id;

        -- Update worksheet sales count
        UPDATE public.worksheets
        SET sales_count = sales_count + 1, download_count = download_count + 1
        WHERE id = v_cart_items.worksheet_id;

        -- Get seller info and transfer points
        SELECT id, points INTO v_seller FROM public.profiles WHERE id = v_cart_items.seller_id;

        -- Add points to seller
        UPDATE public.profiles
        SET points = points + v_cart_items.price
        WHERE id = v_cart_items.seller_id;

        -- Record seller transaction
        INSERT INTO public.point_transactions (user_id, type, amount, balance, description, related_id)
        VALUES (
            v_cart_items.seller_id,
            'sale',
            v_cart_items.price,
            v_seller.points + v_cart_items.price,
            v_cart_items.title || ' 판매',
            v_purchase_id
        );

        -- Remove from cart
        DELETE FROM public.cart_items WHERE id = v_cart_items.cart_id;

        v_results := v_results || json_build_object(
            'worksheetId', v_cart_items.worksheet_id,
            'title', v_cart_items.title,
            'price', v_cart_items.price
        )::JSON;
    END LOOP;

    -- Deduct points from buyer
    v_new_balance := v_user_points - v_total_price;
    UPDATE public.profiles SET points = v_new_balance WHERE id = p_user_id;

    -- Record buyer transaction
    INSERT INTO public.point_transactions (user_id, type, amount, balance, description)
    VALUES (p_user_id, 'purchase', -v_total_price, v_new_balance, '워크시트 구매');

    RETURN json_build_object(
        'success', true,
        'totalSpent', v_total_price,
        'newBalance', v_new_balance,
        'purchases', v_results
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. FUNCTION: Submit feedback with refund
-- =====================================================
CREATE OR REPLACE FUNCTION public.submit_feedback(
    p_user_id UUID,
    p_worksheet_id UUID,
    p_rating INTEGER,
    p_comment TEXT
)
RETURNS JSON AS $$
DECLARE
    v_purchase RECORD;
    v_user_points INTEGER;
    v_new_balance INTEGER;
    v_refund_amount INTEGER := 30;
    v_feedback_id UUID;
    v_new_avg DECIMAL(2,1);
    v_new_count INTEGER;
BEGIN
    -- Get purchase record
    SELECT * INTO v_purchase
    FROM public.purchases
    WHERE buyer_id = p_user_id AND worksheet_id = p_worksheet_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '구매 내역을 찾을 수 없습니다.';
    END IF;

    IF v_purchase.has_feedback THEN
        RAISE EXCEPTION '이미 후기를 작성했습니다.';
    END IF;

    -- Create feedback
    INSERT INTO public.feedbacks (purchase_id, worksheet_id, buyer_id, rating, comment)
    VALUES (v_purchase.id, p_worksheet_id, p_user_id, p_rating, p_comment)
    RETURNING id INTO v_feedback_id;

    -- Update purchase
    UPDATE public.purchases SET has_feedback = TRUE WHERE id = v_purchase.id;

    -- Update worksheet rating
    SELECT
        ROUND(AVG(rating)::numeric, 1),
        COUNT(*)
    INTO v_new_avg, v_new_count
    FROM public.feedbacks
    WHERE worksheet_id = p_worksheet_id;

    UPDATE public.worksheets
    SET average_rating = v_new_avg, review_count = v_new_count
    WHERE id = p_worksheet_id;

    -- Give refund to user
    SELECT points INTO v_user_points FROM public.profiles WHERE id = p_user_id;
    v_new_balance := v_user_points + v_refund_amount;

    UPDATE public.profiles SET points = v_new_balance WHERE id = p_user_id;

    -- Record refund transaction
    INSERT INTO public.point_transactions (user_id, type, amount, balance, description, related_id)
    VALUES (p_user_id, 'feedback_refund', v_refund_amount, v_new_balance, '후기 작성 보상', v_feedback_id);

    RETURN json_build_object(
        'success', true,
        'feedbackId', v_feedback_id,
        'pointsRefunded', v_refund_amount,
        'newBalance', v_new_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worksheet_edit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- DROP existing policies first (for re-running)
-- =====================================================
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

DROP POLICY IF EXISTS "Approved worksheets are viewable by everyone" ON public.worksheets;
DROP POLICY IF EXISTS "Users can create worksheets" ON public.worksheets;
DROP POLICY IF EXISTS "Users can update own worksheets" ON public.worksheets;
DROP POLICY IF EXISTS "Users can delete own worksheets" ON public.worksheets;

DROP POLICY IF EXISTS "Users can view own cart" ON public.cart_items;
DROP POLICY IF EXISTS "Users can add to own cart" ON public.cart_items;
DROP POLICY IF EXISTS "Users can remove from own cart" ON public.cart_items;

DROP POLICY IF EXISTS "Users can view own purchases" ON public.purchases;
DROP POLICY IF EXISTS "Sellers can view sales" ON public.purchases;

DROP POLICY IF EXISTS "Feedbacks are viewable by everyone" ON public.feedbacks;
DROP POLICY IF EXISTS "Users can create feedback for purchases" ON public.feedbacks;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.point_transactions;

-- =====================================================
-- CREATE policies
-- =====================================================

-- PROFILES policies
-- Note: Only expose nickname and avatar_url publicly, not email
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

-- For email access, use a secure view or function instead
-- CREATE VIEW public.public_profiles AS
-- SELECT id, nickname, avatar_url, role, created_at FROM public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- WORKSHEETS policies
CREATE POLICY "Approved worksheets are viewable by everyone" ON public.worksheets
    FOR SELECT USING (status = 'approved' OR seller_id = auth.uid());

CREATE POLICY "Users can create worksheets" ON public.worksheets
    FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Users can update own worksheets" ON public.worksheets
    FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Users can delete own worksheets" ON public.worksheets
    FOR DELETE USING (auth.uid() = seller_id);

-- CART_ITEMS policies
CREATE POLICY "Users can view own cart" ON public.cart_items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add to own cart" ON public.cart_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from own cart" ON public.cart_items
    FOR DELETE USING (auth.uid() = user_id);

-- PURCHASES policies
CREATE POLICY "Users can view own purchases" ON public.purchases
    FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can view sales" ON public.purchases
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.worksheets w
            WHERE w.id = worksheet_id AND w.seller_id = auth.uid()
        )
    );

-- FEEDBACKS policies
CREATE POLICY "Feedbacks are viewable by everyone" ON public.feedbacks
    FOR SELECT USING (true);

CREATE POLICY "Users can create feedback for purchases" ON public.feedbacks
    FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- POINT_TRANSACTIONS policies
CREATE POLICY "Users can view own transactions" ON public.point_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- WORKSHEET_EDIT_HISTORY policies
DROP POLICY IF EXISTS "Edit history is viewable by everyone" ON public.worksheet_edit_history;
DROP POLICY IF EXISTS "Edit history viewable by owner" ON public.worksheet_edit_history;
DROP POLICY IF EXISTS "Edit history viewable by buyers if notified" ON public.worksheet_edit_history;
DROP POLICY IF EXISTS "Worksheet owners can create edit history" ON public.worksheet_edit_history;
DROP POLICY IF EXISTS "Worksheet owners can update edit history" ON public.worksheet_edit_history;

-- 판매자(소유자)는 모든 수정 이력 조회 가능
CREATE POLICY "Edit history viewable by owner" ON public.worksheet_edit_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.worksheets w
            WHERE w.id = worksheet_id AND w.seller_id = auth.uid()
        )
    );

-- 구매자는 알림 보낸 이력만 조회 가능
CREATE POLICY "Edit history viewable by buyers if notified" ON public.worksheet_edit_history
    FOR SELECT USING (
        is_notified = TRUE AND
        EXISTS (
            SELECT 1 FROM public.purchases p
            WHERE p.worksheet_id = worksheet_edit_history.worksheet_id
            AND p.buyer_id = auth.uid()
        )
    );

-- 워크시트 소유자만 수정 이력 생성 가능
CREATE POLICY "Worksheet owners can create edit history" ON public.worksheet_edit_history
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.worksheets w
            WHERE w.id = worksheet_id AND w.seller_id = auth.uid()
        )
    );

-- 워크시트 소유자만 수정 이력 업데이트 가능 (알림 보내기용)
CREATE POLICY "Worksheet owners can update edit history" ON public.worksheet_edit_history
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.worksheets w
            WHERE w.id = worksheet_id AND w.seller_id = auth.uid()
        )
    );

-- NOTIFICATIONS policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

-- 본인 알림만 조회 가능
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

-- 알림 생성 (인증된 사용자)
CREATE POLICY "Authenticated users can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 본인 알림 읽음 처리 가능
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- 본인 알림 삭제 가능
CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 13. FUNCTION: Send edit notification to buyers
-- =====================================================
CREATE OR REPLACE FUNCTION public.send_edit_notification(
    p_edit_history_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_edit_history RECORD;
    v_worksheet RECORD;
    v_buyer RECORD;
    v_count INTEGER := 0;
BEGIN
    -- 수정 이력 조회
    SELECT * INTO v_edit_history
    FROM public.worksheet_edit_history
    WHERE id = p_edit_history_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '수정 이력을 찾을 수 없습니다.';
    END IF;

    -- 이미 알림 보낸 경우
    IF v_edit_history.is_notified THEN
        RAISE EXCEPTION '이미 알림을 보냈습니다.';
    END IF;

    -- 워크시트 정보 조회
    SELECT * INTO v_worksheet
    FROM public.worksheets
    WHERE id = v_edit_history.worksheet_id;

    -- 소유자 확인
    IF v_worksheet.seller_id != auth.uid() THEN
        RAISE EXCEPTION '권한이 없습니다.';
    END IF;

    -- 구매자들에게 알림 생성
    FOR v_buyer IN
        SELECT DISTINCT buyer_id
        FROM public.purchases
        WHERE worksheet_id = v_edit_history.worksheet_id
    LOOP
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            worksheet_id,
            edit_history_id
        ) VALUES (
            v_buyer.buyer_id,
            'worksheet_updated',
            '구매한 자료가 수정되었습니다',
            '「' || v_worksheet.title || '」 자료가 수정되었습니다. 변경 내용: ' || v_edit_history.changes,
            v_edit_history.worksheet_id,
            p_edit_history_id
        );
        v_count := v_count + 1;
    END LOOP;

    -- 수정 이력 업데이트
    UPDATE public.worksheet_edit_history
    SET
        is_notified = TRUE,
        notified_at = NOW(),
        notified_count = v_count
    WHERE id = p_edit_history_id;

    RETURN json_build_object(
        'success', true,
        'notifiedCount', v_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 14. STORAGE BUCKETS
-- =====================================================

-- Create storage buckets (run these separately if needed)
INSERT INTO storage.buckets (id, name, public)
VALUES ('worksheets', 'worksheets', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('previews', 'previews', true)
ON CONFLICT (id) DO NOTHING;

-- DROP existing storage policies first (for re-running)
DROP POLICY IF EXISTS "Authenticated users can upload worksheets" ON storage.objects;
DROP POLICY IF EXISTS "Users can access purchased worksheets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view previews" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload previews" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own previews" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own previews" ON storage.objects;

-- Storage policies for worksheets bucket (private)
CREATE POLICY "Authenticated users can upload worksheets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'worksheets' AND auth.role() = 'authenticated');

CREATE POLICY "Users can access purchased worksheets"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'worksheets' AND (
        -- Owner can access
        (storage.foldername(name))[1] = auth.uid()::text
        OR
        -- Purchaser can access
        EXISTS (
            SELECT 1 FROM public.purchases p
            JOIN public.worksheets w ON p.worksheet_id = w.id
            WHERE p.buyer_id = auth.uid()
            AND w.file_url LIKE '%' || name
        )
    )
);

-- Storage policies for previews bucket (public)
CREATE POLICY "Anyone can view previews"
ON storage.objects FOR SELECT
USING (bucket_id = 'previews');

CREATE POLICY "Authenticated users can upload previews"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'previews' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own previews"
ON storage.objects FOR UPDATE
USING (bucket_id = 'previews' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own previews"
ON storage.objects FOR DELETE
USING (bucket_id = 'previews' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================
-- 13. SEED DATA (Optional - for testing)
-- =====================================================

-- You can add seed data here if needed for testing
-- Example:
-- INSERT INTO public.worksheets (seller_id, title, description, price, grade, subject, category, file_url, preview_image)
-- VALUES (...);

-- =====================================================
-- DONE! Run this entire script in Supabase SQL Editor
-- =====================================================
