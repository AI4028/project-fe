import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { BEACON_PREFIX, parseBeaconName, smoothRssi } from './ble-direction';

// Web Bluetooth Scanning API (Chrome on Android, behind
// chrome://flags/#enable-experimental-web-platform-features). Test-only path:
// the installable app will use a native BLE library with the same logic.

type Advertisement = Event & { rssi?: number; name?: string; device?: { name?: string } };
type LEScan = { stop: () => void; active?: boolean };
type ScanningBluetooth = EventTarget & {
  requestLEScan?: (options: {
    filters?: { namePrefix?: string }[];
    keepRepeatedDevices?: boolean;
    acceptAllAdvertisements?: boolean;
  }) => Promise<LEScan>;
};

export type BeaconReading = {
  kioskId: string;
  token: string;
  /** Median of recent readings, dBm. */
  rssi: number;
  lastSeenAt: number;
};

export type ScanState = 'idle' | 'scanning' | 'unsupported' | 'denied' | 'failed';

function bluetooth(): ScanningBluetooth | undefined {
  if (Platform.OS !== 'web') return undefined;
  return (globalThis.navigator as unknown as { bluetooth?: ScanningBluetooth } | undefined)
    ?.bluetooth;
}

export function bleScanSupported() {
  return typeof bluetooth()?.requestLEScan === 'function';
}

/** Listens for the kiosk beacon; `onReading` gets every raw RSSI (for the turn). */
export function useBleScan(onReading?: (rssi: number) => void) {
  const [state, setState] = useState<ScanState>(bleScanSupported() ? 'idle' : 'unsupported');
  const [beacon, setBeacon] = useState<BeaconReading | null>(null);
  const samples = useRef<number[]>([]);
  const scan = useRef<LEScan | null>(null);
  const listener = useRef<((event: Event) => void) | null>(null);
  const readingCallback = useRef(onReading);
  readingCallback.current = onReading;

  const stop = useCallback(() => {
    const bt = bluetooth();
    if (listener.current) bt?.removeEventListener('advertisementreceived', listener.current);
    listener.current = null;
    try {
      scan.current?.stop();
    } catch {
      // Already stopped.
    }
    scan.current = null;
    setState((current) => (current === 'scanning' ? 'idle' : current));
  }, []);

  /** Must run inside a tap. */
  const start = useCallback(async () => {
    const bt = bluetooth();
    if (!bt?.requestLEScan) {
      setState('unsupported');
      return;
    }
    stop();
    const onAdvertisement = (event: Event) => {
      const ad = event as Advertisement;
      const parsed = parseBeaconName(ad.name ?? ad.device?.name);
      if (!parsed || typeof ad.rssi !== 'number') return;
      samples.current = [...samples.current.slice(-19), ad.rssi];
      readingCallback.current?.(ad.rssi);
      setBeacon({
        ...parsed,
        rssi: smoothRssi(samples.current) ?? ad.rssi,
        lastSeenAt: Date.now(),
      });
    };
    try {
      scan.current = await bt.requestLEScan({
        filters: [{ namePrefix: BEACON_PREFIX }],
        keepRepeatedDevices: true,
      });
      listener.current = onAdvertisement;
      bt.addEventListener('advertisementreceived', onAdvertisement);
      setState('scanning');
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed');
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { state, beacon, start, stop };
}
