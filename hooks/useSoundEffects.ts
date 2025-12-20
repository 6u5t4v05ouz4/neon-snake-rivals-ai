import { useEffect, useRef, useState, useCallback } from 'react';

export type SoundName =
    | 'eat'
    | 'die'
    | 'bet'
    | 'win'
    | 'lose'
    | 'countdown'
    | 'go'
    | 'gameover';

// Placeholder sounds from CDN (replace with local files later)
const SOUND_FILES: Record<SoundName, string> = {
    eat: 'https://cdn.pixabay.com/audio/2022/03/10/audio_d1073fc6cf.mp3',
    die: 'https://cdn.pixabay.com/audio/2022/03/15/audio_fd9dc2cc38.mp3',
    bet: 'https://cdn.pixabay.com/audio/2021/08/04/audio_6f62e5f7c6.mp3',
    win: 'https://cdn.pixabay.com/audio/2021/08/04/audio_5e1a14edb5.mp3',
    lose: 'https://cdn.pixabay.com/audio/2022/03/15/audio_6bd02dbacf.mp3',
    countdown: 'https://cdn.pixabay.com/audio/2022/03/15/audio_8f9c3e8f3b.mp3',
    go: 'https://cdn.pixabay.com/audio/2022/03/15/audio_e03d00c53c.mp3',
    gameover: 'https://cdn.pixabay.com/audio/2022/03/24/audio_60c4a76e92.mp3',
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
