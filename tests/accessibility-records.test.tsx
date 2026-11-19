import { render, screen } from '@testing-library/react-native';
import AccessibilityDetails from '@/app/accessibility';
import { LanguageContext } from '@/lib/i18n';
jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));
jest.mock('@/components/feedback', () => ({
  Problem: ({ message }: { message: string }) =>
    require('react').createElement(require('react-native').Text, null, message),
}));
const mockNearby = jest.fn();
const mockApi = { accessibilityNearby: mockNearby };
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ lat: '37.55', lng: '126.97', name: 'Station' }),
}));
jest.mock('@/components/screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/providers/app-provider', () => ({
  useApp: () => ({
    api: mockApi,
    report: jest.fn(),
    announce: jest.fn(),
  }),
}));

test('nearby records explain missing data, coverage and source dates in English', async () => {
  const source = {
    name: '© OpenStreetMap contributors',
    date: '2026-08-16',
    license: 'ODbL 1.0',
    url: 'https://www.openstreetmap.org/copyright',
    coverage: 'Korea',
  };
  mockNearby.mockResolvedValue({
    radiusM: 300,
    groups: [
      { kind: 'tactile', status: 'not-recorded', source, items: [] },
      { kind: 'audio_signals', status: 'outside-coverage', source, items: [] },
    ],
  });
  await render(
    <LanguageContext.Provider value="en">
      <AccessibilityDetails />
    </LanguageContext.Provider>,
  );
  await screen.findByText('No nearby records. This does not mean the facility is absent.');
  expect(screen.getByText("Outside this dataset's coverage.")).toBeTruthy();
  expect(screen.getAllByText('© OpenStreetMap contributors · 2026-08-16 · ODbL 1.0')).toHaveLength(
    2,
  );
  expect(mockNearby).toHaveBeenCalledWith(37.55, 126.97);
});
