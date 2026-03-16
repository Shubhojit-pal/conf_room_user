import { Buildings, Door, CalendarCheck, CheckCircle } from '@phosphor-icons/react';

interface StatsProps {
    onNavigate?: (view: string) => void;
}

const Stats: React.FC<StatsProps> = ({ onNavigate }) => {
    const stats = [
        {
            icon: <Buildings size={32} />,
            value: "3",
            label: "Office Locations",
            color: "text-primary",
            bg: "bg-primary-light",
            route: "search"
        },
        {
            icon: <Door size={32} />,
            value: "6",
            label: "Available Rooms",
            color: "text-primary",
            bg: "bg-primary-light",
            route: "search"
        },
        {
            icon: <CalendarCheck size={32} />,
            value: "0",
            label: "Today's Bookings",
            color: "text-secondary",
            bg: "bg-secondary-light",
            route: "my-bookings"
        },
        {
            icon: <CheckCircle size={32} />,
            value: "6",
            label: "Available Today",
            color: "text-primary",
            bg: "bg-primary-light",
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
                        className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-start gap-3 sm:gap-4 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all text-left w-full group focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                        <div className={`p-2 sm:p-3 rounded-lg ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                            <div className="scale-75 sm:scale-100 origin-top-left flex items-center justify-center">
                                {stat.icon}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">{stat.value}</h3>
                            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 leading-tight">{stat.label}</p>
                        </div>
                    </button>
                ))}
            </div>
        </section>
    );
};

export default Stats;
