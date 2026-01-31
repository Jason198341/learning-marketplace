import { Link } from 'react-router-dom';
import { Coins } from 'lucide-react';
import { useAuthStore } from '@/store';
import { formatPoints } from '@/types';

interface PointBadgeProps {
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  clickable?: boolean;
}

export function PointBadge({
  showIcon = true,
  size = 'md',
  clickable = true,
}: PointBadgeProps) {
  const { user } = useAuthStore();

  if (!user) return null;

  const sizeStyles = {
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-2.5 py-1.5 text-sm gap-1.5',
    lg: 'px-3.5 py-2 text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const content = (
    <div
      className={`
        inline-flex items-center
        bg-gradient-to-r from-secondary-50 to-secondary-100
        text-secondary-700
        font-semibold rounded-full
        ring-1 ring-inset ring-secondary-200/50
        ${sizeStyles[size]}
        ${clickable ? 'hover:from-secondary-100 hover:to-secondary-150 cursor-pointer hover:ring-secondary-300/50' : ''}
        transition-all duration-200
      `}
    >
      {showIcon && <Coins className={`${iconSizes[size]} text-secondary-500`} />}
      <span>{formatPoints(user.points)}</span>
    </div>
  );

  if (clickable) {
    return <Link to="/my/points">{content}</Link>;
  }

  return content;
}

export default PointBadge;
