import { translate } from '@/lib/i18n';
import { currentInstruction, isOffRoute, routeProgress, type WalkStep } from '@/lib/walk-route';

// North 66 m along a street, then right (east) for about 45 m. Near GIST.
const corner = { lat: 35.2278, lng: 126.8433 };
const steps: WalkStep[] = [
  {
    instruction: '65m 이동',
    turn: null,
    action: null,
    distanceM: 66,
    path: [{ lat: 35.2272, lng: 126.8433 }, corner],
  },
  {
    instruction: '오른쪽으로 도세요. 그 후 45m 이동',
    turn: '오른쪽으로 도세요',
    action: 'right',
    distanceM: 45,
    path: [corner, { lat: 35.2278, lng: 126.8438 }],
  },
];

test('progress follows the walker along the route', () => {
  const start = routeProgress(steps, { lat: 35.2272, lng: 126.8433 })!;
  expect(start.step).toBe(0);
  expect(start.toTurnM).toBeCloseTo(66, 0);
  expect(start.remainingM).toBeCloseTo(112, 0);

  // Halfway up the street, standing 10 m to the side of it.
  const halfway = routeProgress(steps, { lat: 35.2275, lng: 126.84341 })!;
  expect(halfway.step).toBe(0);
  expect(halfway.toTurnM).toBeCloseTo(33, 0);
  expect(halfway.offRouteM).toBeCloseTo(10, 0);
  expect(isOffRoute(halfway, 5)).toBe(false);

  const turned = routeProgress(steps, { lat: 35.2278, lng: 126.8436 })!;
  expect(turned.step).toBe(1);
  expect(turned.toTurnM).toBeCloseTo(18, 0);
});

test('a step already reached is never undone, and leaving the line is noticed', () => {
  // Back at the start, but step 1 was already reached: measure from step 1.
  const back = routeProgress(steps, { lat: 35.2272, lng: 126.8433 }, 1)!;
  expect(back.step).toBe(1);
  expect(isOffRoute(back, 5)).toBe(true);
  // Poor GPS widens the margin.
  expect(isOffRoute({ ...back, offRouteM: 40 }, 30)).toBe(false);
  expect(routeProgress([], { lat: 0, lng: 0 })).toBeNull();
});

test('the current instruction names the distance and what comes next', () => {
  const start = routeProgress(steps, { lat: 35.2272, lng: 126.8433 })!;
  expect(currentInstruction(steps, start)).toEqual({
    now: '앞으로 65m 이동하세요.',
    next: '오른쪽으로 도세요. 그 후 45m 이동',
    sentence: '앞으로 65m 이동하세요. 다음: 오른쪽으로 도세요. 그 후 45m 이동',
  });
  const last = routeProgress(steps, { lat: 35.2278, lng: 126.8436 })!;
  expect(currentInstruction(steps, last).sentence).toBe('앞으로 20m 이동하세요.');
});

test('route sentences have English versions; route text stays as received', () => {
  expect(translate('앞으로 65m 이동하세요.', 'en')).toBe('Walk ahead 65m.');
  expect(translate('앞으로 65m 이동하세요. 다음: Turn right, then walk 45m', 'en')).toBe(
    'Walk ahead 65m. Next: Turn right, then walk 45m',
  );
  expect(translate('총 1.2km 남았어요', 'en')).toBe('1.2km to go');
});
