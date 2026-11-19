import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
// Credentials are scoped by API origin. Native uses Keychain/Keystore; web uses
// session storage so a shared kiosk browser does not retain a key after closing.
function key(base: string, name: string) {
  return `galjido.${Array.from(base)
    .map((char) => char.charCodeAt(0).toString(16).padStart(4, '0'))
    .join('')}.${name}`;
}
export const secrets = {
  async get(base: string, name: string): Promise<string | null> {
    const id = key(base, name);
    return Platform.OS === 'web'
      ? typeof sessionStorage === 'undefined'
        ? null
        : sessionStorage.getItem(id)
      : SecureStore.getItemAsync(id);
  },
  async set(base: string, name: string, value: string | null) {
    const id = key(base, name);
    if (Platform.OS === 'web') {
      if (typeof sessionStorage !== 'undefined')
        value === null ? sessionStorage.removeItem(id) : sessionStorage.setItem(id, value);
    } else if (value === null) await SecureStore.deleteItemAsync(id);
    else await SecureStore.setItemAsync(id, value);
  },
};
