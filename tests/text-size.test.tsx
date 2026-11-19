import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { LimitTextScale, Text, TextScaleContext } from '@/components/ui/text';
import { resolveTextSize, textScale } from '@/lib/text-size';
import Settings from '@/app/settings';

jest.mock('@/components/ui/dialog', () => ({
  Dialog: () => null,
  DialogContent: () => null,
  DialogTitle: () => null,
  DialogDescription: () => null,
}));
jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false },
  usePathname: () => '/settings',
  useFocusEffect: () => {},
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
const mockSaveSettings = jest.fn().mockResolvedValue(undefined);
const mockApp = {
  settings: { apiBase: 'http://127.0.0.1:8000', contrast: false, largeText: false, speech: false },
  updateSettings: mockSaveSettings,
  report: jest.fn(),
  announce: jest.fn(),
  busy: false,
  connection: null,
  order: null,
  items: [],
  cart: { lines: [], total: 0, summary: '' },
};
jest.mock('@/providers/app-provider', () => ({ useApp: () => mockApp }));

test('old on/off large text keeps working and maps to the middle step', () => {
  expect(resolveTextSize({})).toBe('base');
  expect(resolveTextSize({ largeText: true })).toBe('large');
  expect(resolveTextSize({ largeText: false, textSize: 'xlarge' })).toBe('xlarge');
  expect(resolveTextSize({ largeText: true, textSize: 'nonsense' })).toBe('large');
  expect(textScale('base')).toBe(1);
  expect(textScale('xlarge')).toBe(2);
});

test('the largest step renders text at 200%', async () => {
  await render(
    <TextScaleContext.Provider value={textScale('xlarge')}>
      <Text>장바구니</Text>
    </TextScaleContext.Provider>,
  );
  const style = StyleSheet.flatten(screen.getByText('장바구니').props.style);
  expect(style.fontSize).toBe(32);
});

test('fixed bars grow only part of the way while content uses the full scale', async () => {
  await render(
    <TextScaleContext.Provider value={2}>
      <LimitTextScale max={1.3}>
        <Text>둘러보기</Text>
      </LimitTextScale>
      <Text>본문</Text>
    </TextScaleContext.Provider>,
  );
  expect(StyleSheet.flatten(screen.getByText('둘러보기').props.style).fontSize).toBeCloseTo(20.8);
  expect(StyleSheet.flatten(screen.getByText('본문').props.style).fontSize).toBe(32);
});

test('settings saves the 200% large-text switch', async () => {
  await render(<Settings />);
  expect(screen.getByRole('radio', { name: 'Switch to English' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: '언어 선택' })).toBeTruthy();
  const largest = screen.getByRole('switch', { name: '큰 글씨' });
  expect(largest.props.accessibilityState).toMatchObject({ checked: false });
  await fireEvent.press(largest);
  expect(mockSaveSettings).toHaveBeenCalledWith(
    expect.objectContaining({ textSize: 'xlarge', largeText: true }),
  );
});
