import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider, useApp } from '@/providers/app-provider';
import { secrets } from '@/lib/storage';
import * as Haptics from 'expo-haptics';

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
  quoteId: 'quote-1',
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
    if (path === '/kiosks/GK01')
      return { data: { kioskId: 'GK01', storeId: 'cafe', name: '카페' } };
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
  await waitFor(() => {
    expect(hook.result.current.ready).toBe(true);
    expect(hook.result.current.busy).toBe(false);
  });
  return hook;
}

test('saved places persist across mounts without storing menu snapshots', async () => {
  const first = await mount();
  await act(() => first.result.current.toggleSaved(store));
  expect(first.result.current.savedPlaces[0]?.storeId).toBe('cafe');
  expect(first.result.current.savedPlaces[0]?.menu).toBeUndefined();
  await first.unmount();
  const second = await mount();
  await waitFor(() => expect(second.result.current.savedPlaces[0]?.storeId).toBe('cafe'));
  await act(() => second.result.current.toggleSaved(store));
  expect(second.result.current.savedPlaces).toEqual([]);
});

test('saved places are isolated by API origin', async () => {
  const hook = await mount();
  await act(() => hook.result.current.toggleSaved(store));
  await act(() =>
    hook.result.current.saveSettings({
      ...hook.result.current.settings,
      apiBase: 'http://other.example:8000',
    }),
  );
  await waitFor(() => expect(hook.result.current.savedPlaces).toEqual([]));
});

test('persists language and restores it without resetting other preferences', async () => {
  const first = await mount();
  await act(() =>
    first.result.current.saveSettings({
      ...first.result.current.settings,
      language: 'en',
      contrast: true,
    }),
  );
  expect(JSON.parse((await AsyncStorage.getItem('galjido.settings'))!).language).toBe('en');
  await first.unmount();
  const second = await mount();
  expect(second.result.current.settings.language).toBe('en');
  expect(second.result.current.settings.contrast).toBe(true);
});

test('existing preferences without a language retain Korean', async () => {
  await AsyncStorage.setItem(
    'galjido.settings',
    JSON.stringify({ apiBase: 'http://127.0.0.1:8000', contrast: true }),
  );
  const hook = await mount();
  expect(hook.result.current.settings.language).toBe('ko');
  expect(hook.result.current.settings.contrast).toBe(true);
});

test('persists the selected disability profile without changing other preferences or calling the API', async () => {
  const first = await mount();
  await act(() =>
    first.result.current.saveSettings({
      ...first.result.current.settings,
      assistance: 'visual',
      largeText: true,
    }),
  );
  expect(fetchMock).not.toHaveBeenCalled();
  await first.unmount();
  const second = await mount();
  expect(second.result.current.settings.assistance).toBe('visual');
  expect(second.result.current.settings.largeText).toBe(true);
});
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
test.each([true, false])(
  'pickup vibration (%s) is independent of alerts and fires once',
  async (vibration) => {
    jest.mocked(Haptics.notificationAsync).mockClear();
    const { result } = await mount();
    await act(() => result.current.updateSettings({ vibration, orderAlerts: !vibration }));
    await act(() => result.current.connect('GK01', 'ABCDEFGH'));
    await act(() => result.current.updateCart([{ itemId: 'coffee', qty: 1, options: {} }]));
    await act(() => result.current.submit('counter', ''));
    const previous = route;
    let status = 'accepted';
    let updatedAtMs = 1;
    route = (path, method) =>
      path === '/orders/o1' ? { data: { ...placed, status, updatedAtMs } } : previous(path, method);
    await act(() => result.current.getOrder('o1'));
    status = 'preparing';
    updatedAtMs++;
    await act(() => result.current.refresh());
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    status = 'ready';
    updatedAtMs++;
    await act(async () => {
      await Promise.all([result.current.getOrder('o1'), result.current.refresh()]);
    });
    expect(result.current.order?.status).toBe('ready');
    if (vibration) expect(result.current.notice).not.toContain('픽업해 주세요');
    else expect(result.current.notice).toContain('픽업해 주세요');
    status = 'preparing';
    updatedAtMs--;
    await act(() => result.current.refresh());
    expect(result.current.order?.status).toBe('ready');
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(vibration ? 1 : 0);
  },
);

