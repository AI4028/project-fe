import { distanceM, type Position } from './location';

// Straight-line guidance to a venue (wireframe v3 #10, #11): GPS gives the
// distance, the phone compass turns the arrow. It is not a walking route.

const rad = (deg: number) => (deg * Math.PI) / 180;
const normalize = (deg: number) => ((deg % 360) + 360) % 360;

/** Compass bearing from `from` to `to`, 0 = north, clockwise, in degrees. */
export function bearingDeg(from: Position, to: Position): number {
  const φ1 = rad(from.lat);
  const φ2 = rad(to.lat);
  const Δλ = rad(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return normalize((Math.atan2(y, x) * 180) / Math.PI);
}

/** Arrow angle on screen: where the venue is relative to where the phone points. */
export function relativeDeg(bearing: number, heading: number): number {
  return normalize(bearing - heading);
}

const sides = [
  '정면',
  '오른쪽 앞',
  '오른쪽',
  '오른쪽 뒤',
  '뒤쪽',
  '왼쪽 뒤',
  '왼쪽',
  '왼쪽 앞',
] as const;
const compass = ['북쪽', '북동쪽', '동쪽', '남동쪽', '남쪽', '남서쪽', '서쪽', '북서쪽'] as const;

/** "오른쪽 앞" for an angle relative to the phone. */
export function sideLabel(relative: number): (typeof sides)[number] {
  return sides[Math.round(normalize(relative) / 45) % 8] ?? sides[0];
}

/** Clock position used in orientation and mobility training: 12 = straight ahead. */
export function clockPosition(relative: number): number {
  const hour = Math.round(normalize(relative) / 30) % 12;
  return hour === 0 ? 12 : hour;
}

/** "북동쪽" for an absolute bearing, used when the phone has no compass. */
export function compassLabel(bearing: number): (typeof compass)[number] {
  return compass[Math.round(normalize(bearing) / 45) % 8] ?? compass[0];
}

/** Rounded so the number doesn't flicker with GPS noise. */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  if (meters >= 100) return `${Math.round(meters / 10) * 10}m`;
  return `${Math.max(5, Math.round(meters / 5) * 5)}m`;
}

/** Inside this radius GPS can't point reliably any more. */
export function arrivalRadius(accuracyM: number | null | undefined): number {
  return Math.max(15, Math.min(accuracyM ?? 15, 40));
}

export type Guidance = {
  arrived: boolean;
  distance: string;
  /** Direction words, or null without a compass reading. */
  side: string | null;
  clock: number | null;
  /** Exact arrow angle relative to the phone, or null without a compass. */
  relative: number | null;
  /** Absolute direction, always available. */
  compass: string;
  /** One sentence for speech and screen readers. */
  sentence: string;
};

export function guidance(
  position: Position,
  venue: Position,
  heading: number | null,
  accuracyM?: number | null,
): Guidance {
  const meters = distanceM(position, venue);
  const bearing = bearingDeg(position, venue);
  const distance = formatDistance(meters);
  const absolute = compassLabel(bearing);
  if (meters <= arrivalRadius(accuracyM)) {
    return {
      arrived: true,
      distance,
      side: null,
      clock: null,
      relative: null,
      compass: absolute,
      sentence: '매장 근처에 도착했어요. 입구는 매장 안내나 직원에게 확인해 주세요.',
    };
  }
  if (heading == null) {
    return {
      arrived: false,
      distance,
      side: null,
      clock: null,
      relative: null,
      compass: absolute,
      sentence: `매장은 ${absolute}으로 약 ${distance} 떨어져 있어요.`,
    };
  }
  const relative = relativeDeg(bearing, heading);
  const side = sideLabel(relative);
  const clock = clockPosition(relative);
  return {
    arrived: false,
    distance,
    side,
    clock,
    relative,
    compass: absolute,
    sentence: `매장은 ${side}, ${clock}시 방향으로 약 ${distance} 떨어져 있어요.`,
  };
}
