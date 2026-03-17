import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../lib/api';
import { Buildings, EnvelopeSimple, Lock, User, Phone, Briefcase, X, Eye, EyeSlash } from '@phosphor-icons/react';
import { useUISound } from '../hooks/use-ui-sound';

interface LoginPageProps {
    onSuccess: () => void;
    onNavigate?: (view: string) => void;
    isModal?: boolean;
    onClose?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onNavigate, isModal, onClose }) => {
    const { login, register } = useAuth();
    const { playSuccess, playError } = useUISound();
    const [mode, setMode] = useState<'login' | 'register' | 'verify'>('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [otp, setOtp] = useState('');
    const [verifyEmail, setVerifyEmail] = useState('');

    // Login form
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Register form
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regDept, setRegDept] = useState('');
    const [regPhone, setRegPhone] = useState('');
    const [regRole] = useState('user');
    const [showRegPassword, setShowRegPassword] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await login(email, password);
            playSuccess();
            onSuccess();
        } catch (err: any) {
            playError();
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const uid = `U-${Date.now().toString().slice(-6)}`;
            await register({ uid, name: regName, email: regEmail, password: regPassword, dept: regDept, phone_no: regPhone, userrole_id: regRole });
            playSuccess();
            setVerifyEmail(regEmail);
            setMode('verify');
        } catch (err: any) {
            playError();
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const data = await fetch(`${API_URL}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: verifyEmail, otp }),
            });
            const res = await data.json();
            if (!data.ok) throw new Error(res.error);
            setSuccess('Account verified! You can now log in.');
            setMode('login');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setError('');
        try {
            const data = await fetch(`${API_URL}/auth/resend-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: verifyEmail }),
            });
            const res = await data.json();
            if (!data.ok) throw new Error(res.error);
            alert('OTP resent successfully.');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const content = (
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 relative">
            {isModal && onClose && (
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
                    <X size={24} />
                </button>
            )}
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                    <Buildings size={22} weight="fill" className="text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Conference Rooms</h1>
                    <p className="text-xs text-slate-500">Booking System</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex rounded-lg bg-slate-100 p-1 mb-6">
                <button
                    onClick={() => { setMode('login'); setError(''); }}
                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${mode === 'login' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Sign In
                </button>
                <button
                    onClick={() => { setMode('register'); setError(''); }}
                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${mode === 'register' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Register
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-4 animate-shake">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm px-4 py-3 rounded-lg mb-4">
                    {success}
                </div>
            )}

            {mode === 'verify' ? (
                <div className="space-y-6">
                    <div className="text-center">
                        <h2 className="text-lg font-bold text-slate-800">Verify Your Email</h2>
                        <p className="text-xs text-slate-500 mt-1">We've sent a 6-digit code to <strong>{verifyEmail}</strong></p>
                    </div>

                    <form onSubmit={handleVerify} className="space-y-4">
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="6-digit OTP"
                                value={otp}
                                onChange={e => setOtp(e.target.value)}
                                required
                                maxLength={6}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-center text-lg font-bold tracking-[0.5em] transition-all text-slate-900"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg transition-all disabled:opacity-60 shadow-md"
                        >
                            {loading ? 'Verifying...' : 'Verify Account'}
                        </button>
                    </form>

                    <div className="text-center">
                        <p className="text-xs text-slate-500">
                            Didn't receive the code?{' '}
                            <button onClick={handleResendOtp} className="text-primary font-bold hover:underline">Resend OTP</button>
                        </p>
                        <button 
                            onClick={() => setMode('login')} 
                            className="mt-4 text-xs text-slate-400 hover:text-slate-600 font-semibold"
                        >
                            Back to Sign In
                        </button>
                    </div>
                </div>
            ) : mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative">
                        <EnvelopeSimple size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all text-slate-900"
                        />
                    </div>
                    <div className="relative">
                        <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm transition-all text-slate-900"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {onNavigate && (
                        <div className="flex justify-end">
                            <button 
                                type="button" 
                                onClick={() => onNavigate('forgot-password')}
                                className="text-xs text-primary font-semibold hover:underline"
                            >
                                Forgot Password?
                            </button>
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg transition-all disabled:opacity-60 shadow-md hover:shadow-lg transform active:scale-[0.98]"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleRegister} className="space-y-3">
                    <div className="relative">
                        <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Full Name" value={regName} onChange={e => setRegName(e.target.value)} required className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm text-slate-900" />
                    </div>
                    <div className="relative">
                        <EnvelopeSimple size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="email" placeholder="Email address" value={regEmail} onChange={e => setRegEmail(e.target.value)} required className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm text-slate-900" />
                    </div>
                    <div className="relative">
                        <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type={showRegPassword ? 'text' : 'password'} 
                            placeholder="Password" 
                            value={regPassword} 
                            onChange={e => setRegPassword(e.target.value)} 
                            required 
                            className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm text-slate-900" 
                        />
                        <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            {showRegPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    <div className="relative">
                        <Briefcase size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Department" value={regDept} onChange={e => setRegDept(e.target.value)} required className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm text-slate-900" />
                    </div>
                    <div className="relative">
                        <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="tel" placeholder="Phone number" value={regPhone} onChange={e => setRegPhone(e.target.value)} required className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm text-slate-900" />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg transition-all disabled:opacity-60 shadow-md hover:shadow-lg"
                    >
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>
            )}
        </div>
    );

    if (isModal) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
                <div className="relative z-10 w-full max-w-md">
                    {content}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
            {content}
        </div>
    );
};

export default LoginPage;
