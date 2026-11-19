import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text as MockText } from 'react-native';
import { router } from 'expo-router';
import Home from '@/app/index';
import ExploreLayout from '@/app/explore/_layout';
import Onboarding from '@/app/onboarding';
import { LanguageContext } from '@/lib/i18n';
import { exploreRoute, type Assistance, type ExploreMode } from '@/lib/location';

jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
const mockUpdateSettings = jest.fn();
const mockSettings: {
  assistance?: Assistance;
  exploreMode?: ExploreMode;
  apiBase: string;
  language: string;
  contrast: boolean;
  largeText: boolean;
  voiceInput: boolean;
} = {
  apiBase: 'http://127.0.0.1:8000',
  language: 'en',
  contrast: false,
  largeText: false,
  voiceInput: false,
};
let mockPath = '/explore/map';
jest.mock('@/providers/app-provider', () => ({
  useApp: () => ({ settings: mockSettings, updateSettings: mockUpdateSettings }),
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), canGoBack: () => false },
  usePathname: () => mockPath,
  useFocusEffect: () => {},
  Redirect: ({ href }: { href: string }) => <MockText>{href}</MockText>,
  Stack: () => <MockText>Explore route</MockText>,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateSettings.mockReset();
  mockSettings.assistance = undefined;
  mockSettings.exploreMode = undefined;
  mockPath = '/explore/map';
  mockUpdateSettings.mockResolvedValue(undefined);
});

test('first launch and invalid stored preferences go to onboarding', async () => {
  await render(<Home />);
  expect(screen.getByText('/onboarding')).toBeTruthy();
  expect(exploreRoute('invalid-old-value')).toBe('/onboarding');
});

test('the selected home view takes precedence over an existing assistance profile', async () => {
  mockSettings.assistance = 'visual';
  mockSettings.exploreMode = 'map';
  await render(<Home />);
  expect(screen.getByText('/explore/map')).toBeTruthy();
  expect(exploreRoute('visual', 'invalid-mode')).toBe('/explore/list');
});

test.each([
  ['visual', '/explore/list'],
  ['physical', '/explore/map'],
  ['wheelchair', '/explore/map'],
] as const)('returning %s users open %s', async (profile, target) => {
  mockSettings.assistance = profile;
  await render(<Home />);
  expect(screen.getByText(target)).toBeTruthy();
});

test('Explore links cannot bypass onboarding or the selected profile route', async () => {
  const result = await render(<ExploreLayout />);
  expect(screen.getByText('/onboarding')).toBeTruthy();
  mockSettings.assistance = 'visual';
  await result.rerender(<ExploreLayout />);
  expect(screen.getByText('/explore/list')).toBeTruthy();
  mockSettings.assistance = 'physical';
  await result.rerender(<ExploreLayout />);
  expect(screen.getByText('Explore route')).toBeTruthy();
  mockPath = '/explore/list';
  await result.rerender(<ExploreLayout />);
  expect(screen.getByText('/explore/map')).toBeTruthy();
});

test('leaving Explore for Orders or Settings does not redirect back to the map', async () => {
  mockSettings.assistance = 'wheelchair';
  const result = await render(<ExploreLayout />);
  mockPath = '/orders';
  await result.rerender(<ExploreLayout />);
  expect(screen.getByText('Explore route')).toBeTruthy();
  mockPath = '/settings';
  mockSettings.assistance = 'visual';
  await result.rerender(<ExploreLayout />);
  expect(screen.getByText('Explore route')).toBeTruthy();
  mockPath = '/explore/map';
  await result.rerender(<ExploreLayout />);
  expect(screen.getByText('/explore/list')).toBeTruthy();
});

test('onboarding previews independent accessibility settings and saves before opening the chosen view', async () => {
  let saved!: () => void;
  mockUpdateSettings.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        saved = resolve;
      }),
  );
  await render(<Onboarding />);
  expect(screen.queryAllByRole('tab')).toHaveLength(0);
  const contrast = screen.getByRole('switch', { name: '고대비' });
  const largeText = screen.getByRole('switch', { name: '큰 글씨' });
  const voice = screen.getByRole('switch', { name: '음성 명령' });
  const heading = screen.getByRole('heading', { name: '나에게 편한 이용 설정' });
  await fireEvent.press(contrast);
  expect(contrast.props.accessibilityState.checked).toBe(true);
  expect(voice.props.accessibilityState.checked).toBe(false);
  await fireEvent.press(largeText);
  expect(StyleSheet.flatten(heading.props.style).fontSize).toBe(64);
  await fireEvent.press(voice);
  await fireEvent.press(screen.getByRole('radio', { name: '그림 지도' }));
  await fireEvent.press(screen.getByRole('button', { name: '설정 완료하고 시작하기' }));
  expect(mockUpdateSettings).toHaveBeenCalledWith({
    exploreMode: 'map',
    textSize: 'xlarge',
    largeText: true,
    contrast: true,
    voiceInput: true,
  });
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('한국어로 전환')).toBeNull();
  await act(async () => saved());
  expect(router.replace).toHaveBeenCalledWith('/explore/map');
});

test('the single start action saves the displayed defaults', async () => {
  await render(
    <LanguageContext.Provider value="ko">
      <Onboarding />
    </LanguageContext.Provider>,
  );
  expect(screen.queryByRole('button', { name: '기본 설정으로 바로 시작' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '설정 완료하고 시작하기' }));
  expect(mockUpdateSettings).toHaveBeenCalledWith({
    exploreMode: 'list',
    textSize: 'base',
    largeText: false,
    contrast: false,
    voiceInput: false,
  });
  expect(router.replace).toHaveBeenCalledWith('/explore/list');
});

test('failed preference storage keeps the selection and allows retry', async () => {
  mockUpdateSettings.mockRejectedValueOnce(new Error('Could not save preference'));
  await render(<Onboarding />);
  await fireEvent.press(screen.getByRole('radio', { name: '그림 지도' }));
  await fireEvent.press(screen.getByRole('button', { name: '설정 완료하고 시작하기' }));
  await screen.findByText('Could not save preference');
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.getByRole('radio', { name: '그림 지도' }).props.accessibilityState.checked).toBe(
    true,
  );
  await fireEvent.press(screen.getByRole('button', { name: '설정 완료하고 시작하기' }));
  expect(router.replace).toHaveBeenCalledWith('/explore/map');
});
