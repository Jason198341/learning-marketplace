import { Star } from 'lucide-react';

export interface RatingProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  reviewCount?: number;
  interactive?: boolean;
  readonly?: boolean; // Alias for !interactive
  onChange?: (value: number) => void;
}

const sizeStyles = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const textSizeStyles = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

const gapStyles = {
  sm: 'gap-0.5',
  md: 'gap-0.5',
  lg: 'gap-1',
};

export function Rating({
  value,
  max = 5,
  size = 'md',
  showValue = false,
  reviewCount,
  interactive,
  readonly,
  onChange,
}: RatingProps) {
  // Determine if interactive based on props
  // If onChange is provided, default to interactive unless explicitly set to readonly
  const isInteractive = interactive ?? (readonly !== undefined ? !readonly : !!onChange);
  const stars = Array.from({ length: max }, (_, i) => i + 1);

  const handleClick = (rating: number) => {
    if (isInteractive && onChange) {
      onChange(rating);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, rating: number) => {
    if (isInteractive && onChange && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onChange(rating);
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <div className={`flex items-center ${gapStyles[size]}`}>
        {stars.map((starValue) => {
          const isFilled = starValue <= value;
          const isHalf = starValue - 0.5 <= value && starValue > value;

          return (
            <button
              key={starValue}
              type="button"
              onClick={() => handleClick(starValue)}
              onKeyDown={(e) => handleKeyDown(e, starValue)}
              disabled={!isInteractive}
              className={`
                ${isInteractive ? 'cursor-pointer hover:scale-110 focus-visible:scale-110' : 'cursor-default'}
                transition-transform duration-150 disabled:cursor-default
                focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-1 rounded
              `}
              tabIndex={isInteractive ? 0 : -1}
            >
              <Star
                className={`
                  ${sizeStyles[size]}
                  transition-colors duration-150
                  ${isFilled
                    ? 'fill-yellow-400 text-yellow-400 drop-shadow-sm'
                    : 'text-gray-200 fill-gray-200'
                  }
                  ${isHalf ? 'fill-yellow-400/50' : ''}
                  ${isInteractive && !isFilled ? 'hover:text-yellow-300 hover:fill-yellow-300' : ''}
                `}
              />
            </button>
          );
        })}
      </div>

      {showValue && (
        <span className={`${textSizeStyles[size]} font-semibold text-gray-900 ml-0.5`}>
          {value.toFixed(1)}
        </span>
      )}

      {reviewCount !== undefined && (
        <span className={`${textSizeStyles[size]} text-muted-foreground`}>
          ({reviewCount.toLocaleString()})
        </span>
      )}
    </div>
  );
}

export default Rating;
