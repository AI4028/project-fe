import type { Store } from './types';
export type Position = { lat: number; lng: number };
export const assistanceLabels = {
  visual: '시각장애',
  physical: '지체장애',
  wheelchair: '휠체어 사용자',
} as const;
export type Assistance = keyof typeof assistanceLabels;
export function isAssistance(value: unknown): value is Assistance {
  return typeof value === 'string' && Object.hasOwn(assistanceLabels, value);
}
export function exploreRoute(value: unknown) {
  if (!isAssistance(value)) return '/onboarding' as const;
  return value === 'visual' ? ('/explore/list' as const) : ('/explore/map' as const);
}
export function assistanceSummary(store: Store, mode?: Assistance) {
  const a = store.accessibility;
  if (mode === 'visual') return knownText(store.indoorDirections);
  if (mode === 'wheelchair')
    return `${a.stepFreeEntrance === true ? '턱 없는 입구' : a.stepFreeEntrance === false ? '입구에 턱 있음' : '입구 정보 확인 필요'} · 경사로와 출입문 너비 확인 필요`;
  return `${a.floor != null ? `${a.floor}층` : '층 정보 확인 필요'} · ${a.elevator === true ? '엘리베이터 있음' : a.elevator === false ? '엘리베이터 없음' : '엘리베이터 확인 필요'}`;
}
export function assistanceFromSpeech(text: string): Assistance | null {
  const value = text.replace(/\s/g, '');
  if (/휠체어|휠/.test(value)) return 'wheelchair';
  if (/시각|시력|눈|안보|보이지|앞이/.test(value)) return 'visual';
  if (/지체|다리|걷|거동|목발|팔|몸/.test(value)) return 'physical';
  return null;
}
export function distanceM(a: Position, b: Position) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function nearbyStores(stores: Store[], position: Position) {
  return stores
    .filter((store) => store.location)
    .map((store) => {
      const distance = distanceM(position, store.location!);
      return {
        ...store,
        distanceM: Math.round(distance),
        insideGeofence: store.geofenceRadiusM != null && distance <= store.geofenceRadiusM,
      };
    })
    .filter((store) => store.distanceM <= 3000)
    .sort((a, b) => a.distanceM - b.distanceM);
}
export function accessibilitySummary(store: Store) {
  const a = store.accessibility;
  return [
    a.floor != null ? `${a.floor}층` : '',
    a.stepFreeEntrance === true
      ? '턱 없는 입구'
      : a.stepFreeEntrance === false
        ? '입구에 턱 있음'
        : '입구 정보 확인 필요',
    a.automaticDoor === true ? '자동문' : '',
    a.elevator === true ? '엘리베이터' : '',
    a.accessibleRestroom === true ? '장애인 화장실' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
export const knownText = (value?: string) =>
  value && !/^TODO/i.test(value.trim()) ? value : '확인 필요';
