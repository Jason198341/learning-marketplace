import { useState } from 'react';
import { Sparkles, Check, RefreshCw } from 'lucide-react';
import { Button, Badge } from '@/components/common';
import { useToast } from '@/components/common/Toast';
import { generateQuizQuestions, QuizQuestion } from '@/services/gemini';
import { api } from '@/services/api';

interface QuizGeneratorProps {
  eventId: string;
  onComplete: () => void;
  onClose: () => void;
}

const GRADES = [
  { value: 'elementary_3', label: '초3' },
  { value: 'elementary_4', label: '초4' },
  { value: 'elementary_5', label: '초5' },
  { value: 'elementary_6', label: '초6' },
  { value: 'middle_1', label: '중1' },
  { value: 'middle_2', label: '중2' },
  { value: 'middle_3', label: '중3' },
  { value: 'high_1', label: '고1' },
  { value: 'high_2', label: '고2' },
  { value: 'high_3', label: '고3' },
];

const SUBJECTS = [
  { value: 'korean', label: '국어' },
  { value: 'math', label: '수학' },
  { value: 'english', label: '영어' },
  { value: 'science', label: '과학' },
  { value: 'social', label: '사회' },
];

const DIFFICULTIES = [
  { value: 'easy', label: '쉬움' },
  { value: 'normal', label: '보통' },
  { value: 'hard', label: '어려움' },
];

const TYPES = [
  { value: 'ox', label: 'OX 퀴즈' },
  { value: 'multiple_choice', label: '객관식' },
  { value: 'mixed', label: '혼합' },
];

export function QuizGenerator({ eventId, onComplete, onClose }: QuizGeneratorProps) {
  const toast = useToast();
  const [step, setStep] = useState<'config' | 'preview' | 'saving'>('config');

  const [config, setConfig] = useState({
    grade: 'elementary_5',
    subject: 'math',
    count: 5,
    difficulty: 'normal' as 'easy' | 'normal' | 'hard',
    type: 'mixed' as 'ox' | 'multiple_choice' | 'mixed',
  });

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await generateQuizQuestions({
        grade: config.grade,
        subject: config.subject,
        count: config.count,
        difficulty: config.difficulty,
        type: config.type,
      });
      setQuestions(result);
      setStep('preview');
      toast.success(`${result.length}개 문제가 생성되었습니다.`);
    } catch (error) {
      toast.error('문제 생성에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.admin.addQuizQuestions(
        eventId,
        questions.map((q) => ({
          question: q.question,
          questionType: q.questionType,
          correctAnswer: q.correctAnswer,
          choices: q.choices,
          explanation: q.explanation,
          grade: config.grade,
          subject: config.subject,
        }))
      );
      toast.success('문제가 저장되었습니다.');
      onComplete();
    } catch (error) {
      toast.error('문제 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = () => {
    setStep('config');
    setQuestions([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-semibold">AI 퀴즈 생성</h3>
          </div>
          <p className="text-sm text-purple-100 mt-1">
            Gemini AI가 학년/과목에 맞는 문제를 자동 생성합니다
          </p>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Step 1: Configuration */}
          {step === 'config' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">학년</label>
                  <select
                    value={config.grade}
                    onChange={(e) => setConfig({ ...config, grade: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {GRADES.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">과목</label>
                  <select
                    value={config.subject}
                    onChange={(e) => setConfig({ ...config, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">문제 수</label>
                  <select
                    value={config.count}
                    onChange={(e) => setConfig({ ...config, count: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {[3, 5, 10, 15, 20].map((n) => (
                      <option key={n} value={n}>{n}개</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">난이도</label>
                  <select
                    value={config.difficulty}
                    onChange={(e) => setConfig({ ...config, difficulty: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">문제 유형</label>
                  <select
                    value={config.type}
                    onChange={(e) => setConfig({ ...config, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={onClose} fullWidth>
                  취소
                </Button>
                <Button onClick={handleGenerate} loading={isGenerating} fullWidth>
                  <Sparkles className="w-4 h-4 mr-2" />
                  문제 생성
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge color="purple">{questions.length}개 문제</Badge>
                  <Badge color="blue">
                    {GRADES.find((g) => g.value === config.grade)?.label}
                  </Badge>
                  <Badge color="green">
                    {SUBJECTS.find((s) => s.value === config.subject)?.label}
                  </Badge>
                </div>
                <Button size="sm" variant="outline" onClick={handleRegenerate}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  다시 생성
                </Button>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {questions.map((q, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-medium shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{q.question}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge size="sm" color={q.questionType === 'ox' ? 'yellow' : 'blue'}>
                            {q.questionType === 'ox' ? 'OX' : '객관식'}
                          </Badge>
                          <span className="text-xs text-green-600 font-medium">
                            정답: {q.correctAnswer}
                          </span>
                        </div>
                        {q.choices && (
                          <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                            {Object.entries(q.choices).map(([key, value]) => (
                              <div key={key} className={q.correctAnswer === key ? 'text-green-600 font-medium' : ''}>
                                {key}. {value}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" onClick={handleRegenerate} fullWidth>
                  다시 생성
                </Button>
                <Button onClick={handleSave} loading={isSaving} fullWidth>
                  <Check className="w-4 h-4 mr-2" />
                  저장하기
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuizGenerator;
