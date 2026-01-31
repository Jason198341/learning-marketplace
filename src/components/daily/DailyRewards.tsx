import { useState, useEffect } from 'react';
import { Calendar, Gift, Loader2, CheckCircle, Sparkles } from 'lucide-react';
import { api, ApiError } from '@/services/api';
import { useToast } from '@/components/common/Toast';
import { useAuthStore } from '@/store';
import { Button } from '@/components/common';

const ROULETTE_PRIZES = [5, 10, 15, 20, 30, 50];

export function DailyRewards() {
  const toast = useToast();
  const { isAuthenticated, updatePoints } = useAuthStore();

  const [attendanceStatus, setAttendanceStatus] = useState<{
    checkedIn: boolean;
    streak: number;
    pointsEarned?: number;
  }>({ checkedIn: false, streak: 0 });

  const [rouletteStatus, setRouletteStatus] = useState<{
    spun: boolean;
    pointsWon?: number;
  }>({ spun: false });

  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showRoulette, setShowRoulette] = useState(false);
  const [spinResult, setSpinResult] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);

  // Fetch status on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchStatus();
    }
  }, [isAuthenticated]);

  const fetchStatus = async () => {
    try {
      const [attendance, roulette] = await Promise.all([
        api.daily.getAttendanceStatus(),
        api.daily.getRouletteStatus(),
      ]);
      setAttendanceStatus(attendance);
      setRouletteStatus(roulette);
    } catch (error) {
      console.error('Failed to fetch daily status:', error);
    }
  };

  const handleCheckIn = async () => {
    if (attendanceStatus.checkedIn) return;

    setIsCheckingIn(true);
    try {
      const result = await api.daily.checkAttendance();

      if (result.success) {
        setAttendanceStatus({
          checkedIn: true,
          streak: result.streak || 0,
          pointsEarned: result.total_points,
        });

        if (result.new_balance) {
          updatePoints(result.new_balance);
        }

        if (result.bonus_points && result.bonus_points > 0) {
          toast.success(`출석 완료! ${result.base_points}P + 보너스 ${result.bonus_points}P 획득!`);
        } else {
          toast.success(`출석 완료! ${result.total_points}P 획득!`);
        }
      } else {
        toast.info(result.error || '이미 출석했습니다.');
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleSpinRoulette = async () => {
    if (rouletteStatus.spun || isSpinning) return;

    setIsSpinning(true);
    setShowRoulette(true);
    setSpinResult(null);

    try {
      const result = await api.daily.spinRoulette();

      if (result.success && result.points_won) {
        // Calculate rotation based on prize
        const prizeIndex = ROULETTE_PRIZES.indexOf(result.points_won);
        const segmentAngle = 360 / ROULETTE_PRIZES.length;
        const targetAngle = prizeIndex * segmentAngle + segmentAngle / 2;
        const spins = 5 + Math.random() * 3; // 5-8 full rotations
        const finalRotation = spins * 360 + (360 - targetAngle);

        setRotation(finalRotation);

        // Show result after animation
        setTimeout(() => {
          setSpinResult(result.points_won!);
          setRouletteStatus({ spun: true, pointsWon: result.points_won });

          if (result.new_balance) {
            updatePoints(result.new_balance);
          }

          toast.success(`${result.points_won}P 당첨!`);
          setIsSpinning(false);
        }, 4000);
      } else {
        toast.info(result.error || '이미 룰렛을 돌렸습니다.');
        setIsSpinning(false);
        setShowRoulette(false);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
      setIsSpinning(false);
      setShowRoulette(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-semibold">일일 보상</h3>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Attendance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              attendanceStatus.checkedIn
                ? 'bg-green-100 text-green-600'
                : 'bg-gray-100 text-gray-400'
            }`}>
              {attendanceStatus.checkedIn ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <Calendar className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900">출석 체크</p>
              <p className="text-xs text-muted-foreground">
                {attendanceStatus.checkedIn
                  ? `${attendanceStatus.streak}일 연속 출석!`
                  : `${attendanceStatus.streak > 0 ? `${attendanceStatus.streak}일 연속 중` : '오늘 첫 출석!'}`
                }
              </p>
            </div>
          </div>

          {attendanceStatus.checkedIn ? (
            <span className="text-sm font-medium text-green-600">
              +{attendanceStatus.pointsEarned || 10}P
            </span>
          ) : (
            <Button
              size="sm"
              onClick={handleCheckIn}
              loading={isCheckingIn}
              disabled={isCheckingIn}
            >
              출석
            </Button>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Roulette */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              rouletteStatus.spun
                ? 'bg-secondary-100 text-secondary-600'
                : 'bg-gray-100 text-gray-400'
            }`}>
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900">일일 룰렛</p>
              <p className="text-xs text-muted-foreground">
                {rouletteStatus.spun
                  ? `오늘 ${rouletteStatus.pointsWon}P 당첨!`
                  : '5~50P 당첨 기회!'
                }
              </p>
            </div>
          </div>

          {rouletteStatus.spun ? (
            <span className="text-sm font-medium text-secondary-600">
              +{rouletteStatus.pointsWon}P
            </span>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSpinRoulette}
              loading={isSpinning}
              disabled={isSpinning}
            >
              돌리기
            </Button>
          )}
        </div>
      </div>

      {/* Roulette Modal */}
      {showRoulette && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !isSpinning && setShowRoulette(false)}
          />

          <div className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full">
            <h3 className="text-lg font-semibold text-center mb-4">일일 룰렛</h3>

            {/* Roulette Wheel */}
            <div className="relative w-64 h-64 mx-auto mb-4">
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
                <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-primary-500" />
              </div>

              {/* Wheel */}
              <div
                className="w-full h-full rounded-full border-4 border-gray-200 overflow-hidden transition-transform duration-[4000ms] ease-out"
                style={{ transform: `rotate(${rotation}deg)` }}
              >
                {ROULETTE_PRIZES.map((prize, idx) => {
                  const angle = (idx * 360) / ROULETTE_PRIZES.length;
                  const colors = [
                    'bg-red-400', 'bg-orange-400', 'bg-yellow-400',
                    'bg-green-400', 'bg-blue-400', 'bg-purple-400'
                  ];
                  return (
                    <div
                      key={prize}
                      className={`absolute w-1/2 h-1/2 origin-bottom-right ${colors[idx]}`}
                      style={{
                        transform: `rotate(${angle}deg) skewY(-30deg)`,
                        transformOrigin: '0% 100%',
                      }}
                    >
                      <span
                        className="absolute text-white font-bold text-sm"
                        style={{
                          transform: 'skewY(30deg) rotate(30deg)',
                          left: '50%',
                          top: '30%',
                        }}
                      >
                        {prize}P
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white border-4 border-gray-200 flex items-center justify-center shadow-lg">
                  {isSpinning ? (
                    <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                  ) : spinResult ? (
                    <span className="text-lg font-bold text-primary-600">{spinResult}P</span>
                  ) : (
                    <Gift className="w-6 h-6 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Result */}
            {spinResult && (
              <div className="text-center">
                <p className="text-2xl font-bold text-primary-600 mb-2">
                  🎉 {spinResult}P 당첨!
                </p>
                <Button onClick={() => setShowRoulette(false)}>
                  확인
                </Button>
              </div>
            )}

            {/* Spinning message */}
            {isSpinning && !spinResult && (
              <p className="text-center text-muted-foreground">
                룰렛이 돌아가는 중...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DailyRewards;
