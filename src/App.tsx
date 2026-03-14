import { useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import Stats from './components/Stats'
import Analytics from './components/Analytics'
import QuickAccess from './components/QuickAccess'
import Footer from './components/Footer'
import SearchPage from './pages/SearchPage'
import RoomDetailsPage from './pages/RoomDetailsPage'
import TicketPage from './pages/TicketPage'
import CalendarPage from './pages/CalendarPage'
import MyBookingsPage from './pages/MyBookingsPage'
import HelpCenterPage from './pages/HelpCenterPage'
import ProfilePage from './pages/ProfilePage'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import NotificationsPage from './pages/NotificationsPage'
import { useAuth } from './context/AuthContext'

export interface SelectedRoom {
    catalog_id: string;
    room_id: string;
}

export interface BookingResult {
    booking_id: string;
    room_name: string;
    location: string;
    date: string;
    endDate?: string;
    start_time: string;
    end_time: string;
    purpose: string;
    attendees?: number;
    user_name?: string;
    email?: string;
    status?: string;
    ticket_id?: string;
}

/**
 * ═══════════════════════════════════════════════════════════════
 *  USER FRONTEND — NAVIGATION ROUTES (http://localhost:5173)
 * ═══════════════════════════════════════════════════════════════
 *
 *  View Name       Component              Description
 *  ────────────    ─────────────────────  ──────────────────────────────
 *  'home'          Hero + Stats + etc.    Landing page / Dashboard
 *  'login'         LoginPage              User login / signup
 *  'search'        SearchPage             Browse & search rooms
 *  'details'       RoomDetailsPage        View room info & book
 *  'ticket'        TicketPage             Booking confirmation & PDF download
 *  'calendar'      CalendarPage           Calendar view & multi-slot booking
 *  'my-bookings'   MyBookingsPage         View/cancel user bookings
 *  'help'          HelpCenterPage         FAQ & help section
 *  'profile'       ProfilePage            User profile & settings
 *
 *  ═══════════════════════════════════════════════════════════════
 *  NAVIGATION FLOW (which page leads to which):
 *  ═══════════════════════════════════════════════════════════════
 *
 *  Home Page ('home')
 *    ├── Header "Login" button        → Login Page ('login')
 *    ├── Hero "Reserve Now" button    → Search Page ('search')
 *    ├── Hero "Calendar" button       → Calendar Page ('calendar')
 *    ├── QuickAccess "View Available" → Search Page ('search')
 *    ├── Header nav "My Bookings"     → My Bookings Page ('my-bookings')
 *    ├── Header nav "Help"            → Help Center Page ('help')
 *    └── Header "Profile" icon        → Profile Page ('profile')
 *
 *  Login Page ('login')
 *    └── On successful login          → Home Page ('home')
 *
 *  Search Page ('search')
 *    └── Click on a room card         → Room Details Page ('details')
 *
 *  Room Details Page ('details')
 *    ├── "Back" button                → Search Page ('search')
 *    └── On booking success           → Ticket Page ('ticket')
 *
 *  Ticket Page ('ticket')
 *    ├── "Back to Home" button        → Home Page ('home')
 *    ├── "View My Bookings" button    → My Bookings Page ('my-bookings')
 *    └── "Download PDF" button        → Downloads ticket as PDF file
 *
 *  Calendar Page ('calendar')
 *    └── On booking via calendar      → Ticket Page ('ticket')
 *
 *  My Bookings Page ('my-bookings')
 *    ├── "Browse Rooms" button        → Search Page ('search')
 *    └── "Access Ticket" button       → Ticket Page ('ticket')
 *
 *  Help Center Page ('help')
 *    └── Internal links               → Any page via navigateTo()
 *
 *  Profile Page ('profile')
 *    └── (self-contained, no outgoing navigation)
 *
 * ═══════════════════════════════════════════════════════════════
 */
function App() {
    const [currentView, setCurrentView] = useState('home');
    const { isLoading } = useAuth();
    const [selectedRoom, setSelectedRoom] = useState<SelectedRoom | null>(null);
    const [lastBooking, setLastBooking] = useState<BookingResult | null>(null);
    const [initialSearchFilters, setInitialSearchFilters] = useState<{ location: string; capacity: string; date: string } | undefined>();

    const [resetEmail, setResetEmail] = useState('');

    const navigateTo = (view: string, data?: any) => {
        if (view === 'search' && data && data.location) {
            setInitialSearchFilters(data);
        } else if (view === 'search') {
            setInitialSearchFilters(undefined);
        }
        setCurrentView(view);
        window.scrollTo(0, 0);
    };

    const navigateToRoom = (catalog_id: string, room_id: string) => {
        setSelectedRoom({ catalog_id, room_id });
        navigateTo('details');
    };

    const navigateToTicket = (booking: BookingResult) => {
        setLastBooking(booking);
        navigateTo('ticket');
    };

    // Show loading spinner while auth state is being restored
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
        );
    }

    if (currentView === 'login') {
        return <LoginPage onSuccess={() => navigateTo('home')} onNavigate={navigateTo} />;
    }

    if (currentView === 'forgot-password') {
        return <ForgotPasswordPage 
            onBack={() => navigateTo('login')} 
            onResetView={(email) => { setResetEmail(email); navigateTo('reset-password'); }} 
        />;
    }

    if (currentView === 'reset-password') {
        return <ResetPasswordPage 
            email={resetEmail}
            onBack={() => navigateTo('forgot-password')} 
            onSuccess={() => navigateTo('login')} 
        />;
    }

    const renderContent = () => {
        switch (currentView) {
            case 'home':
                return (
                    <>
                        <Hero
                            onReserveClick={() => navigateTo('search')}
                            onCalendarClick={() => navigateTo('calendar')}
                        />
                        <Stats onNavigate={navigateTo} />
                        <Analytics onNavigate={navigateTo} />
                        <QuickAccess
                            onViewAvailableToday={() => navigateTo('search')}
                            onSearch={(filters) => navigateTo('search', filters)}
                            onViewFavorites={() => navigateTo('search')}
                            onViewActivity={() => navigateTo('my-bookings')}
                        />
                    </>
                );
            case 'search':
                return <SearchPage onViewRoom={navigateToRoom} onBookingSuccess={navigateToTicket} initialFilters={initialSearchFilters} />;
            case 'details':
                return (
                    <RoomDetailsPage
                        room={selectedRoom}
                        onBack={() => navigateTo('search')}
                        onBookingSuccess={navigateToTicket}
                    />
                );
            case 'ticket':
                return <TicketPage booking={lastBooking} onHome={() => navigateTo('home')} onViewBookings={() => navigateTo('my-bookings')} />;
            case 'calendar':
                return <CalendarPage onPreviewTicket={() => navigateTo('ticket')} />;
            case 'my-bookings':
                return <MyBookingsPage onBrowse={() => navigateTo('search')} onViewTicket={navigateToTicket} />;
            case 'help':
                return <HelpCenterPage onNavigate={navigateTo} onAlert={(msg, type) => alert(`[${type}] ${msg}`)} />;
            case 'profile':
                return <ProfilePage onViewBookings={() => navigateTo('my-bookings')} />;
            case 'notifications':
                return <NotificationsPage onNavigate={navigateTo} onViewTicket={navigateToTicket} />;
            default:
                return (
                    <>
                        <Hero />
                        <Stats onNavigate={navigateTo} />
                        <Analytics onNavigate={navigateTo} />
                        <QuickAccess
                            onViewAvailableToday={() => navigateTo('search')}
                            onSearch={(filters) => navigateTo('search', filters)}
                            onViewFavorites={() => navigateTo('search')}
                            onViewActivity={() => navigateTo('my-bookings')}
                        />
                    </>
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Header currentView={currentView} onNavigate={navigateTo} />
            <main className="flex-grow pb-20 md:pb-0">
                {renderContent()}
            </main>
            <Footer onNavigate={navigateTo} />
        </div>
    )
}

export default App
