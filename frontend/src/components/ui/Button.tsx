import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  isLoading = false,
  disabled,
  ...props 
}) => {
  const baseStyle = "relative flex justify-center items-center px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none overflow-hidden";
  
  let variantStyle = "";
  switch (variant) {
    case 'primary':
      variantStyle = "bg-primary-600 text-white shadow-lg shadow-primary-600/30 hover:bg-primary-500 hover:shadow-primary-500/40 border border-primary-500/50";
      break;
    case 'secondary':
      variantStyle = "bg-surface-glass text-slate-200 shadow-md hover:bg-white/10 border border-white/10 hover:border-white/20";
      break;
    case 'danger':
      variantStyle = "bg-rose-600/90 text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 hover:shadow-rose-500/40 border border-rose-500/50";
      break;
    case 'ghost':
      variantStyle = "bg-transparent text-slate-300 hover:text-white hover:bg-white/5";
      break;
  }

  return (
    <button className={`${baseStyle} ${variantStyle} ${className}`} disabled={disabled || isLoading} {...props}>
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : null}
      {children}
    </button>
  );
};

export default Button;
