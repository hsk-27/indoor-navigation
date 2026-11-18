import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b-0 border-white/5">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <Link to="/" className="flex items-center space-x-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-accent-DEFAULT to-primary-500 flex items-center justify-center shadow-lg shadow-accent-DEFAULT/20 group-hover:scale-105 transition-transform duration-300">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-white text-glow">
            Indoor<span className="font-light text-slate-300">Nav</span>
          </span>
        </Link>
        <nav>
          <ul className="flex items-center space-x-6">
            <li>
              <Link 
                to="/" 
                className={`text-sm font-medium transition-colors duration-200 ${isActive('/') ? 'text-accent-light' : 'text-slate-300 hover:text-white'}`}
              >
                Home
              </Link>
            </li>
            <li>
              <Link 
                to="/admin" 
                className={`text-sm font-medium transition-colors duration-200 ${isActive('/admin') ? 'text-accent-light' : 'text-slate-300 hover:text-white'}`}
              >
                Admin
              </Link>
            </li>
            {isAuthenticated && (
              <li>
                <button 
                  onClick={handleLogout}
                  className="text-sm font-medium text-rose-400 hover:text-rose-300 transition-colors duration-200 ml-4 border border-rose-500/30 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20"
                >
                  Logout
                </button>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
