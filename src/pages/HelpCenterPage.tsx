import {
    MagnifyingGlass,
    BookOpen,
    PlayCircle,
    Headset,
    CaretDown,
    CaretRight
} from '@phosphor-icons/react';
import { useState } from 'react';

interface HelpCenterPageProps {
    onNavigate?: (page: string) => void;
    onAlert?: (msg: string, type: 'info' | 'success' | 'error') => void;
}

const HelpCenterPage: React.FC<HelpCenterPageProps> = ({ onNavigate, onAlert }) => {
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const [searchQuery, setSearchQuery] = useState('');

    const faqs = [
        {
            question: "How do I book a conference room?",
            answer: "Navigate to the 'Instant Booking' section on your dashboard, browse available rooms for your required time, and click on any available slot to open the booking form."
        },
        {
            question: "Can I cancel a booking after it's confirmed?",
            answer: "Yes, you can cancel your booking from the 'My Schedule' section. Click on the reserved date in the calendar and select 'Cancel Reservation' in the details popup. If an Admin cancels your booking, it will appear as 'Cancelled' in your history."
        },
        {
            question: "What does a 'Pending' status mean?",
            answer: "Certain high-capacity rooms or special equipment requests require Admin approval. Your booking will remain marked 'Pending' until an administrator reviews and approves it from their dashboard."
        },
        {
            question: "Can I edit an existing booking?",
            answer: "Currently, bookings cannot be edited once submitted. You must cancel the existing booking and create a new one with the correct details."
        },
        {
            question: "Why are some dates grayed out on the calendar?",
            answer: "Dates and times that have already passed are grayed out (ashed) and cannot be booked. You can only request reservations for future time slots."
        }
    ];

    const filteredFaqs = faqs.filter(faq =>
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="text-center mb-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-4">Help Center</h1>
                <p className="text-slate-500">Find answers to common questions about our booking system</p>

                <div className="mt-8 relative max-w-xl mx-auto">
                    <MagnifyingGlass size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search for help... (e.g. 'cancel', 'pending')"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-sm transition-all"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                {[
                    { icon: <BookOpen weight="duotone" />, title: "Getting Started", desc: "Learn the basics of using our booking system", action: () => onNavigate?.('my-bookings') },
                    { icon: <PlayCircle weight="duotone" />, title: "Video Tutorials", desc: "Watch step-by-step guides and tutorials", action: () => onAlert?.('Tutorials are currently being produced. Check back later!', 'info') },
                    { icon: <Headset weight="duotone" />, title: "Contact Support", desc: "Get help from our support team", action: () => onAlert?.('Connecting you to an agent...', 'info') }
                ].map((card, idx) => (
                    <div
                        key={idx}
                        onClick={card.action}
                        className="bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-lg transition-all cursor-pointer group hover:-translate-y-1"
                    >
                        <div className="w-12 h-12 bg-primary-light/30 text-primary rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                            {card.icon}
                        </div>
                        <h3 className="font-bold text-slate-900 mb-2">{card.title}</h3>
                        <p className="text-sm text-slate-500">{card.desc}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-8">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Frequently Asked Questions</h2>
                {filteredFaqs.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 italic">No articles found matching "{searchQuery}"</div>
                ) : (
                    <div className="space-y-4">
                        {filteredFaqs.map((faq, idx) => (
                            <div key={idx} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                                <button
                                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                    className="w-full flex justify-between items-center text-left py-2 hover:text-primary transition-colors focus:outline-none"
                                >
                                    <span className="font-semibold text-slate-800">{faq.question}</span>
                                    {openFaq === idx ? <CaretDown size={16} /> : <CaretRight size={16} className="text-slate-400" />}
                                </button>
                                <div className={`mt-2 text-slate-500 text-sm leading-relaxed overflow-hidden transition-all duration-300 ${openFaq === idx ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                                    {faq.answer}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-12 text-center text-sm text-slate-400">
                <p>Can't find what you're looking for?</p>
                <button
                    onClick={() => onAlert?.('Opening live chat modal...', 'info')}
                    className="text-primary font-bold mt-2 hover:underline focus:outline-none"
                >
                    Chat with us
                </button>
            </div>
        </div>
    );
};

export default HelpCenterPage;
