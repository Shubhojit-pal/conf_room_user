import {
    CaretLeft,
    CaretRight,
    X,
    CalendarBlank,
    CaretDown,
    Lock,
    Eye,
    Funnel
} from '@phosphor-icons/react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { fetchAllBookings, getCurrentUser, Booking, fetchRooms, createBooking, Room, fetchRoomAvailability, BookedSlot } from '../lib/api';
import LoginPage from './LoginPage';


interface CalendarPageProps {
    onPreviewTicket?: () => void;
}

type ViewType = 'day' | 'week' | 'month';

interface BookingEvent {
    id: string;
    date: string;
    room: string;
    bookedBy: string;
    duration: string;
    location?: string;
    timeSlot?: string;
    purpose: string;
    status: 'booked' | 'available';
    capacity: number;
    selectedSlots?: string;
    selectedDates?: string;
}

const CalendarPage: React.FC<CalendarPageProps> = () => {
    // State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewType, setViewType] = useState<ViewType>('month');
    const [isViewOpen, setIsViewOpen] = useState(false);
    const viewRef = useRef<HTMLDivElement | null>(null);
    const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);
    const [hoveredBooking, setHoveredBooking] = useState<BookingEvent | null>(null);
    const [activeDateOptions, setActiveDateOptions] = useState<string | null>(null);
    const [detailDate, setDetailDate] = useState<string | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [activeDate, setActiveDate] = useState<string | null>(null);
    const [dateSlots, setDateSlots] = useState<Record<string, number[]>>({});

    // Applied filters (used for actual filtering)
    const [filterLocation, setFilterLocation] = useState('all');
    const [filterTimeSlot, setFilterTimeSlot] = useState('all');
    const [tempLocation, setTempLocation] = useState('all');
    const [tempTimeSlot, setTempTimeSlot] = useState('all');

    // State for Mobile Filter Modal
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

    // Real booking data from API
    const [bookingEvents, setBookingEvents] = useState<BookingEvent[]>([]);
    const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Real-time availability for selected room
    const [roomBookedSlots, setRoomBookedSlots] = useState<BookedSlot[]>([]);
    const [, setNow] = useState(new Date()); // force re-render every minute

    const loadData = async () => {
        const user = getCurrentUser();
        if (!user) return;
        try {
            const [bookings, rooms] = await Promise.all([
                fetchAllBookings(),
                fetchRooms()
            ]);

            setAvailableRooms(rooms);

            const expanded: BookingEvent[] = [];
            bookings
                .filter((b: Booking) => b.status !== 'cancelled' && b.status !== 'rejected')
                .forEach((b: Booking) => {
                    const dates = b.selected_dates ? b.selected_dates.split(',').map(d => d.trim()) : [b.start_date.slice(0, 10)];
                    dates.forEach(date => {
                        expanded.push({
                            id: b.booking_id,
                            date: date,
                            room: b.room_name || b.room_id,
                            location: b.location || '',
                            timeSlot: `${b.start_time.slice(0, 5)} - ${b.end_time.slice(0, 5)}`,
                            bookedBy: b.user_name || user.name,
                            duration: '',
                            purpose: b.purpose || '',
                            status: 'booked' as BookingEvent['status'],
                            capacity: 0,
                            selectedSlots: b.selected_slots,
                            selectedDates: b.selected_dates
                        });
                    });
                });
            setBookingEvents(expanded);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Auto-refresh every 60 seconds to update past-time slot status
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const handleConfirmBooking = async () => {
        const user = getCurrentUser();
        if (!user || !formData.room || selectedDates.length === 0) {
            alert('Please select a room and date(s).');
            return;
        }

        // Verify all dates have slots
        const perDateChoices = selectedDates.map(date => {
            const slots = dateSlots[date] || [];
            if (slots.length === 0) return null;
            const daySlots = slots.map(i => `${ALL_SLOTS[i].start}-${ALL_SLOTS[i].end}`);
            return { date, slots: daySlots };
        }).filter(Boolean) as { date: string, slots: string[] }[];

        if (perDateChoices.length !== selectedDates.length) {
            alert('Please select time slots for all selected dates.');
            return;
        }

        setIsSubmitting(true);
        try {
            // Find selected room object
            const roomObj = availableRooms.find(r => `${r.catalog_id}:${r.room_id}` === formData.room);
            if (!roomObj) throw new Error('Selected room not found');

            const attendeesCount = parseInt(formData.attendees) || 1;
            if (attendeesCount > roomObj.capacity) {
                alert(`Attendees cannot exceed room capacity (${roomObj.capacity} people).`);
                setIsSubmitting(false);
                return;
            }

            await createBooking({
                uid: user.uid,
                catalog_id: roomObj.catalog_id,
                room_id: roomObj.room_id,
                purpose: formData.purpose,
                attendees: attendeesCount,
                per_date_choices: perDateChoices
            });

            alert(`Booking confirmed for ${perDateChoices.length} date(s)!`);
            setIsModalOpen(false);
            setDateSlots({});
            setActiveDate(null);
            setSelectedDates([]);
            setFormData({ room: '', attendees: '1', purpose: '' });
            await loadData(); // Refresh calendar immediately
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };


    // Modal Form State
    const [formData, setFormData] = useState({
        room: '',
        attendees: '1',
        purpose: '',
    });

    // Fetch real-time availability for the selected room + date
    const loadRoomAvailability = useCallback(async () => {
        if (!formData.room || !activeDate) {
            setRoomBookedSlots([]);
            return;
        }
        const [catalog_id, room_id] = formData.room.split(':');
        try {
            const slots = await fetchRoomAvailability(catalog_id, room_id, activeDate);
            setRoomBookedSlots(slots);
        } catch (e) {
            console.error('Failed to fetch room availability:', e);
            setRoomBookedSlots([]);
        }
    }, [formData.room, activeDate]);

    useEffect(() => {
        loadRoomAvailability();
    }, [loadRoomAvailability]);


    // Calendar Helpers
    const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const isPastDate = (dateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(dateStr);
        targetDate.setHours(0, 0, 0, 0);
        return targetDate < today;
    };

    const isPastDateTime = (dateStr: string, hour: number) => {
        const now = new Date();
        const targetDate = new Date(dateStr);
        targetDate.setHours(hour, 0, 0, 0);
        return targetDate < now;
    };

    const formatDate = (year: number, month: number, day: number) => {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const handleDateClick = (day: number) => {
        const dateStr = formatDate(currentDate.getFullYear(), currentDate.getMonth(), day);
        setSelectedDates(prev => {
            const isSelected = prev.includes(dateStr);
            if (isSelected) {
                const updated = prev.filter(d => d !== dateStr);
                if (activeDate === dateStr) setActiveDate(updated[0] || null);
                return updated;
            } else {
                const updated = [...prev, dateStr].sort();
                if (!activeDate) setActiveDate(dateStr);
                return updated;
            }
        });
    };

    // Slot range helpers
    const getCalendarSlotStatus = (slot: { startH: number }) => {
        if (!activeDate) return 'available';
        const todayStr = new Date().toISOString().slice(0, 10);
        const now = new Date();
        const isToday = activeDate === todayStr;
        if (isToday && slot.startH <= now.getHours()) return 'past';
        const isBooked = roomBookedSlots.some(b => {
            const bStartH = parseInt(b.start_time.split(':')[0]);
            const bEndH = parseInt(b.end_time.split(':')[0]);
            return slot.startH >= bStartH && slot.startH < bEndH;
        });
        if (isBooked) return 'booked';
        return 'available';
    };

    const isCalendarSlotSelected = (index: number) => {
        if (!activeDate) return false;
        const slots = dateSlots[activeDate] || [];
        return slots.includes(index);
    };

    const handleCalendarSlotClick = (index: number) => {
        if (!activeDate) return;
        setDateSlots(prev => {
            const current = prev[activeDate!] || [];
            let next: number[];

            if (current.includes(index)) {
                // Deselect
                next = current.filter(i => i !== index);
            } else {
                // Select and maintain chronological order
                next = [...current, index].sort((a, b) => a - b);
            }

            return { ...prev, [activeDate!]: next };
        });
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // ALL_SLOTS for 9 AM - 6 PM (matches RoomDetailsPage)
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




    const getBookingsForDate = (date: string): BookingEvent[] => {
        return bookingEvents.filter(event => {
            if (event.date !== date) return false;

            if (filterLocation !== 'all' && event.location !== filterLocation) {
                return false;
            }

            if (filterTimeSlot !== 'all') {
                if (event.selectedSlots) {
                    const hasSlot = event.selectedSlots.split(',').some(s => s.startsWith(filterTimeSlot));
                    if (!hasSlot) return false;
                } else {
                    const eventStartStr = (event.timeSlot?.split(' - ')[0] || '') + ':00';
                    if (eventStartStr !== filterTimeSlot) return false;
                }
            }

            return true;
        });
    };

    const getDateStatus = (date: string): 'booked' | 'available' => {
        const bookings = getBookingsForDate(date);
        if (bookings.length === 0) return 'available';
        return 'booked';
    };

    // Get the start of the current week (Sunday)
    const getWeekStart = (date: Date): Date => {
        const d = new Date(date);
        d.setDate(d.getDate() - d.getDay());
        return d;
    };

    // Get all days in the current week
    const getWeekDays = (date: Date): Date[] => {
        const start = getWeekStart(date);
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            return d;
        });
    };

    // Format date to YYYY-MM-DD
    const dateToString = (date: Date): string => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    // Navigate to previous/next period based on view
    const handlePrevious = () => {
        const newDate = new Date(currentDate);
        if (viewType === 'month') {
            newDate.setMonth(newDate.getMonth() - 1);
        } else if (viewType === 'week') {
            newDate.setDate(newDate.getDate() - 7);
        } else {
            newDate.setDate(newDate.getDate() - 1);
        }
        setCurrentDate(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(currentDate);
        if (viewType === 'month') {
            newDate.setMonth(newDate.getMonth() + 1);
        } else if (viewType === 'week') {
            newDate.setDate(newDate.getDate() + 7);
        } else {
            newDate.setDate(newDate.getDate() + 1);
        }
        setCurrentDate(newDate);
    };

    // Close view dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (viewRef.current && !viewRef.current.contains(e.target as Node)) {
                setIsViewOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 relative pb-24 md:pb-8">
            {/* Header Section */}
            <div className="flex justify-between items-end mb-4 sm:mb-8">
                <div>
                    <h1 className="text-xl sm:text-3xl font-bold text-slate-900 bg-gradient-to-r from-violet-700 to-indigo-600 bg-clip-text text-transparent">Booking Calendar</h1>
                    <p className="text-slate-500 mt-1 text-sm sm:text-base">View and manage bookings</p>
                </div>
            </div>

            {/* ── DESKTOP: Filters ── */}
            <div className="hidden md:block bg-white border border-slate-200 rounded-xl p-3 sm:p-5 mb-4 sm:mb-6 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">Filter by Location</label>
                        <select
                            className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary text-slate-700"
                            value={tempLocation}
                            onChange={e => setTempLocation(e.target.value)}
                        >
                            <option value="all">All Locations</option>
                            {[...new Set(availableRooms.map(r => r.location).filter(Boolean))].map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">Filter by Time Slot</label>
                        <select
                            className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary text-slate-700"
                            value={tempTimeSlot}
                            onChange={e => setTempTimeSlot(e.target.value)}
                        >
                            <option value="all">All Time Slots</option>
                            {ALL_SLOTS.map(s => (
                                <option key={s.start} value={s.start}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        {(filterLocation !== 'all' || filterTimeSlot !== 'all') && (
                            <span className="inline-flex items-center gap-1 bg-primary/10 text-primary font-semibold px-2 py-1 rounded-full">
                                ✓ Filters active
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                setTempLocation('all');
                                setTempTimeSlot('all');
                                setFilterLocation('all');
                                setFilterTimeSlot('all');
                            }}
                            className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                        >
                            Reset
                        </button>
                        <button
                            onClick={() => {
                                setFilterLocation(tempLocation);
                                setFilterTimeSlot(tempTimeSlot);
                            }}
                            className="text-sm bg-primary hover:bg-primary-dark text-white font-bold px-6 py-2 rounded-lg transition-colors shadow-sm shadow-primary/20"
                        >
                            Apply Filter
                        </button>
                    </div>
                </div>
            </div>

            {/* ── MOBILE: Floating Action Button (FAB) for Filters ── */}
            <button
                className="md:hidden fixed bottom-[90px] right-6 z-[60] bg-primary text-white p-4 rounded-full shadow-lg shadow-primary/30 active:scale-95 transition-transform"
                onClick={() => setIsMobileFilterOpen(true)}
            >
                <div className="relative">
                    <Funnel size={26} weight="fill" />
                    {(filterLocation !== 'all' || filterTimeSlot !== 'all') && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-orange opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-accent-orange border-2 border-primary"></span>
                        </span>
                    )}
                </div>
            </button>

            {/* ── MOBILE: Filter Modal ── */}
            {isMobileFilterOpen && (
                <div className="md:hidden fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-end justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-8 duration-300">
                        <button
                            onClick={() => setIsMobileFilterOpen(false)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full"
                        >
                            <X size={20} weight="bold" />
                        </button>
                        
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-primary-light text-primary">
                                <Funnel size={24} weight="fill" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Filter Calendar</h3>
                        </div>

                        <div className="flex flex-col gap-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Location</label>
                                <select
                                    className="w-full p-3.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary bg-slate-50 font-medium"
                                    value={tempLocation}
                                    onChange={e => setTempLocation(e.target.value)}
                                >
                                    <option value="all">All Locations</option>
                                    {[...new Set(availableRooms.map(r => r.location).filter(Boolean))].map(loc => (
                                        <option key={loc} value={loc}>{loc}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Time Slot</label>
                                <select
                                    className="w-full p-3.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary bg-slate-50 font-medium"
                                    value={tempTimeSlot}
                                    onChange={e => setTempTimeSlot(e.target.value)}
                                >
                                    <option value="all">All Time Slots</option>
                                    {ALL_SLOTS.map(s => (
                                        <option key={s.start} value={s.start}>{s.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 mt-2">
                                <button
                                    onClick={() => {
                                        setTempLocation('all');
                                        setTempTimeSlot('all');
                                        setFilterLocation('all');
                                        setFilterTimeSlot('all');
                                        setIsMobileFilterOpen(false);
                                    }}
                                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl active:scale-[0.98] transition-transform"
                                >
                                    Reset
                                </button>
                                <button 
                                    onClick={() => {
                                        setFilterLocation(tempLocation);
                                        setFilterTimeSlot(tempTimeSlot);
                                        setIsMobileFilterOpen(false);
                                    }}
                                    className="flex-[2] bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-transform active:scale-[0.98]"
                                >
                                    Apply Filters
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Book Now Banner */}
            {selectedDates.length > 0 && (
                <div className="bg-primary-light border border-primary rounded-xl px-6 py-4 mb-6 flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-primary font-bold text-sm">{selectedDates.length} date{selectedDates.length > 1 ? 's' : ''} selected</p>
                        <p className="text-primary/70 text-xs mt-0.5">{selectedDates.sort().join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSelectedDates([])}
                            className="text-sm text-primary/70 hover:text-primary font-medium transition-colors"
                        >
                            Clear
                        </button>
                        <button
                            onClick={() => { setIsModalOpen(true); }}
                            className="bg-primary hover:bg-primary-dark text-white font-bold px-6 py-2.5 rounded-lg transition-colors shadow-md shadow-primary/20"
                        >
                            Book Now
                        </button>
                    </div>
                </div>
            )}

            {/* Detail modal for single-date timeline */}
            {isDetailOpen && detailDate && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40" onClick={() => setIsDetailOpen(false)}></div>
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative z-10 shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Details for {detailDate}</h3>
                            <button onClick={() => setIsDetailOpen(false)} className="text-slate-500">Close</button>
                        </div>

                        <div className="space-y-2">
                            {ALL_SLOTS.map((slot, idx) => {
                                const slotLabel = slot.label;
                                const bookings = getBookingsForDate(detailDate).filter(b => {
                                    if (b.selectedSlots) {
                                        const slotsArray = b.selectedSlots.split(',');
                                        return slotsArray.some(s => {
                                            const [bStart, bEnd] = s.split('-').map(part => part.slice(0, 5));
                                            return bStart === slot.start.slice(0, 5) && bEnd === slot.end.slice(0, 5);
                                        });
                                    }
                                    const ts = b.timeSlot || '';
                                    // Fallback for legacy
                                    const parts = ts.split(' - ');
                                    if (parts.length < 2) return false;
                                    const bStartH = parseInt(parts[0].split(':')[0]);
                                    const bEndH = parseInt(parts[1].split(':')[0]);
                                    return slot.startH >= bStartH && slot.startH < bEndH;
                                });
                                const booked = bookings.length > 0;
                                const booking = bookings[0];
                                return (
                                    <div key={idx} className={`p-3 rounded-lg border flex justify-between items-center ${booked ? 'bg-green-50 border-green-300' : 'bg-blue-50 border-blue-200'}`}>
                                        <div>
                                            <div className="text-sm font-semibold">{slotLabel}</div>
                                            {booked && booking && <div className="text-xs text-slate-600">{booking.room} — {booking.bookedBy}</div>}
                                        </div>
                                        <div>
                                            {booked ? (
                                                <div className="text-xs text-green-700 px-2 py-1 rounded">Booked</div>
                                            ) : (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsDetailOpen(false);
                                                        if (detailDate) {
                                                            setDateSlots({ [detailDate]: [idx] });
                                                            setActiveDate(detailDate);
                                                            setSelectedDates([detailDate]);
                                                        }
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="text-xs bg-primary text-white px-3 py-1 rounded"
                                                >
                                                    Book Now
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Calendar Grid */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-6 lg:p-8">
                {/* Calendar Header with View Options */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-8 gap-3">
                    <div>
                        <h2 className="text-lg sm:text-2xl font-bold text-slate-800">
                            {viewType === 'month'
                                ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                                : viewType === 'week'
                                    ? `Week of ${monthNames[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`
                                    : `${monthNames[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`
                            }
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* View Dropdown */}
                        <div className="relative" ref={viewRef}>
                            <button
                                onClick={() => setIsViewOpen(prev => !prev)}
                                className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2.5 rounded-lg text-slate-700 font-medium hover:border-primary hover:text-primary transition-colors"
                            >
                                <span className="capitalize">{viewType} View</span>
                                <CaretDown size={16} />
                            </button>
                            {isViewOpen && (
                                <div className="absolute top-full mt-1 right-0 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-10">
                                    {(['day', 'week', 'month'] as ViewType[]).map((view) => (
                                        <button
                                            key={view}
                                            onClick={() => { setViewType(view); setIsViewOpen(false); }}
                                            className={`w-full text-left px-4 py-2.5 capitalize transition-colors ${viewType === view
                                                ? 'bg-primary-light text-primary font-semibold'
                                                : 'hover:bg-slate-50'
                                                }`}
                                        >
                                            {view} View
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Navigation Buttons */}
                        <div className="flex gap-2">
                            <button onClick={handlePrevious} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                                <CaretLeft size={20} />
                            </button>
                            <button onClick={handleNext} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                                <CaretRight size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex gap-3 sm:gap-6 mb-4 sm:mb-8 pb-4 sm:pb-6 border-b border-slate-200 overflow-x-auto">
                    <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-100 border-2 border-green-500 rounded"></div>
                        <span className="text-xs sm:text-sm text-slate-600 whitespace-nowrap">Booked</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 bg-indigo-100 border-2 border-indigo-400 rounded"></div>
                        <span className="text-xs sm:text-sm text-slate-600 whitespace-nowrap">Available</span>
                    </div>
                </div>

                {/* MONTH VIEW */}
                {viewType === 'month' && (
                    <div className="month-view">
                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-1 sm:gap-2 lg:gap-4">
                            {/* Empty cells for start padding */}
                            {Array.from({ length: getFirstDayOfMonth(currentDate) }).map((_, i) => (
                                <div key={`empty-${i}`} className="aspect-square"></div>
                            ))}

                            {/* Active cells */}
                            {Array.from({ length: getDaysInMonth(currentDate) }).map((_, i) => {
                                const day = i + 1;
                                const dateStr = formatDate(currentDate.getFullYear(), currentDate.getMonth(), day);
                                const status = getDateStatus(dateStr);
                                const dayBookings = getBookingsForDate(dateStr);
                                const isSelected = selectedDates.includes(dateStr);
                                const isPast = isPastDate(dateStr);
                                void 0; // suppress lint — isSelected used below

                                const statusColors = {
                                    booked: 'bg-green-100 border-green-400',
                                    available: 'bg-blue-50 border-blue-300'
                                };

                                return (
                                    <div
                                        key={day}
                                        className={`relative ${isPast ? '' : 'group'}`}
                                        onMouseEnter={() => {
                                            if (isPast) return;
                                            if (dayBookings.length > 0) setHoveredBooking(dayBookings[0]);
                                            setHoveredDate(dateStr);
                                            setActiveDateOptions(dateStr);
                                        }}
                                        onMouseLeave={() => {
                                            setHoveredBooking(null);
                                            setHoveredDate(null);
                                            setActiveDateOptions(null);
                                        }}
                                    >
                                        <div
                                            onClick={() => {
                                                if (isPast) return;
                                                // Toggle date selection for multi-date booking
                                                handleDateClick(day);
                                            }}
                                            className={`
                                                aspect-[4/3] rounded-lg sm:rounded-xl border-2 flex flex-col p-1 sm:p-2 lg:p-3 transition-all hover:shadow-md
                                                ${isPast
                                                    ? 'bg-slate-100/50 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                                                    : isSelected
                                                        ? 'bg-indigo-50 border-indigo-500 ring-1 sm:ring-2 ring-indigo-300/60 cursor-pointer shadow-md'
                                                        : `${statusColors[status]} cursor-pointer`
                                                }
                                            `}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className={`font-bold text-xs sm:text-sm lg:text-base ${isPast ? 'text-slate-400' : isSelected ? 'text-indigo-700' : 'text-slate-800'}`}>{day}</span>
                                                {isSelected && (
                                                    <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                                        <span className="text-white text-[8px] font-black">✓</span>
                                                    </span>
                                                )}
                                            </div>
                                            {dayBookings.length > 0 && (
                                                <div className="mt-0.5 hidden sm:block">
                                                    <span className={`text-[10px] block truncate ${isPast ? 'text-slate-400' : 'text-slate-600'}`}>
                                                        {dayBookings[0].room.split(' ')[0]}
                                                    </span>
                                                    {dayBookings[0].timeSlot && (
                                                        <span className="text-[9px] text-slate-500 block mt-0.5 hidden lg:block">{dayBookings[0].timeSlot}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Hover Tooltip for Booked */}
                                        {hoveredBooking && hoveredDate === dateStr && (dayBookings.length > 0) && !isPast && (
                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg z-20 whitespace-nowrap pointer-events-none">
                                                <p className="font-semibold text-sm">{hoveredBooking.room}</p>
                                                <p className="text-xs text-slate-300">Booked by: {hoveredBooking.bookedBy}</p>
                                                {hoveredBooking.timeSlot && (
                                                    <p className="text-xs text-slate-300">Time: {hoveredBooking.timeSlot}</p>
                                                )}
                                                <p className="text-xs text-slate-300">Purpose: {hoveredBooking.purpose}</p>
                                                <p className={`text-xs font-semibold mt-1 ${hoveredBooking.status === 'booked' ? 'text-green-400' : 'text-yellow-400'}`}>
                                                <p className={`text-xs font-semibold mt-1 text-green-400`}>Confirmed</p>
                                                </p>
                                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-slate-900"></div>
                                            </div>
                                        )}

                                        {/* Details button shown on hover */}
                                        {activeDateOptions === dateStr && !isPast && dayBookings.length > 0 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDetailDate(dateStr);
                                                    setIsDetailOpen(true);
                                                    setActiveDateOptions(null);
                                                }}
                                                className="absolute top-2 right-2 z-30 bg-white/90 border border-slate-200 text-slate-600 hover:text-primary hover:border-primary text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-sm transition-colors"
                                            >
                                                Details
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* WEEK VIEW */}
                {viewType === 'week' && (
                    <div className="week-view">

                        {/* ── MOBILE: Compact Weekly Grid ─────────────────── */}
                        <div className="md:hidden bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[65vh] min-h-[400px]">
                            {/* Header: Days */}
                            <div className="flex border-b border-slate-200 bg-slate-50 shrink-0 shadow-sm z-10">
                                <div className="w-10 shrink-0 border-r border-slate-100 flex items-center justify-center bg-white">
                                    <CalendarBlank size={16} className="text-slate-300" weight="fill" />
                                </div>
                                {getWeekDays(currentDate).map((date) => {
                                    const dateStr = dateToString(date);
                                    const isToday = dateStr === dateToString(new Date());
                                    const dayName = ['S','M','T','W','T','F','S'][date.getDay()];
                                    return (
                                        <div key={dateStr} className={`flex-1 flex flex-col items-center justify-center py-2 border-r border-slate-100 last:border-0 ${isToday ? 'bg-primary/5' : ''}`}>
                                            <span className={`text-[9px] font-bold uppercase ${isToday ? 'text-primary' : 'text-slate-400'}`}>{dayName}</span>
                                            <span className={`text-xs font-black mt-0.5 flex items-center justify-center w-5 h-5 rounded-full ${isToday ? 'bg-primary text-white shadow-sm shadow-primary/30' : 'text-slate-700'}`}>
                                                {date.getDate()}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Body: Time slots grid */}
                            <div className="flex-1 overflow-y-auto overscroll-contain pb-4">
                                {ALL_SLOTS.map((slot, slotIdx) => (
                                    <div key={slotIdx} className="flex border-b border-slate-100 min-h-[48px]">
                                        {/* Time Label */}
                                        <div className="w-10 shrink-0 border-r border-slate-100 bg-slate-50/50 flex flex-col items-center pt-1.5">
                                            <span className="text-[9px] font-bold text-slate-400 tracking-tighter">{slot.start.slice(0,5)}</span>
                                        </div>
                                        {/* 7 Days Columns */}
                                        {getWeekDays(currentDate).map((date) => {
                                            const dateStr = dateToString(date);
                                            const isToday = dateStr === dateToString(new Date());
                                            const isPastHour = isPastDateTime(dateStr, slot.startH);
                                            
                                            const cellBookings = getBookingsForDate(dateStr).filter(b => {
                                                const ts = b.timeSlot || '';
                                                const parts = ts.split(' - ');
                                                if (parts.length < 2) return false;
                                                const bStartH = parseInt(parts[0].split(':')[0]);
                                                const bEndH = parseInt(parts[1].split(':')[0]);
                                                return slot.startH >= bStartH && slot.startH < bEndH;
                                            });
                                            const hasBooking = cellBookings.length > 0;

                                            return (
                                                <div 
                                                    key={`${dateStr}-${slotIdx}`}
                                                    className={`flex-1 border-r border-slate-100 last:border-0 relative p-[1.5px] transition-colors
                                                        ${isToday ? 'bg-primary/[0.02]' : ''}
                                                        ${isPastHour ? 'bg-slate-50/80' : !hasBooking ? 'active:bg-primary/10 cursor-pointer' : ''}
                                                    `}
                                                    onClick={() => {
                                                        if (isPastHour || hasBooking) return;
                                                        setDateSlots({ [dateStr]: [slotIdx] });
                                                        setActiveDate(dateStr);
                                                        setSelectedDates([dateStr]);
                                                        setIsModalOpen(true);
                                                    }}
                                                >
                                                    {hasBooking && cellBookings.map((b, i) => (
                                                        <div 
                                                            key={b.id + i}
                                                            className={`absolute inset-[1.5px] rounded-[4px] border shadow-sm flex items-center justify-center p-0.5 overflow-hidden 
                                                                ${b.status === 'booked' ? 'bg-emerald-100 border-emerald-300' : 'bg-amber-100 border-amber-300'}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDetailDate(dateStr);
                                                                setIsDetailOpen(true);
                                                            }}
                                                        >
                                                            <div className={`text-[7px] font-bold leading-tight text-center truncate w-full ${b.status === 'booked' ? 'text-emerald-800' : 'text-amber-800'}`}>
                                                                {b.room.split(' ')[0]} {/* Show first word to fit better */}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── DESKTOP: Time grid layout ───────────────────── */}
                        <div className="hidden md:block overflow-x-auto">
                            <div className="min-w-[700px]">
                                {/* Day / Date Header row */}
                                <div className="flex">
                                    <div className="w-24 shrink-0" />
                                    {getWeekDays(currentDate).map((date) => {
                                        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
                                        const isToday = dateToString(date) === dateToString(new Date());
                                        const isPast = isPastDate(dateToString(date));
                                        return (
                                            <div
                                                key={dateToString(date)}
                                                className={`flex-1 text-center py-3 px-1 border-b-2 ${isToday
                                                    ? 'border-primary bg-primary/5'
                                                    : isPast
                                                        ? 'border-slate-200 bg-slate-50/50'
                                                        : 'border-slate-200'
                                                    }`}
                                            >
                                                <p className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? 'text-primary' : 'text-slate-400'}`}>{dayName}</p>
                                                <p className={`text-xl font-black mt-0.5 ${isToday
                                                    ? 'bg-primary text-white w-9 h-9 rounded-full flex items-center justify-center mx-auto'
                                                    : isPast ? 'text-slate-300' : 'text-slate-800'
                                                    }`}>{date.getDate()}</p>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Time rows */}
                                {ALL_SLOTS.map((slot, slotIdx) => {
                                    return (
                                        <div key={slotIdx} className="flex border-t border-slate-100 group/row hover:bg-slate-50/50 transition-colors">
                                            <div className="w-24 shrink-0 pt-2 pr-3 text-right">
                                                <span className="text-[11px] font-semibold text-slate-400">{slot.label}</span>
                                            </div>
                                            {getWeekDays(currentDate).map((date) => {
                                                const dateStr = dateToString(date);
                                                const isPastHour = isPastDateTime(dateStr, slot.startH);
                                                const isToday = dateToString(date) === dateToString(new Date());
                                                const cellBookings = getBookingsForDate(dateStr).filter(b => {
                                                    const ts = b.timeSlot || '';
                                                    const parts = ts.split(' - ');
                                                    if (parts.length < 2) return false;
                                                    const bStartH = parseInt(parts[0].split(':')[0]);
                                                    const bEndH = parseInt(parts[1].split(':')[0]);
                                                    return slot.startH >= bStartH && slot.startH < bEndH;
                                                });
                                                const hasBooking = cellBookings.length > 0;
                                                const booking = cellBookings[0];
                                                return (
                                                    <div
                                                        key={`${dateStr}-${slotIdx}`}
                                                        className={`flex-1 min-h-[52px] relative border-l border-slate-100 p-1 transition-colors
                                                            ${isToday ? 'bg-primary/[0.03]' : ''}
                                                            ${isPastHour ? 'bg-slate-50 opacity-60' : !hasBooking ? 'cursor-pointer hover:bg-primary/5' : ''}
                                                        `}
                                                        onClick={() => {
                                                            if (isPastHour || hasBooking) return;
                                                            setDateSlots({ [dateStr]: [slotIdx] });
                                                            setActiveDate(dateStr);
                                                            setIsModalOpen(true);
                                                            setSelectedDates([dateStr]);
                                                        }}
                                                    >
                                                        {hasBooking && booking && (
                                                            <div
                                                                className={`h-full min-h-[44px] rounded-lg px-2 py-1.5 border-l-4 cursor-pointer
                                                                    ${booking.status === 'booked'
                                                                        ? 'bg-green-50 border-green-500 hover:bg-green-100'
                                                                        : 'bg-yellow-50 border-yellow-500 hover:bg-yellow-100'
                                                                    }`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDetailDate(dateStr);
                                                                    setIsDetailOpen(true);
                                                                }}
                                                            >
                                                                <p className={`text-[10px] font-black truncate ${booking.status === 'booked' ? 'text-green-700' : 'text-yellow-700'}`}>
                                                                    {booking.room}
                                                                </p>
                                                                {booking.purpose && (
                                                                    <p className="text-[9px] text-slate-500 truncate mt-0.5">{booking.purpose}</p>
                                                                )}
                                                                <p className="text-[9px] text-slate-400 truncate mt-0.5">👤 {booking.bookedBy}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}


                {/* DAY VIEW */}
                {viewType === 'day' && (() => {
                    const dateStr = dateToString(currentDate);
                    const isPastDay = isPastDate(dateStr);
                    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDate.getDay()];
                    const now = new Date();
                    const isToday = dateStr === dateToString(now);
                    const currentHour = now.getHours();

                    return (
                        <div className="day-view">
                            {/* Day Header */}
                            <div className={`p-5 rounded-xl mb-6 border-2 flex items-center justify-between
                                ${isPastDay
                                    ? 'bg-slate-50 border-slate-200'
                                    : isToday
                                        ? 'bg-gradient-to-r from-primary/10 to-primary/5 border-primary'
                                        : 'bg-gradient-to-r from-primary-light to-primary/5 border-primary/40'
                                }`}
                            >
                                <div>
                                    <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isPastDay ? 'text-slate-400' : 'text-primary'}`}>{dayOfWeek}</p>
                                    <h3 className={`text-2xl font-black ${isPastDay ? 'text-slate-400' : 'text-slate-800'}`}>
                                        {monthNames[currentDate.getMonth()]} {currentDate.getDate()}, {currentDate.getFullYear()}
                                    </h3>
                                    {isToday && <p className="text-xs text-primary font-semibold mt-1">Today</p>}
                                </div>
                                {isPastDay && (
                                    <div className="bg-slate-200 text-slate-500 text-xs font-bold px-3 py-1.5 rounded-full">Past Day — Read Only</div>
                                )}
                            </div>

                            {/* Timeline */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                {ALL_SLOTS.map((slot, slotIdx) => {
                                    const isPastHour = isPastDay || isPastDateTime(dateStr, slot.startH);
                                    const isCurrentHour = isToday && currentHour === slot.startH;

                                    // Bookings that cover this exact slot hour
                                    const slotBookings = getBookingsForDate(dateStr).filter(b => {
                                        const ts = b.timeSlot || '';
                                        const parts = ts.split(' - ');
                                        if (parts.length < 2) return false;
                                        const bStartH = parseInt(parts[0].split(':')[0]);
                                        const bEndH = parseInt(parts[1].split(':')[0]);
                                        return slot.startH >= bStartH && slot.startH < bEndH;
                                    });
                                    const hasBooking = slotBookings.length > 0;

                                    return (
                                        <div
                                            key={slotIdx}
                                            className={`flex gap-0 border-t border-slate-100 first:border-t-0 transition-colors
                                                ${isCurrentHour ? 'bg-primary/5 border-l-4 border-l-primary' : ''}
                                                ${isPastHour && !isCurrentHour ? 'bg-slate-50/70' : ''}
                                                ${!isPastHour && !hasBooking ? 'hover:bg-primary/3 cursor-pointer' : ''}
                                            `}
                                            onClick={() => {
                                                if (isPastHour || hasBooking) return;
                                                setDateSlots({ [dateStr]: [slotIdx] });
                                                setActiveDate(dateStr);
                                                setIsModalOpen(true);
                                                setSelectedDates([dateStr]);
                                            }}
                                        >
                                            {/* Time label */}
                                            <div className={`w-28 shrink-0 py-4 px-4 flex flex-col justify-center border-r border-slate-100
                                                ${isCurrentHour ? 'bg-primary/10' : isPastHour ? 'bg-slate-50' : 'bg-white'}
                                            `}>
                                                <span className={`text-sm font-black ${isCurrentHour ? 'text-primary' : isPastHour ? 'text-slate-300' : 'text-slate-600'}`}>
                                                    {slot.label}
                                                </span>
                                                {isCurrentHour && (
                                                    <span className="text-[10px] text-primary font-bold mt-0.5">Now</span>
                                                )}
                                            </div>

                                            {/* Slot content */}
                                            <div className="flex-1 py-2 px-3 min-h-[64px] flex items-center">
                                                {hasBooking ? (
                                                    <div className="flex flex-col gap-2 w-full">
                                                        {slotBookings.map((booking) => (
                                                            <div
                                                                key={booking.id}
                                                                className={`rounded-lg border-l-4 p-3 cursor-pointer transition-all hover:shadow-md
                                                                    ${booking.status === 'booked'
                                                                        ? 'bg-green-50 border-green-500 hover:bg-green-100'
                                                                        : 'bg-yellow-50 border-yellow-500 hover:bg-yellow-100'
                                                                    }`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDetailDate(dateStr);
                                                                    setIsDetailOpen(true);
                                                                }}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <p className={`font-bold text-sm text-green-800`}>
                                                                        {booking.room}
                                                                    </p>
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-200 text-green-700`}>
                                                                        ✓ Confirmed
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-4 mt-1">
                                                                    {booking.timeSlot && <p className="text-xs text-slate-500">🕐 {booking.timeSlot}</p>}
                                                                    <p className="text-xs text-slate-500">👤 {booking.bookedBy}</p>
                                                                    {booking.purpose && <p className="text-xs text-slate-500 truncate">📋 {booking.purpose}</p>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : isPastHour ? (
                                                    <p className="text-xs text-slate-300 font-medium italic pl-1">Past</p>
                                                ) : (
                                                    <div className="flex items-center gap-2 opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity w-full justify-center py-2">
                                                        <span className="text-sm text-primary/60 font-semibold">+ Click to book this slot</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

            </div>

            {/* Booking Modal Overlay */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>

                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative z-10 shadow-2xl flex flex-col">

                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-20">
                            <h2 className="text-xl font-bold text-slate-900">Book Conference Room</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-6">
                            {/* Selected Dates Display */}
                            <div>
                                <label className="block text-sm font-medium text-slate-900 mb-2">Selected Dates</label>
                                <div className="flex flex-wrap gap-2">
                                    {selectedDates.map(date => (
                                        <div
                                            key={date}
                                            onClick={() => setActiveDate(date)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all border
                                                ${activeDate === date
                                                    ? 'bg-primary text-white border-primary shadow-md'
                                                    : 'bg-primary-light/50 text-primary-dark border-primary-light hover:bg-primary-light/80'}`}
                                        >
                                            <CalendarBlank size={16} />
                                            {date}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDateClick(parseInt(date.split('-')[2]));
                                                }}
                                                className={`ml-1 hover:text-red-500 ${activeDate === date ? 'text-white/70' : ''}`}
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Select Room */}
                            <div>
                                <label className="block text-sm font-medium text-slate-900 mb-2">Select Room</label>
                                <select
                                    className="w-full p-3 rounded-lg border border-slate-300 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
                                    value={formData.room}
                                    onChange={(e) => {
                                        setDateSlots({});
                                        setFormData({ ...formData, room: e.target.value });
                                    }}
                                >
                                    <option value="" disabled>Choose a room</option>
                                    {availableRooms.map(r => (
                                        <option key={`${r.catalog_id}:${r.room_id}`} value={`${r.catalog_id}:${r.room_id}`}>
                                            {r.room_name} ({r.capacity} people)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Time Slots */}
                            <div className={!activeDate ? 'opacity-50 pointer-events-none' : ''}>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-sm font-semibold text-slate-900">
                                        Select Time Slots {activeDate && <span className="text-primary font-black ml-1">for {activeDate}</span>}
                                    </label>
                                    {selectedDates.length > 1 && (
                                        <button
                                            onClick={() => {
                                                if (!activeDate) return;
                                                const currentSlots = dateSlots[activeDate] || [];

                                                setDateSlots(prev => {
                                                    const nextSlots = { ...prev };
                                                    selectedDates.forEach(d => {
                                                        // Ensure a deeply copied new array triggers React state changes
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
                                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                                    {ALL_SLOTS.map((slot, index) => {
                                        const status = getCalendarSlotStatus(slot);
                                        const selected = isCalendarSlotSelected(index);


                                        let classes = 'relative flex items-center justify-center px-2 py-3 rounded-xl text-[11px] font-bold transition-all border-2 ';

                                        // Find matching booking for tooltip
                                        const matchingBooking = roomBookedSlots.find(b => {
                                            const bStartH = parseInt(b.start_time.split(':')[0]);
                                            const bEndH = parseInt(b.end_time.split(':')[0]);
                                            return slot.startH >= bStartH && slot.startH < bEndH;
                                        });

                                        if (status === 'past') {
                                            classes += 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed line-through';
                                        } else if (status === 'booked') {
                                            classes += 'bg-rose-50 text-rose-300 border-rose-100 cursor-not-allowed';
                                        } else if (selected) {
                                            classes += 'bg-primary border-primary text-white shadow-md shadow-primary/20 scale-[0.98]';
                                        } else {
                                            classes += 'bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary cursor-pointer';
                                        }

                                        return (
                                            <button
                                                key={index}
                                                type="button"
                                                disabled={status === 'past'}
                                                title={status === 'booked' && matchingBooking ? `Booked by ${matchingBooking.user_name || 'someone'}: ${matchingBooking.purpose || ''}` : undefined}
                                                onClick={() => {
                                                    if (status === 'booked') return;
                                                    handleCalendarSlotClick(index);
                                                }}
                                                className={classes}
                                            >
                                                {status === 'booked' ? (
                                                    <div className="flex items-center justify-center w-full">
                                                        <Lock size={11} className="mr-1" />
                                                        <span>{slot.label}</span>
                                                        <div
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="ml-2 bg-white/20 p-1 rounded cursor-default pointer-events-auto transition-colors group relative"
                                                        >
                                                            <Eye size={14} className="text-rose-600 group-hover:text-rose-700 transition-colors" />
                                                            {matchingBooking && (
                                                                <div className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl text-white text-xs z-[100] text-left font-normal pointer-events-none">
                                                                    <p className="font-bold mb-1 border-b border-slate-700 pb-1">Booking Details</p>
                                                                    <p><span className="text-slate-400">By:</span> {matchingBooking.user_name || 'Unknown'}</p>
                                                                    <p className="mt-1"><span className="text-slate-400">Purpose:</span> {matchingBooking.purpose || 'None specified'}</p>
                                                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-r border-b border-slate-700"></div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : slot.label}

                                            </button>
                                        );
                                    })}
                                </div>
                                {/* Legend */}
                                <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block"></span>Available</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-300 inline-block"></span>Booked</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block"></span>Past</span>
                                </div>
                            </div>

                            {/* Attendees */}
                            <div>
                                <label className="block text-sm font-medium text-slate-900 mb-2">Number of Attendees</label>
                                {formData.room && (
                                    <p className="text-xs text-slate-400 mb-2">Max capacity for selected room: {availableRooms.find(r => `${r.catalog_id}:${r.room_id}` === formData.room)?.capacity} people</p>
                                )}
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full p-3 rounded-lg border border-slate-300 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                    value={formData.attendees}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '') {
                                            setFormData({ ...formData, attendees: '' });
                                        } else {
                                            setFormData({ ...formData, attendees: val });
                                        }
                                    }}
                                />
                            </div>

                            {/* Purpose */}
                            <div>
                                <label className="block text-sm font-medium text-slate-900 mb-2">Purpose of Booking</label>
                                <textarea
                                    className="w-full p-3 rounded-lg border border-slate-300 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary min-h-[100px]"
                                    value={formData.purpose}
                                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                    placeholder="Brief description of your meeting"
                                ></textarea>
                            </div>

                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 sticky bottom-0">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2.5 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                className={`px-8 py-2.5 rounded-lg font-bold shadow-lg transition-all active:scale-[0.98] 
                                    ${(isSubmitting || (!!formData.room && Number(formData.attendees) > (availableRooms.find(r => `${r.catalog_id}:${r.room_id}` === formData.room)?.capacity || 0)))
                                        ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
                                        : 'bg-primary hover:bg-primary-dark text-white shadow-teal-200/50'}`}
                                onClick={() => {
                                    const user = getCurrentUser();
                                    if (!user) {
                                        setShowLoginModal(true);
                                    } else {
                                        handleConfirmBooking();
                                    }
                                }}
                                disabled={isSubmitting || !!(formData.room && Number(formData.attendees) > (availableRooms.find(r => `${r.catalog_id}:${r.room_id}` === formData.room)?.capacity || 0))}
                            >
                                {isSubmitting ? 'Confirming...' : (!!formData.room && Number(formData.attendees) > (availableRooms.find(r => `${r.catalog_id}:${r.room_id}` === formData.room)?.capacity || 0)) ? 'Capacity Exceeded' : 'Confirm Booking'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showLoginModal && (
                <LoginPage
                    isModal
                    onClose={() => setShowLoginModal(false)}
                    onSuccess={() => {
                        setShowLoginModal(false);
                        setIsModalOpen(false); // complete booking automatically
                    }}
                />
            )}
        </div>
    );
}

export default CalendarPage;
