import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text as MockText, View as MockView, Pressable as MockPressable } from 'react-native';
import Discovery from '@/app/explore/list';
import MapExplore from '@/app/explore/map';
import { filterStores } from '@/lib/discovery';
import type { Store } from '@/lib/types';
import { router } from 'expo-router';
import { StoreCard } from '@/components/store-card';
import * as Location from 'expo-location';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

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
const mockApi = { stores: jest.fn(), nearby: jest.fn(), searchPlaces: jest.fn() };
jest.mock('@/providers/app-provider', () => ({
  useApp: () => ({ api: mockApi, connection: null, settings: {}, report: jest.fn() }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  usePathname: () => '/',
  useFocusEffect: jest.fn(),
}));
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
  mockApi.stores.mockReset();
  mockApi.searchPlaces.mockReset();
  jest.mocked(Location.requestForegroundPermissionsAsync).mockReset();
  jest.mocked(Location.getCurrentPositionAsync).mockReset();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 37.5445, longitude: 127.056 },
  } as Location.LocationObject);
  mockApi.stores.mockResolvedValue(stores);
  mockApi.searchPlaces.mockResolvedValue({
    places: [],
    status: 'empty',
    generalSearch: 'available',
  });
});

test('find nearby clears the old query and exposes nearby results in the list', async () => {
  mockApi.stores.mockResolvedValue([{ ...stores[0], location: { lat: 35.1, lng: 129.1 } }]);
  await render(<Discovery />);
  await fireEvent.press(screen.getByLabelText('검색 열기'));
  await fireEvent.changeText(screen.getByLabelText('매장 이름 또는 주소 검색'), 'old destination');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  mockApi.searchPlaces.mockResolvedValue({
    places: [
      {
        ...stores[1],
        name: 'Nearby cafe',
        directoryOnly: true,
        placeKind: 'venue',
        location: { lat: 37.5446, lng: 127.056 },
      },
    ],
    status: 'results',
    generalSearch: 'available',
  });
  await fireEvent.press(screen.getByLabelText('내 주변에서 찾기'));
  await screen.findByLabelText('Nearby cafe 매장 정보 보기');
  expect(mockApi.searchPlaces).toHaveBeenLastCalledWith('', 'all', { lat: 37.5445, lng: 127.056 });
  expect(screen.queryByLabelText('첫 번째 카페 매장 정보 보기')).toBeNull();
  await fireEvent.press(screen.getByLabelText('검색 열기'));
  expect(screen.getByLabelText('매장 이름 또는 주소 검색').props.value).toBe('');
});

test('location denial stays visible even when ordering is offline', async () => {
  mockApi.stores.mockRejectedValueOnce(new TypeError('offline'));
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValueOnce({ granted: false } as Location.LocationPermissionResponse);
  await render(<Discovery />);
  await screen.findByText('주문 연결 불가');
  await fireEvent.press(screen.getByLabelText('내 주변에서 찾기'));
  await screen.findByText(
    '위치 권한이 꺼져 있어요. 기기 설정에서 허용하거나 장소 이름을 검색해 주세요.',
  );
  expect(screen.queryByText('주문 연결 불가')).toBeNull();
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});

