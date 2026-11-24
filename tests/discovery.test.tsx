import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  Platform,
  Text as MockText,
  View as MockView,
  Pressable as MockPressable,
} from 'react-native';
import Discovery from '@/app/explore/list';
import MapExplore from '@/app/explore/map';
import { filterStores } from '@/lib/discovery';
import type { Store } from '@/lib/types';
import { router } from 'expo-router';
import { StoreCard } from '@/components/store-card';
import * as Location from 'expo-location';

// These tests render the complete home screen while the same checkout is bundling Expo.
jest.setTimeout(15000);

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
const station: Store = {
  storeId: 'station:seongsu',
  name: '성수역',
  address: '서울 성수동',
  accessibility: {},
  directoryOnly: true,
  placeKind: 'station',
  location: { lat: 37.544, lng: 127.056 },
};
const mockApi = { stores: jest.fn(), nearby: jest.fn(), searchPlaces: jest.fn() };
const mockRememberSearch = jest.fn().mockResolvedValue(undefined);
const mockUpdateSettings = jest.fn().mockResolvedValue(undefined);
jest.mock('@/providers/app-provider', () => ({
  useApp: () => ({
    api: mockApi,
    connection: null,
    settings: {},
    report: jest.fn(),
    updateSettings: mockUpdateSettings,
    rememberSearch: mockRememberSearch,
  }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  usePathname: () => '/',
  useFocusEffect: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@/components/language-switch', () => ({ LanguageSwitch: () => null }));
const mockSpeechEvents = new Map<string, (event?: unknown) => void>();
const mockRequestMic = jest.fn();
jest.mock('expo-speech', () => ({ stop: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/speech-recognition', () => ({
  recognition: {
    ExpoSpeechRecognitionModule: {
      isRecognitionAvailable: () => true,
      requestPermissionsAsync: () => mockRequestMic(),
      start: () => mockSpeechEvents.get('start')?.(),
      stop: jest.fn(),
      abort: jest.fn(),
    },
    useSpeechRecognitionEvent: (name: string, callback: (event: unknown) => void) => {
      mockSpeechEvents.set(name, callback);
    },
  },
}));
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
  mockSpeechEvents.clear();
  mockRequestMic.mockResolvedValue({ granted: true });
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

test('voice recognition waits for the user to edit and confirm the search', async () => {
  await render(<Discovery />);
  await fireEvent.press(screen.getByLabelText('말로 검색'));
  await screen.findByText('듣고 있어요');
  await act(async () => {
    mockSpeechEvents.get('result')?.({ isFinal: true, results: [{ transcript: '카패' }] });
  });
  expect(mockApi.searchPlaces).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('들은 검색어 수정'), '카페');
  await fireEvent.press(screen.getByText('이 문구로 검색'));
  await waitFor(() => expect(mockApi.searchPlaces).toHaveBeenCalledWith('카페', 'all', null));
});

test('denied microphone keeps a typed query available', async () => {
  mockRequestMic.mockResolvedValueOnce({ granted: false });
  await render(<Discovery />);
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  await fireEvent.changeText(screen.getByPlaceholderText('매장 또는 메뉴 검색'), '성수');
  await fireEvent.press(screen.getByLabelText('말로 검색'));
  await screen.findByText('마이크를 사용할 수 없어요');
  await fireEvent.press(screen.getByText('글자로 입력하기'));
  expect(screen.getByDisplayValue('성수')).toBeTruthy();
  expect(mockApi.searchPlaces).not.toHaveBeenCalled();
});

test('find nearby clears the old query and shows cafes without station results', async () => {
  mockApi.stores.mockResolvedValue([{ ...stores[0], location: { lat: 35.1, lng: 129.1 } }]);
  await render(<Discovery />);
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  await fireEvent.changeText(screen.getByPlaceholderText('매장 또는 메뉴 검색'), 'old destination');
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
      station,
    ],
    status: 'results',
    generalSearch: 'available',
  });
  await fireEvent.press(screen.getByLabelText('내 주변에서 찾기'));
  await screen.findByLabelText('Nearby cafe 매장 정보 보기');
  expect(mockApi.searchPlaces).toHaveBeenLastCalledWith('', 'all', { lat: 37.5445, lng: 127.056 });
  expect(screen.queryByLabelText('성수역 매장 정보 보기')).toBeNull();
  expect(screen.queryByLabelText('첫 번째 카페 매장 정보 보기')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  expect(screen.getByPlaceholderText('매장 또는 메뉴 검색').props.value).toBe('');
});

test('find nearby shows the empty state when an older server finds only stations', async () => {
  mockApi.searchPlaces.mockResolvedValueOnce({
    places: [station],
    status: 'results',
    generalSearch: 'available',
  });
  await render(<Discovery />);
  await fireEvent.press(screen.getByLabelText('내 주변에서 찾기'));
  await screen.findByText('검색 결과가 없어요');
  expect(screen.queryByLabelText('성수역 매장 정보 보기')).toBeNull();
});

test('nearby ranks routed cafes by walking distance ahead of straight-line fallbacks', async () => {
  const ranked = [
    {
      ...stores[0],
      location: { lat: 37.5445, lng: 127.056 },
      walkingRoute: { distanceM: 1200, durationS: 901 },
    },
    {
      ...stores[1],
      location: { lat: 37.5455, lng: 127.056 },
      walkingRoute: { distanceM: 650, durationS: 480 },
    },
    { ...stores[2], location: { lat: 37.5445, lng: 127.056 }, walkingRoute: null },
  ];
  mockApi.stores.mockResolvedValue(ranked.map(({ walkingRoute, ...store }) => store));
  mockApi.searchPlaces.mockResolvedValue({
    places: ranked,
    status: 'results',
    generalSearch: 'available',
  });
  await render(<Discovery />);
  await fireEvent.press(screen.getByLabelText('내 주변에서 찾기'));
  await screen.findByText('도보 650 m · 약 8분');
  expect(screen.getByText('도보 1.2 km · 약 16분')).toBeTruthy();
  expect(screen.getByText(/직선거리 · 도보 경로 확인 불가/)).toBeTruthy();
  expect(
    screen.getAllByLabelText(/매장 정보 보기$/).map((card) => card.props.accessibilityLabel),
  ).toEqual([
    '두 번째 카페 매장 정보 보기',
    '첫 번째 카페 매장 정보 보기',
    '정보 없는 카페 매장 정보 보기',
  ]);
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

test('web retries a denied location request directly without a permission preflight', async () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'web');
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const getCurrentPosition = jest
    .fn()
    .mockImplementationOnce((_success, failure) => failure({ code: 1 }))
    .mockImplementationOnce((success) => success({ coords: { latitude: 35.2, longitude: 126.8 } }));
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { geolocation: { getCurrentPosition } },
  });
  try {
    await render(<Discovery />);
    await fireEvent.press(screen.getByLabelText('내 주변에서 찾기'));
    await screen.findByText(
      '브라우저가 이 사이트의 위치 요청을 거부했어요. 사이트 설정에서 위치를 허용한 뒤 다시 시도해 주세요.',
    );
    expect(mockApi.searchPlaces).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('위치 다시 확인하기'));
    await waitFor(() =>
      expect(mockApi.searchPlaces).toHaveBeenCalledWith('', 'all', { lat: 35.2, lng: 126.8 }),
    );
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  } finally {
    platform.restore();
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
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
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  await fireEvent.changeText(screen.getByPlaceholderText('매장 또는 메뉴 검색'), '성수');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  await screen.findByText('장소를 불러오지 못했어요');
  expect(screen.queryByText('주문 연결 불가')).toBeNull();
  expect(screen.queryByText('0 개의 장소')).toBeNull();
  expect(screen.queryByText('서버 연결 설정')).toBeNull();
  await fireEvent.press(screen.getByText('장소 검색 다시 시도'));
  await waitFor(() => expect(screen.queryByText('장소를 불러오지 못했어요')).toBeNull());
});

