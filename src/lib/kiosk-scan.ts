import { ApiError, type Api } from './api';
import type { Store } from './types';

const demoKioskIds = ['GK01', 'OR01', 'MB01', 'CB01'];

export type KioskCandidate = { kioskId: string; name: string; store: Store };
export type ScannedKiosk = KioskCandidate & { token: string; expiresAtMs?: number };

export function parseKioskAdvertisement(payload: string) {
  if (payload.length !== 14 || !/^LK[A-Z0-9]{4}[0-9A-HJKMNP-TV-Z]{8}$/.test(payload)) return null;
  return { kioskId: payload.slice(2, 6), token: payload.slice(6) };
}

export async function inspectKiosk(api: Pick<Api, 'kioskInfo' | 'store'>, kioskId: string) {
  const kiosk = await api.kioskInfo(kioskId);
  const store = await api.store(kiosk.storeId);
  return { kioskId, name: kiosk.name, store };
}

export async function resolveKioskAdvertisements(
  api: Pick<Api, 'kioskInfo' | 'store'>,
  advertisements: string[],
  storeId?: string,
): Promise<ScannedKiosk[]> {
  const latest = new Map<string, string>();
  for (const payload of advertisements) {
    const parsed = parseKioskAdvertisement(payload);
    if (parsed) latest.set(parsed.kioskId, parsed.token);
  }
  const results = await Promise.all(
    Array.from(latest, async ([kioskId, token]) => {
      try {
        const kiosk = await api.kioskInfo(kioskId);
        if (storeId && kiosk.storeId !== storeId) return null;
        return { kioskId, name: kiosk.name, store: await api.store(kiosk.storeId), token };
      } catch (error) {
        if (error instanceof ApiError && error.code === 'kiosk-not-found') return null;
        throw error;
      }
    }),
  );
  return results.filter((result) => result !== null);
}

export async function scanDemoKiosks(
  api: Pick<Api, 'demoToken' | 'kioskInfo' | 'store'>,
  storeId?: string,
): Promise<ScannedKiosk[]> {
  const results = await Promise.all(
    demoKioskIds.map(async (id) => {
      try {
        const candidate = await inspectKiosk(api, id);
        if (storeId && candidate.store.storeId !== storeId) return null;
        const { kioskId, token, expiresAtMs } = await api.demoToken(id);
        const advertisement = parseKioskAdvertisement(`LK${kioskId}${token}`);
        if (advertisement?.kioskId !== id || !(expiresAtMs > Date.now())) return null;
        return { ...candidate, token: advertisement.token, expiresAtMs };
      } catch (error) {
        if (error instanceof ApiError && error.code === 'kiosk-not-found') return null;
        throw error;
      }
    }),
  );
  return results.filter((result) => result !== null);
}