test('a stalled location request times out and ignores a late position', async () => {
  let settle!: (value: Location.LocationObject) => void;
  jest.mocked(Location.getCurrentPositionAsync).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
  );
  await render(<Discovery />);
  jest.useFakeTimers();
  try {
    await fireEvent.press(screen.getByLabelText('내 주변에서 찾기'));
    await act(async () => {
      jest.advanceTimersByTime(12000);
    });
    expect(screen.getByText('위치를 확인하지 못했어요. 검색으로 장소를 찾아주세요.')).toBeTruthy();
    expect(screen.queryByText('위치 확인 중…')).toBeNull();
    await act(async () => {
      settle({ coords: { latitude: 37.5445, longitude: 127.056 } } as Location.LocationObject);
    });
    expect(mockApi.searchPlaces).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

test('failed search shows one recovery state without a misleading zero count', async () => {
  mockApi.stores.mockRejectedValueOnce(new TypeError('offline'));
  mockApi.searchPlaces.mockRejectedValueOnce(new TypeError('offline'));
  await render(<Discovery />);
  await fireEvent.press(screen.getByRole('radio', { name: '지하철역' }));
  await screen.findByText('장소를 불러오지 못했어요');
  expect(screen.queryByText('주문 연결 불가')).toBeNull();
  expect(screen.queryByText('0 개의 장소')).toBeNull();
  expect(screen.getByText('서버 연결 설정')).toBeTruthy();
  await fireEvent.press(screen.getByText('장소 검색 다시 시도'));
  await waitFor(() => expect(screen.queryByText('장소를 불러오지 못했어요')).toBeNull());
});

test('home keeps four labelled destinations and search expands only when requested', async () => {
  await render(<Discovery />);
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  expect(screen.queryByTestId('store-map')).toBeNull();
  expect(screen.queryByLabelText('매장 보기 방식')).toBeNull();
  expect(screen.getByRole('tab', { name: '둘러보기' }).props.accessibilityState.selected).toBe(
    true,
  );
  expect(screen.queryByLabelText('매장 이름 또는 주소 검색')).toBeNull();
  await fireEvent.press(screen.getByLabelText('검색 열기'));
  expect(screen.getByLabelText('매장 이름 또는 주소 검색')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('검색 닫기'));
  expect(screen.queryByLabelText('매장 이름 또는 주소 검색')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: '주문' }));
  expect(router.navigate).toHaveBeenCalledWith('/orders');
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

test('list search keeps its accessibility conditions without offering a map alternative', async () => {
  await render(<Discovery />);
  await screen.findByLabelText('첫 번째 카페 매장 정보 보기');
  await fireEvent.press(screen.getByLabelText('검색 열기'));
  await fireEvent.changeText(screen.getByLabelText('매장 이름 또는 주소 검색'), '서울');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  await fireEvent.press(screen.getByRole('radio', { name: '턱 없는 입구' }));
  expect(screen.queryByLabelText('두 번째 카페 매장 정보 보기')).toBeNull();
  await fireEvent.press(screen.getByLabelText('검색 열기'));
  expect(screen.getByDisplayValue('서울')).toBeTruthy();
  expect(screen.getByLabelText('첫 번째 카페 매장 정보 보기')).toBeTruthy();
  expect(screen.queryByLabelText('두 번째 카페 매장 정보 보기')).toBeNull();
  expect(screen.queryByTestId('store-map')).toBeNull();
});

test('map search and nearby stay on the visual map with working filters and no view toggle', async () => {
  mockApi.searchPlaces.mockResolvedValue({
    places: [
      {
        ...stores[0],
        storeId: 'place:nearby',
        name: 'Nearby cafe',
        directoryOnly: true,
        placeKind: 'venue',
        location: { lat: 37.5445, lng: 127.056 },
      },
    ],
    status: 'results',
    generalSearch: 'available',
  });
  await render(<MapExplore />);
  expect(screen.queryByLabelText('매장 보기 방식')).toBeNull();
  expect(screen.queryByLabelText('접근성 조건')).toBeNull();
  await fireEvent.press(screen.getByLabelText('장소 필터'));
  await fireEvent.press(screen.getByRole('radio', { name: '턱 없는 입구' }));
  expect(screen.queryByLabelText('두 번째 카페 지도 핀')).toBeNull();
  await fireEvent.press(screen.getByLabelText('장소 필터'));
  await fireEvent.press(screen.getByLabelText('검색 열기'));
  await fireEvent.changeText(screen.getByLabelText('매장 이름 또는 주소 검색'), 'Nearby');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  await screen.findByLabelText('Nearby cafe 지도 핀');
  expect(screen.getByTestId('store-map')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('내 주변에서 찾기'));
  await waitFor(() =>
    expect(mockApi.searchPlaces).toHaveBeenLastCalledWith('', 'all', {
      lat: 37.5445,
      lng: 127.056,
    }),
  );
  expect(screen.getByTestId('store-map')).toBeTruthy();
  expect(screen.queryByText('가까운 장소')).toBeNull();
});

test('map search failures stay visible and recover without switching to a list', async () => {
  mockApi.searchPlaces.mockRejectedValueOnce(new TypeError('offline'));
  await render(<MapExplore />);
  await fireEvent.press(screen.getByLabelText('검색 열기'));
  await fireEvent.changeText(screen.getByLabelText('매장 이름 또는 주소 검색'), 'Seoul');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  await screen.findByText('장소를 불러오지 못했어요');
  expect(screen.getByTestId('store-map')).toBeTruthy();
  expect(screen.queryByText('0 개의 장소')).toBeNull();
  await fireEvent.press(screen.getByText('장소 검색 다시 시도'));
  await waitFor(() => expect(screen.queryByText('장소를 불러오지 못했어요')).toBeNull());
  expect(screen.getByTestId('store-map')).toBeTruthy();
});

test('map selection previews a store and only the explicit detail action navigates', async () => {
  await render(<MapExplore />);
  await screen.findByLabelText('첫 번째 카페 지도 핀');
  await fireEvent.press(screen.getByLabelText('두 번째 카페 지도 핀'));
  expect(router.push).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('매장 정보 · 메뉴'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/store', params: { storeId: 'two' } });
});

test('failed requests show recovery rather than claiming there are no stores', async () => {
  mockApi.stores.mockRejectedValueOnce(new Error('매장 연결 실패'));
  await render(<MapExplore />);
  await screen.findByText('주문 연결 불가');
  expect(screen.queryByText('아직 맞는 매장이 없어요')).toBeNull();
  expect(screen.getByTestId('store-map')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('주문 연결 다시 시도'));
  await waitFor(() => expect(screen.getByLabelText('첫 번째 카페 지도 핀')).toBeTruthy());
  expect(screen.queryByText('주문 연결 불가')).toBeNull();
});

test('ordering notice can be dismissed without hiding the map or location control', async () => {
  mockApi.stores.mockRejectedValueOnce(new Error('offline'));
  await render(<MapExplore />);
  await screen.findByText('주문 연결 불가');
  await fireEvent.press(screen.getByLabelText('알림 닫기'));
  expect(screen.queryByText('주문 연결 불가')).toBeNull();
  expect(screen.getByTestId('store-map')).toBeTruthy();
  expect(screen.getByLabelText('내 주변에서 찾기')).toBeTruthy();
});

test('station search is available in the text list without relying on map SDK results', async () => {
  mockApi.searchPlaces.mockResolvedValueOnce({
    places: [
      {
        ...stores[0],
        storeId: 'station:seongsu',
        name: '성수역',
        directoryOnly: true,
        placeKind: 'station',
        location: { lat: 37.544, lng: 127.056 },
      },
    ],
    status: 'results',
    generalSearch: 'not-configured',
  });
  await render(<Discovery />);
  await fireEvent.press(screen.getByLabelText('검색 열기'));
  await fireEvent.changeText(screen.getByLabelText('매장 이름 또는 주소 검색'), '성수역');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  await screen.findByLabelText('성수역 매장 정보 보기');
  expect(mockApi.searchPlaces).toHaveBeenCalledWith('성수역', 'all', null);
  await fireEvent.press(screen.getByLabelText('성수역 매장 정보 보기'));
  expect(screen.getByText('주변 접근성 정보')).toBeTruthy();
  expect(screen.queryByText('매장 정보 · 메뉴')).toBeNull();
});

test('unconfigured general search is not presented as an empty successful search', async () => {
  mockApi.searchPlaces.mockResolvedValueOnce({
    places: [],
    status: 'unavailable',
    generalSearch: 'not-configured',
  });
  await render(<Discovery />);
  await fireEvent.press(screen.getByLabelText('검색 열기'));
  await fireEvent.changeText(screen.getByLabelText('매장 이름 또는 주소 검색'), 'Unknown venue');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  await screen.findByText(
    '일반 장소 검색은 준비 중이에요. 지하철역과 공공 접근성 자료는 검색할 수 있어요.',
  );
  expect(
    screen.queryByText('검색 결과가 없어요. 검색어를 바꾸거나 지도 앱에서 찾아보세요.'),
  ).toBeNull();
});

test('late search responses cannot replace a newer destination', async () => {
  let settle!: (value: unknown) => void;
  mockApi.searchPlaces.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
  );
  mockApi.searchPlaces.mockResolvedValueOnce({
    places: [{ ...stores[0], name: 'New destination' }],
    status: 'results',
    generalSearch: 'available',
  });
  await render(<Discovery />);
  await fireEvent.press(screen.getByLabelText('검색 열기'));
  await fireEvent.changeText(screen.getByLabelText('매장 이름 또는 주소 검색'), 'old');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  await fireEvent.press(screen.getByLabelText('검색 열기'));
  await fireEvent.changeText(screen.getByLabelText('매장 이름 또는 주소 검색'), 'new');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  await screen.findByLabelText('New destination 매장 정보 보기');
  await act(async () => {
    settle({
      places: [{ ...stores[1], name: 'Old destination' }],
      status: 'results',
      generalSearch: 'available',
    });
  });
  expect(screen.queryByLabelText('Old destination 매장 정보 보기')).toBeNull();
  expect(screen.getByLabelText('New destination 매장 정보 보기')).toBeTruthy();
});
