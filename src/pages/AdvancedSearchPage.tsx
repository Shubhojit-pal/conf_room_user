import React, { useState, useEffect, useCallback } from 'react';
import {
    SlidersHorizontal,
    Buildings,
    Users,
    Clock,
    CalendarBlank,
    Star,
    ArrowRight,
    X,
    CheckCircle,
    Warning,
    SquaresFour,
    Eye,
    Sun,
    ListChecks,
    ArrowsClockwise,
} from '@phosphor-icons/react';
import { fetchRooms, fetchRoomAvailability, createBooking, getCurrentUser, Room, BookedSlot } from '../lib/api';

// ── All time slots 9 AM – 6 PM ──
const ALL_SLOTS = Array.from({ length: 9 }, (_, i) => {
    const startH = 9 + i;
    const endH = startH + 1;
    return {
        start: `${String(startH).padStart(2, '0')}:00:00`,
        end: `${String(endH).padStart(2, '0')}:00:00`,
        label: `${String(startH).padStart(2, '0')}:00 – ${String(endH).padStart(2, '0')}:00`,
        startH,
        endH,
    };
});

const ROOM_TYPES = ['Conference Room', 'Meeting Room', 'Training Room', 'Board Room', 'Auditorium'];
const AMENITY_OPTIONS = ['Projector', 'Whiteboard', 'WiFi', 'AC', 'Video Conferencing', 'Sound System'];

interface AdvancedSearchPageProps {
    onViewRoom?: (catalog_id: string, room_id: string) => void;
    onBookingSuccess?: (booking: any) => void;
}

interface AvailableRoom extends Room {
    availableSlots: typeof ALL_SLOTS;
    bookedSlots: BookedSlot[];
}

