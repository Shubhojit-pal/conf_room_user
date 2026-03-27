import {
    ArrowLeft,
    MapPin,
    Users,
    SquaresFour,
    ChalkboardTeacher,
    ProjectorScreen,
    WifiHigh,
    SpeakerHigh,
    Clock,
    Lock,
    Check,
    X,
    Eye,
    ForkKnife,
    Bed
} from '@phosphor-icons/react';
import React, { useState, useEffect, useCallback } from 'react';
import { fetchRoom, createBooking, fetchRoomAvailability, getCurrentUser, Room, BookedSlot } from '../lib/api';
import { getDirectImageUrl } from '../lib/imageUtils';
import { BookingResult } from '../App';
import LoginPage from './LoginPage';
import { useUISound } from '../hooks/use-ui-sound';

interface RoomDetailsPageProps {
    room: { catalog_id: string; room_id: string } | null;
    onBack: () => void;
    onBookingSuccess: (booking: BookingResult) => void;
    /** Optional dates pre-filled from the availability filter in SearchPage */
    prefillDates?: string[];
    /** Optional slots pre-filled from the availability filter in SearchPage */
    prefillSlots?: number[];
}

// Generate all 1-hour slots for the day (9 AM - 6 PM)
const ALL_SLOTS = Array.from({ length: 9 }, (_, i) => {
    const startH = 9 + i;
    const endH = startH + 1;
    return {
        start: `${String(startH).padStart(2, '0')}:00:00`,
        end: `${String(endH).padStart(2, '0')}:00:00`,
        label: `${String(startH).padStart(2, '0')}:00 - ${String(endH).padStart(2, '0')}:00`,
        startH,
    };
});

type SlotStatus = 'available' | 'booked' | 'past';

