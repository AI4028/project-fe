import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking, Text as MockText, View as MockView } from 'react-native';
import { CartScreen } from '@/components/cart-screen';
import Guide from '@/app/guide';
import { PlaceActions } from '@/components/place-actions';

const store = {
  storeId: 'cafe',
  name: 'Cafe',
  address: '',
  accessibility: {},
  location: { lat: 35.2281, lng: 126.8433 },
  menu: [
    {
      id: 'tea',
      name: 'Tea',
      description: '',
      category: 'Tea',
      price: 1000,
      available: true,
      options: [],
    },
  ],
};
const mockApp = {
  connection: { storeId: 'cafe' },
  ready: true,
  settings: {},
  get store() {
    return store;
  },
  items: [{ itemId: 'tea', options: {}, qty: 1 }],
  cart: {
    total: 1000,
    lines: [{ itemId: 'tea', name: 'Tea', qty: 1, lineTotal: 1000, options: [] }],
  },
};
let mockPath = '/cart';
let mockBlur: (() => void) | undefined;
const mockPush = jest.fn((route: { pathname: string }) => {
  mockPath = route.pathname;
});
jest.mock('expo-router', () => ({
  usePathname: () => mockPath,
  useLocalSearchParams: () => ({ storeId: 'cafe', stage: 'signal' }),
  useFocusEffect: (callback: () => () => void) => {
    mockBlur = callback();
  },
  router: { push: (route: { pathname: string }) => mockPush(route) },
}));
jest.mock('@/providers/app-provider', () => ({ useApp: () => mockApp }));
jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));
jest.mock('@/components/screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => <MockView>{children}</MockView>,
  NavLink: ({ children }: { children: React.ReactNode }) => <MockText>{children}</MockText>,
}));
jest.mock('@/components/feedback', () => ({ SubmissionRecovery: () => null }));
jest.mock('@/components/ui/dialog', () => ({
  Dialog: () => null,
  DialogContent: MockView,
  DialogTitle: MockText,
}));
jest.mock('@/components/item-options-sheet', () => ({
  ItemOptionsSheet: () => <MockText>Edit cart sheet</MockText>,
}));

test('an existing cart editor cannot cover Directions or reopen when returning to the cart', async () => {
  const tree = (
    <>
      <CartScreen />
      <PlaceActions store={store} />
    </>
  );
  const view = await render(tree);
  await fireEvent.press(screen.getByLabelText('Tea 옵션과 수량 수정'));
  expect(screen.getByText('Edit cart sheet')).toBeTruthy();
  await fireEvent.press(screen.getByText('길 안내'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/guide', params: { storeId: 'cafe' } });
  await act(async () => mockBlur?.());
  await view.rerender(
    <>
      <CartScreen />
      <PlaceActions store={store} />
    </>,
  );
  expect(screen.queryByText('Edit cart sheet')).toBeNull();
  mockPath = '/cart';
  await view.rerender(tree);
  expect(screen.queryByText('Edit cart sheet')).toBeNull();
});

test('directions stay in the app instead of switching to a map app', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  try {
    await render(<Guide />);
    expect(screen.queryByText('지도 앱에서 길찾기')).toBeNull();
    await fireEvent.press(screen.getByText('길 안내 시작'));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/direction',
      params: { storeId: 'cafe' },
    });
    expect(open).not.toHaveBeenCalled();
  } finally {
    open.mockRestore();
  }
});
