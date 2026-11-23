import { requireOptionalNativeModule } from 'expo';
import { PermissionsAndroid, Platform } from 'react-native';

type ScanFailure =
  | 'unavailable'
  | 'permission-denied'
  | 'bluetooth-off'
  | 'location-off'
  | 'scan-failed';

type NativeScanResult =
  | { status: 'complete'; advertisements: string[] }
  | { status: ScanFailure | 'cancelled' };

type NativeScanner = {
  scan(id: number): Promise<NativeScanResult>;
  cancelScan(id: number): Promise<void>;
};

const scanner =
  Platform.OS === 'android' ? requireOptionalNativeModule<NativeScanner>('GaljidoKioskBle') : null;
export const androidKioskScanAvailable = scanner !== null;

const messages: Record<ScanFailure, string> = {
  unavailable: '이 기기에서는 Bluetooth 검색을 사용할 수 없어요. 연결 코드를 입력해 주세요.',
  'permission-denied': '검색 권한을 허용하거나 매장 화면의 연결 코드를 입력해 주세요.',
  'bluetooth-off': 'Bluetooth를 켜고 다시 검색하거나 연결 코드를 입력해 주세요.',
  'location-off': '이 Android 기기에서는 위치 서비스를 켜야 검색할 수 있어요.',
  'scan-failed': 'Bluetooth 검색에 실패했어요. 다시 검색하거나 연결 코드를 입력해 주세요.',
};

let nextScanId = 0;

export async function scanAndroidAdvertisements(signal: AbortSignal): Promise<string[] | null> {
  if (signal.aborted) return null;
  if (!scanner) throw new Error(messages.unavailable);

  const permission =
    Number(Platform.Version) >= 31
      ? PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
      : PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  let granted: boolean;
  try {
    granted = (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    throw new Error(messages['permission-denied']);
  }
  if (signal.aborted) return null;
  if (!granted) throw new Error(messages['permission-denied']);

  const id = ++nextScanId;
  function cancel() {
    void scanner?.cancelScan(id).catch(() => undefined);
  }
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const result = await scanner.scan(id).catch(() => {
      throw new Error(messages['scan-failed']);
    });
    if (signal.aborted || result.status === 'cancelled') return null;
    if (result.status === 'complete') return result.advertisements;
    throw new Error(messages[result.status]);
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}
