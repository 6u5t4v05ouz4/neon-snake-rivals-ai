import { useEffect, useState, useCallback } from 'react';

export type SoundName =
    | 'eat'
    | 'bet'
    | 'win'
    | 'lose'
    | 'countdown'
    | 'bloop';

// Local sound files from public/sounds
const SOUND_FILES: Record<SoundName, string> = {
    eat: '/sounds/eat.mp3',
    bet: '/sounds/bet.mp3',
    win: '/sounds/win.mp3',
    lose: '/sounds/lose.mp3',
    countdown: '/sounds/countdown.mp3',
    bloop: '/sounds/bloop.mp3',
};

const STORAGE_KEY = 'snake-arena-sound-enabled';

// Singleton audio cache - initialized once at module load
const audioCache: Map<SoundName, HTMLAudioElement> = new Map();

// Initialize audio elements immediately
if (typeof window !== 'undefined') {
    Object.entries(SOUND_FILES).forEach(([name, path]) => {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audio.volume = 0.5;
        audioCache.set(name as SoundName, audio);
    });
}

// Track last countdown audio to stop it before playing new one
let lastCountdownAudio: HTMLAudioElement | null = null;

// Play function that can be called directly
function playSoundDirect(name: SoundName, enabled: boolean) {
    if (!enabled) return;

    const audio = audioCache.get(name);
    if (audio) {
        // For countdown, stop the previous one first to prevent overlap
        if (name === 'countdown' && lastCountdownAudio) {
            lastCountdownAudio.pause();
            lastCountdownAudio.currentTime = 0;
        }

        // Clone for overlapping sounds (except countdown)
        const clone = audio.cloneNode() as HTMLAudioElement;
        clone.volume = 0.5;
        clone.play().catch(() => {
            // Ignore autoplay errors
        });

        if (name === 'countdown') {
            lastCountdownAudio = clone;
        }
    }
}

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

    // Save preference
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, String(enabled));
    }, [enabled]);

    const play = useCallback((name: SoundName) => {
        playSoundDirect(name, enabled);
    }, [enabled]);

    const toggle = useCallback(() => {
        setEnabled(prev => !prev);
    }, []);

    return { play, enabled, toggle };
}

export default useSoundEffects;

