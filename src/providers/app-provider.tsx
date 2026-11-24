import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Api, ApiError, CartChangedError, errorMessage, normalizeBase } from '@/lib/api';
import { restoreCart, validateItem } from '@/lib/cart';
import { subscribe } from '@/lib/live';
import { secrets } from '@/lib/storage';
import { translate, type Language } from '@/lib/i18n';
import Constants from 'expo-constants';
import { developmentApiBase } from '@/lib/development-api';
import {
  statusLabels,
  type Cart,
  type CartItem,
  type Connection,
  type Order,
  type PaymentMethod,
  type Store,
} from '@/lib/types';

// Only explicit checkout rejections establish that the server declined the order.
function checkoutRejected(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    [
      'bad-payment-method',
      'bad-note',
      'price-changed',
      'ordering-paused',
      'kiosk-pairing-required',
      'empty-order',
      'too-many-lines',
      'bad-line',
      'unknown-item',
      'item-unavailable',
      'bad-qty',
      'bad-options',
      'unknown-option',
      'missing-option',
      'too-many-choices',
      'unknown-choice',
      'choice-unavailable',
    ].includes(error.code)
  );
}

type Settings = {
  language?: Language;
  assistance?: import('@/lib/location').Assistance;
  exploreMode?: 'list' | 'map';
  apiBase: string;
  contrast: boolean;
  largeText: boolean;
  textSize?: import('@/lib/text-size').TextSize;
  speech: boolean;
  voiceInput?: boolean;
  vibration?: boolean;
  orderAlerts?: boolean;
  locateOnStart?: boolean;
  saveRecentSearches?: boolean;
  recentSearches?: string[];
};
const initialSettings: Settings = {
  language: 'ko',
  apiBase: developmentApiBase(
    process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000',
    __DEV__ ? Constants.expoConfig?.hostUri : undefined,
    Platform.OS !== 'web',
  ),
  contrast: false,
  largeText: false,
  speech: false,
  voiceInput: false,
  locateOnStart: false,
};
const emptyCart: Cart = { lines: [], summary: '', total: 0 };

async function readSavedPlaces(base: string): Promise<Store[]> {
  const raw = await AsyncStorage.getItem(`saved-places:${base}`);
  const value: unknown = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(value)) throw new Error('저장한 매장을 불러오지 못했어요.');
  return value.filter(
    (item): item is Store =>
      !!item &&
      typeof item.storeId === 'string' &&
      typeof item.name === 'string' &&
      !!item.accessibility,
  );
}

