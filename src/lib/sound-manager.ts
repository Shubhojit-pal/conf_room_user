export type SoundType = 'click' | 'success' | 'error' | 'notification';

class SoundManager {
    private static instance: SoundManager;
    private sounds: Record<SoundType, HTMLAudioElement | null> = {
        click: null,
        success: null,
        error: null,
        notification: null,
    };
    private enabled: boolean = true;
    private volume: number = 0.25;

    private constructor() {
        if (typeof window !== 'undefined') {
            this.enabled = localStorage.getItem('ui_sounds_enabled') !== 'false';
            this.preload();
        }
    }

    public static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    private preload() {
        if (typeof window === 'undefined') return;

        const soundFiles: Record<SoundType, string> = {
            click: '/sounds/click.mp3',
            success: '/sounds/success.mp3',
            error: '/sounds/error.mp3',
            notification: '/sounds/notification.mp3',
        };

        (Object.entries(soundFiles) as [SoundType, string][]).forEach(([type, path]) => {
            const audio = new Audio(path);
            audio.preload = 'auto';
            audio.volume = this.volume;
            this.sounds[type] = audio;

            // Handle missing files gracefully
            audio.onerror = () => {
                console.warn(`Sound file missing or failed to load: ${path}`);
                this.sounds[type] = null;
            };
        });
    }

    public play(type: SoundType) {
        if (!this.enabled) return;

        const sound = this.sounds[type];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(err => {
                if (err.name !== 'NotAllowedError') {
                    console.error(`Failed to play ${type} sound:`, err);
                }
            });
        }
    }

    public setEnabled(enabled: boolean) {
        this.enabled = enabled;
        localStorage.setItem('ui_sounds_enabled', String(enabled));
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public setVolume(volume: number) {
        this.volume = volume;
        Object.values(this.sounds).forEach(sound => {
            if (sound) sound.volume = volume;
        });
    }
}

export const soundManager = typeof window !== 'undefined' ? SoundManager.getInstance() : null;
