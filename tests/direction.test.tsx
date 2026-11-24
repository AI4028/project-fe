import { render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import {
  bearingDeg,
  clockPosition,
  compassLabel,
  formatDistance,
  guidance,
  relativeDeg,
  sideLabel,
} from '@/lib/direction';
import { translate } from '@/lib/i18n';
import Direction from '@/app/direction';

// GIST 카페 (데모) and two points ~100 m south and ~100 m east of it.
const venue = { lat: 35.2281, lng: 126.8433 };
const south = { lat: 35.2272, lng: 126.8433 };
const west = { lat: 35.2281, lng: 126.8422 };

describe('direction math', () => {
  test('bearing points from the customer to the venue', () => {
    expect(bearingDeg(south, venue)).toBeCloseTo(0, 0); // venue is north
    expect(bearingDeg(west, venue)).toBeCloseTo(90, 0); // venue is east
  });

  test('the arrow turns with the phone', () => {
    expect(relativeDeg(90, 0)).toBe(90); // facing north, venue east → right
    expect(relativeDeg(90, 90)).toBe(0); // facing east → straight ahead
    expect(relativeDeg(0, 270)).toBe(90); // facing west, venue north → right
  });

  test('words and clock positions', () => {
    expect(sideLabel(0)).toBe('정면');
    expect(sideLabel(50)).toBe('오른쪽 앞');
    expect(sideLabel(180)).toBe('뒤쪽');
    expect(sideLabel(-90)).toBe('왼쪽');
    expect(clockPosition(0)).toBe(12);
    expect(clockPosition(60)).toBe(2);
    expect(clockPosition(270)).toBe(9);
    expect(compassLabel(45)).toBe('북동쪽');
  });

  test('distances are rounded so they do not flicker', () => {
    expect(formatDistance(3)).toBe('5m');
    expect(formatDistance(47)).toBe('45m');
    expect(formatDistance(123)).toBe('120m');
    expect(formatDistance(1534)).toBe('1.5km');
  });

  test('guidance sentences with and without a compass, and on arrival', () => {
    const withCompass = guidance(south, venue, 270, 5); // facing west, venue north
    expect(withCompass).toMatchObject({ arrived: false, side: '오른쪽', clock: 3, relative: 90 });
    expect(withCompass.sentence).toBe('매장은 오른쪽, 3시 방향으로 약 100m 떨어져 있어요.');

    const noCompass = guidance(south, venue, null, 5);
    expect(noCompass.sentence).toBe('매장은 북쪽으로 약 100m 떨어져 있어요.');

    const near = guidance({ lat: 35.22812, lng: 126.84331 }, venue, 0, 8);
    expect(near.arrived).toBe(true);
    // A poor GPS fix widens the arrival radius instead of pointing randomly.
    expect(guidance({ lat: 35.2284, lng: 126.8433 }, venue, 0, 40).arrived).toBe(true);
  });

  test('spoken sentences have English versions', () => {
    expect(translate('매장은 오른쪽, 3시 방향으로 약 100m 떨어져 있어요.', 'en')).toBe(
      "The venue is on your right, at 3 o'clock, about 100m away.",
    );
    expect(translate('매장은 북쪽으로 약 1.2km 떨어져 있어요.', 'en')).toBe(
      'The venue is about 1.2km to the north.',
    );
    expect(translate('왼쪽 앞 · 10시 방향', 'en')).toBe("ahead on your left · 10 o'clock");
  });
});

// Screen: a phone ~100 m south of the venue, facing west.
jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ storeId: 'gist-cafe' }) }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  watchPositionAsync: jest.fn(async (_options: unknown, callback: (r: unknown) => void) => {
    callback({ coords: { latitude: 35.2272, longitude: 126.8433, accuracy: 5 } });
    return { remove: jest.fn() };
  }),
}));
jest.mock('@/lib/use-heading', () => ({
  useHeading: () => ({ heading: 270, status: 'ok', request: jest.fn() }),
}));
jest.mock('@/components/screen', () => {
  const { Text, View } = require('react-native');
  return {
    Screen: ({ title, children }: { title: string; children: React.ReactNode }) => (
      <View>
        <Text>{title}</Text>
        {children}
      </View>
    ),
    NavLink: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});
jest.mock('@/components/feedback', () => {
  const { Text } = require('react-native');
  return { Problem: ({ message }: { message: string }) => <Text>{message}</Text> };
});
const mockApp = {
  store: null,
  api: {
    store: jest.fn().mockResolvedValue({
      storeId: 'gist-cafe',
      name: 'GIST 카페 (데모)',
      address: '광주',
      accessibility: {},
      location: { lat: 35.2281, lng: 126.8433 },
    }),
  },
  announce: jest.fn(),
  readAloud: jest.fn(),
};
jest.mock('@/providers/app-provider', () => ({ useApp: () => mockApp }));

test('shows distance, direction words and a rotated arrow, and announces them', async () => {
  await render(<Direction />);
  await waitFor(() => expect(screen.getByText('100m')).toBeTruthy());
  expect(screen.getByText('오른쪽 · 3시 방향')).toBeTruthy();
  // Decorative and hidden from screen readers; the words above carry the meaning.
  const arrow = screen.getByTestId('direction-arrow', { includeHiddenElements: true });
  expect(StyleSheet.flatten(arrow.props.style).transform).toEqual([{ rotate: '90deg' }]);
  expect(mockApp.announce).toHaveBeenCalledWith(
    '매장은 오른쪽, 3시 방향으로 약 100m 떨어져 있어요.',
  );
});
