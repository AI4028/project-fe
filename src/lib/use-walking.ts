import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

type MotionPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

/** Typical step length; the walk-and-learn arrow tolerates ±20 %. */
export const STEP_LENGTH_M = 0.65;

/**
 * Steps from the accelerometer (web): each bounce of the phone above its
 * running average is one step. `walking` = at least 2 steps in the last 2 s.
 * `available` stays false when the browser sends no motion readings.
 */
export function useWalking(active = true, onStep?: () => void) {
  const [walking, setWalking] = useState(false);
  const [available, setAvailable] = useState(false);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  useEffect(() => {
    if (!active || Platform.OS !== 'web') return;
    const target = globalThis as unknown as Window;
    if (typeof target.addEventListener !== 'function' || !('DeviceMotionEvent' in target)) return;
    let average = 9.81;
    let lastAt = 0;
    let above = false;
    let lastStepAt = 0;
    let readings = 0;
    let steps: number[] = [];
    const onMotion = (event: Event) => {
      const a = (event as DeviceMotionEvent).accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const magnitude = Math.hypot(a.x, a.y, a.z);
      // Empty or glitchy readings (0, or far beyond a hand-held phone) are not steps.
      if (magnitude < 3 || magnitude > 40) return;
      const now = Date.now();
      // Running average with a ~1 s time constant, whatever the sensor rate.
      const dt = lastAt ? Math.min(1000, now - lastAt) : 16;
      lastAt = now;
      average += (magnitude - average) * (1 - Math.exp(-dt / 1000));
      if (!above && magnitude > average + 1.2 && now - lastStepAt > 280) {
        above = true;
        lastStepAt = now;
        steps.push(now);
        onStepRef.current?.();
      } else if (above && magnitude < average) {
        above = false;
      }
      steps = steps.filter((at) => now - at < 2000);
      readings += 1;
      if (readings >= 8) setAvailable(true);
      setWalking(steps.length >= 2);
    };
    target.addEventListener('devicemotion', onMotion);
    return () => target.removeEventListener('devicemotion', onMotion);
  }, [active]);

  return { walking, available };
}

/** Some browsers need a tap before sending motion readings. */
export async function requestMotionPermission() {
  const motion = (globalThis as unknown as { DeviceMotionEvent?: MotionPermission })
    .DeviceMotionEvent;
  try {
    await motion?.requestPermission?.();
  } catch {
    // The arrow still comes from turning; hot/cold needs no motion data.
  }
}