test('obtains a server cart and submits without pairing to a kiosk', async () => {
  const previous = route;
  route = (path, method) => {
    if (path === '/stores/cafe/sessions')
      return {
        data: {
          ...connection,
          kioskId: null,
          status: 'active',
          cart: { lines: [], total: 0, summary: '' },
        },
      };
    return previous(path, method);
  };
  const { result } = await mount();
  await act(() => result.current.updateCart([{ itemId: 'coffee', qty: 1, options: {} }], 'cafe'));
  expect(result.current.connection?.kioskId).toBeNull();
  expect(result.current.store?.storeId).toBe('cafe');
  expect(result.current.cart.total).toBe(2500);
  expect(await AsyncStorage.getItem(`session:${result.current.api.base}`)).toBe('s1');
  await act(() => result.current.submit('counter', ''));
  expect(result.current.order?.orderId).toBe('o1');
  const requested = fetchMock.mock.calls.map(([url]) => new URL(url).pathname);
  const posted = fetchMock.mock.calls.find(([url]) => url.endsWith('/sessions/s1/order'));
  expect(JSON.parse(posted![1].body)).toMatchObject({
    paymentMethod: 'counter',
    simulatePayment: false,
  });
  expect(requested).toContain('/stores/cafe/sessions');
  expect(requested).not.toContain('/sessions');
  expect(requested).not.toContain('/kiosks/GK01');
});

test('keeps independently saved preferences when changes overlap', async () => {
  const { result } = await mount();
  await act(async () => {
    await Promise.all([
      result.current.updateSettings({ language: 'en' }),
      result.current.updateSettings({ contrast: true, exploreMode: 'list' }),
    ]);
  });
  expect(result.current.settings).toMatchObject({
    language: 'en',
    contrast: true,
    exploreMode: 'list',
  });
});

