import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', color = 'text-primary-500' }) => {
  let sizeStyle = '';
  switch (size) {
    case 'sm': sizeStyle = 'w-4 h-4 border-2'; break;
    case 'md': sizeStyle = 'w-8 h-8 border-3'; break;
    case 'lg': sizeStyle = 'w-12 h-12 border-4'; break;
  }

  return (
    <div className="flex justify-center items-center">
      <div 
        className={`${sizeStyle} ${color} rounded-full animate-spin border-t-transparent border-solid`}
        style={{ borderTopColor: 'transparent' }}
      ></div>
    </div>
  );
};

export default Spinner;
