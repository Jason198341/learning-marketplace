-- 이벤트 참여 함수 수정 (오류 수정)

-- 1. point_transactions 테이블에 새 타입 허용 (이미 있으면 무시)
DO $$
BEGIN
  -- Check if the constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'point_transactions_type_check'
    AND table_name = 'point_transactions'
  ) THEN
    ALTER TABLE point_transactions DROP CONSTRAINT point_transactions_type_check;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. 선착순 이벤트 참여 함수 재생성
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

  -- 선착순 이벤트인 경우 인원 체크
  IF v_event.type = 'first_come' AND v_event.max_participants IS NOT NULL
     AND v_event.current_participants >= v_event.max_participants THEN
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

  -- 댓글 이벤트인 경우 최소 글자수 체크
  IF v_event.type = 'comment' AND v_event.min_length IS NOT NULL
     AND (p_comment IS NULL OR length(trim(p_comment)) < v_event.min_length) THEN
    RETURN json_build_object('success', false, 'error', '최소 ' || v_event.min_length || '자 이상 작성해주세요.');
  END IF;

  -- 참여 순번
  v_position := v_event.current_participants + 1;

  -- 댓글 이벤트는 승인 후 포인트 지급, 선착순은 바로 지급
  IF v_event.type = 'comment' THEN
    v_points_earned := 0; -- 관리자 승인 후 지급
  ELSE
    v_points_earned := v_event.points_reward;
  END IF;

  -- 참여 기록
  INSERT INTO event_participations (event_id, user_id, comment_text, points_earned)
  VALUES (p_event_id, v_user_id, p_comment, v_points_earned);

  -- 참여자 수 증가
  UPDATE events SET current_participants = current_participants + 1
  WHERE id = p_event_id;

  -- 선착순 이벤트는 바로 포인트 지급
  IF v_event.type != 'comment' AND v_points_earned > 0 THEN
    UPDATE public.profiles
    SET points = points + v_points_earned
    WHERE id = v_user_id
    RETURNING points INTO v_new_balance;

    -- 포인트 기록
    INSERT INTO point_transactions (user_id, type, amount, description)
    VALUES (v_user_id, 'event', v_points_earned, v_event.title || ' 이벤트 참여');
  ELSE
    SELECT points INTO v_new_balance FROM public.profiles WHERE id = v_user_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'position', v_position,
    'points_earned', v_points_earned,
    'new_balance', v_new_balance,
    'awaiting_approval', v_event.type = 'comment'
  );
END;
$$;

-- 3. 댓글 이벤트 심사 기준 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'review_criteria'
  ) THEN
    ALTER TABLE events ADD COLUMN review_criteria TEXT;
  END IF;
END $$;

-- 완료
SELECT '이벤트 함수가 수정되었습니다.' AS result;
