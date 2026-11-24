import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type HeadingStatus = 'waiting' | 'ok' | 'needs-permission' | 'unavailable';

type OrientationEventWithCompass = DeviceOrientationEvent & { webkitCompassHeading?: number };
type OrientationPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

const RAD = Math.PI / 180;

/**
 * Compass heading from an absolute orientation event (W3C Z-X'-Y'' angles),
 * valid whether the phone lies flat or is held upright: the horizontal
 * direction of "top of the phone" plus "out of the back of the phone".
 * Flat, this equals 360 − alpha; upright, it is where the back camera faces.
 */
export function headingFromOrientation(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngle = 0,
): number {
  const [cA, sA] = [Math.cos(alpha * RAD), Math.sin(alpha * RAD)];
  const [cB, sB] = [Math.cos(beta * RAD), Math.sin(beta * RAD)];
  const [cG, sG] = [Math.cos(gamma * RAD), Math.sin(gamma * RAD)];
  // Device y axis (top) and −z axis (back) in east/north coordinates.
  const east = -sA * cB + (-cA * sG - sA * sB * cG);
  const north = cA * cB + (-sA * sG + cA * sB * cG);
  const heading = Math.atan2(east, north) / RAD + screenAngle;
  return ((heading % 360) + 360) % 360;
}

/**
 * Where the top of the phone points, in degrees from north (clockwise).
 * Native: the platform compass. Web: deviceorientation(absolute); iOS Safari
 * only reports after the user taps "allow" (`request`).
 */
export function useHeading(active = true) {
  const [heading, setHeading] = useState<number | null>(null);
  const [status, setStatus] = useState<HeadingStatus>('waiting');
  const [revision, setRevision] = useState(0);
  const received = useRef(false);

  useEffect(() => {
    if (!active) return;
    received.current = false;
    const accept = (value: number) => {
      if (!Number.isFinite(value) || value < 0) return;
      received.current = true;
      setHeading(((value % 360) + 360) % 360);
      setStatus('ok');
    };
    // No reading for a while: desktop browser, no sensor, or blocked.
    const timer = setTimeout(() => {
      if (!received.current)
        setStatus((current) => (current === 'waiting' ? 'unavailable' : current));
    }, 4000);

    if (Platform.OS !== 'web') {
      let subscription: { remove: () => void } | null = null;
      let cancelled = false;
      void Location.watchHeadingAsync((reading) =>
        accept(reading.trueHeading >= 0 ? reading.trueHeading : reading.magHeading),
      )
        .then((sub) => {
          if (cancelled) sub.remove();
          else subscription = sub;
        })
        .catch(() => setStatus('unavailable'));
      return () => {
        cancelled = true;
        clearTimeout(timer);
        subscription?.remove();
      };
    }

    const target = globalThis as unknown as Window;
    if (typeof target.addEventListener !== 'function' || !('DeviceOrientationEvent' in target)) {
      clearTimeout(timer);
      setStatus('unavailable');
      return;
    }
    const permission = (target as unknown as { DeviceOrientationEvent: OrientationPermission })
      .DeviceOrientationEvent;
    if (typeof permission.requestPermission === 'function' && revision === 0) {
      clearTimeout(timer);
      setStatus('needs-permission');
      return;
    }
    const onOrientation = (event: Event) => {
      const e = event as OrientationEventWithCompass;
      if (typeof e.webkitCompassHeading === 'number') accept(e.webkitCompassHeading);
      else if (e.absolute && typeof e.alpha === 'number') {
        const screenAngle =
          (globalThis as unknown as { screen?: { orientation?: { angle?: number } } }).screen
            ?.orientation?.angle ?? 0;
        accept(headingFromOrientation(e.alpha, e.beta ?? 0, e.gamma ?? 0, screenAngle));
      }
    };
    target.addEventListener('deviceorientationabsolute', onOrientation);
    target.addEventListener('deviceorientation', onOrientation);
    return () => {
      clearTimeout(timer);
      target.removeEventListener('deviceorientationabsolute', onOrientation);
      target.removeEventListener('deviceorientation', onOrientation);
    };
  }, [active, revision]);

  /** iOS Safari: must run inside a tap. */
  const request = useCallback(async () => {
    const permission = (globalThis as unknown as { DeviceOrientationEvent?: OrientationPermission })
      .DeviceOrientationEvent;
    try {
      const result = await permission?.requestPermission?.();
      if (result === 'denied') {
        setStatus('unavailable');
        return;
      }
    } catch {
      setStatus('unavailable');
      return;
    }
    setStatus('waiting');
    setRevision((value) => value + 1);
  }, []);

  return { heading, status, request };
}
