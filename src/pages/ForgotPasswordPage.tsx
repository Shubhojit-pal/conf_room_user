import React, { useState } from 'react';
import { Buildings, EnvelopeSimple, ArrowLeft } from '@phosphor-icons/react';
import { forgotPassword } from '../lib/api';

interface ForgotPasswordPageProps {
    onBack: () => void;
    onResetView: (token: string) => void;
}

const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBack, onResetView }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg(null);
        try {
            const res = await forgotPassword(email);
            setMsg({ ok: true, text: res.message });
            // For this demo, if resetToken is present in response, we'll allow shortcutting to reset view
            if (res.resetToken) {
                console.log('Reset Token (Demo):', res.resetToken);
                // In a real app, the user would click a link in their email.
                // For ease of use in this project, we'll show a button to proceed with the token.
            }
        } catch (err: any) {
            setMsg({ ok: false, text: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] w-full max-w-md p-8 relative">
                <button onClick={onBack} className="absolute top-6 left-6 text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1 text-sm font-medium">
                    <ArrowLeft size={16} /> Back
                </button>

                <div className="flex items-center gap-3 mb-8 mt-4 justify-center">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                        <Buildings size={22} weight="fill" className="text-white" />
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-800">Forgot Password</h1>
                    <p className="text-slate-500 text-sm mt-2">Enter your email and we'll send you a 6-digit reset code.</p>
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
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg transition-all disabled:opacity-60 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]"
                    >
                        {loading ? 'Sending...' : 'Send Reset Code'}
                    </button>
                </form>

                {msg?.ok && (
                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                        <button 
                            onClick={() => onResetView(email)} 
                            className="text-primary font-bold text-sm hover:underline"
                        >
                            I have a reset code
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
