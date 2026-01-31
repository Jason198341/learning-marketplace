-- =====================================================
-- 관리자/이벤트 시스템 스키마 (수정본 - 기존 정책 삭제 후 재생성)
-- =====================================================

-- 기존 정책들 삭제
DROP POLICY IF EXISTS "Users can manage own interests" ON user_interests;
DROP POLICY IF EXISTS "Users can view own attendance" ON attendance;
DROP POLICY IF EXISTS "Users can check in" ON attendance;
DROP POLICY IF EXISTS "Users can view own roulette" ON roulette_history;
DROP POLICY IF EXISTS "Users can spin roulette" ON roulette_history;
DROP POLICY IF EXISTS "Anyone can view active events" ON events;
DROP POLICY IF EXISTS "Admins can manage events" ON events;
DROP POLICY IF EXISTS "Anyone can view quiz questions for active events" ON quiz_questions;
DROP POLICY IF EXISTS "Admins can manage quiz questions" ON quiz_questions;
DROP POLICY IF EXISTS "Users can view own participations" ON event_participations;
DROP POLICY IF EXISTS "Users can participate" ON event_participations;
DROP POLICY IF EXISTS "Admins can view all participations" ON event_participations;
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can send inquiries" ON messages;
DROP POLICY IF EXISTS "Admins can send messages" ON messages;
DROP POLICY IF EXISTS "Users can view inquiries for own worksheets" ON worksheet_inquiries;
DROP POLICY IF EXISTS "Users can send inquiries to worksheets" ON worksheet_inquiries;
DROP POLICY IF EXISTS "Sellers can reply to inquiries" ON worksheet_inquiries;

-- =====================================================
-- 1. 사용자 관심 학년 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  grades TEXT[] DEFAULT '{}',
  subjects TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own interests"
  ON user_interests FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 2. 출석 체크 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  streak INT DEFAULT 1,
  base_points INT DEFAULT 10,
  bonus_points INT DEFAULT 0,
  total_points INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, check_date)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attendance"
  ON attendance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can check in"
  ON attendance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 3. 룰렛 기록 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS roulette_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  spin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  points_won INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, spin_date)
);

ALTER TABLE roulette_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roulette"
  ON roulette_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can spin roulette"
  ON roulette_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 4. 이벤트 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('quiz', 'first_come', 'comment')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'ended')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  max_participants INT,
  current_participants INT DEFAULT 0,
  target_grades TEXT[],
  -- Quiz specific
  quiz_type TEXT CHECK (quiz_type IN ('ox', 'multiple_choice')),
  difficulty TEXT CHECK (difficulty IN ('easy', 'normal', 'hard')),
  -- Reward
  points_reward INT DEFAULT 50,
  -- First-come specific
  mission_type TEXT CHECK (mission_type IN ('button_only', 'comment_required')),
  -- Comment event specific
  min_length INT,
  min_points INT,
  max_points INT,
  -- Metadata
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active events"
  ON events FOR SELECT
  USING (status IN ('active', 'scheduled') OR auth.uid() = created_by);

CREATE POLICY "Admins can manage events"
  ON events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND email = 'skypeople41@gmail.com'
    )
  );

-- =====================================================
-- 5. 퀴즈 문제 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('ox', 'multiple_choice')),
  correct_answer TEXT NOT NULL,
  choices JSONB, -- {"A": "선택지1", "B": "선택지2", ...}
  explanation TEXT,
  grade TEXT,
  subject TEXT,
  order_num INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view quiz questions for active events"
  ON quiz_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = quiz_questions.event_id
      AND events.status = 'active'
    )
  );

CREATE POLICY "Admins can manage quiz questions"
  ON quiz_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND email = 'skypeople41@gmail.com'
    )
  );

-- =====================================================
-- 6. 이벤트 참여 기록 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS event_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Quiz specific
  answers JSONB,
  correct_count INT,
  -- Comment specific
  comment_text TEXT,
  ai_score INT,
  ai_feedback TEXT,
  admin_approved BOOLEAN,
  admin_adjusted_score INT,
  -- General
  points_earned INT DEFAULT 0,
  participated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE event_participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own participations"
  ON event_participations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can participate"
  ON event_participations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all participations"
  ON event_participations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND email = 'skypeople41@gmail.com'
    )
  );

