import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { beepInterval } from './ble-direction';

type AudioConstructor = new () => AudioContext;

/**
 * Hot/cold sound: short beeps (and a short vibration on Android) that come
 * faster and higher as the signal gets stronger. `heat` is 0–1, or null when
 * there is nothing to follow. Web only; browsers allow sound only after a tap,
 * so call `unlock()` from a button press.
 */
export function useBeeps(enabled: boolean, heat: number | null, near: boolean) {
  const context = useRef<AudioContext | null>(null);
  const heatRef = useRef(heat);
  heatRef.current = heat;
  const nearRef = useRef(near);
  nearRef.current = near;

  const unlock = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const scope = globalThis as unknown as {
      AudioContext?: AudioConstructor;
      webkitAudioContext?: AudioConstructor;
    };
    const Audio = scope.AudioContext ?? scope.webkitAudioContext;
    if (!Audio) return;
    try {
      context.current ??= new Audio();
      void context.current.resume?.().catch(() => {});
    } catch {
      // No sound: the screen and vibration still guide.
    }
  }, []);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      if (cancelled) return;
      const value = heatRef.current;
      if (value == null) {
        timer = setTimeout(tick, 400);
        return;
      }
      beep(context.current, value, nearRef.current);
      timer = setTimeout(tick, beepInterval(value, nearRef.current));
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled]);

  useEffect(
    () => () => {
      void context.current?.close?.().catch(() => {});
      context.current = null;
    },
    [],
  );

  return { unlock };
}

function beep(context: AudioContext | null, heat: number, near: boolean) {
  try {
    (globalThis.navigator as Navigator | undefined)?.vibrate?.(near ? 60 : 25);
  } catch {
    // Vibration is optional.
  }
  if (!context || context.state !== 'running') return;
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = near ? 1400 : 500 + 700 * heat;
    const start = context.currentTime;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.1);
  } catch {
    // A failed beep is skipped; the next one tries again.
  }
}
