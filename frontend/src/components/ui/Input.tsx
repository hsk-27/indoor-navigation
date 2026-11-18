import React, { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col space-y-1 w-full">
        {label && <label className="text-sm font-medium text-slate-300 ml-1">{label}</label>}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3 text-slate-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full bg-surface-darker/50 border ${
              error ? 'border-rose-500 focus:ring-rose-500' : 'border-white/10 focus:border-primary-500 focus:ring-primary-500/50'
            } text-white rounded-xl px-4 py-3 ${icon ? 'pl-10' : ''} outline-none focus:ring-2 transition-all placeholder-slate-500 ${className}`}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-rose-500 ml-1 mt-1 animate-fade-in">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