test('home keeps four labelled destinations and search expands only when requested', async () => {
  await render(<Discovery />);
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  expect(screen.queryByTestId('store-map')).toBeNull();
  expect(screen.getByLabelText('매장 보기 방식')).toBeTruthy();
  expect(screen.getByRole('tab', { name: '홈' }).props.accessibilityState.selected).toBe(true);
  expect(screen.queryByLabelText('접근성 조건')).toBeNull();
  expect(screen.queryByPlaceholderText('매장 또는 메뉴 검색')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  expect(screen.getByPlaceholderText('매장 또는 메뉴 검색')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('검색 닫기'));
  expect(screen.queryByPlaceholderText('매장 또는 메뉴 검색')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: '주문내역' }));
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
  const details = screen.getByRole('button', { name: '두 번째 카페 매장 정보 보기' });
  expect(details.props.accessibilityHint).toContain('입구에 턱 있음');
  expect(details.props.accessibilityHint).toContain('장애인 화장실');
});

test('accessibility filters exclude false, null and unknown facts without changing the source', () => {
  expect(filterStores(stores, '', 'step-free').map((store) => store.storeId)).toEqual(['one']);
  expect(filterStores(stores, '', 'restroom').map((store) => store.storeId)).toEqual(['one']);
  expect(filterStores(stores, '  종로  ', 'all').map((store) => store.storeId)).toEqual(['two']);
  expect(filterStores(stores, '광주', 'step-free')).toEqual([]);
  expect(stores).toHaveLength(3);
});

