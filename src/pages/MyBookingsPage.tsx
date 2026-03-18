import {
    Calendar,
    Clock,
    MapPin,
    CaretLeft,
    CaretRight,
    Check,
    X,
    Bell,
    Info,
    ArrowCounterClockwise,
    VideoCamera,
    Users,
    MagnifyingGlass
} from '@phosphor-icons/react';
import React, { useState, useEffect, useMemo } from 'react';
import { fetchUserBookings, cancelBooking, Booking, getCurrentUser, parseLocalDate } from '../lib/api';

interface MyBookingsPageProps {
    onBrowse: () => void;
    onViewTicket?: (booking: Booking | any) => void;
}

interface Notification {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

const statusColors: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
    cancelled: 'bg-rose-100 text-rose-600 ring-1 ring-rose-200',
    rejected: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
};

// --- Sub-components ---

const SkeletonCard = () => (
    <div className="border border-theme-border rounded-3xl p-6 bg-theme-card animate-pulse">
        <div className="flex justify-between items-start mb-6">
            <div className="space-y-2">
                <div className="h-6 w-48 bg-theme-bg rounded-lg" />
                <div className="h-4 w-32 bg-theme-bg rounded-lg opacity-50" />
            </div>
            <div className="h-6 w-20 bg-theme-bg rounded-full" />
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-10 bg-theme-bg rounded-xl" />
            ))}
        </div>
        <div className="flex gap-4">
            <div className="h-12 flex-1 bg-theme-bg rounded-xl" />
            <div className="h-12 w-24 bg-theme-bg rounded-xl" />
        </div>
    </div>
);

