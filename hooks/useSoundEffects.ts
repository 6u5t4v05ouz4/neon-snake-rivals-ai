import { useEffect, useRef, useState, useCallback } from 'react';

export type SoundName =
    | 'eat'
    | 'bet'
    | 'win'
    | 'lose'
    | 'countdown'
    | 'bloop';

// Local sound files from assets/sounds
const SOUND_FILES: Record<SoundName, string> = {
    eat: '/assets/sounds/eat.mp3',
    bet: '/assets/sounds/bet.mp3',
    win: '/assets/sounds/win.mp3',
    lose: '/assets/sounds/lose.mp3',
    countdown: '/assets/sounds/countdown.mp3',
    bloop: '/assets/sounds/bloop.mp3',
};

const STORAGE_KEY = 'snake-arena-sound-enabled';

export interface UseSoundEffectsReturn {
    play: (name: SoundName) => void;
    enabled: boolean;
    toggle: () => void;
}

export function useSoundEffects(): UseSoundEffectsReturn {
    const [enabled, setEnabled] = useState(() => {
        if (typeof window === 'undefined') return true;
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored !== 'false'; // Default to enabled
    });

    const audioCache = useRef<Map<SoundName, HTMLAudioElement>>(new Map());

    // Preload sounds
    useEffect(() => {
        Object.entries(SOUND_FILES).forEach(([name, path]) => {
            const audio = new Audio(path);
            audio.preload = 'auto';
            audio.volume = 0.5;
            audioCache.current.set(name as SoundName, audio);
        });

        return () => {
            audioCache.current.forEach(audio => {
                audio.pause();
                audio.src = '';
            });
            audioCache.current.clear();
        };
    }, []);

    // Save preference
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, String(enabled));
    }, [enabled]);

    const play = useCallback((name: SoundName) => {
        if (!enabled) return;

        const audio = audioCache.current.get(name);
        if (audio) {
            // Clone for overlapping sounds
            const clone = audio.cloneNode() as HTMLAudioElement;
            clone.volume = 0.5;
            clone.play().catch(() => {
                // Ignore autoplay errors (user hasn't interacted yet)
            });
        }
    }, [enabled]);

    const toggle = useCallback(() => {
        setEnabled(prev => !prev);
    }, []);

    return { play, enabled, toggle };
}

export default useSoundEffects;
