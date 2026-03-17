/**
 * @file ResetPasswordPage.tsx
 * @description Password reset page for the user-facing application.
 *
 * This page is the second step of the "Forgot Password" flow. The user arrives
 * here after receiving an OTP email via `ForgotPasswordPage`. They must enter
 * their email, the 6-digit OTP code, and a new password to complete the reset.
 *
 * Flow:
 *  1. User enters email, OTP received via email, and new password.
 *  2. On submit, calls `POST /api/auth/reset-password`.
 *  3. On success, displays a confirmation message and redirects to login after 3 seconds.
 *  4. On error, displays the error from the backend.
 *
 * @module pages/ResetPasswordPage
 */

import React, { useState } from 'react';
import { Buildings, Lock, ArrowLeft, Key, EnvelopeSimple } from '@phosphor-icons/react';
import { API_URL } from '../lib/api';

/**
 * Props accepted by the ResetPasswordPage component.
 */
interface ResetPasswordPageProps {
    /**
     * Optional email to pre-fill the email input field.
     * Passed from ForgotPasswordPage after the user requests a reset.
     */
    email?: string;
    /** Callback invoked when the user clicks "Back". Navigates to ForgotPasswordPage. */
    onBack: () => void;
    /** Callback invoked after a successful password reset. Navigates to LoginPage. */
    onSuccess: () => void;
}

/**
 * ResetPasswordPage — allows a user to reset their password using an OTP.
 *
 * @param {ResetPasswordPageProps} props - Component props.
 * @returns {JSX.Element} The rendered password reset form.
 */
const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ email: initialEmail, onBack, onSuccess }) => {
    /** Pre-filled from the previous step or typed by the user. */
    const [email, setEmail] = useState(initialEmail || '');
    /** 6-digit OTP received by the user via email. */
    const [otp, setOtp] = useState('');
    /** The new password the user wants to set. */
    const [password, setPassword] = useState('');
    /** Confirmation of the new password for typo prevention. */
    const [confirm, setConfirm] = useState('');
    /** Controls the disabled/loading state of the submit button. */
    const [loading, setLoading] = useState(false);
    /** Feedback message object to display success or error status to the user. */
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    /**
     * Handles the password reset form submission.
     *
     * Validates that the two password fields match, then submits the
     * email, OTP, and new password to the backend. On success, shows
     * a confirmation message and auto-redirects to the login page.
     *
     * @async
     * @param {React.FormEvent} e - The form submission event.
     * @returns {Promise<void>}
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) {
            setMsg({ ok: false, text: 'Passwords do not match' });
            return;
        }
        setLoading(true);
        setMsg(null);
        try {
            const res = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp, newPassword: password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            setMsg({ ok: true, text: data.message });
            setTimeout(() => {
                onSuccess();
            }, 3000);
        } catch (err: any) {
            setMsg({ ok: false, text: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 relative">
                <button onClick={onBack} className="absolute top-6 left-6 text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1 text-sm font-medium">
                    <ArrowLeft size={16} /> Back
                </button>

                <div className="flex items-center gap-3 mb-8 mt-4 justify-center">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                        <Buildings size={22} weight="fill" className="text-white" />
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-800">Reset Password</h1>
                    <p className="text-slate-500 text-sm mt-2">Enter the 6-digit code sent to your email.</p>
                </div>

                {msg && (
                    <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${msg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                        {msg.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <EnvelopeSimple size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm text-slate-900"
                        />
                    </div>
                    <div className="relative">
                        <Key size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="6-digit OTP"
                            value={otp}
                            onChange={e => setOtp(e.target.value)}
                            required
                            maxLength={6}
                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm text-center font-bold tracking-widest text-slate-900"
                        />
                    </div>
                    <div className="relative">
                        <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="password"
                            placeholder="New Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm text-slate-900"
                        />
                    </div>
                    <div className="relative">
                        <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="password"
                            placeholder="Confirm New Password"
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            required
                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm text-slate-900"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg transition-all disabled:opacity-60 shadow-md"
                    >
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
