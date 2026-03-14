export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

// ── Types ──────────────────────────────────────────────────
export interface Room {
    catalog_id: string;
    room_id: string;
    room_name: string;
    capacity: number;
    location: string;
    amenities: string;
    status: string;
    floor_no: number;
    room_number: string;
    availability: string;
    image_url?: string;
    image_urls?: string[];
    room_type?: string;
}

export interface Booking {
    booking_id: string;
    catalog_id: string;
    room_id: string;
    uid: string;
    start_date: string;
    end_date: string;
    start_time: string;
    end_time: string;
    purpose: string;
    attendees: number;
    status: string;
    selected_slots?: string;
    selected_dates?: string;
    // joined fields
    room_name?: string;
    location?: string;
    floor_no?: number;
    user_name?: string;
    email?: string;
    ticket_id?: string;
}

export interface User {
    uid: string;
    name: string;
    email: string;
    dept: string;
    phone_no: string;
    userrole_id: string;
}

// ── Helpers ────────────────────────────────────────────────
const getToken = (): string | null => localStorage.getItem('token');

const authHeaders = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

// Auto-logout on expired/invalid token
const handleAuthError = (res: Response) => {
    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
    }
};

export const parseLocalDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length !== 3) return new Date(dateStr);
    const [year, month, day] = parts.map(Number);
    return new Date(year, month - 1, day);
};

// ── Auth ───────────────────────────────────────────────────
export const loginUser = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
};

// --- Notifications ---

export const fetchNotifications = async () => {
    const res = await fetch(`${API_URL}/notifications`, { headers: authHeaders() });
    if (!res.ok) {
        handleAuthError(res);
        throw new Error('Failed to fetch notifications');
    }
    return res.json();
};

export const markNotificationAsRead = async (id: string) => {
    const res = await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'PUT',
        headers: authHeaders(),
    });
    if (!res.ok) {
        handleAuthError(res);
        throw new Error('Failed to mark notification as read');
    }
    return res.json();
};

export const markAllNotificationsAsRead = async () => {
    const res = await fetch(`${API_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: authHeaders(),
    });
    if (!res.ok) {
        handleAuthError(res);
        throw new Error('Failed to mark all notifications as read');
    }
    return res.json();
};

export const registerUser = async (payload: {
    uid: string; name: string; email: string;
    password: string; dept: string; phone_no: string; userrole_id?: string;
}) => {
    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Registration failed');
    }
    return res.json();
};

export const logoutUser = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
    const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to change password');
    }
    return res.json();
};

export const forgotPassword = async (email: string) => {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to request password reset');
    }
    return res.json();
};

export const resetPassword = async (token: string, newPassword: string) => {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reset password');
    }
    return res.json();
};

export const getCurrentUser = (): User | null => {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
};

// ── Rooms ──────────────────────────────────────────────────
export const fetchRooms = async (): Promise<Room[]> => {
    const res = await fetch(`${API_URL}/rooms`);
    if (!res.ok) throw new Error('Failed to fetch rooms');
    return res.json();
};

export const fetchRoom = async (catalog_id: string, room_id: string): Promise<Room> => {
    const res = await fetch(`${API_URL}/rooms/${catalog_id}/${room_id}`);
    if (!res.ok) throw new Error('Failed to fetch room');
    return res.json();
};

// ── Bookings ───────────────────────────────────────────────

export interface BookedSlot {
    start_time: string;
    end_time: string;
    status: string;
    selected_slots?: string;
    selected_dates?: string;
    user_name?: string;
    email?: string;
    phone_no?: string;
    purpose?: string;
}

export const fetchRoomAvailability = async (
    catalog_id: string, room_id: string, date: string
): Promise<BookedSlot[]> => {
    const res = await fetch(`${API_URL}/bookings/availability/${catalog_id}/${room_id}?date=${date}`);
    if (!res.ok) throw new Error('Failed to fetch availability');
    return res.json();
};

export const createBooking = async (data: {
    uid: string; catalog_id: string; room_id: string;
    start_date?: string; end_date?: string;
    start_time?: string; end_time?: string; purpose?: string; attendees?: number;
    selected_dates?: string;
    per_date_choices?: { date: string; slots: string[] }[];
}): Promise<{ message: string; booking_id: string; ticket_id?: string }> => {
    const res = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create booking');
    }
    return res.json();
};

export const fetchUserBookings = async (uid: string): Promise<Booking[]> => {
    const res = await fetch(`${API_URL}/bookings/user/${uid}`, {
        headers: authHeaders(),
    });
    if (!res.ok) {
        handleAuthError(res);
        throw new Error('Failed to fetch your bookings');
    }
    return res.json();
};

export const fetchAllBookings = async (): Promise<Booking[]> => {
    const res = await fetch(`${API_URL}/bookings/all`, {
        headers: authHeaders(),
    });
    if (!res.ok) {
        handleAuthError(res);
        throw new Error('Failed to fetch all bookings');
    }
    return res.json();
};

export const cancelBooking = async (
    booking_id: string,
    uid: string,
    booking?: Booking,
    options?: {
        reason?: string;
        cancel_fromtime?: string;
        cancel_totime?: string;
        partial?: boolean;
        slots?: { from: string; to: string }[];
        dates?: string[];
        partial_removals?: { date: string; slots: string[] }[];
    }
): Promise<{ message: string }> => {
    const now = new Date();
    const cancel_date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const res = await fetch(`${API_URL}/cancellations`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
            booking_id,
            cancelled_by_uid: uid,
            cancel_date,
            cancel_reason: options?.reason || 'User initialized cancellation',
            cancel_fromdate: booking?.start_date?.slice(0, 10) || null,
            cancel_todate: booking?.end_date?.slice(0, 10) || null,
            cancel_fromtime: options?.cancel_fromtime || booking?.start_time || null,
            cancel_totime: options?.cancel_totime || booking?.end_time || null,
            partial: options?.partial || false,
            partial_removals: options?.partial_removals || undefined,
            slots: options?.slots || [],
            dates: options?.dates || [],
        }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to cancel booking');
    }
    return res.json();
};

// ── Users ──────────────────────────────────────────────────
export const fetchUserProfile = async (uid: string): Promise<User> => {
    const res = await fetch(`${API_URL}/users/${uid}`, { headers: authHeaders() });
    if (!res.ok) {
        handleAuthError(res);
        throw new Error('Failed to fetch profile');
    }
    return res.json();
};

export const updateUserProfile = async (uid: string, data: { name: string; dept: string; phone_no: string }) => {
    const res = await fetch(`${API_URL}/users/${uid}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update profile');
    }
    return res.json();
};
// --- OTP/Verification Helpers ---
export async function verifyOtp(email: string, otp: string): Promise<any> {
    const response = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to verify OTP');
    }
    return response.json();
}

export async function resendOtp(email: string): Promise<any> {
    const response = await fetch(`${API_URL}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resend OTP');
    }
    return response.json();
}
