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

// ---------------------------------------------------------------------------
// Walk-and-learn arrow. Steps (accelerometer) and the compass give a rough
// track of where the phone has been; every reading on that track is a signal
// strength at a known spot and facing direction. The kiosk position that best
// explains all of them (path loss with distance, plus the body blocking the
// signal from behind) gives the arrow from where the customer is now. Turning
// on the spot and walking both feed the same fit, and the arrow stays right
// after walking past the kiosk.
// ---------------------------------------------------------------------------

export type TrackSample = { at: number; x: number; y: number; heading: number; rssi: number };
export type Located =
  | { ok: true; bearing: number; distance: number; confidence: number; walked: number }
  | { ok: false; reason: 'need-more' | 'unclear'; walked: number };

const RAD = Math.PI / 180;
const angleGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

function circularMean(angles: readonly number[]): number {
  let x = 0;
  let y = 0;
  for (const angle of angles) {
    x += Math.cos(angle * RAD);
    y += Math.sin(angle * RAD);
  }
  return normalize(Math.atan2(y, x) / RAD);
}

type Point = { x: number; y: number; heading: number; rssi: number };

/** Half-second bins: median signal, mean spot, mean facing. */
function binTrack(track: readonly TrackSample[], binMs: number): Point[] {
  const bins = new Map<number, TrackSample[]>();
  for (const sample of track) {
    const key = Math.floor(sample.at / binMs);
    const list = bins.get(key);
    if (list) list.push(sample);
    else bins.set(key, [sample]);
  }
  return [...bins.values()].map((list) => ({
    x: list.reduce((sum, s) => sum + s.x, 0) / list.length,
    y: list.reduce((sum, s) => sum + s.y, 0) / list.length,
    heading: circularMean(list.map((s) => s.heading)),
    rssi: smoothRssi(
      list.map((s) => s.rssi),
      list.length,
    )!,
  }));
}

type Prepared = {
  n: number;
  x: Float64Array;
  y: Float64Array;
  sin: Float64Array;
  cos: Float64Array;
  rssi: Float64Array;
};

function prepare(points: readonly Point[]): Prepared {
  const n = points.length;
  const prepared: Prepared = {
    n,
    x: new Float64Array(n),
    y: new Float64Array(n),
    sin: new Float64Array(n),
    cos: new Float64Array(n),
    rssi: new Float64Array(n),
  };
  points.forEach((p, i) => {
    prepared.x[i] = p.x;
    prepared.y[i] = p.y;
    prepared.sin[i] = Math.sin(p.heading * RAD);
    prepared.cos[i] = Math.cos(p.heading * RAD);
    prepared.rssi[i] = p.rssi;
  });
  return prepared;
}

/**
 * Squared error of the best "A − 10·n·log10(d) − S·shadow" fit for a kiosk at
 * (bx, by). shadow = (1 − cos(angle between facing and the kiosk)) / 2, so 0
 * facing it and 1 with the back to it. A (signal at 1 m) and S (body shadow,
 * 0–15 dB) are solved in closed form.
 */
function fitError(points: Prepared, bx: number, by: number, pathLoss: number): number {
  const { n } = points;
  const k = (5 * pathLoss) / Math.LN10; // 10·n·log10(d) = k·ln(d²)
  let sumY = 0;
  let sumS = 0;
  let sumYY = 0;
  let sumSS = 0;
  let sumYS = 0;
  for (let i = 0; i < n; i++) {
    const dx = bx - points.x[i]!;
    const dy = by - points.y[i]!;
    const d2 = Math.max(0.25, dx * dx + dy * dy);
    const facing = (dx * points.sin[i]! + dy * points.cos[i]!) / Math.sqrt(d2);
    const shade = (1 - facing) / 2;
    const y = points.rssi[i]! + k * Math.log(d2);
    sumY += y;
    sumS += shade;
    sumYY += y * y;
    sumSS += shade * shade;
    sumYS += y * shade;
  }
  const det = n * sumSS - sumS * sumS;
  // y = A − S·shade → regress y on shade; slope = −S.
  let shadow = det > 1e-9 ? -(n * sumYS - sumS * sumY) / det : 0;
  shadow = Math.min(15, Math.max(0, shadow));
  const a = (sumY + shadow * sumS) / n;
  // Σ(y + S·shade − A)² = Σ(y + S·shade)² − n·A²
  const total = sumYY + 2 * shadow * sumYS + shadow * shadow * sumSS;
  return Math.max(0, total - n * a * a);
}

/**
 * Where is the kiosk, seen from `here`? Needs either most of a turn on the
 * spot or a walk with a bend in it; otherwise the answer is ambiguous (a
 * straight walk can't tell left from right) and no arrow is given.
 */
