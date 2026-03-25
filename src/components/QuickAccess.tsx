import {
    CalendarPlus,
    Star,
    MapPin,
    Users,
    Calendar,
    X
} from '@phosphor-icons/react';

import React, { useState, useEffect } from 'react';
import { getDirectImageUrl } from '../lib/imageUtils';
import { fetchRooms, Room } from '../lib/api';

interface QuickAccessProps {
    onViewAvailableToday?: () => void;
    onSearch?: (filters?: { location: string; capacity: string; date: string; quickBookingMode?: boolean }) => void;
    onViewFavorites?: () => void;
}

const QuickAccess: React.FC<QuickAccessProps> = ({ onViewAvailableToday, onSearch, onViewFavorites }) => {
    // State to toggle stars
    const [favorites, setFavorites] = useState<{ [key: string]: boolean }>({});
    const [location, setLocation] = useState('All Locations');
    const [capacity, setCapacity] = useState('Any Capacity');
    const [date, setDate] = useState('');

    const [apiRooms, setApiRooms] = useState<Room[]>([]);
    const [locations, setLocations] = useState<string[]>([]);
    
    useEffect(() => {
        fetchRooms()
            .then(rooms => {
                setApiRooms(rooms);
                const uniqueLocs = Array.from(new Set(rooms.map(r => r.location).filter(Boolean)));
                setLocations(uniqueLocs);
            })
            .catch(console.error);
    }, []);

    // State for mobile Quick Booking modal
    const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

    const toggleFavorite = (id: string) => {
        setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleFindRooms = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch?.({ location, capacity, date, quickBookingMode: true } as any);
    };

    const handleAdvancedSearch = (e: React.MouseEvent) => {
        e.preventDefault();
        onSearch?.({ location, capacity, date, quickBookingMode: true } as any);
    };


    // Use fetched rooms or fallback empty state
    const displayRooms = apiRooms.slice(0, 3);
    const todayAvailableRooms = apiRooms.filter(r => r.status === 'active' || r.status === 'available' || r.availability === 'available').slice(0, 3);



    return (
        <section className="pb-20 px-6">
            <div className="max-w-7xl mx-auto relative">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-theme-primary mb-2">Quick Access</h2>
                    <p className="text-theme-secondary">Manage your bookings and discover your favorite spaces</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* Available Today */}
                    <div className="bg-theme-card rounded-2xl p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] border border-theme-border border-t-4 border-t-secondary hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] transition-shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] cursor-pointer" onClick={onViewAvailableToday}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                                <Calendar size={24} weight="fill" />
                            </div>
                            <h3 className="text-lg font-bold text-theme-primary">Available Today</h3>
                        </div>

                        <div className="flex flex-col gap-3">
                            {todayAvailableRooms.length > 0 ? todayAvailableRooms.map((room) => (
                                <div key={room.room_id} className="flex gap-3 p-3 rounded-lg border border-theme-border hover:border-secondary/30 transition-colors bg-theme-bg/50">
                                    <div
                                        className="w-14 h-14 rounded-lg bg-slate-200 shrink-0 bg-cover bg-center"
                                        style={{ backgroundImage: `url(${getDirectImageUrl(room.image_url)})` }}
                                    ></div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-theme-primary text-sm truncate">{room.room_name}</h4>
                                        <p className="text-xs text-theme-secondary flex items-center gap-1 mt-0.5">
                                            <MapPin size={12} /> {room.location}
                                        </p>
                                        <span className="text-xs text-theme-secondary opacity-70 flex items-center gap-1 mt-1">
                                            <Users size={12} /> {room.capacity} people
                                        </span>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-sm text-theme-secondary p-4 text-center">No rooms available right now.</p>
                            )}
                        </div>
                        <p className="text-center text-primary text-sm font-medium hover:underline mt-4">View all available rooms →</p>
                    </div>

                    {/* Quick Booking - Desktop Only */}
                    <div className="hidden lg:block bg-theme-card rounded-2xl p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] border border-theme-border border-t-4 border-t-primary">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <CalendarPlus size={24} weight="fill" />
                            </div>
                            <h3 className="text-lg font-bold text-theme-primary">Quick Booking</h3>
                        </div>

                        <form className="flex flex-col gap-4" onSubmit={handleFindRooms}>
                            <div>
                                <label className="block text-sm font-medium text-theme-secondary mb-1.5">Location</label>
                                <select
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-theme-bg"
                                >
                                    <option>All Locations</option>
                                    {locations.map(loc => <option key={loc}>{loc}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-theme-secondary mb-1.5">Capacity</label>
                                <select
                                    value={capacity}
                                    onChange={(e) => setCapacity(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-theme-bg"
                                >
                                    <option>Any Capacity</option>
                                    <option>2-6 People</option>
                                    <option>10+ People</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-theme-secondary mb-1.5">Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-theme-bg"
                                />
                            </div>
                            <button type="submit" className="mt-2 w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-lg transition-colors">
                                Find Available Rooms
                            </button>
                            <a href="#" onClick={handleAdvancedSearch} className="text-center text-primary text-sm font-medium hover:underline">
                                Quick Booking →
                            </a>
                        </form>
                    </div>

                    {/* Favorite Rooms */}
                    <div className="bg-theme-card rounded-2xl p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] border border-theme-border">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-accent-orange/10 text-accent-orange">
                                    <Star size={24} weight="fill" />
                                </div>
                                <h3 className="text-lg font-bold text-theme-primary">Favorite Rooms</h3>
                            </div>
                            <button onClick={onViewFavorites} className="text-primary text-sm font-medium hover:underline">View All</button>
                        </div>

                        <div className="flex flex-col gap-4">
                            {displayRooms.map((room) => (
                                <div key={room.room_id} className="flex gap-4 p-3 rounded-xl border border-theme-border hover:border-primary/30 transition-colors bg-theme-bg/30 group">
                                    <div
                                        className="w-16 h-16 rounded-lg bg-theme-bg shrink-0 bg-cover bg-center border border-theme-border/50"
                                        style={{ backgroundImage: `url(${getDirectImageUrl(room.image_url)})` }}
                                    ></div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-slate-800 text-sm truncate">{room.room_name}</h4>
                                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                            <MapPin size={12} /> {room.location}
                                        </p>
                                        <div className="flex gap-2 mt-1.5">
                                            <span className="text-xs text-theme-secondary opacity-70 flex items-center gap-1">
                                                <Users size={12} /> {room.capacity}
                                            </span>
                                            <span className="text-[10px] bg-theme-bg px-1.5 py-0.5 rounded text-theme-secondary font-medium border border-theme-border">
                                                {room.room_type}
                                            </span>
                                        </div>
                                    </div>
                                    <button onClick={() => toggleFavorite(room.room_id)} className="self-start">
                                        {favorites[room.room_id] ? (
                                            <Star size={20} weight="fill" className="text-accent-orange" />
                                        ) : (
                                            <Star size={20} className="text-theme-secondary opacity-40 hover:text-accent-orange" />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            {/* ── MOBILE: Floating Action Button (FAB) ── */}
            <button
                className="lg:hidden fixed bottom-[90px] right-6 z-[60] bg-primary text-white p-4 rounded-full shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/30 active:scale-95 transition-transform"
                onClick={() => setIsMobileModalOpen(true)}
            >
                <CalendarPlus size={26} weight="fill" />
            </button>

            {/* ── MOBILE: Quick Booking Modal ── */}
            {isMobileModalOpen && (
                <div className="lg:hidden fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center p-4">
                    <div className="bg-theme-card w-full max-w-md rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] relative animate-in slide-in-from-bottom-8 duration-300 border border-theme-border">
                        <button
                            onClick={() => setIsMobileModalOpen(false)}
                            className="absolute top-4 right-4 p-2 text-theme-secondary hover:text-theme-primary bg-theme-bg rounded-full border border-theme-border"
                        >
                            <X size={20} weight="bold" />
                        </button>
                        
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                <CalendarPlus size={24} weight="fill" />
                            </div>
                            <h3 className="text-xl font-bold text-theme-primary">Quick Booking</h3>
                        </div>

                        <form className="flex flex-col gap-5" onSubmit={handleFindRooms}>
                            <div>
                                <label className="block text-sm font-semibold text-theme-primary mb-2">Location</label>
                                <select
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full p-3.5 rounded-xl border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-theme-bg font-medium"
                                >
                                    <option>All Locations</option>
                                    {locations.map(loc => <option key={loc}>{loc}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-theme-primary mb-2">Capacity</label>
                                <select
                                    value={capacity}
                                    onChange={(e) => setCapacity(e.target.value)}
                                    className="w-full p-3.5 rounded-xl border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-theme-bg font-medium"
                                >
                                    <option>Any Capacity</option>
                                    <option>2-6 People</option>
                                    <option>10+ People</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-theme-primary mb-2">Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full p-3.5 rounded-xl border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-theme-bg font-medium"
                                />
                            </div>
                            <button type="submit" className="mt-4 w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/20 transition-transform active:scale-[0.98]">
                                Find Available Rooms
                            </button>
                            <a href="#" onClick={(e) => { setIsMobileModalOpen(false); handleAdvancedSearch(e); }} className="text-center text-primary text-sm font-semibold hover:underline bg-primary/5 py-3 rounded-xl">
                                Quick Booking →
                            </a>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
};

export default QuickAccess;
