import React, { forwardRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTheme } from '../Settings/themeUtils';

const sizes = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
  icon: 'p-2',
};

const Button = forwardRef(({
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loading = false,       // RIOS-compatible alias
  icon: Icon = null,     // Lucide icon component prop
  disabled,
  children,
  style = {},
  ...props
}, ref) => {
  const { theme, themeUtils } = useTheme();
  const isSpinning = isLoading || loading;

  const baseStyles = 'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const variants = {
    primary: 'text-white shadow-sm border border-transparent hover:opacity-90',
    secondary: 'ring-1 ring-inset ring-gray-300 dark:ring-slate-600 hover:opacity-90',
    outline: 'border hover:opacity-90',
    ghost: 'hover:opacity-80 bg-transparent',
    danger: 'text-white shadow-sm border border-transparent hover:opacity-90',
    success: 'text-white shadow-sm border border-transparent hover:opacity-90',
    warning: 'text-white shadow-sm border border-transparent hover:opacity-90',
    info: 'text-white shadow-sm border border-transparent hover:opacity-90',
  };

  const variantStyles = variants[variant] || variants.primary;
  const sizeStyles = sizes[size] || sizes.md;

  const getDynamicStyle = () => {
    if (variant === 'primary') {
      const bgStyle = theme.headerBg?.includes('gradient')
        ? { background: theme.headerBg }
        : { backgroundColor: theme.headerBg };
      return {
        ...bgStyle,
        color: themeUtils.getContrastText?.(theme.headerBg) || '#FFFFFF',
      };
    }
    if (variant === 'secondary') {
      return {
        backgroundColor: themeUtils.getBgColor('card'),
        color: themeUtils.getTextColor(true),
        borderColor: themeUtils.getBorderColor(),
      };
    }
    if (variant === 'outline') {
      return {
        backgroundColor: themeUtils.getBgColor('card'),
        color: themeUtils.getTextColor(true),
        borderColor: themeUtils.getBorderColor(),
      };
    }
    if (variant === 'ghost') {
      return {
        color: themeUtils.getTextColor(true),
      };
    }
    if (variant === 'danger') {
      return { backgroundColor: themeUtils.getErrorColor?.() || '#ef4444' };
    }
    if (variant === 'success') {
      return { backgroundColor: themeUtils.getSuccessColor?.() || '#10b981' };
    }
    if (variant === 'warning') {
      return { backgroundColor: themeUtils.getWarningColor?.() || '#f59e0b' };
    }
    if (variant === 'info') {
      return { backgroundColor: '#06b6d4' };
    }
    return {};
  };

  const mergedStyle = {
    ...getDynamicStyle(),
    ...style,
  };

  return (
    <button
      ref={ref}
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
      disabled={disabled || isSpinning}
      style={mergedStyle}
      {...props}
    >
      {isSpinning ? (
        <RefreshCw size={14} className="animate-spin" />
      ) : Icon ? (
        <Icon size={14} />
      ) : null}
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export { Button };

export default Button;
