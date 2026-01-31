-- =====================================================
-- 워크시트 수정 이력 + 알림 시스템
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- =====================================================
-- 1. 수정 이력 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS public.worksheet_edit_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worksheet_id UUID NOT NULL REFERENCES public.worksheets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    changes TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    is_notified BOOLEAN NOT NULL DEFAULT FALSE,  -- 구매자에게 알림 보냈는지
    notified_at TIMESTAMPTZ,                      -- 알림 보낸 시각
    notified_count INTEGER DEFAULT 0,             -- 알림 받은 구매자 수
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edit_history_worksheet ON public.worksheet_edit_history(worksheet_id);
CREATE INDEX IF NOT EXISTS idx_edit_history_created ON public.worksheet_edit_history(created_at DESC);

-- =====================================================
-- 2. 알림 테이블
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
-- 3. RLS 활성화
-- =====================================================
ALTER TABLE public.worksheet_edit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. 수정 이력 RLS 정책
-- =====================================================
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

-- =====================================================
-- 5. 알림 RLS 정책
-- =====================================================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

-- 본인 알림만 조회 가능
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

-- 알림 생성 (서비스 역할 또는 인증된 사용자)
CREATE POLICY "Authenticated users can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 본인 알림 읽음 처리 가능
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- 본인 알림 삭제 가능
CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 6. 알림 보내기 함수
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
-- 완료!
-- =====================================================
