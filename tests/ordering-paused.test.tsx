import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Api, ApiError, errorMessage } from '@/lib/api';
import Connect from '@/app/connect';
import StoreDetails from '@/app/store';
import { MenuScreen } from '@/components/menu-screen';
import { router } from 'expo-router';

let mockParams: { next?: string; storeId?: string; kioskId?: string; token?: string };
let mockAndroidScanAvailable = false;
const mockScanAndroid = jest.fn();
const mockLink = jest.fn();
jest.mock('@/lib/android-kiosk-ble', () => ({
  get androidKioskScanAvailable() {
    return mockAndroidScanAvailable;
  },
  scanAndroidAdvertisements: (signal: AbortSignal) => mockScanAndroid(signal),
}));

jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));
jest.mock('@/components/place-actions', () => ({ PlaceBookmark: () => null }));
jest.mock('@/components/item-options-sheet', () => ({ ItemOptionsSheet: () => null }));
jest.mock('@/lib/use-saved-menus', () => ({ useSavedMenus: () => ({ ready: false }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('@/components/screen', () => {
  const { Text, View } = require('react-native');
  return {
    Screen: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
      <View>
        {children}
        {footer}
      </View>
    ),
    NavLink: ({ children, href }: { children: React.ReactNode; href: unknown }) => {
      mockLink(children, href);
      return <Text>{children}</Text>;
    },
  };
});
jest.mock('@/components/feedback', () => {
  const { Text } = require('react-native');
  return {
    OrderingPaused: () => <Text>지금은 주문을 받지 않고 있어요</Text>,
    Problem: ({ message }: { message: string }) => <Text>{message}</Text>,
    SubmissionRecovery: () => null,
  };
});

const store = { storeId: 'gist-cafe', name: 'GIST 카페', address: '광주', accessibility: {} };
const mockApp = {
  busy: false,
  demo: false,
  connection: null,
  items: [],
  selectStore: jest.fn(),
  pendingSubmission: null,
  api: {
    kioskInfo: jest.fn(),
    store: jest.fn(),
    demoToken: jest.fn(),
  },
  connect: jest.fn(),
};
jest.mock('@/providers/app-provider', () => ({ useApp: () => mockApp }));

async function checkStore() {
  await render(<Connect />);
  await fireEvent.changeText(screen.getByLabelText('매장 기기 코드'), 'GK01');
  await fireEvent.changeText(screen.getByLabelText('연결 코드'), 'ABCDEFGH');
  await fireEvent.press(screen.getByText('연결할 매장 확인하기'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockApp.demo = false;
  mockAndroidScanAvailable = false;
  mockApp.connect.mockResolvedValue(undefined);
  mockApp.api.kioskInfo.mockResolvedValue({
    kioskId: 'GK01',
    storeId: 'gist-cafe',
    name: '키오스크 1',
  });
});

test.each([
  [undefined, '/menu'],
  ['help', { pathname: '/help', params: { storeId: 'gist-cafe' } }],
] as const)('pairing from %s opens the requested screen', async (next, destination) => {
  mockParams = { next, storeId: store.storeId };
  mockApp.api.store.mockResolvedValue(store);
  await checkStore();
  await fireEvent.press(screen.getByText('이 매장이 맞아요 · 연결하기'));
  expect(router.replace).toHaveBeenCalledWith(destination);
});

test('a kiosk QR link fills the pairing fields and still asks for confirmation', async () => {
  mockParams = { kioskId: 'GK01', token: 'ABCDEFGH' };
  mockApp.api.store.mockResolvedValue(store);
  await render(<Connect />);
  expect(screen.getByDisplayValue('GK01')).toBeTruthy();
  expect(screen.getByDisplayValue('ABCDEFGH')).toBeTruthy();
  await fireEvent.press(screen.getByText('연결할 매장 확인하기'));
  expect(mockApp.connect).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('이 매장이 맞아요 · 연결하기'));
  expect(mockApp.connect).toHaveBeenCalledWith('GK01', 'ABCDEFGH', store.storeId);
});

test('staff pause call and the Korean message', async () => {
  const transport = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ storeId: 'gist-cafe', orderingPaused: true }),
  });
  await new Api('https://example.test', transport).ordering(true, 'ksk_test');
  expect(transport).toHaveBeenCalledWith(
    'https://example.test/kiosk/ordering',
    expect.objectContaining({ method: 'PUT', body: JSON.stringify({ paused: true }) }),
  );
  expect(errorMessage(new ApiError('ordering-paused', 409, 'paused'))).toContain(
    '휴대폰 주문을 받지 않아요',
  );
});

test('a paused store shows the notice instead of the connect button', async () => {
  mockApp.api.store.mockResolvedValue({ ...store, orderingPaused: true });
  await checkStore();
  expect(screen.getByText('지금은 주문을 받지 않고 있어요')).toBeTruthy();
  expect(screen.queryByText('이 매장이 맞아요 · 연결하기')).toBeNull();
});

