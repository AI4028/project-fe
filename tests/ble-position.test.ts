import {
  DEFAULT_SETUP,
  parseAnchorName,
  roomBearing,
  roomToCompass,
  setupProblem,
  smoothPosition,
  trilaterate,
  type BoardReading,
  type Spot,
} from '@/lib/ble-position';

// Repeatable pseudo-random numbers in [0, 1).
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const boards: Spot[] = [
  { x: 0, y: 0 },
  { x: 0, y: 4 },
  { x: 3, y: 2 },
];
const gap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

// What the phone would read at `phone` facing `heading` (room degrees): path
// loss n = 2.5, 8 dB body shadow, ±3 dB noise, median of 15 readings.
function readingsAt(phone: Spot, heading: number, next: () => number, calibrationError = 0) {
  return boards.map((spot): BoardReading => {
    const d = Math.max(0.3, Math.hypot(spot.x - phone.x, spot.y - phone.y));
    const toBoard = (Math.atan2(spot.x - phone.x, spot.y - phone.y) * 180) / Math.PI;
    const shadow = (8 * gap(heading, toBoard)) / 180;
    const samples = Array.from(
      { length: 15 },
      () => -59 - 25 * Math.log10(d) - shadow + (next() - 0.5) * 6,
    ).sort((a, b) => a - b);
    return { spot, rssi: samples[7]!, rssiAt1m: -59 + (next() - 0.5) * 2 * calibrationError };
  });
}

test('reads the position boards by name', () => {
  expect(parseAnchorName('LAGK01B')).toEqual({ kioskId: 'GK01', letter: 'B' });
  expect(parseAnchorName('LAGK01C')).toEqual({ kioskId: 'GK01', letter: 'C' });
  expect(parseAnchorName('LAGK01D')).toBeNull();
  expect(parseAnchorName('LKGK017H3KQ9ZC')).toBeNull(); // the kiosk board itself
  expect(parseAnchorName(undefined)).toBeNull();
});

test('setup needs boards in a triangle and a saved forward direction', () => {
  expect(setupProblem(DEFAULT_SETUP)).toBe('no-forward');
  const ready = { ...DEFAULT_SETUP, forwardHeading: 40 };
  expect(setupProblem(ready)).toBeNull();
  const inLine = { ...ready, spots: { B: { x: 0, y: 4 }, C: { x: 0, y: 2 } } };
  expect(setupProblem(inLine)).toBe('boards-in-line');
  const tooClose = { ...ready, spots: { B: { x: 0, y: 0.5 }, C: { x: 3, y: 2 } } };
  expect(setupProblem(tooClose)).toBe('boards-in-line');
});

test('room directions turn into compass directions', () => {
  expect(roomBearing({ x: 0, y: 0 }, { x: 0, y: 5 })).toBeCloseTo(0, 5); // forward
  expect(roomBearing({ x: 0, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(90, 5); // right
  expect(roomBearing({ x: 2, y: 3 }, { x: 0, y: 0 })).toBeCloseTo(213.69, 1);
  expect(roomToCompass(90, 300)).toBe(30);
});

test('three boards find the phone and the way to the kiosk', () => {
  const next = random(7);
  const positionErrors: number[] = [];
  const arrowErrors: number[] = [];
  while (positionErrors.length < 60) {
    const phone = { x: -1 + next() * 6, y: -1 + next() * 7 };
    if (Math.hypot(phone.x, phone.y) < 1.5) continue;
    const heading = next() * 360;
    const estimate = trilaterate(readingsAt(phone, heading, next, 2), heading)!;
    positionErrors.push(Math.hypot(estimate.x - phone.x, estimate.y - phone.y));
    arrowErrors.push(
      gap(roomBearing(estimate, { x: 0, y: 0 }), roomBearing(phone, { x: 0, y: 0 })),
    );
  }
  const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
  expect(median(positionErrors)).toBeLessThan(1.2);
  expect(median(arrowErrors)).toBeLessThan(15);
});

test('needs all three boards', () => {
  const next = random(3);
  expect(trilaterate(readingsAt({ x: 2, y: 3 }, 0, next).slice(0, 2), 0)).toBeNull();
});

test('positions are smoothed over time', () => {
  const first = { x: 0, y: 0, uncertainty: 1 };
  const jump = { x: 2, y: 0, uncertainty: 1 };
  expect(smoothPosition(null, jump)).toBe(jump);
  expect(smoothPosition(first, jump).x).toBeCloseTo(0.7, 5);
});

test('three-board text reads well in English', () => {
  const { translate } = jest.requireActual('@/lib/i18n');
  expect(translate('보드 B: 신호 -71dBm', 'en')).toBe('Board B: signal -71 dBm');
  expect(translate('보드 3개 위치: 키오스크까지 2.4m · 오차 약 ±0.8m', 'en')).toBe(
    '3-board position: 2.4 m to the kiosk · about ±0.8 m',
  );
  expect(translate('화살표: 보드 3개로 내 위치를 찾았어요', 'en')).toBe(
    'Arrow: from your position (3 boards)',
  );
});
