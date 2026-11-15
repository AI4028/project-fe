import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text as MockText, View as MockView, Pressable as MockPressable } from 'react-native';
import Discovery from '@/app/index';
import { filterStores } from '@/lib/discovery';
import type { Store } from '@/lib/types';
import { router } from 'expo-router';
import { StoreCard } from '@/components/store-card';

// These screens render Text directly, never its optional asChild slot.
jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));

const stores: Store[] = [
  {
    storeId: 'one',
    name: '첫 번째 카페',
    address: '서울 성수동',
    accessibility: { stepFreeEntrance: true, accessibleRestroom: true },
  },
  {
    storeId: 'two',
    name: '두 번째 카페',
    address: '서울 종로',
    accessibility: { stepFreeEntrance: false, accessibleRestroom: null },
  },
  { storeId: 'unknown', name: '정보 없는 카페', address: '광주', accessibility: {} },
];
const mockApi = { stores: jest.fn(), nearby: jest.fn() };
jest.mock('@/providers/app-provider', () => ({
  useApp: () => ({ api: mockApi, connection: null, settings: {}, report: jest.fn() }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@/components/language-switch', () => ({ LanguageSwitch: () => null }));
jest.mock('@/components/screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => <MockView>{children}</MockView>,
  NavLink: ({ children }: { children: React.ReactNode }) => <MockText>{children}</MockText>,
}));
jest.mock('@/components/feedback', () => ({
  SubmissionRecovery: () => null,
  Problem: ({ message, retry }: { message: string; retry: () => void }) => (
    <MockPressable onPress={retry}>
      <MockText>{message}</MockText>
    </MockPressable>
  ),
}));
jest.mock('@/components/store-map', () => ({
  __esModule: true,
  default: ({
    stores: values,
    onSelect,
  }: {
    stores: Store[];
    onSelect: (store: Store) => void;
  }) => (
    <MockView testID="store-map">
      {values.map((store) => (
        <MockPressable
          key={store.storeId}
          accessibilityLabel={`${store.name} 지도 핀`}
          onPress={() => onSelect(store)}
        >
          <MockText>{store.name}</MockText>
        </MockPressable>
      ))}
    </MockView>
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.stores.mockResolvedValue(stores);
});

test('a listed restroom never hides a known entrance barrier', async () => {
  await render(
    <StoreCard
      store={{
        ...stores[1]!,
        accessibility: { stepFreeEntrance: false, accessibleRestroom: true },
      }}
      onPress={jest.fn()}
      showDistance={false}
    />,
  );
  expect(screen.getByText('입구에 턱 있음 · 상세 확인')).toBeTruthy();
  expect(screen.getByText('장애인 화장실')).toBeTruthy();
});

test('accessibility filters exclude false, null and unknown facts without changing the source', () => {
  expect(filterStores(stores, '', 'step-free').map((store) => store.storeId)).toEqual(['one']);
  expect(filterStores(stores, '', 'restroom').map((store) => store.storeId)).toEqual(['one']);
  expect(filterStores(stores, '  종로  ', 'all').map((store) => store.storeId)).toEqual(['two']);
  expect(filterStores(stores, '광주', 'step-free')).toEqual([]);
  expect(stores).toHaveLength(3);
});

test('search and access conditions persist when switching from list to map and back', async () => {
  await render(<Discovery />);
  await fireEvent.press(screen.getByRole('radio', { name: '목록' }));
  await screen.findByLabelText('첫 번째 카페 매장 정보 보기');
  await fireEvent.changeText(screen.getByLabelText('매장 이름 또는 주소 검색'), '서울');
  await fireEvent.press(screen.getByRole('radio', { name: '턱 없는 입구' }));
  expect(screen.queryByLabelText('두 번째 카페 매장 정보 보기')).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: '지도' }));
  expect(screen.getByTestId('store-map')).toBeTruthy();
  expect(screen.queryByLabelText('두 번째 카페 지도 핀')).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: '목록' }));
  expect(screen.getByDisplayValue('서울')).toBeTruthy();
  expect(screen.getByLabelText('첫 번째 카페 매장 정보 보기')).toBeTruthy();
  expect(screen.queryByLabelText('두 번째 카페 매장 정보 보기')).toBeNull();
});

test('map selection previews a store and only the explicit detail action navigates', async () => {
  await render(<Discovery />);
  await screen.findByLabelText('첫 번째 카페 지도 핀');
  await fireEvent.press(screen.getByLabelText('두 번째 카페 지도 핀'));
  expect(router.push).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('매장 정보 · 메뉴'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/store', params: { storeId: 'two' } });
});

test('failed requests show recovery rather than claiming there are no stores', async () => {
  mockApi.stores.mockRejectedValueOnce(new Error('매장 연결 실패'));
  await render(<Discovery />);
  await screen.findByText('주문 매장 연결 불가 · 지도는 계속 이용할 수 있어요 · 다시 시도');
  expect(screen.queryByText('아직 맞는 매장이 없어요')).toBeNull();
  expect(screen.getByTestId('store-map')).toBeTruthy();
  await fireEvent.press(
    screen.getByText('주문 매장 연결 불가 · 지도는 계속 이용할 수 있어요 · 다시 시도'),
  );
  await waitFor(() => expect(screen.getByLabelText('첫 번째 카페 지도 핀')).toBeTruthy());
});
