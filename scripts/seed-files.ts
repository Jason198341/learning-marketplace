import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ieseudievpxqmdsezvyx.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_KEY 환경변수가 필요합니다.');
  console.log('Supabase Dashboard > Settings > API > service_role key를 복사하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedFiles() {
  console.log('파일 업로드 시작...');

  // 1. worksheets 목록 가져오기
  const { data: worksheets, error } = await supabase
    .from('worksheets')
    .select('id, title, seller_id')
    .limit(150);

  if (error) {
    console.error('워크시트 조회 실패:', error);
    return;
  }

  console.log(`${worksheets.length}개 워크시트 발견`);

  // 2. 각 워크시트에 텍스트 파일 업로드
  for (let i = 0; i < worksheets.length; i++) {
    const ws = worksheets[i];
    const fileName = `${ws.seller_id}/${i + 1}.txt`;
    const fileContent = `
========================================
${ws.title}
========================================

이것은 테스트 워크시트 파일입니다.
워크시트 ID: ${ws.id}

[학습 목표]
1. 기본 개념을 이해한다
2. 문제 해결 능력을 기른다
3. 응용력을 향상시킨다

[문제 1]
다음 중 올바른 것을 고르시오.
① 보기 1
② 보기 2
③ 보기 3
④ 보기 4

[문제 2]
다음 빈칸에 알맞은 답을 쓰시오.
__________________

[문제 3]
다음을 설명하시오.
__________________
__________________
__________________

========================================
© 2024 학습장터 - 테스트 파일 #${i + 1}
========================================
`;

    // Storage에 업로드
    const { error: uploadError } = await supabase.storage
      .from('worksheets')
      .upload(fileName, fileContent, {
        contentType: 'text/plain; charset=utf-8',
        upsert: true,
      });

    if (uploadError) {
      console.error(`파일 ${i + 1} 업로드 실패:`, uploadError.message);
      continue;
    }

    // DB 업데이트
    const { error: updateError } = await supabase
      .from('worksheets')
      .update({ file_url: fileName })
      .eq('id', ws.id);

    if (updateError) {
      console.error(`워크시트 ${i + 1} 업데이트 실패:`, updateError.message);
      continue;
    }

    if ((i + 1) % 10 === 0) {
      console.log(`${i + 1}/${worksheets.length} 완료`);
    }
  }

  console.log('파일 업로드 완료!');
}

seedFiles();
