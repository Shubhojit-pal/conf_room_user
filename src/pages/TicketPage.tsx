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

interface TicketPageProps {
    booking: Booking | any | null;
    onHome: () => void;
    onViewBookings: () => void;
}

const TicketPage: React.FC<TicketPageProps> = ({ booking, onHome, onViewBookings }) => {
    const ticketRef = useRef<HTMLDivElement>(null);

    const handleDownloadPDF = useCallback(() => {
        if (!booking) return;

        const activeDates = booking.selected_dates ? booking.selected_dates.split(',').sort() : [(booking.date || booking.start_date || '').slice(0, 10)];
        const dateStr = activeDates.map((d: string) => parseLocalDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric'})).join('  |  ');
        const timeStr = `${booking.start_time?.slice(0, 5)} - ${booking.end_time?.slice(0, 5)}`;
        const ticketId = booking.ticket_id || booking.booking_id;
        const attendees = booking.attendees || 1;

        // --- Build a raw PDF entirely in JS (no library needed) ---
        // PDF coordinate system: origin is bottom-left, units are points (1/72 inch)
        const W = 595.28; // A4 width in points
        const H = 841.89; // A4 height in points

        // Helper: escape special PDF chars in text
        const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

        // We'll collect PDF objects
        let objId = 0;
        const objects: string[] = [];
        const offsets: number[] = [];

        const addObj = (content: string) => {
            objId++;
            objects.push(content);
            return objId;
        };

        // Object 1: Catalog
        addObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
        // Object 2: Pages
        addObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
        // Object 3: Page
        addObj(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents 5 0 R /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> >>\nendobj`);
        // Object 4: Font (Helvetica)
        addObj('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj');

        // Build the content stream
        let y = H - 60; // Start from top
        const mx = 50; // Left margin
        const cw = W - 100; // Content width

        let stream = '';

        // --- Header background (purple rectangle) ---
        stream += `0.388 0.400 0.945 rg\n`; // #6366f1
        stream += `${mx} ${y - 80} ${cw} 90 re f\n`;

        // Header text
        stream += `BT\n1 1 1 rg\n/F1 20 Tf\n${mx + 20} ${y - 30} Td\n(${esc(booking.room_name || 'Conference Room')}) Tj\nET\n`;
        stream += `BT\n1 1 1 rg\n/F1 11 Tf\n${mx + 20} ${y - 52} Td\n(${esc(booking.location || '')}) Tj\nET\n`;

        // Status badge text
        const statusText = 'CONFIRMED';
        stream += `BT\n1 1 1 rg\n/F1 9 Tf\n${mx + cw - 100} ${y - 30} Td\n(${statusText}) Tj\nET\n`;

        y -= 110;

        // --- Dashed separator line ---
        stream += `0.886 0.910 0.941 RG\n[4 3] 0 d\n0.5 w\n${mx + 10} ${y} m ${mx + cw - 10} ${y} l S\n[] 0 d\n`;

        y -= 35;

        // --- Field rendering helper ---
        const drawField = (label: string, value: string, x: number, yPos: number) => {
            // Label (gray, small, uppercase)
            stream += `BT\n0.580 0.639 0.722 rg\n/F1 8 Tf\n${x} ${yPos} Td\n(${esc(label.toUpperCase())}) Tj\nET\n`;
            // Value (dark, bold-ish)
            stream += `BT\n0.118 0.161 0.231 rg\n/F1 12 Tf\n${x} ${yPos - 16} Td\n(${esc(value)}) Tj\nET\n`;
        };

        // Row 1: Date & Time
        drawField('Date', dateStr, mx + 20, y);
        if (booking.selected_slots) {
            const slotsStr = booking.selected_slots.split(',')
                .sort()
                .map((s: string) => {
                    const [from, to] = s.split('-');
                    return `${from.slice(0, 2)}-${to.slice(0, 2)}`;
                })
                .join(' ');
            drawField('Time Slots', slotsStr, mx + cw / 2, y);
        } else {
            drawField('Time', timeStr, mx + cw / 2, y);
        }
        y -= 50;

        // Row 2: Location & Ticket ID
        drawField('Location', booking.location || 'N/A', mx + 20, y);
        drawField('Ticket ID', ticketId, mx + cw / 2, y);
        y -= 55;

        // --- Attendees section (light blue bg) ---
        stream += `0.933 0.949 1 rg\n`; // #eef2ff
        stream += `${mx + 10} ${y - 40} ${cw - 20} 55 re f\n`;
        // Border
        stream += `0.780 0.824 0.996 RG\n0.5 w\n${mx + 10} ${y - 40} ${cw - 20} 55 re S\n`;

        stream += `BT\n0.388 0.400 0.945 rg\n/F1 8 Tf\n${mx + 25} ${y} Td\n(NUMBER OF ATTENDEES) Tj\nET\n`;
        stream += `BT\n0.263 0.220 0.792 rg\n/F1 22 Tf\n${mx + 25} ${y - 28} Td\n(${attendees} person${attendees > 1 ? 's' : ''}) Tj\nET\n`;

        // Booking Ref on right
        stream += `BT\n0.580 0.639 0.722 rg\n/F1 8 Tf\n${mx + cw - 150} ${y} Td\n(BOOKING REF) Tj\nET\n`;
        stream += `BT\n0.200 0.255 0.333 rg\n/F2 11 Tf\n${mx + cw - 150} ${y - 28} Td\n(${esc(booking.booking_id)}) Tj\nET\n`;

        y -= 70;

        // --- Booked By / Email section (light gray bg) ---
        stream += `0.973 0.976 0.984 rg\n`; // #f8fafc
        stream += `${mx + 10} ${y - 35} ${cw - 20} 50 re f\n`;

        drawField('Booked By', booking.user_name || 'User', mx + 25, y);
        drawField('Email', booking.email || 'N/A', mx + cw / 2, y);
        y -= 60;

        // --- Purpose section ---
        if (booking.purpose) {
            // Purple left border
            stream += `0.388 0.400 0.945 rg\n${mx + 10} ${y - 35} 4 45 re f\n`;
            // Light purple background
            stream += `0.961 0.953 1 rg\n${mx + 14} ${y - 35} ${cw - 24} 45 re f\n`;

            stream += `BT\n0.388 0.400 0.945 rg\n/F1 8 Tf\n${mx + 25} ${y} Td\n(MEETING PURPOSE) Tj\nET\n`;
            stream += `BT\n0.278 0.333 0.412 rg\n/F1 11 Tf\n${mx + 25} ${y - 22} Td\n("${esc(booking.purpose)}") Tj\nET\n`;
            y -= 60;
        }

        // --- Footer ---
        stream += `BT\n0.796 0.835 0.882 rg\n/F1 9 Tf\n${mx + cw / 2 - 120} ${y - 10} Td\n(Conference Room Booking System - Generated Ticket) Tj\nET\n`;

        // Object 5: Stream content
        addObj(`5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj`);
        // Object 6: Font (Courier for monospace)
        addObj('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj');

        // Build full PDF
        let pdf = '%PDF-1.4\n';
        for (let i = 0; i < objects.length; i++) {
            offsets.push(pdf.length);
            pdf += objects[i] + '\n';
        }
        const xrefOffset = pdf.length;
        pdf += `xref\n0 ${objId + 1}\n`;
        pdf += '0000000000 65535 f \n';
        for (let i = 0; i < offsets.length; i++) {
            pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
        }
        pdf += `trailer\n<< /Size ${objId + 1} /Root 1 0 R >>\n`;
        pdf += `startxref\n${xrefOffset}\n%%EOF`;

        // Download instantly
        const blob = new Blob([pdf], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ticket-${ticketId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [booking]);

    if (!booking) {
        return (
            <div className="max-w-md mx-auto text-center py-20 px-4">
                <p className="text-slate-500">No booking information available.</p>
                <button onClick={onHome} className="mt-4 text-primary font-semibold hover:underline">Go Home</button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto py-12 px-6">
            {/* Success Header */}
            <div className="text-center mb-10">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 bg-green-100 text-green-500 animate-bounce`}>
                    <CheckCircle size={48} weight="fill" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900">
                    Booking Confirmed!
                </h1>
                <p className="text-slate-500 mt-2">
                    Your conference room has been reserved successfully
                </p>
            </div>

            {/* Ticket Card */}
            <div ref={ticketRef} className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden relative">
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
                    <div className="w-6 h-6 bg-slate-50 rounded-full -ml-3 z-10" />
                    <div className="flex-1 border-t-2 border-dashed border-slate-200" />
                    <div className="w-6 h-6 bg-slate-50 rounded-full -mr-3 z-10" />
                </div>

                <div className="p-8">
                    <div className="grid grid-cols-2 gap-y-6 gap-x-8 mb-6">
                        <div className="flex items-start gap-3">
                            <CalendarBlank size={20} className="text-primary mt-0.5" />
                            <div className="flex-1">
                                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Date(s)</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(booking.selected_dates ? booking.selected_dates.split(',').sort() : [(booking.date || booking.start_date || '').slice(0, 10)]).map((d: string) => (
                                        <span key={d} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-bold border border-slate-200">
                                            {parseLocalDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Clock size={20} className="text-primary mt-0.5" />
                            <div className="flex-1">
                                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Time Slots</p>
                                {booking.selected_slots ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {booking.selected_slots.split(',').sort().map((s: string) => {
                                            const [from, to] = s.split('-');
                                            return (
                                                <span key={s} className="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-[11px] font-bold border border-primary/20">
                                                    {from.slice(0, 5)} - {to.slice(0, 5)}
                                                </span>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-slate-900 font-semibold">{booking.start_time?.slice(0, 5)} - {booking.end_time?.slice(0, 5)}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <MapPin size={20} className="text-primary mt-0.5" />
                            <div>
                                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Location</p>
                                <p className="text-slate-900 font-semibold">{booking.location}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Ticket size={20} className="text-primary mt-0.5" />
                            <div>
                                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Ticket ID</p>
                                <p className="text-slate-900 font-semibold font-mono text-sm">{booking.ticket_id || booking.booking_id}</p>
                            </div>
                        </div>
                    </div>

                    {/* Attendees Section */}
                    <div className="flex items-center gap-4 bg-indigo-50/70 rounded-xl p-5 mb-6 border border-indigo-100">
                        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-500">
                            <UsersThree size={28} weight="duotone" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest mb-0.5">Number of Attendees</p>
                            <p className="text-2xl font-black text-indigo-700">{booking.attendees || 1} <span className="text-sm font-semibold text-indigo-400">person{(booking.attendees || 1) > 1 ? 's' : ''}</span></p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Booking Ref</p>
                            <p className="text-slate-700 font-bold font-mono text-sm">{booking.booking_id}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 rounded-xl p-6 border border-slate-100 mb-6">
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Booked By</p>
                            <p className="text-slate-900 font-bold">{booking.user_name || 'Regular User'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Email Address</p>
                            <p className="text-slate-600 font-medium text-sm">{booking.email || 'user@iem.edu.in'}</p>
                        </div>
                    </div>

                    {booking.purpose && (
                        <div className="bg-primary/5 rounded-xl p-5 mb-6 border-l-4 border-primary">
                            <p className="text-[10px] text-primary uppercase font-bold tracking-widest mb-2">Meeting Purpose</p>
                            <p className="text-slate-700 leading-relaxed text-sm italic">"{booking.purpose}"</p>
                        </div>
                    )}

                    <p className="text-xs text-center text-slate-400 mt-4">
                        Your booking has been approved. Download your ticket for reference.
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 mt-8">
                <button onClick={onHome} className="flex-1 py-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                    <House size={20} /> Back to Home
                </button>
                <button
                    onClick={handleDownloadPDF}
                    className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
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
