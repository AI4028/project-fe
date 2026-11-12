import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Check, Clock3, RefreshCw } from 'lucide-react-native';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { ConfirmAction, Problem } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { statusLabels, type Order, type OrderStatus, type Store } from '@/lib/types';
import { money } from '@/lib/cart';
import { errorMessage } from '@/lib/api';
import { knownText } from '@/lib/location';
const guidance = {
  submitted:
    '주문을 전송했습니다. 매장에서 아직 접수하지 않았습니다. 기다리거나 직원에게 주문 번호를 보여 주세요.',
  accepted: '매장에서 주문을 접수했습니다. 결제와 준비 순서는 직원 안내에 따라 주세요.',
  preparing: '매장에서 준비 중입니다. 기다리기 어렵거나 도움이 필요하면 직원에게 문의해 주세요.',
  ready: '준비가 끝났습니다. 주문 번호를 확인하고 직원에게 픽업 위치를 안내받으세요.',
  picked_up: '매장에서 수령 완료로 처리했습니다. 실제로 받지 못했다면 직원에게 문의해 주세요.',
  cancelled: '주문이 취소되었습니다. 취소 사유나 결제·환불 여부는 직원에게 확인해 주세요.',
};
const stages: OrderStatus[] = ['submitted', 'accepted', 'preparing', 'ready', 'picked_up'];

