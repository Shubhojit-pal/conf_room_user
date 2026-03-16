import { ChartBar, Lightbulb, MapPin, Buildings, Monitor, Briefcase } from '@phosphor-icons/react';

interface AnalyticsProps {
    onNavigate?: (view: string) => void;
}

const Analytics: React.FC<AnalyticsProps> = ({ onNavigate }) => {
    const hours = [
        { time: '9:00 AM - 10:00 AM', count: 45, width: '90%' },
        { time: '10:00 AM - 11:00 AM', count: 42, width: '85%' },
        { time: '2:00 PM - 3:00 PM', count: 38, width: '75%' },
        { time: '11:00 AM - 12:00 PM', count: 35, width: '70%' },
        { time: '3:00 PM - 4:00 PM', count: 32, width: '65%' },
        { time: '1:00 PM - 2:00 PM', count: 28, width: '55%' },
    ];

    const locations = [
        {
            name: 'Downtown Office',
            count: 156,
            trend: '+12%',
            width: '80%',
            color: 'bg-primary',
            icon: <Buildings size={20} />,
            iconBg: 'bg-primary-light text-primary'
        },
        {
            name: 'Tech Park Campus',
            count: 142,
            trend: '+8%',
            width: '70%',
            color: 'bg-secondary',
            icon: <Monitor size={20} />,
            iconBg: 'bg-secondary-light text-secondary'
        },
        {
            name: 'Business District',
            count: 128,
            trend: '+15%',
            width: '60%',
            color: 'bg-accent-purple',
            icon: <Briefcase size={20} />,
            iconBg: 'bg-accent-purpleLight text-accent-purple'
        },
        {
            name: 'Innovation Hub',
            count: 98,
            trend: '+5%',
            width: '45%',
            color: 'bg-accent-orange',
            icon: <Lightbulb size={20} />,
            iconBg: 'bg-accent-orangeLight text-accent-orange'
        },
    ];

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
                            {hours.map((item, idx) => (
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
                            ))}
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
                            {locations.map((loc, idx) => (
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
                            ))}
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
