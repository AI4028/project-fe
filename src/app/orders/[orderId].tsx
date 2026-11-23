import { paymentLabels } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CreditCard, HandHelping, MapPin, Navigation, RefreshCw } from 'lucide-react-native';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Problem } from '@/components/feedback';
import { OrderProgress } from '@/components/order-progress';
import { OrderLines, TotalRow } from '@/components/order-lines';
import { useApp } from '@/providers/app-provider';
import { type Order, type OrderStatus, type Store } from '@/lib/types';
import { money } from '@/lib/cart';
import { ApiError, errorMessage } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { isOpenOrder, orderStoreId } from '@/lib/order';
import { isKnown } from '@/lib/location';
import { CallStore } from '@/components/call-store';

const titles: Record<OrderStatus, string> = {
  submitted: '주문을 보냈어요',
  accepted: '매장에서 주문을 접수했어요',
  preparing: '메뉴를 준비하고 있어요',
  ready: '픽업 준비가 완료됐어요',
  picked_up: '픽업이 완료됐어요',
  cancelled: '주문이 취소되었어요',
};
const guidance: Record<OrderStatus, string> = {
  submitted: '매장에서 주문을 확인할 때까지 기다려 주세요.',
  accepted: '결제와 준비 순서는 직원 안내에 따라 주세요.',
  preparing: '주문이 준비되면 이 화면에서 확인할 수 있어요.',
  ready: '직원에게 주문 번호를 보여 주세요.',
  picked_up: '아직 메뉴를 받지 못했다면 직원에게 문의해 주세요.',
  cancelled: '이미 매장에서 결제했다면 환불 여부를 직원에게 확인해 주세요.',
};

