import React from 'react';
import { BrowserRouter, Routes, Route, Link, Outlet } from 'react-router-dom';
import Home from './pages/Home';
import MapPage from './pages/MapPage';
import DestinationSelect from './pages/DestinationSelect';
import DirectorySearch from './pages/DirectorySearch';
import QRRedirect from './pages/QRRedirect';
import { GraphEditorPage } from './pages/GraphEditor/GraphEditorPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminLayout } from './components/AdminLayout';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { BuildingManager } from './pages/BuildingManager/BuildingManager';
import { CapacitorServerConfig } from './components/CapacitorServerConfig';
import { isNativePlatform, API_BASE_URL } from './config';
import { DeploymentSettings } from './pages/DeploymentSettings';
import { AppEntry } from './pages/AppEntry';
import { motion, AnimatePresence } from 'framer-motion';
import { App as CapacitorApp } from '@capacitor/app';
import { Clipboard } from '@capacitor/clipboard';
import { LocalizationProvider } from './context/LocalizationContext';
import { RouteProvider } from './context/RouteContext';

const MainLayout: React.FC = () => {
  return (
    <div className="min-h-screen font-sans flex flex-col relative overflow-hidden bg-gray-50/50">
        {/* Animated background elements (Light Theme) */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-100/50 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gray-200/50 blur-[120px] pointer-events-none"></div>
        
        {/* Transparent Floating Navbar */}
        <nav className="absolute top-0 w-full z-50 p-6 flex justify-between items-center max-w-7xl mx-auto left-0 right-0">
          {/* Left Pill */}
          <div className="bg-white rounded-full px-6 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex items-center">
            <Link to="/" className="flex items-center gap-2 font-black text-gray-800 tracking-tight text-lg">
              <span className="text-gray-900">❖</span> GHRCE.NAVIGATION
            </Link>
          </div>
          
          {/* Right Pill */}
          <div className="bg-white rounded-full px-8 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex gap-8 items-center font-bold text-sm">
            <Link to="/" className="text-gray-600 hover:text-gray-900 transition-colors">Home</Link>
            <Link to="/map" className="text-gray-600 hover:text-gray-900 transition-colors">Map</Link>
            {!isNativePlatform() && (
              <Link to="/admin/editor" className="text-gray-600 hover:text-gray-900 transition-colors">Admin Panel</Link>
            )}
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto animate-fade-in p-4 z-10 flex flex-col">
          <Outlet />
        </main>
      </div>
  );
};

class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null, info: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: any) { this.setState({ info }); }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: '20px', background: '#fee', color: 'red', zIndex: 9999, position: 'relative' }}>
        <h2>App Crashed</h2>
        <pre>{this.state.error?.message}</pre>
        <pre>{this.state.info?.componentStack}</pre>
      </div>
    );
    return this.props.children;
  }
}


