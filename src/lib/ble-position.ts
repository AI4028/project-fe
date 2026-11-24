// Three-board kiosk finding. The kiosk board ("LK…", connection code) plus two
// fixed position boards ("LA" + kiosk id + letter, e.g. LAGK01B / LAGK01C) at
// measured spots. Signal strength from each board gives a rough distance; the
// spot that fits all three best is the phone's position, and the arrow points
// from there to the kiosk.
//
// Room coordinates in metres: the kiosk board is (0, 0), +y is "forward" (the
// direction from the kiosk toward board B, saved once with the compass), +x is
// to the right of forward.

import { PATH_LOSS_EXPONENT } from './ble-direction';

export const ANCHOR_PREFIX = 'LA';
export const ANCHOR_LETTERS = ['B', 'C'] as const;
export type AnchorLetter = (typeof ANCHOR_LETTERS)[number];

/** "LAGK01B" → kiosk GK01, board B. */
export function parseAnchorName(name: string | null | undefined) {
  const match = /^LA([A-Z0-9]{4})([BC])$/.exec(name ?? '');
  return match ? { kioskId: match[1]!, letter: match[2] as AnchorLetter } : null;
}

export type Spot = { x: number; y: number };

export type BoardSetup = {
  /** Where boards B and C are, in metres from the kiosk board. */
  spots: Record<AnchorLetter, Spot>;
  /** Compass heading of "forward" (kiosk → board B), saved at the kiosk. */
  forwardHeading: number | null;
  /** Signal at 1 m for each board (calibration). */
  rssiAt1m: Record<'A' | AnchorLetter, number>;
};

export const DEFAULT_SETUP: BoardSetup = {
  spots: { B: { x: 0, y: 4 }, C: { x: 3, y: 2 } },
  forwardHeading: null,
  rssiAt1m: { A: -59, B: -59, C: -59 },
};

const RAD = Math.PI / 180;
const normalize = (deg: number) => ((deg % 360) + 360) % 360;

/** Room direction (0 = forward, 90 = right) → compass bearing. */
export function roomToCompass(roomBearing: number, forwardHeading: number): number {
  return normalize(roomBearing + forwardHeading);
}

/** Room direction from one spot to another (0 = forward, clockwise). */
export function roomBearing(from: Spot, to: Spot): number {
  return normalize(Math.atan2(to.x - from.x, to.y - from.y) / RAD);
}

/** Is the setup usable? Boards apart from each other and not in one line. */
export function setupProblem(setup: BoardSetup): 'no-forward' | 'boards-in-line' | null {
  const { B, C } = setup.spots;
  // Twice the triangle area of kiosk (0,0), B and C; near 0 means one line.
  const area = Math.abs(B.x * C.y - B.y * C.x);
  if (Math.hypot(B.x, B.y) < 1 || Math.hypot(C.x, C.y) < 1 || area < 2) return 'boards-in-line';
  if (setup.forwardHeading == null) return 'no-forward';
  return null;
}

export type BoardReading = { spot: Spot; rssi: number; rssiAt1m: number };

export type Position = Spot & {
  /** Spread of likely spots, metres (about ±). */
  uncertainty: number;
};

/**
 * The phone's position from one reading per board. Grid search over the room
 * (boards ± 6 m, 0.2 m steps). Each candidate spot is scored by how well
 * "signal at 1 m − 10·n·log10(distance) − body shadow" matches every board;
 * the body shadow (boards behind the customer read weaker) uses the compass
 * heading in room terms when known. The answer is the likelihood-weighted
 * mean of the spots, so it moves smoothly instead of jumping between cells.
 */
export function trilaterate(
  readings: readonly BoardReading[],
  facingRoom: number | null,
  { step = 0.2, margin = 6, noiseDb = 3, shadowDb = 5, pathLoss = PATH_LOSS_EXPONENT } = {},
): Position | null {
  if (readings.length < 3) return null;
  const xs = readings.map((r) => r.spot.x);
  const ys = readings.map((r) => r.spot.y);
  const minX = Math.min(...xs) - margin;
  const maxX = Math.max(...xs) + margin;
  const minY = Math.min(...ys) - margin;
  const maxY = Math.max(...ys) + margin;
  const facing =
    facingRoom == null ? null : { x: Math.sin(facingRoom * RAD), y: Math.cos(facingRoom * RAD) };

  const cells: { x: number; y: number; error: number }[] = [];
  let best = Infinity;
  for (let x = minX; x <= maxX + 1e-9; x += step) {
    for (let y = minY; y <= maxY + 1e-9; y += step) {
      let error = 0;
      for (const r of readings) {
        const dx = r.spot.x - x;
        const dy = r.spot.y - y;
        const d = Math.max(0.3, Math.hypot(dx, dy));
        let predicted = r.rssiAt1m - 10 * pathLoss * Math.log10(d);
        if (facing) predicted -= (shadowDb * (1 - (dx * facing.x + dy * facing.y) / d)) / 2;
        error += (r.rssi - predicted) ** 2;
      }
      cells.push({ x, y, error });
      if (error < best) best = error;
    }
  }
  // Likelihood weights (Gaussian noise); only nearly-best cells matter.
  let total = 0;
  let sumX = 0;
  let sumY = 0;
  const kept: { x: number; y: number; w: number }[] = [];
  for (const cell of cells) {
    const w = Math.exp(-(cell.error - best) / (2 * noiseDb * noiseDb));
    if (w < 1e-4) continue;
    kept.push({ x: cell.x, y: cell.y, w });
    total += w;
    sumX += w * cell.x;
    sumY += w * cell.y;
  }
  const x = sumX / total;
  const y = sumY / total;
  const variance =
    kept.reduce((sum, c) => sum + c.w * ((c.x - x) ** 2 + (c.y - y) ** 2), 0) / total;
  return { x, y, uncertainty: Math.sqrt(variance) };
}

/** Smooth successive positions (the raw estimate wobbles by a metre or so). */
export function smoothPosition(previous: Position | null, next: Position, weight = 0.35): Position {
  if (!previous) return next;
  return {
    x: previous.x + (next.x - previous.x) * weight,
    y: previous.y + (next.y - previous.y) * weight,
    uncertainty: previous.uncertainty + (next.uncertainty - previous.uncertainty) * weight,
  };
}
