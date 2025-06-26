"use client"

import { useMemo, useCallback } from 'react';

type SoundEffect = 'feed-success' | 'feed-fail' | 'button-click' | 'achievement-unlocked';

export function useAudio() {
  const sounds = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return {
      'feed-success': new Audio('/sounds/feed-success.mp3'),
      'feed-fail': new Audio('/sounds/feed-fail.mp3'),
      'button-click': new Audio('/sounds/button-click.mp3'),
      'achievement-unlocked': new Audio('/sounds/achievement-unlocked.mp3'),
    };
  }, []);

  const playSound = useCallback((sound: SoundEffect, volume: number = 0.5) => {
    if (sounds && sounds[sound]) {
      sounds[sound].currentTime = 0;
      sounds[sound].volume = volume;
      sounds[sound].play().catch(error => console.error(`Error playing sound: ${sound}`, error));
    }
  }, [sounds]);

  return playSound;
} 