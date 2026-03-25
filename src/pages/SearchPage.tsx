/**
 * @file SearchPage.tsx
 * @description Room search and booking page for the user-facing application.
 *
 * This is the primary reservation page. It is structured in three stages:
 *
 * Stage 1 — Office Selection:
 *   Displays all unique office/location cards fetched from the backend.
 *   Users click an office card to drill down into the specific rooms there.
 *
 * Stage 2 — Room Type Selection:
 *   Displays all rooms within the selected office. Users can also apply
 *   filter criteria (type, location, amenities, capacity) and search by
 *   keyword to narrow down results.
 *
 * Stage 3 — Booking Form:
 *   When a specific room is selected, the main view shows its details
 *   (image, amenities, layout) alongside a sticky booking form. The form
 *   allows the user to choose a date range and time slots, with real-time
 *   availability overlaid to prevent double-bookings.
 *
 * Key Dependencies:
 *  - `fetchRooms`: Loads all rooms from `GET /api/rooms`.
 *  - `fetchRoomAvailability`: Loads booked slots from `GET /api/bookings/availability`.
 *  - `createBooking`: Submits a booking to `POST /api/bookings`.
 *  - `getCurrentUser`: Reads the authenticated user from localStorage.
 *
 * @module pages/SearchPage
 */

import {
    Funnel,
    MagnifyingGlass,
    Users,
    CaretDown,
    X,
    Lock,
    Eye,
    Sun,
    ListChecks,
    SlidersHorizontal,
    ArrowRight,
    CheckCircle,
    Warning,
    ArrowsClockwise,
    SquaresFour,
    CalendarBlank,
    Star,
    Buildings,
    Clock,
} from '@phosphor-icons/react';
import React, { useState, useEffect } from 'react';
import { fetchRooms, createBooking, getCurrentUser, Room as ApiRoom, fetchRoomAvailability, BookedSlot, fetchLocations, Location } from '../lib/api';
import { getDirectImageUrl } from '../lib/imageUtils';
import { BookingResult } from '../App';


/**
 * Represents a normalized room object used within the Search page's UI.
 * Maps raw API fields into a more UI-friendly shape.
 */
export interface SearchRoom {
    id: string; // room_id
    catalog_id: string; // catalog_id from DB
    name: string;
    location: string;
    description: string;
    capacity: number;
    image: string;
    tags: string[];
    utilization: number;
    amenities: string[];
    type: string;
    isInactive: boolean; // true when admin has deactivated the room
    location_id?: string;
}

/**
 * Generates all bookable 1-hour time slots within the working day (9 AM to 6 PM).
 * The resulting array is used to render the slot grid in the booking form.
 *
 * @constant {Array<{start: string, end: string, label: string, startH: number}>} ALL_SLOTS
 * @example ALL_SLOTS[0] // { start: '09:00:00', end: '10:00:00', label: '09:00 – 10:00', startH: 9 }
 */

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

/**
 * Props accepted by the SearchPage component.
 */
interface SearchPageProps {
    /** Optional callback: navigates to the detailed room view when a room card is clicked. Optionally passes pre-fill dates and slots. */
    onViewRoom?: (catalog_id: string, room_id: string, prefillDates?: string[], prefillSlots?: number[]) => void;
    /** Callback invoked after a successful booking, navigating to the ticket page. */
    onBookingSuccess?: (booking: BookingResult) => void;
    /** Optional initial filters populated from quick access */
    initialFilters?: { location: string; capacity: string; date: string; quickBookingMode?: boolean };
}

/**
 * Internal shape used to represent a unique office/building location derived
 * from the list of rooms.
 */
interface Office {
    name: string;
    location: string;
    image: string;
}

/**
 * SearchPage — the main room discovery and booking page.
 *
 * Handles three UI stages: office list → room type list → booking form.
 * Fetches room data on mount and availability data when a room/date is selected.
 *
 * @param {SearchPageProps} props - Component props.
 * @returns {JSX.Element} The rendered search and booking page.
 */
