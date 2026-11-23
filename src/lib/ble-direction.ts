// Indoor guidance to a kiosk from ONE BLE beacon (the XIAO "LK…" broadcast).
//
// Distance: received signal strength (RSSI) with a log-distance path-loss model,
// calibrated by "RSSI at 1 m". Rough: ±1–3 m; shown in steps.
// Direction: a single beacon gives no angle, so the customer turns once with the
// phone held at the chest. The body blocks 2.4 GHz, so the signal is strongest
// when facing the beacon; the compass heading with the strongest signal becomes
// the arrow's target. Rough: about ±45°.

export const BEACON_PREFIX = 'LK';
export const DEFAULT_RSSI_AT_1M = -59;
export const PATH_LOSS_EXPONENT = 2.5;

/** "LKGK017H3KQ9ZC" → kiosk GK01 and its 8-character connection code. */
export function parseBeaconName(name: string | null | undefined) {
  const match = /^LK([A-Z0-9]{4})([0-9A-HJKMNP-TV-Z]{8})$/.exec(name ?? '');
  return match ? { kioskId: match[1]!, token: match[2]! } : null;
}

/** Median of the last samples: robust against single spikes. */
export function smoothRssi(samples: readonly number[], window = 7): number | null {
  const recent = samples.slice(-window).filter(Number.isFinite);
  if (!recent.length) return null;
  const sorted = [...recent].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function estimateDistanceM(rssi: number, rssiAt1m = DEFAULT_RSSI_AT_1M): number {
  return 10 ** ((rssiAt1m - rssi) / (10 * PATH_LOSS_EXPONENT));
}

export type DistanceStep = { label: string; near: boolean };

/** Steps instead of exact meters, because the estimate jumps. */
export function distanceStep(meters: number): DistanceStep {
  if (meters <= 1) return { label: '1m 이내 · 바로 앞', near: true };
  if (meters <= 2) return { label: '약 2m', near: false };
  if (meters <= 3.5) return { label: '약 3m', near: false };
  if (meters <= 5) return { label: '약 5m', near: false };
  if (meters <= 8) return { label: '약 8m', near: false };
  return { label: '10m 이상', near: false };
}

export type Sample = { heading: number; rssi: number };
const SECTOR = 30;
const normalize = (deg: number) => ((deg % 360) + 360) % 360;

/** How much of the full turn has been covered, in degrees (sector resolution). */
export function turnCoverage(samples: readonly Sample[]): number {
  const sectors = new Set(samples.map((s) => Math.floor(normalize(s.heading) / SECTOR)));
  return sectors.size * SECTOR;
}

export type DirectionEstimate =
  | { ok: true; bearing: number; strength: number; contrastDb: number }
  | { ok: false; reason: 'not-enough-turn' | 'no-clear-direction' };

/**
 * Compass bearing toward the beacon from a turn: average RSSI per 30° sector,
 * then a weighted circular mean that favours the strongest sectors. Needs most of a full turn and
 * a clear difference between facing the beacon and facing away from it.
 */
export function estimateDirection(
  samples: readonly Sample[],
  minContrastDb = 4,
): DirectionEstimate {
  if (turnCoverage(samples) < 270) return { ok: false, reason: 'not-enough-turn' };
  const sums = new Map<number, { total: number; count: number }>();
  for (const { heading, rssi } of samples) {
    const sector = Math.floor(normalize(heading) / SECTOR);
    const entry = sums.get(sector) ?? { total: 0, count: 0 };
    entry.total += rssi;
    entry.count += 1;
    sums.set(sector, entry);
  }
  const average = new Map([...sums].map(([sector, e]) => [sector, e.total / e.count]));
  const ranked = [...average].sort((a, b) => b[1] - a[1]);
  const [bestSector, best] = ranked[0]!;
  const values = [...average.values()].sort((a, b) => a - b);
  // Facing away puts the body between phone and beacon: compare with the
  // opposite side (or the weakest sector if that slice was skipped).
  const opposite = average.get((bestSector + 6) % 12) ?? values[0]!;
  const contrastDb = best - opposite;
  if (contrastDb < minContrastDb) return { ok: false, reason: 'no-clear-direction' };

  // Circular mean of all sectors, weighted by how much stronger than average
  // they are (squared), so the whole shape of the turn counts, not one slice.
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  let x = 0;
  let y = 0;
  for (const [sector, value] of average) {
    const weight = Math.max(0, value - mean) ** 2;
    const angle = ((sector * SECTOR + SECTOR / 2) * Math.PI) / 180;
    x += Math.cos(angle) * weight;
    y += Math.sin(angle) * weight;
  }
  const bearing = normalize((Math.atan2(y, x) * 180) / Math.PI);
  return { ok: true, bearing, strength: best, contrastDb };
}

/** After a direction was found: has the signal faded enough to ask for a new turn? */
export function signalFaded(strengthAtEstimate: number, current: number, dropDb = 6): boolean {
  return strengthAtEstimate - current >= dropDb;
}
