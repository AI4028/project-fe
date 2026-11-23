import {
  distanceStep,
  estimateDirection,
  estimateDistanceM,
  parseBeaconName,
  signalFaded,
  smoothRssi,
  turnCoverage,
  type Sample,
} from '@/lib/ble-direction';

// Repeatable pseudo-random jitter (uniform in ±noise dB).
function jitterSource(seed: number) {
  let state = seed;
  return (noise: number) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return (state / 2147483648 - 0.5) * 2 * noise;
  };
}

// A slow turn: the body blocks the signal, strongest when facing the kiosk.
function turn(kioskBearing: number, noise = 0, seed = kioskBearing + 1): Sample[] {
  const samples: Sample[] = [];
  const jitterFor = jitterSource(seed);
  for (let heading = 0; heading < 360; heading += 6) {
    const off = Math.abs(((heading - kioskBearing + 540) % 360) - 180); // 0 = facing it
    const shadow = (off / 180) * 12; // up to 12 dB weaker with the back turned
    const jitter = noise ? jitterFor(noise) : 0;
    samples.push({ heading, rssi: -62 - shadow + jitter });
  }
  return samples;
}

test('reads the kiosk and code from the beacon name', () => {
  expect(parseBeaconName('LKGK017H3KQ9ZC')).toEqual({ kioskId: 'GK01', token: '7H3KQ9ZC' });
  expect(parseBeaconName('LKGK01ABCDEFGH')).toEqual({ kioskId: 'GK01', token: 'ABCDEFGH' });
  expect(parseBeaconName('LKGK01ABCDEFGI')).toBeNull(); // I is not in the code alphabet
  expect(parseBeaconName('JBL Flip 5')).toBeNull();
  expect(parseBeaconName(undefined)).toBeNull();
});

test('smoothing ignores single spikes', () => {
  expect(smoothRssi([-60, -61, -95, -60, -62])).toBe(-61);
  expect(smoothRssi([])).toBeNull();
});

test('distance from signal strength, shown in steps', () => {
  expect(estimateDistanceM(-59, -59)).toBeCloseTo(1, 5);
  expect(estimateDistanceM(-71, -59)).toBeCloseTo(3.02, 1); // 12 dB weaker ≈ 3 m
  expect(estimateDistanceM(-65, -65)).toBeCloseTo(1, 5); // calibration shifts the curve
  expect(distanceStep(0.6)).toEqual({ label: '1m 이내 · 바로 앞', near: true });
  expect(distanceStep(3).label).toBe('약 3m');
  expect(distanceStep(12).label).toBe('10m 이상');
});

test('finds the direction from one turn', () => {
  for (let bearing = 0; bearing < 360; bearing += 15) {
    const result = estimateDirection(turn(bearing, 4));
    expect(result.ok).toBe(true);
    if (!result.ok) continue;
    const error = Math.abs(((result.bearing - bearing + 540) % 360) - 180);
    expect(error).toBeLessThan(30);
  }
});

test('asks for another turn when the turn is incomplete or unclear', () => {
  expect(turnCoverage(turn(90).slice(0, 20))).toBeLessThan(270);
  expect(estimateDirection(turn(90).slice(0, 20))).toEqual({
    ok: false,
    reason: 'not-enough-turn',
  });
  const flat = turn(90).map((s) => ({ ...s, rssi: -70 }));
  expect(estimateDirection(flat)).toEqual({ ok: false, reason: 'no-clear-direction' });
});

test('notices when the signal fades after the direction was found', () => {
  expect(signalFaded(-62, -64)).toBe(false);
  expect(signalFaded(-62, -70)).toBe(true);
});