export default function OrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const app = useApp();
  const [order, setOrder] = useState<Order | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    try {
      const latest = await app.getOrder(orderId);
      if (request !== sequence.current) return;
      setOrder(latest);
      setCheckedAt(Date.now());
      setError('');
    } catch (reason) {
      if (request === sequence.current) setError(errorMessage(reason));
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [orderId, app.api]);
  useFocusEffect(
    useCallback(() => {
      setOrder(null);
      setCheckedAt(null);
      setError('');
      let active = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const poll = async () => {
        await refresh();
        if (active) timer = setTimeout(() => void poll(), 10000);
      };
      void poll();
      return () => {
        active = false;
        sequence.current++;
        if (timer !== undefined) clearTimeout(timer);
      };
    }, [refresh]),
  );
  useEffect(() => {
    let active = true;
    setStore(null);
    if (order?.kioskId)
      void app.api
        .kioskInfo(order.kioskId)
        .then((kiosk) => app.api.store(kiosk.storeId))
        .then((value) => {
          if (active) setStore(value);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [order?.kioskId, app.api]);
  async function cancel() {
    setActionError('');
    try {
      const latest = await app.cancel(orderId);
      sequence.current++;
      setLoading(false);
      setOrder(latest);
      setCheckedAt(Date.now());
      setError('');
      app.announce('주문이 취소되었습니다. 결제·환불 여부는 직원에게 확인해 주세요.');
    } catch (reason) {
      setActionError(errorMessage(reason));
      await refresh();
    } finally {
      setConfirm(false);
    }
  }
  return (
    <Screen title={order ? `주문 번호 ${order.orderNumber}` : '주문 상태'} voice={false}>
      {loading && !order && <Text>주문 상태를 확인하고 있습니다.</Text>}
      {!!error && (
        <Problem
          message={`${error} ${order ? '마지막으로 확인한 상태를 표시합니다.' : '확인 전에는 새 주문을 다시 제출하지 마세요.'}`}
          retry={() => void refresh()}
          busy={loading}
        />
      )}
      {!!actionError && <Problem message={actionError} />}
      {order && (
        <>
          <Card className="border-0 bg-secondary shadow-none">
            <CardContent className="gap-4 pt-6">
              {store && (
                <>
                  <Text>{store.name}</Text>
                  <Text>{store.address}</Text>
                </>
              )}
              <Text variant="h2" accessibilityLiveRegion="polite">
                {statusLabels[order.status]}
              </Text>
              <Text>{guidance[order.status]}</Text>
              {checkedAt && (
                <Text variant="muted">
                  마지막 상태 확인: {new Date(checkedAt).toLocaleTimeString('ko-KR')}
                </Text>
              )}
              <Text>{order.summary}</Text>
              <Text variant="h3">{money(order.total)}</Text>
              {!!order.note && <Text>요청 사항: {order.note}</Text>}
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="gap-4 pt-6">
              <Text variant="h2">진행 상황</Text>
              {order.status === 'cancelled' ? (
                <View className="gap-2 rounded-xl bg-secondary p-4">
                  <Text className="font-semibold">주문 취소</Text>
                  <Text>이 주문은 더 이상 진행되지 않아요.</Text>
                </View>
              ) : (
                stages.map((status, index) => {
                  const activeIndex = stages.indexOf(order.status);
                  const complete = index < activeIndex;
                  const current = index === activeIndex;
                  return (
                    <View key={status} className="flex-row items-start gap-3">
                      <View
                        className={
                          'h-10 w-10 items-center justify-center rounded-full ' +
                          (complete || current ? 'bg-primary' : 'bg-muted')
                        }
                      >
                        {complete ? (
                          <Icon as={Check} size={19} className="text-primary-foreground" />
                        ) : current ? (
                          <Icon as={Clock3} size={19} className="text-primary-foreground" />
                        ) : (
                          <Text className="font-semibold text-muted-foreground">{index + 1}</Text>
                        )}
                      </View>
                      <View
                        className={
                          'min-w-0 flex-1 gap-1 ' +
                          (index < stages.length - 1 ? 'border-b border-border pb-4' : '')
                        }
                      >
                        <Text
                          className={
                            current
                              ? 'font-bold text-primary'
                              : complete
                                ? 'font-semibold'
                                : 'text-muted-foreground'
                          }
                        >
                          {statusLabels[status]}
                        </Text>
                        {current && <Text variant="muted">현재 단계</Text>}
                      </View>
                    </View>
                  );
                })
              )}
            </CardContent>
          </Card>
          {order.status !== 'cancelled' && (
            <>
              <Text variant="h2">결제 안내</Text>
              <Text>
                선택한 결제 장소: {order.paymentMethod === 'counter' ? '카운터' : '키오스크'}. 실제
                결제 여부는 앱에서 확인할 수 없습니다. 이미 결제했다면 다시 결제하지 말고 직원에게
                확인해 주세요.
              </Text>
            </>
          )}
          {order.status === 'ready' && (
            <>
              <Text variant="h2">픽업 안내</Text>
              <Text>전용 픽업 위치: 직원 확인 필요</Text>
              <Text>등록된 실내 안내: {knownText(store?.indoorDirections)}</Text>
              <Text>
                준비 완료는 수령 완료와 다릅니다. 이동이나 수령이 어렵다면 직원에게 도움을 요청해
                주세요.
              </Text>
            </>
          )}
          {order.status === 'submitted' ? (
            <Button
              variant="outline"
              disabled={app.busy || loading || !!error}
              onPress={() => setConfirm(true)}
            >
              <Text>주문 취소 요청</Text>
            </Button>
          ) : (
            order.status !== 'cancelled' &&
            order.status !== 'picked_up' && (
              <Text>접수된 주문은 앱에서 직접 취소할 수 없습니다. 직원에게 문의해 주세요.</Text>
            )
          )}
          <NavLink href={{ pathname: '/help', params: { orderId } }}>
            주문 · 취소 · 픽업 도움
          </NavLink>
        </>
      )}
      <Button variant="secondary" disabled={loading} onPress={() => void refresh()}>
        <Icon as={RefreshCw} size={18} />
        <Text>상태 새로고침</Text>
      </Button>
      <NavLink href="/">매장 찾기로</NavLink>
      <ConfirmAction
        open={confirm}
        onOpenChange={setConfirm}
        title="이 주문을 취소할까요?"
        label="취소 요청 보내기"
        description={`주문 ${order?.orderNumber ?? ''}번입니다. 매장이 먼저 접수하면 취소할 수 없습니다. 주문 취소와 환불은 별도입니다.`}
        busy={app.busy}
        onConfirm={() => void cancel()}
      />
    </Screen>
  );
}