const AdvancedSearchPage: React.FC<AdvancedSearchPageProps> = ({ onViewRoom, onBookingSuccess }) => {
    const today = new Date().toISOString().slice(0, 10);
    const maxDate = (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 6);
        return d.toISOString().slice(0, 10);
    })();

    // ── Mode: 'full-day' | 'by-slot'
    const [bookingMode, setBookingMode] = useState<'full-day' | 'by-slot'>('by-slot');

    // ── Filters ──
    const [searchDate, setSearchDate] = useState(today);
    const [selectedSlotIndices, setSelectedSlotIndices] = useState<number[]>([]);
    const [selectedLocation, setSelectedLocation] = useState('all');
    const [selectedRoomType, setSelectedRoomType] = useState('all');
    const [minCapacity, setMinCapacity] = useState('');
    const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // ── Data ──
    const [allRooms, setAllRooms] = useState<Room[]>([]);
    const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // ── Booking modal ──
    const [bookingRoom, setBookingRoom] = useState<AvailableRoom | null>(null);
    const [bookSlots, setBookSlots] = useState<typeof ALL_SLOTS>([]);
    const [bookPurpose, setBookPurpose] = useState('');
    const [bookAttendees, setBookAttendees] = useState<number>(1);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [bookingMsg, setBookingMsg] = useState<{ ok: boolean; text: string } | null>(null);

    // ── Load all rooms once ──
    useEffect(() => {
        fetchRooms().then(setAllRooms).catch(console.error);
    }, []);

    const hasSlotConflict = (slot: typeof ALL_SLOTS[0], booked: BookedSlot[]) => {
        return booked.some(b => {
            if (b.selected_slots) {
                return b.selected_slots.split(',').some(s => {
                    const [bStart, bEnd] = s.split('-').map(p => p.slice(0, 5));
                    return bStart === slot.start.slice(0, 5) && bEnd === slot.end.slice(0, 5);
                });
            }
            const bStartH = parseInt(b.start_time.split(':')[0]);
            const bEndH = parseInt(b.end_time.split(':')[0]);
            return slot.startH >= bStartH && slot.startH < bEndH;
        });
    };

    const isPastSlot = (slot: typeof ALL_SLOTS[0]) => {
        if (searchDate !== today) return false;
        const now = new Date();
        return slot.startH <= now.getHours();
    };

    // ── Search function — auto triggers and manual ──
    const doSearch = useCallback(async (rooms: Room[]) => {
        if (rooms.length === 0) return;
        setLoading(true);
        setHasSearched(true);
        setAvailableRooms([]);

        try {
            // Static filters
            let filtered = rooms.filter(r => r.status === 'active');
            if (selectedLocation !== 'all') filtered = filtered.filter(r => r.location === selectedLocation);
            if (selectedRoomType !== 'all') filtered = filtered.filter(r => r.room_type === selectedRoomType);
            if (minCapacity) filtered = filtered.filter(r => (r.capacity || 0) >= parseInt(minCapacity));
            if (selectedAmenities.length > 0) {
                filtered = filtered.filter(r =>
                    selectedAmenities.every(a => (r.amenities || '').toLowerCase().includes(a.toLowerCase()))
                );
            }

            // Fetch availability for each room in parallel
            const results = await Promise.all(
                filtered.map(async (room): Promise<AvailableRoom | null> => {
                    try {
                        const booked = await fetchRoomAvailability(room.catalog_id, room.room_id, searchDate);

                        // Free slots for today vs future
                        const freeSlots = ALL_SLOTS.filter(s => !isPastSlot(s) && !hasSlotConflict(s, booked));

                        // If user picked specific slots, ALL must be free
                        if (bookingMode === 'by-slot' && selectedSlotIndices.length > 0) {
                            const wanted = selectedSlotIndices.map(i => ALL_SLOTS[i]);
                            const allFree = wanted.every(s => !isPastSlot(s) && !hasSlotConflict(s, booked));
                            if (!allFree) return null;
                        }

                        // For full-day mode, at least all non-past slots must be free
                        if (bookingMode === 'full-day') {
                            const nonPast = ALL_SLOTS.filter(s => !isPastSlot(s));
                            const allFree = nonPast.every(s => !hasSlotConflict(s, booked));
                            if (!allFree) return null;
                        }

                        return { ...room, availableSlots: freeSlots, bookedSlots: booked };
                    } catch {
                        return null;
                    }
                })
            );

            setAvailableRooms(results.filter((r): r is AvailableRoom => r !== null));
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchDate, selectedLocation, selectedRoomType, minCapacity, selectedAmenities, selectedSlotIndices, bookingMode]);

    // Auto-search when allRooms loads OR any filter changes
    useEffect(() => {
        if (allRooms.length > 0) {
            doSearch(allRooms);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allRooms, searchDate, selectedLocation, selectedRoomType, minCapacity, selectedAmenities, bookingMode]);

    // When mode changes to by-slot, clear selection; full-day = auto
    useEffect(() => {
        setSelectedSlotIndices([]);
    }, [bookingMode]);

    const toggleSlot = (index: number) => {
        if (bookingMode === 'full-day') return;
        setSelectedSlotIndices(prev =>
            prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index].sort((a, b) => a - b)
        );
    };

    const toggleAmenity = (a: string) =>
        setSelectedAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

    // ── Open booking modal ──
    const openBooking = (room: AvailableRoom) => {
        const slots = bookingMode === 'full-day'
            ? ALL_SLOTS.filter(s => !isPastSlot(s))
            : selectedSlotIndices.length > 0
                ? selectedSlotIndices.map(i => ALL_SLOTS[i])
                : room.availableSlots;
        setBookingRoom(room);
        setBookSlots(slots);
        setBookPurpose('');
        setBookAttendees(1);
        setBookingMsg(null);
    };

    const confirmBooking = async () => {
        if (!bookingRoom) return;
        const user = getCurrentUser();
        if (!user) { setBookingMsg({ ok: false, text: 'Please log in to book.' }); return; }
        if (bookSlots.length === 0) { setBookingMsg({ ok: false, text: 'No slots selected.' }); return; }

        setBookingLoading(true);
        setBookingMsg(null);
        try {
            const result = await createBooking({
                uid: user.uid,
                catalog_id: bookingRoom.catalog_id,
                room_id: bookingRoom.room_id,
                purpose: bookPurpose,
                attendees: bookAttendees,
                per_date_choices: [{
                    date: searchDate,
                    slots: bookSlots.map(s => `${s.start.slice(0, 5)}-${s.end.slice(0, 5)}`),
                }],
            });
            setBookingMsg({ ok: true, text: `Booking confirmed! Booking ID: ${result.booking_id}` });
            if (onBookingSuccess) {
                setTimeout(() => onBookingSuccess({
                    booking_id: result.booking_id,
                    room_name: bookingRoom.room_name,
                    location: bookingRoom.location || '',
                    date: searchDate,
                    start_time: bookSlots[0].start,
                    end_time: bookSlots[bookSlots.length - 1].end,
                    purpose: bookPurpose,
                    attendees: bookAttendees,
                    ticket_id: result.ticket_id,
                }), 1500);
            }
        } catch (e: any) {
            setBookingMsg({ ok: false, text: e.message || 'Booking failed.' });
        } finally {
            setBookingLoading(false);
        }
    };

    const activeFilterCount = [
        selectedLocation !== 'all', selectedRoomType !== 'all', !!minCapacity, selectedAmenities.length > 0
    ].filter(Boolean).length;

    const locationOptions = [...new Set(allRooms.map(r => r.location).filter(Boolean))];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-28 md:pb-10">

            {/* ── Page Header ── */}
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent">
                    Advanced Search & Booking
                </h1>
                <p className="text-theme-secondary mt-1 text-sm">
                    Find available rooms with precision — full day or specific slots.
                </p>
            </div>

            {/* ── Mode Selection ── */}
            <div className="grid grid-cols-2 gap-3 mb-5">
                <button
                    onClick={() => setBookingMode('full-day')}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-start gap-2 transition-all text-left ${
                        bookingMode === 'full-day'
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]'
                            : 'border-theme-border bg-theme-card hover:border-violet-300'
                    }`}
                >
                    <div className={`p-2 rounded-xl ${bookingMode === 'full-day' ? 'bg-violet-500 text-white' : 'bg-theme-bg text-theme-secondary'}`}>
                        <Sun size={20} />
                    </div>
                    <div>
                        <p className={`font-bold text-sm ${bookingMode === 'full-day' ? 'text-violet-700 dark:text-violet-400' : 'text-theme-primary'}`}>
                            Entire Day
                        </p>
                        <p className="text-xs text-theme-secondary opacity-60 mt-0.5">Book 09:00 – 18:00</p>
                    </div>
                </button>

                <button
                    onClick={() => setBookingMode('by-slot')}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-start gap-2 transition-all text-left ${
                        bookingMode === 'by-slot'
                            ? 'border-primary bg-primary/5 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]'
                            : 'border-theme-border bg-theme-card hover:border-primary/40'
                    }`}
                >
                    <div className={`p-2 rounded-xl ${bookingMode === 'by-slot' ? 'bg-primary text-white' : 'bg-theme-bg text-theme-secondary'}`}>
                        <ListChecks size={20} />
                    </div>
                    <div>
                        <p className={`font-bold text-sm ${bookingMode === 'by-slot' ? 'text-primary' : 'text-theme-primary'}`}>
                            By Time Slot
                        </p>
                        <p className="text-xs text-theme-secondary opacity-60 mt-0.5">Pick specific hours</p>
                    </div>
                </button>
            </div>

            {/* ── Filters Panel ── */}
            <div className="bg-theme-card border border-theme-border rounded-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] overflow-hidden mb-6">

                {/* Primary filters */}
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-theme-secondary uppercase tracking-wider mb-1.5">
                            <CalendarBlank size={12} className="inline mr-1" /> Date
                        </label>
                        <input
                            type="date"
                            min={today}
                            max={maxDate}
                            value={searchDate}
                            onChange={e => setSearchDate(e.target.value)}
                            className="w-full px-3 py-2.5 bg-theme-bg border border-theme-border rounded-xl text-theme-primary text-sm focus:ring-2 focus:ring-primary outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-theme-secondary uppercase tracking-wider mb-1.5">
                            <Buildings size={12} className="inline mr-1" /> Location
                        </label>
                        <select
                            value={selectedLocation}
                            onChange={e => setSelectedLocation(e.target.value)}
                            className="w-full px-3 py-2.5 bg-theme-bg border border-theme-border rounded-xl text-theme-primary text-sm focus:ring-2 focus:ring-primary outline-none"
                        >
                            <option value="all">All Locations</option>
                            {locationOptions.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-theme-secondary uppercase tracking-wider mb-1.5">
                            <Users size={12} className="inline mr-1" /> Min Capacity
                        </label>
                        <input
                            type="number"
                            min="1"
                            placeholder="Any"
                            value={minCapacity}
                            onChange={e => setMinCapacity(e.target.value)}
                            className="w-full px-3 py-2.5 bg-theme-bg border border-theme-border rounded-xl text-theme-primary text-sm focus:ring-2 focus:ring-primary outline-none"
                        />
                    </div>
                </div>

                {/* Slot selector (only for by-slot mode) */}
                {bookingMode === 'by-slot' && (
                    <div className="px-4 pb-4 border-t border-theme-border pt-3 bg-theme-bg/30">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-theme-secondary uppercase tracking-wider">
                                <Clock size={12} className="inline mr-1" /> Select Desired Slots (optional — leave blank to show all)
                            </p>
                            {selectedSlotIndices.length > 0 && (
                                <button onClick={() => setSelectedSlotIndices([])} className="text-xs text-rose-500 hover:underline font-bold">
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5">
                            {ALL_SLOTS.map((slot, idx) => {
                                const past = isPastSlot(slot);
                                const sel = selectedSlotIndices.includes(idx);
                                return (
                                    <button
                                        key={slot.start}
                                        type="button"
                                        disabled={past}
                                        onClick={() => toggleSlot(idx)}
                                        className={`py-2 px-1 rounded-xl text-[10px] font-bold border-2 transition-all leading-tight text-center ${
                                            past ? 'opacity-20 line-through border-theme-border cursor-not-allowed bg-theme-bg'
                                                : sel ? 'bg-primary text-white border-primary shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] scale-[1.03]'
                                                    : 'bg-theme-bg text-theme-secondary border-theme-border hover:border-primary hover:text-primary cursor-pointer'
                                        }`}
                                    >
                                        {slot.label.replace(' – ', '\n–')}
                                    </button>
                                );
                            })}
                        </div>
                        {selectedSlotIndices.length > 0 && (
                            <p className="mt-2 text-xs text-primary font-semibold">
                                ✓ {selectedSlotIndices.length} slot{selectedSlotIndices.length > 1 ? 's' : ''} selected ·
                                {ALL_SLOTS[selectedSlotIndices[0]].start.slice(0, 5)} – {ALL_SLOTS[selectedSlotIndices[selectedSlotIndices.length - 1]].end.slice(0, 5)}
                            </p>
                        )}
                    </div>
                )}

                {/* Full-day info bar */}
                {bookingMode === 'full-day' && (
                    <div className="px-4 py-3 border-t border-theme-border bg-violet-50 dark:bg-violet-950/20 flex items-center gap-2">
                        <Sun size={14} className="text-violet-500 shrink-0" />
                        <p className="text-xs font-bold text-violet-700 dark:text-violet-400">
                            Full Day mode — only shows rooms with ALL slots free from 09:00 to 18:00
                        </p>
                    </div>
                )}

                {/* Advanced filters + Refresh */}
                <div className="px-4 py-3 border-t border-theme-border flex items-center gap-3 flex-wrap bg-theme-bg/20">
                    <button
                        onClick={() => setShowAdvanced(v => !v)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${showAdvanced ? 'bg-primary/10 border-primary text-primary' : 'border-theme-border text-theme-secondary hover:border-primary hover:text-primary'}`}
                    >
                        <SlidersHorizontal size={14} />
                        Advanced
                        {activeFilterCount > 0 && (
                            <span className="bg-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>
                        )}
                    </button>
                    {activeFilterCount > 0 && (
                        <button
                            onClick={() => { setSelectedLocation('all'); setSelectedRoomType('all'); setMinCapacity(''); setSelectedAmenities([]); }}
                            className="text-xs text-rose-500 hover:underline font-bold flex items-center gap-1"
                        >
                            <X size={12} /> Reset
                        </button>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                        {loading && <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
                        <button
                            onClick={() => doSearch(allRooms)}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs transition-all disabled:opacity-60"
                        >
                            <ArrowsClockwise size={14} className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Advanced filter drawer */}
                {showAdvanced && (
                    <div className="px-4 py-4 bg-theme-bg/50 border-t border-theme-border grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-bold text-theme-secondary uppercase tracking-wider mb-2">
                                <SquaresFour size={12} className="inline mr-1" /> Room Type
                            </label>
                            <select
                                value={selectedRoomType}
                                onChange={e => setSelectedRoomType(e.target.value)}
                                className="w-full px-3 py-2.5 bg-theme-bg border border-theme-border rounded-xl text-theme-primary text-sm focus:ring-2 focus:ring-primary outline-none"
                            >
                                <option value="all">All Types</option>
                                {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-theme-secondary uppercase tracking-wider mb-2">
                                <Star size={12} className="inline mr-1" /> Required Amenities
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {AMENITY_OPTIONS.map(a => (
                                    <button
                                        key={a}
                                        onClick={() => toggleAmenity(a)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                                            selectedAmenities.includes(a)
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-theme-bg text-theme-secondary border-theme-border hover:border-indigo-400 hover:text-indigo-600'
                                        }`}
                                    >
                                        {a}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Results ── */}
            {loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-theme-card border border-theme-border rounded-2xl overflow-hidden animate-pulse">
                            <div className="h-28 bg-theme-bg/60" />
                            <div className="p-4 space-y-3">
                                <div className="h-4 bg-theme-bg/60 rounded-lg w-3/4" />
                                <div className="h-3 bg-theme-bg/60 rounded-lg w-1/2" />
                                <div className="h-8 bg-theme-bg/60 rounded-xl w-full" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && hasSearched && availableRooms.length === 0 && (
                <div className="text-center py-16">
                    <Warning size={48} className="mx-auto mb-4 text-amber-400 opacity-60" />
                    <p className="font-bold text-lg text-theme-primary">No available rooms found</p>
                    <p className="text-sm text-theme-secondary opacity-60 mt-1">
                        {bookingMode === 'full-day'
                            ? 'No rooms are fully free for the entire day. Try a different date.'
                            : selectedSlotIndices.length > 0
                                ? 'No rooms have all your selected slots free. Try fewer slots or a different date.'
                                : 'No active rooms match your filters.'}
                    </p>
                </div>
            )}

            {!loading && availableRooms.length > 0 && (
                <>
                    <div className="flex items-center gap-3 mb-4">
                        <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-black rounded-full">
                            {availableRooms.length} room{availableRooms.length > 1 ? 's' : ''} available
                        </span>
                        <span className="text-xs text-theme-secondary opacity-60">
                            {searchDate}
                            {bookingMode === 'full-day' ? ' · Full Day (09:00–18:00)' : selectedSlotIndices.length > 0
                                ? ` · ${ALL_SLOTS[selectedSlotIndices[0]].start.slice(0, 5)}–${ALL_SLOTS[selectedSlotIndices[selectedSlotIndices.length - 1]].end.slice(0, 5)}`
                                : ' · All slots'}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {availableRooms.map(room => (
                            <div
                                key={`${room.catalog_id}-${room.room_id}`}
                                className="bg-theme-card border border-theme-border rounded-2xl overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col group"
                            >
                                {/* Image */}
                                <div className="h-36 bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950/30 dark:to-indigo-950/30 overflow-hidden relative">
                                    {(room.image_urls?.[0] || room.image_url) ? (
                                        <img
                                            src={room.image_urls?.[0] || room.image_url}
                                            alt={room.room_name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center opacity-20">
                                            <Buildings size={40} />
                                        </div>
                                    )}
                                    {/* Mode badge */}
                                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black text-white ${bookingMode === 'full-day' ? 'bg-violet-600' : 'bg-emerald-600'}`}>
                                        {bookingMode === 'full-day' ? '🌅 Full Day' : `${room.availableSlots.length} slots free`}
                                    </div>
                                </div>

                                <div className="p-4 flex flex-col flex-1">
                                    <h3 className="font-bold text-theme-primary text-base leading-tight">{room.room_name}</h3>
                                    <p className="text-xs text-theme-secondary opacity-60 mt-0.5 mb-3">
                                        {room.location}{room.floor_no ? ` · Floor ${room.floor_no}` : ''}
                                    </p>

                                    {/* Stats row */}
                                    <div className="flex gap-3 mb-3">
                                        <span className="flex items-center gap-1 text-xs text-theme-secondary">
                                            <Users size={11} /> {room.capacity}
                                        </span>
                                        {room.room_type && (
                                            <span className="flex items-center gap-1 text-xs text-theme-secondary">
                                                <SquaresFour size={11} /> {room.room_type}
                                            </span>
                                        )}
                                    </div>

                                    {/* Free slots preview */}
                                    {bookingMode === 'by-slot' && (
                                        <div className="mb-4">
                                            <p className="text-[9px] font-bold text-theme-secondary uppercase tracking-wider mb-1.5 opacity-50">Free Slots</p>
                                            <div className="flex flex-wrap gap-1">
                                                {room.availableSlots.slice(0, 5).map(s => (
                                                    <span key={s.start} className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold rounded border border-emerald-200 dark:border-emerald-800">
                                                        {s.label}
                                                    </span>
                                                ))}
                                                {room.availableSlots.length > 5 && (
                                                    <span className="text-[9px] text-theme-secondary opacity-50 font-bold">+{room.availableSlots.length - 5}</span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {bookingMode === 'full-day' && (
                                        <div className="mb-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 text-xs font-bold rounded-lg border border-violet-200 dark:border-violet-800">
                                                <Sun size={11} /> 09:00 – 18:00 (all slots free)
                                            </span>
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div className="flex gap-2 mt-auto">
                                        {onViewRoom && (
                                            <button
                                                onClick={() => onViewRoom(room.catalog_id, room.room_id)}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 border-theme-border text-theme-secondary hover:border-primary hover:text-primary transition-all"
                                            >
                                                <Eye size={13} /> Details
                                            </button>
                                        )}
                                        <button
                                            onClick={() => openBooking(room)}
                                            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] ${bookingMode === 'full-day' ? 'bg-violet-600 hover:bg-violet-700 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-violet-200' : 'bg-primary hover:bg-primary-dark shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/20'}`}
                                        >
                                            Book Now <ArrowRight size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ── Booking Confirmation Modal ── */}
            {bookingRoom && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-theme-card rounded-2xl border border-theme-border shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] w-full max-w-md max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className={`sticky top-0 px-5 py-4 flex justify-between items-center rounded-t-2xl border-b border-theme-border ${bookingMode === 'full-day' ? 'bg-violet-600 text-white' : 'bg-primary text-white'}`}>
                            <div>
                                <h2 className="font-bold text-base">Confirm Booking</h2>
                                <p className="text-xs opacity-70">{bookingRoom.room_name}</p>
                            </div>
                            <button onClick={() => setBookingRoom(null)} className="opacity-70 hover:opacity-100 p-1 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Summary card */}
                            <div className="bg-theme-bg border border-theme-border rounded-xl p-3 space-y-2 text-xs">
                                {[
                                    ['Room', bookingRoom.room_name],
                                    ['Location', bookingRoom.location || '—'],
                                    ['Date', searchDate],
                                    ['Time', bookingMode === 'full-day' ? '09:00 – 18:00 (Full Day)' : bookSlots.length > 0 ? `${bookSlots[0].start.slice(0, 5)} – ${bookSlots[bookSlots.length - 1].end.slice(0, 5)}` : '—'],
                                    ['Slots', `${bookSlots.length} hour${bookSlots.length !== 1 ? 's' : ''}`],
                                ].map(([label, value]) => (
                                    <div key={label} className="flex justify-between gap-2">
                                        <span className="text-theme-secondary font-semibold">{label}</span>
                                        <span className="text-theme-primary font-bold text-right">{value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Purpose */}
                            <div>
                                <label className="block text-xs font-bold text-theme-secondary uppercase tracking-wider mb-1.5">Purpose</label>
                                <textarea
                                    rows={2}
                                    value={bookPurpose}
                                    onChange={e => setBookPurpose(e.target.value)}
                                    placeholder="Describe the purpose of this booking..."
                                    className="w-full px-3 py-2.5 bg-theme-bg border border-theme-border rounded-xl text-theme-primary text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                                />
                            </div>

                            {/* Attendees */}
                            <div>
                                <label className="block text-xs font-bold text-theme-secondary uppercase tracking-wider mb-1.5">
                                    Attendees (max {bookingRoom.capacity})
                                </label>
                                <input
                                    type="number" min="1" max={bookingRoom.capacity}
                                    value={bookAttendees}
                                    onChange={e => setBookAttendees(Math.min(parseInt(e.target.value) || 1, bookingRoom.capacity))}
                                    className="w-full px-3 py-2.5 bg-theme-bg border border-theme-border rounded-xl text-theme-primary text-sm focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>

                            {/* Result message */}
                            {bookingMsg && (
                                <div className={`flex items-start gap-2 p-3 rounded-xl text-sm border ${bookingMsg.ok ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 border-emerald-200' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 border-rose-200'}`}>
                                    {bookingMsg.ok ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <Warning size={16} className="shrink-0 mt-0.5" />}
                                    {bookingMsg.text}
                                </div>
                            )}

                            {/* Confirm button */}
                            <button
                                onClick={confirmBooking}
                                disabled={bookingLoading || !!bookingMsg?.ok}
                                className={`w-full py-3 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${bookingMode === 'full-day' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-primary hover:bg-primary-dark'}`}
                            >
                                {bookingLoading ? (
                                    <div className="w-4 h-4 border-2 border-slate-200 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <CheckCircle size={16} />
                                )}
                                {bookingLoading ? 'Booking...' : bookingMsg?.ok ? 'Done!' : 'Confirm Booking'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdvancedSearchPage;
