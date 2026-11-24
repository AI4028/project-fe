import {
  beepInterval,
  distanceStep,
  estimateDirection,
  hotCold,
  locateBeacon,
  estimateDistanceM,
  parseBeaconName,
  signalFaded,
  smoothRssi,
  turnCoverage,
  type Sample,
  type TrackSample,
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

test('compass heading works flat and held upright', () => {
  const { headingFromOrientation } = jest.requireActual('@/lib/use-heading');
  // Flat, alpha 90 (counter-clockwise) → facing west (270).
  expect(headingFromOrientation(90, 0, 0)).toBeCloseTo(270, 5);
  expect(headingFromOrientation(0, 0, 0)).toBeCloseTo(0, 5);
  // Upright at the chest (beta 90): the back of the phone faces the same way.
  expect(headingFromOrientation(90, 90, 0)).toBeCloseTo(270, 5);
  expect(headingFromOrientation(300, 80, 0)).toBeCloseTo(60, 5);
  // Tilted 45° still agrees.
  expect(headingFromOrientation(200, 45, 0)).toBeCloseTo(160, 5);
});

test('kiosk guidance reads well in English', () => {
  const { translate } = jest.requireActual('@/lib/i18n');
  expect(translate('키오스크는 오른쪽, 3시 방향, 약 3m예요.', 'en')).toBe(
    "The kiosk is on your right, at 3 o'clock, about 3 m.",
  );
  expect(translate('GK01 키오스크 신호를 찾았어요. 10m 이상이에요.', 'en')).toBe(
    'Found the signal of kiosk GK01. 10 m or more.',
  );
  expect(translate('연결 코드 7H3KQ9ZC', 'en')).toBe('Connection code 7H3KQ9ZC');
  expect(translate('따뜻해지고 있어요. 이 방향이 맞아요.', 'en')).toBe(
    "Getting warmer. You're on the right track.",
  );
});

// --- Walk-and-learn arrow and hot/cold ---------------------------------------

// A customer near the kiosk (kiosk at the origin). Steps are 0.65 m on the
// phone's track but really longer or shorter; body shadow 8 dB; ±3 dB noise.
function simulateTrack(
  seed: number,
  plan: ({ rotate: number } | { walk: number; ms: number })[],
  away: number,
) {
  const random = jitterSource(seed);
  const next = () => random(0.5) + 0.5;
  const kiosk = next() * 360; // bearing from the start
  let x = -away * Math.sin((kiosk * Math.PI) / 180);
  let y = -away * Math.cos((kiosk * Math.PI) / 180);
  const here = { x: 0, y: 0 };
  const stride = 0.65 * (0.8 + next() * 0.4);
  const track: TrackSample[] = [];
  let at = 0;
  let heading = next() * 360;
  const record = () => {
    const d = Math.max(0.5, Math.hypot(x, y));
    const toKiosk = ((Math.atan2(-x, -y) * 180) / Math.PI + 360) % 360;
    const off = Math.abs(((heading - toKiosk + 540) % 360) - 180);
    track.push({
      at,
      ...here,
      heading: (heading + random(5) + 360) % 360,
      rssi: -59 - 25 * Math.log10(d) - (8 * off) / 180 + random(3),
    });
    at += 100;
  };
  for (const part of plan) {
    if ('rotate' in part) {
      const from = heading;
      for (let t = 0; t < part.rotate; t += 100) {
        heading = (from + (360 * t) / part.rotate) % 360;
        record();
      }
    } else {
      heading = (part.walk + kiosk + 360) % 360;
      for (let t = 0; t < part.ms; t += 100) {
        x += 0.11 * Math.sin((heading * Math.PI) / 180);
        y += 0.11 * Math.cos((heading * Math.PI) / 180);
        if (t % 500 === 400) {
          here.x += stride * Math.sin((heading * Math.PI) / 180);
          here.y += stride * Math.cos((heading * Math.PI) / 180);
        }
        record();
      }
    }
  }
  const truth = ((Math.atan2(-x, -y) * 180) / Math.PI + 360) % 360;
  return { located: locateBeacon(track, here), truth };
}

const gap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

test('turning on the spot locates the kiosk', () => {
  for (const seed of [3, 11, 29]) {
    const { located, truth } = simulateTrack(seed, [{ rotate: 15000 }], 6);
    expect(located.ok).toBe(true);
    if (located.ok) expect(gap(located.bearing, truth)).toBeLessThan(25);
  }
});

test('walking with a bend locates the kiosk, even after passing it', () => {
  for (const seed of [5, 17]) {
    const passBy = simulateTrack(
      seed,
      [
        { walk: 20, ms: 6000 },
        { walk: 100, ms: 4000 },
      ],
      6,
    );
    expect(passBy.located.ok).toBe(true);
    if (passBy.located.ok) expect(gap(passBy.located.bearing, passBy.truth)).toBeLessThan(35);
    const zigzag = simulateTrack(
      seed,
      [
        { walk: 70, ms: 3000 },
        { walk: -50, ms: 3000 },
        { walk: 60, ms: 3000 },
      ],
      8,
    );
    expect(zigzag.located.ok).toBe(true);
    if (zigzag.located.ok) expect(gap(zigzag.located.bearing, zigzag.truth)).toBeLessThan(35);
  }
});

test('a straight walk or too little data gives no arrow instead of a guess', () => {
  for (const seed of [2, 8]) {
    const straight = simulateTrack(seed, [{ walk: 30, ms: 6000 }], 9);
    expect(straight.located.ok).toBe(false);
  }
  expect(simulateTrack(4, [{ rotate: 600 }], 5).located).toMatchObject({
    ok: false,
    reason: 'need-more',
  });
});

test('hot/cold: warmer when the signal rises, hot right at the kiosk', () => {
  const series = (from: number, to: number) =>
    Array.from({ length: 30 }, (_, i) => ({ at: i * 150, rssi: from + ((to - from) * i) / 29 }));
  const rising = hotCold(series(-82, -64), 29 * 150)!;
  expect(rising.change).toBe('warmer');
  const falling = hotCold(series(-62, -80), 29 * 150)!;
  expect(falling.change).toBe('colder');
  expect(rising.value).toBeGreaterThan(falling.value);
  const atKiosk = hotCold(series(-59, -59), 29 * 150, -59)!;
  expect(atKiosk.level).toBe('hot');
  const far = hotCold(series(-88, -88), 29 * 150, -59)!;
  expect(far.level).toBe('cold');
  expect(hotCold([], 0)).toBeNull();
});

test('beeps speed up as it gets hotter', () => {
  expect(beepInterval(0)).toBe(1200);
  expect(beepInterval(1)).toBe(144);
  expect(beepInterval(0.5)).toBeLessThan(beepInterval(0.2));
  expect(beepInterval(0.3, true)).toBe(120);
});