test('a pause that happens after checking the store also shows the notice', async () => {
  mockApp.api.store.mockResolvedValue({ ...store, orderingPaused: false });
  mockApp.connect.mockRejectedValue(new ApiError('ordering-paused', 409, 'paused'));
  await checkStore();
  await fireEvent.press(screen.getByText('이 매장이 맞아요 · 연결하기'));
  expect(screen.getByText('지금은 주문을 받지 않고 있어요')).toBeTruthy();
  expect(screen.queryByText('이 매장이 맞아요 · 연결하기')).toBeNull();
});

function enableDemoScan(expiresAtMs = Date.now() + 60_000) {
  const otherStore = { ...store, storeId: 'ongi', name: '온기 카페', address: '서울' };
  mockApp.demo = true;
  mockApp.api.kioskInfo.mockImplementation(async (kioskId: string) => {
    if (kioskId === 'GK01') return { kioskId, storeId: store.storeId, name: '기기 A' };
    if (kioskId === 'OR01') return { kioskId, storeId: otherStore.storeId, name: '기기 B' };
    throw new ApiError('kiosk-not-found', 404, 'Kiosk not found.');
  });
  mockApp.api.store.mockImplementation(async (storeId: string) =>
    storeId === store.storeId ? store : otherStore,
  );
  mockApp.api.demoToken.mockImplementation(async (kioskId: string) => ({
    kioskId,
    token: kioskId === 'GK01' ? 'ABCDEFGH' : '23456789',
    expiresAtMs,
  }));
}

test('simulated scans list provisioned kiosks and pair only after confirmation', async () => {
  enableDemoScan();
  await render(<Connect />);
  await fireEvent.press(screen.getByText('주변 데모 기기 검색'));
  expect(screen.getByLabelText('GIST 카페, 기기 A, GK01, 광주')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('온기 카페, 기기 B, OR01, 서울'));
  expect(screen.getByText('온기 카페')).toBeTruthy();
  expect(mockApp.connect).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByText('이 매장이 맞아요 · 연결하기'));
  expect(mockApp.connect).toHaveBeenCalledWith('OR01', '23456789', 'ongi');
  expect(router.replace).toHaveBeenCalledWith('/menu');
});

test('a simulated scan opened from a store only lists kiosks for that store', async () => {
  enableDemoScan();
  mockParams = { storeId: store.storeId };
  await render(<Connect />);
  await fireEvent.press(screen.getByText('주변 데모 기기 검색'));
  expect(screen.getByText('GIST 카페')).toBeTruthy();
  expect(screen.queryByText('온기 카페')).toBeNull();
  expect(mockApp.api.demoToken.mock.calls).toEqual([['GK01']]);
});

test('an expired scan can be repeated without dropping the manual inputs', async () => {
  enableDemoScan();
  mockApp.connect.mockRejectedValueOnce(new ApiError('token-invalid', 409, 'Expired.'));
  await render(<Connect />);
  await fireEvent.changeText(screen.getByLabelText('매장 기기 코드'), 'GK01');
  await fireEvent.press(screen.getByText('주변 데모 기기 검색'));
  await fireEvent.press(screen.getByText('온기 카페'));
  await fireEvent.press(screen.getByText('이 매장이 맞아요 · 연결하기'));

  expect(
    screen.getByText('연결 코드가 만료되었어요. 데모 기기를 다시 검색해 주세요.'),
  ).toBeTruthy();
  expect(screen.getByDisplayValue('GK01')).toBeTruthy();
  expect(screen.queryByText('온기 카페')).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('주변 데모 기기 검색'));
  expect(screen.getByText('온기 카페')).toBeTruthy();
});

test('a scan with only expired advertisements leaves code entry available', async () => {
  enableDemoScan(Date.now() - 1);
  await render(<Connect />);
  await fireEvent.press(screen.getByText('주변 데모 기기 검색'));
  expect(
    screen.getByText('데모 기기를 찾지 못했어요. 다시 검색하거나 코드를 입력해 주세요.'),
  ).toBeTruthy();
  expect(screen.getByLabelText('연결 코드')).toBeTruthy();
});

test('the simulated scan is hidden with demo mode off', async () => {
  await render(<Connect />);
  expect(screen.queryByText('주변 데모 기기 검색')).toBeNull();
  expect(screen.getByLabelText('연결 코드')).toBeTruthy();
  expect(mockApp.api.demoToken).not.toHaveBeenCalled();
});

