import type { Store } from './types';
export function directionsUrl(store: Store) {
  const destination = store.location
    ? `${store.location.lat},${store.location.lng}`
    : `${store.name} ${store.address}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=walking`;
}
export function placeSearchUrl(query: string) {
  return `https://map.kakao.com/?q=${encodeURIComponent(query.trim() || '카페')}`;
}
export function directoryPlaces(value: unknown): Store[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 15).flatMap((item) => {
    if (!item || typeof item.id !== 'string' || typeof item.place_name !== 'string') return [];
    const lat = Number(item.y),
      lng = Number(item.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      return [];
    return [
      {
        storeId: `place:${item.id}`,
        name: item.place_name,
        address:
          (typeof item.road_address_name === 'string' && item.road_address_name) ||
          (typeof item.address_name === 'string' ? item.address_name : ''),
        location: { lat, lng },
        accessibility: {},
        directoryOnly: true,
      },
    ];
  });
}
