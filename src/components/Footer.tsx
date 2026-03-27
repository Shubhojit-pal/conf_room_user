import { FacebookLogo, TwitterLogo, LinkedinLogo, InstagramLogo } from '@phosphor-icons/react';

interface FooterProps {
    onNavigate?: (view: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-theme-card border-t border-theme-border text-theme-secondary mt-16">
            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                    {/* About */}
                    <div>
                        <h3 className="font-bold text-lg mb-4 text-theme-primary">BookVenue</h3>
                        <p className="text-theme-secondary text-sm leading-relaxed opacity-70">
                            Your trusted platform for booking conference rooms and meeting spaces with ease.
                        </p>
                        <div className="flex gap-4 mt-6">
                            <a href="#" className="text-theme-secondary opacity-60 hover:text-primary hover:opacity-100 transition-all">
                                <FacebookLogo size={20} weight="fill" />
                            </a>
                            <a href="#" className="text-slate-400 hover:text-primary transition-colors">
                                <TwitterLogo size={20} weight="fill" />
                            </a>
                            <a href="#" className="text-slate-400 hover:text-primary transition-colors">
                                <LinkedinLogo size={20} weight="fill" />
                            </a>
                            <a href="#" className="text-slate-400 hover:text-primary transition-colors">
                                <InstagramLogo size={20} weight="fill" />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-bold text-theme-primary mb-4">Quick Links</h4>
                        <ul className="space-y-3">
                            <li><button onClick={() => onNavigate?.('search')} className="text-theme-secondary opacity-60 hover:text-primary hover:opacity-100 transition-all text-sm text-left w-full disabled:opacity-50">Browse Rooms</button></li>
                            <li><button onClick={() => onNavigate?.('my-bookings')} className="text-theme-secondary opacity-60 hover:text-primary hover:opacity-100 transition-all text-sm text-left w-full disabled:opacity-50">My Bookings</button></li>
                            <li><button onClick={() => onNavigate?.('calendar')} className="text-theme-secondary opacity-60 hover:text-primary hover:opacity-100 transition-all text-sm text-left w-full disabled:opacity-50">Calendar</button></li>
                            <li><button onClick={() => onNavigate?.('profile')} className="text-theme-secondary opacity-60 hover:text-primary hover:opacity-100 transition-all text-sm text-left w-full disabled:opacity-50">My Profile</button></li>
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h4 className="font-bold text-theme-primary mb-4">Support</h4>
                        <ul className="space-y-3">
                            <li><button onClick={() => onNavigate?.('help')} className="text-theme-secondary opacity-60 hover:text-primary hover:opacity-100 transition-all text-sm text-left w-full disabled:opacity-50">Help Center</button></li>
                            <li><button onClick={() => onNavigate?.('help')} className="text-theme-secondary opacity-60 hover:text-primary hover:opacity-100 transition-all text-sm text-left w-full disabled:opacity-50">Contact Us</button></li>
                            <li><button onClick={() => onNavigate?.('help')} className="text-theme-secondary opacity-60 hover:text-primary hover:opacity-100 transition-all text-sm text-left w-full disabled:opacity-50">FAQs</button></li>
                            <li><button onClick={() => onNavigate?.('help')} className="text-theme-secondary opacity-60 hover:text-primary hover:opacity-100 transition-all text-sm text-left w-full disabled:opacity-50">Documentation</button></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="font-bold text-theme-primary mb-4">Legal</h4>
                        <ul className="space-y-3">
                            <li><button onClick={() => onNavigate?.('home')} className="text-theme-secondary opacity-60 hover:text-primary hover:opacity-100 transition-all text-sm text-left w-full disabled:opacity-50">Privacy Policy</button></li>
                            <li><button onClick={() => onNavigate?.('home')} className="text-theme-secondary opacity-60 hover:text-primary hover:opacity-100 transition-all text-sm text-left w-full disabled:opacity-50">Terms of Service</button></li>
                            <li><button onClick={() => onNavigate?.('home')} className="text-theme-secondary opacity-60 hover:text-primary hover:opacity-100 transition-all text-sm text-left w-full disabled:opacity-50">Cookie Policy</button></li>
                            <li><button onClick={() => onNavigate?.('home')} className="text-theme-secondary opacity-60 hover:text-primary hover:opacity-100 transition-all text-sm text-left w-full disabled:opacity-50">Security</button></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-theme-border pt-8">
                    <div className="flex flex-col md:flex-row justify-between items-center text-sm text-theme-secondary opacity-60">
                        <p>&copy; {currentYear} BookVenue. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
