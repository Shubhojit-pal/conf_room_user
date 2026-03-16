/**
 * @file ProfilePage.tsx
 * @description User profile page for the user-facing application.
 *
 * Features:
 *  - Displays the user's name, role, department, email, and phone number.
 *  - Shows booking statistics (total, confirmed).
 *  - Allows editing of name, department, and phone number.
 *  - Provides a form to change the account password inline.
 *  - Includes a "Sign Out" button at the bottom.
 *
 * Data Flow:
 *  - On mount, fetches the full user profile from `GET /api/users/:uid`
 *    and the user's bookings from `GET /api/bookings?uid=...`.
 *  - Profile edits call `PUT /api/users/:uid`.
 *  - Password changes call `PUT /api/auth/change-password`.
 *  - After a successful profile save, the `localStorage` user object is
 *    updated so the Header immediately reflects the new name.
 *
 * @module pages/ProfilePage
 */

import {
    Envelope,
    Phone,
    Briefcase,
    Gear,
    Shield,
    SignOut,
    PencilSimple,
    Check,
    X,
    CalendarBlank,
    ArrowRight
} from '@phosphor-icons/react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchUserProfile, updateUserProfile, fetchUserBookings, User } from '../lib/api';

/**
 * ProfilePage — the authenticated user's personal settings and stats page.
 *
 * Renders a two-column layout with a sticky profile card on the left and
 * an editable details panel, booking statistics, and security settings on
 * the right.
 *
 * @returns {JSX.Element} The rendered profile page, or a spinner while loading.
 */
