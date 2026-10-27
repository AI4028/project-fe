import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Linking from 'expo-linking';
import QRCode from 'react-native-qrcode-svg';
import { Screen } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useApp } from '@/providers/app-provider';
import { ApiError } from '@/lib/api';
import { subscribe } from '@/lib/live';
import { secrets } from '@/lib/storage';
import { money } from '@/lib/cart';
import {
  nextStatus,
  statusLabels,
  type Heartbeat,
  type Order,
  type Session,
  type Store,
} from '@/lib/types';
export default function Kiosk() {
  const app = useApp();
  const [credential, setCredential] = useState<{ base: string; key: string } | null>(null);
  const key = credential?.base === app.api.base ? credential.key : null;
  const setKey = (value: string | null) =>
    setCredential(value ? { base: app.api.base, key: value } : null);
  const [draft, setDraft] = useState('');
  const [heartbeat, setHeartbeat] = useState<Heartbeat | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const actionLock = useRef(false);
  useEffect(() => {
    let active = true;
    setKey(null);
    setHeartbeat(null);
    setSession(null);
    setOrders([]);
    setStore(null);
    void secrets
      .get(app.api.base, 'kiosk')
      .then((value) => {
        if (active) setKey(value);
      })
      .catch(app.report);
    return () => {
      active = false;
    };
  }, [app.api]);
  async function logout() {
    await secrets.set(app.api.base, 'kiosk', null);
    setKey(null);
    setDraft('');
    setHeartbeat(null);
    setSession(null);
    setOrders([]);
    setStore(null);
  }
  useEffect(() => {
    if (!key) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let refreshing = false;
    const fail = (error: unknown) => {
      if (!active) return;
      app.report(error);
      if (error instanceof ApiError && [401, 403].includes(error.status))
        void logout().catch(app.report);
    };
    async function refresh() {
      if (refreshing || !active) return;
      refreshing = true;
      try {
        const [current, list] = await Promise.all([
          app.api.kioskSession(key!),
          app.api.kioskOrders(key!),
        ]);
        if (active) {
          setSession(current);
          setOrders(list);
        }
      } catch (error) {
        fail(error);
      } finally {
        refreshing = false;
      }
    }
    async function beat() {
      let delay = 10000;
      try {
        const result = await app.api.heartbeat(key!);
        if (!active) return;
        setHeartbeat(result);
        delay = Math.max(1000, result.refreshInMs);
        const kiosk = await app.api.kioskInfo(result.kioskId);
        const info = await app.api.store(kiosk.storeId);
        if (active) setStore(info);
      } catch (error) {
        fail(error);
      }
      if (active) timer = setTimeout(() => void beat(), delay);
    }
    void beat();
    void refresh();
    const stop = subscribe(
      app.api.wsUrl('/ws/kiosk', key),
      () => void refresh(),
      () => void refresh(),
      () => void logout().catch(app.report),
    );
    const poll = setInterval(() => void refresh(), 10000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(poll);
      clearInterval(clock);
      stop();
    };
  }, [key, app.api]);
  async function act(action: () => Promise<unknown>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      await action();
      if (key) {
        setOrders(await app.api.kioskOrders(key));
        setSession(await app.api.kioskSession(key));
        if (store) setStore(await app.api.store(store.storeId));
      }
    } catch (error) {
      app.report(error);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function login() {
    const candidate = draft.trim();
    await app.api.heartbeat(candidate);
    await secrets.set(app.api.base, 'kiosk', candidate);
    setKey(candidate);
    setDraft('');
  }
  const expires = heartbeat ? Math.max(0, Math.ceil((heartbeat.expiresAtMs - now) / 1000)) : 0;
  const pairingUrl = heartbeat
    ? Linking.createURL('/connect', {
        queryParams: { kioskId: heartbeat.kioskId, token: heartbeat.token },
      })
    : '';
  return (
    <Screen title="매장 키오스크" subtitle={store?.name ?? '직원용 실시간 주문 화면'} voice={false}>
      {!key ? (
        <Card>
          <CardContent className="gap-3 pt-6">
            <Text>매장 키오스크 키</Text>
            <Input
              value={draft}
              onChangeText={setDraft}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="키오스크 비밀 키"
            />
            <Button disabled={busy || !draft.trim()} onPress={() => void act(login)}>
              <Text>키오스크 시작</Text>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Button variant="outline" onPress={() => void logout().catch(app.report)}>
            <Text>로그아웃 · 키 삭제</Text>
          </Button>
          <Card>
            <CardContent className="gap-4 pt-6">
              <Text variant="h3">휴대폰 연결</Text>
              {heartbeat && expires > 0 ? (
                <>
                  <Text>{heartbeat.kioskId} · 연결 코드</Text>
                  <Text className="font-mono text-3xl font-bold" selectable>
                    {heartbeat.token}
                  </Text>
                  <Text>남은 시간 {expires}초</Text>
                  <View
                    className="self-start bg-white p-4"
                    accessible
                    accessibilityLabel="휴대폰 연결 QR 코드. 위 연결 코드를 직접 입력할 수도 있습니다."
                  >
                    <QRCode value={pairingUrl} size={180} />
                  </View>
                </>
              ) : (
                <Text>연결 코드를 갱신하는 중입니다. 네트워크를 확인해 주세요.</Text>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="gap-3 pt-6">
              <Text variant="h3">고객 장바구니</Text>
              {session ? (
                <>
                  <Text>{session.cart.summary || '메뉴를 고르는 중입니다.'}</Text>
                  <Text>{money(session.cart.total)}</Text>
                  {session.helpRequested && (
                    <>
                      <Text accessibilityLiveRegion="assertive">고객이 도움을 요청했습니다.</Text>
                      <Button
                        disabled={busy}
                        onPress={() => void act(() => app.api.resolveHelp(session.sessionId, key))}
                      >
                        <Text>도움 요청 처리 완료</Text>
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    disabled={busy}
                    onPress={() => void act(() => app.api.endKioskSession(session.sessionId, key))}
                  >
                    <Text>고객 연결 종료</Text>
                  </Button>
                </>
              ) : (
                <Text>연결된 고객이 없습니다.</Text>
              )}
            </CardContent>
          </Card>
          <Text variant="h2">오늘의 주문</Text>
          {!orders.length && <Text>접수된 주문이 없습니다.</Text>}
          {orders.map((order) => (
            <Card key={order.orderId}>
              <CardContent className="gap-3 pt-6">
                <Text variant="h3">
                  #{order.orderNumber} · {statusLabels[order.status]}
                </Text>
                <Text>{order.summary}</Text>
                <Text>
                  {money(order.total)} ·{' '}
                  {order.paymentMethod === 'counter' ? '카운터 결제' : '키오스크 결제'}
                </Text>
                {!!order.note && <Text>요청 사항: {order.note}</Text>}
                {nextStatus[order.status] && (
                  <Button
                    disabled={busy}
                    onPress={() =>
                      void act(() =>
                        app.api.setStatus(order.orderId, nextStatus[order.status]!, key),
                      )
                    }
                  >
                    <Text>{statusLabels[nextStatus[order.status]!]}</Text>
                  </Button>
                )}
                {['submitted', 'accepted'].includes(order.status) && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onPress={() =>
                      void act(() => app.api.setStatus(order.orderId, 'cancelled', key))
                    }
                  >
                    <Text>주문 취소</Text>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          <Text variant="h2">메뉴 판매 상태</Text>
          {store?.menu?.map((item) => (
            <View key={item.id} className="flex-row flex-wrap items-center justify-between gap-3">
              <Text>{item.name}</Text>
              <Button
                disabled={busy}
                variant={item.available ? 'outline' : 'secondary'}
                onPress={() => void act(() => app.api.availability(item.id, !item.available, key))}
              >
                <Text>{item.available ? '품절로 변경' : '판매 재개'}</Text>
              </Button>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}
