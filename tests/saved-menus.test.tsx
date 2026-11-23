import { fireEvent, render, screen } from '@testing-library/react-native';
import Saved from '@/app/saved';

jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('@/components/screen', () => ({
  Screen: require('react-native').View,
  NavLink: require('react-native').Text,
}));
const mockApi = { base: 'https://test.invalid', store: jest.fn() };
jest.mock('@/providers/app-provider', () => ({
  useApp: () => ({ api: mockApi, savedPlaces: [], savedPlacesReady: true, settings: {} }),
}));
jest.mock('@/lib/use-saved-menus', () => ({
  useSavedMenus: () => ({
    ready: true,
    entries: [{ storeId: 'cafe', itemId: 'tea', itemName: 'Tea' }],
  }),
}));

test('a saved item at a browse-only store explains why it cannot be ordered', async () => {
  mockApi.store.mockResolvedValue({
    storeId: 'cafe',
    name: 'Cafe',
    hasOrderTerminal: false,
    menu: [{ id: 'tea', name: 'Tea', available: true, price: 1000 }],
  });
  await render(<Saved />);
  await fireEvent.press(screen.getByText('메뉴'));
  expect(
    await screen.findByText('이 매장은 휴대폰 주문을 받을 수 없어요. 매장 직원에게 문의해 주세요.'),
  ).toBeTruthy();
  expect(screen.queryByText('메뉴 고르기')).toBeNull();
  expect(screen.queryByText('매장의 다른 메뉴 보기')).toBeNull();
});
