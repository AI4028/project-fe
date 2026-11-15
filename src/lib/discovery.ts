import type { Store } from './types';

export type AccessFilter = 'all' | 'step-free' | 'restroom';

export function filterStores(stores: Store[], query: string, access: AccessFilter) {
  const normalized = query.trim().toLocaleLowerCase();
  return stores.filter(
    (store) =>
      `${store.name} ${store.address}`.toLocaleLowerCase().includes(normalized) &&
      (access !== 'step-free' || store.accessibility.stepFreeEntrance === true) &&
      (access !== 'restroom' || store.accessibility.accessibleRestroom === true),
  );
}
