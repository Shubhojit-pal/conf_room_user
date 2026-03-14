import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, logoutUser, getCurrentUser, registerUser, User } from '../lib/api';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
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
        setUser(storedUser);
        setIsLoading(false);
    }, []);

    const login = async (email: string, password: string) => {
        const data = await loginUser(email, password);
        setUser(data.user);
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
