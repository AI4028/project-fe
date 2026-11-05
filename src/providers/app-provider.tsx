import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
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
  voiceInput?: boolean;
};
const initialSettings: Settings = {
  apiBase: process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000',
  contrast: false,
  largeText: false,
  speech: false,
  voiceInput: false,
};
const emptyCart: Cart = { lines: [], summary: '', total: 0 };
function useAppState() {
  const [settings, setSettings] = useState(initialSettings);
  const [ready, setReady] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [store, setStore] = useState<Store | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [order, setOrder] = useState<Order | null>(null);
  const [notice, setNotice] = useState('');
  const [pendingSubmission, setPendingSubmission] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  const [helpState, setHelpState] = useState<'idle' | 'sent' | 'acknowledged'>('idle');
  const [checkout, setCheckout] = useState<{ payment: 'counter' | 'kiosk'; note: string }>({
    payment: 'counter',
    note: '',
  });
  async function markPending(id: string | null) {
    // Persist before POST so a closed tab can recover an uncertain submission.
    if (id) await AsyncStorage.setItem(`pending-order:${api.base}`, id);
    else await AsyncStorage.removeItem(`pending-order:${api.base}`);
    pendingRef.current = id;
    setPendingSubmission(id);
  }

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
      if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(message);
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
    if (restoring) throw new Error('이전 이용 내역을 확인하고 있습니다. 잠시 기다려 주세요.');
    if (lock.current) throw new Error('이전 요청이 완료될 때까지 기다려 주세요.');
    lock.current = true;
    setBusy(true);
    try {
      return await action();
    } catch (error) {
      if (
        !pendingRef.current &&
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
    setHelpState('idle');
    await AsyncStorage.removeItem(`session:${api.base}`);
  }, [api]);
  async function rememberOrder(placed: Order) {
    setOrder(placed);
    await AsyncStorage.setItem(`order:${api.base}`, placed.orderId);
    await markPending(null);
    await clearSession();
    return placed;
  }
  async function recoverSubmission(): Promise<Order | null> {
    return exclusive(async () => {
      const id = pendingRef.current;
      if (!id) return null;
      const session = await api.session(id, await token());
      if (session.orderId) return rememberOrder(await api.order(session.orderId, await token()));
      if (session.status === 'active') {
        const selected = await api.store(session.storeId);
        setStore(selected);
        setConnection(session);
        setCart(session.cart);
        setItems(restoreCart(session.cart.lines, selected.menu ?? []));
      } else await clearSession();
      await markPending(null);
      announce(
        session.status === 'active'
          ? '현재 확인된 주문이 없습니다. 장바구니를 검토한 뒤 다시 제출할 수 있습니다.'
          : '연결이 종료되었습니다. 주문이 확인되지 않아 직원 확인이 필요합니다.',
      );
      return null;
    });
  }
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
          await rememberOrder(placed);
        }
        await clearSession();
        return;
      }
      if (session.helpRequested) setHelpState('sent');
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
    setRestoring(true);
    void (async () => {
      const pending = await AsyncStorage.getItem(`pending-order:${api.base}`);
      if (!active) return;
      pendingRef.current = pending;
      setPendingSubmission(pending);
      const device = await secrets.get(api.base, 'device');
      if (!device) {
        if (pending)
          report(
            new Error(
              '이전 주문의 기기 인증을 찾을 수 없습니다. 매장 직원에게 주문 여부를 확인해 주세요.',
            ),
          );
        return;
      }
      const id = pending || (await AsyncStorage.getItem(`session:${api.base}`));
      if (id) {
        const session = await api.session(id, device);
        if (!active) return;
        if (session.orderId) {
          const placed = await api.order(session.orderId, device);
          if (!active) return;
          await rememberOrder(placed);
          return;
        }
        if (session.status === 'active') {
          const selected = await api.store(session.storeId);
          if (!active) return;
          setStore(selected);
          setConnection(session);
          setCart(session.cart);
          if (session.helpRequested) setHelpState('sent');
          setItems(restoreCart(session.cart.lines, selected.menu ?? []));
        } else await clearSession();
      }
      const lastOrder = await AsyncStorage.getItem(`order:${api.base}`);
      if (lastOrder) {
        const latest = await api.order(lastOrder, device);
        if (active) setOrder(latest);
      }
    })()
      .catch((error) => {
        if (active) {
          report(error);
          if (
            !pendingRef.current &&
            error instanceof ApiError &&
            [401, 403, 404, 409].includes(error.status)
          )
            void clearSession();
          if (!pendingRef.current && error instanceof ApiError && error.status === 401)
            void secrets.set(api.base, 'device', null);
        }
      })
      .finally(() => {
        if (active) setRestoring(false);
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
            if (event.type === 'help_resolved') {
              setHelpState('acknowledged');
              announce('직원이 도움 요청을 확인했습니다. 실제 도움은 직원에게 확인해 주세요.');
            }
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
  async function connect(kioskId: string, code: string, expectedStoreId?: string) {
    return exclusive(async () => {
      if (connection) throw new Error('기존 연결을 종료한 후 새 키오스크에 연결해 주세요.');
      if (pendingRef.current) throw new Error('먼저 이전 주문의 전송 결과를 확인해 주세요.');
      const kiosk = await api.kioskInfo(kioskId.trim().toUpperCase());
      if (expectedStoreId && kiosk.storeId !== expectedStoreId)
        throw new Error('선택한 매장과 연결 코드의 매장이 다릅니다. 매장을 다시 확인해 주세요.');
      const device = await token();
      try {
        const result = await api.connect(
          kioskId.trim().toUpperCase(),
          code.trim().toUpperCase(),
          device,
        );
        await AsyncStorage.setItem(`session:${api.base}`, result.sessionId);
        setConnection(result);
        setCheckout({ payment: 'counter', note: '' });
        setHelpState('idle');
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
      if (pendingRef.current) throw new Error('먼저 주문 전송 결과를 확인해 주세요.');
      if (!connection) throw new Error('먼저 매장에 연결해 주세요.');
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
      return result;
    });
  }
  async function submit(payment: 'counter' | 'kiosk', note: string) {
    return exclusive(async () => {
      if (pendingRef.current)
        throw new Error('전송 결과를 먼저 확인해 주세요. 주문을 다시 보내지 않았습니다.');
      if (!connection || !items.length) throw new Error('연결 상태와 장바구니를 확인해 주세요.');
      const device = await token();
      const latest = await api.cart(connection.sessionId, items, device);
      setCart(latest);
      if (
        latest.total !== cart.total ||
        JSON.stringify(latest.lines) !== JSON.stringify(cart.lines)
      )
        throw new Error(
          '가격 또는 주문 정보가 변경되었습니다. 새 합계를 확인하고 다시 제출해 주세요.',
        );
      await markPending(connection.sessionId);
      let placed: Order;
      try {
        placed = await api.submit(connection.sessionId, items, payment, note, device);
      } catch (error) {
        // A timeout/5xx or already-closed session can hide a committed order.
        if (
          error instanceof ApiError &&
          error.status < 500 &&
          !['session-expired', 'session-not-found'].includes(error.code)
        )
          await markPending(null);
        throw error;
      }
      await rememberOrder(placed);
      announce(`주문 ${placed.orderNumber}번을 전송했습니다. 매장 접수를 기다려 주세요.`);
      return placed;
    });
  }
  async function disconnect() {
    return exclusive(async () => {
      if (pendingRef.current) throw new Error('먼저 주문 전송 결과를 확인해 주세요.');
      if (connection) await api.end(connection.sessionId, await token());
      await clearSession();
      announce('연결을 종료했습니다.');
    });
  }
  async function saveSettings(next: Settings) {
    if (lock.current && next.apiBase !== api.base)
      throw new Error('요청이 완료된 후 서버를 변경해 주세요.');
    const normalized = { ...next, apiBase: normalizeBase(next.apiBase) };
    if ((connection || pendingRef.current) && normalized.apiBase !== api.base)
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
    pendingSubmission,
    recoverSubmission,
    helpState,
    checkout,
    setCheckout,
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
    busy: busy || restoring,
    notice,
    announce,
    report,
    demo,
    repeat: () => announce(lastSpoken.current),
    help: async () =>
      exclusive(async () => {
        if (!connection || pendingRef.current)
          throw new Error('현재는 매장 직원에게 직접 도움을 요청해 주세요.');
        await api.help(connection.sessionId, await token());
        setHelpState('sent');
        announce('도움 요청을 보냈습니다. 직원 확인을 기다리고 있습니다.');
      }),
    cancel: async (id: string) =>
      exclusive(async () => {
        await api.cancel(id, await token());
        const latest = await api.order(id, await token());
        setOrder(latest);
        return latest;
      }),
    getOrder: async (id: string) => {
      const latest = await api.order(id, await token());
      if (currentApi.current === api)
        setOrder((current) => (current?.orderId === id ? latest : current));
      return latest;
    },
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
