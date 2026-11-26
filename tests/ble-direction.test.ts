import {
  beepInterval,
  distanceStep,
  hotCold,
  estimateDistanceM,
  parseBeaconName,
  smoothRssi,
} from '@/lib/ble-direction';

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

// --- Hot/cold ------------------------------------------------------------------

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
