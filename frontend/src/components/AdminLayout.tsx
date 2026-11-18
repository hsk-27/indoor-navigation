import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const AdminLayout: React.FC = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50">
            {/* Admin Header */}
            <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <span className="font-bold text-gray-800">Navigation Admin</span>
                    <span className="text-gray-400">|</span>
                    <button onClick={() => navigate('/')} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                        View Map
                    </button>
                    <button onClick={() => navigate('/admin/buildings')} className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium">
                        Building Manager
                    </button>
                    <button onClick={() => navigate('/admin/editor')} className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium">
                        Graph Editor
                    </button>
                    <button onClick={() => navigate('/admin/deployment')} className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium">
                        Deployment Settings
                    </button>
                </div>
                <div>
                    <button 
                        onClick={handleLogout} 
                        className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors border border-gray-300"
                    >
                        Logout
                    </button>
                </div>
            </header>

            {/* Admin Content Area (where GraphEditor is rendered) */}
            <main className="flex-1 relative overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
};
