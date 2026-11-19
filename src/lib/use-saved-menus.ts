import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

export type SavedMenuEntry = {
  storeId: string;
  storeName: string;
  itemId: string;
  itemName: string;
};

type SavedMenuState = { entries: SavedMenuEntry[]; ready: boolean; error: boolean };
const initial: SavedMenuState = { entries: [], ready: false, error: false };

function isEntry(value: unknown): value is SavedMenuEntry {
  if (typeof value !== 'object' || !value) return false;
  const entry = value as Partial<SavedMenuEntry>;
  return [entry.storeId, entry.storeName, entry.itemId, entry.itemName].every(
    (field) => typeof field === 'string' && field.length > 0,
  );
}

function createSavedMenus(base: string) {
  const key = `saved-menus:${base}`;
  let state = initial;
  let queue: Promise<unknown> = Promise.resolve();
  let loading: Promise<void> | undefined;
  const listeners = new Set<() => void>();

  function update(next: SavedMenuState) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  function reload() {
    if (loading) return loading;
    loading = queue
      .catch(() => undefined)
      .then(async () => {
        try {
          const raw = await AsyncStorage.getItem(key);
          const entries: unknown = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(entries) || !entries.every(isEntry))
            throw new Error('Invalid saved menus');
          update({ entries, ready: true, error: false });
        } catch {
          update({ ...state, ready: false, error: true });
        } finally {
          loading = undefined;
        }
      });
    queue = loading;
    return loading;
  }

  function isSaved(storeId: string, itemId: string) {
    return state.entries.some((entry) => entry.storeId === storeId && entry.itemId === itemId);
  }

  function toggle(entry: SavedMenuEntry) {
    if (!state.ready && !loading) void reload();
    const task = queue
      .catch(() => undefined)
      .then(async () => {
        if (!state.ready) throw new Error('저장한 메뉴를 불러오지 못했어요');
        const entries = isSaved(entry.storeId, entry.itemId)
          ? state.entries.filter(
              (item) => item.storeId !== entry.storeId || item.itemId !== entry.itemId,
            )
          : [...state.entries, entry];
        await AsyncStorage.setItem(key, JSON.stringify(entries));
        update({ ...state, entries });
      });
    queue = task;
    return task;
  }

  return {
    snapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reload,
    isSaved,
    toggle,
  };
}

const stores = new Map<string, ReturnType<typeof createSavedMenus>>();

export function useSavedMenus(base: string) {
  let store = stores.get(base);
  if (!store) {
    store = createSavedMenus(base);
    stores.set(base, store);
  }
  const { snapshot, subscribe, reload, isSaved, toggle } = store;
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (!snapshot().ready && !snapshot().error) void reload();
  }, [snapshot, reload]);
  return { ...state, reload, isSaved, toggle };
}
