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
}

// Generate all 1-hour slots for the day (9 AM – 6 PM)
const ALL_SLOTS = Array.from({ length: 9 }, (_, i) => {
    const startH = 9 + i;
    const endH = startH + 1;
    return {
        start: `${String(startH).padStart(2, '0')}:00:00`,
        end: `${String(endH).padStart(2, '0')}:00:00`,
        label: `${String(startH).padStart(2, '0')}:00 – ${String(endH).padStart(2, '0')}:00`,
        startH,
    };
});

type SlotStatus = 'available' | 'booked' | 'past';

const RoomDetailsPage: React.FC<RoomDetailsPageProps> = ({ room: roomRef, onBack, onBookingSuccess }) => {
    const { playSuccess, playError } = useUISound();
    const [room, setRoom] = useState<Room | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // Booking form
    const todayStr = new Date().toISOString().slice(0, 10);
    const [dateMode, setDateMode] = useState<'single' | 'range' | 'custom'>('single');
    const [rangeStart, setRangeStart] = useState<string>('');
    const [rangeEnd, setRangeEnd] = useState<string>('');
    
    // selectedDates holds the active array regardless of mode
    const [selectedDates, setSelectedDates] = useState<string[]>([todayStr]);
    const [activeDate, setActiveDate] = useState<string | null>(todayStr);
    const [dateSlots, setDateSlots] = useState<Record<string, number[]>>({});
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
        
        while (curr <= last && dates.length < 30) {
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

    const isSlotInBooking = (slotLabel: string, b: BookedSlot) => {
        if (!b.selected_slots) {
            // Fallback for legacy (pure range)
            const [slotStart, slotEnd] = slotLabel.split(' – ').map(s => s.trim());
            return b.start_time.slice(0, 5) < slotEnd && b.end_time.slice(0, 5) > slotStart;
        }

        const [sStart, sEnd] = slotLabel.split(' – ').map(s => s.trim());
        const slotsArray = b.selected_slots.split(',');
        return slotsArray.some(s => {
            const [bStart, bEnd] = s.split('-').map(part => part.slice(0, 5));
            return bStart === sStart && bEnd === sEnd;
        });
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
            if (isSlotInBooking(slot.label, booked)) {
                return 'booked';
            }
        }

        return 'available';
    };

    // Find the booking that overlaps a given slot
    const getMatchingBooking = (slot: typeof ALL_SLOTS[0]): BookedSlot | undefined => {
        return bookedSlots.find(b => isSlotInBooking(slot.label, b));
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

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
    );

    if (error || !room) return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-6 text-sm font-medium">
                <ArrowLeft size={16} /> Back to all spaces
            </button>
            <div className="text-center py-20 text-slate-500">
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

    const totalSelectedHoures = getTotalHours();

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-6 text-sm font-medium">
                <ArrowLeft size={16} />
                Back to all spaces
            </button>

            {/* Image Gallery / Hero */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 h-[260px] md:h-[400px]">
                <div className="md:col-span-2 h-full rounded-xl overflow-hidden bg-slate-900 group relative shadow-2xl">
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
                    {/* Small previews if available */}
                    {gallery.length > 1 ? (
                        <>
                            {gallery.slice(1, 3).map((url, idx) => (
                                <div 
                                    key={idx} 
                                    className="h-1/2 rounded-xl overflow-hidden bg-slate-100 cursor-pointer group relative"
                                    onClick={() => setCurrentImageIndex(idx + 1)}
                                >
                                    <img
                                        src={getDirectImageUrl(url)}
                                        alt={`Preview ${idx + 2}`}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                                    {idx === 1 && gallery.length > 3 && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                                            <span className="text-xl font-bold">+{gallery.length - 3}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {gallery.length === 2 && (
                                <div className="h-1/2 rounded-xl overflow-hidden bg-gradient-to-br from-green-50 to-green-100/30 flex items-center justify-center">
                                    <div className="text-center text-green-600">
                                        <MapPin size={32} className="mx-auto mb-1" />
                                        <p className="text-sm font-medium">{room.location}</p>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="h-1/2 rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                                <div className="text-center text-slate-400">
                                    <Users size={32} className="mx-auto mb-1" />
                                    <p className="text-sm font-medium">Capacity: {room.capacity}</p>
                                </div>
                            </div>
                            <div className="h-1/2 rounded-xl overflow-hidden bg-gradient-to-br from-green-50 to-green-100/30 flex items-center justify-center">
                                <div className="text-center text-green-600">
                                    <MapPin size={32} className="mx-auto mb-1" />
                                    <p className="text-sm font-medium">{room.location}</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Main Info */}
                <div className="flex-1 space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">{room.room_name}</h1>
                        <div className="flex items-center gap-4 text-slate-500">
                            <span className="flex items-center gap-1.5"><MapPin size={18} /> {room.location}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="flex items-center gap-1.5"><SquaresFour size={18} /> Room {room.room_number}</span>
                        </div>
                        <p className="mt-4 text-slate-600 leading-relaxed">
                            Located on Floor {room.floor_no}, this room has a capacity of {room.capacity} people.
                            {room.availability ? ` ${room.availability}` : ' Available for booking.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-primary-light/30 p-5 rounded-xl flex items-center gap-4 border border-primary-light">
                            <div className="p-3 bg-primary-light text-primary rounded-lg"><Users size={24} /></div>
                            <div>
                                <span className="block text-sm text-slate-500">Capacity</span>
                                <strong className="text-lg text-slate-900">{room.capacity} people</strong>
                            </div>
                        </div>
                        <div className="bg-green-50 p-5 rounded-xl flex items-center gap-4 border border-green-100">
                            <div className="p-3 bg-green-100 text-green-600 rounded-lg"><SquaresFour size={24} /></div>
                            <div>
                                <span className="block text-sm text-slate-500">Status</span>
                                <strong className="text-lg text-slate-900 capitalize">{room.status}</strong>
                            </div>
                        </div>
                    </div>

                    {amenityList.length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 mb-4">Amenities</h2>
                            <div className="grid grid-cols-2 gap-4">
                                {amenityList.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                                        <div className="text-primary bg-white p-2 rounded shadow-sm border border-slate-100">
                                            {amenityIcons[item] || <SquaresFour size={20} />}
                                        </div>
                                        <span className="text-slate-700 font-medium">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Sidebar - Booking Card */}
                <div className="w-full lg:w-[420px] shrink-0 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
                        <div className="mb-6 invisible h-0">
                            <span className="text-3xl font-bold text-secondary">Free</span>
                            <span className="text-slate-500"> per hour</span>
                        </div>

                        {bookResult && (
                            <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${bookResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                {bookResult.msg}
                            </div>
                        )}

                        <form onSubmit={handleBook} className="space-y-5">
                            {/* Date Selection Mode Toggle */}
                            <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setDateMode('single');
                                        setSelectedDates([todayStr]);
                                        setActiveDate(todayStr);
                                        setDateSlots({});
                                    }} 
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${dateMode === 'single' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Single Day
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setDateMode('range');
                                        setRangeStart('');
                                        setRangeEnd('');
                                        setSelectedDates([]);
                                        setActiveDate(null);
                                        setDateSlots({});
                                    }} 
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${dateMode === 'range' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Consecutive Days
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setDateMode('custom');
                                        setSelectedDates([]);
                                        setActiveDate(null);
                                        setDateSlots({});
                                    }} 
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${dateMode === 'custom' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Custom Days
                                </button>
                            </div>

                            {/* Date Picker Interfaces */}
                            {dateMode === 'single' && (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">Reservation Date</label>
                                    <input
                                        type="date"
                                        min={todayStr}
                                        value={selectedDates[0] || todayStr}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val) {
                                                setSelectedDates([val]);
                                                setActiveDate(val);
                                            }
                                        }}
                                        className="w-full p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary bg-slate-50 font-medium text-sm transition-all text-slate-500"
                                    />
                                </div>
                            )}

                            {dateMode === 'range' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">Start Date</label>
                                        <input
                                            type="date"
                                            min={todayStr}
                                            value={rangeStart}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setRangeStart(val);
                                                
                                                let endVal = rangeEnd;
                                                if (!rangeEnd || val > rangeEnd) {
                                                    setRangeEnd(val);
                                                    endVal = val;
                                                }
                                                
                                                if (val && endVal) {
                                                    const dates = calculateDateRange(val, endVal);
                                                    setSelectedDates(dates);
                                                    setActiveDate(dates[0] || null);
                                                }
                                            }}
                                            className="w-full p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary bg-slate-50 font-medium text-sm transition-all text-slate-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">End Date</label>
                                        <input
                                            type="date"
                                            min={rangeStart || todayStr}
                                            value={rangeEnd}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setRangeEnd(val);
                                                if (rangeStart && val) {
                                                    const dates = calculateDateRange(rangeStart, val);
                                                    setSelectedDates(dates);
                                                    if (activeDate && !dates.includes(activeDate)) setActiveDate(dates[0]);
                                                    else if (!activeDate) setActiveDate(dates[0]);
                                                }
                                            }}
                                            className="w-full p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary bg-slate-50 font-medium text-sm transition-all text-slate-500"
                                        />
                                    </div>
                                </div>
                            )}

                            {dateMode === 'custom' && (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">Add Dates</label>
                                    <input
                                        type="date"
                                        min={todayStr}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val && !selectedDates.includes(val)) {
                                                setSelectedDates(prev => [...prev, val].sort());
                                                setActiveDate(val);
                                            }
                                        }}
                                        className="w-full p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary bg-slate-50 font-medium text-sm transition-all text-slate-500"
                                    />
                                </div>
                            )}

                            {/* Selected Dates Display (Only in Range or Custom mode) */}
                            {(dateMode === 'custom' || dateMode === 'range') && selectedDates.length > 0 && (
                                <div className="mt-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Selected Dates ({selectedDates.length})</label>
                                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                        {selectedDates.map(date => (
                                            <div
                                                key={date}
                                                onClick={() => setActiveDate(date)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all border
                                                    ${activeDate === date
                                                        ? 'bg-primary text-white border-primary shadow-md'
                                                        : 'bg-primary-light/50 text-primary-dark border-primary-light hover:bg-primary-light/80'}`}
                                            >
                                                {formatLocalDate(date)}
                                                {dateMode === 'custom' && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const newDates = selectedDates.filter(d => d !== date);
                                                            setSelectedDates(newDates);
                                                            if (activeDate === date) {
                                                                setActiveDate(newDates.length > 0 ? newDates[0] : null);
                                                            }
                                                            setDateSlots(prev => {
                                                                const newSlots = { ...prev };
                                                                delete newSlots[date];
                                                                return newSlots;
                                                            });
                                                        }}
                                                        className={`ml-1 hover:text-red-500 ${activeDate === date ? 'text-white/70' : ''}`}
                                                    >
                                                        <X size={12} weight="bold" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Time Slot Grid */}
                            <div className={!activeDate ? 'opacity-50 pointer-events-none' : ''}>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-sm font-semibold text-slate-700">
                                        Select Time Slots {activeDate && <span className="text-primary font-black ml-1">for {formatLocalDate(activeDate)}</span>}
                                    </label>
                                    {selectedDates.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!activeDate) return;
                                                const currentSlots = dateSlots[activeDate] || [];
                                                setDateSlots(prev => {
                                                    const nextSlots = { ...prev };
                                                    selectedDates.forEach(d => {
                                                        nextSlots[d] = [...currentSlots];
                                                    });
                                                    return nextSlots;
                                                });
                                            }}
                                            className="text-[10px] font-bold text-primary hover:underline bg-primary/10 px-2 py-1 rounded transition-colors"
                                        >
                                            Apply to all dates
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-400 mb-3 uppercase tracking-wider">
                                    {activeDate ? 'Click time slots to select or deselect them' : 'Select a date above to define slots'}
                                </p>

                                {loadingSlots ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {Array.from({ length: 6 }).map((_, i) => (
                                            <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {ALL_SLOTS.map((slot, index) => {
                                            const status = getSlotStatus(slot);
                                            const selected = isSlotSelected(index);

                                            let classes = 'relative flex items-center gap-2 px-3 py-3 rounded-xl text-xs font-bold transition-all border-2 ';

                                            if (status === 'past') {
                                                classes += 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed line-through';
                                            } else if (status === 'booked') {
                                                classes += 'bg-rose-50 text-rose-400 border-rose-100 cursor-pointer hover:bg-rose-100';
                                            } else if (selected) {
                                                classes += 'bg-primary text-white border-primary shadow-lg shadow-primary/25 scale-[1.02]';
                                            } else {
                                                classes += 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer hover:scale-[1.02] active:scale-95';
                                            }

                                            return (
                                                <div key={slot.start} className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (status === 'past') return;
                                                            if (status === 'booked') {
                                                                setViewingBookedSlot(viewingBookedSlot === index ? null : index);
                                                            } else {
                                                                handleSlotClick(index);
                                                            }
                                                        }}
                                                        className={classes}
                                                    >
                                                        {status === 'past' && <Clock size={14} />}
                                                        {status === 'booked' && (
                                                            <>
                                                                <Lock size={14} />
                                                                <span>{slot.label}</span>
                                                                <Eye size={14} className="ml-auto opacity-70" />
                                                            </>
                                                        )}
                                                        {status === 'available' && !selected && <Clock size={14} />}
                                                        {selected && <Check size={14} weight="bold" />}
                                                        {status !== 'booked' && <span>{slot.label}</span>}
                                                    </button>

                                                    {/* Booked slot details popup */}
                                                    {status === 'booked' && viewingBookedSlot === index && (() => {
                                                        const mb = getMatchingBooking(slot);
                                                        if (!mb) return null;
                                                        return (
                                                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border-2 border-rose-200 rounded-xl shadow-xl p-4 animate-fade-in">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <span className="text-xs font-black text-rose-500 uppercase tracking-wide">Booked</span>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setViewingBookedSlot(null); }}
                                                                        className="text-slate-400 hover:text-slate-600"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                                <p className="text-sm font-bold text-slate-800">{mb.user_name || 'Unknown'}</p>
                                                                {mb.email && <p className="text-xs text-slate-500">{mb.email}</p>}
                                                                {mb.phone_no && <p className="text-xs text-slate-500">📞 {mb.phone_no}</p>}
                                                                {mb.purpose && <p className="text-xs text-slate-600 mt-1">📋 {mb.purpose}</p>}
                                                                <p className="text-xs text-slate-400 mt-1">
                                                                    {mb.start_time.slice(0, 5)} – {mb.end_time.slice(0, 5)}
                                                                </p>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Legend */}
                                <div className="flex gap-4 mt-3 justify-center">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-emerald-200 border border-emerald-300" />
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Available</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-rose-200 border border-rose-300" />
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Booked</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-slate-200 border border-slate-300" />
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Past</span>
                                    </div>
                                </div>
                            </div>

                            {/* Selected range summary */}
                            {totalSelectedHoures > 0 && (
                                <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl">
                                    <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">Reservation Summary</p>
                                    <p className="text-xl font-black text-slate-900">
                                        {selectedDates.length} date(s)
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {totalSelectedHoures} total hour(s) selected
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Attendees</label>
                                <p className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Max capacity: {room.capacity} people</p>
                                <input
                                    type="number"
                                    min="1"
                                    max={room.capacity}
                                    value={attendees}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === '') {
                                            setAttendees('');
                                        } else {
                                            setAttendees(parseInt(val) || 1);
                                        }
                                    }}
                                    required
                                    className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary bg-slate-50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Purpose</label>
                                <textarea rows={2} value={purpose} onChange={e => setPurpose(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary bg-slate-50" placeholder="Meeting purpose..." />
                            </div>
                            <button
                                type="submit"
                                disabled={submitting || totalSelectedHoures === 0 || (room && Number(attendees) > room.capacity) || selectedDates.length === 0}
                                className="w-full py-4 bg-secondary hover:bg-secondary-dark text-white text-lg font-bold rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Booking...' : (room && Number(attendees) > room.capacity) ? 'Capacity Exceeded' : totalSelectedHoures === 0 ? 'Select a time slot' : 'Book This Space'}
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <h3 className="font-semibold text-slate-900 mb-3">Location Details</h3>
                            <p className="text-sm text-slate-600">{room.location} — Floor {room.floor_no}, Room {room.room_number}</p>
                        </div>
                    </div>
                </div>
            </div>

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
        </div>
    );
};

export default RoomDetailsPage;
