import { 
    Buildings, Bell, User, CirclesFour, MagnifyingGlass, CalendarBlank, 
    Ticket, SignOut, List, X, Sun, Moon, SpeakerHigh, SpeakerNone 
} from '@phosphor-icons/react';
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { soundManager } from '../lib/sound-manager';

interface HeaderProps {
    currentView: string;
    onNavigate: (view: string) => void;
}

interface NotificationItem {
    _id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
}

const Header: React.FC<HeaderProps> = ({ currentView, onNavigate }) => {
    const [showNotifications, setShowNotifications] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const notifRef = useRef<HTMLDivElement>(null);
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [soundsEnabled, setSoundsEnabled] = useState(soundManager?.isEnabled() ?? true);

    const toggleSounds = () => {
        const newState = soundManager?.toggleEnabled();
        if (newState !== undefined) {
            setSoundsEnabled(newState);
        }
    };

    const navItems = [
        { id: 'home', label: 'Home', icon: <CirclesFour size={20} /> },
        { id: 'search', label: 'Reserve', icon: <MagnifyingGlass size={20} /> },
        { id: 'calendar', label: 'Calendar', icon: <CalendarBlank size={20} /> },
        { id: 'my-bookings', label: 'Bookings', icon: <Ticket size={20} /> },
        { id: 'notifications', label: 'Notification', icon: <Bell size={20} /> },
    ];

    const getNotifications = async () => {
        try {
            const data = await fetchNotifications();
            setNotifications(data);
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    };

    useEffect(() => {
        if (user) {
            getNotifications();
            const interval = setInterval(getNotifications, 30000);
            return () => clearInterval(interval);
        }
    }, [user]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => { document.removeEventListener("mousedown", handleClickOutside); };
    }, []);

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const handleMarkRead = async (id: string) => {
        try {
            await markNotificationAsRead(id);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
        } catch (error) {
            console.error('Failed to mark read:', error);
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
        if (diffInMins < 60) return `${diffInMins}m ago`;
        if (diffInHours < 24) return `${diffInHours}h ago`;
        return `${diffInDays}d ago`;
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const navigate = (view: string) => {
        onNavigate(view);
        setShowMobileMenu(false);
        setShowNotifications(false);
    };

    return (
        <>
            {/* ─── Top Header ─── */}
            <header className="sticky top-0 z-50 bg-theme-bg border-b border-theme-border py-4 transition-colors">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-between items-center">
                    {/* Logo */}
                    <div
                        className="flex items-center gap-3 font-bold text-xl text-theme-primary cursor-pointer"
                        onClick={() => navigate('home')}
                    >
                        <div className="bg-primary text-white p-1.5 rounded-md flex">
                            <Buildings size={24} weight="regular" />
                        </div>
                        <span>RoomBook</span>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex gap-1 bg-theme-bg p-1.5 rounded-xl border border-theme-border">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => navigate(item.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${currentView === item.id
                                    ? 'bg-theme-card text-primary shadow-sm'
                                    : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-card'
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                        <button
                            onClick={() => navigate('help')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${currentView === 'help'
                                ? 'bg-theme-card text-primary shadow-sm'
                                : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-card'
                                }`}
                        >
                            Help
                        </button>
                    </nav>

                    {/* Actions */}
                    <div className="flex items-center gap-2 sm:gap-4">
                        {!user ? (
                            <>
                                <button
                                    onClick={() => navigate('login')}
                                    className="bg-primary hover:bg-primary-dark text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm"
                                >
                                    Log In
                                </button>
                                {/* Mobile menu for unauthenticated users */}
                                <button
                                    className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                                    onClick={() => setShowMobileMenu(v => !v)}
                                >
                                    {showMobileMenu ? <X size={22} /> : <List size={22} />}
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Notification Bell */}
                                <div className="relative" ref={notifRef}>
                                    <button
                                        className="relative text-theme-secondary hover:text-theme-primary transition-colors p-2"
                                        onClick={() => setShowNotifications(v => !v)}
                                    >
                                        <Bell size={24} />
                                        {unreadCount > 0 && (
                                            <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-white">
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </span>
                                        )}
                                    </button>

                                    {/* Notification Dropdown — fixed for mobile, absolute for desktop */}
                                    {showNotifications && (
                                        <div
                                            className="fixed sm:absolute top-[70px] sm:top-full left-4 sm:left-auto right-4 sm:right-0 sm:w-80 max-w-sm bg-theme-card rounded-xl shadow-xl border border-theme-border overflow-hidden z-[100]"
                                            style={{ maxHeight: '70vh' }}
                                        >
                                            <div className="p-4 border-b border-theme-border flex justify-between items-center bg-theme-bg">
                                                <h3 className="font-bold text-theme-primary">Notifications</h3>
                                                <button
                                                    onClick={handleMarkAllRead}
                                                    className="text-xs text-primary font-medium hover:underline"
                                                >
                                                    Mark all read
                                                </button>
                                            </div>
                                            <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 110px)' }}>
                                                {notifications.length === 0 ? (
                                                    <div className="p-8 text-center text-slate-400 text-sm">
                                                        No notifications yet
                                                    </div>
                                                ) : (
                                                    notifications.map((notif) => (
                                                        <div
                                                            key={notif._id}
                                                            onClick={() => !notif.isRead && handleMarkRead(notif._id)}
                                                            className={`p-4 border-b border-theme-border hover:bg-theme-bg transition-colors cursor-pointer ${!notif.isRead ? 'bg-primary/5' : ''}`}
                                                        >
                                                            <div className="flex justify-between items-start mb-1 gap-2">
                                                                <h4 className={`text-sm flex-1 ${notif.title === 'Booking Approved' ? 'text-primary font-bold' : !notif.isRead ? 'font-bold text-theme-primary' : 'font-medium text-theme-secondary'}`}>
                                                                    {notif.title}
                                                                </h4>
                                                                <span className="text-[10px] text-theme-secondary opacity-70 whitespace-nowrap shrink-0">{formatTime(notif.createdAt)}</span>
                                                            </div>
                                                            <p className="text-xs text-theme-secondary leading-relaxed">{notif.message}</p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                            <div className="p-3 text-center border-t border-theme-border bg-theme-bg">
                                                <button
                                                    onClick={() => navigate('my-bookings')}
                                                    className="text-xs font-bold text-theme-secondary hover:text-primary transition-colors"
                                                >
                                                    View All Activity
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Theme & Sound Toggles (Desktop) */}
                                <div className="hidden sm:flex items-center gap-1 bg-theme-bg p-1 rounded-lg border border-theme-border">
                                    <button
                                        onClick={toggleTheme}
                                        title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                                        className="p-1.5 rounded-md text-theme-secondary hover:text-primary hover:bg-theme-card transition-all"
                                    >
                                        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                                    </button>
                                    <div className="w-px h-4 bg-theme-border mx-0.5" />
                                    <button
                                        onClick={toggleSounds}
                                        title={soundsEnabled ? 'Disable UI Sounds' : 'Enable UI Sounds'}
                                        className={`p-1.5 rounded-md transition-all ${soundsEnabled ? 'text-primary' : 'text-theme-secondary opacity-70 hover:opacity-100 hover:text-theme-primary'}`}
                                    >
                                        {soundsEnabled ? <SpeakerHigh size={20} /> : <SpeakerNone size={20} />}
                                    </button>
                                </div>

                                {/* Profile Button (desktop) */}
                                <button
                                    onClick={() => navigate('profile')}
                                    className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${currentView === 'profile' ? 'bg-primary-dark text-white ring-2 ring-primary ring-offset-2' : 'bg-primary hover:bg-primary-dark text-white'}`}
                                >
                                    <User size={20} />
                                    <span>{user.name.split(' ')[0]}</span>
                                </button>

                                {/* Sign Out (desktop) */}
                                <button
                                    onClick={logout}
                                    title="Sign Out"
                                    className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-theme-secondary hover:text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
                                >
                                    <SignOut size={18} />
                                </button>

                                {/* Hamburger (mobile only) */}
                                <button
                                    className="sm:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                                    onClick={() => setShowMobileMenu(v => !v)}
                                >
                                    {showMobileMenu ? <X size={22} /> : <List size={22} />}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Mobile Dropdown Menu */}
                {showMobileMenu && (
                    <div className="md:hidden border-t border-theme-border bg-theme-bg px-4 pb-4 pt-2 shadow-inner">
                        <div className="flex flex-col gap-1">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => navigate(item.id)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-left transition-colors ${currentView === item.id
                                        ? 'bg-theme-card text-primary shadow-sm border border-theme-border'
                                        : 'text-theme-secondary hover:bg-theme-card hover:text-theme-primary'
                                        }`}
                                >
                                    {item.icon}
                                    {item.label === 'Reserve' ? 'Reserve a Space' : item.label}
                                </button>
                            ))}
                            <button
                                onClick={() => navigate('help')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-left transition-colors ${currentView === 'help'
                                    ? 'bg-theme-card text-primary shadow-sm border border-theme-border'
                                    : 'text-theme-secondary hover:bg-theme-card hover:text-theme-primary'
                                    }`}
                            >
                                Help
                            </button>
                            {user && (
                                <>
                                    <hr className="my-1 border-theme-border" />
                                    <button
                                        onClick={() => navigate('profile')}
                                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-theme-secondary hover:bg-theme-card hover:text-theme-primary"
                                    >
                                        <User size={20} />
                                        Profile ({user.name.split(' ')[0]})
                                    </button>
                                    <button
                                        onClick={logout}
                                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50"
                                    >
                                        <SignOut size={20} />
                                        Sign Out
                                    </button>
                                    <hr className="my-1 border-theme-border" />
                                    <div className="flex items-center justify-between px-4 py-3">
                                        <span className="text-sm font-medium text-theme-secondary">Appearance</span>
                                        <button
                                            onClick={toggleTheme}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-theme-bg text-theme-primary border border-theme-border"
                                        >
                                            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                                            <span className="text-xs uppercase font-bold">{theme === 'light' ? 'Dark' : 'Light'}</span>
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between px-4 py-3">
                                        <span className="text-sm font-medium text-theme-secondary">Interface Sounds</span>
                                        <button
                                            onClick={toggleSounds}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${soundsEnabled ? 'bg-primary/10 text-primary border-primary/20' : 'bg-theme-bg text-theme-secondary opacity-70 border-theme-border'}`}
                                        >
                                            {soundsEnabled ? <SpeakerHigh size={18} /> : <SpeakerNone size={18} />}
                                            <span className="text-xs uppercase font-bold">{soundsEnabled ? 'On' : 'Off'}</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </header>

            {/* ─── Mobile Bottom Navigation Bar (authenticated only) ─── */}
            {user && (
                <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-theme-bg border-t border-theme-border shadow-lg">
                    <div className="flex justify-around items-center px-1 py-2">
                        {navItems.map((item) => {
                            const isActive = currentView === item.id;
                            const isNotif = item.id === 'notifications';
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => navigate(item.id)}
                                    className={`flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-xl flex-1 transition-all ${isActive
                                        ? 'text-primary'
                                        : 'text-theme-secondary opacity-70'
                                        }`}
                                >
                                    <div className={`relative p-1 rounded-lg transition-all ${isActive ? 'bg-primary/10' : ''}`}>
                                        {item.icon}
                                        {isNotif && unreadCount > 0 && (
                                            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full ring-1 ring-white">
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </span>
                                        )}
                                    </div>
                                    <span className={`text-[10px] font-semibold ${isActive ? 'text-primary' : 'text-theme-secondary opacity-70'}`}>
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </nav>
            )}

        </>
    );
};

export default Header;
