-- =============================================
-- 관리자/이벤트 시스템 스키마
-- profiles 테이블 참조 (기존 스키마와 호환)
-- =============================================

-- 1. 회원 관심 학년 테이블
CREATE TABLE IF NOT EXISTS public.user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  grade_group TEXT NOT NULL CHECK (grade_group IN ('elementary_1_2', 'elementary_3_4', 'elementary_5_6', 'middle', 'high')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, grade_group)
);

-- 2. 출석 체크 테이블
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  points_earned INTEGER NOT NULL DEFAULT 10,
  streak_days INTEGER NOT NULL DEFAULT 1,
  bonus_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, check_date)
);

-- 3. 룰렛 기록 테이블
CREATE TABLE IF NOT EXISTS public.roulette_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  spin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  points_won INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, spin_date)
);

-- 4. 이벤트 테이블 (퀴즈, 선착순, 댓글)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('quiz', 'first_come', 'comment')),
  title TEXT NOT NULL,
  description TEXT,

  -- 공통
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'ended')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  max_participants INTEGER,
  current_participants INTEGER DEFAULT 0,

  -- 대상 학년 (NULL이면 전체)
  target_grades TEXT[], -- ['elementary_3_4', 'elementary_5_6']

  -- 퀴즈 전용
  quiz_type TEXT CHECK (quiz_type IN ('ox', 'multiple_choice')),
  difficulty TEXT CHECK (difficulty IN ('easy', 'normal', 'hard')),
  points_reward INTEGER NOT NULL DEFAULT 50,

  -- 선착순 전용
  mission_type TEXT CHECK (mission_type IN ('button_only', 'comment_required')),

  -- 댓글 이벤트 전용
  min_length INTEGER DEFAULT 30,
  min_points INTEGER DEFAULT 10,
  max_points INTEGER DEFAULT 50,

  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 퀴즈 문제 테이블
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  question TEXT NOT NULL,

  -- O/X 또는 객관식
  question_type TEXT NOT NULL CHECK (question_type IN ('ox', 'multiple_choice')),

  -- O/X: 'O' 또는 'X'
  -- 객관식: '1', '2', '3', '4'
  correct_answer TEXT NOT NULL,

  -- 객관식 보기 (JSON)
  choices JSONB, -- {"1": "선택지1", "2": "선택지2", "3": "선택지3", "4": "선택지4"}

  -- 해설
  explanation TEXT,

  -- 학년/과목 (Gemini 생성용)
  grade TEXT,
  subject TEXT,

  order_num INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 이벤트 참여 기록
CREATE TABLE IF NOT EXISTS public.event_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- 퀴즈: 정답 여부
  is_correct BOOLEAN,
  submitted_answer TEXT,

  -- 댓글 이벤트: AI 점수 및 승인
  comment_text TEXT,
  ai_score INTEGER,
  ai_feedback TEXT,
  admin_approved BOOLEAN,
  admin_adjusted_score INTEGER,

  -- 지급된 포인트
  points_earned INTEGER DEFAULT 0,

  participated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- 7. 쪽지 테이블
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 발신자 (NULL이면 시스템/관리자)
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- 수신자 (개별 쪽지)
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- 전체/학년별 발송 (recipient_id가 NULL일 때)
  recipient_type TEXT CHECK (recipient_type IN ('all', 'grade_group', 'individual')),
  recipient_grades TEXT[], -- target grade groups

  -- 메시지 유형
  message_type TEXT NOT NULL DEFAULT 'general' CHECK (message_type IN ('general', 'notice', 'inquiry', 'inquiry_reply')),

  -- 문의 유형 (inquiry일 때)
  inquiry_type TEXT CHECK (inquiry_type IN ('suggestion', 'bug', 'points', 'other')),

  -- 답장 관련
  parent_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  content TEXT NOT NULL,

  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 자료 문의 테이블 (구매자 ↔ 판매자)