test('text map opens a registered venue directly and switching views keeps the search', async () => {
  await render(<Discovery />);
  await screen.findByLabelText('첫 번째 카페 매장 정보 보기');
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  await fireEvent.changeText(screen.getByPlaceholderText('매장 또는 메뉴 검색'), '성수');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  expect(screen.queryByLabelText('두 번째 카페 매장 정보 보기')).toBeNull();
  expect(screen.getByDisplayValue('성수')).toBeTruthy();
  expect(screen.getByLabelText('첫 번째 카페 매장 정보 보기')).toBeTruthy();
  expect(screen.queryByLabelText('두 번째 카페 매장 정보 보기')).toBeNull();
  expect(screen.queryByTestId('store-map')).toBeNull();
  await fireEvent.press(screen.getByLabelText('검색 닫기'));
  await fireEvent.press(screen.getByLabelText('첫 번째 카페 매장 정보 보기'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/store', params: { storeId: 'one' } });
  await fireEvent.press(screen.getByRole('radio', { name: '그림 지도' }));
  expect(mockUpdateSettings).toHaveBeenCalledWith({ exploreMode: 'map' });
  expect(screen.getByTestId('store-map')).toBeTruthy();
  expect(screen.queryByText('매장 정보 · 메뉴')).toBeNull();
  expect(screen.getByLabelText('첫 번째 카페 지도 핀')).toBeTruthy();
  expect(screen.queryByLabelText('두 번째 카페 지도 핀')).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: '글 지도' }));
  expect(screen.queryByTestId('store-map')).toBeNull();
  expect(screen.queryByText('매장 정보 · 메뉴')).toBeNull();
});

test('map search and nearby stay on the visual map for the submitted query', async () => {
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
      station,
    ],
    status: 'results',
    generalSearch: 'available',
  });
  await render(<MapExplore />);
  expect(screen.getByRole('radio', { name: '그림 지도' }).props.accessibilityState.checked).toBe(
    true,
  );
  expect(screen.queryByLabelText('접근성 조건')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  await fireEvent.changeText(screen.getByPlaceholderText('매장 또는 메뉴 검색'), 'Nearby');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  await screen.findByLabelText('Nearby cafe 지도 핀');
  expect(screen.getByLabelText('성수역 지도 핀')).toBeTruthy();
  expect(screen.getByTestId('store-map')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('내 주변에서 찾기'));
  await waitFor(() =>
    expect(mockApi.searchPlaces).toHaveBeenLastCalledWith('', 'all', {
      lat: 37.5445,
      lng: 127.056,
    }),
  );
  expect(screen.getByTestId('store-map')).toBeTruthy();
  await screen.findByLabelText('Nearby cafe 지도 핀');
  expect(screen.queryByLabelText('성수역 지도 핀')).toBeNull();
  expect(screen.queryByText('가까운 장소')).toBeNull();
});