const RoomDetailsPage: React.FC<RoomDetailsPageProps> = ({ room: roomRef, onBack, onBookingSuccess, prefillDates, prefillSlots }) => {
    const { playSuccess, playError } = useUISound();
    const [room, setRoom] = useState<Room | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [bookOpen, setBookOpen] = useState(false); // collapsible booking form
    const [showAllGallery, setShowAllGallery] = useState(false);

    // Booking form
    const todayStr = new Date().toISOString().slice(0, 10);
    // If prefillDates are provided (from availability filter), use them;
    // multiple dates → custom mode, single date → single day mode
    const hasPrefill = prefillDates && prefillDates.length > 0;
    const [dateMode, setDateMode] = useState<'single' | 'range' | 'custom'>(hasPrefill && prefillDates!.length > 1 ? 'custom' : 'single');
    const [rangeStart, setRangeStart] = useState<string>('');
    const [rangeEnd, setRangeEnd] = useState<string>('');
    
    // selectedDates holds the active array regardless of mode
    const [selectedDates, setSelectedDates] = useState<string[]>(hasPrefill ? prefillDates! : [todayStr]);
    const maxDateObj = new Date();
    maxDateObj.setMonth(maxDateObj.getMonth() + 6);
    const maxDateStr = maxDateObj.toISOString().slice(0, 10);
    const [activeDate, setActiveDate] = useState<string | null>(hasPrefill ? prefillDates![0] : todayStr);
    
    // Initialize dateSlots with prefillSlots if provided
    const initialDateSlots: Record<string, number[]> = {};
    if (hasPrefill && prefillDates && prefillSlots && prefillSlots.length > 0) {
        prefillDates.forEach(d => {
            initialDateSlots[d] = [...prefillSlots];
        });
    }
    const [dateSlots, setDateSlots] = useState<Record<string, number[]>>(initialDateSlots);
    
    const [purpose, setPurpose] = useState('');
    const [attendees, setAttendees] = useState<number | string>(1);
    const [submitting, setSubmitting] = useState(false);
    const [bookResult, setBookResult] = useState<{ ok: boolean; msg: string } | null>(null);

    // Helper for range mode
    const calculateDateRange = (start: string, end: string) => {
        const dates: string[] = [];
        // Extract parts to create local date strictly
        const [sy, sm, sd] = start.split('-').map(Number);
        const [ey, em, ed] = end.split('-').map(Number);
        
        const curr = new Date(sy, sm - 1, sd);
        const last = new Date(ey, em - 1, ed);
        
        while (curr <= last && dates.length < 180) {
            const y = curr.getFullYear();
            const m = String(curr.getMonth() + 1).padStart(2, '0');
            const d = String(curr.getDate()).padStart(2, '0');
            dates.push(`${y}-${m}-${d}`);
            curr.setDate(curr.getDate() + 1);
        }
        return dates;
    };

    // Helper for formatting
    const formatLocalDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        return dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    // Availability
    const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [viewingBookedSlot, setViewingBookedSlot] = useState<number | null>(null);

    useEffect(() => {
        if (!roomRef) { setLoading(false); setError('No room selected'); return; }
        const load = async () => {
            try {
                const data = await fetchRoom(roomRef.catalog_id, roomRef.room_id);
                setRoom(data);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [roomRef?.catalog_id, roomRef?.room_id]);

    // Fetch availability when date or room changes
    const loadAvailability = useCallback(async () => {
        if (!roomRef || !activeDate) return;
        setLoadingSlots(true);
        try {
            const slots = await fetchRoomAvailability(roomRef.catalog_id, roomRef.room_id, activeDate);
            setBookedSlots(slots);
        } catch (e) {
            console.error('Failed to load availability:', e);
            setBookedSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    }, [roomRef?.catalog_id, roomRef?.room_id, activeDate]);

    useEffect(() => {
        loadAvailability();
        setBookResult(null);
        setViewingBookedSlot(null);
    }, [loadAvailability, activeDate]);

    // Slideshow state
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const gallery = room?.image_urls && room.image_urls.length > 0 
        ? room.image_urls 
        : (room?.image_url ? [room.image_url] : []);

    useEffect(() => {
        if (gallery.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentImageIndex(prev => (prev + 1) % gallery.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [gallery.length]);

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentImageIndex(prev => (prev + 1) % gallery.length);
    };

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentImageIndex(prev => (prev - 1 + gallery.length) % gallery.length);
    };

    // Check if a slot overlaps with a booking using start/end times directly
    const isSlotInBooking = (slot: typeof ALL_SLOTS[0], b: BookedSlot) => {
        if (b.selected_slots) {
            // Granular booking: check against each individual selected slot
            const slotsArray = b.selected_slots.split(',');
            return slotsArray.some(s => {
                const [bStart, bEnd] = s.split('-').map(part => part.slice(0, 5));
                return bStart === slot.start.slice(0, 5) && bEnd === slot.end.slice(0, 5);
            });
        }
        // Fallback for legacy range-based booking: check hour overlap
        const bStartH = parseInt(b.start_time.split(':')[0]);
        const bEndH = parseInt(b.end_time.split(':')[0]);
        return slot.startH >= bStartH && slot.startH < bEndH;
    };

    // Determine slot status
    const getSlotStatus = (slot: typeof ALL_SLOTS[0]): SlotStatus => {
        // Check if past (only for today)
        const isToday = activeDate === todayStr;
        if (isToday) {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            // Slot is past if its start hour is <= current hour (can't book a slot that's already started)
            if (slot.startH < currentHour || (slot.startH === currentHour && currentMinute > 0)) {
                return 'past';
            }
        }

        // Check if booked (any existing booking overlaps this slot)
        for (const booked of bookedSlots) {
            if (isSlotInBooking(slot, booked)) {
                return 'booked';
            }
        }

        return 'available';
    };

    // Find the booking that overlaps a given slot
    const getMatchingBooking = (slot: typeof ALL_SLOTS[0]): BookedSlot | undefined => {
        return bookedSlots.find(b => isSlotInBooking(slot, b));
    };


    const handleSlotClick = (index: number) => {
        if (!activeDate) return;
        const status = getSlotStatus(ALL_SLOTS[index]);
        if (status !== 'available') return;

        setDateSlots(prev => {
            const currentSlots = prev[activeDate] || [];
            if (currentSlots.includes(index)) {
                return { ...prev, [activeDate]: currentSlots.filter(s => s !== index) };
            } else {
                return { ...prev, [activeDate]: [...currentSlots, index].sort((a,b)=>a-b) };
            }
        });
    };

    const isSlotSelected = (index: number): boolean => {
        if (!activeDate) return false;
        return (dateSlots[activeDate] || []).includes(index);
    };

    const getTotalHours = () => {
        return Object.values(dateSlots).reduce((total, slots) => total + slots.length, 0);
    };

    const submitBookingAction = async (user: any) => {
        if (!room) return;
        
        const perDateChoices = selectedDates.map(date => {
            const slots = dateSlots[date] || [];
            if (slots.length === 0) return null;
            const daySlots = slots.map(i => `${ALL_SLOTS[i].start}-${ALL_SLOTS[i].end}`);
            return { date, slots: daySlots };
        }).filter(Boolean) as { date: string, slots: string[] }[];

        if (perDateChoices.length !== selectedDates.length) {
            setBookResult({ ok: false, msg: 'Please select at least one time slot for every selected date.' });
            return;
        }

        if (perDateChoices.length === 0) {
            setBookResult({ ok: false, msg: 'No dates or time slots selected.' });
            return;
        }

        if (selectedDates.length > 180) {
            setBookResult({ ok: false, msg: 'A single booking cannot exceed 180 dates.' });
            return;
        }

        const tooFar = selectedDates.some(d => d > maxDateStr);
        if (tooFar) {
            setBookResult({ ok: false, msg: 'Bookings are only allowed up to 6 months in advance.' });
            return;
        }

        const attendeeCount = Number(attendees) || 1;

        if (attendeeCount > room.capacity) {
            setBookResult({ ok: false, msg: `Attendees cannot exceed room capacity (${room.capacity} people).` });
            return;
        }

        setSubmitting(true);
        setBookResult(null);
        try {
            const result = await createBooking({
                uid: user.uid,
                catalog_id: room.catalog_id,
                room_id: room.room_id,
                purpose,
                attendees: attendeeCount,
                per_date_choices: perDateChoices
            });
            playSuccess();
            setBookResult({ ok: true, msg: `Booking created! ID: ${result.booking_id}` });
            setDateSlots({});
            setSelectedDates([todayStr]);
            setActiveDate(todayStr);
            setPurpose('');
            loadAvailability();
            setTimeout(() => {
                onBookingSuccess({
                    booking_id: result.booking_id,
                    ticket_id: result.ticket_id,
                    status: 'confirmed',
                    room_name: room.room_name,
                    location: room.location,
                    date: perDateChoices[0].date,
                    start_time: perDateChoices[0].slots[0].split('-')[0],
                    end_time: perDateChoices[0].slots[0].split('-')[1],
                    purpose,
                    attendees: attendeeCount,
                    user_name: user.name,
                    email: user.email,
                });
            }, 800);
        } catch (err: any) {
            playError();
            setBookResult({ ok: false, msg: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleBook = async (e: React.FormEvent) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) {
            setShowLoginModal(true);
            return;
        }
        submitBookingAction(user);
    };

    const renderBookingForm = () => {
        if (!room) return null;
        return (
            <div className="p-5">
                {bookResult && (
                    <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${bookResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                        {bookResult.msg}
                    </div>
                )}
                <form onSubmit={handleBook} className="space-y-5">
                    <div className="flex bg-theme-bg p-1 rounded-xl border border-theme-border">
                        <button type="button" onClick={() => { setDateMode('single'); setSelectedDates([todayStr]); setActiveDate(todayStr); setDateSlots({}); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${dateMode === 'single' ? 'bg-theme-card shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] text-primary border border-theme-border' : 'text-theme-secondary opacity-50 hover:opacity-100'}`}>Single Day</button>
                        <button type="button" onClick={() => { setDateMode('range'); setRangeStart(''); setRangeEnd(''); setSelectedDates([]); setActiveDate(null); setDateSlots({}); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${dateMode === 'range' ? 'bg-theme-card shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] text-primary border border-theme-border' : 'text-theme-secondary opacity-50 hover:opacity-100'}`}>Consecutive Days</button>
                        <button type="button" onClick={() => { setDateMode('custom'); setSelectedDates([]); setActiveDate(null); setDateSlots({}); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${dateMode === 'custom' ? 'bg-theme-card shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] text-primary border border-theme-border' : 'text-theme-secondary opacity-50 hover:opacity-100'}`}>Custom Days</button>
                    </div>
                    {dateMode === 'single' && (
                        <div>
                            <label className="block text-sm font-semibold text-theme-primary mb-1.5">Reservation Date</label>
                            <input type="date" min={todayStr} max={maxDateStr} value={selectedDates[0] || todayStr} onChange={e => { const v = e.target.value; if (v) { setSelectedDates([v]); setActiveDate(v); } }} className="w-full bg-theme-bg p-4 rounded-xl border border-theme-border focus:outline-none focus:ring-2 focus:ring-primary font-medium text-sm text-theme-primary" />
                        </div>
                    )}
                    {dateMode === 'range' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-theme-primary mb-1.5">Start Date</label>
                                <input type="date" min={todayStr} max={maxDateStr} value={rangeStart} onChange={e => { const v = e.target.value; setRangeStart(v); let end = rangeEnd; if (!rangeEnd || v > rangeEnd) { setRangeEnd(v); end = v; } if (v && end) { const d = calculateDateRange(v, end); setSelectedDates(d); setActiveDate(d[0] || null); } }} className="w-full bg-theme-bg p-4 rounded-xl border border-theme-border focus:outline-none focus:ring-2 focus:ring-primary font-medium text-sm text-theme-primary" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-theme-primary mb-1.5">End Date</label>
                                <input type="date" min={rangeStart || todayStr} max={maxDateStr} value={rangeEnd} onChange={e => { const v = e.target.value; setRangeEnd(v); if (rangeStart && v) { const d = calculateDateRange(rangeStart, v); setSelectedDates(d); if (activeDate && !d.includes(activeDate)) setActiveDate(d[0]); else if (!activeDate) setActiveDate(d[0]); } }} className="w-full bg-theme-bg p-4 rounded-xl border border-theme-border focus:outline-none focus:ring-2 focus:ring-primary font-medium text-sm text-theme-primary" />
                            </div>
                        </div>
                    )}
                    {dateMode === 'custom' && (
                        <div>
                            <label className="block text-sm font-semibold text-theme-primary mb-1.5">Add Dates</label>
                            <input type="date" min={todayStr} max={maxDateStr} onChange={e => { const v = e.target.value; if (v && !selectedDates.includes(v)) { setSelectedDates(prev => [...prev, v].sort()); setActiveDate(v); } }} className="w-full bg-theme-bg p-4 rounded-xl border border-theme-border focus:outline-none focus:ring-2 focus:ring-primary font-medium text-sm text-theme-primary" />
                        </div>
                    )}
                    {(dateMode === 'custom' || dateMode === 'range') && selectedDates.length > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-theme-secondary opacity-50 uppercase mb-2">Selected Dates ({selectedDates.length})</label>
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                {selectedDates.map(date => (
                                    <div key={date} onClick={() => setActiveDate(date)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all border ${activeDate === date ? 'bg-primary text-white border-primary shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]' : 'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10'}`}>
                                        {formatLocalDate(date)}
                                        {dateMode === 'custom' && (
                                            <button type="button" onClick={e => { e.stopPropagation(); const nd = selectedDates.filter(d => d !== date); setSelectedDates(nd); if (activeDate === date) setActiveDate(nd.length > 0 ? nd[0] : null); setDateSlots(prev => { const s = { ...prev }; delete s[date]; return s; }); }} className={`ml-1 hover:text-red-500 ${activeDate === date ? 'text-white/70' : ''}`}><X size={12} weight="bold" /></button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className={!activeDate ? 'opacity-50 pointer-events-none' : ''}>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-sm font-semibold text-theme-primary">
                                Select Time Slots {activeDate && <span className="text-primary font-black ml-1">for {formatLocalDate(activeDate)}</span>}
                            </label>
                            {selectedDates.length > 1 && (
                                <button type="button" onClick={() => { if (!activeDate) return; const cur = dateSlots[activeDate] || []; setDateSlots(prev => { const n = { ...prev }; selectedDates.forEach(d => { n[d] = [...cur]; }); return n; }); }} className="text-[10px] font-bold text-primary hover:underline bg-primary/10 px-2 py-1 rounded">Apply to all dates</button>
                            )}
                        </div>
                        <p className="text-[10px] text-theme-secondary opacity-50 mb-3 uppercase tracking-wider">{activeDate ? 'Click time slots to select or deselect them' : 'Select a date above to define slots'}</p>
                        {loadingSlots ? (
                            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 gap-2.5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-theme-bg rounded-xl animate-pulse" />)}</div>
                        ) : (
                            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 gap-2.5">
                                {ALL_SLOTS.map((slot, index) => {
                                    const status = getSlotStatus(slot);
                                    const selected = isSlotSelected(index);
                                    let cls = 'relative flex items-center justify-center sm:justify-start gap-2 px-2 sm:px-3 py-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all border-2 ';
                                    if (status === 'past') cls += 'bg-theme-bg text-theme-secondary opacity-30 border-theme-border cursor-not-allowed line-through';
                                    else if (status === 'booked') cls += 'bg-rose-50 dark:bg-rose-950/20 text-rose-500 border-rose-100 dark:border-rose-900/30 cursor-pointer hover:bg-rose-100';
                                    else if (selected) cls += 'bg-primary text-white border-primary shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/25 scale-[1.02]';
                                    else cls += 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 cursor-pointer hover:scale-[1.02] active:scale-95';
                                    return (
                                        <div key={slot.start} className="relative w-full">
                                            <button type="button" onClick={() => { if (status === 'past') return; if (status === 'booked') setViewingBookedSlot(viewingBookedSlot === index ? null : index); else handleSlotClick(index); }} className={`w-full ${cls}`}>
                                                {status === 'past' && <Clock size={14} />}
                                                {status === 'booked' && <><Lock size={14} /><span>{slot.label}</span><Eye size={14} className="ml-auto opacity-70" /></>}
                                                {status === 'available' && !selected && <Clock size={14} />}
                                                {selected && <Check size={14} weight="bold" />}
                                                {status !== 'booked' && <span>{slot.label}</span>}
                                            </button>
                                            {status === 'booked' && viewingBookedSlot === index && (() => {
                                                const mb = getMatchingBooking(slot);
                                                if (!mb) return null;
                                                return (
                                                    <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-theme-card border-2 border-rose-300 dark:border-rose-700 rounded-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] overflow-hidden">
                                                        {/* Header */}
                                                        <div className="bg-rose-500 px-4 py-2.5 flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <Lock size={13} className="text-white" />
                                                                <span className="text-xs font-black text-white uppercase tracking-wider">Slot Booked</span>
                                                            </div>
                                                            <button onClick={e => { e.stopPropagation(); setViewingBookedSlot(null); }} className="text-white/70 hover:text-white transition-colors">
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                        {/* Body */}
                                                        <div className="p-4 space-y-2.5">
                                                            {/* Time */}
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Clock size={13} className="text-rose-500 shrink-0" />
                                                                <span className="font-bold text-theme-primary">{mb.start_time.slice(0,5)} – {mb.end_time.slice(0,5)}</span>
                                                            </div>
                                                            <div className="border-t border-theme-border pt-2 space-y-2">
                                                                {/* Name */}
                                                                <div className="flex items-start gap-2 text-xs">
                                                                    <span className="text-theme-secondary opacity-60 font-semibold w-14 shrink-0">👤 Name</span>
                                                                    <span className="text-theme-primary font-bold">{mb.user_name || 'Unknown User'}</span>
                                                                </div>
                                                                {/* Email */}
                                                                {mb.email && (
                                                                    <div className="flex items-start gap-2 text-xs">
                                                                        <span className="text-theme-secondary opacity-60 font-semibold w-14 shrink-0">📧 Email</span>
                                                                        <span className="text-theme-primary break-all">{mb.email}</span>
                                                                    </div>
                                                                )}
                                                                {/* Phone */}
                                                                {mb.phone_no && (
                                                                    <div className="flex items-start gap-2 text-xs">
                                                                        <span className="text-theme-secondary opacity-60 font-semibold w-14 shrink-0">📞 Phone</span>
                                                                        <span className="text-theme-primary">{mb.phone_no}</span>
                                                                    </div>
                                                                )}
                                                                {/* Purpose */}
                                                                {mb.purpose && (
                                                                    <div className="flex items-start gap-2 text-xs">
                                                                        <span className="text-theme-secondary opacity-60 font-semibold w-14 shrink-0">📋 Purpose</span>
                                                                        <span className="text-theme-primary">{mb.purpose}</span>
                                                                    </div>
                                                                )}
                                                                {/* Status */}
                                                                <div className="flex items-center gap-2 text-xs pt-1 border-t border-theme-border">
                                                                    <span className="text-theme-secondary opacity-60 font-semibold w-14 shrink-0">Status</span>
                                                                    <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full font-bold text-[10px] uppercase tracking-wide">
                                                                        {mb.status || 'Confirmed'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <div className="flex gap-4 mt-3 justify-center">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200" /><span className="text-[10px] text-theme-secondary opacity-50 font-bold uppercase">Available</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-rose-100 dark:bg-rose-900/40 border border-rose-200" /><span className="text-[10px] text-theme-secondary opacity-50 font-bold uppercase">Booked</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-theme-bg border border-theme-border" /><span className="text-[10px] text-theme-secondary opacity-50 font-bold uppercase">Past</span></div>
                        </div>
                    </div>
                    {totalSelectedHours > 0 && (
                        <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl">
                            <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">Reservation Summary</p>
                            <p className="text-xl font-black text-theme-primary">{selectedDates.length} date(s)</p>
                            <p className="text-xs text-theme-secondary opacity-60 mt-1">{totalSelectedHours} total hour(s) selected</p>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-semibold text-theme-primary mb-1.5">Attendees</label>
                        <p className="text-[10px] text-theme-secondary opacity-50 mb-1 uppercase tracking-wider">Max capacity: {room.capacity} people</p>
                        <input type="number" min="1" max={room.capacity} value={attendees} onChange={e => { const v = e.target.value; if (v === '') setAttendees(''); else setAttendees(parseInt(v) || 1); }} required className="w-full text-sm p-3 rounded-xl border border-theme-border focus:outline-none focus:ring-2 focus:ring-primary bg-theme-bg text-theme-primary" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-theme-primary mb-1.5">Purpose</label>
                        <textarea rows={2} value={purpose} onChange={e => setPurpose(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-theme-border focus:outline-none focus:ring-2 focus:ring-primary bg-theme-bg text-theme-primary" placeholder="Meeting purpose..." />
                    </div>
                    <button type="submit" disabled={submitting || totalSelectedHours === 0 || (room && Number(attendees) > room.capacity) || selectedDates.length === 0 || !purpose.trim()} className="w-full py-4 bg-secondary hover:bg-secondary/90 text-white text-lg font-bold rounded-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-blue-200 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed">
                        {submitting ? 'Booking...' : (room && Number(attendees) > room.capacity) ? 'Capacity Exceeded' : totalSelectedHours === 0 ? 'Select a time slot' : !purpose.trim() ? 'Enter a purpose to continue' : 'Book This Space'}
                    </button>
                </form>
            </div>
        );
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
    );

    if (error || !room) return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <button onClick={onBack} className="flex items-center gap-2 text-theme-secondary hover:text-theme-primary transition-colors mb-6 text-sm font-medium">
                <ArrowLeft size={16} /> Back to all spaces
            </button>
            <div className="text-center py-20 text-theme-secondary">
                <p className="text-lg font-semibold">{error || 'Room not found'}</p>
            </div>
        </div>
    );

    const amenityList = room.amenities ? room.amenities.split(',').map(a => a.trim()) : [];
    const amenityIcons: Record<string, React.ReactNode> = {
        'Whiteboard': <ChalkboardTeacher size={20} />,
        'Projector': <ProjectorScreen size={20} />,
        'WiFi': <WifiHigh size={20} />,
        'Audio System': <SpeakerHigh size={20} />,
        'Fooding': <ForkKnife size={20} />,
        'Lodging': <Bed size={20} />,
    };

    const totalSelectedHours = getTotalHours();

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <button onClick={onBack} className="flex items-center gap-2 text-theme-secondary hover:text-theme-primary transition-colors mb-6 text-sm font-medium">
                <ArrowLeft size={16} />
                Back to all spaces
            </button>

            {/* Image Gallery / Hero */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 h-[260px] md:h-[400px] overflow-hidden">
                <div 
                    className="md:col-span-2 h-full rounded-xl overflow-hidden bg-slate-900 group relative shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] cursor-pointer"
                    onClick={() => gallery.length > 0 && setShowAllGallery(true)}
                >
                    {gallery.length > 0 ? (
                        <>
                            {/* Slides */}
                            <div className="relative w-full h-full">
                                {gallery.map((url, idx) => (
                                    <div 
                                        key={idx}
                                        className={`absolute inset-0 transition-all duration-1000 ease-in-out transform ${
                                            idx === currentImageIndex 
                                                ? 'opacity-100 scale-100 translate-x-0' 
                                                : 'opacity-0 scale-110 translate-x-4 pointer-events-none'
                                        }`}
                                    >
                                        <img
                                            src={getDirectImageUrl(url)}
                                            alt={`${room.room_name} - View ${idx + 1}`}
                                            referrerPolicy="no-referrer"
                                            crossOrigin="anonymous"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                                    </div>
                                ))}
                            </div>

                            {/* Controls */}
                            {gallery.length > 1 && (
                                <>
                                    <button 
                                        onClick={prevImage}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 border border-white/20"
                                    >
                                        <ArrowLeft size={20} weight="bold" />
                                    </button>
                                    <button 
                                        onClick={nextImage}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 border border-white/20"
                                    >
                                        <ArrowLeft size={20} weight="bold" className="rotate-180" />
                                    </button>

                                    {/* Indicators */}
                                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                                        {gallery.map((_, idx) => (
                                            <button
                                                key={idx}
                                                onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); }}
                                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                                    idx === currentImageIndex ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                            
                            {/* Counter */}
                            <div className="absolute top-4 right-4 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-white text-[10px] font-bold uppercase tracking-widest border border-white/10">
                                {currentImageIndex + 1} / {gallery.length}
                            </div>
                        </>
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <div className="text-center">
                                <SquaresFour size={64} className="text-primary/40 mx-auto mb-3" />
                                <h3 className="text-2xl font-bold text-primary/60">{room.room_name}</h3>
                                <p className="text-primary/40">Room {room.room_number} • Floor {room.floor_no}</p>
                            </div>
                        </div>
                    )}
                </div>
                <div className="hidden md:flex flex-col gap-4 h-full">
                    {/* Top right box: Preview Image or Capacity */}
                    {gallery.length > 1 ? (
                        <div 
                            className="flex-1 rounded-xl overflow-hidden bg-theme-bg cursor-pointer group relative shadow-sm"
                            onClick={() => setShowAllGallery(true)}
                        >
                            <img
                                src={getDirectImageUrl(gallery[1])}
                                alt="Preview 2"
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                            {gallery.length > 2 && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-lg font-bold">See all {gallery.length}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 rounded-xl overflow-hidden bg-theme-bg/50 border border-theme-border flex items-center justify-center">
                            <div className="text-center text-theme-secondary opacity-40">
                                <Users size={32} className="mx-auto mb-1" />
                                <p className="text-sm font-medium">Capacity: {room.capacity}</p>
                            </div>
                        </div>
                    )}

                    {/* Bottom right box: View on Map location */}
                    <div 
                        className={`flex-1 rounded-xl overflow-hidden bg-theme-bg border border-theme-border flex items-center justify-center p-4 transition-all ${room.mapLink ? 'cursor-pointer hover:bg-primary/5 hover:border-primary/30 group/loc shadow-sm' : ''}`}
                        onClick={() => room.mapLink && window.open(room.mapLink, '_blank')}
                    >
                        <div className="text-center">
                            <MapPin size={32} className={`mx-auto mb-2 transition-colors ${room.mapLink ? 'text-primary group-hover/loc:scale-110' : 'text-theme-secondary opacity-40'}`} weight={room.mapLink ? "fill" : "regular"} />
                            <p className="text-sm font-bold text-theme-primary">{room.location}</p>
                            <p className="text-[10px] text-theme-secondary opacity-60 mt-1">Floor {room.floor_no}, Room {room.room_number}</p>
                            {room.mapLink && (
                                <span className="inline-block mt-2 text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded">View on Map</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Restrict main content width */}
            <div className="max-w-5xl mx-auto pb-24">
                <div className="flex flex-col gap-8 relative z-10 bg-theme-bg">
                {/* Main Info */}
                <div className="space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold text-theme-primary mb-3">{room.room_name}</h1>
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <span className="flex items-center gap-1.5 font-bold text-theme-primary">
                                    <MapPin size={20} className="text-primary" weight="fill" />
                                    {room.location}
                                </span>
                                <span className="hidden md:block w-1.5 h-1.5 rounded-full bg-theme-border"></span>
                                <span className="flex items-center gap-1.5 text-theme-secondary opacity-70">
                                    <SquaresFour size={18} />
                                    Floor {room.floor_no}, Room {room.room_number}
                                </span>
                            </div>

                            {/* Mobile View on Map Button */}
                            {room.mapLink && (
                                <button
                                    onClick={() => window.open(room.mapLink, '_blank')}
                                    className="md:hidden flex items-center justify-center gap-2 w-full py-2.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black rounded-xl transition-all border border-primary/20"
                                >
                                    <MapPin size={16} weight="fill" />
                                    <span>OPEN IN GOOGLE MAPS</span>
                                </button>
                            )}
                        </div>
                        <p className="mt-6 text-theme-secondary leading-relaxed opacity-80 border-l-2 border-primary/20 pl-4 italic">
                            Located on Floor {room.floor_no}, this room has a capacity of {room.capacity} people.
                            {room.availability ? ` ${room.availability}` : ' Available for booking.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-primary/5 p-5 rounded-xl flex items-center gap-4 border border-primary/10">
                            <div className="p-3 bg-primary/10 text-primary rounded-lg"><Users size={24} /></div>
                            <div>
                                <span className="block text-sm text-theme-secondary opacity-60">Capacity</span>
                                <strong className="text-lg text-theme-primary">{room.capacity} people</strong>
                            </div>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-5 rounded-xl flex items-center gap-4 border border-emerald-100 dark:border-emerald-900/30">
                            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 rounded-lg"><SquaresFour size={24} /></div>
                            <div>
                                <span className="block text-sm text-theme-secondary opacity-60">Status</span>
                                <strong className="text-lg text-theme-primary capitalize">{room.status}</strong>
                            </div>
                        </div>
                    </div>

                    {amenityList.length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold text-theme-primary mb-4">Amenities</h2>
                            <div className="grid grid-cols-2 gap-4">
                                {amenityList.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg hover:bg-theme-bg transition-colors">
                                        <div className="text-primary bg-theme-card p-2 rounded shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] border border-theme-border">
                                            {amenityIcons[item] || <SquaresFour size={20} />}
                                        </div>
                                        <span className="text-theme-secondary font-medium">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Room Layout Viewer */}
                    {room.layout && room.layout.elements && room.layout.elements.length > 0 && (() => {
                        const TYPE_INFO: Record<string, { icon: string; label: string; color: string; border: string }> = {
                            seat:       { icon: '🪑', label: 'Seat',       color: 'bg-blue-100 dark:bg-blue-900/50',    border: 'border-blue-200 dark:border-blue-800' },
                            table:      { icon: '▬',  label: 'Table',      color: 'bg-amber-100 dark:bg-amber-900/50',  border: 'border-amber-200 dark:border-amber-800' },
                            screen:     { icon: '📺', label: 'Screen',     color: 'bg-slate-200 dark:bg-slate-700/60',  border: 'border-slate-300 dark:border-slate-600' },
                            whiteboard: { icon: '📋', label: 'Board',      color: 'bg-green-100 dark:bg-green-900/50',  border: 'border-green-200 dark:border-green-800' },
                            podium:     { icon: '🎤', label: 'Podium',     color: 'bg-purple-100 dark:bg-purple-900/50',border: 'border-purple-200 dark:border-purple-800' },
                            door:       { icon: '🚪', label: 'Door',       color: 'bg-orange-100 dark:bg-orange-900/50',border: 'border-orange-200 dark:border-orange-800' },
                            plant:      { icon: '🌿', label: 'Plant',      color: 'bg-emerald-100 dark:bg-emerald-900/50',border:'border-emerald-200 dark:border-emerald-800' },
                        };
                        const { rows, cols, elements } = room.layout;

                        // Responsive cell size: target fitting ~10 cols in ~320px (min phone) = 32px minimum
                        // On larger screens use 40px. We'll compute in CSS via clamp.
                        const CELL_PX = 38; // slightly larger to fit labels well
                        const GRID_W = cols * CELL_PX;
                        const GRID_H = rows * CELL_PX;

                        const uniqueTypes = [...new Set(elements.map(e => e.type))];

                        return (
                            <div>
                                {/* Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h2 className="text-xl font-bold text-theme-primary">Room Layout</h2>
                                        <p className="text-[11px] text-theme-secondary opacity-50 mt-0.5">Designed floor plan</p>
                                    </div>
                                    <span className="text-[10px] font-bold text-theme-secondary opacity-50 uppercase tracking-widest bg-theme-card border border-theme-border px-2 py-1 rounded-full">
                                        Floor Plan
                                    </span>
                                </div>

                                <div className="bg-theme-card border border-theme-border rounded-2xl overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]">
                                    {/* Scrollable grid container with right-fade hint */}
                                    <div className="relative">
                                        {/* Fade-right gradient scroll hint */}
                                        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-l from-white/80 dark:from-slate-900/80 to-transparent rounded-r" />
                                        <div
                                            className="overflow-x-auto overflow-y-hidden p-3 pb-1"
                                            style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
                                        >
                                            {/* Outer room border */}
                                            <div
                                                className="relative border-2 border-theme-border rounded-xl bg-white/60 dark:bg-slate-900/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-inner mx-auto"
                                                style={{ width: GRID_W, height: GRID_H, minWidth: GRID_W }}
                                            >
                                                {/* Background Grid lines */}
                                                <div
                                                    className="absolute inset-0 grid"
                                                    style={{
                                                        gridTemplateColumns: `repeat(${cols}, ${CELL_PX}px)`,
                                                        gridTemplateRows: `repeat(${rows}, ${CELL_PX}px)`,
                                                    }}
                                                >
                                                    {Array.from({ length: rows * cols }).map((_, i) => (
                                                        <div key={i} className="border border-slate-100/70 dark:border-slate-800/30" />
                                                    ))}
                                                </div>

                                                {/* Placed Elements Grid */}
                                                <div
                                                    className="absolute inset-0 grid pointer-events-none"
                                                    style={{
                                                        gridTemplateColumns: `repeat(${cols}, ${CELL_PX}px)`,
                                                        gridTemplateRows: `repeat(${rows}, ${CELL_PX}px)`,
                                                    }}
                                                >
                                                    {elements.map((el: any, idx: number) => {
                                                        const info = TYPE_INFO[el.type] || { icon: '?', label: el.type, color: 'bg-slate-200 dark:bg-slate-800/50', border: 'border-slate-300 dark:border-slate-700' };
                                                        const w = el.w ?? 1;
                                                        const h = el.h ?? 1;
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`
                                                                    pointer-events-auto flex flex-col items-center justify-center select-none overflow-hidden
                                                                    transition-colors z-10 m-[1px] rounded
                                                                    ${info.color} border ${info.border}
                                                                `}
                                                                style={{
                                                                    gridColumn: `${el.x + 1} / span ${w}`,
                                                                    gridRow: `${el.y + 1} / span ${h}`,
                                                                }}
                                                                title={info.label}
                                                            >
                                                                <span className="text-[13px] sm:text-[15px] leading-none drop-shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]">{info.icon}</span>
                                                                <span className="text-[6.5px] sm:text-[7.5px] font-black uppercase tracking-wider mt-0.5 opacity-80 whitespace-nowrap overflow-hidden text-ellipsis px-0.5 w-full text-center">
                                                                    {info.label}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Scroll hint label */}
                                        {GRID_W > 320 && (
                                            <p className="text-center text-[10px] text-theme-secondary opacity-40 py-1 font-medium tracking-wide">
                                                ← scroll to explore →
                                            </p>
                                        )}
                                    </div>

                                    {/* Legend strip */}
                                    <div className="px-4 py-3 border-t border-theme-border bg-theme-bg/50">
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-theme-secondary opacity-40 mb-2">Legend</p>
                                        <div className="flex flex-wrap gap-2">
                                            {uniqueTypes.map((type: any) => {
                                                const info = TYPE_INFO[type as string] || { icon: '?', label: String(type), color: '', border: '' };
                                                return (
                                                    <div key={String(type)} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${info.color} ${info.border}`}>
                                                        <span className="text-sm leading-none">{info.icon}</span>
                                                        <span className="text-[11px] font-semibold text-theme-secondary">{info.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Stats bar */}
                                    <div className="px-4 py-2.5 border-t border-theme-border flex items-center gap-4 text-[11px] text-theme-secondary opacity-60">
                                        <span><strong className="text-theme-primary opacity-100">{elements.filter((e: any) => e.type === 'seat').length}</strong> seats</span>
                                        <span><strong className="text-theme-primary opacity-100">{elements.filter((e: any) => e.type === 'table').length}</strong> tables</span>
                                        <span><strong className="text-theme-primary opacity-100">{elements.length}</strong> total items</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ── Book a Space: Responsive View ── */}
                    <div className="mt-6 scroll-mt-20" id="booking-section">
                        {/* Mobile Trigger Button */}
                        <button
                            type="button"
                            onClick={() => setBookOpen(prev => !prev)}
                            className="w-full md:hidden flex items-center justify-between px-6 py-4 bg-gradient-to-r from-secondary to-primary text-white font-bold text-base rounded-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-blue-200 dark:shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-blue-900/30 transition-all active:scale-[0.99] hover:opacity-95"
                        >
                            <span className="flex items-center gap-2">
                                <Check size={20} weight="bold" />
                                Book a Space
                            </span>
                            <span className={`transition-transform duration-300 ${bookOpen ? 'rotate-180' : ''}`}>▼</span>
                        </button>

                        {/* DESKTOP VIEW: direct card, shown on md screens and up */}
                        <div className="hidden md:block">
                            <div className="bg-theme-card rounded-2xl border border-theme-border shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] overflow-hidden mt-8">
                                <div className="flex items-center justify-between px-5 py-4 border-b border-theme-border bg-gradient-to-r from-secondary/10 to-primary/5">
                                    <div>
                                        <h3 className="text-lg font-black text-theme-primary">Book a Space</h3>
                                        <p className="text-[11px] text-theme-secondary opacity-50">Fill in the details below to reserve this room</p>
                                    </div>
                                </div>
                                {renderBookingForm()}
                            </div>
                        </div>

                        {/* MOBILE MODAL: shown on screens smaller than md */}
                        {bookOpen && (
                            <div className="md:hidden fixed inset-0 z-[100] flex flex-col justify-end min-[500px]:items-center min-[500px]:justify-center p-0 min-[500px]:p-4">
                                <div 
                                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" 
                                    onClick={() => setBookOpen(false)}
                                />
                                <div className="relative z-10 w-full max-w-lg bg-theme-bg rounded-t-[32px] min-[500px]:rounded-[32px] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] overflow-hidden animate-slide-up-modal flex flex-col max-h-[88vh]">
                                    {/* Pull Handle for Mobile */}
                                    <div className="flex justify-center pt-3 shrink-0">
                                        <div className="w-12 h-1.5 bg-theme-border rounded-full opacity-40" />
                                    </div>
                                    <div className="flex items-center justify-between px-6 py-5 border-b border-theme-border bg-theme-card shrink-0">
                                        <div>
                                            <h3 className="text-xl font-black text-theme-primary">Book a Space</h3>
                                            <p className="text-xs text-theme-secondary opacity-50">Reservation Form</p>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => setBookOpen(false)} 
                                            className="p-3 bg-theme-bg rounded-xl text-theme-secondary border border-theme-border hover:bg-theme-card active:scale-95 transition-all shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]"
                                        >
                                            <X size={20} weight="bold" />
                                        </button>
                                    </div>
                                    <div className="flex-grow overflow-y-auto overflow-x-hidden">
                                        <div className="pb-32">
                                            {renderBookingForm()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div> {/* End max-w-5xl */}

            {showLoginModal && (
                <LoginPage
                    isModal
                    onClose={() => setShowLoginModal(false)}
                    onSuccess={() => {
                        setShowLoginModal(false);
                        const user = getCurrentUser();
                        if (user) submitBookingAction(user);
                    }}
                />
            )}

            {showAllGallery && (
                <div className="fixed inset-0 z-[200] bg-theme-bg/95 backdrop-blur-xl flex flex-col animate-fade-in overflow-hidden">
                    <div className="flex items-center justify-between p-4 md:p-6 bg-theme-card/50 border-b border-theme-border shrink-0">
                        <button 
                            onClick={() => setShowAllGallery(false)}
                            className="flex items-center gap-2 text-theme-secondary hover:text-theme-primary transition-colors text-sm font-bold"
                        >
                            <X size={24} weight="bold" /> Close
                        </button>
                        <span className="text-theme-primary text-sm font-black tracking-widest uppercase">{gallery.length} Photos</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 md:p-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-7xl mx-auto pb-12">
                            {gallery.map((url, idx) => (
                                <div key={idx} className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-theme-bg border border-theme-border shadow-md group">
                                    <img 
                                        src={getDirectImageUrl(url)} 
                                        alt={`${room.room_name} - view ${idx + 1}`}
                                        referrerPolicy="no-referrer"
                                        crossOrigin="anonymous" 
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoomDetailsPage;