CREATE TABLE IF NOT EXISTS public.worksheet_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id UUID NOT NULL REFERENCES public.worksheets(id) ON DELETE CASCADE,

  -- 대화 참여자
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- 메시지
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,

  -- 대화 스레드 (첫 메시지의 ID)
  thread_id UUID,

  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 포인트 히스토리 테이블 (기존 point_transactions 확장)
-- 기존 테이블에 새 type 추가
ALTER TABLE public.point_transactions
DROP CONSTRAINT IF EXISTS point_transactions_type_check;

ALTER TABLE public.point_transactions
ADD CONSTRAINT point_transactions_type_check
CHECK (type IN (
  'signup_bonus', 'purchase', 'sale', 'feedback_refund', 'admin_charge',
  'attendance', 'attendance_bonus', 'roulette',
  'quiz', 'first_come', 'comment_event',
  'review', 'upload', 'admin_grant', 'admin_deduct'
));

-- =============================================
-- 인덱스
-- =============================================

CREATE INDEX IF NOT EXISTS idx_user_interests_user ON public.user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, check_date);
CREATE INDEX IF NOT EXISTS idx_roulette_user_date ON public.roulette_history(user_id, spin_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(type);
CREATE INDEX IF NOT EXISTS idx_event_participations_event ON public.event_participations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participations_user ON public.event_participations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_worksheet_inquiries_worksheet ON public.worksheet_inquiries(worksheet_id);
CREATE INDEX IF NOT EXISTS idx_worksheet_inquiries_thread ON public.worksheet_inquiries(thread_id);

-- =============================================
-- RLS 정책
-- =============================================

ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roulette_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worksheet_inquiries ENABLE ROW LEVEL SECURITY;

-- user_interests: 본인만 조회/수정
CREATE POLICY "Users can manage own interests" ON public.user_interests
  FOR ALL USING (auth.uid() = user_id);

-- attendance: 본인만 조회
CREATE POLICY "Users can view own attendance" ON public.attendance
  FOR SELECT USING (auth.uid() = user_id);

-- roulette_history: 본인만 조회
CREATE POLICY "Users can view own roulette" ON public.roulette_history
  FOR SELECT USING (auth.uid() = user_id);

-- events: 활성화된 이벤트는 모두 조회 가능
CREATE POLICY "Anyone can view active events" ON public.events
  FOR SELECT USING (status IN ('active', 'ended', 'scheduled'));

-- 관리자는 모든 이벤트 관리 가능
CREATE POLICY "Admin can manage all events" ON public.events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND email = 'skypeople41@gmail.com')
  );

-- quiz_questions: 이벤트 참여자 조회 가능
CREATE POLICY "Users can view quiz questions" ON public.quiz_questions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND status IN ('active', 'ended'))
  );

-- 관리자는 퀴즈 문제 관리 가능
CREATE POLICY "Admin can manage quiz questions" ON public.quiz_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND email = 'skypeople41@gmail.com')
  );

-- event_participations: 본인 기록만 조회
CREATE POLICY "Users can view own participations" ON public.event_participations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own participation" ON public.event_participations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 관리자는 모든 참여 기록 조회/수정 가능
CREATE POLICY "Admin can manage participations" ON public.event_participations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND email = 'skypeople41@gmail.com')
  );

-- messages: 본인이 발신/수신한 것만
CREATE POLICY "Users can view own messages" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id
    OR auth.uid() = recipient_id
    OR (recipient_id IS NULL AND recipient_type = 'all')
    OR (recipient_id IS NULL AND recipient_type = 'grade_group' AND recipient_grades && (
      SELECT ARRAY_AGG(grade_group) FROM public.user_interests WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own received messages" ON public.messages
  FOR UPDATE USING (auth.uid() = recipient_id);

-- 관리자는 모든 메시지 관리 가능
CREATE POLICY "Admin can manage all messages" ON public.messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND email = 'skypeople41@gmail.com')
  );

