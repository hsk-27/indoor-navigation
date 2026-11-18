import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'glass' | 'solid' | 'elevated';
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', variant = 'glass', onClick }) => {
  let variantStyle = '';
  switch (variant) {
    case 'glass':
      variantStyle = 'glass-panel';
      break;
    case 'solid':
      variantStyle = 'bg-surface-darker border border-white/5';
      break;
    case 'elevated':
      variantStyle = 'bg-surface-dark border border-white/10 shadow-2xl shadow-black/50 transform transition-transform hover:-translate-y-1';
      break;
  }

  const clickableStyle = onClick ? 'cursor-pointer active:scale-[0.98] transition-all' : '';

  return (
    <div 
      className={`rounded-2xl overflow-hidden ${variantStyle} ${clickableStyle} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
