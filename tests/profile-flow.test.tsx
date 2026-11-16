import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';
import { router } from 'expo-router';
import Home from '@/app/index';
import ExploreLayout from '@/app/explore/_layout';
import Onboarding from '@/app/onboarding';
import { LanguageContext } from '@/lib/i18n';
import { exploreRoute, type Assistance } from '@/lib/location';

jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
const mockSaveSettings = jest.fn();
const mockSettings: { assistance?: Assistance; apiBase: string; language: string } = {
  apiBase: 'http://127.0.0.1:8000',
  language: 'en',
};
let mockPath = '/explore/map';
jest.mock('@/providers/app-provider', () => ({
  useApp: () => ({ settings: mockSettings, saveSettings: mockSaveSettings }),
}));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  usePathname: () => mockPath,
  Redirect: ({ href }: { href: string }) => <MockText>{href}</MockText>,
  Stack: () => <MockText>Explore route</MockText>,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSaveSettings.mockReset();
  mockSettings.assistance = undefined;
  mockPath = '/explore/map';
  mockSaveSettings.mockResolvedValue(undefined);
});

test('first launch and invalid stored profiles go to profile selection', async () => {
  await render(<Home />);
  expect(screen.getByText('/onboarding')).toBeTruthy();
  expect(exploreRoute('invalid-old-value')).toBe('/onboarding');
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

test.each([
  ['Visual impairment', 'visual', '/explore/list'],
  ['Physical disability', 'physical', '/explore/map'],
  ['Wheelchair user', 'wheelchair', '/explore/map'],
] as const)(
  'selection of %s persists before opening its Explore screen',
  async (label, profile, target) => {
    let saved!: () => void;
    mockSaveSettings.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          saved = resolve;
        }),
    );
    await render(
      <LanguageContext.Provider value="en">
        <Onboarding />
      </LanguageContext.Provider>,
    );
    expect(
      screen.getByRole('button', { name: /Get started/ }).props.accessibilityState.disabled,
    ).toBe(true);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    await fireEvent.press(screen.getByRole('radio', { name: label }));
    expect(screen.getByRole('radio', { name: label }).props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: /Get started/ }));
    expect(mockSaveSettings).toHaveBeenCalledWith({ ...mockSettings, assistance: profile });
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText('한국어로 전환').props.accessibilityState.disabled).toBe(true);
    await act(async () => {
      saved();
    });
    expect(router.replace).toHaveBeenCalledWith(target);
  },
);

test('failed preference storage keeps the selection and allows retry', async () => {
  mockSaveSettings.mockRejectedValueOnce(new Error('Could not save preference'));
  await render(<Onboarding />);
  await fireEvent.press(screen.getByRole('radio', { name: '시각장애' }));
  await fireEvent.press(screen.getByRole('button', { name: /시작하기/ }));
  await screen.findByText('Could not save preference');
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.getByRole('radio', { name: '시각장애' }).props.accessibilityState.checked).toBe(
    true,
  );
  await fireEvent.press(screen.getByRole('button', { name: /시작하기/ }));
  expect(router.replace).toHaveBeenCalledWith('/explore/list');
});