test('recent search consent, queued writes and clearing persist separately', async () => {
  const { result, unmount } = await mount();
  await act(async () => {
    await Promise.all([
      result.current.rememberSearch('Latte'),
      result.current.rememberSearch('Mocha'),
    ]);
    await result.current.rememberSearch('latte');
    await Promise.all([
      result.current.updateSettings({ saveRecentSearches: false }),
      result.current.rememberSearch('Private'),
    ]);
  });
  expect(result.current.settings.recentSearches).toEqual(['latte', 'Mocha']);
  await act(() => result.current.updateSettings({ recentSearches: [] }));
  await unmount();
  const restored = await mount();
  expect(restored.result.current.settings).toMatchObject({
    saveRecentSearches: false,
    recentSearches: [],
  });
  await act(() => restored.result.current.updateSettings({ saveRecentSearches: true }));
  await act(() => restored.result.current.rememberSearch('Tea'));
  expect(restored.result.current.settings.recentSearches).toEqual(['Tea']);
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

test('changing language clears cart feedback even when a cart update finishes later', async () => {
  const { result } = await mount();
  await act(() => result.current.connect('GK01', 'ABCDEFGH'));
  const items = [{ itemId: 'coffee', qty: 1, options: {} }];
  await act(() => result.current.updateSettings({ language: 'en' }));
  await act(() => result.current.updateCart(items));
  expect(result.current.notice).toBeTruthy();

  const response = await fetchMock.mock.results.at(-1)!.value;
  let finish!: () => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => resolve(response);
      }),
  );
  let update!: Promise<unknown>;
  await act(async () => {
    update = result.current.updateCart(items);
    await Promise.resolve();
  });
  await act(() => result.current.updateSettings({ language: 'ko' }));
  expect(result.current.notice).toBe('');
  await act(async () => {
    finish();
    await update;
  });
  expect(result.current.notice).toBe('');
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

test('keeps the restored cart when a remembered order from an earlier visit is gone', async () => {
  // Found on dev.galjido.shop: the saved order belonged to an earlier connection,
  // the server answered 404, and that wiped the cart restored a moment before.
  device = 'dev_test';
  await AsyncStorage.setItem('session:http://127.0.0.1:8000', 's1');
  await AsyncStorage.setItem('order:http://127.0.0.1:8000', 'old-order');
  const previous = route;
  route = (path, method) => {
    if (path === '/sessions/s1') return { data: { ...connection, status: 'active', cart } };
    if (path === '/orders/old-order')
      return { data: { error: 'order-not-found', message: 'Order not found.' }, status: 404 };
    return previous(path, method);
  };
  const { result } = await mount();
  expect(result.current.connection?.sessionId).toBe('s1');
  expect(result.current.cart.total).toBe(2500);
  expect(result.current.items).toHaveLength(1);
  expect(await AsyncStorage.getItem('session:http://127.0.0.1:8000')).toBe('s1');
  expect(await AsyncStorage.getItem('order:http://127.0.0.1:8000')).toBeNull();
  expect(result.current.order).toBeNull();
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

test('rejects a wrong-store code before creating an ordering session', async () => {
  const { result } = await mount();
  await act(async () => {
    await expect(result.current.connect('GK01', 'ABCDEFGH', 'other-store')).rejects.toThrow(
      '매장이 다릅니다',
    );
  });
  expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === '/sessions')).toBe(false);
});

test('requires another review when the server changes the price before submission', async () => {
  const { result } = await mount();
  await act(() => result.current.connect('GK01', 'ABCDEFGH'));
  await act(() => result.current.updateCart([{ itemId: 'coffee', qty: 1, options: {} }]));
  const previous = route;
  route = (path, method) =>
    path.endsWith('/cart')
      ? { data: { ...cart, total: 3000, lines: [{ ...cart.lines[0], lineTotal: 3000 }] } }
      : previous(path, method);
  await act(async () => {
    await expect(result.current.submit('counter', '')).rejects.toThrow('가격');
  });
  expect(result.current.cart.total).toBe(3000);
  expect(result.current.items).toHaveLength(1);
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/order'))).toHaveLength(0);
  await act(() => result.current.submit('counter', ''));
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/order'))).toHaveLength(1);
});

test('blocks retries and cart edits after a lost submission response, then recovers the order', async () => {
  const { result } = await mount();
  await act(() => result.current.connect('GK01', 'ABCDEFGH'));
  await act(() => result.current.updateCart([{ itemId: 'coffee', qty: 1, options: {} }]));
  const previous = route;
  route = (path, method) => {
    if (path.endsWith('/order')) throw new TypeError('Connection lost after server commit');
    return previous(path, method);
  };
  await act(async () => {
    await expect(result.current.submit('counter', '')).rejects.toThrow('Connection lost');
  });
  expect(result.current.pendingSubmission).toBe('s1');
  expect(await AsyncStorage.getItem('pending-order:http://127.0.0.1:8000')).toBe('s1');
  await act(async () => {
    await expect(result.current.submit('counter', '')).rejects.toThrow('전송 결과');
    await expect(result.current.updateCart([])).rejects.toThrow('전송 결과');
    await expect(result.current.disconnect()).rejects.toThrow('전송 결과');
  });
  route = (path, method) =>
    path === '/sessions/s1'
      ? { data: { ...connection, status: 'ordered', orderId: 'o1' } }
      : previous(path, method);
  await act(() => result.current.recoverSubmission());
  expect(result.current.order?.orderId).toBe('o1');
  expect(result.current.pendingSubmission).toBeNull();
  expect(result.current.connection).toBeNull();
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/order'))).toHaveLength(1);
});

test('keeps a legacy uncertain submission blocked when a read cannot prove its outcome', async () => {
  device = 'dev_test';
  await AsyncStorage.setItem('pending-order:http://127.0.0.1:8000', 's1');
  const { result } = await mount();
  expect(result.current.pendingSubmission).toBe('s1');
  await act(async () => {
    await expect(result.current.recoverSubmission()).rejects.toThrow('확실하지');
  });
  expect(result.current.pendingSubmission).toBe('s1');
  expect(result.current.connection?.sessionId).toBe('s1');
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/order'))).toHaveLength(0);
});

test('help submission means sent, not acknowledged or assistance received', async () => {
  const previous = route;
  route = (path, method) =>
    path.endsWith('/help') ? { data: { type: 'help' } } : previous(path, method);
  const { result } = await mount();
  await act(() => result.current.connect('GK01', 'ABCDEFGH'));
  await act(() => result.current.help());
  expect(result.current.helpState).toBe('sent');
  await act(() => result.current.updateCart([{ itemId: 'coffee', qty: 1, options: {} }]));
  await act(() => result.current.submit('counter', ''));
  await act(async () => {
    await expect(result.current.help()).rejects.toThrow('직접');
  });
});

test('ignores a stale preview store response after connecting to another store', async () => {
  const storeB = { ...store, storeId: 'branch', name: '브랜치' };
  const connectionB = { sessionId: 's2', kioskId: 'GK02', storeId: 'branch' };
  const previous = route;
  route = (path, method) => {
    if (path === '/kiosks/GK02')
      return { data: { kioskId: 'GK02', storeId: 'branch', name: '브랜치' } };
    if (path === '/sessions' && method === 'POST') return { data: connectionB };
    if (path === '/stores/branch') return { data: storeB };
    if (path === '/sessions/s2')
      return {
        data: { ...connectionB, status: 'active', cart: { lines: [], total: 0, summary: '' } },
      };
    return previous(path, method);
  };
  let release = () => {};
  const waitForCafe = new Promise<void>((resolve) => {
    release = resolve;
  });
  global.fetch = jest.fn(async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    if (path === '/stores/cafe') await waitForCafe;
    const response = route(path, init.method ?? 'GET');
    return {
      ok: (response.status ?? 200) < 400,
      status: response.status ?? 200,
      json: async () => response.data,
    };
  }) as unknown as typeof fetch;
  const { result } = await mount();
  const preview = result.current.selectStore('cafe');
  await act(() => result.current.connect('GK02', 'ABCDEFGH'));
  await waitFor(() => expect(result.current.store?.storeId).toBe('branch'));
  release();
  await preview;
  await waitFor(() => expect(result.current.store?.storeId).toBe('branch'));
});