function useAppState(path: string) {
  const [settings, setSettings] = useState(initialSettings);
  const settingsRef = useRef(initialSettings);
  const settingsQueue = useRef<Promise<void>>(Promise.resolve());
  const [ready, setReady] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [store, setStore] = useState<Store | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [order, setOrder] = useState<Order | null>(null);
  const cartScope = useMemo(
    () => ({ path, language: settings.language }),
    [path, settings.language],
  );
  const activeScope = useRef(cartScope);
  useLayoutEffect(() => {
    activeScope.current = cartScope;
  }, [cartScope]);
  const [feedback, setFeedback] = useState<{ message: string; scope?: typeof cartScope }>();
  const notice =
    feedback && (!feedback.scope || feedback.scope === cartScope) ? feedback.message : '';
  const [pendingSubmission, setPendingSubmission] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  const [helpState, setHelpState] = useState<'idle' | 'sent' | 'acknowledged'>('idle');
  const [checkout, setCheckout] = useState<{ payment: PaymentMethod; note: string }>({
    payment: 'counter',
    note: '',
  });
  async function markPending(id: string | null) {
    // Persist before POST so a closed tab can recover an uncertain submission.
    if (id) await AsyncStorage.setItem(`pending-order:${api.base}`, id);
    else {
      await AsyncStorage.removeItem(`pending-order:${api.base}`);
      await AsyncStorage.removeItem(`submission:${api.base}`);
    }
    pendingRef.current = id;
    setPendingSubmission(id);
  }

  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const api = useMemo(() => new Api(settings.apiBase), [settings.apiBase]);
  const [saved, setSaved] = useState<{
    base: string;
    places: Store[];
    ready: boolean;
    error?: string;
  }>({
    base: api.base,
    places: [],
    ready: false,
  });
  const savedQueue = useRef<Promise<void>>(Promise.resolve());
  function changeSavedPlaces(store?: Store) {
    const base = api.base;
    const task = savedQueue.current
      .catch(() => {})
      .then(async () => {
        if (currentApi.current.base !== base) return;
        let places = await readSavedPlaces(base);
        if (store) {
          places = places.some((item) => item.storeId === store.storeId)
            ? places.filter((item) => item.storeId !== store.storeId)
            : [...places, { ...store, menu: undefined }];
          await AsyncStorage.setItem(`saved-places:${base}`, JSON.stringify(places));
        }
        if (currentApi.current.base === base) setSaved({ base, places, ready: true });
      })
      .catch((error: unknown) => {
        if (currentApi.current.base === base) {
          setSaved((current) => ({
            base,
            places: current.base === base ? current.places : [],
            ready: true,
            error: '저장한 매장을 불러오지 못했어요.',
          }));
        }
        if (store) throw error;
      });
    savedQueue.current = task;
    return task;
  }
  const reloadSavedPlaces = () => changeSavedPlaces();
  useEffect(() => {
    void reloadSavedPlaces();
  }, [api.base]);
  const currentApi = useRef(api);
  currentApi.current = api;
  const currentConnection = useRef(connection);
  currentConnection.current = connection;
  const selectStoreSeq = useRef(0);
  const pendingToken = useRef<{ base: string; promise: Promise<string> } | null>(null);
  const demo = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
  const speechRevision = useRef(0);
  const announce = useCallback(
    (message: string, scope?: typeof cartScope, readAloud = false) => {
      if (scope && scope !== activeScope.current) return;
      setFeedback({ message, scope });
      message = translate(message, settings.language ?? 'ko');
      if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(message);
      if (!settings.speech && !readAloud) return;
      if (Platform.OS === 'web' && !globalThis.speechSynthesis) return;
      const revision = ++speechRevision.current;
      async function speak() {
        if (Platform.OS !== 'web' && (await AccessibilityInfo.isScreenReaderEnabled())) return;
        if (revision !== speechRevision.current) return;
        await Speech.stop();
        if (revision === speechRevision.current)
          Speech.speak(message, {
            language: settings.language === 'en' ? 'en-US' : 'ko-KR',
            rate: 0.95,
          });
      }
      void speak().catch(() => {}); // The live text remains available if speech is unsupported.
    },
    [settings.speech, settings.language],
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
  const getOrders = useCallback(async () => {
    const device = await secrets.get(api.base, 'device');
    return device ? api.orders(device) : [];
  }, [api]);
  const applyOrderUpdate = useCallback((latest: Order) => {
    setOrder((current) =>
      current?.orderId === latest.orderId && (latest.updatedAtMs ?? 0) >= (current.updatedAtMs ?? 0)
        ? latest
        : current,
    );
  }, []);
  const previousOrder = useRef<Order | null>(null);
  useEffect(() => {
    const previous = previousOrder.current;
    previousOrder.current = order;
    if (!order || previous?.orderId !== order.orderId || previous.status === order.status) return;
    if (settingsRef.current.orderAlerts !== false)
      announce(`주문 ${order.orderNumber}번, ${statusLabels[order.status]}`);
    if (order.status === 'ready' && settingsRef.current.vibration !== false)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [order, announce]);
  const getOrder = useCallback(
    async (id: string) => {
      const latest = await api.order(id, await token());
      if (currentApi.current === api) applyOrderUpdate(latest);
      return latest;
    },
    [api, token, applyOrderUpdate],
  );
  const clearSession = useCallback(async () => {
    currentConnection.current = null;
    setConnection(null);
    setStore(null);
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
      const raw = await AsyncStorage.getItem(`submission:${api.base}`);
      if (raw) {
        const saved = JSON.parse(raw) as {
          sessionId: string;
          items: CartItem[];
          simulatePayment?: boolean;
          payment: PaymentMethod;
          note: string;
          quoteId: string;
        };
        if (saved.sessionId !== id)
          throw new Error('저장된 주문 정보가 일치하지 않습니다. 직원에게 확인해 주세요.');
        try {
          const placed = await api.submit(
            id,
            saved.items,
            saved.payment,
            saved.note,
            await token(),
            saved.quoteId,
            saved.simulatePayment,
          );
          return rememberOrder(placed);
        } catch (error) {
          if (
            checkoutRejected(error) ||
            (error instanceof ApiError && error.code === 'session-expired')
          )
            await markPending(null);
          throw error;
        }
      }
      // Legacy pending orders have no replay key/body. A read cannot rule out an in-flight POST.
      throw new Error('이전 주문의 전송 결과가 확실하지 않습니다. 매장 직원에게 확인해 주세요.');
    });
  }
  const refresh = useCallback(async () => {
    const device = await secrets.get(api.base, 'device');
    if (!device || currentApi.current !== api) return;
    if (connection) {
      const session = await api.session(connection.sessionId, device);
      if (currentApi.current !== api || currentConnection.current?.sessionId !== session.sessionId)
        return;
      if (session.status !== 'active' || !session.kioskId) {
        if (session.orderId) {
          const placed = await api.order(session.orderId, device);
          if (
            currentApi.current !== api ||
            currentConnection.current?.sessionId !== session.sessionId
          )
            return;
          await rememberOrder(placed);
        }
        await clearSession();
        return;
      }
      if (session.helpState) setHelpState(session.helpState);
      else if (session.helpRequested) setHelpState('sent');
      const latestStore = await api.pairedStore(session.sessionId, device);
      if (currentApi.current === api && currentConnection.current?.sessionId === session.sessionId)
        setStore(latestStore);
    }
    if (order) {
      const latest = await api.order(order.orderId, device);
      if (currentApi.current !== api) return;
      applyOrderUpdate(latest);
    }
  }, [api, connection, order?.orderId, clearSession, applyOrderUpdate]);
  useEffect(() => {
    AsyncStorage.getItem('galjido.settings')
      .then((raw) => {
        if (raw) {
          const saved = JSON.parse(raw) as Settings;
          normalizeBase(saved.apiBase);
          settingsRef.current = {
            ...initialSettings,
            ...saved,
            apiBase: developmentApiBase(
              saved.apiBase,
              __DEV__ ? Constants.expoConfig?.hostUri : undefined,
              Platform.OS !== 'web',
            ),
            language: saved.language === 'en' ? 'en' : 'ko',
          };
          setSettings(settingsRef.current);
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
        if (session.status === 'active' && session.kioskId) {
          const selected = await api.pairedStore(session.sessionId, device);
          if (!active) return;
          setStore(selected);
          setConnection(session);
          setCart(session.cart);
          if (session.helpState) setHelpState(session.helpState);
          else if (session.helpRequested) setHelpState('sent');
          setItems(restoreCart(session.cart.lines, selected.menu ?? []));
        } else await clearSession();
      }
      const lastOrder = await AsyncStorage.getItem(`order:${api.base}`);
      if (lastOrder) {
        try {
          const latest = await api.order(lastOrder, device);
          if (active) setOrder(latest);
        } catch (error) {
          // The saved order can belong to an earlier connection (web device
          // credentials end with the tab). Forget only that order; failing here
          // must not clear the cart session restored above.
          if (error instanceof ApiError && [403, 404].includes(error.status))
            await AsyncStorage.removeItem(`order:${api.base}`);
          else throw error;
        }
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
            if (event.type === 'cart') return;
            if (event.type === 'help_resolved') {
              setHelpState('acknowledged');
              announce('직원이 도움 요청을 확인했습니다. 실제 도움은 직원에게 확인해 주세요.');
            }
            if (event.type === 'ordering')
              announce(
                event.orderingPaused
                  ? '매장에서 휴대폰 주문을 잠시 멈췄어요. 카운터나 직원에게 주문할 수 있어요.'
                  : '휴대폰 주문을 다시 받고 있어요.',
              );
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
    const connection = currentConnection.current;
    if (!connection?.kioskId || connection.storeId !== id)
      throw new ApiError('kiosk-pairing-required', 409, 'Kiosk pairing required.');
    const request = ++selectStoreSeq.current;
    const selected = await api.pairedStore(connection.sessionId, await token());
    if (currentApi.current !== api || currentConnection.current?.sessionId !== connection.sessionId)
      throw new ApiError('kiosk-pairing-required', 409, 'Kiosk pairing required.');
    if (request !== selectStoreSeq.current) return selected;
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
        currentConnection.current = result;
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
  async function updateCart(next: CartItem[], storeId = store?.storeId) {
    return exclusive(async () => {
      if (pendingRef.current) throw new Error('먼저 주문 전송 결과를 확인해 주세요.');
      const active = currentConnection.current;
      if (!active?.kioskId || (storeId && active.storeId !== storeId))
        throw new ApiError('kiosk-pairing-required', 409, 'Kiosk pairing required.');
      if (next.length > 20) throw new Error('한 번에 20개 메뉴까지 담을 수 있습니다.');
      const selected = store?.storeId === active.storeId ? store : await selectStore(active.storeId);
      for (const line of next) {
        const item = selected.menu?.find((entry) => entry.id === line.itemId);
        if (!item) throw new Error('메뉴를 새로고침해 주세요.');
        const error = validateItem(item, line.qty, line.options);
        if (error) throw new Error(error);
      }
      const result = await api.cart(active.sessionId, next, await token());
      setItems(next);
      setCart(result);
      announce(
        `장바구니가 변경되었습니다. 합계 ${result.total.toLocaleString('ko-KR')}원`,
        cartScope,
      );
      return result;
    });
  }
  async function submit(payment: PaymentMethod, note: string) {
    return exclusive(async () => {
      if (pendingRef.current)
        throw new Error('전송 결과를 먼저 확인해 주세요. 주문을 다시 보내지 않았습니다.');
      if (!demo) payment = 'counter';
      if (!connection?.kioskId || !items.length) throw new Error('연결 상태와 장바구니를 확인해 주세요.');
      const device = await token();
      const latest = await api.cart(connection.sessionId, items, device);
      setCart(latest);
      if (
        latest.total !== cart.total ||
        JSON.stringify(latest.lines) !== JSON.stringify(cart.lines)
      )
        throw new CartChangedError(cart, latest);
      if (!latest.quoteId) throw new Error('서버 업데이트가 필요합니다. 직원에게 주문해 주세요.');
      await AsyncStorage.setItem(
        `submission:${api.base}`,
        JSON.stringify({
          sessionId: connection.sessionId,
          items,
          payment,
          note,
          quoteId: latest.quoteId,
          simulatePayment: demo,
        }),
      );
      await markPending(connection.sessionId);
      let placed: Order;
      try {
        placed = await api.submit(
          connection.sessionId,
          items,
          payment,
          note,
          device,
          latest.quoteId,
          demo,
        );
      } catch (error) {
        // A timeout/5xx or already-closed session can hide a committed order.
        if (checkoutRejected(error)) await markPending(null);
        if (error instanceof ApiError && error.code === 'price-changed') {
          const changed = await api.cart(connection.sessionId, items, device);
          setCart(changed);
          throw new CartChangedError(latest, changed);
        }
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
      const active = currentConnection.current;
      if (active) await api.end(active.sessionId, await token());
      await clearSession();
      announce('연결을 종료했습니다.');
    });
  }
  function queueSettings(change: (current: Settings) => Partial<Settings> | null) {
    const task = settingsQueue.current
      .catch(() => {})
      .then(async () => {
        const previous = settingsRef.current;
        const patch = change(previous);
        if (!patch) return;
        const base = patch.apiBase === undefined ? previous.apiBase : normalizeBase(patch.apiBase);
        if (base !== previous.apiBase) {
          if (lock.current) throw new Error('요청이 완료된 후 서버를 변경해 주세요.');
          if (currentConnection.current || pendingRef.current)
            throw new Error('서버를 바꾸기 전에 연결을 종료해 주세요.');
        }
        const next = { ...previous, ...patch, apiBase: base };
        await AsyncStorage.setItem('galjido.settings', JSON.stringify(next));
        if (base !== previous.apiBase) {
          setStore(null);
          setOrder(null);
          setItems([]);
          setCart(emptyCart);
        }
        settingsRef.current = next;
        setSettings(next);
        if (previous.speech && !next.speech) {
          speechRevision.current++;
          await Speech.stop().catch(() => {});
        }
      });
    settingsQueue.current = task;
    return task;
  }
  function updateSettings(patch: Partial<Settings>) {
    return queueSettings(() => patch);
  }
  function rememberSearch(term: string) {
    return queueSettings(({ saveRecentSearches, recentSearches = [] }) =>
      saveRecentSearches === false
        ? null
        : {
            recentSearches: [
              term,
              ...recentSearches.filter((item) => item.toLowerCase() !== term.toLowerCase()),
            ].slice(0, 8),
          },
    );
  }
  return {
    rememberSearch,
    api,
    savedPlaces: saved.base === api.base ? saved.places : [],
    savedPlacesReady: saved.base === api.base && saved.ready,
    savedPlacesError: saved.base === api.base ? saved.error : undefined,
    reloadSavedPlaces,
    toggleSaved: (store: Store) => changeSavedPlaces(store),
    pendingSubmission,
    recoverSubmission,
    helpState,
    checkout,
    setCheckout,
    ready,
    settings,
    saveSettings: updateSettings,
    updateSettings,
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
    getOrders,
    requestOrderHelp: async (id: string) =>
      exclusive(async () => {
        await api.orderHelp(id, await token());
        setOrder((current) =>
          current?.orderId === id ? { ...current, helpState: 'sent' } : current,
        );
      }),
    refresh,
    busy: busy || restoring,
    notice,
    announce,
    readAloud: (message: string) => announce(message, undefined, true),
    report,
    demo,
    repeat: () =>
      announce(
        notice || '갈지도에 오신 것을 환영합니다. 매장을 선택하고 메뉴를 살펴보세요.',
        feedback?.scope === cartScope ? cartScope : undefined,
        true,
      ),
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
    getOrder,
  };
}
const AppContext = createContext<ReturnType<typeof useAppState> | null>(null);
export function AppProvider({ path = '', children }: { path?: string; children: React.ReactNode }) {
  const state = useAppState(path);
  return <AppContext.Provider value={state}>{children}</AppContext.Provider>;
}
export function useApp() {
  const state = useContext(AppContext);
  if (!state) throw new Error('AppProvider is missing');
  return state;
}
