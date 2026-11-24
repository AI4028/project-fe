import { formatDistance } from './direction';
import type { Position } from './location';

// Turn-by-turn walking routes from 길동무 (Gildongmu), through our backend
// (GET /route/walk). Each step's path starts where its turn happens, so while
// walking along step N the next thing to do is step N+1's turn.

export type WalkStep = {
  /** Full sentence from Gildongmu, already in the requested language. */
  instruction: string;
  /** Just the turn, e.g. "오른쪽으로 도세요"; null for "keep walking". */
  turn: string | null;
  action: string | null;
  distanceM: number;
  path: Position[];
};

export type WalkRoute = {
  status: 'ok' | 'outside-coverage' | 'no-route';
  distanceM?: number;
  durationS?: number;
  steps: WalkStep[];
  source: { name: string; url: string; license: string };
};

export type RouteProgress = {
  /** Index of the step being walked. */
  step: number;
  /** Metres left until the next turn (or the end). */
  toTurnM: number;
  remainingM: number;
  /** How far the walker is from the route line. */
  offRouteM: number;
};

const RAD = Math.PI / 180;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Metres east/north of `origin`; accurate enough over a walking route. */
function local(origin: Position, point: Position) {
  return {
    x: (point.lng - origin.lng) * 111320 * Math.cos(origin.lat * RAD),
    y: (point.lat - origin.lat) * 110540,
  };
}

/**
 * Where on the route the walker is: the closest point on any segment from
 * `fromStep` on (so a route that doubles back never jumps to an earlier step).
 */
export function routeProgress(
  steps: readonly WalkStep[],
  here: Position,
  fromStep = 0,
): RouteProgress | null {
  let along = 0;
  let best: { distance: number; along: number; step: number } | null = null;
  const ends: number[] = [];
  steps.forEach((step, index) => {
    const points = step.path.map((point) => local(here, point));
    for (let k = 0; k + 1 < points.length; k++) {
      const a = points[k]!;
      const b = points[k + 1]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const t = length ? clamp(-(a.x * dx + a.y * dy) / (length * length), 0, 1) : 0;
      const distance = Math.hypot(a.x + t * dx, a.y + t * dy);
      if (index >= fromStep && (!best || distance < best.distance - 0.5))
        best = { distance, along: along + t * length, step: index };
      along += length;
    }
    ends.push(along);
  });
  if (!best) return null;
  const { distance, along: at, step } = best;
  return {
    step,
    toTurnM: Math.max(0, (ends[step] ?? along) - at),
    remainingM: Math.max(0, along - at),
    offRouteM: distance,
  };
}

/** Off the line by more than GPS noise explains: time to ask for a new route. */
export function isOffRoute(progress: RouteProgress, accuracyM: number | null | undefined) {
  return progress.offRouteM > Math.max(30, 1.5 * (accuracyM ?? 0));
}

/** "앞으로 20m 이동하세요." plus what comes next, as one sentence for speech. */
export function currentInstruction(steps: readonly WalkStep[], progress: RouteProgress) {
  const now = `앞으로 ${formatDistance(progress.toTurnM)} 이동하세요.`;
  const next = steps[progress.step + 1];
  return {
    now,
    next: next?.instruction ?? null,
    sentence: next ? `${now} 다음: ${next.instruction}` : now,
  };
}