-- worksheet_inquiries: 구매자/판매자만
CREATE POLICY "Buyer and seller can view inquiries" ON public.worksheet_inquiries
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyer and seller can send inquiries" ON public.worksheet_inquiries
  FOR INSERT WITH CHECK (auth.uid() = sender_id AND (auth.uid() = buyer_id OR auth.uid() = seller_id));

CREATE POLICY "Users can update own inquiries" ON public.worksheet_inquiries
  FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- =============================================
-- 함수: 출석 체크
-- =============================================

CREATE OR REPLACE FUNCTION public.check_attendance()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - 1;
  v_streak INTEGER := 1;
  v_base_points INTEGER := 10;
  v_bonus INTEGER := 0;
  v_total INTEGER;
  v_existing RECORD;
  v_yesterday_record RECORD;
  v_new_balance INTEGER;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', '로그인이 필요합니다');
  END IF;

  -- 오늘 이미 출석했는지 확인
  SELECT * INTO v_existing FROM public.attendance WHERE user_id = v_user_id AND check_date = v_today;
  IF FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', '오늘은 이미 출석했습니다',
      'streak', v_existing.streak_days,
      'points_earned', v_existing.points_earned + v_existing.bonus_points
    );
  END IF;

  -- 어제 출석 기록 확인 (연속 출석)
  SELECT * INTO v_yesterday_record FROM public.attendance WHERE user_id = v_user_id AND check_date = v_yesterday;
  IF FOUND THEN
    v_streak := v_yesterday_record.streak_days + 1;
  END IF;

  -- 연속 출석 보너스
  IF v_streak = 7 THEN
    v_bonus := 30;
  ELSIF v_streak = 30 THEN
    v_bonus := 100;
  ELSIF v_streak > 30 AND v_streak % 30 = 0 THEN
    v_bonus := 100;
  END IF;

  v_total := v_base_points + v_bonus;

  -- 출석 기록 삽입
  INSERT INTO public.attendance (user_id, check_date, points_earned, streak_days, bonus_points)
  VALUES (v_user_id, v_today, v_base_points, v_streak, v_bonus);

  -- 포인트 지급
  UPDATE public.profiles SET points = points + v_total WHERE id = v_user_id
  RETURNING points INTO v_new_balance;

  -- 포인트 히스토리 (출석)
  INSERT INTO public.point_transactions (user_id, type, amount, balance, description)
  VALUES (v_user_id, 'attendance', v_base_points, v_new_balance - v_bonus, '출석 체크 (' || v_streak || '일차)');

  -- 포인트 히스토리 (보너스)
  IF v_bonus > 0 THEN
    INSERT INTO public.point_transactions (user_id, type, amount, balance, description)
    VALUES (v_user_id, 'attendance_bonus', v_bonus, v_new_balance,
      CASE
        WHEN v_streak = 7 THEN '7일 연속 출석 보너스'
        WHEN v_streak = 30 THEN '30일 연속 출석 보너스'
        ELSE v_streak || '일 연속 출석 보너스'
      END
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'streak', v_streak,
    'base_points', v_base_points,
    'bonus_points', v_bonus,
    'total_points', v_total,
    'new_balance', v_new_balance
  );
END;
$$;

-- =============================================
-- 함수: 룰렛 돌리기
-- =============================================