test('Android scan events use the latest token and the normal confirmation flow', async () => {
  enableDemoScan();
  mockApp.demo = false;
  mockAndroidScanAvailable = true;
  mockScanAndroid.mockResolvedValue([
    'Headphones',
    'LKMB01ABCDEFGH', // Well formed, but not provisioned.
    'LKOR0123456789',
    'LKGK017H3KQ9ZC',
    'LKGK01ABCDEFGH',
    'LKGK01ABCDUFGH', // A malformed packet cannot replace the valid token.
  ]);
  await render(<Connect />);
  await fireEvent.press(screen.getByText('주변 키오스크 검색'));
  expect(screen.getAllByLabelText('GIST 카페, 기기 A, GK01, 광주')).toHaveLength(1);
  expect(screen.getByLabelText('온기 카페, 기기 B, OR01, 서울')).toBeTruthy();
  expect(mockApp.api.demoToken).not.toHaveBeenCalled();
  expect(mockApp.api.kioskInfo.mock.calls.filter(([id]) => id === 'GK01')).toHaveLength(1);
  await fireEvent.press(screen.getByLabelText('GIST 카페, 기기 A, GK01, 광주'));
  expect(mockApp.connect).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByText('이 매장이 맞아요 · 연결하기'));
  expect(mockApp.connect).toHaveBeenCalledWith('GK01', 'ABCDEFGH', 'gist-cafe');
  expect(router.replace).toHaveBeenCalledWith('/menu');
});

test('store details open a store-scoped kiosk scan and unrelated stores are excluded', async () => {
  enableDemoScan();
  mockApp.demo = false;
  mockAndroidScanAvailable = true;
  mockParams = { storeId: store.storeId };
  const details = await render(<StoreDetails />);
  await screen.findByText('키오스크에 연결해 주문하기');
  expect(mockLink).toHaveBeenCalledWith('키오스크에 연결해 주문하기', {
    pathname: '/connect',
    params: { storeId: store.storeId },
  });
  await details.unmount();

  mockScanAndroid.mockResolvedValue(['LKOR0123456789', 'LKGK017H3KQ9ZC']);
  await render(<Connect />);
  await fireEvent.press(screen.getByText('주변 키오스크 검색'));
  expect(screen.getByText('GIST 카페')).toBeTruthy();
  expect(screen.queryByText('온기 카페')).toBeNull();
  expect(mockApp.api.store).not.toHaveBeenCalledWith('ongi');
});

test('a direct menu or item link requires pairing before loading the menu', async () => {
  await render(<MenuScreen storeId={store.storeId} initialItemId="americano" />);
  expect(mockApp.selectStore).not.toHaveBeenCalled();
  expect(mockLink).toHaveBeenCalledWith('키오스크 연결', {
    pathname: '/connect',
    params: { storeId: store.storeId, itemId: 'americano' },
  });
});

test('an expired Android advertisement prompts a new scan after the server rejects it', async () => {
  enableDemoScan();
  mockApp.demo = false;
  mockAndroidScanAvailable = true;
  mockScanAndroid.mockResolvedValue(['LKOR0123456789']);
  mockApp.connect.mockRejectedValueOnce(new ApiError('token-invalid', 409, 'Expired.'));
  await render(<Connect />);
  await fireEvent.press(screen.getByText('주변 키오스크 검색'));
  await fireEvent.press(screen.getByText('온기 카페'));
  await fireEvent.press(screen.getByText('이 매장이 맞아요 · 연결하기'));

  expect(
    screen.getByText('연결 코드가 만료되었어요. 주변 키오스크를 다시 검색해 주세요.'),
  ).toBeTruthy();
  expect(screen.getByLabelText('연결 코드')).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
});

test('an Android scan timeout with no advertisements leaves manual pairing available', async () => {
  mockAndroidScanAvailable = true;
  mockScanAndroid.mockResolvedValue([]);
  await render(<Connect />);
  await fireEvent.press(screen.getByText('주변 키오스크 검색'));
  expect(
    screen.getByText('주변 키오스크를 찾지 못했어요. 다시 검색하거나 코드를 입력해 주세요.'),
  ).toBeTruthy();
  expect(screen.getByLabelText('연결 코드')).toBeTruthy();
  expect(mockApp.api.kioskInfo).not.toHaveBeenCalled();
});

test('leaving Connect cancels discovery and ignores late scan results', async () => {
  mockAndroidScanAvailable = true;
  let onResults!: (advertisements: string[]) => void;
  mockScanAndroid.mockImplementation(() => new Promise((resolve) => (onResults = resolve)));
  const view = await render(<Connect />);
  await fireEvent.press(screen.getByText('주변 키오스크 검색'));
  const signal: AbortSignal = mockScanAndroid.mock.calls[0]?.[0];
  expect(signal.aborted).toBe(false);

  await view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => onResults(['LKGK017H3KQ9ZC']));
  expect(mockApp.api.kioskInfo).not.toHaveBeenCalled();
});
