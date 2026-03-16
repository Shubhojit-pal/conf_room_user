import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle, XCircle, Info, BellSlash, Checks, ArrowRight } from '@phosphor-icons/react';
import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead, fetchUserBookings, getCurrentUser } from '../lib/api';

interface NotificationItem {
    _id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
    booking_id?: string;
}

interface NotificationsPageProps {
    onNavigate?: (view: string) => void;
    onViewTicket?: (booking: any) => void;
}

const NotificationsPage: React.FC<NotificationsPageProps> = ({ onNavigate, onViewTicket }) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [navigatingId, setNavigatingId] = useState<string | null>(null);

    const loadNotifications = async () => {
        try {
            const data = await fetchNotifications();
            setNotifications(data);
        } catch (e) {
            console.error('Failed to load notifications:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, []);

    const handleMarkRead = async (id: string) => {
        await markNotificationAsRead(id);
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    };

    const handleMarkAllRead = async () => {
        await markAllNotificationsAsRead();
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    };

    /**
     * Clicking a notification:
     * - Marks it as read
     * - If it has a booking_id and a ticket viewer is available → opens that booking ticket
     * - If it's a booking type → navigate to my-bookings
     * - Otherwise → stay on page (already marked read)
     */
    const handleNotifClick = async (notif: NotificationItem) => {
        if (!notif.isRead) await handleMarkRead(notif._id);

        if (notif.booking_id) {
            setNavigatingId(notif._id);
            try {
                const currentUser = getCurrentUser();
                if (!currentUser) throw new Error('Not logged in');
                // Fetch user's bookings and find the matching one
                const bookings = await fetchUserBookings(currentUser.uid);
                const matched = bookings.find((b: any) => b.booking_id === notif.booking_id);
                if (matched && onViewTicket) {
                    onViewTicket(matched);
                    return;
                }
            } catch (e) {
                console.error('Could not load booking:', e);
            } finally {
                setNavigatingId(null);
            }
            // Fallback: go to My Bookings
            if (onNavigate) onNavigate('my-bookings');
        } else if (notif.type === 'booking' && onNavigate) {
            onNavigate('my-bookings');
        } else if (notif.type === 'system' && onNavigate) {
            onNavigate('home');
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const diffInMins = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        if (diffInMins < 1) return 'Just now';
        if (diffInMins < 60) return `${diffInMins} min ago`;
        if (diffInHours < 24) return `${diffInHours}h ago`;
        if (diffInDays === 1) return 'Yesterday';
        return `${diffInDays} days ago`;
    };

    const getIconAndColor = (title: string) => {
        const t = title.toLowerCase();
        if (t.includes('approved') || t.includes('confirmed'))
            return { icon: <CheckCircle size={22} weight="fill" className="text-green-500" />, bg: 'bg-green-50' };
        if (t.includes('rejected') || t.includes('denied'))
            return { icon: <XCircle size={22} weight="fill" className="text-red-500" />, bg: 'bg-red-50' };
        if (t.includes('cancel'))
            return { icon: <XCircle size={22} weight="fill" className="text-slate-400" />, bg: 'bg-slate-100' };
        if (t.includes('confirmed') || t.includes('cancelled'))
            return { icon: <CheckCircle size={22} weight="fill" className="text-green-500" />, bg: 'bg-green-50' };
        return { icon: <Info size={22} weight="fill" className="text-primary" />, bg: 'bg-blue-50' };
    };

    const isClickable = (notif: NotificationItem) => !!notif.booking_id || notif.type === 'booking' || notif.type === 'system';
    const getActionLabel = (notif: NotificationItem) => {
        if (notif.booking_id) return 'View Booking Ticket →';
        if (notif.type === 'booking') return 'View My Bookings →';
        if (notif.type === 'system') return 'Go to Home →';
        return null;
    };

    const displayed = filter === 'unread' ? notifications.filter(n => !n.isRead) : notifications;
    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-24 md:pb-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Notifications</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up! ✓'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={handleMarkAllRead}
                        className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-dark transition-colors bg-primary/10 hover:bg-primary/20 px-4 py-2 rounded-lg"
                    >
                        <Checks size={18} />
                        Mark all read
                    </button>
                )}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${filter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    All
                </button>
                <button
                    onClick={() => setFilter('unread')}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${filter === 'unread' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Unread
                    {unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Loading Skeleton */}
            {isLoading && (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white rounded-xl p-4 border border-slate-100 animate-pulse">
                            <div className="flex gap-3">
                                <div className="w-10 h-10 bg-slate-200 rounded-full shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-slate-200 rounded w-1/2" />
                                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && displayed.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="bg-slate-100 p-6 rounded-full mb-4">
                        <BellSlash size={40} className="text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 mb-1">
                        {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                    </h3>
                    <p className="text-slate-400 text-sm max-w-xs">
                        {filter === 'unread'
                            ? 'You\'re all caught up! Switch to "All" to see past notifications.'
                            : 'Notifications from your bookings will appear here.'}
                    </p>
                </div>
            )}

            {/* Notification List */}
            {!isLoading && displayed.length > 0 && (
                <div className="space-y-2">
                    {displayed.map((notif) => {
                        const { icon, bg } = getIconAndColor(notif.title);
                        const clickable = isClickable(notif);
                        const actionLabel = getActionLabel(notif);
                        const isNavigating = navigatingId === notif._id;

                        return (
                            <div
                                key={notif._id}
                                onClick={() => handleNotifClick(notif)}
                                className={`
                                    group flex items-start gap-4 p-4 rounded-xl border transition-all
                                    ${clickable ? 'cursor-pointer hover:shadow-md active:scale-[0.99]' : 'cursor-default'}
                                    ${!notif.isRead
                                        ? 'bg-blue-50/50 border-blue-200 hover:border-blue-300 hover:bg-blue-50'
                                        : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                                    }
                                `}
                            >
                                {/* Icon */}
                                <div className={`p-2 rounded-full shrink-0 mt-0.5 ${bg}`}>
                                    {icon}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <h4 className={`text-sm leading-snug ${!notif.isRead ? 'font-bold text-slate-800' : 'font-semibold text-slate-600'}`}>
                                            {notif.title}
                                        </h4>
                                        <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0 mt-0.5">
                                            {formatTime(notif.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{notif.message}</p>

                                    {/* Action label */}
                                    {actionLabel && (
                                        <div className="flex items-center gap-1 mt-2">
                                            {isNavigating ? (
                                                <span className="text-[11px] text-primary font-semibold animate-pulse">Opening...</span>
                                            ) : (
                                                <span className="text-[11px] text-primary font-semibold flex items-center gap-1 group-hover:underline">
                                                    {actionLabel}
                                                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Unread dot */}
                                {!notif.isRead && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-2" />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Info bar */}
            <div className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                <Bell size={18} className="text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 leading-relaxed">
                    Tap any notification to jump directly to the related booking. Notifications refresh automatically every 30 seconds.
                </p>
            </div>
        </div>
    );
};

export default NotificationsPage;
