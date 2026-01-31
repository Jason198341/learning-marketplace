interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
}: SkeletonProps) {
  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style: React.CSSProperties = {
    width: width,
    height: height,
  };

  return (
    <div
      className={`
        relative overflow-hidden bg-muted
        ${variantStyles[variant]}
        ${className}
      `}
      style={style}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-shimmer" />
    </div>
  );
}

// Predefined skeleton components
Skeleton.Card = function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm ${className}`}>
      <Skeleton className="w-full aspect-[4/3]" />
      <div className="p-4 space-y-3">
        <Skeleton className="w-3/4 h-5" />
        <Skeleton className="w-1/2 h-4" />
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4" variant="circular" />
          <Skeleton className="w-16 h-4" />
        </div>
        <div className="flex justify-between items-center pt-2">
          <Skeleton className="w-20 h-6" />
          <Skeleton className="w-10 h-10 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

Skeleton.Text = function SkeletonText({
  className = '',
  lines = 1
}: {
  className?: string;
  lines?: number;
}) {
  if (lines === 1) {
    return <Skeleton variant="text" className={`h-4 ${className}`} />;
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'} ${className}`}
        />
      ))}
    </div>
  );
};

Skeleton.Avatar = function SkeletonAvatar({
  size = 'md'
}: {
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return <Skeleton variant="circular" className={sizeMap[size]} />;
};

Skeleton.List = function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton variant="circular" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <Skeleton className="w-3/4 h-4" />
            <Skeleton className="w-1/2 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
};

Skeleton.Button = function SkeletonButton({
  size = 'md'
}: {
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeMap = {
    sm: 'h-8 w-20',
    md: 'h-10 w-24',
    lg: 'h-12 w-32',
  };

  return <Skeleton className={`${sizeMap[size]} rounded-lg`} />;
};

export default Skeleton;