CREATE OR REPLACE FUNCTION public.spin_roulette()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_today DATE := CURRENT_DATE;
  v_points INTEGER;
  v_existing RECORD;
  v_new_balance INTEGER;
  v_rand FLOAT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', '로그인이 필요합니다');
  END IF;

  -- 오늘 이미 돌렸는지 확인
  SELECT * INTO v_existing FROM public.roulette_history WHERE user_id = v_user_id AND spin_date = v_today;
  IF FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', '오늘은 이미 룰렛을 돌렸습니다',
      'points_won', v_existing.points_won
    );
  END IF;

  -- 랜덤 포인트 (5, 10, 15, 20, 30, 50 중 가중치 적용)
  -- 5P: 30%, 10P: 30%, 15P: 20%, 20P: 10%, 30P: 7%, 50P: 3%
  v_rand := random();
  v_points := CASE
    WHEN v_rand < 0.30 THEN 5
    WHEN v_rand < 0.60 THEN 10
    WHEN v_rand < 0.80 THEN 15
    WHEN v_rand < 0.90 THEN 20
    WHEN v_rand < 0.97 THEN 30
    ELSE 50
  END;

  -- 룰렛 기록
  INSERT INTO public.roulette_history (user_id, spin_date, points_won)
  VALUES (v_user_id, v_today, v_points);

  -- 포인트 지급
  UPDATE public.profiles SET points = points + v_points WHERE id = v_user_id
  RETURNING points INTO v_new_balance;

  -- 포인트 히스토리
  INSERT INTO public.point_transactions (user_id, type, amount, balance, description)
  VALUES (v_user_id, 'roulette', v_points, v_new_balance, '일일 룰렛 ' || v_points || 'P 당첨');

  RETURN json_build_object(
    'success', true,
    'points_won', v_points,
    'new_balance', v_new_balance
  );
END;
$$;

-- =============================================
-- 함수: 관리자 확인
-- =============================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND email = 'skypeople41@gmail.com'
  );
$$;

-- =============================================
-- 함수: 선착순 이벤트 참여
-- =============================================

CREATE OR REPLACE FUNCTION public.participate_first_come(p_event_id UUID, p_comment TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_event RECORD;
  v_new_balance INTEGER;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', '로그인이 필요합니다');
  END IF;

  -- 이벤트 조회 (락)
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', '이벤트를 찾을 수 없습니다');
  END IF;

  IF v_event.type != 'first_come' THEN
    RETURN json_build_object('success', false, 'error', '선착순 이벤트가 아닙니다');
  END IF;

  IF v_event.status != 'active' THEN
    RETURN json_build_object('success', false, 'error', '진행 중인 이벤트가 아닙니다');
  END IF;

  IF v_event.max_participants IS NOT NULL AND v_event.current_participants >= v_event.max_participants THEN
    RETURN json_build_object('success', false, 'error', '마감되었습니다');
  END IF;

  -- 이미 참여했는지 확인
  IF EXISTS (SELECT 1 FROM public.event_participations WHERE event_id = p_event_id AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', '이미 참여했습니다');
  END IF;

  -- 코멘트 필수인 경우 확인
  IF v_event.mission_type = 'comment_required' AND (p_comment IS NULL OR LENGTH(TRIM(p_comment)) < 1) THEN
    RETURN json_build_object('success', false, 'error', '한마디를 입력해주세요');
  END IF;

  -- 참여 기록
  INSERT INTO public.event_participations (event_id, user_id, comment_text, points_earned)
  VALUES (p_event_id, v_user_id, p_comment, v_event.points_reward);

  -- 참여자 수 증가
  UPDATE public.events SET current_participants = current_participants + 1 WHERE id = p_event_id;

  -- 마감 체크
  IF v_event.max_participants IS NOT NULL AND v_event.current_participants + 1 >= v_event.max_participants THEN
    UPDATE public.events SET status = 'ended' WHERE id = p_event_id;
  END IF;

  -- 포인트 지급
  UPDATE public.profiles SET points = points + v_event.points_reward WHERE id = v_user_id
  RETURNING points INTO v_new_balance;

  -- 포인트 히스토리
  INSERT INTO public.point_transactions (user_id, type, amount, balance, description, related_id)
  VALUES (v_user_id, 'first_come', v_event.points_reward, v_new_balance, '선착순 이벤트: ' || v_event.title, p_event_id);

  RETURN json_build_object(
    'success', true,
    'points_earned', v_event.points_reward,
    'new_balance', v_new_balance,
    'position', v_event.current_participants + 1
  );
END;
$$;

-- =============================================
-- 완료!
-- =============================================
