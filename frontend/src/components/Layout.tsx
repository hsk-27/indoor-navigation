import React from 'react';
import Navbar from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-hidden">
      {/* Dynamic background element for extra depth */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-700/20 rounded-full blur-[120px] pointer-events-none animate-float"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-dark/20 rounded-full blur-[100px] pointer-events-none animate-float" style={{ animationDelay: '1.5s' }}></div>
      
      <Navbar />
      
      {/* pt-safe for capacitor safe areas if needed, currently using pt-20 to clear fixed navbar */}
      <main className="flex-grow container mx-auto px-4 pt-24 pb-8 z-10 animate-fade-in relative">
        {children}
      </main>
    </div>
  );
};

export default Layout;