export function locateBeacon(
  track: readonly TrackSample[],
  here: { x: number; y: number },
  { radius = 20, binMs = 500, minPoints = 10, minRatio = 1.5, pathLoss = PATH_LOSS_EXPONENT } = {},
): Located {
  const points = binTrack(track, binMs);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const walked = points.length
    ? Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
    : 0;
  if (points.length < minPoints) return { ok: false, reason: 'need-more', walked };
  const turned = turnCoverage(points);
  if (turned < 180 && walked < 2.5) return { ok: false, reason: 'need-more', walked };

  const prepared = prepare(points);
  const coarse: { bearing: number; error: number }[] = [];
  let best = { x: here.x, y: here.y, error: Infinity };
  for (let gx = -radius; gx <= radius; gx += 1) {
    for (let gy = -radius; gy <= radius; gy += 1) {
      if (Math.hypot(gx, gy) > radius) continue;
      const bx = here.x + gx;
      const by = here.y + gy;
      const error = fitError(prepared, bx, by, pathLoss);
      if (Math.hypot(gx, gy) >= 1)
        coarse.push({ bearing: normalize(Math.atan2(gx, gy) / RAD), error });
      if (error < best.error) best = { x: bx, y: by, error };
    }
  }
  // Refine around the best cell.
  const center = { ...best };
  for (let gx = -1.5; gx <= 1.5; gx += 0.25) {
    for (let gy = -1.5; gy <= 1.5; gy += 0.25) {
      const error = fitError(prepared, center.x + gx, center.y + gy, pathLoss);
      if (error < best.error) best = { x: center.x + gx, y: center.y + gy, error };
    }
  }
  const distance = Math.hypot(best.x - here.x, best.y - here.y);
  const bearing = normalize(Math.atan2(best.x - here.x, best.y - here.y) / RAD);
  // Is a clearly different direction almost as good? Then don't guess.
  const rival = Math.min(
    ...coarse.filter((cell) => angleGap(cell.bearing, bearing) > 60).map((cell) => cell.error),
  );
  const confidence = rival / Math.max(best.error, 1e-6);
  if (distance >= 1 && confidence < minRatio) return { ok: false, reason: 'unclear', walked };
  return { ok: true, bearing, distance, confidence, walked };
}

// ---------------------------------------------------------------------------
// Hot/cold guidance. No compass needed: turn or walk, and follow the signal as
// it gets stronger ("warmer"). Heat mixes how close the signal says you are
// (calibrated 1 m = hot, about 10 m = cold) with where the current signal sits
// in what this walk has seen so far (facing the kiosk vs. facing away).
// ---------------------------------------------------------------------------

export type HeatLevel = 'cold' | 'cool' | 'warm' | 'hot';
export type Heat = { value: number; level: HeatLevel; change: 'warmer' | 'colder' | 'steady' };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function hotCold(
  history: readonly { at: number; rssi: number }[],
  now: number,
  rssiAt1m = DEFAULT_RSSI_AT_1M,
): Heat | null {
  const between = (fromMs: number, toMs: number) =>
    history.filter((h) => now - h.at >= fromMs && now - h.at < toMs).map((h) => h.rssi);
  let latest = between(0, 1500);
  if (latest.length < 2) latest = history.slice(-3).map((h) => h.rssi);
  const current = smoothRssi(latest, latest.length);
  if (current == null) return null;
  const earlier = between(1500, 4500);
  const previous = smoothRssi(earlier, earlier.length);
  const change =
    previous == null
      ? 'steady'
      : current - previous >= 3
        ? 'warmer'
        : previous - current >= 3
          ? 'colder'
          : 'steady';
  const absolute = clamp01((current - (rssiAt1m - 25)) / 25);
  const seen = between(0, 20000).sort((a, b) => a - b);
  let relative = 0.5;
  if (seen.length >= 6) {
    const low = seen[Math.floor(seen.length * 0.1)]!;
    const high = seen[Math.floor(seen.length * 0.9)]!;
    if (high - low >= 5) relative = clamp01((current - low) / (high - low));
  }
  const value = 0.6 * absolute + 0.4 * relative;
  const level: HeatLevel =
    value < 0.3 ? 'cold' : value < 0.55 ? 'cool' : value < 0.8 ? 'warm' : 'hot';
  return { value, level, change };
}

/** Parking-sensor style: beeps every 1.2 s when cold, about every 0.15 s when hot. */
export function beepInterval(heat: number, near = false): number {
  return near ? 120 : Math.round(1200 * 0.12 ** clamp01(heat));
}
