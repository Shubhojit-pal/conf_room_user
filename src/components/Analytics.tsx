import { useState, useEffect } from 'react';
import { ChartBar, Lightbulb, MapPin, Buildings, Monitor, Briefcase } from '@phosphor-icons/react';
import { fetchAllBookings, Booking } from '../lib/api';

interface AnalyticsProps {
    onNavigate?: (view: string) => void;
}

const Analytics: React.FC<AnalyticsProps> = ({ onNavigate }) => {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await fetchAllBookings();
                setBookings(data.filter(b => b.status === 'confirmed'));
            } catch (error) {
                console.error('Failed to fetch analytics data:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // ── Process Peak Hours ─────────────────────────────────────
    const getPeakHours = () => {
        const hourCounts: Record<number, number> = {};
        bookings.forEach(b => {
            if (!b.start_time) return;
            const hour = parseInt(b.start_time.split(':')[0]);
            if (!isNaN(hour)) {
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            }
        });

        const timeLabels: Record<number, string> = {
            9: '9:00 AM - 10:00 AM',
            10: '10:00 AM - 11:00 AM',
            11: '11:00 AM - 12:00 PM',
            12: '12:00 PM - 1:00 PM',
            13: '1:00 PM - 2:00 PM',
            14: '2:00 PM - 3:00 PM',
            15: '3:00 PM - 4:00 PM',
            16: '4:00 PM - 5:00 PM',
            17: '5:00 PM - 6:00 PM',
        };

        const sortedHours = Object.entries(hourCounts)
            .map(([h, count]) => ({
                time: timeLabels[parseInt(h)] || `${h}:00 - ${parseInt(h) + 1}:00`,
                count,
                rawHour: parseInt(h)
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);

        const maxCount = sortedHours.length > 0 ? sortedHours[0].count : 1;
        return sortedHours.map(h => ({
            ...h,
            width: `${(h.count / maxCount) * 95}%`
        }));
    };

    // ── Process Most Booked Locations ──────────────────────────
    const getTopLocations = () => {
        const locCounts: Record<string, number> = {};
        bookings.forEach(b => {
            const loc = b.location || 'Unknown Location';
            locCounts[loc] = (locCounts[loc] || 0) + 1;
        });

        const icons: Record<string, React.ReactNode> = {
            'Downtown': <Buildings size={20} />,
            'Tech Park': <Monitor size={20} />,
            'Business': <Briefcase size={20} />,
            'Innovation': <Lightbulb size={20} />,
        };

        const colors = [
            { main: 'bg-primary', light: 'bg-primary-light text-primary' },
            { main: 'bg-secondary', light: 'bg-secondary-light text-secondary' },
            { main: 'bg-accent-purple', light: 'bg-accent-purpleLight text-accent-purple' },
            { main: 'bg-accent-orange', light: 'bg-accent-orangeLight text-accent-orange' },
        ];

        const sortedLocs = Object.entries(locCounts)
            .map(([name, count], idx) => {
                const iconKey = Object.keys(icons).find(k => name.includes(k)) || 'Default';
                const style = colors[idx % colors.length];
                return {
                    name,
                    count,
                    trend: '+0%', // Dynamic trend would require historical data comparison
                    width: '0%', // Set after sorting
                    color: style.main,
                    icon: icons[iconKey] || <MapPin size={20} />,
                    iconBg: style.light
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 4);

        const maxCount = sortedLocs.length > 0 ? sortedLocs[0].count : 1;
        return sortedLocs.map(l => ({
            ...l,
            width: `${(l.count / maxCount) * 85}%`
        }));
    };

    const hours = getPeakHours();
    const locations = getTopLocations();

    if (loading) {
        return (
            <section className="py-16 px-6">
                <div className="max-w-7xl mx-auto flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            </section>
        );
    }

    return (
        <section className="py-16 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-theme-primary mb-2">Booking Analytics</h2>
                    <p className="text-theme-secondary opacity-60">Insights into booking patterns and popular locations</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Peak Booking Hours */}
                    <div className="bg-theme-card rounded-2xl p-6 shadow-sm border border-theme-border">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                                <ChartBar size={24} weight="fill" />
                            </div>
                            <h3 className="text-xl font-bold text-theme-primary">Peak Booking Hours</h3>
                        </div>

                        <div className="flex flex-col gap-5">
                            {hours.length > 0 ? (
                                hours.map((item, idx) => (
                                    <div key={idx}>
                                        <div className="flex justify-between text-sm font-medium mb-1.5">
                                            <span className="text-theme-secondary opacity-60">{item.time}</span>
                                            <span className="text-secondary font-semibold">{item.count} bookings</span>
                                        </div>
                                        <div className="h-2 w-full bg-theme-bg rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-secondary rounded-full"
                                                style={{ width: item.width }}
                                            ></div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center py-8 text-theme-secondary opacity-50">No booking data available yet.</p>
                            )}
                        </div>

                        <div className="mt-8 bg-secondary/5 border border-secondary/10 rounded-lg p-4 flex gap-4 items-start">
                            <Lightbulb size={24} className="text-secondary shrink-0 mt-0.5" />
                            <div>
                                <strong className="block text-sm font-bold text-theme-primary mb-1">Pro Tip</strong>
                                <p className="text-xs text-theme-secondary opacity-80">Book early morning or late afternoon slots for better availability</p>
                            </div>
                        </div>
                    </div>

                    {/* Most Booked Locations */}
                    <div className="bg-theme-card rounded-2xl p-6 shadow-sm border border-theme-border flex flex-col">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <MapPin size={24} weight="fill" />
                            </div>
                            <h3 className="text-xl font-bold text-theme-primary">Most Booked Locations</h3>
                        </div>

                        <div className="flex flex-col gap-6 flex-1">
                            {locations.length > 0 ? (
                                locations.map((loc, idx) => (
                                    <div key={idx} className="flex flex-col gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-1.5 rounded-md ${loc.iconBg.replace('-light', '/10')} text-lg`}>
                                                {loc.icon}
                                            </div>
                                            <span className="flex-1 font-medium text-theme-primary text-sm">{loc.name}</span>
                                            <div className="flex gap-2 text-sm">
                                                <strong className="text-theme-primary">{loc.count}</strong>
                                                <span className="text-primary text-xs font-bold pt-0.5">{loc.trend}</span>
                                            </div>
                                        </div>
                                        <div className="h-1.5 w-full bg-theme-bg rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${loc.color}`}
                                                style={{ width: loc.width }}
                                            ></div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center py-8 text-theme-secondary opacity-50">No locations data available.</p>
                            )}
                        </div>

                        <div className="mt-8">
                            <button 
                                onClick={() => onNavigate && onNavigate('search')}
                                className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-lg transition-colors"
                            >
                                Explore All Locations
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Analytics;
