import { pickMenuPhoto } from '@/lib/pick-menu-photo';
import { CatalogThumbnail } from '@/components/catalog-thumbnail';
import { useTranslation } from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  Store as StoreIcon,
  Link2,
  ShoppingBag,
  ClipboardList,
  LogOut,
  ShieldCheck,
} from 'lucide-react-native';
import { IconTile, SectionHeading, StatusBadge } from '@/components/brand';
import { Icon } from '@/components/ui/icon';
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
  diningLabels,
  nextStatus,
  paymentLabels,
  statusLabels,
  type Heartbeat,
  type Order,
  type Session,
  type StaffHelpRequest,
  type Store,
} from '@/lib/types';
export default function Kiosk() {
  const app = useApp();
  const { t } = useTranslation();
  const [photoUploadsEnabled, setPhotoUploadsEnabled] = useState(false);
  const [credential, setCredential] = useState<{ base: string; key: string } | null>(null);
  const key = credential?.base === app.api.base ? credential.key : null;
  const setKey = (value: string | null) =>
    setCredential(value ? { base: app.api.base, key: value } : null);
  const [draft, setDraft] = useState('');
  const [heartbeat, setHeartbeat] = useState<Heartbeat | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [helpRequests, setHelpRequests] = useState<StaffHelpRequest[]>([]);
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
    setHelpRequests([]);
    setStore(null);
    setPhotoUploadsEnabled(false);
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
    setHelpRequests([]);
    setStore(null);
    setPhotoUploadsEnabled(false);
  }
  useEffect(() => {
    if (!key) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let refreshing = false;
    let refreshAgain = false;
    const fail = (error: unknown) => {
      if (!active) return;
      app.report(error);
      if (error instanceof ApiError && [401, 403].includes(error.status))
        void logout().catch(app.report);
    };
    async function refresh() {
      if (!active) return;
      if (refreshing) {
        refreshAgain = true;
        return;
      }
      refreshing = true;
      try {
        const state = await app.api.kioskState(key!);
        if (active) {
          setSession(state.session);
          setOrders(state.orders);
          setHelpRequests(state.helpRequests ?? []);
          setPhotoUploadsEnabled(!!state.photoUploadsEnabled);
          setStore(state.store);
        }
      } catch (error) {
        fail(error);
      } finally {
        refreshing = false;
        if (refreshAgain) {
          refreshAgain = false;
          void refresh();
        }
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
        const state = await app.api.kioskState(key);
        setOrders(state.orders);
        setSession(state.session);
        setHelpRequests(state.helpRequests ?? []);
        setStore(state.store);
      }
    } catch (error) {
      app.report(error);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function replacePhoto(itemId: string, kioskKey: string) {
    const photo = await pickMenuPhoto();
    if (!photo) return;
    await act(async () => {
      await app.api.uploadMenuPhoto(itemId, photo, kioskKey);
      app.announce('메뉴 사진을 변경했어요.');
    });
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
    <Screen
      title="매장 주문 관리"
      subtitle={store?.name ?? '고객 연결부터 주문 준비까지, 한곳에서 확인하세요.'}
      voice={false}
    >
      {!key ? (
        <Card className="w-full max-w-xl self-center">
          <CardContent className="gap-5">
            <IconTile icon={ShieldCheck} />
            <Text variant="h2">매장 직원으로 시작하기</Text>
            <Text variant="muted">
              매장에 발급된 비밀 키를 입력해 주세요. 고객용 연결 코드는 로그인 후 표시돼요.
            </Text>
            <Text className="font-bold">매장 키오스크 키</Text>
            <Input
              value={draft}
              onChangeText={setDraft}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="키오스크 비밀 키"
            />
            <Button disabled={busy || !draft.trim()} onPress={() => void act(login)}>
              <Icon as={StoreIcon} size={20} accessible={false} />
              <Text>키오스크 시작</Text>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <StatusBadge>
              {'진행 중인 주문 ' +
                orders.filter((order) => !['picked_up', 'cancelled'].includes(order.status))
                  .length +
                '건'}
            </StatusBadge>
            <Button variant="outline" onPress={() => void logout().catch(app.report)}>
              <Icon as={LogOut} size={20} accessible={false} />
              <Text>로그아웃 · 키 삭제</Text>
            </Button>
          </View>
          <View className="flex-row flex-wrap gap-5">
            <Card className="flex-1" style={{ flexBasis: 340 }}>
              <CardContent className="gap-4">
                <IconTile icon={Link2} />
                <Text variant="h3">휴대폰 연결</Text>
                {store?.orderingPaused ? (
                  <View className="gap-2 rounded-2xl border border-primary bg-secondary p-4">
                    <Text className="font-bold" accessibilityLiveRegion="polite">
                      휴대폰 주문 일시중지 중
                    </Text>
                    <Text variant="muted">
                      고객은 메뉴를 볼 수 있지만 새로 연결하거나 주문을 보낼 수 없어요.
                    </Text>
                  </View>
                ) : heartbeat && expires > 0 ? (
                  <>
                    <Text>{heartbeat.kioskId} · 연결 코드</Text>
                    <View className="rounded-2xl border border-primary bg-secondary p-4">
                      <Text className="font-mono text-3xl font-bold tracking-widest" selectable>
                        {heartbeat.token}
                      </Text>
                    </View>
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
                {store && (
                  <Button
                    variant={store.orderingPaused ? 'default' : 'outline'}
                    disabled={busy}
                    onPress={() => void act(() => app.api.ordering(!store.orderingPaused, key))}
                  >
                    <Text>
                      {store.orderingPaused ? '휴대폰 주문 다시 받기' : '휴대폰 주문 일시중지'}
                    </Text>
                  </Button>
                )}
              </CardContent>
            </Card>
            <Card className="flex-1" style={{ flexBasis: 340 }}>
              <CardContent className="gap-4">
                <IconTile icon={ShoppingBag} />
                <Text variant="h3">고객 장바구니</Text>
                {session ? (
                  <>
                    <Text>{session.cart.summary || '메뉴를 고르는 중입니다.'}</Text>
                    <Text variant="h2">{money(session.cart.total)}</Text>
                    {session.helpRequested && (
                      <>
                        <Text accessibilityLiveRegion="assertive">고객이 도움을 요청했습니다.</Text>
                        <Button
                          disabled={busy}
                          onPress={() =>
                            void act(() => app.api.resolveHelp(session.sessionId, key))
                          }
                        >
                          <Text>도움 요청 처리 완료</Text>
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      disabled={busy}
                      onPress={() =>
                        void act(() => app.api.endKioskSession(session.sessionId, key))
                      }
                    >
                      <Text>고객 연결 종료</Text>
                    </Button>
                  </>
                ) : (
                  <Text>연결된 고객이 없습니다.</Text>
                )}
              </CardContent>
            </Card>
          </View>
          {!!helpRequests.length && (
            <Card>
              <CardContent className="gap-4">
                <Text variant="h3" accessibilityLiveRegion="polite">
                  도움 요청
                </Text>
                {helpRequests.map((request) => (
                  <View
                    key={request.sessionId}
                    className="flex-row flex-wrap items-center justify-between gap-3"
                  >
                    <Text>
                      {request.orderNumber == null
                        ? '주문 전 고객의 도움 요청'
                        : `주문 번호 ${request.orderNumber} · 도움 요청`}
                    </Text>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onPress={() => void act(() => app.api.resolveHelp(request.sessionId, key))}
                    >
                      <Text>도움 요청 확인</Text>
                    </Button>
                  </View>
                ))}
              </CardContent>
            </Card>
          )}
          <SectionHeading
            title="오늘의 주문"
            detail={'전체 ' + orders.length + '건 · 서버에서 확인한 주문 상태예요.'}
          />
          {!orders.length && (
            <View className="items-center gap-4 rounded-3xl border border-border bg-card p-8">
              <IconTile icon={ClipboardList} />
              <Text>아직 접수된 주문이 없어요.</Text>
            </View>
          )}
          <View className="flex-row flex-wrap gap-4">
            {orders.map((order) => (
              <Card key={order.orderId} className="w-full md:w-[48%]">
                <CardContent className="gap-4">
                  <Text variant="h3">
                    #{order.orderNumber} · {statusLabels[order.status]}
                  </Text>
                  <Text>{order.summary}</Text>
                  {order.diningOption && (
                    <Text className="font-semibold">{diningLabels[order.diningOption]}</Text>
                  )}
                  <Text>
                    {money(order.total)} · {paymentLabels[order.paymentMethod]}
                    {order.simulatedApprovedAmount != null && <Text> · 모의 결제</Text>}
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
          </View>
          <SectionHeading
            title="메뉴 판매 상태"
            detail="품절로 표시하면 고객이 해당 메뉴를 주문할 수 없어요."
          />
          <Card>
            <CardContent className="gap-4">
              {store?.menu?.map((item) => (
                <View
                  key={item.id}
                  className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border pb-4"
                >
                  {photoUploadsEnabled && <CatalogThumbnail imageUrl={item.imageUrl} size={48} />}
                  <View className="gap-1">
                    <Text translate={false} className="font-bold">
                      {item.name}
                    </Text>
                    <Text variant="muted">{item.available ? '판매 중' : '품절'}</Text>
                  </View>
                  {photoUploadsEnabled && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      accessibilityLabel={`${item.name}, ${t('메뉴 사진 변경')}`}
                      onPress={() => void replacePhoto(item.id, key).catch(app.report)}
                    >
                      <Text>메뉴 사진 변경</Text>
                    </Button>
                  )}
                  <Button
                    disabled={busy}
                    variant={item.available ? 'outline' : 'secondary'}
                    onPress={() =>
                      void act(() => app.api.availability(item.id, !item.available, key))
                    }
                  >
                    <Text>{item.available ? '품절로 변경' : '판매 재개'}</Text>
                  </Button>
                </View>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </Screen>
  );
}