const MyBookingsPage: React.FC<MyBookingsPageProps> = ({ onBrowse, onViewTicket }) => {
    const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showDatePopup, setShowDatePopup] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());

    // Cancel Modal state
    const [cancelModal, setCancelModal] = useState<{ open: boolean; booking: Booking | null }>({
        open: false, booking: null
    });
    const [cancelReason, setCancelReason] = useState('');
    // cancelDateSlots: { [date]: Set<slotStr> } — tracks which date+slots to remove
    const [cancelDateSlots, setCancelDateSlots] = useState<Record<string, Set<string>>>({});



    const openCancelModal = (booking: Booking) => {
        setCancelModal({ open: true, booking });
        setCancelReason('');
        setCancelDateSlots({});
    };

    const closeCancelModal = () => {
        setCancelModal({ open: false, booking: null });
        setCancelReason('');
        setCancelDateSlots({});
    };



    const user = getCurrentUser();

    const load = async (isInitial = false) => {
        if (!user) return;
        if (isInitial) setLoading(true);
        try {
            const data = await fetchUserBookings(user.uid);
            // Sort by booking ID descending (newest booking first)
            const sortedData = data.sort((a, b) => {
                const numA = parseInt(a.booking_id.split('-')[1]) || 0;
                const numB = parseInt(b.booking_id.split('-')[1]) || 0;
                return numB - numA;
            });
            setBookings(sortedData);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    useEffect(() => {
        load(true);
        const interval = setInterval(() => load(false), 10000);
        return () => clearInterval(interval);
    }, []);

    // --- Toast Logic ---
    const notify = (message: string, type: Notification['type'] = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    };

    // --- Filtering Logic ---
    const filteredBookings = useMemo(() => {
        const now = new Date();

        let result = bookings;

        // 1. Search Filter
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            result = result.filter(b =>
                (b.room_name || '').toLowerCase().includes(lowSearch) ||
                (b.booking_id || '').toLowerCase().includes(lowSearch) ||
                (b.purpose || '').toLowerCase().includes(lowSearch)
            );
        }

        // 2. Calendar Date Filter
        if (selectedDateFilter) {
            result = result.filter(b => b.start_date.slice(0, 10) === selectedDateFilter);
        }

        // 3. Tab Filter
        if (activeTab === 'upcoming') {
            return result.filter(b =>
                b.status !== 'cancelled' && b.status !== 'rejected' &&
                new Date(`${b.start_date.slice(0, 10)}T${b.start_time}`) >= now
            );
        } else if (activeTab === 'past') {
            return result.filter(b =>
                b.status !== 'cancelled' && b.status !== 'rejected' &&
                new Date(`${b.start_date.slice(0, 10)}T${b.start_time}`) < now
            );
        } else {
            return result.filter(b => b.status === 'cancelled' || b.status === 'rejected');
        }
    }, [bookings, searchTerm, selectedDateFilter, activeTab]);

    const stats = useMemo(() => ({
        upcoming: bookings.filter(b => b.status !== 'cancelled' && b.status !== 'rejected' && new Date(`${b.start_date.slice(0, 10)}T${b.start_time}`) >= new Date()).length,
        past: bookings.filter(b => b.status !== 'cancelled' && b.status !== 'rejected' && new Date(`${b.start_date.slice(0, 10)}T${b.start_time}`) < new Date()).length,
        cancelled: bookings.filter(b => b.status === 'cancelled' || b.status === 'rejected').length,
    }), [bookings]);

    // Calendar Helpers
    const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const isPastDate = (dateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(dateStr);
        targetDate.setHours(0, 0, 0, 0);
        return targetDate < today;
    };


    const TabButton = ({ id, label, count }: { id: typeof activeTab; label: string; count: number }) => (
        <button
            onClick={() => { setActiveTab(id); setSelectedDateFilter(null); }}
            className={`flex-1 py-3.5 px-6 rounded-[2rem] text-sm font-black transition-all flex items-center justify-center gap-3 relative overflow-hidden group
                ${activeTab === id ? 'text-white' : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-bg'}`}
        >
            {activeTab === id && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-emerald-500 rounded-[2rem] shadow-lg shadow-primary/25 pointer-events-none" />
            )}
            <span className="relative z-10">{label}</span>
            <span className={`relative z-10 text-[10px] px-2.5 py-1 rounded-full shadow-inner backdrop-blur-sm ${activeTab === id ? 'bg-black/20 text-white' : 'bg-theme-card text-theme-secondary'}`}>
                {count}
            </span>
        </button>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-[600px] text-center px-6">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center text-rose-500 mb-6">
                <div className="animate-pulse bg-rose-100 dark:bg-rose-900/30 p-4 rounded-full">
                    <X size={32} weight="bold" />
                </div>
            </div>
            <h2 className="text-2xl font-bold text-theme-primary mb-2">Connection Issue</h2>
            <p className="text-theme-secondary mb-8 max-w-sm">{error}</p>
            <button
                onClick={() => load(true)}
                className="bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-primary/25 flex items-center gap-2"
            >
                <ArrowCounterClockwise size={20} weight="bold" />
                Try Reconnecting
            </button>
        </div>
    );

    return (
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-12 relative">
            {/* Toast Notifications */}
            <div className="fixed top-24 right-6 z-[100] space-y-3 pointer-events-none">
                {notifications.map(n => (
                    <div key={n.id} className={`
                        flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl bg-white border pointer-events-auto
                        transform animate-in slide-in-from-right duration-300
                        ${n.type === 'success' ? 'border-emerald-100' : n.type === 'error' ? 'border-rose-100' : 'border-blue-100'}
                    `}>
                        <div className={`p-2 rounded-lg 
                            ${n.type === 'success' ? 'bg-emerald-50 text-emerald-500' : n.type === 'error' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'}
                        `}>
                            {n.type === 'success' ? <Check size={18} weight="bold" /> : <Bell size={18} weight="bold" />}
                        </div>
                        <p className="text-sm font-bold text-slate-700">{n.message}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 sm:mb-12 gap-4">
                <div className="text-left relative z-10">
                    <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-4">
                        <Calendar size={14} weight="bold" />
                        Your Workspace
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-black text-theme-primary tracking-tight mb-3">Booking Dashboard</h1>
                    <p className="text-theme-secondary sm:text-lg font-medium max-w-lg">
                        Manage your conference schedule, upcoming reservations, and history all in one place.
                    </p>
                </div>

                {/* Search Bar — desktop only */}
                <div className="relative w-full md:w-96 hidden md:block">
                    <MagnifyingGlass size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-secondary opacity-50" />
                    <input
                        type="text"
                        placeholder="Search Room, ID, or Purpose..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-theme-card border border-theme-border rounded-2xl py-4 pl-12 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-theme-secondary/50 shadow-sm text-theme-primary"
                    />
                </div>
            </div>

            <div className="flex flex-col-reverse lg:grid lg:grid-cols-12 gap-8 lg:gap-12">

                {/* Right Column: Bookings List */}
                <div className="lg:col-span-7 flex flex-col min-h-[800px]">
                    <div className="bg-white rounded-full border border-slate-200 p-2 shadow-sm mb-8 flex gap-2 w-full lg:max-w-2xl">
                        <TabButton id="upcoming" label="Upcoming" count={stats.upcoming} />
                        <TabButton id="past" label="Past" count={stats.past} />
                        <TabButton id="cancelled" label="Cancelled" count={stats.cancelled} />
                    </div>

                    <div className="space-y-8 pb-20">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
                        ) : filteredBookings.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-20 text-center bg-theme-bg/50 rounded-[3rem] border border-dashed border-theme-border">
                                <div className="w-24 h-24 bg-theme-card rounded-3xl flex items-center justify-center text-theme-secondary opacity-30 mb-8 shadow-sm">
                                    <MagnifyingGlass size={48} weight="light" />
                                </div>
                                <h3 className="text-2xl font-black text-theme-primary mb-3">No matching results</h3>
                                <p className="text-theme-secondary mb-8 max-w-xs font-medium italic">Try adjusting your filters or search terms to find what you're looking for.</p>
                                {(searchTerm || selectedDateFilter) && (
                                    <button
                                        onClick={() => { setSearchTerm(''); setSelectedDateFilter(null); }}
                                        className="text-primary font-black uppercase tracking-widest text-xs flex items-center gap-2"
                                    >
                                        <ArrowCounterClockwise size={16} weight="bold" />
                                        Reset Filters
                                    </button>
                                )}
                            </div>
                        ) : (
                            filteredBookings.map(booking => {
                                const isConfirmed = booking.status === 'confirmed';

                                let cardClasses = "group rounded-[2.5rem] p-8 transition-all duration-500 relative hover:-translate-y-1 overflow-hidden border backdrop-blur-xl ";
                                if (isConfirmed) cardClasses += "bg-gradient-to-br from-theme-card to-emerald-50/10 dark:to-emerald-900/10 border-emerald-100/50 dark:border-emerald-900/30 hover:border-emerald-200/80 shadow-2xl shadow-emerald-900/5";
                                else cardClasses += "bg-gradient-to-br from-theme-card to-rose-50/10 dark:to-rose-900/10 border-rose-100/50 dark:border-rose-900/30 hover:border-rose-200/80 shadow-2xl shadow-rose-900/5";

                                const statBoxClasses = isConfirmed ? "bg-white/50 dark:bg-emerald-950/20 backdrop-blur border-emerald-100/50 shadow-sm" : "bg-white/50 dark:bg-rose-950/20 backdrop-blur border-rose-100/50 shadow-sm";
                                const statValueClasses = isConfirmed ? "text-emerald-950 dark:text-emerald-400" : "text-rose-950 dark:text-rose-400";
                                const titleClasses = "text-theme-primary";

                                return (
                                    <div
                                        key={booking.booking_id}
                                        className={cardClasses}
                                    >
                                    <div className={`absolute top-0 right-0 w-64 h-64 opacity-20 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none ${isConfirmed?'bg-emerald-400':'bg-rose-400'}`}></div>

                                    {/* Background Watermark Icon */}
                                    <div className={`absolute -right-4 -bottom-4 opacity-[0.03] transform transition-transform duration-700 pointer-events-none text-theme-primary group-hover:scale-110 group-hover:-rotate-12`}>
                                        {isConfirmed ? <Calendar size={200} weight="fill" /> : <VideoCamera size={200} weight="fill" />}
                                    </div>

                                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                                        <div className="flex items-center gap-5">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 bg-theme-bg text-primary group-hover:bg-primary group-hover:text-white`}>
                                                <VideoCamera size={28} weight="bold" />
                                            </div>
                                            <div>
                                                <h3 className={`text-2xl font-black leading-tight tracking-tight ${titleClasses}`}>
                                                    {booking.room_name || `Room ${booking.room_id}`}
                                                </h3>
                                                <p className={`text-theme-secondary font-bold uppercase text-[10px] tracking-widest mt-1`}>
                                                    Reserved for {booking.user_name || 'Individual'}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`px-5 py-2 text-[10px] font-black rounded-full uppercase tracking-widest transition-all ${statusColors[booking.status] || 'bg-slate-100 text-slate-600'} shadow-sm`}>
                                            {booking.status === 'confirmed' ? '✓ ' : ''}
                                            {booking.status}
                                        </span>
                                    </div>

                                    <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                        <div className={`${statBoxClasses} rounded-2xl p-4 border transition-colors`}>
                                            <label className="block text-theme-secondary opacity-50 text-[9px] uppercase font-black tracking-widest mb-1.5">Reference</label>
                                            <span className={`font-black font-mono text-sm ${statValueClasses}`}>#{booking.booking_id.split('-')[1] || booking.booking_id.slice(-6)}</span>
                                        </div>
                                        <div className={`${statBoxClasses} rounded-2xl p-4 border transition-colors`}>
                                            <label className="block text-theme-secondary opacity-50 text-[9px] uppercase font-black tracking-widest mb-1.5">Schedule</label>
                                            <span className={`font-black text-sm italic ${statValueClasses}`}>
                                                {parseLocalDate(booking.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                        <div className={`${statBoxClasses} rounded-2xl p-4 border transition-colors`}>
                                            <label className="block text-theme-secondary opacity-50 text-[9px] uppercase font-black tracking-widest mb-1.5">Time Interval</label>
                                            <span className={`font-black text-sm ${statValueClasses}`}>
                                                {booking.start_time?.slice(0, 5)}–{booking.end_time?.slice(0, 5)}
                                            </span>
                                        </div>
                                        <div className={`${statBoxClasses} rounded-2xl p-4 border transition-colors`}>
                                            <label className="block text-theme-secondary opacity-50 text-[9px] uppercase font-black tracking-widest mb-1.5">Location</label>
                                            <div className="flex items-center gap-1">
                                                <MapPin size={12} className="text-primary" weight="bold" />
                                                <span className={`font-black text-sm truncate ${statValueClasses}`}>{booking.location || 'HQ'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-4">
                                        {booking.status === 'confirmed' && (
                                            <button
                                                onClick={() => onViewTicket && onViewTicket(booking)}
                                                className="w-full md:flex-1 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white py-5 rounded-[1.25rem] text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] shadow-xl shadow-emerald-900/20 hover:shadow-emerald-900/40 flex items-center justify-center gap-2"
                                            >
                                                <Check size={18} weight="bold" />
                                                Access Ticket
                                            </button>
                                        )}
                                        {booking.status === 'confirmed' && (
                                            <button
                                                onClick={() => openCancelModal(booking)}
                                                disabled={cancellingId === booking.booking_id}
                                                className={`w-full md:w-auto px-8 py-5 rounded-[1.25rem] text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 border border-transparent 
                                                     bg-rose-50 text-rose-500 hover:bg-rose-100 hover:border-rose-200 shadow-sm shadow-rose-900/5`}
                                            >
                                                {cancellingId === booking.booking_id ? 'Wait...' : 'Cancel'}
                                            </button>
                                        )}
                                        {booking.status === 'cancelled' && (
                                            <div className="w-full bg-theme-bg flex items-center gap-3 p-5 rounded-[1.25rem] border border-theme-border">
                                                <Info size={20} className="text-theme-secondary opacity-50" />
                                                <p className="text-xs font-bold text-theme-secondary italic">This reservation was voided and cannot be reused.</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Granular Segments Display */}
                                    {(booking.selected_dates || booking.selected_slots) && booking.status !== 'cancelled' && (
                                        <div className={`mt-8 pt-8 border-t border-theme-border space-y-4`}>
                                            {booking.selected_dates && booking.selected_dates.split(',').length > 1 && (
                                                <div>
                                                    <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block text-theme-secondary opacity-50`}>Reserved Dates</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {booking.selected_dates.split(',').sort().map(d => (
                                                            <span key={d} className={`px-3 py-1 rounded-lg text-xs font-bold border bg-theme-bg text-theme-secondary border-theme-border`}>
                                                                {new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {booking.selected_slots && (
                                                <div>
                                                    <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block text-theme-secondary opacity-50`}>Daily Time Blocks</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {booking.selected_slots.split(',').sort().map(s => (
                                                            <span key={s} className={`px-3 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 bg-primary/5 text-primary border-primary/10`}>
                                                                <Clock size={12} weight="bold" />
                                                                {s.split('-')[0].slice(0, 5)} - {s.split('-')[1].slice(0, 5)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
            {/* Left Column: Personal Calendar & Stats */}
            <div className="lg:col-span-5 space-y-8">
                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-theme-card to-theme-bg backdrop-blur-xl border border-theme-border rounded-[2rem] p-6 text-theme-primary relative overflow-hidden group hover:-translate-y-1 transition-transform shadow-2xl shadow-theme-border/20">
                            <div className="relative z-10 flex flex-col h-full justify-between">
                                <div className="p-2.5 bg-theme-bg rounded-2xl w-max mb-4 shadow-inner ring-1 ring-black/5">
                                    <Calendar size={20} className="text-primary" weight="duotone" />
                                </div>
                                <div>
                                    <h4 className="text-3xl font-black mb-1">{stats.upcoming}</h4>
                                    <p className="text-theme-secondary text-[10px] font-bold uppercase tracking-widest">Upcoming</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-[2rem] p-6 text-white relative overflow-hidden group hover:-translate-y-1 transition-transform shadow-2xl shadow-emerald-500/30">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
                            <div className="relative z-10 flex flex-col h-full justify-between">
                                <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl w-max mb-4 shadow-inner">
                                    <VideoCamera size={20} className="text-white" weight="duotone" />
                                </div>
                                <div>
                                    <h4 className="text-3xl font-black mb-1">{bookings.length}</h4>
                                    <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Total</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-rose-400 to-red-500 rounded-[2rem] p-6 text-white relative overflow-hidden group hover:-translate-y-1 transition-transform shadow-2xl shadow-rose-500/30">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" />
                            <div className="relative z-10 flex flex-col h-full justify-between">
                                <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl w-max mb-4 shadow-inner">
                                    <Info size={20} className="text-white" weight="duotone" />
                                </div>
                                <div>
                                    <h4 className="text-3xl font-black mb-1">{stats.cancelled}</h4>
                                    <p className="text-rose-100 text-[10px] font-bold uppercase tracking-widest">Cancelled</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Calendar Card */}
                    <div className="bg-theme-card rounded-[2.5rem] border border-theme-border shadow-xl p-8 overflow-hidden relative">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black text-theme-primary italic tracking-tighter uppercase">My Schedule</h2>
                            <div className="flex gap-4 items-center bg-theme-bg p-1.5 rounded-2xl border border-theme-border">
                                <button
                                    onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                                    className="p-2 hover:bg-theme-card hover:shadow-sm rounded-xl transition-all text-theme-secondary hover:text-primary"
                                >
                                    <CaretLeft size={20} weight="bold" />
                                </button>
                                <span className="text-sm font-black text-theme-primary w-28 text-center uppercase tracking-widest">{monthNames[currentDate.getMonth()]}</span>
                                <button
                                    onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                                    className="p-2 hover:bg-theme-card hover:shadow-sm rounded-xl transition-all text-theme-secondary hover:text-primary"
                                >
                                    <CaretRight size={20} weight="bold" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-2 mb-6">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, ix) => (
                                <div key={ix} className="text-[10px] font-black text-theme-secondary opacity-30 uppercase text-center py-2">{day}</div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: getFirstDayOfMonth(currentDate) }).map((_, i) => (
                                <div key={`empty-${i}`} className="aspect-square"></div>
                            ))}
                            {Array.from({ length: getDaysInMonth(currentDate) }).map((_, i) => {
                                const day = i + 1;
                                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const dateBookings = bookings.filter(b => b.start_date.slice(0, 10) === dateStr);
                                const hasConfirmed = dateBookings.some(b => b.status === 'confirmed');
                                const hasCancelled = dateBookings.some(b => b.status === 'cancelled' || b.status === 'rejected');
                                const isSelected = selectedDateFilter === dateStr;
                                const isPast = isPastDate(dateStr);

                                let dateColorClass = 'hover:bg-theme-bg cursor-default text-theme-secondary opacity-30';
                                if (isPast) {
                                    dateColorClass = 'bg-theme-bg/50 text-theme-secondary opacity-20 cursor-not-allowed';
                                } else if (dateBookings.length > 0) {
                                    if (hasConfirmed) {
                                        dateColorClass = 'bg-emerald-500 shadow-xl shadow-emerald-500/40 cursor-pointer active:scale-90 text-white hover:bg-emerald-600';
                                    } else if (!hasConfirmed && hasCancelled) {
                                        dateColorClass = 'bg-rose-500 shadow-xl shadow-rose-500/40 cursor-pointer active:scale-90 text-white hover:bg-rose-600';
                                    } else {
                                        dateColorClass = 'bg-theme-primary shadow-xl shadow-theme-primary/40 cursor-pointer active:scale-90 text-theme-bg hover:opacity-90';
                                    }
                                }

                                return (
                                    <button
                                        key={day}
                                        onClick={() => {
                                            if (isPast) return;
                                            if (dateBookings.length > 0) setShowDatePopup(dateStr);
                                        }}
                                        disabled={isPast}
                                        className={`aspect-square relative flex flex-col items-center justify-center rounded-2xl transition-all font-black text-sm lg:text-base 
                                            ${dateColorClass}
                                            ${isSelected && !isPast ? 'ring-[3px] ring-primary ring-offset-2' : ''}
                                        `}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-8 pt-8 border-t border-theme-border flex gap-8 justify-center">
                            <div className="flex items-center gap-2 group cursor-help" title="Click a date to filter list">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-black text-theme-secondary opacity-50 uppercase tracking-[0.2em]">Confirmed</span>
                            </div>
                            <div className="flex items-center gap-2 group cursor-help">
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                                <span className="text-[10px] font-black text-theme-secondary opacity-50 uppercase tracking-[0.2em]">Cancelled</span>
                            </div>
                        </div>

                        {selectedDateFilter && (
                            <button
                                onClick={() => setSelectedDateFilter(null)}
                                className="absolute top-8 right-8 text-[10px] font-black text-primary uppercase tracking-wider bg-primary/10 px-3 py-1.5 rounded-full animate-bounce"
                            >
                                Clear Filter
                            </button>
                        )}
                    </div>

                    <div className="bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600 text-white rounded-[2.5rem] p-10 relative overflow-hidden group cursor-pointer shadow-2xl shadow-emerald-600/20" onClick={onBrowse}>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
                        <div className="absolute -bottom-10 -right-10 p-10 opacity-[0.07] group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                            <VideoCamera size={240} weight="duotone" />
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                                <h3 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 drop-shadow-sm">Instant Booking</h3>
                                <p className="text-emerald-50 text-sm sm:text-base leading-relaxed max-w-sm font-medium">Ready for your next breakout session? Browse live availability now.</p>
                            </div>
                            <div className="bg-white hover:bg-emerald-50 text-emerald-600 px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest inline-flex items-center gap-2 shadow-2xl shadow-black/10 transition-colors active:scale-95">
                                Browse Rooms
                                <CaretRight size={16} weight="bold" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Date Details Modal Popup */}
            {
                showDatePopup && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-theme-bg/60 backdrop-blur-sm cursor-pointer transition-opacity"
                            onClick={() => setShowDatePopup(null)}
                        />

                        {/* Modal Dialog */}
                        <div className="bg-theme-card border border-theme-border rounded-[2rem] shadow-2xl w-full max-w-lg relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
                            {/* Header */}
                            <div className="px-8 py-6 border-b border-theme-border flex justify-between items-center bg-theme-bg sticky top-0">
                                <div>
                                    <h3 className="text-xl font-black text-theme-primary tracking-tight">
                                        {new Date(showDatePopup!).toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </h3>
                                    <p className="text-sm font-semibold text-theme-secondary mt-1">
                                        {bookings.filter(b => b.start_date.slice(0, 10) === showDatePopup).length} Bookings found
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowDatePopup(null)}
                                    className="p-2.5 hover:bg-theme-bg rounded-xl transition-all shadow-sm text-theme-secondary hover:text-theme-primary border border-theme-border"
                                >
                                    <X size={20} weight="bold" />
                                </button>
                            </div>

                            {/* Content Details */}
                            <div className="p-8 overflow-y-auto space-y-4 bg-theme-bg/50">
                                {bookings
                                    .filter(b => b.start_date.slice(0, 10) === showDatePopup)
                                    .map(booking => (
                                        <div key={booking.booking_id} className="bg-theme-card p-5 rounded-2xl border border-theme-border shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-4">
                                                <h4 className="font-bold text-theme-primary text-lg">{booking.room_name || `Room ${booking.room_id}`}</h4>
                                                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider
                                                    ${booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-600' :
                                                            'bg-rose-100 text-rose-600'}
                                                `}>
                                                    {booking.status}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 text-theme-primary text-sm font-medium">
                                                    <div className="w-8 h-8 rounded-lg bg-theme-bg flex items-center justify-center text-theme-secondary">
                                                        <Clock size={16} weight="bold" />
                                                    </div>
                                                    <span>{booking.start_time} - {booking.end_time}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-theme-primary text-sm font-medium">
                                                    <div className="w-8 h-8 rounded-lg bg-theme-bg flex items-center justify-center text-theme-secondary">
                                                        <Users size={16} weight="bold" />
                                                    </div>
                                                    <span className="capitalize">{booking.purpose || 'Team Meeting'}</span>
                                                </div>
                                            </div>

                                            {booking.status !== 'cancelled' && booking.status !== 'rejected' && (
                                                <button
                                                    onClick={() => {
                                                        setShowDatePopup(null);
                                                        openCancelModal(booking);
                                                    }}
                                                    className="w-full mt-5 py-3 rounded-xl border-2 border-rose-100 dark:border-rose-900/30 text-rose-500 font-bold text-sm hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                >
                                                    Cancel Reservation
                                                </button>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ═══ CANCEL MODAL ═══ */}
            {cancelModal.open && cancelModal.booking && (() => {
                const booking = cancelModal.booking!;

                // All slots for this booking (1-hour blocks)
                const buildSlots = (start: string, end: string): string[] => {
                    const slots: string[] = [];
                    let h = parseInt(start.slice(0, 2));
                    const endH = parseInt(end.slice(0, 2));
                    while (h < endH) {
                        slots.push(`${String(h).padStart(2, '0')}:00-${String(h + 1).padStart(2, '0')}:00`);
                        h++;
                    }
                    return slots;
                };
                const allSlots = booking.selected_slots
                    ? booking.selected_slots!.split(',').map(s => {
                        // normalize to HH:MM-HH:MM
                        const parts = s.split('-');
                        return `${parts[0].slice(0, 5)}-${parts[1].slice(0, 5)}`;
                    })
                    : buildSlots(booking.start_time, booking.end_time);

                const allDates: string[] = booking.selected_dates
                    ? booking.selected_dates!.split(',').map(d => d.trim()).sort()
                    : [booking.start_date.slice(0, 10)];

                const isMultiDay = allDates.length > 1;

                // toggle a date selection
                const toggleDate = (date: string) => {
                    setCancelDateSlots(prev => {
                        const next = { ...prev };
                        if (next[date]) {
                            delete next[date];
                        } else {
                            // pre-select all slots for this date
                            next[date] = new Set(allSlots);
                        }
                        return next;
                    });
                };

                // toggle a slot within a date
                const toggleSlot = (date: string, slot: string) => {
                    setCancelDateSlots(prev => {
                        const next = { ...prev };
                        if (!next[date]) next[date] = new Set();
                        const slots = new Set(next[date]);
                        if (slots.has(slot)) slots.delete(slot);
                        else slots.add(slot);

                        if (slots.size === 0) delete next[date];
                        else next[date] = slots;
                        return next;
                    });
                };

                const totalSelectedDates = Object.keys(cancelDateSlots).length;
                const isFullCancel = totalSelectedDates === allDates.length &&
                    Object.values(cancelDateSlots).every(s => s.size === allSlots.length);

                const submitCancel = async (fullCancel = false) => {
                    const user = getCurrentUser();
                    if (!user || !booking) return;
                    if (!cancelReason.trim()) {
                        notify('Please provide a cancellation reason', 'error');
                        return;
                    }
                    if (!fullCancel && totalSelectedDates === 0) {
                        notify('Please select at least one date to cancel', 'error');
                        return;
                    }

                    notify('Processing cancellation...', 'info');
                    setCancellingId(booking.booking_id);
                    try {
                        if (fullCancel || isFullCancel) {
                            // Full cancel
                            await cancelBooking(booking.booking_id, user.uid, booking, {
                                reason: cancelReason, partial: false,
                            });
                            notify('Booking cancelled successfully', 'success');
                        } else {
                            // Partial cancel — pass granular removals to backend
                            const partial_removals = Object.entries(cancelDateSlots).map(([date, slotSet]) => ({
                                date,
                                slots: Array.from(slotSet)
                            }));

                            await cancelBooking(booking.booking_id, user.uid, booking, {
                                reason: cancelReason,
                                partial: true,
                                partial_removals
                            });
                            notify(
                                isMultiDay
                                    ? `Selected slots for ${partial_removals.length} day(s) cancelled.`
                                    : 'Selected slots cancelled.',
                                'success'
                            );
                        }
                        const updatedBookings = await fetchUserBookings(user.uid);
                        setBookings(updatedBookings);
                        closeCancelModal();
                    } catch (e: any) {
                        notify(e.message, 'error');
                    } finally {
                        setCancellingId(null);
                    }
                };

                return (
                    <div className="fixed inset-0 bg-theme-bg/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeCancelModal}>
                        <div className="bg-theme-card border border-theme-border rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="bg-gradient-to-r from-rose-500 to-red-500 px-6 py-5 text-white rounded-t-2xl flex-shrink-0">
                                <h3 className="text-lg font-bold">Cancel Booking</h3>
                                <p className="text-rose-100 text-sm mt-0.5">
                                    {booking.room_name} &bull; {allSlots[0]} – {allSlots[allSlots.length - 1].split('-')[1]}
                                </p>
                            </div>

                            <div className="p-6 space-y-5 overflow-y-auto flex-1">
                                {/* Reason */}
                                <div>
                                    <label className="block text-xs font-bold text-theme-secondary opacity-50 uppercase tracking-wider mb-2">
                                        Reason <span className="text-rose-500">*</span>
                                    </label>
                                    <textarea
                                        value={cancelReason}
                                        onChange={e => setCancelReason(e.target.value)}
                                        placeholder="Why are you cancelling?"
                                        className="w-full bg-theme-bg border border-theme-border rounded-xl p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-rose-300 transition-all font-medium text-theme-primary placeholder:text-theme-secondary/30"
                                        autoFocus
                                    />
                                </div>

                                {/* Date + Slot selector (for multi-day or show slots directly for single-day) */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-xs font-bold text-theme-secondary opacity-50 uppercase tracking-wider">
                                            {isMultiDay ? 'Select date(s) & slots to cancel' : 'Select slot(s) to cancel'}
                                        </label>
                                        {isMultiDay && (
                                            <button
                                                onClick={() => {
                                                    // select all dates+slots
                                                    const all: Record<string, Set<string>> = {};
                                                    allDates.forEach(d => { all[d] = new Set(allSlots); });
                                                    setCancelDateSlots(all);
                                                }}
                                                className="text-[10px] font-black text-rose-500 uppercase tracking-wider hover:underline"
                                            >
                                                Select All
                                            </button>
                                        )}
                                    </div>

                                    {isMultiDay ? (
                                        // Multi-day: show dates as pills, expand slots on click
                                        <div className="space-y-2">
                                            {allDates.map(date => {
                                                const isDateSelected = !!cancelDateSlots[date];
                                                const selectedSlotSet = cancelDateSlots[date] || new Set<string>();
                                                return (
                                                    <div key={date} className={`border-2 rounded-xl overflow-hidden transition-all ${isDateSelected ? 'border-rose-300' : 'border-theme-border'
                                                        }`}>
                                                        {/* Date toggle header */}
                                                        <button
                                                            onClick={() => toggleDate(date)}
                                                            className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isDateSelected ? 'bg-rose-50 dark:bg-rose-900/10' : 'bg-theme-bg hover:bg-theme-bg/80'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${isDateSelected ? 'bg-rose-500 border-rose-500' : 'border-theme-border'
                                                                    }`}>
                                                                    {isDateSelected && <Check size={12} weight="bold" className="text-white" />}
                                                                </div>
                                                                <span className="font-bold text-sm text-theme-primary">
                                                                    {new Date(date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                                </span>
                                                            </div>
                                                            {isDateSelected && (
                                                                <span className="text-[10px] font-black text-rose-500 uppercase">
                                                                    {selectedSlotSet.size}/{allSlots.length} slots
                                                                </span>
                                                            )}
                                                        </button>

                                                        {/* Slots for this date (only shown when date is selected) */}
                                                        {isDateSelected && (
                                                            <div className="px-4 py-3 grid grid-cols-2 gap-2 bg-theme-card">
                                                                {allSlots.map(slot => {
                                                                    const checked = selectedSlotSet.has(slot);
                                                                    const [from, to] = slot.split('-');
                                                                    return (
                                                                        <label key={slot} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-xs font-bold ${checked ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20 text-rose-700' : 'border-theme-border bg-theme-bg text-theme-secondary opacity-50'
                                                                            }`}>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={checked}
                                                                                onChange={() => toggleSlot(date, slot)}
                                                                                className="accent-rose-500 w-4 h-4 flex-shrink-0"
                                                                            />
                                                                            <Clock size={12} weight="bold" />
                                                                            {from} – {to}
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        // Single-day: show slot grid directly
                                        <div className="grid grid-cols-2 gap-2">
                                            {allSlots.map(slot => {
                                                const date = allDates[0];
                                                const checked = (cancelDateSlots[date] || new Set()).has(slot);
                                                const [from, to] = slot.split('-');
                                                return (
                                                    <label key={slot} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all text-xs font-bold ${checked ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20 text-rose-700' : 'border-theme-border bg-theme-bg text-theme-secondary opacity-50'
                                                        }`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleSlot(date, slot)}
                                                            className="accent-rose-500 w-4 h-4 flex-shrink-0"
                                                        />
                                                        <Clock size={12} weight="bold" />
                                                        {from} – {to}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Summary pill */}
                                {totalSelectedDates > 0 && (
                                    <div className={`rounded-xl p-3 text-xs font-bold border ${isFullCancel
                                        ? 'bg-rose-50 border-rose-100 text-rose-600'
                                        : 'bg-amber-50 border-amber-100 text-amber-700'
                                        }`}>
                                        {isFullCancel
                                            ? '⚠️ This will cancel the entire booking'
                                            : `Partial cancel: ${totalSelectedDates} date(s) selected — other dates remain active`
                                        }
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <button onClick={closeCancelModal} className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
                                        Back
                                    </button>
                                    <button
                                        onClick={() => submitCancel(false)}
                                        disabled={!cancelReason.trim() || totalSelectedDates === 0 || cancellingId !== null}
                                        className="flex-1 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-colors disabled:opacity-40"
                                    >
                                        {cancellingId ? 'Processing...' : 'Cancel Selected'}
                                    </button>
                                    <button
                                        onClick={() => submitCancel(true)}
                                        disabled={!cancelReason.trim() || cancellingId !== null}
                                        className="py-3.5 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm transition-colors disabled:opacity-40"
                                    >
                                        Cancel All
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default MyBookingsPage;