-- =====================================================
-- 7. 메시지/쪽지 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('all', 'grade_group', 'individual')),
  recipient_grades TEXT[],
  message_type TEXT NOT NULL CHECK (message_type IN ('notice', 'inquiry', 'inquiry_reply', 'system')),
  parent_id UUID REFERENCES messages(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  inquiry_type TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  USING (
    recipient_id = auth.uid()
    OR (recipient_type = 'all')
    OR (
      recipient_type = 'grade_group'
      AND EXISTS (
        SELECT 1 FROM user_interests
        WHERE user_id = auth.uid()
        AND grades && messages.recipient_grades
      )
    )
    OR sender_id = auth.uid()
  );

CREATE POLICY "Users can send inquiries"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND message_type = 'inquiry'
  );

CREATE POLICY "Admins can send messages"
  ON messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND email = 'skypeople41@gmail.com'
    )
  );

-- =====================================================
-- 8. 워크시트 문의 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS worksheet_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id UUID NOT NULL REFERENCES worksheets(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reply TEXT,
  replied_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE worksheet_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inquiries for own worksheets"
  ON worksheet_inquiries FOR SELECT
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Users can send inquiries to worksheets"
  ON worksheet_inquiries FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Sellers can reply to inquiries"
  ON worksheet_inquiries FOR UPDATE
  USING (auth.uid() = seller_id);

-- =====================================================
-- 함수들 (기존 것 대체)
-- =====================================================

-- 출석 체크 함수
CREATE OR REPLACE FUNCTION check_attendance()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - 1;
  v_streak INT := 1;
  v_base_points INT := 10;
  v_bonus_points INT := 0;
  v_total_points INT;
  v_new_balance INT;
  v_existing RECORD;
  v_yesterday_record RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', '인증이 필요합니다.');
  END IF;

  -- 오늘 이미 출석했는지 확인
  SELECT * INTO v_existing FROM attendance
  WHERE user_id = v_user_id AND check_date = v_today;

  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', '이미 오늘 출석하셨습니다.');
  END IF;

  -- 어제 출석 기록 확인 (연속 출석)
  SELECT * INTO v_yesterday_record FROM attendance
  WHERE user_id = v_user_id AND check_date = v_yesterday;

  IF v_yesterday_record IS NOT NULL THEN
    v_streak := v_yesterday_record.streak + 1;
  END IF;

  -- 연속 출석 보너스
  IF v_streak >= 30 THEN
    v_bonus_points := 50;
  ELSIF v_streak >= 7 THEN
    v_bonus_points := 20;
  END IF;

  v_total_points := v_base_points + v_bonus_points;

  -- 출석 기록 저장
  INSERT INTO attendance (user_id, check_date, streak, base_points, bonus_points, total_points)
  VALUES (v_user_id, v_today, v_streak, v_base_points, v_bonus_points, v_total_points);

  -- 포인트 지급
  UPDATE public.profiles
  SET points = points + v_total_points
  WHERE id = v_user_id
  RETURNING points INTO v_new_balance;

  -- 포인트 기록
  INSERT INTO point_transactions (user_id, type, amount, description)
  VALUES (v_user_id, 'attendance', v_total_points, '출석 체크 (' || v_streak || '일 연속)');

  RETURN json_build_object(
    'success', true,
    'streak', v_streak,
    'base_points', v_base_points,
    'bonus_points', v_bonus_points,
    'total_points', v_total_points,
    'new_balance', v_new_balance
  );
END;
$$;

-- 룰렛 돌리기 함수
CREATE OR REPLACE FUNCTION spin_roulette()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_today DATE := CURRENT_DATE;
  v_existing RECORD;
  v_prizes INT[] := ARRAY[5, 10, 15, 20, 30, 50];
  v_weights INT[] := ARRAY[30, 25, 20, 15, 7, 3]; -- 확률 가중치
  v_total_weight INT := 100;
  v_random INT;
  v_cumulative INT := 0;
  v_points_won INT;
  v_new_balance INT;
  i INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', '인증이 필요합니다.');
  END IF;

  -- 오늘 이미 룰렛 돌렸는지 확인
  SELECT * INTO v_existing FROM roulette_history
  WHERE user_id = v_user_id AND spin_date = v_today;

  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', '오늘은 이미 룰렛을 돌리셨습니다.');
  END IF;

  -- 랜덤 선택
  v_random := floor(random() * v_total_weight)::INT;
  FOR i IN 1..array_length(v_prizes, 1) LOOP
    v_cumulative := v_cumulative + v_weights[i];
    IF v_random < v_cumulative THEN
      v_points_won := v_prizes[i];
      EXIT;
    END IF;
  END LOOP;

  -- 기본값 (혹시 모를 경우)
  IF v_points_won IS NULL THEN
    v_points_won := 5;
  END IF;

  -- 룰렛 기록 저장
  INSERT INTO roulette_history (user_id, spin_date, points_won)
  VALUES (v_user_id, v_today, v_points_won);

  -- 포인트 지급
  UPDATE public.profiles
  SET points = points + v_points_won
  WHERE id = v_user_id
  RETURNING points INTO v_new_balance;

  -- 포인트 기록
  INSERT INTO point_transactions (user_id, type, amount, description)
  VALUES (v_user_id, 'roulette', v_points_won, '일일 룰렛 당첨');

  RETURN json_build_object(
    'success', true,
    'points_won', v_points_won,
    'new_balance', v_new_balance
  );
END;
$$;

-- 선착순 이벤트 참여 함수
CREATE OR REPLACE FUNCTION participate_first_come(
  p_event_id UUID,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_event RECORD;
  v_position INT;
  v_points_earned INT;
  v_new_balance INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', '인증이 필요합니다.');
  END IF;

  -- 이벤트 조회 (락)
  SELECT * INTO v_event FROM events
  WHERE id = p_event_id
  FOR UPDATE;

  IF v_event IS NULL THEN
    RETURN json_build_object('success', false, 'error', '이벤트를 찾을 수 없습니다.');
  END IF;

  IF v_event.status != 'active' THEN
    RETURN json_build_object('success', false, 'error', '진행 중인 이벤트가 아닙니다.');
  END IF;

  IF v_event.max_participants IS NOT NULL AND v_event.current_participants >= v_event.max_participants THEN
    RETURN json_build_object('success', false, 'error', '이미 마감되었습니다.');
  END IF;

  -- 이미 참여했는지 확인
  IF EXISTS (SELECT 1 FROM event_participations WHERE event_id = p_event_id AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', '이미 참여하셨습니다.');
  END IF;

  -- 댓글 필수인데 없는 경우
  IF v_event.mission_type = 'comment_required' AND (p_comment IS NULL OR length(trim(p_comment)) < 1) THEN
    RETURN json_build_object('success', false, 'error', '댓글을 입력해주세요.');
  END IF;

  -- 참여 순번
  v_position := v_event.current_participants + 1;
  v_points_earned := v_event.points_reward;

  -- 참여 기록
  INSERT INTO event_participations (event_id, user_id, comment_text, points_earned)
  VALUES (p_event_id, v_user_id, p_comment, v_points_earned);

  -- 참여자 수 증가
  UPDATE events SET current_participants = current_participants + 1
  WHERE id = p_event_id;

  -- 포인트 지급
  UPDATE public.profiles
  SET points = points + v_points_earned
  WHERE id = v_user_id
  RETURNING points INTO v_new_balance;

  -- 포인트 기록
  INSERT INTO point_transactions (user_id, type, amount, description)
  VALUES (v_user_id, 'first_come_event', v_points_earned, v_event.title || ' 이벤트 참여');

  RETURN json_build_object(
    'success', true,
    'position', v_position,
    'points_earned', v_points_earned,
    'new_balance', v_new_balance
  );
END;
$$;

-- 관리자 체크 함수
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND email = 'skypeople41@gmail.com'
  );
END;
$$;

-- 완료 메시지
SELECT '관리자/이벤트 스키마가 성공적으로 적용되었습니다.' AS result;