interface ProfilePageProps {
    onViewBookings: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ onViewBookings }) => {
    /** Auth context: provides the currently logged-in user object and logout function. */
    const { user: authUser, logout } = useAuth();
    /** Full user profile object loaded from the backend (may differ from JWT-based authUser). */
    const [profile, setProfile] = useState<User | null>(null);
    /** Whether the profile data is currently being fetched. */
    const [loading, setLoading] = useState(true);
    /** Whether the profile input fields are unlocked for editing. */
    const [editing, setEditing] = useState(false);
    /** Whether a profile save request is in-flight. */
    const [saving, setSaving] = useState(false);
    /** Mutable form data for the inline profile editor. */
    const [editForm, setEditForm] = useState({ name: '', dept: '', phone_no: '' });
    /** Feedback message to display after a save attempt (success or error). */
    const [saveMsg, setSaveMsg] = useState<{ ok: boolean; msg: string } | null>(null);
    /** Aggregated booking counts derived from the user's booking history. */
    const [stats, setStats] = useState({ total: 0 });

    /** Whether the inline change-password form is visible. */
    const [showPwForm, setShowPwForm] = useState(false);
    /** Input values for the password change form. */
    const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' });
    /** Whether a password change request is in-flight. */
    const [pwLoading, setPwLoading] = useState(false);
    /** Feedback message to display after a password change attempt. */
    const [pwMsg, setPwMsg] = useState<{ ok: boolean; msg: string } | null>(null);

    useEffect(() => {
        if (!authUser) return;
        const load = async () => {
            try {
                const [p, bookings] = await Promise.all([
                    fetchUserProfile(authUser.uid),
                    fetchUserBookings(authUser.uid),
                ]);
                setProfile(p);
                setEditForm({ name: p.name, dept: p.dept, phone_no: p.phone_no });
                setStats({
                    total: bookings.length,
                });
            } catch {
                // fallback to auth user
                setProfile(authUser);
                setEditForm({ name: authUser.name, dept: authUser.dept, phone_no: authUser.phone_no });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    /**
     * Saves the current state of `editForm` to the backend.
     *
     * On success:
     *  - Updates the local `profile` state to reflect the new values.
     *  - Updates the `localStorage` user object so the Header's display name
     *    updates immediately without a page reload.
     *  - Exits edit mode and shows a success message.
     *
     * On failure:
     *  - Shows an error message from the backend.
     *
     * @async
     * @returns {Promise<void>}
     */
    const handleSave = async () => {
        if (!authUser) return;
        setSaving(true);
        setSaveMsg(null);
        try {
            await updateUserProfile(authUser.uid, editForm);
            setProfile(prev => prev ? { ...prev, ...editForm } : prev);
            // Update localStorage so Header shows new name
            const stored = localStorage.getItem('user');
            if (stored) {
                const u = JSON.parse(stored);
                localStorage.setItem('user', JSON.stringify({ ...u, ...editForm }));
            }
            setSaveMsg({ ok: true, msg: 'Profile updated successfully!' });
            setEditing(false);
        } catch (e: any) {
            setSaveMsg({ ok: false, msg: e.message });
        } finally {
            setSaving(false);
        }
    };

    /**
     * Submits the password change form to the backend.
     *
     * Validates that `pwForm.new` and `pwForm.confirm` match before making
     * the API call. On success, clears the form, shows a success message,
     * and auto-hides the form after 3 seconds.
     *
     * @async
     * @param {React.FormEvent} e - The form submission event.
     * @returns {Promise<void>}
     */
    const handlePwChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pwForm.new !== pwForm.confirm) {
            setPwMsg({ ok: false, msg: 'Passwords do not match' });
            return;
        }
        setPwLoading(true);
        setPwMsg(null);
        try {
            const { changePassword } = await import('../lib/api');
            await changePassword(pwForm.current, pwForm.new);
            setPwMsg({ ok: true, msg: 'Password changed successfully!' });
            setPwForm({ current: '', new: '', confirm: '' });
            setTimeout(() => {
                setShowPwForm(false);
                setPwMsg(null);
            }, 3000);
        } catch (err: any) {
            setPwMsg({ ok: false, msg: err.message });
        } finally {
            setPwLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
        );
    }

    const initials = (profile?.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    return (
        <div className="max-w-5xl mx-auto px-6 py-12">
            <h1 className="text-3xl font-bold text-slate-900 mb-8">My Profile</h1>

            {saveMsg && (
                <div className={`mb-6 p-3 rounded-lg text-sm font-medium ${saveMsg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                    {saveMsg.msg}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm sticky top-24">
                        <div className="w-28 h-28 bg-gradient-to-br from-primary to-indigo-600 text-white rounded-full mx-auto flex items-center justify-center text-4xl font-bold mb-4 ring-8 ring-indigo-50 shadow-xl shadow-primary/20">
                            {initials}
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">{profile?.name}</h2>
                        <p className="text-slate-500 text-sm">{profile?.userrole_id}</p>

                        <div className="mt-6 flex justify-center gap-2">
                            <span className="bg-blue-50 text-blue-600 text-xs px-3 py-1 rounded-full font-medium">{profile?.dept}</span>
                            <span className="bg-purple-50 text-purple-600 text-xs px-3 py-1 rounded-full font-medium">{profile?.uid}</span>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 w-full text-left space-y-4">
                            <div className="flex items-center gap-3 text-slate-600 text-sm">
                                <Envelope size={18} className="text-primary" />
                                <span>{profile?.email}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600 text-sm">
                                <Phone size={18} className="text-primary" />
                                <span>{profile?.phone_no}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600 text-sm">
                                <Briefcase size={18} className="text-primary" />
                                <span>Dept: {profile?.dept}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Stats */}
                    <button 
                        onClick={onViewBookings}
                        className="w-full bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl border border-indigo-100 flex items-center justify-between shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group"
                    >
                        <div className="text-left">
                            <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                                Total Bookings <ArrowRight size={12} weight="bold" className="group-hover:translate-x-1 transition-transform" />
                            </div>
                            <div className="text-4xl font-black text-indigo-900 group-hover:text-primary transition-colors">{stats.total}</div>
                        </div>
                        <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-500 shadow-inner group-hover:scale-110 transition-transform">
                            <CalendarBlank size={28} weight="duotone" />
                        </div>
                    </button>

                    {/* Edit Profile */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Gear size={20} /> Edit Profile
                            </h3>
                            {!editing && (
                                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-primary text-sm font-semibold hover:underline">
                                    <PencilSimple size={14} /> Edit
                                </button>
                            )}
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={editing ? editForm.name : (profile?.name || '')}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    disabled={!editing}
                                    className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-slate-50 disabled:text-slate-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                                <input
                                    type="text"
                                    value={editing ? editForm.dept : (profile?.dept || '')}
                                    onChange={e => setEditForm({ ...editForm, dept: e.target.value })}
                                    disabled={!editing}
                                    className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-slate-50 disabled:text-slate-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                                <input
                                    type="text"
                                    value={editing ? editForm.phone_no : (profile?.phone_no || '')}
                                    onChange={e => setEditForm({ ...editForm, phone_no: e.target.value })}
                                    disabled={!editing}
                                    className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-slate-50 disabled:text-slate-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input type="text" value={profile?.email || ''} disabled className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-500" />
                                <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
                            </div>
                            {editing && (
                                <div className="flex gap-3 pt-2">
                                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-bold transition-colors disabled:opacity-60">
                                        <Check size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button onClick={() => { setEditing(false); setEditForm({ name: profile?.name || '', dept: profile?.dept || '', phone_no: profile?.phone_no || '' }); }} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 px-4 py-2.5 rounded-lg font-medium border border-slate-200">
                                        <X size={16} /> Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Security */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Shield size={20} /> Security
                            </h3>
                        </div>
                        <div className="p-6">
                            {!showPwForm ? (
                                <button 
                                    onClick={() => setShowPwForm(true)}
                                    className="w-full text-left flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg transition-colors group"
                                >
                                    <span className="text-slate-700 font-medium">Change Password</span>
                                    <span className="text-slate-400 group-hover:text-primary text-sm">Update</span>
                                </button>
                            ) : (
                                <form onSubmit={handlePwChange} className="space-y-4">
                                    {pwMsg && (
                                        <div className={`p-3 rounded-lg text-sm font-medium ${pwMsg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                            {pwMsg.msg}
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                                        <input
                                            type="password"
                                            required
                                            value={pwForm.current}
                                            onChange={e => setPwForm({ ...pwForm, current: e.target.value })}
                                            className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                                        <input
                                            type="password"
                                            required
                                            value={pwForm.new}
                                            onChange={e => setPwForm({ ...pwForm, new: e.target.value })}
                                            className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                                        <input
                                            type="password"
                                            required
                                            value={pwForm.confirm}
                                            onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                                            className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button 
                                            type="submit" 
                                            disabled={pwLoading}
                                            className="flex-1 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-bold transition-colors disabled:opacity-60"
                                        >
                                            {pwLoading ? 'Updating...' : 'Update Password'}
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setShowPwForm(false)}
                                            className="px-4 py-2.5 rounded-lg font-medium border border-slate-200 text-slate-600"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>

                    <button onClick={logout} className="w-full py-4 text-red-500 font-bold bg-white border border-red-100 hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2">
                        <SignOut size={20} />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
