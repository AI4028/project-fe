import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider, useApp } from '@/providers/app-provider';
import { secrets } from '@/lib/storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/storage', () => ({ secrets: { get: jest.fn(), set: jest.fn() } }));
jest.mock('@/lib/live', () => ({ subscribe: () => () => {} }));
jest.mock('expo-speech', () => ({ stop: jest.fn(), speak: jest.fn() }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success' },
}));
const menu = [
  {
    id: 'coffee',
    name: '커피',
    description: '',
    category: '커피',
    available: true,
    price: 2500,
    options: [],
  },
];
const store = { storeId: 'cafe', name: '카페', address: '', accessibility: {}, menu };
const connection = { sessionId: 's1', kioskId: 'GK01', storeId: 'cafe' };
const cart = {
  lines: [{ itemId: 'coffee', name: '커피', qty: 1, options: [], lineTotal: 2500 }],
  total: 2500,
  summary: '커피 1개',
};
const placed = {
  ...connection,
  orderId: 'o1',
  orderNumber: 1,
  status: 'submitted',
  total: 2500,
  summary: '커피 1개',
  paymentMethod: 'counter',
  note: '',
};
let device: string | null;
let route: (path: string, method: string) => { data: unknown; status?: number };
let fetchMock: jest.Mock;
beforeEach(async () => {
  await AsyncStorage.clear();
  device = null;
  jest.mocked(secrets.get).mockImplementation(async () => device);
  jest.mocked(secrets.set).mockImplementation(async (_base, _name, value) => {
    device = value;
  });
  route = (path, method) => {
    if (path === '/devices') return { data: { token: 'dev_test', deviceId: 'd1' } };
    if (path === '/sessions' && method === 'POST') return { data: connection };
    if (path === '/stores/cafe') return { data: store };
    if (path === '/sessions/s1')
      return {
        data: { ...connection, status: 'active', cart: { lines: [], total: 0, summary: '' } },
      };
    if (path.endsWith('/cart')) return { data: cart };
    if (path.endsWith('/order') || path === '/orders/o1') return { data: placed };
    throw new Error(`Unexpected request: ${method} ${path}`);
  };
  fetchMock = jest.fn(async (url: string, init: RequestInit) => {
    const response = route(new URL(url).pathname, init.method ?? 'GET');
    return {
      ok: (response.status ?? 200) < 400,
      status: response.status ?? 200,
      json: async () => response.data,
    };
  });
  global.fetch = fetchMock;
});
async function mount() {
  const hook = await renderHook(() => useApp(), { wrapper: AppProvider });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
}
test('connects, uses authoritative cart totals, submits once, and clears the session', async () => {
  const { result } = await mount();
  await act(() => result.current.connect('GK01', 'ABCDEFGH'));
  expect(result.current.connection?.sessionId).toBe('s1');
  await act(() => result.current.updateCart([{ itemId: 'coffee', qty: 1, options: {} }]));
  expect(result.current.cart.total).toBe(2500);
  await act(() => result.current.submit('counter', ''));
  expect(result.current.order?.orderId).toBe('o1');
  expect(result.current.connection).toBeNull();
  expect(result.current.items).toEqual([]);
  expect(await AsyncStorage.getItem(`session:${result.current.api.base}`)).toBeNull();
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/order'))).toHaveLength(1);
});
test('does not invent an offline session when the kiosk is busy', async () => {
  const previous = route;
  route = (path, method) =>
    path === '/sessions'
      ? { data: { error: 'kiosk-busy', message: 'Busy' }, status: 409 }
      : previous(path, method);
  const { result } = await mount();
  await act(async () => {
    await expect(result.current.connect('GK01', 'ABCDEFGH')).rejects.toMatchObject({
      code: 'kiosk-busy',
    });
  });
  expect(result.current.connection).toBeNull();
  expect(result.current.busy).toBe(false);
});
test('keeps the confirmed cart when a cart update fails', async () => {
  const { result } = await mount();
  await act(() => result.current.connect('GK01', 'ABCDEFGH'));
  await act(() => result.current.updateCart([{ itemId: 'coffee', qty: 1, options: {} }]));
  const previous = route;
  route = (path, method) =>
    path.endsWith('/cart')
      ? { data: { error: 'item-unavailable', message: 'Sold out' }, status: 409 }
      : previous(path, method);
  await act(async () => {
    await expect(result.current.updateCart([])).rejects.toMatchObject({ code: 'item-unavailable' });
  });
  expect(result.current.items).toHaveLength(1);
  expect(result.current.cart.total).toBe(2500);
});
test('recovers an already-submitted order from the persisted session after a reload', async () => {
  device = 'dev_test';
  await AsyncStorage.setItem('session:http://127.0.0.1:8000', 's1');
  const previous = route;
  route = (path, method) =>
    path === '/sessions/s1'
      ? { data: { ...connection, status: 'ordered', orderId: 'o1' } }
      : previous(path, method);
  const { result } = await mount();
  await waitFor(() => expect(result.current.order?.orderId).toBe('o1'));
  expect(result.current.connection).toBeNull();
});

test('clears an expired session so the customer can reconnect', async () => {
  const { result } = await mount();
  await act(() => result.current.connect('GK01', 'ABCDEFGH'));
  const previous = route;
  route = (path, method) =>
    path.endsWith('/cart')
      ? { data: { error: 'session-expired', message: 'Expired' }, status: 409 }
      : previous(path, method);
  await act(async () => {
    await expect(
      result.current.updateCart([{ itemId: 'coffee', qty: 1, options: {} }]),
    ).rejects.toMatchObject({ code: 'session-expired' });
  });
  expect(result.current.connection).toBeNull();
  expect(result.current.items).toEqual([]);
});
