import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Gift, BookOpen, Users, Coins } from 'lucide-react';
import { Button, Input } from '@/components/common';
import { useAuthStore } from '@/store';
import { api, ApiError } from '@/services/api';
import { useToast } from '@/components/common/Toast';
import { formatPoints } from '@/types';

interface LoginForm {
  email: string;
  password: string;
}

interface SignupForm {
  email: string;
  password: string;
  confirmPassword: string;
  nickname: string;
  role: 'teacher' | 'parent';
}

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { setUser } = useAuthStore();
  const toast = useToast();

  const loginForm = useForm<LoginForm>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const signupForm = useForm<SignupForm>({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      nickname: '',
      role: 'teacher',
    },
  });

  const handleLogin = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const result = await api.auth.login(data.email, data.password);
      setUser(result.user, result.token);
      toast.success('로그인 성공!');
      navigate('/');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('로그인에 실패했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (data: SignupForm) => {
    if (data.password !== data.confirmPassword) {
      signupForm.setError('confirmPassword', {
        message: '비밀번호가 일치하지 않습니다.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.auth.signup({
        email: data.email,
        password: data.password,
        nickname: data.nickname,
        role: data.role,
      });
      setUser(result.user, result.token);
      toast.success(`회원가입 완료! ${formatPoints(1000)} 보너스 지급!`);
      navigate('/');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('회원가입에 실패했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-600 text-white p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl font-bold">학</span>
            </div>
            <span className="text-2xl font-bold">학습장터</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">
            교육 자료를 나누고,<br />
            함께 성장해요
          </h1>
          <p className="text-primary-100 text-lg">
            선생님이 만든 양질의 학습 자료를<br />
            합리적인 가격으로 만나보세요.
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">다양한 학습 자료</h3>
              <p className="text-primary-100 text-sm">
                초등부터 고등까지 모든 과목의 워크시트를 찾아보세요
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">검증된 판매자</h3>
              <p className="text-primary-100 text-sm">
                현직 선생님들이 직접 제작한 학습 자료만 판매됩니다
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">포인트 기반 거래</h3>
              <p className="text-primary-100 text-sm">
                100P~500P의 합리적인 가격으로 자료를 구매하세요
              </p>
            </div>
          </div>
        </div>

        <p className="text-primary-200 text-sm">
          © 2024 학습장터. All rights reserved.
        </p>
      </div>

      {/* Right Panel - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">학</span>
            </div>
            <span className="text-xl font-bold text-gray-900">학습장터</span>
          </div>

          {/* Welcome Bonus Banner */}
          {mode === 'signup' && (
            <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary-100 rounded-full flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 text-secondary-600" />
              </div>
              <div>
                <p className="font-semibold text-secondary-700">
                  지금 가입하면 1,000P 즉시 지급!
                </p>
                <p className="text-sm text-secondary-600">
                  첫 자료 구매에 바로 사용하세요
                </p>
              </div>
            </div>
          )}

          {/* Tab Switcher */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                mode === 'login'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                mode === 'signup'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              회원가입
            </button>
          </div>

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <Input
                label="이메일"
                type="email"
                placeholder="example@email.com"
                error={loginForm.formState.errors.email?.message}
                {...loginForm.register('email', {
                  required: '이메일을 입력해주세요.',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: '올바른 이메일 형식이 아닙니다.',
                  },
                })}
              />

              <Input
                label="비밀번호"
                type={showPassword ? 'text' : 'password'}
                placeholder="비밀번호를 입력하세요"
                error={loginForm.formState.errors.password?.message}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                }
                {...loginForm.register('password', {
                  required: '비밀번호를 입력해주세요.',
                })}
              />

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={isLoading}
              >
                로그인
              </Button>

              {/* Demo Account Info */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                <p className="font-medium text-gray-700 mb-1">테스트 계정</p>
                <p>이메일: demo@example.com</p>
                <p>비밀번호: demo1234</p>
              </div>
            </form>
          )}

          {/* Signup Form */}
          {mode === 'signup' && (
            <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
              <Input
                label="이메일"
                type="email"
                placeholder="example@email.com"
                error={signupForm.formState.errors.email?.message}
                {...signupForm.register('email', {
                  required: '이메일을 입력해주세요.',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: '올바른 이메일 형식이 아닙니다.',
                  },
                })}
              />

              <Input
                label="닉네임"
                type="text"
                placeholder="닉네임을 입력하세요"
                hint="2~20자 사이로 입력해주세요"
                error={signupForm.formState.errors.nickname?.message}
                {...signupForm.register('nickname', {
                  required: '닉네임을 입력해주세요.',
                  minLength: {
                    value: 2,
                    message: '닉네임은 2자 이상이어야 합니다.',
                  },
                  maxLength: {
                    value: 20,
                    message: '닉네임은 20자 이하여야 합니다.',
                  },
                })}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  회원 유형
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                      signupForm.watch('role') === 'teacher'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      value="teacher"
                      className="sr-only"
                      {...signupForm.register('role')}
                    />
                    <BookOpen className="w-5 h-5" />
                    <span className="font-medium">선생님</span>
                  </label>
                  <label
                    className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                      signupForm.watch('role') === 'parent'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      value="parent"
                      className="sr-only"
                      {...signupForm.register('role')}
                    />
                    <Users className="w-5 h-5" />
                    <span className="font-medium">학부모</span>
                  </label>
                </div>
              </div>

              <Input
                label="비밀번호"
                type={showPassword ? 'text' : 'password'}
                placeholder="8자 이상 입력하세요"
                error={signupForm.formState.errors.password?.message}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                }
                {...signupForm.register('password', {
                  required: '비밀번호를 입력해주세요.',
                  minLength: {
                    value: 8,
                    message: '비밀번호는 8자 이상이어야 합니다.',
                  },
                })}
              />

              <Input
                label="비밀번호 확인"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="비밀번호를 다시 입력하세요"
                error={signupForm.formState.errors.confirmPassword?.message}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                }
                {...signupForm.register('confirmPassword', {
                  required: '비밀번호 확인을 입력해주세요.',
                })}
              />

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={isLoading}
              >
                회원가입하고 1,000P 받기
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
