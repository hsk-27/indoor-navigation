import React, { useEffect } from 'react';

export const AppEntry: React.FC = () => {
  useEffect(() => {
    window.location.replace('/');
  }, []);

  return null;
};
