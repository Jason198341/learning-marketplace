import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-primary-500 text-white shadow-sm
    hover:bg-primary-600 hover:shadow-primary
    active:bg-primary-700
    disabled:bg-primary-200
  `,
  secondary: `
    bg-secondary-500 text-white shadow-sm
    hover:bg-secondary-600 hover:shadow-secondary
    active:bg-secondary-700
    disabled:bg-secondary-200
  `,
  outline: `
    border border-input bg-white text-foreground
    hover:bg-accent hover:text-accent-foreground hover:border-primary-200
    active:bg-gray-100
    disabled:bg-gray-50 disabled:text-muted-foreground
  `,
  ghost: `
    text-foreground
    hover:bg-accent hover:text-accent-foreground
    active:bg-gray-100
    disabled:text-muted-foreground
  `,
  danger: `
    bg-destructive text-destructive-foreground shadow-sm
    hover:bg-red-600
    active:bg-red-700
    disabled:bg-red-200
  `,
  link: `
    text-primary-600 underline-offset-4
    hover:underline hover:text-primary-700
    disabled:text-muted-foreground
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'h-7 px-2 text-xs rounded-md',
  sm: 'h-8 px-3 text-sm rounded-md',
  md: 'h-10 px-4 text-sm rounded-lg',
  lg: 'h-12 px-6 text-base rounded-lg',
  icon: 'h-10 w-10 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2
          font-medium transition-all duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          disabled:pointer-events-none
          active:scale-[0.98]
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
