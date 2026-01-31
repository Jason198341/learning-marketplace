// Gemini AI 서비스 - 퀴즈 생성 & 댓글 채점

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// =====================================================
// 퀴즈 문제 생성
// =====================================================

export interface QuizQuestion {
  question: string;
  questionType: 'ox' | 'multiple_choice';
  correctAnswer: string;
  choices?: Record<string, string>;
  explanation: string;
}

export interface GenerateQuizParams {
  grade: string;      // 예: 'elementary_3', 'middle_1', 'high_2'
  subject: string;    // 예: 'math', 'korean', 'english', 'science'
  count: number;      // 문제 수
  difficulty: 'easy' | 'normal' | 'hard';
  type: 'ox' | 'multiple_choice' | 'mixed';
}

const GRADE_NAMES: Record<string, string> = {
  elementary_1: '초등학교 1학년',
  elementary_2: '초등학교 2학년',
  elementary_3: '초등학교 3학년',
  elementary_4: '초등학교 4학년',
  elementary_5: '초등학교 5학년',
  elementary_6: '초등학교 6학년',
  middle_1: '중학교 1학년',
  middle_2: '중학교 2학년',
  middle_3: '중학교 3학년',
  high_1: '고등학교 1학년',
  high_2: '고등학교 2학년',
  high_3: '고등학교 3학년',
};

const SUBJECT_NAMES: Record<string, string> = {
  korean: '국어',
  math: '수학',
  english: '영어',
  science: '과학',
  social: '사회',
};

const DIFFICULTY_NAMES: Record<string, string> = {
  easy: '쉬움',
  normal: '보통',
  hard: '어려움',
};

