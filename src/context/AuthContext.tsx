import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, logoutUser, getCurrentUser, registerUser, User } from '../lib/api';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (email: string, password: string, accountType?: 'user' | 'admin') => Promise<void>;
    register: (payload: {
        uid: string; name: string; email: string;
        password: string; dept: string; phone_no: string; userrole_id?: string;
    }) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load user from localStorage on mount
        const storedUser = getCurrentUser();
        // Migrate any old localStorage session to sessionStorage (one-time cleanup)
        const oldToken = localStorage.getItem('token');
        if (oldToken) {
            sessionStorage.setItem('token', oldToken);
            sessionStorage.setItem('user', localStorage.getItem('user') || '');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
        setUser(storedUser);
        setIsLoading(false);
    }, []);

    const login = async (email: string, password: string, accountType?: 'user' | 'admin') => {
        const data = await loginUser(email, password, accountType);
        
        if (data.role === 'admin') {
            // Redirect admin to the proxied Admin portal path on the SAME port
            const adminUrl = import.meta.env.VITE_ADMIN_URL || window.location.origin;
            window.location.href = `${adminUrl}/auth-callback?token=${data.token}`;
            return;
        } else {
            // Store user session locally
            // Store user session in sessionStorage (auto-clears when tab is closed)
            sessionStorage.setItem('token', data.token);
            sessionStorage.setItem('user', JSON.stringify(data.user));
            setUser(data.user);
        }
    };

    const register = async (payload: {
        uid: string; name: string; email: string;
        password: string; dept: string; phone_no: string; userrole_id?: string;
    }) => {
        await registerUser(payload);
    };

    const logout = () => {
        logoutUser();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
