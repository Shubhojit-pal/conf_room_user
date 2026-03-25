import React, { useState, useEffect } from 'react';
import { Buildings, Door, CalendarCheck, CheckCircle } from '@phosphor-icons/react';
import { fetchRooms, fetchUserBookings, getCurrentUser } from '../lib/api';

interface StatsProps {
    onNavigate?: (view: string) => void;
}

const Stats: React.FC<StatsProps> = ({ onNavigate }) => {
    const [officeLocations, setOfficeLocations] = useState<number>(0);
    const [availableRooms, setAvailableRooms] = useState<number>(0);
    const [todaysBookings, setTodaysBookings] = useState<number>(0);
    const [availableToday, setAvailableToday] = useState<number>(0);

    useEffect(() => {
        // Fetch rooms for Locations and Availability
        fetchRooms()
            .then((rooms) => {
                const locations = new Set(rooms.map(r => r.location).filter(Boolean));
                setOfficeLocations(locations.size || 0);

                const available = rooms.filter(r => r.status === 'active' || r.status === 'available' || r.availability === 'available').length;
                setAvailableRooms(available);
                setAvailableToday(available); // Simplified approximation for "Available Today"
            })
            .catch(console.error);

        // Fetch bookings for Today's Bookings
        const user = getCurrentUser();
        if (user && user.uid) {
            fetchUserBookings(user.uid)
                .then((bookings) => {
                    // YYYY-MM-DD
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const todays = bookings.filter(b => 
                        (b.start_date && b.start_date.substring(0, 10) === todayStr) || 
                        (b.selected_dates && b.selected_dates.includes(todayStr))
                    );
                    setTodaysBookings(todays.length);
                })
                .catch(console.error);
        }
    }, []);

    const stats = [
        {
            icon: <Buildings size={32} />,
            value: officeLocations.toString(),
            label: "Office Locations",
            color: "text-primary",
            bg: "bg-primary/10",
            route: "search"
        },
        {
            icon: <Door size={32} />,
            value: availableRooms.toString(),
            label: "Available Rooms",
            color: "text-primary",
            bg: "bg-primary/10",
            route: "search"
        },
        {
            icon: <CalendarCheck size={32} />,
            value: todaysBookings.toString(),
            label: "Today's Bookings",
            color: "text-secondary",
            bg: "bg-secondary/10",
            route: "my-bookings"
        },
        {
            icon: <CheckCircle size={32} />,
            value: availableToday.toString(),
            label: "Available Today",
            color: "text-primary",
            bg: "bg-primary/10",
            route: "search"
        }
    ];

    return (
        <section className="relative z-20 -mt-12 px-6">
            <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {stats.map((stat, index) => (
                    <button 
                        key={index} 
                        onClick={() => stat.route && onNavigate && onNavigate(stat.route)}
                        className="bg-theme-card rounded-2xl p-4 sm:p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] border border-theme-border flex flex-col items-start gap-3 sm:gap-4 hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] hover:border-theme-border/70 transition-all text-left w-full group focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                        <div className={`p-2 sm:p-3 rounded-lg ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                            <div className="scale-75 sm:scale-100 origin-top-left flex items-center justify-center">
                                {stat.icon}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-2xl sm:text-3xl font-bold text-theme-primary">
                                {stat.value === '0' && stat.label !== "Today's Bookings" ? '-' : stat.value}
                            </h3>
                            <p className="text-xs sm:text-sm font-medium text-theme-secondary opacity-70 leading-tight">{stat.label}</p>
                        </div>
                    </button>
                ))}
            </div>
        </section>
    );
};

export default Stats;
