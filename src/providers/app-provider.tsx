import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Api, ApiError, errorMessage, normalizeBase } from '@/lib/api';
import { restoreCart, validateItem } from '@/lib/cart';
import { subscribe } from '@/lib/live';
import { secrets } from '@/lib/storage';
import {
  statusLabels,
  type Cart,
  type CartItem,
  type Connection,
  type Order,
  type Store,
} from '@/lib/types';

type Settings = {
  assistance?: import('@/lib/location').Assistance;
  apiBase: string;
  contrast: boolean;
  largeText: boolean;
  speech: boolean;
};
const initialSettings: Settings = {
  apiBase: process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000',
  contrast: false,
  largeText: false,
  speech: true,
};
const emptyCart: Cart = { lines: [], summary: '', total: 0 };
function useAppState() {
  const [settings, setSettings] = useState(initialSettings);
  const [ready, setReady] = useState(false);
  const [store, setStore] = useState<Store | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [order, setOrder] = useState<Order | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const lastSpoken = useRef(
    '갈지도에 오신 것을 환영합니다. 매장을 선택하고 키오스크에 연결해 주세요.',
  );
  const api = useMemo(() => new Api(settings.apiBase), [settings.apiBase]);
  const currentApi = useRef(api);
  currentApi.current = api;
  const pendingToken = useRef<{ base: string; promise: Promise<string> } | null>(null);
  const demo = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
  const announce = useCallback(
    (message: string) => {
      lastSpoken.current = message;
      setNotice(message);
      AccessibilityInfo.announceForAccessibility(message);
      if (settings.speech)
        void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
          if (!enabled) {
            void Speech.stop();
            Speech.speak(message, { language: 'ko-KR', rate: 0.95 });
          }
        });
    },
    [settings.speech],
  );
  const report = useCallback((error: unknown) => announce(errorMessage(error)), [announce]);
  async function exclusive<T>(action: () => Promise<T>): Promise<T> {
    if (lock.current) throw new Error('이전 요청이 완료될 때까지 기다려 주세요.');
    lock.current = true;
    setBusy(true);
    try {
      return await action();
    } catch (error) {
      if (
        error instanceof ApiError &&
        ['session-expired', 'session-not-found'].includes(error.code)
      )
        await clearSession();
      throw error;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const token = useCallback(async () => {
    const saved = await secrets.get(api.base, 'device');
    if (saved) return saved;
    if (pendingToken.current?.base === api.base) return pendingToken.current.promise;
    const promise = api.register().then(async (device) => {
      await secrets.set(api.base, 'device', device.token);
      return device.token;
    });
    pendingToken.current = { base: api.base, promise };
    try {
      return await promise;
    } finally {
      if (pendingToken.current?.promise === promise) pendingToken.current = null;
    }
  }, [api]);
  const clearSession = useCallback(async () => {
    setConnection(null);
    setItems([]);
    setCart(emptyCart);
    await AsyncStorage.removeItem(`session:${api.base}`);
  }, [api]);
  const refresh = useCallback(async () => {
    const device = await secrets.get(api.base, 'device');
    if (!device || currentApi.current !== api) return;
    if (connection) {
      const session = await api.session(connection.sessionId, device);
      if (currentApi.current !== api) return;
      if (session.status !== 'active') {
        if (session.orderId) {
          const placed = await api.order(session.orderId, device);
          if (currentApi.current !== api) return;
          setOrder(placed);
          await AsyncStorage.setItem(`order:${api.base}`, placed.orderId);
        }
        await clearSession();
        return;
      }
    }
    if (order) {
      const latest = await api.order(order.orderId, device);
      if (currentApi.current !== api) return;
      if (latest.status !== order.status)
        announce(`주문 ${latest.orderNumber}번, ${statusLabels[latest.status]}`);
      setOrder((current) => (current?.orderId === latest.orderId ? latest : current));
    }
  }, [api, connection, order?.orderId, order?.status, clearSession, announce]);
  useEffect(() => {
    AsyncStorage.getItem('galjido.settings')
      .then((raw) => {
        if (raw) {
          const saved = JSON.parse(raw) as Settings;
          normalizeBase(saved.apiBase);
          setSettings({ ...initialSettings, ...saved });
        }
      })
      .catch(report)
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void (async () => {
      const device = await secrets.get(api.base, 'device');
      if (!device) return;
      const id = await AsyncStorage.getItem(`session:${api.base}`);
      if (id) {
        const session = await api.session(id, device);
        if (active && session.status === 'active') {
          const selected = await api.store(session.storeId);
          if (!active) return;
          setStore(selected);
          setConnection(session);
          setCart(session.cart);
          setItems(restoreCart(session.cart.lines, selected.menu ?? []));
        } else if (active) await clearSession();
        if (session.orderId) await AsyncStorage.setItem(`order:${api.base}`, session.orderId);
      }
      const lastOrder = await AsyncStorage.getItem(`order:${api.base}`);
      if (lastOrder) {
        const latest = await api.order(lastOrder, device);
        if (active) setOrder(latest);
      }
    })().catch((error) => {
      if (active) {
        report(error);
        if (error instanceof ApiError && [401, 403, 404, 409].includes(error.status))
          void clearSession();
        if (error instanceof ApiError && error.status === 401)
          void secrets.set(api.base, 'device', null);
      }
    });
    return () => {
      active = false;
    };
  }, [api, ready]);
  useEffect(() => {
    if (!connection && !order) return;
    let stop: (() => void) | undefined;
    let active = true;
    const sync = () => void refresh().catch(report);
    void secrets
      .get(api.base, 'device')
      .then((device) => {
        if (!device || !active) return;
        const id = connection?.sessionId ?? order?.sessionId;
        stop = subscribe(
          api.wsUrl(`/ws/sessions/${id}`, device),
          (event) => {
            if (event.type === 'help_resolved') announce('직원이 도움 요청을 확인했습니다.');
            sync();
          },
          sync,
          () =>
            report(
              new Error(
                '실시간 연결 인증을 확인해 주세요. 새로고침으로 상태를 확인할 수 있습니다.',
              ),
            ),
        );
      })
      .catch(report);
    const poll = setInterval(sync, 10000);
    return () => {
      active = false;
      stop?.();
      clearInterval(poll);
    };
  }, [api, connection?.sessionId, order?.sessionId, refresh]);
  async function selectStore(id: string) {
    if (connection && connection.storeId !== id)
      throw new Error('현재 매장 연결을 종료한 후 다른 매장을 선택해 주세요.');
    const selected = await api.store(id);
    if (currentApi.current !== api)
      throw new Error('서버가 변경되었습니다. 매장을 다시 선택해 주세요.');
    setStore(selected);
    return selected;
  }
  async function connect(kioskId: string, code: string) {
    return exclusive(async () => {
      if (connection) throw new Error('기존 연결을 종료한 후 새 키오스크에 연결해 주세요.');
      const device = await token();
      try {
        const result = await api.connect(
          kioskId.trim().toUpperCase(),
          code.trim().toUpperCase(),
          device,
        );
        await AsyncStorage.setItem(`session:${api.base}`, result.sessionId);
        setConnection(result);
        const selected = await selectStore(result.storeId);
        const session = await api.session(result.sessionId, device);
        setItems(restoreCart(session.cart.lines, selected.menu ?? []));
        setCart(session.cart);
        announce(`${selected.name}에 연결되었습니다.`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401)
          await secrets.set(api.base, 'device', null);
        throw error;
      }
    });
  }
  async function updateCart(next: CartItem[]) {
    return exclusive(async () => {
      if (!connection) throw new Error('먼저 키오스크에 연결해 주세요.');
      if (next.length > 20) throw new Error('한 번에 20개 메뉴까지 담을 수 있습니다.');
      for (const line of next) {
        const item = store?.menu?.find((entry) => entry.id === line.itemId);
        if (!item) throw new Error('메뉴를 새로고침해 주세요.');
        const error = validateItem(item, line.qty, line.options);
        if (error) throw new Error(error);
      }
      const result = await api.cart(connection.sessionId, next, await token());
      setItems(next);
      setCart(result);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      announce(`장바구니가 변경되었습니다. 합계 ${result.total.toLocaleString('ko-KR')}원`);
    });
  }
  async function submit(payment: 'counter' | 'kiosk', note: string) {
    return exclusive(async () => {
      if (!connection || !items.length) throw new Error('연결 상태와 장바구니를 확인해 주세요.');
      // The server closes a session atomically on order submission. Never retry a
      // timed-out POST automatically; refresh recovers any already-created order.
      const placed = await api.submit(connection.sessionId, items, payment, note, await token());
      setOrder(placed);
      await AsyncStorage.setItem(`order:${api.base}`, placed.orderId);
      await clearSession();
      announce(`주문이 완료되었습니다. 주문 번호 ${placed.orderNumber}번.`);
      return placed;
    });
  }
  async function disconnect() {
    return exclusive(async () => {
      if (connection) await api.end(connection.sessionId, await token());
      await clearSession();
      announce('연결을 종료했습니다.');
    });
  }
  async function saveSettings(next: Settings) {
    if (lock.current && next.apiBase !== api.base)
      throw new Error('요청이 완료된 후 서버를 변경해 주세요.');
    const normalized = { ...next, apiBase: normalizeBase(next.apiBase) };
    if (connection && normalized.apiBase !== api.base)
      throw new Error('서버를 바꾸기 전에 연결을 종료해 주세요.');
    await AsyncStorage.setItem('galjido.settings', JSON.stringify(normalized));
    if (normalized.apiBase !== api.base) {
      setStore(null);
      setOrder(null);
      setItems([]);
      setCart(emptyCart);
    }
    setSettings(normalized);
    if (!next.speech) await Speech.stop();
  }
  return {
    api,
    ready,
    settings,
    saveSettings,
    store,
    selectStore,
    connection,
    connect,
    disconnect,
    items,
    cart,
    updateCart,
    submit,
    order,
    refresh,
    busy,
    notice,
    announce,
    report,
    demo,
    repeat: () => announce(lastSpoken.current),
    help: async () => {
      if (!connection) throw new Error('먼저 키오스크에 연결해 주세요.');
      await api.help(connection.sessionId, await token());
      announce('직원에게 도움을 요청했습니다.');
    },
    cancel: async (id: string) => {
      await api.cancel(id, await token());
      await refresh();
    },
    getOrder: async (id: string) => api.order(id, await token()),
  };
}
const AppContext = createContext<ReturnType<typeof useAppState> | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const state = useAppState();
  return <AppContext.Provider value={state}>{children}</AppContext.Provider>;
}
export function useApp() {
  const state = useContext(AppContext);
  if (!state) throw new Error('AppProvider is missing');
  return state;
}
