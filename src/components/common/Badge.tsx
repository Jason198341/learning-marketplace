import type { ReactNode } from 'react';

type BadgeColor = 'gray' | 'blue' | 'purple' | 'green' | 'yellow' | 'red' | 'primary' | 'secondary';
type BadgeVariant = 'solid' | 'soft' | 'outline';
type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
  variant?: BadgeColor | BadgeVariant;
  size?: BadgeSize;
  className?: string;
  dot?: boolean;
}

const colorStyles: Record<BadgeColor, Record<'solid' | 'soft' | 'outline', string>> = {
  gray: {
    solid: 'bg-gray-600 text-white',
    soft: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200',
    outline: 'border border-gray-300 text-gray-600',
  },
  blue: {
    solid: 'bg-blue-600 text-white',
    soft: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
    outline: 'border border-blue-300 text-blue-600',
  },
  purple: {
    solid: 'bg-purple-600 text-white',
    soft: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20',
    outline: 'border border-purple-300 text-purple-600',
  },
  green: {
    solid: 'bg-green-600 text-white',
    soft: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
    outline: 'border border-green-300 text-green-600',
  },
  yellow: {
    solid: 'bg-yellow-500 text-white',
    soft: 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20',
    outline: 'border border-yellow-300 text-yellow-600',
  },
  red: {
    solid: 'bg-red-600 text-white',
    soft: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
    outline: 'border border-red-300 text-red-600',
  },
  primary: {
    solid: 'bg-primary-600 text-white',
    soft: 'bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-600/20',
    outline: 'border border-primary-300 text-primary-600',
  },
  secondary: {
    solid: 'bg-secondary-600 text-white',
    soft: 'bg-secondary-50 text-secondary-700 ring-1 ring-inset ring-secondary-600/20',
    outline: 'border border-secondary-300 text-secondary-600',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({
  children,
  color,
  variant,
  size = 'sm',
  className = '',
  dot = false,
}: BadgeProps) {
  // Handle backwards compatibility - if variant is a color, use it as color
  const isVariantAColor = variant && ['gray', 'blue', 'purple', 'green', 'yellow', 'red', 'primary', 'secondary'].includes(variant);
  const badgeColor = color || (isVariantAColor ? variant as BadgeColor : 'gray');
  const badgeVariant = (!variant || isVariantAColor) ? 'soft' : (variant as 'solid' | 'soft' | 'outline');

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap
        ${colorStyles[badgeColor][badgeVariant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${
          badgeVariant === 'solid' ? 'bg-white/70' :
          badgeColor === 'gray' ? 'bg-gray-500' :
          badgeColor === 'blue' ? 'bg-blue-500' :
          badgeColor === 'purple' ? 'bg-purple-500' :
          badgeColor === 'green' ? 'bg-green-500' :
          badgeColor === 'yellow' ? 'bg-yellow-500' :
          badgeColor === 'red' ? 'bg-red-500' :
          badgeColor === 'primary' ? 'bg-primary-500' :
          'bg-secondary-500'
        }`} />
      )}
      {children}
    </span>
  );
}

export default Badge;