function App() {
  const [isConfigured, setIsConfigured] = React.useState(!isNativePlatform() || !!API_BASE_URL);
  const isEntryPage = window.location.pathname.startsWith('/entry');
  const [showSplash, setShowSplash] = React.useState(!isEntryPage);

  React.useEffect(() => {
    // Listen for custom ghrcenav:// URI scheme deep links
    if (isNativePlatform()) {
      CapacitorApp.addListener('appUrlOpen', (data: any) => {
        try {
          if (data.url.includes('ghrcenav://') && data.url.includes('server=')) {
            const serverUrl = new URL(data.url).searchParams.get('server');
            if (serverUrl) {
              localStorage.setItem('APP_DEPLOYMENT_URL', serverUrl.trim());
              window.location.reload();
            }
          }
        } catch (e) {
          console.error("Deep link parse error:", e);
        }
      });

      // Deferred Deep Linking Hack: Check the clipboard if not configured
      if (!API_BASE_URL) {
        Clipboard.read().then(({ value }) => {
          try {
            if (value && value.includes('ghrcenav://') && value.includes('server=')) {
              const serverUrl = new URL(value).searchParams.get('server');
              if (serverUrl) {
                localStorage.setItem('APP_DEPLOYMENT_URL', serverUrl.trim());
                window.location.reload();
              }
            }
          } catch (e) {
            console.error("Clipboard deep link parse error:", e);
          }
        }).catch(err => console.log("Clipboard read blocked or failed:", err));
      }
    }
  }, []);

  React.useEffect(() => {
    if (isConfigured) {
      const timer = setTimeout(() => setShowSplash(false), 2800);
      return () => clearTimeout(timer);
    }
  }, [isConfigured]);

  if (!isConfigured) {
    return <CapacitorServerConfig onConfigured={() => setIsConfigured(true)} />;
  }

  return (
    <GlobalErrorBoundary>
      <AnimatePresence mode="wait">
        {showSplash ? (
          <motion.div 
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-50 via-white to-blue-50/40 flex flex-col items-center justify-center p-6 select-none overflow-hidden"
          >
            <div className="relative z-10 flex flex-col items-center text-center max-w-lg w-full">
              <div className="relative mb-6 flex items-center justify-center">
                <motion.div 
                  initial={{ scale: 0.85, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="w-28 h-28 sm:w-32 sm:h-32 p-3.5 rounded-3xl bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-gray-100 flex items-center justify-center relative z-10"
                >
                  <img src="/ghrce-logo-purple.webp" alt="GHRCE Logo" className="w-full h-full object-contain" />
                </motion.div>
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-50/80 text-blue-600 text-[11px] font-bold uppercase tracking-widest mb-6 shadow-sm"
              >
                <span>❖</span> GHRCE INDOOR GPS
              </motion.div>

                <div className="relative inline-block my-2 select-none mb-6">
                  {/* Faded Background Text */}
                  <div 
                    className="text-5xl sm:text-6xl font-black tracking-wider text-transparent select-none whitespace-nowrap opacity-20"
                    style={{
                      WebkitTextStroke: '1px rgba(0,0,0,0.5)',
                      color: 'transparent'
                    }}
                  >
                    GHRCE.NAVIGATION
                  </div>
                  
                  {/* Glowing Animated Revealing Text */}
                  <motion.div 
                    className="absolute inset-0 overflow-hidden whitespace-nowrap"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <div 
                      className="text-5xl sm:text-6xl font-black tracking-wider select-none whitespace-nowrap"
                      style={{
                        color: '#111827', // dark gray / black
                        WebkitTextStroke: '1px rgba(0,0,0,0.1)',
                        textShadow: '0 0 15px rgba(0, 0, 0, 0.3), 0 0 25px rgba(0, 0, 0, 0.2)',
                      }}
                    >
                      GHRCE.NAVIGATION
                    </div>
                    {/* Black Laser scanning head */}
                    <div className="absolute right-0 top-0 bottom-0 w-[4px] bg-black rounded-full shadow-[0_0_10px_#000,0_0_20px_#000]">
                      <div className="absolute -left-2 -right-2 top-0 bottom-0 bg-black/20 blur-[3px] rounded-full pointer-events-none"></div>
                    </div>
                  </motion.div>
                </div>

              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-gray-500 font-medium text-sm sm:text-base tracking-wide"
              >
                G.H. Raisoni College of Engineering, Nagpur
              </motion.p>
            </div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.6 }}
              className="absolute bottom-8 text-[10px] text-gray-400 font-medium tracking-widest uppercase"
            >
              Autonomous PDR & Sensor Fusion Engine
            </motion.div>
          </motion.div>
        ) : (
          <motion.div 
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full"
          >
            <BrowserRouter>
        <AuthProvider>
          <LocalizationProvider>
            <RouteProvider>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/destinations" element={<DestinationSelect />} />
              <Route path="/directory" element={<DirectorySearch />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/qr/:qrId" element={<QRRedirect />} />
            </Route>
            <Route path="/entry" element={<AppEntry />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<ProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route index element={<BuildingManager />} />
                <Route path="buildings" element={<BuildingManager />} />
                <Route path="editor" element={<GraphEditorPage />} />
                <Route path="deployment" element={<DeploymentSettings />} />
              </Route>
            </Route>
          </Routes>
            </RouteProvider>
          </LocalizationProvider>
        </AuthProvider>
      </BrowserRouter>
          </motion.div>
        )}
      </AnimatePresence>
    </GlobalErrorBoundary>
  );
}

export default App;