const SearchPage: React.FC<SearchPageProps> = ({ onViewRoom: _onViewRoom, onBookingSuccess, initialFilters }) => {
    const [selectedRoomType, setSelectedRoomType] = useState<SearchRoom | null>(null);
    const [rooms, setRooms] = useState<SearchRoom[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ─── Booking Form State ───────────────────────────────────────────────
    /** Today's date string (YYYY-MM-DD) used as the minimum allowed booking date. */
    const todayStr = new Date().toISOString().slice(0, 10);
    const [bookDate, setBookDate] = useState(initialFilters?.date || todayStr);
    /** Index of the first selected time slot in the ALL_SLOTS array. */
    const [startSlot, setStartSlot] = useState<number | null>(null);
    /** Index of the last selected time slot (for range selection). */
    const [endSlot, setEndSlot] = useState<number | null>(null);
    const [bookPurpose, setBookPurpose] = useState('');
    const [bookAttendees, setBookAttendees] = useState<number | string>(1);
    /** True while the booking form submission is in-flight. */
    const [bookingSubmitting, setBookingSubmitting] = useState(false);
    /** Stores the result of the last booking attempt (OK or error message). */
    const [bookingResult, setBookingResult] = useState<{ ok: boolean; msg: string } | null>(null);
    /** Booked slots returned by the availability API for conflict detection. */
    const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
    /** True while availability is being loaded from the API. */
    const [loadingSlots, setLoadingSlots] = useState(false);

    // ─── Filter & Search State ────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRoomTypes, setSelectedRoomTypes] = useState<string[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<string[]>(
        initialFilters?.location && initialFilters.location !== 'All Locations' ? [] : []
    );
    const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
    const [selectedCapacity, setSelectedCapacity] = useState<string[]>(
        initialFilters?.capacity && initialFilters.capacity !== 'Any Capacity' ? [initialFilters.capacity] : []
    );
    const [filteredRooms, setFilteredRooms] = useState<SearchRoom[]>([]);
    const [hasFiltered, setHasFiltered] = useState(false);
    const [selectedOffice, setSelectedOffice] = useState<string | null>(null);

    // State for Mobile Filter Modal
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
    // State for sidebar filter section collapse (all open by default)
    const [sidebarOpen, setSidebarOpen] = useState({ roomType: false, location: false, amenities: false, capacity: false, avail: false });

    // ─── Sidebar Availability Filter State ───────────────────────────────────
    const [sbMode, setSbMode] = useState<'by-slot' | 'full-day'>('by-slot');
    const [sbDates, setSbDates] = useState<string[]>([]);          // multi-date for by-slot
    const [sbDateInput, setSbDateInput] = useState('');             // controlled input
    const [sbSlotIndices, setSbSlotIndices] = useState<number[]>([]); // selected time slots
    const [sbAvailRoomIds, setSbAvailRoomIds] = useState<Set<string>>(new Set()); // ids of available rooms
    const [sbLoading, setSbLoading] = useState(false);
    const [sbSearched, setSbSearched] = useState(false);

    // ─── Quick Booking (Advanced Search) Mode State ───────────────────────────
    const [advancedMode, setAdvancedMode] = useState(initialFilters?.quickBookingMode ?? false);
    const [advBookingMode, setAdvBookingMode] = useState<'full-day' | 'by-slot'>('by-slot');
    // Pre-fill date/location from home page Quick Booking card when quickBookingMode is active
    const [advDate, setAdvDate] = useState(
        initialFilters?.quickBookingMode && initialFilters.date ? initialFilters.date : todayStr
    );
    const [advSlotIndices, setAdvSlotIndices] = useState<number[]>([]);
    const [advLocation, setAdvLocation] = useState(
        initialFilters?.quickBookingMode && initialFilters.location && initialFilters.location !== 'All Locations'
            ? initialFilters.location : 'all'
    );
    const [advRoomType, setAdvRoomType] = useState('all');
    const [advCapacity, setAdvCapacity] = useState('');
    const [advAmenities, setAdvAmenities] = useState<string[]>([]);
    const [advResults, setAdvResults] = useState<Array<SearchRoom & { availableSlots: typeof ALL_SLOTS; bookedSlots: BookedSlot[] }>>([]);
    const [collapsedLocations, setCollapsedLocations] = useState<Set<string>>(new Set());

    const [advLoading, setAdvLoading] = useState(false);
    const [advSearched, setAdvSearched] = useState(false);
    // Booking modal state (advanced mode)
    const [advBookingRoom, setAdvBookingRoom] = useState<(SearchRoom & { availableSlots: typeof ALL_SLOTS }) | null>(null);
    const [advBookSlots, setAdvBookSlots] = useState<typeof ALL_SLOTS>([]);
    const [advBookPurpose, setAdvBookPurpose] = useState('');
    const [advBookAttendees, setAdvBookAttendees] = useState(1);
    const [advBookLoading, setAdvBookLoading] = useState(false);
    const [advBookMsg, setAdvBookMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const maxBookDate = (() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().slice(0, 10); })();
    const ADV_ROOM_TYPES = ['Conference Room', 'Meeting Room', 'Training Room', 'Board Room', 'Auditorium'];
    const ADV_AMENITIES = ['Projector', 'Whiteboard', 'WiFi', 'AC', 'Video Conferencing', 'Sound System'];

    const advHasConflict = (slot: typeof ALL_SLOTS[0], booked: BookedSlot[]) =>
        booked.some(b => {
            if (b.selected_slots) return b.selected_slots.split(',').some(s => { const [bS, bE] = s.split('-').map(p => p.slice(0, 5)); return bS === slot.start.slice(0, 5) && bE === slot.end.slice(0, 5); });
            const bSH = parseInt(b.start_time.split(':')[0]); const bEH = parseInt(b.end_time.split(':')[0]);
            return slot.startH >= bSH && slot.startH < bEH;
        });

    const advIsPast = (slot: typeof ALL_SLOTS[0]) => advDate === todayStr && slot.startH < new Date().getHours();

    const doAdvancedSearch = async (roomsArr = rooms) => {
        if (roomsArr.length === 0) return;
        setAdvLoading(true); setAdvSearched(true); setAdvResults([]);
        try {
            // Apply metadata filters first (no API calls)
            let filtered = roomsArr.filter(r => !r.isInactive);
            if (advLocation !== 'all') filtered = filtered.filter(r => r.location === advLocation);
            if (advRoomType !== 'all') filtered = filtered.filter(r => r.type === advRoomType);
            const cap = parseInt(advCapacity);
            if (!isNaN(cap) && cap > 0) filtered = filtered.filter(r => r.capacity >= cap);
            // Amenity match is case-insensitive partial
            if (advAmenities.length > 0) filtered = filtered.filter(r =>
                advAmenities.every(a => r.amenities.some(am => am.toLowerCase().includes(a.toLowerCase())))
            );

            // Fetch availability for all filtered rooms in parallel
            const results = await Promise.all(filtered.map(async (room) => {
                try {
                    const booked = await fetchRoomAvailability(room.catalog_id, room.id, advDate);
                    const freeSlots = ALL_SLOTS.filter(s => !advIsPast(s) && !advHasConflict(s, booked));

                    if (advBookingMode === 'by-slot' && advSlotIndices.length > 0) {
                        // Must have ALL wanted slots free
                        const allWantedFree = advSlotIndices.every(i => {
                            const s = ALL_SLOTS[i];
                            return !advIsPast(s) && !advHasConflict(s, booked);
                        });
                        if (!allWantedFree) return null;
                    }

                    if (advBookingMode === 'full-day') {
                        // All 9 slots (09:00–18:00) must be conflict-free (ignore past check for full-day display)
                        const allFree = ALL_SLOTS.every(s => !advHasConflict(s, booked));
                        if (!allFree) return null;
                    }

                    return { ...room, availableSlots: freeSlots, bookedSlots: booked };
                } catch { return null; }
            }));
            setAdvResults(results.filter((r): r is NonNullable<typeof r> => r !== null));
        } finally { setAdvLoading(false); }
    };

    // Auto-search whenever advanced mode is active and any filter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (advancedMode && rooms.length > 0) doAdvancedSearch(rooms); },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [advancedMode, rooms, advDate, advLocation, advRoomType, advCapacity, advBookingMode, advAmenities, advSlotIndices]
    );
    useEffect(() => { if (advBookingMode === 'full-day') setAdvSlotIndices([]); }, [advBookingMode]);

    const advOpenBooking = (room: typeof advResults[0]) => {
        // For full-day: book all 9 slots regardless of time-of-day for display purposes
        const slots = advBookingMode === 'full-day'
            ? ALL_SLOTS
            : advSlotIndices.length > 0 ? advSlotIndices.map(i => ALL_SLOTS[i]) : room.availableSlots;
        setAdvBookingRoom(room); setAdvBookSlots(slots);
        setAdvBookPurpose(''); setAdvBookAttendees(1); setAdvBookMsg(null);
    };

    const advConfirmBooking = async () => {
        if (!advBookingRoom) return;
        const user = getCurrentUser();
        if (!user) { setAdvBookMsg({ ok: false, text: 'Please log in to book.' }); return; }
        if (advBookSlots.length === 0) { setAdvBookMsg({ ok: false, text: 'No slots selected.' }); return; }
        const attendeeCount = Number(advBookAttendees) || 1;
        if (attendeeCount > advBookingRoom.capacity) {
            setAdvBookMsg({ ok: false, text: `Attendees cannot exceed room capacity (${advBookingRoom.capacity}).` }); return;
        }
        setAdvBookLoading(true); setAdvBookMsg(null);
        try {
            let bookingPayload: Parameters<typeof createBooking>[0];
            if (advBookingMode === 'full-day') {
                // Full-day: use start_time/end_time so the backend creates a single block
                bookingPayload = {
                    uid: user.uid, catalog_id: advBookingRoom.catalog_id, room_id: advBookingRoom.id,
                    start_date: advDate, end_date: advDate,
                    start_time: '09:00:00', end_time: '18:00:00',
                    purpose: advBookPurpose, attendees: attendeeCount,
                };
            } else {
                bookingPayload = {
                    uid: user.uid, catalog_id: advBookingRoom.catalog_id, room_id: advBookingRoom.id,
                    purpose: advBookPurpose, attendees: attendeeCount,
                    per_date_choices: [{ date: advDate, slots: advBookSlots.map(s => `${s.start.slice(0, 5)}-${s.end.slice(0, 5)}`) }],
                };
            }
            const result = await createBooking(bookingPayload);
            setAdvBookMsg({ ok: true, text: `✅ Booking confirmed! ID: ${result.booking_id}` });
            if (onBookingSuccess) setTimeout(() => onBookingSuccess({
                booking_id: result.booking_id, room_name: advBookingRoom.name,
                location: advBookingRoom.location, date: advDate,
                start_time: advBookingMode === 'full-day' ? '09:00:00' : advBookSlots[0].start,
                end_time: advBookingMode === 'full-day' ? '18:00:00' : advBookSlots[advBookSlots.length - 1].end,
                purpose: advBookPurpose, status: 'confirmed',
            }), 1500);
        } catch (e: any) { setAdvBookMsg({ ok: false, text: e.message || 'Booking failed. Please try again.' }); }
        finally { setAdvBookLoading(false); }
    };


    // Fetch availability when room or date changes
    useEffect(() => {
        const loadAvailability = async () => {
            if (!selectedRoomType || !bookDate) return;
            setLoadingSlots(true);
            setBookedSlots([]); // clear before loading
            try {
                const data = await fetchRoomAvailability(selectedRoomType.catalog_id, selectedRoomType.id, bookDate);
                setBookedSlots(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingSlots(false);
            }
        };
        loadAvailability();
        // Use stable string values as dependencies, not the object reference
    }, [selectedRoomType?.catalog_id, selectedRoomType?.id, bookDate]);

    // When a room is selected after an availability search, pre-fill bookDate from sbDates[0]
    useEffect(() => {
        if (selectedRoomType && sbSearched && sbDates.length > 0) {
            setBookDate(sbDates[0]);
        }
        // Only fire when the room changes, not on every sbDates update
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRoomType?.id]);




    /**
     * Determines the display status of a given time slot.
     *
     * A slot can be one of three states:
     *  - 'past':      The slot has already passed (only applies when viewing today).
     *  - 'booked':    The slot overlaps with an existing confirmed booking.
     *  - 'available': The slot is free and can be selected.
     *
     * @param {typeof ALL_SLOTS[0]} slot - A time slot object from the ALL_SLOTS array.
     * @returns {'past' | 'booked' | 'available'} The derived status of the slot.
     */
    const getSlotStatus = (slot: typeof ALL_SLOTS[0]) => {
        // 1. Check if past (for today)
        const now = new Date();
        const isToday = bookDate === now.toISOString().slice(0, 10);
        if (isToday && slot.startH <= now.getHours()) return 'past';

        // 2. Check if booked
        const isBooked = bookedSlots.some(b => {
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

    /**
     * Checks whether a given slot index falls within the user's current selection range.
     * The range is defined from `startSlot` to `endSlot` (inclusive, order-independent).
     *
     * @param {number} index - The index of the slot in the ALL_SLOTS array.
     * @returns {boolean} True if the slot is within the selected range.
     */
    const isSlotSelected = (index: number) => {
        if (startSlot === null) return false;
        if (endSlot === null) return index === startSlot;
        const min = Math.min(startSlot, endSlot);
        const max = Math.max(startSlot, endSlot);
        return index >= min && index <= max;
    };

    /**
     * Handles a click on a time slot button.
     *
     * Selection logic (two-click range model):
     *  - First click (or re-click when a range is set): Sets `startSlot`, clears `endSlot`.
     *  - Second click: Sets `endSlot` to complete the range.
     *  - If any slot in the proposed range is already booked, the range is rejected
     *    and only the newly clicked slot becomes the new `startSlot`.
     *
     * @param {number} index - The index of the clicked slot in the ALL_SLOTS array.
     */
    const handleSlotClick = (index: number) => {
        if (startSlot === null || (startSlot !== null && endSlot !== null)) {
            setStartSlot(index);
            setEndSlot(null);
        } else {
            // Check if any slot in range is booked
            const min = Math.min(startSlot, index);
            const max = Math.max(startSlot, index);
            const range = Array.from({ length: max - min + 1 }, (_, i) => min + i);
            const hasBooked = range.some(idx => getSlotStatus(ALL_SLOTS[idx]) === 'booked');

            if (hasBooked) {
                setStartSlot(index);
                setEndSlot(null);
            } else {
                setEndSlot(index);
            }
        }
    };

    useEffect(() => {
        const loadRooms = async (isInitial = false) => {
            try {
                const [apiRooms, apiLocations] = await Promise.all([
                    fetchRooms(),
                    fetchLocations()
                ]);
                const mappedRooms: SearchRoom[] = apiRooms.map((r: ApiRoom) => ({
                    id: r.room_id,
                    catalog_id: r.catalog_id,
                    name: r.room_name,
                    location: r.location,
                    description: `Located on Floor ${r.floor_no}, Room ${r.room_number}. ${r.availability || 'Available for booking.'}`,
                    capacity: r.capacity,
                    image: getDirectImageUrl(r.image_url),
                    tags: [r.status || 'Available'],
                    utilization: Math.floor(Math.random() * 100),
                    amenities: r.amenities ? r.amenities.split(',').map(a => a.trim()) : [],
                    type: r.room_type || 'Conference Room',
                    isInactive: r.status === 'inactive',
                    location_id: r.location_id,
                }));
                
                if (isInitial && initialFilters && (initialFilters.location !== 'All Locations' || initialFilters.capacity !== 'Any Capacity')) {
                    let results = mappedRooms;
                    if (initialFilters.location && initialFilters.location !== 'All Locations') {
                        results = results.filter(room => room.location === initialFilters.location);
                    }
                    if (initialFilters.capacity && initialFilters.capacity !== 'Any Capacity') {
                        results = results.filter(room => getCapacityRange(room.capacity) === initialFilters.capacity);
                    }
                    setFilteredRooms(results);
                    setHasFiltered(true);
                }

                setRooms(mappedRooms);
                setLocations(apiLocations);
                if (isInitial) setLoading(false);
            } catch (err) {
                console.error(err);
                if (isInitial) {
                    setError('Failed to load rooms. Please check if the backend is running.');
                    setLoading(false);
                }
            }
        };

        loadRooms(true);
        // Poll every 30 seconds so status changes from admin reflect automatically
        const interval = setInterval(() => loadRooms(false), 30000);
        return () => clearInterval(interval);
    }, []);

    // Generate filter options dynamically based on available rooms
    const filters = {
        roomType: Array.from(new Set(rooms.map(r => r.type).filter(Boolean))),
        location: locations.map(l => l.name), // Only use defined database locations
        amenities: Array.from(new Set(rooms.flatMap(r => r.amenities).filter(Boolean))),
        capacity: ['2-6 People', '6-12 People', '12-20 People', '20+ People'],
    };


    /**
     * Maps the raw capacity number of a room to one of the predefined
     * capacity range filter strings. Used to match the UI filter options.
     *
     * @param {number} people - The maximum occupancy of the room.
     * @returns {'2-6 People' | '6-12 People' | '12-20 People' | '20+ People'}
     */
    const getCapacityRange = (people: number): string => {
        if (people <= 6) return '2-6 People';
        if (people <= 12) return '6-12 People';
        if (people <= 20) return '12-20 People';
        return '20+ People';
    };

    /**
     * Applies all active filter criteria to the full rooms list.
     */
    const applyFilters = (
        overrideTypes?: string[],
        overrideLocations?: string[],
        overrideAmenities?: string[],
        overrideCapacity?: string[],
        overrideQuery?: string
    ) => {
        let results = rooms;

        const typesToUse = overrideTypes ?? selectedRoomTypes;
        const locationsToUse = overrideLocations ?? selectedLocations;
        const amenitiesToUse = overrideAmenities ?? selectedAmenities;
        const capacityToUse = overrideCapacity ?? selectedCapacity;
        const queryToUse = overrideQuery ?? searchQuery;

        // Search filter (location and name)
        if (queryToUse.trim()) {
            const query = queryToUse.toLowerCase();
            results = results.filter(room =>
                room.name.toLowerCase().includes(query) ||
                room.location.toLowerCase().includes(query)
            );
        }

        // Room Type filter
        if (typesToUse.length > 0) {
            results = results.filter(room => typesToUse.includes(room.type));
        }

        // Location filter — match by location_id (reliable) with a name fallback
        if (locationsToUse.length > 0) {
            results = results.filter(room => {
                // Find any selected location whose id or name matches this room
                return locationsToUse.some(selId => {
                    const loc = locations.find(l => l.location_id === selId);
                    if (!loc) return false;
                    return (
                        room.location_id === loc.location_id ||
                        room.location === loc.name ||
                        room.location.toLowerCase().includes(loc.name.toLowerCase()) ||
                        loc.name.toLowerCase().includes(room.location.toLowerCase())
                    );
                });
            });
        }

        // Amenities filter
        if (amenitiesToUse.length > 0) {
            results = results.filter(room =>
                amenitiesToUse.every(amenity => {
                    const normalizedAmenity = amenity.toLowerCase().replace(/-/g, ' ');
                    return room.amenities.some(roomAmenity => 
                        roomAmenity.toLowerCase().replace(/-/g, ' ') === normalizedAmenity ||
                        roomAmenity.toLowerCase().includes(normalizedAmenity)
                    );
                })
            );
        }

        // Capacity filter
        if (capacityToUse.length > 0) {
            results = results.filter(room => {
                const roomCapacityRange = getCapacityRange(room.capacity);
                return capacityToUse.includes(roomCapacityRange);
            });
        }

        setFilteredRooms(results);
        setHasFiltered(true);
    };

    const handleRoomTypeChange = (type: string) => {
        const next = selectedRoomTypes.includes(type) ? selectedRoomTypes.filter(t => t !== type) : [...selectedRoomTypes, type];
        setSelectedRoomTypes(next);
        applyFilters(next, selectedLocations, selectedAmenities, selectedCapacity, searchQuery);
    };

    const handleLocationChange = (locId: string) => {
        const next = selectedLocations.includes(locId)
            ? selectedLocations.filter(l => l !== locId)
            : [...selectedLocations, locId];
        setSelectedLocations(next);
        applyFilters(selectedRoomTypes, next, selectedAmenities, selectedCapacity, searchQuery);
    };

    const handleAmenityChange = (amenity: string) => {
        const next = selectedAmenities.includes(amenity) ? selectedAmenities.filter(a => a !== amenity) : [...selectedAmenities, amenity];
        setSelectedAmenities(next);
        applyFilters(selectedRoomTypes, selectedLocations, next, selectedCapacity, searchQuery);
    };

    const handleCapacityChange = (capacity: string) => {
        const next = selectedCapacity.includes(capacity) ? selectedCapacity.filter(c => c !== capacity) : [...selectedCapacity, capacity];
        setSelectedCapacity(next);
        applyFilters(selectedRoomTypes, selectedLocations, selectedAmenities, next, searchQuery);
    };

    const displayRooms = (() => {
        let base = hasFiltered ? filteredRooms : rooms;
        // If an availability search has been run, further filter to rooms in the available set
        if (sbSearched && sbAvailRoomIds.size > 0) {
            base = base.filter(r => sbAvailRoomIds.has(r.id));
        } else if (sbSearched && sbAvailRoomIds.size === 0) {
            base = []; // No rooms available for the selected criteria
        }
        return base;
    })();


    const getUniqueOffices = (): Office[] => {
        return locations
            // Only include offices that have at least 1 room in the current filtered set
            .filter(loc => displayRooms.some(r => r.location_id === loc.location_id || r.location === loc.name))
            .map(loc => {
                const roomFallback = displayRooms.find(r => r.location_id === loc.location_id || r.location === loc.name);
                return {
                    name: loc.name,
                    location: loc.name,
                    image: roomFallback?.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80',
                };
            });
    };


    const getRoomTypesForOffice = (officeName: string): SearchRoom[] => {
        const foundLoc = locations.find(l => l.name === officeName);
        return displayRooms.filter(room => 
            (foundLoc && room.location_id === foundLoc.location_id) || room.location === officeName
        );
    };



    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-theme-secondary font-medium">Loading spaces...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
                <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 max-w-md">
                    <p className="font-bold mb-1">Error Loading Data</p>
                    <p className="text-sm">{error}</p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="bg-primary text-white px-6 py-2 rounded-lg font-bold"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    // If an office is selected, show room types
    if (selectedOffice) {
        const roomTypes = getRoomTypesForOffice(selectedOffice);
        return (
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Coloured header banner matching the office card */}
                <div className="rounded-2xl bg-primary p-6 mb-8 text-white shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] border border-primary-dark/10">
                    <button
                        onClick={() => setSelectedOffice(null)}
                        className="text-white/80 hover:text-white mb-3 font-semibold text-sm flex items-center gap-1"
                    >
                        ← Back to Offices
                    </button>
                    <h1 className="text-3xl font-bold">{selectedOffice}</h1>
                    <p className="text-white/75 mt-1">Select a room type to view details and book</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {roomTypes.map((room) => (
                        <div
                            key={room.id}
                            className={`bg-theme-card rounded-xl border overflow-hidden transition-shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] ${
                                room.isInactive
                                    ? 'border-theme-border opacity-60 grayscale-[40%]'
                                    : 'border-theme-border hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]'
                            }`}
                        >
                            <div className="h-48 overflow-hidden bg-slate-100 relative">
                                <img
                                    src={room.image}
                                    alt={room.name}
                                    referrerPolicy="no-referrer"
                                    crossOrigin="anonymous"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                />
                                {room.isInactive && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                        <span className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-widest shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]">
                                            Currently Unavailable
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="p-6">
                                <h3 className="text-lg font-bold text-theme-primary mb-2">{room.name}</h3>
                                <p className="text-sm font-semibold text-primary mb-2">{room.type}</p>
                                <p className="text-theme-secondary text-sm mb-4">{room.description}</p>
                                <div className="flex items-center gap-4 text-sm text-theme-secondary mb-4">
                                    <div className="flex items-center gap-1.5">
                                        <Users size={16} className="text-primary" />
                                        <span>{room.capacity} people</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (room.isInactive) return;
                                        if (_onViewRoom) {
                                            // Pass sbDates and sbSlotIndices as prefill info when availability filter is active
                                            const dates = sbSearched && sbDates.length > 0 ? sbDates : undefined;
                                            const slots = sbSearched && sbSlotIndices.length > 0 ? sbSlotIndices : undefined;
                                            _onViewRoom(room.catalog_id, room.id, dates, slots);
                                        } else {
                                            setSelectedRoomType(room);
                                            // Pre-fill booking date from availability filter if used
                                            if (sbSearched && sbDates.length > 0) {
                                                setBookDate(sbDates[0]);
                                            }
                                        }
                                    }}
                                    type="button"
                                    disabled={room.isInactive}
                                    className={`w-full font-semibold py-2.5 rounded-lg transition-all ${
                                        room.isInactive
                                            ? 'bg-theme-bg text-theme-secondary opacity-40 cursor-not-allowed border border-theme-border'
                                            : 'bg-primary hover:bg-primary-dark text-white cursor-pointer hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]'
                                    }`}
                                >
                                    {room.isInactive ? 'Room Unavailable' : 'Select Room Type'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // If a room type is selected, show detailed booking with layout
    // activeDate: use filter date when availability search was run, else use bookDate state
    const activeDate = (sbSearched && sbDates.length > 0) ? sbDates[0] : bookDate;
    if (selectedRoomType) {
        return (
            <div className="max-w-6xl mx-auto px-6 py-8">
                <button
                    onClick={() => setSelectedRoomType(null)}
                    className="text-primary hover:underline mb-4 font-semibold"
                >
                    ← Back to Room Types
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                    {/* Room Details */}
                    <div className="lg:col-span-2">
                        <div className="bg-theme-card rounded-xl border border-theme-border overflow-hidden mb-6">
                            <div className="h-64 overflow-hidden bg-theme-bg/50">
                                <img
                                    src={selectedRoomType.image}
                                    alt={selectedRoomType.name}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="p-8">
                                <h1 className="text-3xl font-bold text-theme-primary mb-2">{selectedRoomType.name}</h1>
                                <p className="text-theme-secondary mb-6">{selectedRoomType.description}</p>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                    <div className="p-4 bg-theme-bg/50 rounded-lg border border-theme-border">
                                        <p className="text-theme-secondary text-sm">Capacity</p>
                                        <p className="text-2xl font-bold text-primary">{selectedRoomType.capacity}</p>
                                    </div>
                                    <div className="p-4 bg-theme-bg/50 rounded-lg invisible h-0">
                                        <p className="text-theme-secondary text-sm">Cost</p>
                                        <p className="text-2xl font-bold text-theme-primary">Free</p>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <h3 className="text-lg font-bold text-theme-primary mb-4">Amenities</h3>
                                    <div className="flex flex-wrap gap-3">
                                        {selectedRoomType.amenities.map((amenity) => (
                                            <span key={amenity} className="px-3 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium capitalize border border-primary/20">
                                                {amenity.replace('-', ' ')}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <h3 className="text-lg font-bold text-theme-primary mb-4">Room Layout</h3>
                                    <div className="bg-gradient-to-b from-theme-bg to-theme-card rounded-lg p-12 border-2 border-dashed border-theme-border">
                                        {/* Screen/Display Area */}
                                        <div className="mb-8">
                                            <div className="h-16 bg-theme-border flex items-center justify-center text-theme-primary font-bold mb-2 rounded-lg border border-theme-border shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-inner">
                                                Screen / Display Area
                                            </div>
                                            <p className="text-center text-sm text-theme-secondary">Front of Room</p>
                                        </div>

                                        {/* Seats Layout */}
                                        <div className="flex flex-col items-center gap-3 mb-6">
                                            {Array.from({ length: Math.ceil(selectedRoomType.capacity / 8) }).map((_, row) => (
                                                <div key={row} className="flex gap-3 justify-center">
                                                    {Array.from({ length: Math.min(8, selectedRoomType.capacity - row * 8) }).map((_, seat) => (
                                                        <button
                                                            key={`${row}-${seat}`}
                                                            className="w-10 h-10 bg-primary hover:bg-primary-dark text-white rounded-lg flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer"
                                                        >
                                                            {row * 8 + seat + 1}
                                                        </button>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>

                                        <p className="text-center text-sm text-theme-secondary">← Click to select your seat(s) →</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Booking Form */}
                    <div>
                        <div className="bg-theme-card rounded-xl border border-theme-border p-6 sticky top-8">
                            <h3 className="text-xl font-bold text-theme-primary mb-6">Book This Room</h3>

                            {bookingResult && (
                                <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${bookingResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
                                    }`}>
                                    {bookingResult.msg}
                                </div>
                            )}

                            <form className="space-y-4" onSubmit={async (e) => {
                                e.preventDefault();
                                const user = getCurrentUser();
                                if (!user) { setBookingResult({ ok: false, msg: 'Please log in first.' }); return; }
                                if (!selectedRoomType) return;
                                if (startSlot === null) { setBookingResult({ ok: false, msg: 'Please select at least one time slot.' }); return; }

                                setBookingSubmitting(true);
                                setBookingResult(null);
                                try {
                                    const min = startSlot !== null && endSlot !== null ? Math.min(startSlot, endSlot) : startSlot;
                                    const max = startSlot !== null && endSlot !== null ? Math.max(startSlot, endSlot) : startSlot;

                                    const sStr = ALL_SLOTS[min!].start;
                                    const eStr = ALL_SLOTS[max!].end;

                                    const attendeeCount = Number(bookAttendees) || 1;
                                    if (attendeeCount > selectedRoomType.capacity) {
                                        setBookingResult({ ok: false, msg: `Attendees cannot exceed room capacity (${selectedRoomType.capacity} people).` });
                                        return;
                                    }

                                    const result = await createBooking({
                                        uid: user.uid,
                                        catalog_id: selectedRoomType.catalog_id,
                                        room_id: selectedRoomType.id,
                                        start_date: activeDate,
                                        end_date: activeDate,
                                        start_time: sStr,
                                        end_time: eStr,
                                        purpose: bookPurpose,
                                        attendees: attendeeCount,
                                    });
                                    setBookingResult({ ok: true, msg: `✅ Booking confirmed! ID: ${result.booking_id}` });
                                    setBookDate(todayStr); setStartSlot(null); setEndSlot(null); setBookPurpose(''); setBookAttendees(1);
                                    // Navigate to ticket view after a short delay
                                    if (onBookingSuccess && selectedRoomType) {
                                        setTimeout(() => {
                                            onBookingSuccess({
                                                booking_id: result.booking_id,
                                                room_name: selectedRoomType.name,
                                                location: selectedRoomType.location,
                                                date: activeDate,
                                                start_time: sStr,
                                                end_time: eStr,
                                                purpose: bookPurpose,
                                                status: 'confirmed'
                                            });
                                        }, 800);
                                    }
                                } catch (err: any) {
                                    setBookingResult({ ok: false, msg: err.message });
                                } finally {
                                    setBookingSubmitting(false);
                                }
                            }}>
                                {/* Date Selection */}
                                <div>
                                    <label className="block text-sm font-semibold text-theme-primary mb-1.5">Reservation Date</label>
                                    <input
                                        type="date"
                                        value={activeDate}
                                        min={todayStr}
                                        onChange={e => { setBookDate(e.target.value); setSbSearched(false); }}
                                        required
                                        className="w-full p-3 rounded-xl border border-theme-border focus:outline-none focus:ring-2 focus:ring-primary bg-theme-bg font-medium text-sm text-theme-primary"
                                    />
                                </div>

                                {/* Time Slot Grid */}
                                <div>
                                    <label className="block text-sm font-semibold text-theme-primary mb-1.5">
                                        Select Time Slots
                                    </label>
                                    <p className="text-[10px] text-theme-secondary opacity-60 mb-3 uppercase tracking-wider">
                                        Click start slot, then end slot to define range
                                    </p>

                                    {loadingSlots ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {Array.from({ length: 4 }).map((_, i) => (
                                                <div key={i} className="h-10 bg-theme-bg/50 border border-theme-border rounded-xl animate-pulse" />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                            {ALL_SLOTS.map((slot, index) => {
                                                const status = getSlotStatus(slot);
                                                const selected = isSlotSelected(index);
                                                const isStart = index === startSlot;
                                                const isEnd = index === (endSlot ?? startSlot);

                                                let classes = 'relative flex items-center justify-center px-2 py-3 rounded-xl text-[11px] font-bold transition-all border-2 group ';

                                                // Find matching booking to show tooltip
                                                const matchingBooking = bookedSlots.find(b => {
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
                                                    classes += 'bg-theme-bg opacity-30 text-theme-secondary border-theme-border cursor-not-allowed line-through';
                                                } else if (status === 'booked') {
                                                    classes += 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-400 dark:border-rose-600 cursor-not-allowed font-black';
                                                } else if (selected) {
                                                    classes += 'bg-primary border-primary text-white shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/20 scale-[0.98]';
                                                } else {
                                                    classes += 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer hover:scale-[1.02] active:scale-95';
                                                }

                                                return (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        disabled={status !== 'available'}
                                                        onClick={() => handleSlotClick(index)}
                                                        className={classes}
                                                    >
                                                        {status === 'booked' ? (
                                                            <div className="flex items-center justify-center w-full relative">
                                                                <Lock size={12} className="mr-1" />
                                                                <span>Booked</span>
                                                                <div className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-56 p-3 bg-slate-800 border border-slate-700 rounded-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] text-white text-xs z-[100] text-left font-normal animate-in fade-in slide-in-from-bottom-1 duration-200 pointer-events-none">
                                                                    <p className="font-bold mb-2 border-b border-slate-700 pb-1 text-sm text-slate-200 flex items-center gap-2">
                                                                        <Eye size={14} /> Booking Details
                                                                    </p>
                                                                    {matchingBooking ? (
                                                                        <div className="space-y-1.5">
                                                                            <p><span className="text-slate-400 font-medium">By:</span> {matchingBooking.user_name || 'Unknown'}</p>
                                                                            {matchingBooking.purpose && <p className="border-t border-slate-700/50 pt-1 mt-1 break-words"><span className="text-slate-400 font-medium">Purpose:</span> {matchingBooking.purpose}</p>}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-slate-400 italic">Details not available</p>
                                                                    )}
                                                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2.5 h-2.5 bg-slate-800 rotate-45 -mt-1.25 border-r border-b border-slate-700"></div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            slot.label
                                                        )}
                                                        {selected && (isStart || isEnd) && (
                                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-secondary text-white rounded-full flex items-center justify-center text-[8px] border-2 border-white shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]">
                                                                {isStart ? 'S' : 'E'}
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {/* Legend */}
                                    <div className="flex gap-4 mt-3 justify-center">
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300" /><span className="text-[10px] text-theme-secondary opacity-60 font-bold uppercase">Available</span></div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-rose-100 dark:bg-rose-900/40 border border-rose-400" /><span className="text-[10px] text-theme-secondary opacity-60 font-bold uppercase">Booked</span></div>
                                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-theme-bg border border-theme-border opacity-40" /><span className="text-[10px] text-theme-secondary opacity-60 font-bold uppercase">Past</span></div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-theme-primary mb-2">Purpose</label>
                                    <textarea rows={3} value={bookPurpose} onChange={e => setBookPurpose(e.target.value)} className="w-full p-3 rounded-lg border border-theme-border focus:outline-none focus:ring-2 focus:ring-primary bg-theme-bg text-theme-primary" placeholder="Meeting purpose..."></textarea>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-theme-primary mb-2">Attendees</label>
                                    <p className="text-[10px] text-theme-secondary opacity-60 mb-1 uppercase tracking-wider">Max capacity: {selectedRoomType.capacity} people</p>
                                    <input
                                        type="number"
                                        min="1"
                                        max={selectedRoomType.capacity}
                                        value={bookAttendees}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === '') {
                                                setBookAttendees('');
                                            } else {
                                                setBookAttendees(parseInt(val) || 1);
                                            }
                                        }}
                                        required
                                        className="w-full p-3 rounded-xl border border-theme-border focus:outline-none focus:ring-2 focus:ring-primary bg-theme-bg text-theme-primary"
                                    />
                                </div>

                                <div className="pt-4 border-t border-theme-border">
                                    <button
                                        type="submit"
                                        disabled={bookingSubmitting || (selectedRoomType && Number(bookAttendees) > selectedRoomType.capacity)}
                                        className={`w-full py-3 rounded-lg font-bold shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] transition-all active:scale-[0.98] 
                                            ${(bookingSubmitting || (selectedRoomType && Number(bookAttendees) > selectedRoomType.capacity))
                                                ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-none'
                                                : 'bg-primary hover:bg-primary-dark text-white shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-teal-200/50'}`}
                                    >
                                        {bookingSubmitting ? 'Submitting...' : (selectedRoomType && Number(bookAttendees) > selectedRoomType.capacity) ? 'Capacity Exceeded' : 'Confirm Booking'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const advLocationOptions = [...new Set(rooms.map(r => r.location).filter(Boolean))];

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            {/* ── Page Header ── */}
            <div className="flex items-start justify-between mb-8 gap-4">
                <div>
                    {advancedMode
                        ? <button onClick={() => setAdvancedMode(false)} className="text-sm font-semibold text-theme-secondary hover:text-primary flex items-center gap-1.5 mb-2 transition-colors">
                            ← Back to Browse by Office
                        </button>
                        : null}
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Reserve a Space</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Find and book the perfect conference room for your needs</p>
                </div>

                {/* Quick Booking toggle button — top right */}
                {!advancedMode ? (
                    <button
                        onClick={() => setAdvancedMode(true)}
                        className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-violet-300/30 dark:shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-violet-900/40 transition-all active:scale-95"
                    >
                        <SlidersHorizontal size={16} weight="bold" />
                        Quick Booking
                    </button>
                ) : (
                    <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 text-sm font-bold border border-violet-200 dark:border-violet-800">
                        <SlidersHorizontal size={16} weight="bold" />
                        Quick Booking
                    </div>
                )}
            </div>


            {/* ── Advanced Search Panel ── */}
            {advancedMode && (
                <div className="pb-28 md:pb-10">
                    {/* Booking Mode Cards */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                        <button
                            onClick={() => setAdvBookingMode('by-slot')}
                            className={`p-4 rounded-2xl border-2 flex items-center gap-3 transition-all text-left ${advBookingMode === 'by-slot' ? 'border-primary bg-primary/5 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]' : 'border-theme-border bg-theme-card hover:border-primary/40'}`}
                        >
                            <div className={`p-2.5 rounded-xl shrink-0 ${advBookingMode === 'by-slot' ? 'bg-primary text-white' : 'bg-theme-bg text-theme-secondary'}`}><ListChecks size={22} /></div>
                            <div>
                                <p className={`font-bold text-sm leading-tight ${advBookingMode === 'by-slot' ? 'text-primary' : 'text-theme-primary'}`}>By Time Slot</p>
                                <p className="text-xs text-theme-secondary opacity-70 mt-0.5 hidden sm:block">Select specific 1-hour slots</p>
                            </div>
                        </button>
                        <button
                            onClick={() => setAdvBookingMode('full-day')}
                            className={`p-4 rounded-2xl border-2 flex items-center gap-3 transition-all text-left ${advBookingMode === 'full-day' ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]' : 'border-theme-border bg-theme-card hover:border-violet-300'}`}
                        >
                            <div className={`p-2.5 rounded-xl shrink-0 ${advBookingMode === 'full-day' ? 'bg-violet-500 text-white' : 'bg-theme-bg text-theme-secondary'}`}><Sun size={22} /></div>
                            <div>
                                <p className={`font-bold text-sm leading-tight ${advBookingMode === 'full-day' ? 'text-violet-700 dark:text-violet-400' : 'text-theme-primary'}`}>Entire Day</p>
                                <p className="text-xs text-theme-secondary opacity-70 mt-0.5 hidden sm:block">Book 09:00 – 18:00</p>
                            </div>
                        </button>
                    </div>

                    {/* Filters Panel */}
                    <div className="bg-theme-card border border-theme-border rounded-2xl overflow-hidden mb-6 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]">
                        {/* Row 1: Always-visible filters */}
                        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-theme-secondary uppercase tracking-wider mb-1"><CalendarBlank size={10} className="inline mr-1" />Date</label>
                                <input type="date" min={todayStr} max={maxBookDate} value={advDate} onChange={e => setAdvDate(e.target.value)} className="w-full px-3 py-2 bg-theme-bg border border-theme-border rounded-xl text-theme-primary text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-theme-secondary uppercase tracking-wider mb-1"><Buildings size={10} className="inline mr-1" />Location</label>
                                <select value={advLocation} onChange={e => setAdvLocation(e.target.value)} className="w-full px-3 py-2 bg-theme-bg border border-theme-border rounded-xl text-theme-primary text-sm focus:ring-2 focus:ring-primary outline-none">
                                    <option value="all">All Locations</option>
                                    {advLocationOptions.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-theme-secondary uppercase tracking-wider mb-1"><SquaresFour size={10} className="inline mr-1" />Room Type</label>
                                <select value={advRoomType} onChange={e => setAdvRoomType(e.target.value)} className="w-full px-3 py-2 bg-theme-bg border border-theme-border rounded-xl text-theme-primary text-sm focus:ring-2 focus:ring-primary outline-none">
                                    <option value="all">All Types</option>
                                    {ADV_ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-theme-secondary uppercase tracking-wider mb-1"><Users size={10} className="inline mr-1" />Min Capacity</label>
                                <input type="number" min="1" placeholder="Any size" value={advCapacity} onChange={e => setAdvCapacity(e.target.value)} className="w-full px-3 py-2 bg-theme-bg border border-theme-border rounded-xl text-theme-primary text-sm focus:ring-2 focus:ring-primary outline-none" />
                            </div>
                        </div>

                        {/* Row 2: Amenities (always visible, compact) */}
                        <div className="px-4 pb-3 border-t border-theme-border pt-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-bold text-theme-secondary uppercase tracking-wider shrink-0 mr-1"><Star size={10} className="inline mr-1" />Amenities:</span>
                                {ADV_AMENITIES.map(a => (
                                    <button key={a} onClick={() => setAdvAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
                                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${advAmenities.includes(a) ? 'bg-primary text-white border-primary' : 'bg-theme-bg text-theme-secondary border-theme-border hover:border-primary hover:text-primary'}`}>
                                        {a}
                                    </button>
                                ))}
                                {advAmenities.length > 0 && (
                                    <button onClick={() => setAdvAmenities([])} className="text-xs text-rose-500 hover:text-rose-700 font-bold ml-1 flex items-center gap-0.5"><X size={11} /> Clear</button>
                                )}
                            </div>
                        </div>

                        {/* Slot picker for By Time Slot mode */}
                        {advBookingMode === 'by-slot' && (
                            <div className="px-4 pb-4 border-t border-theme-border pt-3 bg-theme-bg/30">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-bold text-theme-secondary uppercase tracking-wider"><Clock size={10} className="inline mr-1" /> Filter by Specific Slots <span className="font-normal normal-case opacity-70">(optional — show only rooms with these slots free)</span></p>
                                    {advSlotIndices.length > 0 && <button onClick={() => setAdvSlotIndices([])} className="text-xs text-rose-500 hover:underline font-bold shrink-0">Clear</button>}
                                </div>
                                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5">
                                    {ALL_SLOTS.map((slot, idx) => {
                                        const past = advIsPast(slot); const sel = advSlotIndices.includes(idx);
                                        return (
                                            <button key={slot.start} type="button" disabled={past}
                                                onClick={() => setAdvSlotIndices(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx].sort((a, b) => a - b))}
                                                className={`py-2 px-1 rounded-xl text-[10px] font-bold border-2 transition-all leading-tight text-center ${past ? 'opacity-20 line-through border-theme-border cursor-not-allowed bg-theme-bg' : sel ? 'bg-primary text-white border-primary shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]' : 'bg-theme-bg text-theme-secondary border-theme-border hover:border-primary hover:text-primary cursor-pointer'}`}
                                            >
                                                {slot.label.replace(' – ', '\n–')}
                                            </button>
                                        );
                                    })}
                                </div>
                                {advSlotIndices.length > 0 && (
                                    <p className="mt-2 text-xs text-primary font-semibold">
                                        ✓ {advSlotIndices.length} slot{advSlotIndices.length > 1 ? 's' : ''} · {ALL_SLOTS[advSlotIndices[0]].start.slice(0, 5)} – {ALL_SLOTS[advSlotIndices[advSlotIndices.length - 1]].end.slice(0, 5)}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Full-day info banner */}
                        {advBookingMode === 'full-day' && (
                            <div className="px-4 py-3 border-t border-theme-border bg-violet-50 dark:bg-violet-950/20 flex items-center gap-2">
                                <Sun size={14} className="text-violet-500 shrink-0" />
                                <p className="text-xs font-semibold text-violet-700 dark:text-violet-400">
                                    Showing rooms with <strong>all 9 slots</strong> (09:00–18:00) completely free on {advDate}
                                </p>
                            </div>
                        )}

                        {/* Footer: active filters summary + refresh */}
                        <div className="px-4 py-2.5 border-t border-theme-border bg-theme-bg/20 flex items-center gap-2 flex-wrap">
                            {/* Active filter pills */}
                            {advLocation !== 'all' && <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20">{advLocation} <button onClick={() => setAdvLocation('all')}><X size={10} /></button></span>}
                            {advRoomType !== 'all' && <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-full border border-indigo-200 dark:border-indigo-800">{advRoomType} <button onClick={() => setAdvRoomType('all')}><X size={10} /></button></span>}
                            {advCapacity && <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full border border-emerald-200 dark:border-emerald-800">≥{advCapacity} people <button onClick={() => setAdvCapacity('')}><X size={10} /></button></span>}
                            <div className="ml-auto flex items-center gap-2">
                                {advLoading && <span className="text-xs text-theme-secondary opacity-60 flex items-center gap-1"><div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> Searching...</span>}
                                <button onClick={() => doAdvancedSearch(rooms)} disabled={advLoading} title="Refresh results" className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs transition-all disabled:opacity-60">
                                    <ArrowsClockwise size={13} className={advLoading ? 'animate-spin' : ''} /> Refresh
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── Results ── */}
                    {advLoading && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="bg-theme-card border border-theme-border rounded-2xl overflow-hidden animate-pulse">
                                    <div className="h-32 bg-theme-bg/60" />
                                    <div className="p-4 space-y-3">
                                        <div className="h-4 bg-theme-bg/60 rounded-lg w-3/4" />
                                        <div className="h-3 bg-theme-bg/60 rounded-lg w-1/2" />
                                        <div className="flex gap-2"><div className="h-6 bg-theme-bg/60 rounded-full w-16" /><div className="h-6 bg-theme-bg/60 rounded-full w-20" /></div>
                                        <div className="h-9 bg-theme-bg/60 rounded-xl w-full mt-2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!advLoading && advSearched && advResults.length === 0 && (
                        <div className="text-center py-16 px-4">
                            <Warning size={52} className="mx-auto mb-4 text-amber-400 opacity-50" />
                            <p className="font-bold text-xl text-theme-primary mb-2">No rooms available</p>
                            <p className="text-sm text-theme-secondary opacity-70 max-w-sm mx-auto">
                                {advBookingMode === 'full-day'
                                    ? `No rooms have all 9 time slots free on ${advDate}. Try a different date or switch to "By Time Slot" mode.`
                                    : advSlotIndices.length > 0
                                    ? `No rooms with all ${advSlotIndices.length} selected slot(s) free. Try fewer slots, a different date, or remove filters.`
                                    : 'No active rooms match your current filters. Try adjusting location, capacity, or amenity requirements.'}
                            </p>
                            <button onClick={() => { setAdvLocation('all'); setAdvRoomType('all'); setAdvCapacity(''); setAdvAmenities([]); setAdvSlotIndices([]); }} className="mt-4 px-5 py-2 border-2 border-theme-border text-theme-secondary rounded-xl text-sm font-bold hover:border-primary hover:text-primary transition-all">
                                Clear All Filters
                            </button>
                        </div>
                    )}

                    {!advLoading && advResults.length > 0 && (() => {
                        // Group rooms by location
                        const byLocation: Record<string, typeof advResults> = {};
                        advResults.forEach(room => {
                            const loc = room.location || 'Other';
                            if (!byLocation[loc]) byLocation[loc] = [];
                            byLocation[loc].push(room);
                        });
                        const locations = Object.keys(byLocation).sort();
                        return (
                            <>
                                {/* Summary bar */}
                                <div className="flex items-center gap-3 mb-5 flex-wrap">
                                    <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-black rounded-full border border-emerald-200 dark:border-emerald-800">
                                        {advResults.length} room{advResults.length !== 1 ? 's' : ''} across {locations.length} location{locations.length !== 1 ? 's' : ''}
                                    </span>
                                    <span className="text-xs text-theme-secondary">
                                        {advDate}
                                        {advBookingMode === 'full-day' ? ' · All-day booking (09:00–18:00)' : advSlotIndices.length > 0 ? ` · ${ALL_SLOTS[advSlotIndices[0]].start.slice(0, 5)}–${ALL_SLOTS[advSlotIndices[advSlotIndices.length - 1]].end.slice(0, 5)}` : ' · Rooms with any free slot'}
                                    </span>
                                    {/* Expand/collapse all */}
                                    <div className="ml-auto flex gap-2">
                                        <button onClick={() => setCollapsedLocations(new Set())} className="text-xs text-theme-secondary hover:text-primary font-semibold transition-colors">Expand all</button>
                                        <span className="text-theme-border">|</span>
                                        <button onClick={() => setCollapsedLocations(new Set(locations))} className="text-xs text-theme-secondary hover:text-primary font-semibold transition-colors">Collapse all</button>
                                    </div>
                                </div>

                                {/* Location accordion sections */}
                                <div className="space-y-4">
                                    {locations.map(loc => {
                                        const locRooms = byLocation[loc];
                                        const isOpen = !collapsedLocations.has(loc);
                                        const toggle = () => setCollapsedLocations(prev => {
                                            const next = new Set(prev);
                                            if (next.has(loc)) next.delete(loc); else next.add(loc);
                                            return next;
                                        });
                                        return (
                                            <div key={loc} className="border border-theme-border rounded-2xl overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]">
                                                {/* Location header / toggle */}
                                                <button
                                                    onClick={toggle}
                                                    className="w-full flex items-center justify-between px-5 py-4 bg-theme-card hover:bg-theme-bg/60 transition-colors text-left group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                                            <Buildings size={18} />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-base text-theme-primary leading-tight">{loc}</h3>
                                                            <p className="text-xs text-theme-secondary opacity-60 mt-0.5">
                                                                {locRooms.length} room{locRooms.length !== 1 ? 's' : ''} available
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-black rounded-full border border-emerald-200 dark:border-emerald-800">
                                                            {locRooms.length} available
                                                        </span>
                                                        <div className={`p-1.5 rounded-lg border border-theme-border bg-theme-bg transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-theme-secondary">
                                                                <polyline points="6 9 12 15 18 9" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                </button>

                                                {/* Room cards grid */}
                                                {isOpen && (
                                                    <div className="px-4 pb-4 pt-3 bg-theme-bg/30 border-t border-theme-border">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {locRooms.map(room => (
                                                                <div key={`${room.catalog_id}-${room.id}`} className="bg-theme-card border border-theme-border rounded-2xl overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] hover:-translate-y-1 transition-all duration-200 flex flex-col group">
                                                                    <div className="h-40 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 overflow-hidden relative">
                                                                        {room.image
                                                                            ? <img src={room.image} alt={room.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                                            : <div className="w-full h-full flex items-center justify-center opacity-10"><Buildings size={56} /></div>}
                                                                        <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-black text-white shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] ${advBookingMode === 'full-day' ? 'bg-violet-600' : 'bg-emerald-600'}`}>
                                                                            {advBookingMode === 'full-day' ? '🌅 Full Day' : `${room.availableSlots.length}/${ALL_SLOTS.length} free`}
                                                                        </div>
                                                                    </div>
                                                                    <div className="p-4 flex flex-col flex-1">
                                                                        <h3 className="font-bold text-theme-primary text-base leading-tight">{room.name}</h3>
                                                                        {room.type && <span className="text-[11px] text-theme-secondary opacity-60 mt-0.5 mb-3">{room.type}</span>}

                                                                        {/* Capacity */}
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <Users size={13} className="text-primary shrink-0" />
                                                                            <div className="flex-1">
                                                                                <div className="flex justify-between items-center mb-0.5">
                                                                                    <span className="text-[10px] text-theme-secondary font-semibold">Capacity</span>
                                                                                    <span className="text-[10px] font-black text-theme-primary">{room.capacity} people</span>
                                                                                </div>
                                                                                <div className="h-1.5 bg-theme-bg rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.min((room.capacity / 50) * 100, 100)}%` }} /></div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Slots */}
                                                                        {advBookingMode === 'by-slot' && room.availableSlots.length > 0 && (
                                                                            <div className="mb-3 flex flex-wrap gap-1">
                                                                                {room.availableSlots.slice(0, 4).map(s => (
                                                                                    <span key={s.start} className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold rounded border border-emerald-200 dark:border-emerald-800">{s.label}</span>
                                                                                ))}
                                                                                {room.availableSlots.length > 4 && <span className="px-1.5 py-0.5 text-[9px] text-theme-secondary opacity-50 font-bold">+{room.availableSlots.length - 4} more</span>}
                                                                            </div>
                                                                        )}
                                                                        {advBookingMode === 'full-day' && (
                                                                            <div className="mb-3">
                                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 text-xs font-bold rounded-lg border border-violet-200 dark:border-violet-800">
                                                                                    <Sun size={11} /> Fully available 09:00–18:00
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        {/* Amenities */}
                                                                        {room.amenities.length > 0 && (
                                                                            <div className="mb-4 flex flex-wrap gap-1">
                                                                                {room.amenities.slice(0, 3).map(a => <span key={a} className="px-2 py-0.5 bg-theme-bg text-theme-secondary text-[9px] font-semibold rounded-full border border-theme-border capitalize">{a.replace('-', ' ')}</span>)}
                                                                                {room.amenities.length > 3 && <span className="text-[9px] text-theme-secondary opacity-50">+{room.amenities.length - 3}</span>}
                                                                            </div>
                                                                        )}

                                                                        <button
                                                                            onClick={() => advOpenBooking(room)}
                                                                            className={`mt-auto w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-bold transition-all shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] active:scale-95 ${advBookingMode === 'full-day' ? 'bg-violet-600 hover:bg-violet-700 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-violet-300/30 dark:shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-violet-900/40' : 'bg-primary hover:bg-primary-dark shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/20'}`}
                                                                        >
                                                                            Book Now <ArrowRight size={15} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        );
                    })()}

                    {/* ── Booking Confirmation Modal ── */}
                    {advBookingRoom && (
                        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setAdvBookingRoom(null); }}>
                            <div className="bg-theme-card rounded-2xl border border-theme-border shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] w-full max-w-md max-h-[90vh] overflow-y-auto">
                                {/* Modal Header */}
                                <div className={`sticky top-0 px-5 py-4 flex justify-between items-start rounded-t-2xl border-b border-theme-border ${advBookingMode === 'full-day' ? 'bg-gradient-to-r from-violet-600 to-indigo-600' : 'bg-gradient-to-r from-primary to-primary-dark'} text-white`}>
                                    <div>
                                        <h2 className="font-bold text-lg">Confirm Booking</h2>
                                        <p className="text-sm opacity-80">{advBookingRoom.name}</p>
                                    </div>
                                    <button onClick={() => setAdvBookingRoom(null)} className="opacity-70 hover:opacity-100 p-1 -mr-1 -mt-1"><X size={22} /></button>
                                </div>
                                <div className="p-5 space-y-4">
                                    {/* Summary card */}
                                    <div className="bg-theme-bg border border-theme-border rounded-xl overflow-hidden">
                                        {[
                                            ['📍 Room', advBookingRoom.name],
                                            ['🏢 Location', advBookingRoom.location || '—'],
                                            ['📅 Date', advDate],
                                            ['🕐 Time', advBookingMode === 'full-day' ? '09:00 – 18:00 (Full Day, 9 hours)' : advBookSlots.length > 0 ? `${advBookSlots[0].start.slice(0, 5)} – ${advBookSlots[advBookSlots.length - 1].end.slice(0, 5)} (${advBookSlots.length} hour${advBookSlots.length > 1 ? 's' : ''})` : '—'],
                                        ].map(([label, value]) => (
                                            <div key={label as string} className="px-4 py-2.5 flex justify-between gap-4 items-start border-b border-theme-border last:border-0">
                                                <span className="text-xs text-theme-secondary font-semibold whitespace-nowrap">{label}</span>
                                                <span className="text-xs text-theme-primary font-bold text-right">{value}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Purpose */}
                                    <div>
                                        <label className="block text-xs font-bold text-theme-secondary uppercase tracking-wider mb-1.5">Purpose <span className="font-normal normal-case opacity-60">(optional)</span></label>
                                        <textarea rows={2} value={advBookPurpose} onChange={e => setAdvBookPurpose(e.target.value)} placeholder="e.g. Team standup, Client presentation..." className="w-full px-3 py-2.5 bg-theme-bg border border-theme-border rounded-xl text-theme-primary text-sm focus:ring-2 focus:ring-primary outline-none resize-none" />
                                    </div>

                                    {/* Attendees */}
                                    <div>
                                        <label className="block text-xs font-bold text-theme-secondary uppercase tracking-wider mb-1.5">
                                            Attendees <span className="font-normal normal-case opacity-60">(max {advBookingRoom.capacity})</span>
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <button type="button" onClick={() => setAdvBookAttendees(a => Math.max(1, a - 1))} className="w-8 h-8 rounded-full border-2 border-theme-border text-theme-primary font-bold hover:border-primary hover:text-primary transition-all flex items-center justify-center text-lg">−</button>
                                            <span className="text-xl font-black text-theme-primary w-8 text-center">{advBookAttendees}</span>
                                            <button type="button" onClick={() => setAdvBookAttendees(a => Math.min(advBookingRoom!.capacity, a + 1))} className="w-8 h-8 rounded-full border-2 border-theme-border text-theme-primary font-bold hover:border-primary hover:text-primary transition-all flex items-center justify-center text-lg">+</button>
                                            <div className="flex-1 h-2 bg-theme-bg/60 rounded-full overflow-hidden border border-theme-border">
                                                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(advBookAttendees / advBookingRoom.capacity) * 100}%` }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Result message */}
                                    {advBookMsg && (
                                        <div className={`flex items-start gap-2.5 p-3.5 rounded-xl text-sm border ${advBookMsg.ok ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'}`}>
                                            {advBookMsg.ok ? <CheckCircle size={18} weight="fill" className="shrink-0 mt-0.5" /> : <Warning size={18} weight="fill" className="shrink-0 mt-0.5" />}
                                            <span className="font-semibold">{advBookMsg.text}</span>
                                        </div>
                                    )}

                                    {/* Confirm button */}
                                    <button
                                        onClick={advConfirmBooking}
                                        disabled={advBookLoading || !!advBookMsg?.ok}
                                        className={`w-full py-3 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 ${advBookingMode === 'full-day' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700' : 'bg-primary hover:bg-primary-dark'}`}
                                    >
                                        {advBookLoading
                                            ? <><div className="w-4 h-4 border-2 border-theme-border border-t-white rounded-full animate-spin" /> Booking...</>
                                            : advBookMsg?.ok
                                            ? <><CheckCircle size={16} weight="fill" /> Booked!</>
                                            : <><CheckCircle size={16} /> Confirm Booking</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!advancedMode && (

            <div className="flex flex-col lg:flex-row gap-8">
                {/* ── MOBILE: Floating Action Button (FAB) for Filters ── */}
                {!selectedOffice && ( // Only show on the main search view, not inside a specific room type view
                    <button
                        className="lg:hidden fixed bottom-[90px] right-6 z-[60] bg-primary text-white p-4 rounded-full shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/30 active:scale-95 transition-transform"
                        onClick={() => setIsMobileFilterOpen(true)}
                    >
                        <Funnel size={26} weight="fill" />
                    </button>
                )}

                {/* ── MOBILE: Filter Modal ── */}
                {isMobileFilterOpen && (
                    <div className="lg:hidden fixed inset-0 z-[100] bg-theme-bg/60 backdrop-blur-sm flex items-end justify-center p-4">
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
                                <h3 className="text-xl font-bold text-theme-primary">Quick Filters</h3>
                            </div>

                            <div className="flex flex-col gap-5">
                                {/* Search Bar */}
                                <div>
                                    <label className="block text-sm font-semibold text-theme-primary mb-2">Search</label>
                                    <div className="relative">
                                        <MagnifyingGlass size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-secondary opacity-60" />
                                        <input
                                            type="text"
                                            placeholder="Location or name..."
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                applyFilters(undefined, undefined, undefined, undefined, e.target.value);
                                            }}
                                            className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-theme-bg font-medium"
                                        />
                                    </div>
                                </div>

                                {/* Room Type */}
                                <div>
                                    <label className="block text-sm font-semibold text-theme-primary mb-2">Room Type</label>
                                    <select
                                        className="w-full p-3.5 rounded-xl border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary bg-theme-bg font-medium"
                                        value={selectedRoomTypes[0] || ""}
                                        onChange={(e) => {
                                            const val = e.target.value ? [e.target.value] : [];
                                            setSelectedRoomTypes(val);
                                            applyFilters(val, undefined, undefined, undefined, undefined);
                                        }}
                                    >
                                        <option value="">All Room Types</option>
                                        {filters.roomType.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>

                                {/* Location */}
                                <div>
                                    <label className="block text-sm font-semibold text-theme-primary mb-2">Location</label>
                                    <select
                                        className="w-full p-3.5 rounded-xl border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary bg-theme-bg font-medium"
                                        value={selectedLocations[0] || ""}
                                        onChange={(e) => {
                                            const val = e.target.value ? [e.target.value] : [];
                                            setSelectedLocations(val);
                                            applyFilters(undefined, val, undefined, undefined, undefined);
                                        }}
                                    >
                                        <option value="">All Locations</option>
                                        {filters.location.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>

                                {/* Capacity */}
                                <div>
                                    <label className="block text-sm font-semibold text-theme-primary mb-2">Capacity</label>
                                    <select
                                        className="w-full p-3.5 rounded-xl border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary bg-theme-bg font-medium"
                                        value={selectedCapacity[0] || ""}
                                        onChange={(e) => {
                                            const val = e.target.value ? [e.target.value] : [];
                                            setSelectedCapacity(val);
                                            applyFilters(undefined, undefined, undefined, val, undefined);
                                        }}
                                    >
                                        <option value="">All Capacities</option>
                                        {filters.capacity.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                {/* Amenities */}
                                <div>
                                    <label className="block text-sm font-semibold text-theme-primary mb-2">Amenities</label>
                                    <select
                                        className="w-full p-3.5 rounded-xl border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary bg-theme-bg font-medium capitalize"
                                        value={selectedAmenities[0] || ""}
                                        onChange={(e) => {
                                            const val = e.target.value ? [e.target.value] : [];
                                            setSelectedAmenities(val);
                                            applyFilters(undefined, undefined, val, undefined, undefined);
                                        }}
                                    >
                                        <option value="">All Amenities</option>
                                        {filters.amenities.map(a => <option key={a} value={a}>{a.replace('-', ' ')}</option>)}
                                    </select>
                                </div>

                                <button 
                                    onClick={() => setIsMobileFilterOpen(false)}
                                    className="mt-2 w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/20 transition-transform active:scale-[0.98]"
                                >
                                    Show Results
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── DESKTOP: Filters Sidebar ── */}
                <div className="hidden lg:block w-64 shrink-0">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Funnel size={18} className="text-primary" />
                            <h2 className="font-bold text-base text-theme-primary">Filters</h2>
                        </div>
                        {(selectedRoomTypes.length > 0 || selectedLocations.length > 0 || selectedAmenities.length > 0 || selectedCapacity.length > 0) && (
                            <button
                                onClick={() => { setSelectedRoomTypes([]); setSelectedLocations([]); setSelectedAmenities([]); setSelectedCapacity([]); setFilteredRooms(rooms); setHasFiltered(false); }}
                                className="text-xs text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1"
                            >
                                <X size={11} /> Clear all
                            </button>
                        )}
                    </div>

                    <div className="bg-theme-card border border-theme-border rounded-2xl overflow-hidden shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] divide-y divide-theme-border">

                        {/* ── Room Type ── */}
                        <div>
                            <button
                                onClick={() => setSidebarOpen(s => ({ ...s, roomType: !s.roomType }))}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-theme-bg/50 transition-colors"
                            >
                                <span className="font-semibold text-sm text-theme-primary">
                                    Room Type
                                    {selectedRoomTypes.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-primary text-white text-[9px] font-black rounded-full">{selectedRoomTypes.length}</span>}
                                </span>
                                <CaretDown size={14} className={`text-theme-secondary transition-transform duration-200 ${sidebarOpen.roomType ? 'rotate-180' : ''}`} />
                            </button>
                            {sidebarOpen.roomType && (
                                <div className="px-4 pb-3 space-y-2.5">
                                    {filters.roomType.map(type => (
                                        <label key={type} className="flex items-center gap-2.5 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={selectedRoomTypes.includes(type)}
                                                onChange={() => handleRoomTypeChange(type)}
                                                className="w-4 h-4 rounded border-theme-border text-primary focus:ring-primary bg-theme-bg accent-primary"
                                            />
                                            <span className="text-sm text-theme-secondary group-hover:text-primary transition-colors">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Location ── */}
                        <div>
                            <button
                                onClick={() => setSidebarOpen(s => ({ ...s, location: !s.location }))}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-theme-bg/50 transition-colors"
                            >
                                <span className="font-semibold text-sm text-theme-primary">
                                    Location
                                    {selectedLocations.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-primary text-white text-[9px] font-black rounded-full">{selectedLocations.length}</span>}
                                </span>
                                <CaretDown size={14} className={`text-theme-secondary transition-transform duration-200 ${sidebarOpen.location ? 'rotate-180' : ''}`} />
                            </button>
                            {sidebarOpen.location && (
                                <div className="px-4 pb-3 space-y-2.5">
                                    {locations.map(loc => (
                                        <label key={loc.location_id} className="flex items-center gap-2.5 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={selectedLocations.includes(loc.location_id)}
                                                onChange={() => handleLocationChange(loc.location_id)}
                                                className="w-4 h-4 rounded border-theme-border text-primary focus:ring-primary bg-theme-bg accent-primary"
                                            />
                                            <span className="text-sm text-theme-secondary group-hover:text-primary transition-colors">{loc.name}</span>
                                        </label>
                                    ))}
                                </div>

                            )}
                        </div>

                        {/* ── Amenities ── */}
                        <div>
                            <button
                                onClick={() => setSidebarOpen(s => ({ ...s, amenities: !s.amenities }))}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-theme-bg/50 transition-colors"
                            >
                                <span className="font-semibold text-sm text-theme-primary">
                                    Amenities
                                    {selectedAmenities.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-primary text-white text-[9px] font-black rounded-full">{selectedAmenities.length}</span>}
                                </span>
                                <CaretDown size={14} className={`text-theme-secondary transition-transform duration-200 ${sidebarOpen.amenities ? 'rotate-180' : ''}`} />
                            </button>
                            {sidebarOpen.amenities && (
                                <div className="px-4 pb-3 space-y-2.5">
                                    {filters.amenities.map(amenity => (
                                        <label key={amenity} className="flex items-center gap-2.5 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={selectedAmenities.includes(amenity)}
                                                onChange={() => handleAmenityChange(amenity)}
                                                className="w-4 h-4 rounded border-theme-border text-primary focus:ring-primary bg-theme-bg accent-primary"
                                            />
                                            <span className="text-sm text-theme-secondary group-hover:text-primary transition-colors capitalize">{amenity.replace('-', ' ')}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Capacity ── */}
                        <div>
                            <button
                                onClick={() => setSidebarOpen(s => ({ ...s, capacity: !s.capacity }))}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-theme-bg/50 transition-colors"
                            >
                                <span className="font-semibold text-sm text-theme-primary">
                                    Capacity
                                    {selectedCapacity.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-primary text-white text-[9px] font-black rounded-full">{selectedCapacity.length}</span>}
                                </span>
                                <CaretDown size={14} className={`text-theme-secondary transition-transform duration-200 ${sidebarOpen.capacity ? 'rotate-180' : ''}`} />
                            </button>
                            {sidebarOpen.capacity && (
                                <div className="px-4 pb-3 space-y-2.5">
                                    {filters.capacity.map(cap => (
                                        <label key={cap} className="flex items-center gap-2.5 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={selectedCapacity.includes(cap)}
                                                onChange={() => handleCapacityChange(cap)}
                                                className="w-4 h-4 rounded border-theme-border text-primary focus:ring-primary bg-theme-bg accent-primary"
                                            />
                                            <span className="text-sm text-theme-secondary group-hover:text-primary transition-colors">{cap}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Availability ── */}
                        <div>
                            <button
                                onClick={() => setSidebarOpen(s => ({ ...s, avail: !s.avail }))}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-theme-bg/50 transition-colors"
                            >
                                <span className="font-semibold text-sm text-theme-primary">
                                    Availability
                                    {sbSearched && <span className="ml-1.5 px-1.5 py-0.5 bg-primary text-white text-[9px] font-black rounded-full">{sbAvailRoomIds.size}</span>}
                                </span>
                                <CaretDown size={14} className={`text-theme-secondary transition-transform duration-200 ${sidebarOpen.avail ? 'rotate-180' : ''}`} />
                            </button>
                            {sidebarOpen.avail && (
                                <div className="px-4 pb-4 space-y-3">
                                    {/* Mode toggle */}
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <button
                                            onClick={() => { setSbMode('by-slot'); setSbSlotIndices([]); }}
                                            className={`flex flex-col items-center py-2.5 px-2 rounded-xl border-2 transition-all text-center ${
                                                sbMode === 'by-slot'
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-theme-border bg-theme-bg text-theme-secondary hover:border-primary/30'
                                            }`}
                                        >
                                            <span className="text-base mb-0.5">🕐</span>
                                            <span className="text-[10px] font-bold leading-tight">By Time Slot</span>
                                        </button>
                                        <button
                                            onClick={() => { setSbMode('full-day'); setSbSlotIndices([]); setSbDates(prev => prev.slice(0,1)); }}
                                            className={`flex flex-col items-center py-2.5 px-2 rounded-xl border-2 transition-all text-center ${
                                                sbMode === 'full-day'
                                                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                                                    : 'border-theme-border bg-theme-bg text-theme-secondary hover:border-amber-400/30'
                                            }`}
                                        >
                                            <span className="text-base mb-0.5">☀️</span>
                                            <span className="text-[10px] font-bold leading-tight">Entire Day</span>
                                        </button>
                                    </div>

                                    {/* Date picker */}
                                    <div>
                                        <p className="text-[10px] font-bold text-theme-secondary uppercase tracking-wider mb-1.5">
                                            {sbMode === 'by-slot' ? 'Select Dates (multiple)' : 'Select Date'}
                                        </p>
                                        <div className="flex gap-1.5">
                                            <input
                                                type="date"
                                                value={sbDateInput}
                                                min={todayStr}
                                                max={maxBookDate}
                                                onChange={e => setSbDateInput(e.target.value)}
                                                className="flex-1 px-2 py-1.5 rounded-lg border border-theme-border bg-theme-bg text-theme-primary text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                            />
                                            <button
                                                disabled={!sbDateInput}
                                                onClick={() => {
                                                    if (!sbDateInput) return;
                                                    if (sbMode === 'full-day') {
                                                        setSbDates([sbDateInput]);
                                                    } else if (!sbDates.includes(sbDateInput)) {
                                                        setSbDates(prev => [...prev, sbDateInput].sort());
                                                    }
                                                    setSbDateInput('');
                                                }}
                                                className="px-2.5 py-1.5 bg-primary text-white text-xs font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-dark transition-colors"
                                            >
                                                Add
                                            </button>
                                        </div>
                                        {/* Selected date chips */}
                                        {sbDates.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {sbDates.map(d => (
                                                    <span key={d} className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">
                                                        {d}
                                                        <button onClick={() => setSbDates(prev => prev.filter(x => x !== d))} className="hover:text-rose-500">&times;</button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Time slots (only for by-slot mode) */}
                                    {sbMode === 'by-slot' && (
                                        <div>
                                            <p className="text-[10px] font-bold text-theme-secondary uppercase tracking-wider mb-1.5">Select Time Slots</p>
                                            <div className="grid grid-cols-1 gap-1">
                                                {ALL_SLOTS.map((slot, idx) => (
                                                    <button
                                                        key={slot.label}
                                                        onClick={() => setSbSlotIndices(prev =>
                                                            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                                                        )}
                                                        className={`py-1.5 px-2 rounded-lg border text-[10px] font-semibold transition-all ${
                                                            sbSlotIndices.includes(idx)
                                                                ? 'bg-primary text-white border-primary'
                                                                : 'bg-theme-bg text-theme-secondary border-theme-border hover:border-primary/40'
                                                        }`}
                                                    >
                                                        {slot.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Check Availability button */}
                                    <button
                                        disabled={sbDates.length === 0 || sbLoading || (sbMode === 'by-slot' && sbSlotIndices.length === 0)}
                                        onClick={async () => {
                                            setSbLoading(true); setSbSearched(false); setSbAvailRoomIds(new Set());
                                            try {
                                                const availIds = new Set<string>();
                                                const activeRooms = rooms.filter(r => !r.isInactive);
                                                await Promise.all(activeRooms.map(async room => {
                                                    try {
                                                        // Check all selected dates — room must be free on ALL of them
                                                        const allDatesFree = await Promise.all(sbDates.map(async date => {
                                                            const booked = await fetchRoomAvailability(room.catalog_id, room.id, date);
                                                            if (sbMode === 'full-day') {
                                                                return ALL_SLOTS.every(s => !advHasConflict(s, booked));
                                                            } else {
                                                                return sbSlotIndices.every(i => !advHasConflict(ALL_SLOTS[i], booked));
                                                            }
                                                        }));
                                                        if (allDatesFree.every(Boolean)) availIds.add(room.id);
                                                    } catch { /* skip room on error */ }
                                                }));
                                                setSbAvailRoomIds(availIds);
                                                setSbSearched(true);
                                            } finally { setSbLoading(false); }
                                        }}
                                        className="w-full py-2.5 rounded-xl text-white text-xs font-black bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-primary/20 flex items-center justify-center gap-2"
                                    >
                                        {sbLoading ? <><span className="animate-spin">⟳</span> Checking...</> : '🔍 Check Availability'}
                                    </button>

                                    {/* Result summary */}
                                    {sbSearched && !sbLoading && (
                                        <div className="text-center">
                                            <p className="text-xs font-bold text-primary">{sbAvailRoomIds.size} room{sbAvailRoomIds.size !== 1 ? 's' : ''} available</p>
                                            <button onClick={() => { setSbSearched(false); setSbAvailRoomIds(new Set()); setSbDates([]); setSbSlotIndices([]); }} className="text-[10px] text-rose-500 hover:underline mt-0.5">Clear availability filter</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1">
                    {/* Desktop Search Bar */}
                    <div className="hidden lg:block mb-6">
                        <div className="relative">
                            <MagnifyingGlass size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-secondary opacity-60" />
                            <input
                                type="text"
                                placeholder="Search by location or office name..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    applyFilters(undefined, undefined, undefined, undefined, e.target.value);
                                }}
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-theme-bg"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-6">
                        <span className="text-theme-secondary font-medium">{getUniqueOffices().length} offices available</span>
                    </div>

                    {/* Office Cards — 3-column premium layout */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {getUniqueOffices().map((office) => {
                            const officeRooms = getRoomTypesForOffice(office.location);
                            const uniqueTypes = Array.from(new Set(officeRooms.map(r => r.type).filter(Boolean)));
                            const activeRooms = officeRooms.filter(r => !r.isInactive);
                            return (
                                <div
                                    key={office.location}
                                    onClick={() => setSelectedOffice(office.location)}
                                    className="relative group cursor-pointer rounded-2xl overflow-hidden border border-theme-border shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] hover:-translate-y-1.5 transition-all duration-300 bg-theme-card"
                                >
                                    {/* Image with gradient overlay */}
                                    <div className="relative h-52 overflow-hidden">
                                        <img
                                            src={office.image}
                                            alt={office.name}
                                            referrerPolicy="no-referrer"
                                            crossOrigin="anonymous"
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                        />
                                        {/* Dark gradient */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                                        {/* Room count badge */}
                                        <div className="absolute top-3 right-3">
                                            <span className="px-2.5 py-1 text-[11px] font-bold text-white rounded-full bg-slate-500/90 backdrop-blur-sm shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] border border-white/10">
                                                {activeRooms.length} room{activeRooms.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>

                                        {/* Location name over image */}
                                        <div className="absolute bottom-0 left-0 right-0 p-4">
                                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-primary/90 text-white text-[10px] font-bold mb-2 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] border border-white/10">
                                                <Buildings size={11} />
                                                Office
                                            </div>
                                            <h3 className="text-white font-bold text-lg leading-tight drop-shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)]">
                                                {office.name}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Info section */}
                                    <div className="p-4">
                                        {/* Room type pills */}
                                        {uniqueTypes.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5 mb-4">
                                                {uniqueTypes.slice(0, 3).map(type => (
                                                    <span
                                                        key={type}
                                                        className="px-2.5 py-0.5 text-[10px] font-semibold bg-theme-bg border border-theme-border text-theme-secondary rounded-full group-hover:border-primary/40 group-hover:text-primary transition-colors"
                                                    >
                                                        {type}
                                                    </span>
                                                ))}
                                                {uniqueTypes.length > 3 && (
                                                    <span className="px-2 py-0.5 text-[10px] font-semibold text-theme-secondary opacity-50">
                                                        +{uniqueTypes.length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-theme-secondary opacity-50 mb-4">No rooms assigned yet</p>
                                        )}

                                        {/* Stats row */}
                                        <div className="flex items-center justify-end text-xs text-theme-secondary mb-4 pb-3 border-b border-theme-border">
                                            <span className="flex items-center gap-1">
                                                <SquaresFour size={12} className="text-primary" />
                                                {uniqueTypes.length} type{uniqueTypes.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>

                                        {/* CTA */}
                                        <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold bg-primary hover:bg-primary-dark shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]-[0_8px_32px_0_rgba(31,38,135,0.05)] transition-colors">
                                            Explore Rooms <ArrowRight size={15} weight="bold" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                </div>
            </div>
            )}
        </div>
    );
};

export default SearchPage;
