import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
// Credentials are scoped by API origin. Native uses Keychain/Keystore; on web,
// kiosk keys stay in sessionStorage so a shared kiosk browser does not retain
// them after closing, while anonymous customer device tokens persist across tabs.
function key(base: string, name: string) {
  return `galjido.${Array.from(base)
    .map((char) => char.charCodeAt(0).toString(16).padStart(4, '0'))
    .join('')}.${name}`;
}
function webStore(name: string): Storage | null {
  if (name === 'kiosk') return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return typeof sessionStorage === 'undefined' ? null : sessionStorage;
}
export const secrets = {
  async get(base: string, name: string): Promise<string | null> {
    const id = key(base, name);
    if (Platform.OS !== 'web') return SecureStore.getItemAsync(id);
    const store = webStore(name);
    const saved = store?.getItem(id) ?? null;
    if (saved || name === 'kiosk' || typeof sessionStorage === 'undefined') return saved;
    const legacy = sessionStorage.getItem(id);
    if (legacy && store && store !== sessionStorage) {
      store.setItem(id, legacy);
      sessionStorage.removeItem(id);
    }
    return legacy;
  },
  async set(base: string, name: string, value: string | null) {
    const id = key(base, name);
    if (Platform.OS === 'web') {
      const store = webStore(name);
      if (store) value === null ? store.removeItem(id) : store.setItem(id, value);
      if (value === null && name !== 'kiosk' && typeof sessionStorage !== 'undefined')
        sessionStorage.removeItem(id);
    } else if (value === null) await SecureStore.deleteItemAsync(id);
    else await SecureStore.setItemAsync(id, value);
  },
};
