import {
    CheckCircle,
    DownloadSimple,
    CalendarBlank,
    Clock,
    MapPin,
    ArrowRight,
    House,
    UsersThree,
    Ticket
} from '@phosphor-icons/react';
import React, { useRef, useCallback } from 'react';
import { Booking, parseLocalDate } from '../lib/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface TicketPageProps {
    booking: Booking | any | null;
    onHome: () => void;
    onViewBookings: () => void;
}

const TicketPage: React.FC<TicketPageProps> = ({ booking, onHome, onViewBookings }) => {
    const ticketRef = useRef<HTMLDivElement>(null);

    const handleDownloadPDF = useCallback(async () => {
        if (!ticketRef.current || !booking) return;

        try {
            const ticketId = booking.ticket_id || booking.booking_id;
            
            // Create a canvas from the ticket element
            const canvas = await html2canvas(ticketRef.current, {
                scale: 3, // High quality
                useCORS: true,
                logging: false,
                backgroundColor: null, // Maintain transparency/background
            });

            const imgData = canvas.toDataURL('image/png');
            
            // A4 dimensions in mm
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            // Calculate dimensions to maintain aspect ratio
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min((pdfWidth - 20) / imgWidth, (pdfHeight - 20) / imgHeight);
            
            const finalWidth = imgWidth * ratio;
            const finalHeight = imgHeight * ratio;
            
            // Center the image
            const x = (pdfWidth - finalWidth) / 2;
            const y = 20; // Margin from top

            pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
            pdf.save(`ticket-${ticketId}.pdf`);
        } catch (error) {
            console.error('Failed to generate PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        }
    }, [booking]);

    if (!booking) {
        return (
            <div className="max-w-md mx-auto text-center py-20 px-4">
                <p className="text-slate-500 dark:text-slate-400">No booking information available.</p>
                <button onClick={onHome} className="mt-4 text-primary font-semibold hover:underline">Go Home</button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto py-12 px-6">
            {/* Success Header */}
            <div className="text-center mb-10">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 bg-green-100 dark:bg-green-900/30 text-green-500 dark:text-green-400 animate-bounce shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-green-500/20`}>
                    <CheckCircle size={48} weight="fill" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    Booking Confirmed!
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                    Your conference room has been reserved successfully
                </p>
            </div>

            {/* Ticket Card */}
            <div ref={ticketRef} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] overflow-hidden relative">
                {/* Decorative Header */}
                <div className="bg-gradient-to-r from-primary to-secondary py-6 px-8 text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold">{booking.room_name}</h2>
                            <p className="text-white/80 text-sm mt-1">{booking.location}</p>
                        </div>
                        <span className={`px-3 py-1 text-xs rounded-full font-semibold backdrop-blur-sm bg-green-500/20 text-white border border-green-400/30`}>
                            Confirmed
                        </span>
                    </div>
                </div>

                {/* Dot border separator */}
                <div className="w-full flex items-center relative -mt-px">
                    <div className="w-6 h-6 bg-transparent dark:bg-slate-950 rounded-full -ml-3 z-10" />
                    <div className="flex-1 border-t-2 border-dashed border-slate-200 dark:border-slate-800" />
                    <div className="w-6 h-6 bg-transparent dark:bg-slate-950 rounded-full -mr-3 z-10" />
                </div>

                <div className="p-8">
                    <div className="grid grid-cols-2 gap-y-6 gap-x-8 mb-6">
                        <div className="flex items-start gap-3">
                            <CalendarBlank size={20} className="text-primary mt-0.5" />
                            <div className="flex-1">
                                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-1">Date(s)</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(booking.selected_dates ? booking.selected_dates.split(',').sort() : [(booking.date || booking.start_date || '').slice(0, 10)]).map((d: string) => (
                                        <span key={d} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-md text-[11px] font-bold border border-slate-200 dark:border-slate-700">
                                            {parseLocalDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Clock size={20} className="text-primary mt-0.5" />
                            <div className="flex-1">
                                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-1">Time Slots</p>
                                {booking.selected_slots ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {booking.selected_slots.split(',').sort().map((s: string) => {
                                            const [from, to] = s.split('-');
                                            return (
                                                <span key={s} className="px-2 py-0.5 bg-primary/10 dark:bg-primary/20 text-primary rounded-md text-[11px] font-bold border border-primary/20 dark:border-primary/30">
                                                    {from.slice(0, 5)} - {to.slice(0, 5)}
                                                </span>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-slate-900 dark:text-slate-100 font-semibold">{booking.start_time?.slice(0, 5)} - {booking.end_time?.slice(0, 5)}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <MapPin size={20} className="text-primary mt-0.5" />
                            <div>
                                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider underline decoration-primary/30 underline-offset-2">Location</p>
                                <p className="text-slate-900 dark:text-slate-100 font-semibold">{booking.location}</p>
                                {booking.mapLink && (
                                    <a 
                                        href={booking.mapLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1 mt-0.5"
                                    >
                                        <span>VIEW LOCATION</span>
                                        <ArrowRight size={10} />
                                    </a>
                                )}
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Ticket size={20} className="text-primary mt-0.5" />
                            <div>
                                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider decoration-primary/30 underline-offset-2">Ticket ID</p>
                                <p className="text-slate-900 dark:text-slate-100 font-semibold font-mono text-sm">{booking.ticket_id || booking.booking_id}</p>
                            </div>
                        </div>
                    </div>

                    {/* Attendees Section */}
                    <div className="flex items-center gap-4 bg-indigo-50/70 dark:bg-indigo-900/20 rounded-xl p-5 mb-6 border border-indigo-100 dark:border-indigo-900/30">
                        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-800/40 rounded-xl flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                            <UsersThree size={28} weight="duotone" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] text-indigo-400 dark:text-indigo-500 uppercase font-bold tracking-widest mb-0.5">Number of Attendees</p>
                            <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{booking.attendees || 1} <span className="text-sm font-semibold text-indigo-400 dark:text-indigo-600">person{(booking.attendees || 1) > 1 ? 's' : ''}</span></p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest mb-0.5">Booking Ref</p>
                            <p className="text-slate-700 dark:text-slate-300 font-bold font-mono text-sm">{booking.booking_id}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-transparent/50 dark:bg-slate-800/40 rounded-xl p-6 border border-slate-100 dark:border-slate-800 mb-6">
                        <div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest mb-1">Booked By</p>
                            <p className="text-slate-900 dark:text-slate-100 font-bold">{booking.user_name || 'Regular User'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest mb-1">Email Address</p>
                            <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">{booking.email || 'user@iem.edu.in'}</p>
                        </div>
                    </div>

                    {booking.purpose && (
                        <div className="bg-primary/5 dark:bg-primary/10 rounded-xl p-5 mb-6 border-l-4 border-primary">
                            <p className="text-[10px] text-primary uppercase font-bold tracking-widest mb-2">Meeting Purpose</p>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm italic">"{booking.purpose}"</p>
                        </div>
                    )}

                    <p className="text-xs text-center text-slate-400 dark:text-slate-500 mt-4">
                        Your booking has been approved. Download your ticket for reference.
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <button onClick={onHome} className="flex-1 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-transparent dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                    <House size={20} /> Back to Home
                </button>
                <button
                    onClick={handleDownloadPDF}
                    className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-emerald-500/25"
                >
                    <DownloadSimple size={20} weight="bold" /> Download PDF
                </button>
                <button onClick={onViewBookings} className="flex-1 py-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                    View My Bookings <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );
};

export default TicketPage;