test('replays the exact persisted request when the first submission has no known result', async () => {
  const { result } = await mount();
  await act(() => result.current.connect('GK01', 'ABCDEFGH'));
  await act(() => result.current.updateCart([{ itemId: 'coffee', qty: 1, options: {} }]));
  const previous = route;
  route = (path, method) => {
    if (path.endsWith('/order')) throw new TypeError('offline');
    return previous(path, method);
  };
  await act(async () => {
    await expect(result.current.submit('counter', 'note')).rejects.toThrow('offline');
  });
  const saved = JSON.parse((await AsyncStorage.getItem('submission:http://127.0.0.1:8000'))!);
  expect(saved.quoteId).toBe('quote-1');
  route = previous;
  await act(() => result.current.recoverSubmission());
  const requests = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/order'));
  expect(requests).toHaveLength(2);
  expect(requests[0][1].body).toBe(requests[1][1].body);
  expect(requests[1][1].headers['Idempotency-Key']).toBe('order:s1');
  expect(result.current.pendingSubmission).toBeNull();
  expect(result.current.order?.orderId).toBe('o1');
  expect(await AsyncStorage.getItem('submission:http://127.0.0.1:8000')).toBeNull();
});

test('keeps the original cart on a rejected switch and releases it only after the new cart is saved', async () => {
  const { result } = await mount();
  const line = { itemId: 'coffee', qty: 1, options: {} };
  await act(() => result.current.connect('GK01', 'ABCDEFGH'));
  await act(() => result.current.updateCart([line]));
  const previous = route;
  let rejectCart = true;
  route = (path, method) => {
    if (path === '/stores/next') return { data: { ...store, storeId: 'next' } };
    if (path === '/stores/next/cart')
      return rejectCart
        ? { status: 409, data: { error: 'ordering-paused' } }
        : { data: { sessionId: 's2', storeId: 'next', kioskId: null, cart } };
    if (path === '/sessions/s1/end') return { data: { type: 'ended' } };
    return previous(path, method);
  };
  await act(async () => {
    await expect(result.current.updateCart([line], 'next', 's1')).rejects.toMatchObject({
      code: 'ordering-paused',
    });
  });
  expect(result.current.connection?.sessionId).toBe('s1');
  expect(result.current.items).toEqual([line]);
  const key = `session:${result.current.api.base}`;
  expect(await AsyncStorage.getItem(key)).toBe('s1');
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/s1/end'))).toBe(false);
  rejectCart = false;
  await act(() => result.current.updateCart([line], 'next', 's1'));
  expect(result.current.connection?.sessionId).toBe('s2');
  expect(await AsyncStorage.getItem(key)).toBe('s2');
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/s1/end'))).toBe(true);
});

test.each(['ordering-paused', 'unknown-item'])(
  'releases a pending checkout when replay definitively rejects it with %s',
  async (reason) => {
    const { result } = await mount();
    await act(() => result.current.connect('GK01', 'ABCDEFGH'));
    const line = { itemId: 'coffee', qty: 1, options: {} };
    await act(() => result.current.updateCart([line]));
    const previous = route;
    route = (path, method) => {
      if (path.endsWith('/order')) throw new TypeError('Lost response');
      return previous(path, method);
    };
    await act(async () => {
      await expect(result.current.submit('counter', '')).rejects.toThrow('Lost response');
    });
    expect(result.current.pendingSubmission).toBe('s1');
    route = (path, method) =>
      path.endsWith('/order')
        ? { status: reason === 'unknown-item' ? 404 : 409, data: { error: reason } }
        : previous(path, method);
    await act(async () => {
      await expect(result.current.recoverSubmission()).rejects.toMatchObject({ code: reason });
    });
    expect(result.current.pendingSubmission).toBeNull();
    expect(result.current.items).toEqual([line]);
    expect(result.current.order).toBeNull();
    expect(await AsyncStorage.getItem('submission:http://127.0.0.1:8000')).toBeNull();
  },
);

test('an unreadable successful submission stays recoverable without a second order', async () => {
  const { result } = await mount();
  await act(() => result.current.connect('GK01', 'ABCDEFGH'));
  await act(() => result.current.updateCart([{ itemId: 'coffee', qty: 1, options: {} }]));
  const previous = route;
  route = (path, method) =>
    path.endsWith('/order') ? { status: 201, data: undefined } : previous(path, method);
  await act(async () => {
    await expect(result.current.submit('counter', '')).rejects.toMatchObject({ status: 201 });
  });
  expect(result.current.pendingSubmission).toBe('s1');
  route = (path, method) =>
    path === '/sessions/s1'
      ? { data: { ...connection, status: 'ordered', orderId: 'o1' } }
      : previous(path, method);
  await act(() => result.current.recoverSubmission());
  expect(result.current.order?.orderId).toBe('o1');
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/order'))).toHaveLength(1);
});
