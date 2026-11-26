// Indoor guidance to a kiosk from ONE BLE beacon (the XIAO "LK…" broadcast).
//
// Distance: received signal strength (RSSI) with a log-distance path-loss model,
// calibrated by "RSSI at 1 m". Rough: ±1–3 m; shown in steps.
// Direction comes from three boards (see ble-position.ts); one beacon gives
// distance and hot/cold only.

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
