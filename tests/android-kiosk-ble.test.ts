import { PermissionsAndroid, Platform } from 'react-native';
import { scanAndroidAdvertisements } from '@/lib/android-kiosk-ble';

const mockNative = { scan: jest.fn(), cancelScan: jest.fn() };

jest.mock('expo', () => ({
  requireOptionalNativeModule: () => ({
    scan: (id: number) => mockNative.scan(id),
    cancelScan: (id: number) => mockNative.cancelScan(id),
  }),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 35 },
  PermissionsAndroid: {
    PERMISSIONS: {
      BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    },
    RESULTS: { GRANTED: 'granted' },
    request: jest.fn(),
  },
}));

const requestPermission = jest.mocked(PermissionsAndroid.request);

beforeEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
  requestPermission.mockResolvedValue('granted');
  mockNative.cancelScan.mockResolvedValue(undefined);
});

test.each([
  [35, 'android.permission.BLUETOOTH_SCAN'],
  [30, 'android.permission.ACCESS_FINE_LOCATION'],
])(
  'Android API %i requests %s and returns the native scan results',
  async (version, permission) => {
    jest.replaceProperty(Platform, 'Version', version);
    mockNative.scan.mockResolvedValue({ status: 'complete', advertisements: ['LKGK017H3KQ9ZC'] });
    await expect(scanAndroidAdvertisements(new AbortController().signal)).resolves.toEqual([
      'LKGK017H3KQ9ZC',
    ]);
    expect(requestPermission).toHaveBeenCalledWith(permission);
  },
);

test('permission denial never starts the scanner', async () => {
  requestPermission.mockResolvedValue('denied');
  await expect(scanAndroidAdvertisements(new AbortController().signal)).rejects.toThrow(
    '검색 권한',
  );
  expect(mockNative.scan).not.toHaveBeenCalled();
});

test.each([
  ['bluetooth-off', 'Bluetooth를 켜고'],
  ['location-off', '위치 서비스를 켜야'],
  ['scan-failed', 'Bluetooth 검색에 실패'],
])('shows a recoverable message for %s', async (status, message) => {
  mockNative.scan.mockResolvedValue({ status });
  await expect(scanAndroidAdvertisements(new AbortController().signal)).rejects.toThrow(message);
});

test('aborting a native scan cancels the matching scan and drops late results', async () => {
  const controller = new AbortController();
  let completeScan!: (result: object) => void;
  mockNative.scan.mockImplementation(() => new Promise((resolve) => (completeScan = resolve)));
  const result = scanAndroidAdvertisements(controller.signal);
  await Promise.resolve();
  const id = mockNative.scan.mock.calls[0]?.[0];
  expect(id).toEqual(expect.any(Number));

  controller.abort();
  completeScan({ status: 'complete', advertisements: ['LKGK017H3KQ9ZC'] });
  expect(mockNative.cancelScan).toHaveBeenCalledWith(id);
  await expect(result).resolves.toBeNull();
});