export async function generateQuizQuestions(params: GenerateQuizParams): Promise<QuizQuestion[]> {
  console.log('[Gemini] 퀴즈 생성 요청:', params);

  if (!GEMINI_API_KEY) {
    console.log('[Gemini] API 키 없음, 샘플 퀴즈 반환');
    return getSampleQuestions(params);
  }

  const gradeName = GRADE_NAMES[params.grade] || params.grade;
  const subjectName = SUBJECT_NAMES[params.subject] || params.subject;
  const difficultyName = DIFFICULTY_NAMES[params.difficulty] || params.difficulty;

  const typeInstruction = params.type === 'ox'
    ? 'OX 퀴즈만 생성하세요. correctAnswer는 "O" 또는 "X"입니다.'
    : params.type === 'multiple_choice'
    ? '4지선다 객관식만 생성하세요. choices에 A, B, C, D 선택지를 포함하고 correctAnswer는 "A", "B", "C", "D" 중 하나입니다.'
    : 'OX와 객관식을 섞어서 생성하세요.';

  const prompt = `당신은 한국 ${gradeName} ${subjectName} 교사입니다.
학생들을 위한 퀴즈 문제 ${params.count}개를 생성하세요.

【조건】
- 학년: ${gradeName}
- 과목: ${subjectName}
- 난이도: ${difficultyName}
- ${typeInstruction}

【필수 응답 형식 - JSON 배열만 출력】
[
  {
    "question": "문제 내용",
    "questionType": "ox 또는 multiple_choice",
    "correctAnswer": "정답",
    "choices": {"A": "선택지1", "B": "선택지2", "C": "선택지3", "D": "선택지4"},
    "explanation": "정답 해설"
  }
]

주의: OX 퀴즈는 choices를 포함하지 마세요.
반드시 JSON 배열만 출력하세요.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API 오류: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // JSON 파싱
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((q: any) => ({
        question: q.question,
        questionType: q.questionType,
        correctAnswer: q.correctAnswer,
        choices: q.choices || undefined,
        explanation: q.explanation || '',
      }));
    }

    throw new Error('JSON 파싱 실패');
  } catch (error) {
    console.error('[Gemini] 퀴즈 생성 실패:', error);
    return getSampleQuestions(params);
  }
}

function getSampleQuestions(params: GenerateQuizParams): QuizQuestion[] {
  const samples: QuizQuestion[] = [];

  for (let i = 0; i < params.count; i++) {
    if (params.type === 'ox' || (params.type === 'mixed' && i % 2 === 0)) {
      samples.push({
        question: `[샘플] ${SUBJECT_NAMES[params.subject] || params.subject} OX 문제 ${i + 1}`,
        questionType: 'ox',
        correctAnswer: Math.random() > 0.5 ? 'O' : 'X',
        explanation: '이것은 샘플 문제입니다. Gemini API 키를 설정하면 실제 문제가 생성됩니다.',
      });
    } else {
      samples.push({
        question: `[샘플] ${SUBJECT_NAMES[params.subject] || params.subject} 객관식 문제 ${i + 1}`,
        questionType: 'multiple_choice',
        correctAnswer: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
        choices: {
          A: '선택지 A',
          B: '선택지 B',
          C: '선택지 C',
          D: '선택지 D',
        },
        explanation: '이것은 샘플 문제입니다.',
      });
    }
  }

  return samples;
}

// =====================================================
// 댓글 채점
// =====================================================

export interface CommentScore {
  score: number;        // 0-100
  feedback: string;
  criteria: {
    relevance: number;  // 주제 관련성 (0-25)
    quality: number;    // 내용 품질 (0-25)
    length: number;     // 적정 길이 (0-25)
    creativity: number; // 창의성 (0-25)
  };
}

export async function scoreComment(
  eventTitle: string,
  eventDescription: string,
  comment: string
): Promise<CommentScore> {
  console.log('[Gemini] 댓글 채점 요청');

  if (!GEMINI_API_KEY) {
    console.log('[Gemini] API 키 없음, 랜덤 점수 반환');
    return getRandomScore(comment);
  }

  const prompt = `당신은 이벤트 댓글을 평가하는 AI입니다.

【이벤트 정보】
- 제목: ${eventTitle}
- 설명: ${eventDescription || '없음'}

【평가할 댓글】
${comment}

【평가 기준 (각 항목 0-25점, 총 100점)】
1. relevance: 이벤트 주제와의 관련성
2. quality: 내용의 깊이와 품질
3. length: 적정 길이 (너무 짧거나 길지 않은지)
4. creativity: 창의적인 표현과 독창성

【필수 응답 형식 - JSON만 출력】
{
  "score": 총점(0-100),
  "feedback": "한국어로 1-2문장 피드백",
  "criteria": {
    "relevance": 점수,
    "quality": 점수,
    "length": 점수,
    "creativity": 점수
  }
}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API 오류: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: Math.min(100, Math.max(0, parsed.score || 50)),
        feedback: parsed.feedback || '평가 완료',
        criteria: {
          relevance: parsed.criteria?.relevance || 15,
          quality: parsed.criteria?.quality || 15,
          length: parsed.criteria?.length || 15,
          creativity: parsed.criteria?.creativity || 15,
        },
      };
    }

    throw new Error('JSON 파싱 실패');
  } catch (error) {
    console.error('[Gemini] 댓글 채점 실패:', error);
    return getRandomScore(comment);
  }
}

function getRandomScore(comment: string): CommentScore {
  // 길이 기반 기본 점수
  const lengthScore = Math.min(25, Math.floor(comment.length / 4));
  const baseScore = 40 + Math.floor(Math.random() * 30);

  return {
    score: Math.min(100, baseScore + lengthScore),
    feedback: '댓글이 접수되었습니다. 관리자 검토 후 포인트가 지급됩니다.',
    criteria: {
      relevance: 15 + Math.floor(Math.random() * 10),
      quality: 15 + Math.floor(Math.random() * 10),
      length: lengthScore,
      creativity: 10 + Math.floor(Math.random() * 15),
    },
  };
}
