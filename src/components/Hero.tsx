import React from 'react';

interface HeroProps {
    onReserveClick?: () => void;
    onCalendarClick?: () => void;
}

const Hero: React.FC<HeroProps> = ({ onReserveClick, onCalendarClick }) => {
    return (
        <section className="relative w-full overflow-hidden text-center text-white flex items-center justify-center py-20 sm:py-32">
            {/* Background Image with Overlay */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center"
                style={{
                    backgroundImage: "url('https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80')",
                }}
            >
                <div className="absolute inset-0 bg-slate-900/50"></div>
            </div>

            {/* Content */}
            <div className="relative z-10 w-full max-w-3xl px-6">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 sm:mb-6 leading-tight drop-shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]">
                    Book Conference Rooms with Confidence
                </h1>
                <p className="text-sm sm:text-lg md:text-xl mb-8 sm:mb-10 text-slate-100 max-w-2xl mx-auto drop-shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]">
                    Eliminate booking conflicts and manage meeting spaces across all your office locations with our intelligent reservation system
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
                    <button
                        onClick={onReserveClick}
                        className="bg-primary hover:bg-primary-dark text-white font-semibold py-3.5 px-6 rounded-xl transition-all shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] w-full sm:w-auto"
                    >
                        Reserve a Space Now
                    </button>
                    <button
                        onClick={onCalendarClick}
                        className="bg-theme-card hover:bg-theme-bg text-theme-primary font-semibold py-3.5 px-6 rounded-xl transition-all shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] border border-theme-border w-full sm:w-auto"
                    >
                        View Calendar
                    </button>
                </div>
            </div>
        </section>
    );
};

export default Hero;
