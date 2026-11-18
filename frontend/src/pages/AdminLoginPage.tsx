import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

export const AdminLoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const response = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password: password.trim() })
            });

            if (response.ok) {
                const data = await response.json();
                login(data.token);
                navigate('/admin/editor');
            } else if (response.status === 401 || response.status === 403) {
                setError('Invalid username or password');
            } else {
                setError(`Server error: ${response.statusText}`);
            }
        } catch (err) {
            setError('Unable to connect to the server');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full border border-gray-200"
            >
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Admin Login</h2>
                
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm border border-red-200">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input 
                            type="password" 
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="w-full bg-gray-800 text-white p-2 rounded-md hover:bg-gray-700 transition-colors mt-2"
                    >
                        Sign In
                    </button>
                </form>
                
                <div className="mt-6 text-center">
                    <button onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-gray-700">
                        ← Back to Map
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
