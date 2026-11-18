import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
    token: string | null;
    isAuthenticated: boolean;
    login: (token: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { API_BASE_URL } from '../config';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const storedToken = localStorage.getItem('admin_token');
        if (storedToken) {
            setToken(storedToken);
        }
    }, []);

    useEffect(() => {
        if (!token) return;

        const interval = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.token) {
                        localStorage.setItem('admin_token', data.token);
                        setToken(data.token);
                    }
                } else {
                    // Token is invalid/expired, log out
                    localStorage.removeItem('admin_token');
                    setToken(null);
                }
            } catch (err) {
                console.error("Token refresh failed", err);
            }
        }, 45 * 60 * 1000); // 45 minutes

        return () => clearInterval(interval);
    }, [token]);

    const login = (newToken: string) => {
        localStorage.setItem('admin_token', newToken);
        setToken(newToken);
    };

    const logout = () => {
        localStorage.removeItem('admin_token');
        setToken(null);
    };

    const contextValue = React.useMemo(() => ({
        token, isAuthenticated: !!token, login, logout
    }), [token]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