test('map search failures stay visible and recover without switching to a list', async () => {
  mockApi.searchPlaces.mockRejectedValueOnce(new TypeError('offline'));
  await render(<MapExplore />);
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  await fireEvent.changeText(screen.getByPlaceholderText('매장 또는 메뉴 검색'), 'Seoul');
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
  expect(screen.getByText('서울 종로')).toBeTruthy();
  expect(screen.queryByLabelText('장소 선택')).toBeNull();
  await fireEvent.press(screen.getByLabelText('닫기'));
  expect(screen.queryByText('서울 종로')).toBeNull();
  await fireEvent.press(screen.getByLabelText('두 번째 카페 지도 핀'));
  await fireEvent.press(screen.getByText('매장 정보 · 메뉴'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/store', params: { storeId: 'two' } });
  await fireEvent.press(screen.getByText('키오스크에 연결해 주문하기'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/connect', params: { storeId: 'two' } });
  await fireEvent.press(screen.getByText('길 안내'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/guide', params: { storeId: 'two' } });
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
    places: [station],
    status: 'results',
    generalSearch: 'not-configured',
  });
  await render(<Discovery />);
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  await fireEvent.changeText(screen.getByPlaceholderText('매장 또는 메뉴 검색'), '성수역');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  await screen.findByLabelText('성수역 매장 정보 보기');
  expect(mockApi.searchPlaces).toHaveBeenCalledWith('성수역', 'all', null);
  await fireEvent.press(screen.getByLabelText('성수역 매장 정보 보기'));
  expect(screen.getByText('주변 접근성 정보')).toBeTruthy();
  expect(screen.queryByText('매장 정보 · 메뉴')).toBeNull();
});

test('an older backend with an unconfigured directory still offers catalog search recovery', async () => {
  mockApi.searchPlaces.mockResolvedValueOnce({
    places: [],
    status: 'unavailable',
    generalSearch: 'not-configured',
  });
  await render(<Discovery />);
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  await fireEvent.changeText(screen.getByPlaceholderText('매장 또는 메뉴 검색'), 'Unknown venue');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  await screen.findByText('등록 매장과 공공 자료에서 찾은 결과예요.');
  expect(screen.getByText('검색 결과가 없어요')).toBeTruthy();
  await fireEvent.press(screen.getByText('검색어 수정'));
  expect(screen.getByDisplayValue('Unknown venue')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('검색 닫기'));
  await fireEvent.press(screen.getByText('전체 매장 보기'));
  await screen.findByLabelText('첫 번째 카페 매장 정보 보기');
});

test('a registered search result remains orderable and appears once during a provider failure', async () => {
  mockApi.searchPlaces.mockResolvedValueOnce({
    places: [stores[0]],
    status: 'results',
    generalSearch: 'unavailable',
  });
  await render(<Discovery />);
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  await fireEvent.changeText(screen.getByPlaceholderText('매장 또는 메뉴 검색'), '첫 번째');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  await screen.findByText(
    '일반 장소 검색에 연결하지 못했어요. 찾은 등록 매장과 공공 자료를 표시합니다.',
  );
  expect(screen.getAllByLabelText('첫 번째 카페 매장 정보 보기')).toHaveLength(1);
  expect(screen.getByText('키오스크에 연결해 주문하기')).toBeTruthy();
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
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  await fireEvent.changeText(screen.getByPlaceholderText('매장 또는 메뉴 검색'), 'old');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  await fireEvent.changeText(screen.getByPlaceholderText('매장 또는 메뉴 검색'), 'new');
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

test('deduplicates registered stores returned by both stores and place search', async () => {
  mockApi.searchPlaces.mockResolvedValueOnce({
    places: [stores[0]!],
    status: 'results',
    generalSearch: 'available',
  });
  await render(<Discovery />);
  await screen.findByLabelText('첫 번째 카페 매장 정보 보기');
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  await fireEvent.changeText(screen.getByPlaceholderText('매장 또는 메뉴 검색'), '첫 번째');
  await fireEvent.press(screen.getByLabelText('검색 실행'));
  await waitFor(() => expect(mockApi.searchPlaces).toHaveBeenCalledWith('첫 번째', 'all', null));
  expect(screen.getAllByLabelText('첫 번째 카페 매장 정보 보기')).toHaveLength(1);
});

test('store suggestions remain available and menu suggestions stay hidden before pairing', async () => {
  mockApi.stores.mockResolvedValue([
    { ...stores[0], menuSuggestions: [{ name: '라떼' }] },
    stores[1],
  ]);
  await render(<Discovery />);
  await fireEvent.press(screen.getByRole('button', { name: '매장 또는 메뉴 검색' }));
  await screen.findByLabelText('첫 번째 카페, 매장');
  expect(screen.queryByLabelText('라떼, 메뉴')).toBeNull();
  expect(screen.getByLabelText('두 번째 카페 매장 정보 보기')).toBeTruthy();
  expect(mockApi.searchPlaces).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('첫 번째 카페, 매장'));
  await screen.findByText('장소 1곳을 찾았어요');
  expect(screen.getByText('“첫 번째 카페” 검색 결과')).toBeTruthy();
  expect(mockRememberSearch).toHaveBeenCalledWith('첫 번째 카페');
  expect(screen.queryByLabelText('두 번째 카페 매장 정보 보기')).toBeNull();
  await fireEvent.press(screen.getByText('전체 매장 보기'));
  await screen.findByLabelText('두 번째 카페 매장 정보 보기');
});
