import React, { useEffect } from 'react';
import { soundManager } from '../../lib/sound-manager';

export function SoundProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Global Click Listener
        const handleGlobalClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            
            const isInteractive = (el: HTMLElement | null): boolean => {
                if (!el) return false;
                const tag = el.tagName.toLowerCase();
                const role = el.getAttribute('role');
                const isClickable = tag === 'button' || tag === 'a' || role === 'button' || el.classList.contains('cursor-pointer');
                
                if (isClickable) return true;
                if (el.parentElement) return isInteractive(el.parentElement);
                return false;
            };

            if (isInteractive(target)) {
                soundManager?.play('click');
            }
        };

        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, []);

    return <>{children}</>;
}
