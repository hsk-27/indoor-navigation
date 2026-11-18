import React from 'react';
import { useNavigate } from 'react-router-dom';
import { isNativePlatform, API_BASE_URL } from '../config';

function Home() {
  const navigate = useNavigate();

  return (
    <div className="relative flex-1 w-full min-h-screen flex flex-col pt-[100px] pb-12 overflow-y-auto">
      <div 
        className="fixed inset-0 z-0 pointer-events-none" 
        style={{ backgroundImage: "url('/ghrce home page background.webp')", backgroundSize: 'cover', backgroundPosition: 'center 40%', backgroundRepeat: 'no-repeat' }}
      />
      
      <div className="relative z-10 flex flex-col lg:flex-row items-start justify-center gap-8 lg:gap-12 w-full max-w-6xl mx-auto px-6">
        
        {/* Left Column: Promo */}
        <div className="flex flex-col gap-6 w-full lg:w-[46%]">
          {/* App Promo Card */}
          {!isNativePlatform() && (
            <div className="w-full bg-white p-8 sm:p-10 rounded-[2rem] shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-wrap p-1.5 gap-0.5 shadow-md">
                            <div className="w-[8px] h-[8px] rounded-[2px] bg-red-400"></div>
                            <div className="w-[8px] h-[8px] rounded-[2px] bg-yellow-400"></div>
                            <div className="w-[8px] h-[8px] rounded-[2px] bg-blue-400"></div>
                            <div className="w-[8px] h-[8px] rounded-[2px] bg-green-400"></div>
                        </div>
                        <h3 className="font-extrabold text-lg sm:text-xl text-slate-800 leading-tight">Better Navigation in<br/>Android App</h3>
                    </div>
                    <span className="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shrink-0 shadow-sm">
                        Recommended
                    </span>
                </div>
                
                <p className="text-sm text-blue-600 leading-relaxed mb-8 font-medium">
                    Mobile web browsers cannot access pedometer motion sensors or compass heading in the background. For real-time live navigation through campus, please install our Android app:
                </p>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 bg-gray-50 rounded-xl">
                        <div className="font-bold text-sm text-gray-800 flex items-center gap-2 mb-2">
                            <span className="text-base opacity-90">🚶</span> Live Step Tracking
                        </div>
                        <p className="text-xs text-gray-500 font-medium leading-relaxed">Tracks every step along college corridors.</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                        <div className="font-bold text-sm text-gray-800 flex items-center gap-2 mb-2">
                            <span className="text-base opacity-90">🧭</span> Compass Rotation
                        </div>
                        <p className="text-xs text-gray-500 font-medium leading-relaxed">Map rotates dynamically as you turn.</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                        <div className="font-bold text-sm text-gray-800 flex items-center gap-2 mb-2">
                            <span className="text-base opacity-90">🔊</span> Voice Navigation
                        </div>
                        <p className="text-xs text-gray-500 font-medium leading-relaxed">Spoken turn alerts even in your pocket.</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                        <div className="font-bold text-sm text-gray-800 flex items-center gap-2 mb-2">
                            <span className="text-base opacity-90">🔔</span> Lock-Screen Alerts
                        </div>
                        <p className="text-xs text-gray-500 font-medium leading-relaxed">Continuous directions notification.</p>
                    </div>
                </div>
                
                <div className="flex gap-4">
                    <button 
                        onClick={() => {
                            const link = document.createElement('a');
                            link.href = `${API_BASE_URL}/uploads/ghrce-nav.apk`;
                            link.download = 'ghrce-nav.apk';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }}
                        className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Download App (.APK)</span>
                        <span className="text-[10px] bg-blue-500 text-blue-50 px-2 py-0.5 rounded font-bold ml-1">5.3 MB</span>
                    </button>
                    
                    <button 
                        onClick={() => {
                            const currentOrigin = window.location.origin;
                            const fallbackUrl = `${currentOrigin}/entry?fallback=1`;
                            const intentUrl = `intent://connect?server=${encodeURIComponent(API_BASE_URL)}#Intent;scheme=ghrcenav;package=com.indoor.nav;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`;
                            window.location.href = intentUrl;
                        }}
                        className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-blue-600 text-sm font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                        <span className="text-base">📲</span> Open App
                    </button>
                </div>
            </div>
          )}
        </div>

        {/* Right Column: Welcome & Quick Guide */}
        <div className="w-full lg:w-[46%] flex flex-col gap-6">
          <div className="bg-white p-8 sm:p-10 rounded-[2rem] shadow-sm text-center flex flex-col justify-center items-center">
            
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 mb-4 tracking-tight">
              Welcome to GHRCE Navigation
            </h1>
            <p className="text-gray-500 mb-10 text-sm sm:text-base font-medium max-w-sm mx-auto leading-relaxed">
              Your personal guide through the complex corridors of GHRCE campus. Get started below.
            </p>
            
            <div className="flex flex-col space-y-5 w-full max-w-lg mx-auto">
              
              {/* Set Starting Location Button */}
              <button 
                onClick={() => navigate('/destinations')}
                className="bg-white border border-gray-200 hover:border-gray-300 w-full p-4 rounded-[1.5rem] flex items-center gap-5 group/btn cursor-pointer transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-xl shrink-0">
                  📍
                </div>
                <div className="flex-1">
                  <span className="block font-bold text-[17px] text-gray-800 mb-0.5">Start Navigation</span>
                  <span className="block text-sm text-gray-400 font-medium">Tell us where you are right now</span>
                </div>
                <span className="text-gray-300 font-light text-xl pr-2 group-hover/btn:translate-x-1 transition-transform">→</span>
              </button>
              
              {/* Search Directory Button */}
              <button 
                onClick={() => navigate('/directory')}
                className="bg-white border border-blue-50/80 hover:border-blue-100 shadow-[0_2px_12px_rgba(59,130,246,0.06)] w-full p-4 rounded-[1.5rem] flex items-center gap-5 group/btn cursor-pointer transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-xl shrink-0">
                  🔍
                </div>
                <div className="flex-1">
                  <span className="block font-bold text-[17px] text-gray-800 mb-0.5">Search Labs, Classrooms & Offices</span>
                  <span className="block text-sm text-gray-400 font-medium">Administrative buildings and more</span>
                </div>
                <span className="text-blue-400 font-light text-xl pr-2 group-hover/btn:translate-x-1 transition-transform">→</span>
              </button>
              
            </div>

            {/* Merged Quick Guide */}
            <div className="w-full max-w-lg mx-auto text-left mt-8 pt-8 border-t border-gray-100">
              <h3 className="text-[11px] uppercase tracking-widest font-bold text-gray-400 mb-5 text-center">Quick Guide</h3>
              <ul className="space-y-4">
                <li className="flex items-center gap-4">
                  <span className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-[11px] text-slate-600 font-bold shrink-0 shadow-sm border border-slate-100">1</span>
                  <span className="text-gray-500 text-sm font-medium">Select your current starting location.</span>
                </li>
                
                <li className="flex items-center gap-4">
                  <span className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-[11px] text-slate-600 font-bold shrink-0 shadow-sm border border-slate-100">2</span>
                  <span className="text-gray-500 text-sm font-medium">Select where you want to go.</span>
                </li>
                
                <li className="flex items-center gap-4">
                  <span className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-[11px] text-slate-600 font-bold shrink-0 shadow-sm border border-slate-100">3</span>
                  <span className="text-gray-500 text-sm font-medium">Follow the turn-by-turn guidance!</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Home;
