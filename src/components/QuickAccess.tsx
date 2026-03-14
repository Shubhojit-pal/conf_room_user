import {
    CalendarPlus,
    Star,
    ClockCounterClockwise,
    MapPin,
    Users,
    CheckCircle,
    Check,
    Clock,
    XCircle,
    Calendar,
    X
} from '@phosphor-icons/react';
import React, { useState } from 'react';
import { getDirectImageUrl } from '../lib/imageUtils';

interface QuickAccessProps {
    onViewAvailableToday?: () => void;
    onSearch?: (filters?: { location: string; capacity: string; date: string }) => void;
    onViewFavorites?: () => void;
    onViewActivity?: () => void;
}

const QuickAccess: React.FC<QuickAccessProps> = ({ onViewAvailableToday, onSearch, onViewFavorites, onViewActivity }) => {
    // State to toggle stars
    const [favorites, setFavorites] = useState<{ [key: number]: boolean }>({ 0: true, 1: true, 2: true });
    const [location, setLocation] = useState('All Locations');
    const [capacity, setCapacity] = useState('Any Capacity');
    const [date, setDate] = useState('');

    // State for mobile Quick Booking modal
    const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

    const toggleFavorite = (index: number) => {
        setFavorites(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const handleFindRooms = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch?.({ location, capacity, date });
    };

    const handleAdvancedSearch = (e: React.MouseEvent) => {
        e.preventDefault();
        onSearch?.();
    };

    const rooms = [
        { name: 'Executive Boardroom', location: 'Downtown Office', capacity: 12, type: 'Conference Room', image: 'https://images.unsplash.com/photo-1577412647305-991150c7d163?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80' },
        { name: 'Innovation Lab', location: 'Tech Park Campus', capacity: 20, type: 'Meeting Room', image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80' },
        { name: 'Grand Auditorium', location: 'Business District', capacity: 200, type: 'Auditorium', image: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80' },
    ];

    const todayAvailableRooms = [
        { name: 'Executive Boardroom', location: 'Downtown Office', capacity: 12, image: 'https://images.unsplash.com/photo-1577412647305-991150c7d163?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80' },
        { name: 'Team Collaboration Space', location: 'Tech Park Campus', capacity: 8, image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80' },
        { name: 'Meeting Room B', location: 'Downtown Office', capacity: 6, image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80' },
    ];

    const activities = [
        { title: 'Booking Confirmed', desc: 'Executive Boardroom for tomorrow at 10:00 AM', time: '2 hours ago', icon: <CheckCircle size={20} />, bg: 'bg-primary-light', color: 'text-primary' },
        { title: 'Booking Approved', desc: 'Your request for Grand Auditorium has been approved', time: '5 hours ago', icon: <Check size={20} />, bg: 'bg-secondary-light', color: 'text-secondary' },
        { title: 'Extension Requested', desc: 'Requested 1 hour extension for Innovation Lab', time: '1 day ago', icon: <Clock size={20} />, bg: 'bg-accent-orangeLight', color: 'text-accent-orange' },
        { title: 'Booking Cancelled', desc: 'Training Hall B booking cancelled successfully', time: '2 days ago', icon: <XCircle size={20} />, bg: 'bg-accent-redLight', color: 'text-accent-red' },
    ];

    return (
        <section className="pb-20 px-6">
            <div className="max-w-7xl mx-auto relative">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Quick Access</h2>
                    <p className="text-slate-500">Manage your bookings and discover your favorite spaces</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* Available Today */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 border-t-4 border-t-secondary hover:shadow-md transition-shadow cursor-pointer" onClick={onViewAvailableToday}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-2 rounded-lg bg-secondary-light text-secondary">
                                <Calendar size={24} weight="fill" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Available Today</h3>
                        </div>

                        <div className="flex flex-col gap-3">
                            {todayAvailableRooms.map((room, idx) => (
                                <div key={idx} className="flex gap-3 p-3 rounded-lg border border-slate-100 hover:border-secondary/30 transition-colors">
                                    <div
                                        className="w-14 h-14 rounded-lg bg-slate-200 shrink-0 bg-cover bg-center"
                                        style={{ backgroundImage: `url(${getDirectImageUrl(room.image)})` }}
                                    ></div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-slate-800 text-sm truncate">{room.name}</h4>
                                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                            <MapPin size={12} /> {room.location}
                                        </p>
                                        <span className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                                            <Users size={12} /> {room.capacity} people
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-center text-primary text-sm font-medium hover:underline mt-4">View all available rooms →</p>
                    </div>

                    {/* Quick Booking - Desktop Only */}
                    <div className="hidden lg:block bg-white rounded-2xl p-6 shadow-sm border border-slate-200 border-t-4 border-t-primary">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-2 rounded-lg bg-primary-light text-primary">
                                <CalendarPlus size={24} weight="fill" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Quick Booking</h3>
                        </div>

                        <form className="flex flex-col gap-4" onSubmit={handleFindRooms}>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1.5">Location</label>
                                <select
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                                >
                                    <option>All Locations</option>
                                    <option>Downtown Office</option>
                                    <option>Tech Park Campus</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1.5">Capacity</label>
                                <select
                                    value={capacity}
                                    onChange={(e) => setCapacity(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                                >
                                    <option>Any Capacity</option>
                                    <option>2-6 People</option>
                                    <option>10+ People</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1.5">Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                            <button type="submit" className="mt-2 w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-lg transition-colors">
                                Find Available Rooms
                            </button>
                            <a href="#" onClick={handleAdvancedSearch} className="text-center text-primary text-sm font-medium hover:underline">
                                Advanced Search →
                            </a>
                        </form>
                    </div>

                    {/* Favorite Rooms */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-accent-orangeLight text-accent-orange">
                                    <Star size={24} weight="fill" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">Favorite Rooms</h3>
                            </div>
                            <button onClick={onViewFavorites} className="text-primary text-sm font-medium hover:underline">View All</button>
                        </div>

                        <div className="flex flex-col gap-4">
                            {rooms.map((room, idx) => (
                                <div key={idx} className="flex gap-4 p-3 rounded-xl border border-slate-100 hover:border-primary/30 transition-colors group">
                                    <div
                                        className="w-16 h-16 rounded-lg bg-slate-200 shrink-0 bg-cover bg-center"
                                        style={{ backgroundImage: `url(${getDirectImageUrl(room.image)})` }}
                                    ></div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-slate-800 text-sm truncate">{room.name}</h4>
                                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                            <MapPin size={12} /> {room.location}
                                        </p>
                                        <div className="flex gap-2 mt-1.5">
                                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                                <Users size={12} /> {room.capacity}
                                            </span>
                                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-medium">
                                                {room.type}
                                            </span>
                                        </div>
                                    </div>
                                    <button onClick={() => toggleFavorite(idx)} className="self-start">
                                        {favorites[idx] ? (
                                            <Star size={20} weight="fill" className="text-accent-orange" />
                                        ) : (
                                            <Star size={20} className="text-slate-300 hover:text-accent-orange" />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-accent-purpleLight text-accent-purple">
                                    <ClockCounterClockwise size={24} weight="fill" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">Recent Activity</h3>
                            </div>
                            <button onClick={onViewActivity} className="text-primary text-sm font-medium hover:underline">View All</button>
                        </div>

                        <div className="relative pl-2">
                            {/* Vertical Line */}
                            <div className="absolute left-[19px] top-3 bottom-4 w-0.5 bg-slate-100 -z-0"></div>

                            <div className="flex flex-col gap-6">
                                {activities.map((item, idx) => (
                                    <div key={idx} className="flex gap-4 relative z-10">
                                        <div className={`w-10 h-10 rounded-full ${item.bg} ${item.color} flex items-center justify-center shrink-0 border-4 border-white shadow-sm`}>
                                            {item.icon}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-800">{item.title}</h4>
                                            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
                                            <span className="text-[10px] text-slate-400 font-medium mt-1 block">{item.time}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── MOBILE: Floating Action Button (FAB) ── */}
            <button
                className="lg:hidden fixed bottom-[90px] right-6 z-[60] bg-primary text-white p-4 rounded-full shadow-lg shadow-primary/30 active:scale-95 transition-transform"
                onClick={() => setIsMobileModalOpen(true)}
            >
                <CalendarPlus size={26} weight="fill" />
            </button>

            {/* ── MOBILE: Quick Booking Modal ── */}
            {isMobileModalOpen && (
                <div className="lg:hidden fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-end justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-8 duration-300">
                        <button
                            onClick={() => setIsMobileModalOpen(false)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full"
                        >
                            <X size={20} weight="bold" />
                        </button>
                        
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-primary-light text-primary">
                                <CalendarPlus size={24} weight="fill" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Quick Booking</h3>
                        </div>

                        <form className="flex flex-col gap-5" onSubmit={handleFindRooms}>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Location</label>
                                <select
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full p-3.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-slate-50 font-medium"
                                >
                                    <option>All Locations</option>
                                    <option>Downtown Office</option>
                                    <option>Tech Park Campus</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Capacity</label>
                                <select
                                    value={capacity}
                                    onChange={(e) => setCapacity(e.target.value)}
                                    className="w-full p-3.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-slate-50 font-medium"
                                >
                                    <option>Any Capacity</option>
                                    <option>2-6 People</option>
                                    <option>10+ People</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full p-3.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-slate-50 font-medium"
                                />
                            </div>
                            <button type="submit" className="mt-4 w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-transform active:scale-[0.98]">
                                Find Available Rooms
                            </button>
                            <a href="#" onClick={(e) => { setIsMobileModalOpen(false); handleAdvancedSearch(e); }} className="text-center text-primary text-sm font-semibold hover:underline bg-primary/5 py-3 rounded-xl">
                                Advanced Search →
                            </a>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
};

export default QuickAccess;