export default function OrderScreen() {
  const { t, language } = useTranslation();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const app = useApp();
  // Start from the order just placed or tracked, so the heading screen readers
  // land on already names its status instead of a loading placeholder.
  const known = useRef<Order | null>(null);
  known.current = app.order?.orderId === orderId ? app.order : null;
  const [order, setOrder] = useState<Order | null>(known.current);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const sequence = useRef(0);
  const focus = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    try {
      const latest = await app.getOrder(orderId);
      if (request !== sequence.current) return;
      setOrder(latest);
      setCheckedAt(Date.now());
      setError('');
      return latest;
    } catch (reason) {
      if (request === sequence.current) setError(errorMessage(reason));
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [orderId, app.getOrder]);

  useFocusEffect(
    useCallback(() => {
      setOrder(known.current);
      setCheckedAt(null);
      setError('');
      setActionError('');
      setConfirm(false);
      setCancelling(false);
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
    }, [refresh]),
  );

  const orderStore = order?.storeId;
  const orderKiosk = order?.kioskId;
  useEffect(() => {
    let active = true;
    setStore(null);
    void orderStoreId(app.api, orderStore, orderKiosk)
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
  }, [orderStore, orderKiosk, app.api]);

  useEffect(() => {
    if (!confirm || cancelling || !order || order.status === 'submitted') return;
    setConfirm(false);
    if (isOpenOrder(order))
      setActionError('매장에서 이미 주문을 접수했어요. 직원에게 취소를 문의해 주세요.');
  }, [cancelling, confirm, order]);

  async function cancel() {
    if (cancelling || order?.status !== 'submitted') return;
    const visit = focus.current;
    setActionError('');
    setCancelling(true);
    try {
      const latest = await app.cancel(orderId);
      if (visit !== focus.current) return;
      sequence.current++;
      setLoading(false);
      setOrder(latest);
      setCheckedAt(Date.now());
      setError('');
      app.announce(guidance.cancelled);
    } catch (reason) {
      if (visit !== focus.current) return;
      setConfirm(false);
      const latest = await refresh();
      if (visit !== focus.current || latest?.status === 'cancelled') return;
      setActionError(
        reason instanceof ApiError && reason.code === 'too-late-to-cancel'
          ? '매장에서 이미 주문을 접수했어요. 직원에게 취소를 문의해 주세요.'
          : errorMessage(reason),
      );
    } finally {
      if (visit === focus.current) {
        setCancelling(false);
        setConfirm(false);
      }
    }
  }

  return (
    <Screen title={order ? titles[order.status] : '주문 상태'} voice={false} reading>
      {store && (
        <Text translate={false} variant="muted">
          {(language === 'en' && store.nameEn) || store.name}
        </Text>
      )}
      {loading && !order && (
        <Text accessibilityLiveRegion="polite">주문 상태를 확인하고 있습니다.</Text>
      )}
      {!!error && (
        <Problem
          message={`${t(error)} ${t(order ? '마지막으로 확인한 상태를 표시합니다.' : '확인 전에는 새 주문을 다시 제출하지 마세요.')}`}
          retry={() => void refresh()}
          busy={loading}
        />
      )}
      {!!actionError && <Problem message={actionError} />}
      {order && (
        <>
          <Card className="bg-secondary py-4 shadow-none">
            <CardContent className="items-center gap-1 px-4">
              <Text variant="muted" className="text-center">
                매장에 보여줄 주문 번호
              </Text>
              <Text
                className="text-[60px] font-bold leading-tight"
                accessibilityLabel={`주문 번호 ${order.orderNumber}`}
              >
                {order.orderNumber}
              </Text>
              {checkedAt && (
                // One text node, so VoiceOver reads the label and time together.
                <Text variant="muted" className="text-center" translate={false}>
                  {`${t('마지막 상태 확인:')} ${new Date(checkedAt).toLocaleTimeString(
                    language === 'en' ? 'en-US' : 'ko-KR',
                    { hour: 'numeric', minute: '2-digit' },
                  )}`}
                </Text>
              )}
            </CardContent>
          </Card>
          <OrderProgress status={order.status} />
          <Text accessibilityLiveRegion="polite">{guidance[order.status]}</Text>
          {order.status === 'cancelled' && order.cancelledBy === 'customer' && (
            <Text variant="muted">고객 요청으로 주문이 취소되었어요.</Text>
          )}
          {order.status === 'cancelled' && order.cancelledBy === 'staff' && (
            <Text variant="muted">매장에서 주문을 취소했어요.</Text>
          )}
          {(isOpenOrder(order) || order.simulatedApprovedAmount != null) && (
            <Card className="py-4 shadow-none">
              <CardContent className="gap-3 px-4">
                <View className="flex-row items-center gap-2">
                  <Icon as={CreditCard} size={20} className="text-primary" accessible={false} />
                  <Text variant="h4" className="shrink">
                    {order.simulatedApprovedAmount != null ? '모의 결제 내역' : '현장 결제 안내'}
                  </Text>
                </View>
                <Text className="font-semibold">{paymentLabels[order.paymentMethod]}</Text>
                {order.simulatedApprovedAmount != null ? (
                  <Text>
                    <Text>모의 승인 금액</Text> · {money(order.simulatedApprovedAmount)}
                  </Text>
                ) : (
                  <Text variant="muted">결제 여부는 직원에게 확인해 주세요.</Text>
                )}
              </CardContent>
            </Card>
          )}
          {order.status === 'ready' && (
            <Card className="py-4 shadow-none">
              <CardContent className="gap-3 px-4">
                <View className="flex-row items-center gap-2">
                  <Icon as={MapPin} size={20} className="text-primary" accessible={false} />
                  <Text variant="h4" className="shrink">
                    픽업 안내
                  </Text>
                </View>
                {isKnown(store?.pickupLocation) ? (
                  <Text accessibilityLiveRegion="polite">
                    <Text className="font-semibold">픽업 위치:</Text>{' '}
                    <Text translate={false}>{store.pickupLocation}</Text>
                  </Text>
                ) : (
                  <Text>픽업 위치는 매장 직원에게 확인해 주세요.</Text>
                )}
                {isKnown(store?.indoorDirections) && (
                  <Text variant="muted">
                    등록된 실내 안내: <Text translate={false}>{store.indoorDirections}</Text>
                  </Text>
                )}
              </CardContent>
            </Card>
          )}
          <Card className="py-4 shadow-none">
            <CardContent className="gap-3 px-4">
              <Text variant="h4">주문 메뉴 요약</Text>
              {order.lines?.length ? (
                <OrderLines lines={order.lines} />
              ) : (
                <Text translate={false}>{order.summary}</Text>
              )}
              <TotalRow total={order.total} />
              {!!order.note && (
                <Text>
                  요청 사항: <Text translate={false}>{order.note}</Text>
                </Text>
              )}
            </CardContent>
          </Card>
          <NavLink href={{ pathname: '/help', params: { orderId } }} icon={HandHelping}>
            {order.helpState === 'sent'
              ? '도움 요청 확인 대기 중'
              : order.helpState === 'acknowledged'
                ? '직원이 도움 요청을 확인했어요'
                : '직원 도움 요청'}
          </NavLink>
          <CallStore phone={store?.phone} />
          {order.status === 'submitted' && (
            <Button
              variant="outline"
              disabled={app.busy || loading || !!error}
              onPress={() => setConfirm(true)}
            >
              <Text>주문 취소 요청</Text>
            </Button>
          )}
        </>
      )}
      <Button variant="outline" disabled={loading || cancelling} onPress={() => void refresh()}>
        <Icon as={RefreshCw} size={18} accessible={false} />
        <Text>상태 새로고침</Text>
      </Button>
      {store && (
        <>
          <NavLink
            href={{ pathname: '/guide', params: { storeId: store.storeId } }}
            icon={Navigation}
          >
            길 안내
          </NavLink>
          <NavLink href={{ pathname: '/store', params: { storeId: store.storeId } }} icon={MapPin}>
            매장 정보 보기
          </NavLink>
        </>
      )}
      <NavLink href="/orders">보낸 주문 내역</NavLink>
      <Dialog
        open={confirm}
        onOpenChange={(open) => {
          if (!cancelling) setConfirm(open);
        }}
      >
        <DialogContent presentation="sheet">
          <DialogTitle>이 주문을 취소할까요?</DialogTitle>
          <DialogDescription>
            {`주문 ${order?.orderNumber ?? ''}번입니다. 매장이 먼저 접수하면 취소할 수 없습니다. 주문 취소와 환불은 별도입니다.`}
          </DialogDescription>
          <Button
            variant="destructive"
            disabled={cancelling || order?.status !== 'submitted'}
            onPress={() => void cancel()}
          >
            <Text>취소 요청 보내기</Text>
          </Button>
          <Button variant="outline" disabled={cancelling} onPress={() => setConfirm(false)}>
            <Text>유지하고 돌아가기</Text>
          </Button>
        </DialogContent>
      </Dialog>
    </Screen>
  );
}
