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
    email?: string;
    phone?: string;
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
    const maxDateObj = new Date();
    maxDateObj.setMonth(maxDateObj.getMonth() + 6);
    const maxDateStr = maxDateObj.toISOString().slice(0, 10);
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
                            email: b.email || user.email,
                            phone: (b as any).phone_no || '',
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
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (dateStr > maxDateStr) {
            // Optional: Show a toast or just block
            return;
        }

        setSelectedDates(prev => {
            if (prev.includes(dateStr)) {
                const next = prev.filter(d => d !== dateStr);
                if (activeDate === dateStr) setActiveDate(next[0] || null);
                return next;
            } else {
                if (prev.length >= 180) {
                    alert('A single booking cannot exceed 180 dates.');
                    return prev;
                }
                const next = [...prev, dateStr].sort();
                if (!activeDate) setActiveDate(dateStr);
                return next;
            }
        });
    };

    // Slot range helpers
    const getCalendarSlotStatus = (slot: { startH: number, start: string, end: string }) => {
        if (!activeDate) return 'available';
        const todayStr = new Date().toISOString().slice(0, 10);
        const now = new Date();
        const isToday = activeDate === todayStr;
        if (isToday && slot.startH <= now.getHours()) return 'past';
        const isBooked = roomBookedSlots.some(b => {
            if (b.selected_slots) {
                const slotsArray = b.selected_slots.split(',');
                return slotsArray.some(s => {
                    const [bStart, bEnd] = s.split('-').map(part => part.slice(0, 5));
                    return bStart === slot.start.slice(0, 5) && bEnd === slot.end.slice(0, 5);
                });
            }
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
                    <h1 className="text-xl sm:text-3xl font-bold text-theme-primary bg-gradient-to-r from-violet-700 to-indigo-600 bg-clip-text text-transparent">Booking Calendar</h1>
                    <p className="text-theme-secondary mt-1 text-sm sm:text-base">View and manage bookings</p>
                </div>
            </div>

            {/* ── DESKTOP: Filters ── */}
            <div className="hidden md:block bg-theme-card border border-theme-border rounded-xl p-3 sm:p-5 mb-4 sm:mb-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-theme-primary opacity-70 mb-2">Filter by Location</label>
                        <select
                            className="w-full p-3 rounded-lg border border-theme-border bg-theme-bg focus:outline-none focus:ring-2 focus:ring-primary text-theme-primary"
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
                        <label className="block text-sm font-medium text-theme-primary opacity-70 mb-2">Filter by Time Slot</label>
                        <select
                            className="w-full p-3 rounded-lg border border-theme-border bg-theme-bg focus:outline-none focus:ring-2 focus:ring-primary text-theme-primary"
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
                <div className="flex items-center justify-between pt-3 border-t border-theme-border">
                    <div className="flex items-center gap-2 text-xs text-theme-secondary">
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
                            className="text-sm text-theme-secondary hover:text-theme-primary font-medium transition-colors px-4 py-2 rounded-lg border border-theme-border hover:bg-theme-bg"
                        >
                            Reset
                        </button>
                        <button
                            onClick={() => {
                                setFilterLocation(tempLocation);
                                setFilterTimeSlot(tempTimeSlot);
                            }}
                            className="text-sm bg-primary hover:bg-primary-dark text-white font-bold px-6 py-2 rounded-lg transition-colors shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/20"
                        >
                            Apply Filter
                        </button>
                    </div>
                </div>
            </div>

            {/* ── MOBILE: Floating Action Button (FAB) for Filters ── */}
            <button
                className="md:hidden fixed bottom-[90px] right-6 z-[60] bg-primary text-white p-4 rounded-full shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/30 active:scale-95 transition-transform"
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
                <div className="md:hidden fixed inset-0 z-[100] bg-theme-bg/60 backdrop-blur-sm flex items-end justify-center p-4">
                    <div className="bg-theme-card w-full max-w-md rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] relative animate-in slide-in-from-bottom-8 duration-300 border border-theme-border">
                        <button
                            onClick={() => setIsMobileFilterOpen(false)}
                            className="absolute top-4 right-4 p-2 text-theme-secondary hover:text-theme-primary bg-theme-bg rounded-full border border-theme-border"
                        >
                            <X size={20} weight="bold" />
                        </button>
                        
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                <Funnel size={24} weight="fill" />
                            </div>
                            <h3 className="text-xl font-bold text-theme-primary">Filter Calendar</h3>
                        </div>

                        <div className="flex flex-col gap-5">
                            <div>
                                <label className="block text-sm font-semibold text-theme-primary mb-2">Location</label>
                                <select
                                    className="w-full p-3.5 rounded-xl border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary bg-theme-bg font-medium"
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
                                <label className="block text-sm font-semibold text-theme-primary mb-2">Time Slot</label>
                                <select
                                    className="w-full p-3.5 rounded-xl border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary bg-theme-bg font-medium"
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
                                    className="flex-1 py-4 bg-theme-bg text-theme-secondary font-bold rounded-xl active:scale-[0.98] transition-transform border border-theme-border"
                                >
                                    Reset
                                </button>
                                <button 
                                    onClick={() => {
                                        setFilterLocation(tempLocation);
                                        setFilterTimeSlot(tempTimeSlot);
                                        setIsMobileFilterOpen(false);
                                    }}
                                    className="flex-[2] bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/20 transition-transform active:scale-[0.98]"
                                >
                                    Apply Filters
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Floating Book Now Bar (fixed bottom) ── */}
            {selectedDates.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-[80] px-4 pb-4 pt-0 pointer-events-none">
                    <div className="max-w-3xl mx-auto pointer-events-auto">
                        <div className="bg-theme-card/95 backdrop-blur-md border border-primary/30 rounded-2xl px-6 py-4 flex items-center justify-between shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/20 ring-1 ring-primary/10">
                            <div>
                                <p className="text-primary font-bold text-sm">
                                    {selectedDates.length} date{selectedDates.length > 1 ? 's' : ''} selected
                                </p>
                                <p className="text-primary/60 text-xs mt-0.5 truncate max-w-[260px] sm:max-w-none">
                                    {selectedDates.sort().join(' · ')}
                                </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <button
                                    onClick={() => setSelectedDates([])}
                                    className="text-sm text-theme-secondary hover:text-rose-500 font-semibold transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                >
                                    Clear
                                </button>
                                <button
                                    onClick={() => { 
                                        if (filterTimeSlot !== 'all') {
                                            const slotIdx = ALL_SLOTS.findIndex((s: {start: string}) => s.start === filterTimeSlot);
                                            if (slotIdx >= 0) {
                                                const newDateSlots: Record<string, number[]> = {};
                                                selectedDates.forEach((d: string) => {
                                                    newDateSlots[d] = [slotIdx];
                                                });
                                                setDateSlots(newDateSlots);
                                            }
                                        }
                                        setIsModalOpen(true); 
                                    }}
                                    className="bg-primary hover:bg-primary-dark text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/30 active:scale-95 flex items-center gap-2"
                                >
                                    Book Now →
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}



            {/* Detail modal for single-date timeline */}
            {isDetailOpen && detailDate && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-theme-bg/60 backdrop-blur-sm" onClick={() => setIsDetailOpen(false)}></div>
                    <div className="bg-theme-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative z-10 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] p-6 border border-theme-border">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-theme-primary">Details for {detailDate}</h3>
                            <button onClick={() => setIsDetailOpen(false)} className="text-theme-secondary hover:text-theme-primary transition-colors">Close</button>
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
                                    <div key={idx} className={`p-3 rounded-lg border flex justify-between items-center ${booked ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}`}>
                                        <div>
                                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{slotLabel}</div>
                                            {booked && booking && (
                                                <div className="text-xs text-slate-600 dark:text-slate-400">
                                                    <div>{booking.room} — {booking.bookedBy}</div>
                                                    <div className="flex gap-3 mt-1 opacity-70">
                                                        {booking.email && <span>📧 {booking.email}</span>}
                                                        {booking.phone && <span>📞 {booking.phone}</span>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            {booked ? (
                                                <div className="text-xs text-green-700 dark:text-green-400 px-2 py-1 rounded">Booked</div>
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
                                                    className="text-xs bg-primary text-white px-3 py-1 rounded hover:bg-primary-dark transition-colors"
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
            <div className="bg-theme-card rounded-2xl border border-theme-border shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] p-3 sm:p-6 lg:p-8">
                {/* Calendar Header with View Options */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-8 gap-3">
                    <div>
                        <h2 className="text-lg sm:text-2xl font-bold text-theme-primary">
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
                                className="flex items-center gap-2 bg-theme-bg border border-theme-border px-4 py-2.5 rounded-lg text-theme-primary font-medium hover:border-primary hover:text-primary transition-colors"
                            >
                                <span className="capitalize">{viewType} View</span>
                                <CaretDown size={16} />
                            </button>
                            {isViewOpen && (
                                <div className="absolute top-full mt-1 right-0 bg-theme-card border border-theme-border rounded-lg shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] overflow-hidden z-10">
                                    {(['day', 'week', 'month'] as ViewType[]).map((view) => (
                                        <button
                                            key={view}
                                            onClick={() => { setViewType(view); setIsViewOpen(false); }}
                                            className={`w-full text-left px-4 py-2.5 capitalize transition-colors ${viewType === view
                                                ? 'bg-primary/10 text-primary font-semibold'
                                                : 'hover:bg-theme-bg text-theme-secondary hover:text-theme-primary'
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
                            <button onClick={handlePrevious} className="p-2 border border-theme-border rounded-lg hover:bg-theme-bg text-theme-secondary transition-colors">
                                <CaretLeft size={20} />
                            </button>
                            <button onClick={handleNext} className="p-2 border border-theme-border rounded-lg hover:bg-theme-bg text-theme-secondary transition-colors">
                                <CaretRight size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex gap-3 sm:gap-6 mb-4 sm:mb-8 pb-4 sm:pb-6 border-b border-theme-border overflow-x-auto">
                    <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-100 dark:bg-green-900/30 border-2 border-green-500 rounded"></div>
                        <span className="text-xs sm:text-sm text-theme-secondary whitespace-nowrap">Booked</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 bg-indigo-100 dark:bg-indigo-900/30 border-2 border-indigo-400 rounded"></div>
                        <span className="text-xs sm:text-sm text-theme-secondary whitespace-nowrap">Available</span>
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
                                    booked: 'bg-green-100 dark:bg-green-900/20 border-green-400 dark:border-green-800',
                                    available: 'bg-primary/5 dark:bg-primary/10 border-primary/20 dark:border-primary/40'
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
                                                aspect-[4/3] rounded-lg sm:rounded-xl border-2 flex flex-col p-1 sm:p-2 lg:p-3 transition-all hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]
                                                ${isPast
                                                    ? 'bg-theme-bg/50 border-theme-border text-theme-secondary opacity-40 cursor-not-allowed'
                                                    : isSelected
                                                        ? 'bg-primary/10 border-primary ring-1 sm:ring-2 ring-primary/40 cursor-pointer shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]'
                                                        : `${statusColors[status]} cursor-pointer`
                                                }
                                            `}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className={`font-bold text-xs sm:text-sm lg:text-base ${isPast ? 'text-theme-secondary opacity-40' : isSelected ? 'text-primary' : 'text-theme-primary'}`}>{day}</span>
                                                {isSelected && (
                                                    <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                                        <span className="text-white text-[8px] font-black">✓</span>
                                                    </span>
                                                )}
                                            </div>
                                            {dayBookings.length > 0 && (
                                                <div className="mt-0.5 hidden sm:block">
                                                    <span className={`text-[10px] block truncate ${isPast ? 'text-theme-secondary opacity-40' : 'text-theme-secondary opacity-70'}`}>
                                                        {dayBookings[0].room.split(' ')[0]}
                                                    </span>
                                                    {dayBookings[0].timeSlot && (
                                                        <span className="text-[9px] text-theme-secondary opacity-50 block mt-0.5 hidden lg:block">{dayBookings[0].timeSlot}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Hover Tooltip for Booked */}
                                        {hoveredBooking && hoveredDate === dateStr && (dayBookings.length > 0) && !isPast && (
                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-theme-bg text-theme-primary px-4 py-3 rounded-lg shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] z-20 whitespace-nowrap pointer-events-none border border-theme-border">
                                                <p className="font-semibold text-sm">{hoveredBooking.room}</p>
                                                <p className="text-xs text-theme-secondary">Booked by: {hoveredBooking.bookedBy}</p>
                                                <div className="text-[10px] text-theme-secondary opacity-70 mb-1 flex flex-col">
                                                    {hoveredBooking.email && <span>Email: {hoveredBooking.email}</span>}
                                                    {hoveredBooking.phone && <span>Phone: {hoveredBooking.phone}</span>}
                                                </div>
                                                {hoveredBooking.timeSlot && (
                                                    <p className="text-xs text-theme-secondary">Time: {hoveredBooking.timeSlot}</p>
                                                )}
                                                <p className="text-xs text-theme-secondary">Purpose: {hoveredBooking.purpose}</p>
                                                <p className={`text-xs font-semibold mt-1 text-green-500`}>Confirmed</p>
                                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-theme-bg rotate-45 -mt-1 border-r border-b border-theme-border"></div>
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
                                                className="absolute top-2 right-2 z-30 bg-theme-bg/90 border border-theme-border text-theme-secondary hover:text-primary hover:border-primary text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] transition-colors"
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
                        <div className="md:hidden bg-theme-card rounded-2xl border border-theme-border shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] overflow-hidden flex flex-col h-[65vh] min-h-[400px]">
                            {/* Header: Days */}
                            <div className="flex border-b border-theme-border bg-theme-bg shrink-0 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] z-10">
                                <div className="w-10 shrink-0 border-r border-theme-border flex items-center justify-center bg-theme-card">
                                    <CalendarBlank size={16} className="text-slate-300 dark:text-slate-600" weight="fill" />
                                </div>
                                {getWeekDays(currentDate).map((date) => {
                                    const dateStr = dateToString(date);
                                    const isToday = dateStr === dateToString(new Date());
                                    const dayName = ['S','M','T','W','T','F','S'][date.getDay()];
                                    return (
                                        <div key={dateStr} className={`flex-1 flex flex-col items-center justify-center py-2 border-r border-theme-border last:border-0 ${isToday ? 'bg-primary/10' : ''}`}>
                                            <span className={`text-[9px] font-bold uppercase ${isToday ? 'text-primary' : 'text-theme-secondary opacity-50'}`}>{dayName}</span>
                                            <span className={`text-xs font-black mt-0.5 flex items-center justify-center w-5 h-5 rounded-full ${isToday ? 'bg-primary text-white shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/30' : 'text-theme-primary'}`}>
                                                {date.getDate()}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Body: Time slots grid */}
                            <div className="flex-1 overflow-y-auto overscroll-contain pb-4">
                                {ALL_SLOTS.map((slot, slotIdx) => (
                                    <div key={slotIdx} className="flex border-b border-theme-border min-h-[48px]">
                                        {/* Time Label */}
                                        <div className="w-10 shrink-0 border-r border-theme-border bg-theme-bg/50 flex flex-col items-center pt-1.5">
                                            <span className="text-[9px] font-bold text-theme-secondary opacity-50 tracking-tighter">{slot.start.slice(0,5)}</span>
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
                                                    className={`flex-1 border-r border-theme-border last:border-0 relative p-[1.5px] transition-colors
                                                        ${isToday ? 'bg-primary/5' : ''}
                                                        ${isPastHour ? 'bg-theme-bg/40 opacity-60' : !hasBooking ? 'active:bg-primary/10 cursor-pointer' : ''}
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
                                                            className={`absolute inset-[1.5px] rounded-[4px] border shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] flex items-center justify-center p-0.5 overflow-hidden 
                                                                ${b.status === 'booked' ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-800' : 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-800'}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDetailDate(dateStr);
                                                                setIsDetailOpen(true);
                                                            }}
                                                        >
                                                            <div className={`text-[7px] font-bold leading-tight text-center truncate w-full ${b.status === 'booked' ? 'text-emerald-800 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-400'}`}>
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
                                                    ? 'border-primary bg-primary/10'
                                                    : isPast
                                                        ? 'border-theme-border bg-theme-bg/30'
                                                        : 'border-theme-border'
                                                    }`}
                                            >
                                                <p className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? 'text-primary' : 'text-theme-secondary opacity-50'}`}>{dayName}</p>
                                                <p className={`text-xl font-black mt-0.5 ${isToday
                                                    ? 'bg-primary text-white w-9 h-9 rounded-full flex items-center justify-center mx-auto shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/30'
                                                    : isPast ? 'text-theme-secondary opacity-30' : 'text-theme-primary'
                                                    }`}>{date.getDate()}</p>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Time rows */}
                                {ALL_SLOTS.map((slot, slotIdx) => {
                                    return (
                                        <div key={slotIdx} className="flex border-t border-theme-border group/row hover:bg-theme-bg/30 transition-colors">
                                            <div className="w-24 shrink-0 pt-2 pr-3 text-right">
                                                <span className="text-[11px] font-semibold text-theme-secondary opacity-50">{slot.label}</span>
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
                                                        className={`flex-1 min-h-[52px] relative border-l border-theme-border p-1 transition-colors
                                                            ${isToday ? 'bg-primary/5' : ''}
                                                            ${isPastHour ? 'bg-theme-bg/40 opacity-60' : !hasBooking ? 'cursor-pointer hover:bg-primary/5' : ''}
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
                                                                className={`h-full min-h-[44px] rounded-lg px-2 py-1.5 border-l-4 cursor-pointer transition-all hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]
                                                                    ${booking.status === 'booked'
                                                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40'
                                                                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/40'
                                                                    }`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDetailDate(dateStr);
                                                                    setIsDetailOpen(true);
                                                                }}
                                                            >
                                                                <p className={`text-[10px] font-black truncate ${booking.status === 'booked' ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                                                                    {booking.room}
                                                                </p>
                                                                {booking.purpose && (
                                                                    <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{booking.purpose}</p>
                                                                )}
                                                                <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate mt-0.5">👤 {booking.bookedBy}</p>
                                                                <div className="text-[8px] text-slate-400/70 dark:text-slate-500/70 truncate">
                                                                    {booking.email && <span className="mr-2">📧 {booking.email}</span>}
                                                                    {booking.phone && <span>📞 {booking.phone}</span>}
                                                                </div>
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
                            <div className={`p-5 rounded-xl mb-6 border-2 flex items-center justify-between shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]
                                ${isPastDay
                                    ? 'bg-theme-bg/50 border-theme-border opacity-60'
                                    : isToday
                                        ? 'bg-primary/10 border-primary shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/5'
                                        : 'bg-theme-card border-primary/20'
                                }`}
                            >
                                <div>
                                    <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isPastDay ? 'text-theme-secondary opacity-50' : 'text-primary'}`}>{dayOfWeek}</p>
                                    <h3 className={`text-2xl font-black ${isPastDay ? 'text-theme-secondary opacity-50' : 'text-theme-primary'}`}>
                                        {monthNames[currentDate.getMonth()]} {currentDate.getDate()}, {currentDate.getFullYear()}
                                    </h3>
                                    {isToday && <p className="text-xs text-primary font-bold mt-1 uppercase tracking-tighter">Today</p>}
                                </div>
                                {isPastDay && (
                                    <div className="bg-theme-bg text-theme-secondary opacity-70 text-xs font-bold px-3 py-1.5 rounded-full border border-theme-border">Past Day — Read Only</div>
                                )}
                            </div>

                            {/* Timeline */}
                            <div className="border border-theme-border rounded-xl overflow-hidden bg-theme-card">
                                {ALL_SLOTS.map((slot, slotIdx) => {
                                    const isPastHour = isPastDay || isPastDateTime(dateStr, slot.startH);
                                    const isCurrentHour = isToday && currentHour === slot.startH;

                                    // Bookings that cover this exact slot hour
                                    const slotBookings = getBookingsForDate(dateStr).filter(b => {
                                        if (b.selectedSlots) {
                                            const slotsArray = b.selectedSlots.split(',');
                                            return slotsArray.some(s => {
                                                const [bStart, bEnd] = s.split('-').map(part => part.slice(0, 5));
                                                return bStart === slot.start.slice(0, 5) && bEnd === slot.end.slice(0, 5);
                                            });
                                        }
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
                                            className={`flex gap-0 border-t border-theme-border first:border-t-0 transition-colors
                                                ${isCurrentHour ? 'bg-primary/10 border-l-4 border-l-primary' : ''}
                                                ${isPastHour && !isCurrentHour ? 'bg-theme-bg/40 opacity-60' : ''}
                                                ${!isPastHour && !hasBooking ? 'hover:bg-primary/5 cursor-pointer' : ''}
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
                                            <div className={`w-28 shrink-0 py-4 px-4 flex flex-col justify-center border-r border-theme-border
                                                ${isCurrentHour ? 'bg-primary/15' : isPastHour ? 'bg-theme-bg/60' : 'bg-theme-bg'}
                                            `}>
                                                <span className={`text-sm font-black ${isCurrentHour ? 'text-primary' : isPastHour ? 'text-theme-secondary opacity-30 whitespace-nowrap' : 'text-theme-secondary opacity-70 whitespace-nowrap'}`}>
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
                                                                className={`rounded-lg border-l-4 p-3 cursor-pointer transition-all hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]
                                                                    ${booking.status === 'booked'
                                                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40'
                                                                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/40'
                                                                    }`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDetailDate(dateStr);
                                                                    setIsDetailOpen(true);
                                                                }}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <p className={`font-bold text-sm text-green-800 dark:text-green-400`}>
                                                                        {booking.room}
                                                                    </p>
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-200 dark:bg-green-900 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800`}>
                                                                        ✓ Confirmed
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                                                                    {booking.timeSlot && <p className="text-xs text-slate-500 dark:text-slate-400">🕐 {booking.timeSlot}</p>}
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400">👤 {booking.bookedBy}</p>
                                                                    {booking.email && <p className="text-xs text-slate-500 dark:text-slate-400">📧 {booking.email}</p>}
                                                                    {booking.phone && <p className="text-xs text-slate-500 dark:text-slate-400">📞 {booking.phone}</p>}
                                                                    {booking.purpose && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">📋 {booking.purpose}</p>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : isPastHour ? (
                                                    <p className="text-xs text-slate-300 dark:text-slate-600 font-medium italic pl-1">Past Hour — No Booking Available</p>
                                                ) : (
                                                    <div className="flex items-center gap-2 opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity w-full justify-center py-2">
                                                        <span className="text-sm text-primary/60 dark:text-primary/40 font-bold tracking-tight">+ Click to quickly book this slot</span>
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
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative z-10 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] flex flex-col border border-white dark:border-slate-800">

                        {/* Modal Header */}
                        <div className="p-6 border-b border-theme-border flex justify-between items-center sticky top-0 bg-theme-card z-20">
                            <h2 className="text-xl font-bold text-theme-primary">Book Conference Room</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-theme-secondary hover:text-theme-primary p-1">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-6">
                            {/* Selected Dates Display */}
                            <div>
                                <label className="block text-sm font-medium text-theme-primary opacity-80 mb-2">Selected Dates</label>
                                <div className="flex flex-wrap gap-2">
                                    {selectedDates.map(date => (
                                        <div
                                            key={date}
                                            onClick={() => setActiveDate(date)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all border
                                                ${activeDate === date
                                                    ? 'bg-primary text-white border-primary shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/20'
                                                    : 'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10'}`}
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
                                <label className="block text-sm font-medium text-theme-primary opacity-80 mb-2">
                                    Select Room
                                    {filterLocation !== 'all' && (
                                        <span className="ml-2 text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                            📍 {filterLocation}
                                        </span>
                                    )}
                                </label>
                                <select
                                    className="w-full p-3 rounded-lg border border-theme-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-theme-bg text-theme-primary"
                                    value={formData.room}
                                    onChange={(e) => {
                                        setDateSlots({});
                                        setFormData({ ...formData, room: e.target.value });
                                    }}
                                >
                                    <option value="" disabled>Choose a room</option>
                                    {availableRooms
                                        .filter(r => {
                                            if (filterLocation === 'all') return true;
                                            return (
                                                r.location === filterLocation ||
                                                r.location?.toLowerCase() === filterLocation.toLowerCase() ||
                                                r.location?.toLowerCase().includes(filterLocation.toLowerCase()) ||
                                                filterLocation.toLowerCase().includes((r.location || '').toLowerCase())
                                            );
                                        })
                                        .map(r => (
                                            <option key={`${r.catalog_id}:${r.room_id}`} value={`${r.catalog_id}:${r.room_id}`}>
                                                {r.room_name} ({r.capacity} people)
                                            </option>
                                        ))
                                    }
                                </select>
                                {filterLocation !== 'all' &&
                                    availableRooms.filter(r =>
                                        r.location === filterLocation ||
                                        r.location?.toLowerCase().includes(filterLocation.toLowerCase()) ||
                                        filterLocation.toLowerCase().includes((r.location || '').toLowerCase())
                                    ).length === 0 && (
                                    <p className="text-xs text-rose-500 mt-1.5">No rooms found for this location. Try selecting "All Locations".</p>
                                )}
                            </div>


                            {/* Time Slots */}
                            <div className={!activeDate ? 'opacity-50 pointer-events-none' : ''}>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-sm font-semibold text-theme-primary">
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
                                            className="text-[10px] font-bold text-primary hover:underline bg-primary/10 dark:bg-primary/20 px-2 py-1 rounded transition-colors"
                                        >
                                            Apply to all dates
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-theme-secondary opacity-50 mb-3 uppercase tracking-wider">
                                    {activeDate ? 'Click time slots to select or deselect them' : 'Select a date above to define slots'}
                                </p>
                                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1 pt-20 custom-scrollbar">
                                    {ALL_SLOTS.map((slot, index) => {
                                        const status = getCalendarSlotStatus(slot);
                                        const selected = isCalendarSlotSelected(index);


                                        let classes = 'relative flex items-center justify-center px-2 py-3 rounded-xl text-[11px] font-bold transition-all border-2 ';

                                        // Find matching booking for tooltip
                                        const matchingBooking = roomBookedSlots.find(b => {
                                            if (b.selected_slots) {
                                                const slotsArray = b.selected_slots.split(',');
                                                return slotsArray.some(s => {
                                                    const [bStart, bEnd] = s.split('-').map(part => part.slice(0, 5));
                                                    return bStart === slot.start.slice(0, 5) && bEnd === slot.end.slice(0, 5);
                                                });
                                            }
                                            const bStartH = parseInt(b.start_time.split(':')[0]);
                                            const bEndH = parseInt(b.end_time.split(':')[0]);
                                            return slot.startH >= bStartH && slot.startH < bEndH;
                                        });

                                        if (status === 'past') {
                                            classes += 'bg-theme-bg/40 text-theme-secondary opacity-30 border-theme-border cursor-not-allowed line-through';
                                        } else if (status === 'booked') {
                                            classes += 'bg-rose-50 dark:bg-rose-900/10 text-rose-500 border-rose-200 dark:border-rose-900/30 cursor-not-allowed';
                                        } else if (selected) {
                                            classes += 'bg-primary border-primary text-white shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/20 scale-[0.98]';
                                        } else {
                                            classes += 'bg-theme-bg text-theme-primary border-theme-border hover:border-primary hover:text-primary cursor-pointer';
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
                                                                <div className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 border border-slate-700 rounded-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] text-white text-xs z-[100] text-left font-normal pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-200">
                                                                    <p className="font-bold mb-2 border-b border-slate-700 pb-1 text-sm text-slate-200 flex items-center gap-2">
                                                                        <Eye size={14} /> Booking Details
                                                                    </p>
                                                                    <div className="space-y-1.5">
                                                                        <p><span className="text-slate-400 font-medium">By:</span> {matchingBooking.user_name || 'Unknown'}</p>
                                                                        {matchingBooking.email && <p className="break-all"><span className="text-slate-400 font-medium">Email:</span> {matchingBooking.email}</p>}
                                                                        {matchingBooking.phone_no && <p><span className="text-slate-400 font-medium">Phone:</span> {matchingBooking.phone_no}</p>}
                                                                        <p className="border-t border-slate-700/50 pt-1 mt-1"><span className="text-slate-400 font-medium">Purpose:</span> {matchingBooking.purpose || 'None specified'}</p>
                                                                    </div>
                                                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2.5 h-2.5 bg-slate-800 rotate-45 -mt-1.25 border-r border-b border-slate-700"></div>
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
                                <div className="flex items-center gap-4 mt-3 text-[10px] text-theme-secondary opacity-50">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block"></span>Available</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500/50 inline-block"></span>Booked</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-theme-bg/60 border border-theme-border inline-block"></span>Past</span>
                                </div>
                            </div>

                            {/* Attendees */}
                            <div>
                                <label className="block text-sm font-medium text-theme-primary opacity-80 mb-2">Number of Attendees</label>
                                {formData.room && (
                                    <p className="text-xs text-theme-secondary opacity-50 mb-2">Max capacity for selected room: {availableRooms.find(r => `${r.catalog_id}:${r.room_id}` === formData.room)?.capacity} people</p>
                                )}
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full p-3 rounded-lg border border-theme-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-theme-bg text-theme-primary"
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
                                <label className="block text-sm font-medium text-theme-primary opacity-80 mb-2">Purpose of Booking</label>
                                <textarea
                                    className="w-full p-3 rounded-lg border border-theme-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary min-h-[100px] bg-theme-bg text-theme-primary"
                                    value={formData.purpose}
                                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                    placeholder="Brief description of your meeting"
                                ></textarea>
                            </div>

                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-theme-border bg-theme-bg/50 rounded-b-2xl flex justify-end gap-3 sticky bottom-0">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2.5 rounded-lg font-bold text-theme-secondary hover:bg-theme-bg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                className={`px-8 py-2.5 rounded-lg font-bold shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] transition-all active:scale-[0.98] 
                                    ${(isSubmitting || (!!formData.room && Number(formData.attendees) > (availableRooms.find(r => `${r.catalog_id}:${r.room_id}` === formData.room)?.capacity || 0)) || selectedDates.length > 180 || selectedDates.some(d => d > maxDateStr))
                                        ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-none'
                                        : 'bg-primary hover:bg-primary-dark text-white shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-teal-200/50'}`}
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
