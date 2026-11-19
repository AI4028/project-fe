import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Check, Clock, HandHelping, MessageCircle } from 'lucide-react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { IconTile } from '@/components/brand';
import { Icon } from '@/components/ui/icon';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Problem } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { errorMessage } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { isOpenOrder, orderStoreId } from '@/lib/order';
import type { Order, Store } from '@/lib/types';

export default function Help() {
  const app = useApp();
  const { language } = useTranslation();
  const { storeId, orderId } = useLocalSearchParams<{ storeId?: string; orderId?: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [orderError, setOrderError] = useState('');
  const [actionError, setActionError] = useState('');
  const [revision, setRevision] = useState(0);
  const [sending, setSending] = useState(false);
  const focus = useRef(0);
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    if (!orderId) return;
    const request = ++sequence.current;
    try {
      const latest = await app.getOrder(orderId);
      if (request !== sequence.current) return;
      setOrder(latest);
      setOrderError('');
    } catch (reason) {
      if (request === sequence.current) setOrderError(errorMessage(reason));
    }
  }, [orderId, app.getOrder]);

  useFocusEffect(
    useCallback(() => {
      setOrder(null);
      setOrderError('');
      setActionError('');
      setSending(false);
      if (!orderId) return;
      let active = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const poll = async () => {
        await refresh();
        if (active) timer = setTimeout(() => void poll(), 10000);
      };
      void poll();
      return () => {
        active = false;
        focus.current++;
        sequence.current++;
        if (timer !== undefined) clearTimeout(timer);
      };
    }, [orderId, refresh]),
  );

  const linkedStore = orderId
    ? order?.storeId
    : storeId || app.connection?.storeId || app.store?.storeId;
  const linkedKiosk = orderId ? order?.kioskId : undefined;
  useEffect(() => {
    let active = true;
    setStore(null);
    void orderStoreId(app.api, linkedStore, linkedKiosk)
      .then(async (id) => {
        if (id && active) {
          const value = await app.api.store(id);
          if (active) setStore(value);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [app.api, linkedStore, linkedKiosk, revision]);

  const canRequest = orderId
    ? !!order && isOpenOrder(order) && !orderError
    : !!app.connection &&
      !app.pendingSubmission &&
      (!storeId || storeId === app.connection.storeId);
  const state = orderId ? (order?.helpState ?? 'idle') : canRequest ? app.helpState : 'idle';
  const waiting = state === 'sent';
  const acknowledged = state === 'acknowledged';

  async function requestHelp() {
    if (!canRequest || sending || waiting) return;
    const visit = focus.current;
    setSending(true);
    setActionError('');
    try {
      if (orderId) {
        await app.requestOrderHelp(orderId);
        if (visit !== focus.current) return;
        setOrder((current) =>
          current?.orderId === orderId ? { ...current, helpState: 'sent' } : current,
        );
        await refresh();
      } else await app.help();
    } catch (reason) {
      if (visit !== focus.current) return;
      setActionError(errorMessage(reason));
      if (orderId) await refresh();
    } finally {
      if (visit === focus.current) setSending(false);
    }
  }

  return (
    <Screen
      title="직원 도움이 필요하신가요?"
      subtitle="방문·주문·픽업에 필요한 도움을 요청할 수 있어요."
      voice={false}
      reading
    >
      {(store || order) && (
        <Card className="py-4 shadow-none">
          <CardContent className="gap-2 px-4">
            {store && (
              <>
                <Text translate={false} className="font-bold">
                  {(language === 'en' && store.nameEn) || store.name}
                </Text>
                {!!store.address && (
                  <Text translate={false} variant="muted">
                    {store.address}
                  </Text>
                )}
              </>
            )}
            {order && <Text variant="h3">{`주문 번호 ${order.orderNumber}`}</Text>}
          </CardContent>
        </Card>
      )}
      {orderId && !order && !orderError && (
        <Text accessibilityLiveRegion="polite">주문 상태를 확인하고 있습니다.</Text>
      )}
      {!!orderError && (
        <Problem
          message={orderError}
          retry={() => {
            void refresh();
            setRevision((value) => value + 1);
          }}
        />
      )}
      {!!actionError && <Problem message={actionError} />}
      {(waiting || acknowledged) && (
        <Card className="border-0 bg-secondary py-4 shadow-none">
          <CardContent className="gap-2 px-4">
            <View className="flex-row items-start gap-2">
              <Icon
                as={waiting ? Clock : Check}
                size={20}
                className="mt-1 text-primary"
                accessible={false}
              />
              <Text variant="h4" className="flex-1" accessibilityLiveRegion="polite">
                {waiting ? '도움 요청을 보냈어요' : '직원이 도움 요청을 확인했어요'}
              </Text>
            </View>
            <Text>
              {waiting
                ? '직원 확인을 기다리고 있어요.'
                : '도움이 더 필요하면 직원에게 말씀해 주세요.'}
            </Text>
          </CardContent>
        </Card>
      )}
      {canRequest && !waiting && (
        <Button disabled={app.busy || sending} onPress={() => void requestHelp()}>
          <Icon as={HandHelping} size={19} className="text-primary-foreground" accessible={false} />
          <Text className="shrink text-center">
            {sending
              ? '도움 요청을 보내고 있어요'
              : acknowledged
                ? '다시 도움 요청하기'
                : '앱으로 직원 도움 요청하기'}
          </Text>
        </Button>
      )}
      <Card className="py-4 shadow-none">
        <CardContent className="gap-3 px-4">
          <IconTile icon={MessageCircle} />
          <Text variant="h3">직원에게 직접 문의하기</Text>
          <Text>급하거나 앱에서 요청하기 어렵다면 주변 직원에게 직접 말씀해 주세요.</Text>
          <Text variant="muted">
            {orderId
              ? '“휴대폰으로 주문했습니다. 주문 상태, 취소 또는 픽업 안내를 도와주세요.”'
              : '“휴대폰 주문을 도와주세요.”'}
          </Text>
        </CardContent>
      </Card>
      {orderId ? (
        <NavLink href={{ pathname: '/orders/[orderId]', params: { orderId } }}>
          주문으로 돌아가기
        </NavLink>
      ) : (
        <NavLink
          href={linkedStore ? { pathname: '/store', params: { storeId: linkedStore } } : '/'}
        >
          {linkedStore ? '매장 정보로 돌아가기' : '매장 찾기로'}
        </NavLink>
      )}
    </Screen>
  );
}
