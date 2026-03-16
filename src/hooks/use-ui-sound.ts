import { useCallback } from 'react';
import { soundManager } from '../lib/sound-manager';

export function useUISound() {
    const playClick = useCallback(() => {
        soundManager?.play('click');
    }, []);

    const playSuccess = useCallback(() => {
        soundManager?.play('success');
    }, []);

    const playError = useCallback(() => {
        soundManager?.play('error');
    }, []);

    const playNotification = useCallback(() => {
        soundManager?.play('notification');
    }, []);

    return {
        playClick,
        playSuccess,
        playError,
        playNotification,
    };
}
