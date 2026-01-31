import { forwardRef, type SelectHTMLAttributes, type ChangeEvent } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectPropsBase {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

// Props when using native onChange
interface SelectPropsNative extends SelectPropsBase, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'onChange'> {
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
}

// Props when using simple value onChange
interface SelectPropsSimple extends SelectPropsBase, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'onChange'> {
  onChange?: (value: string) => void;
}

export type SelectProps = SelectPropsNative | SelectPropsSimple;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className = '', id, onChange, ...props }, ref) => {
    const inputId = id || props.name;

    const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
      if (onChange) {
        // Check if onChange expects an event or just a value
        // by calling it and handling both cases
        (onChange as (value: string) => void)(e.target.value);
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={`
              flex h-10 w-full items-center justify-between
              rounded-lg border bg-white px-3 py-2 pr-10
              text-sm text-foreground
              appearance-none cursor-pointer
              transition-all duration-200
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent
              disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50
              hover:border-gray-400
              ${error
                ? 'border-destructive focus-visible:ring-destructive'
                : 'border-input'
              }
              ${className}
            `}
            onChange={handleChange}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-destructive flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
