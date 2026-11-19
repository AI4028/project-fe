import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { ChevronRight, ReceiptText, ShoppingCart } from 'lucide-react-native';
import { Screen, NavLink } from '@/components/screen';
import { EmptyState, StatusBadge } from '@/components/brand';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Problem, SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { statusLabels, type Order, type Store } from '@/lib/types';
import { money } from '@/lib/cart';
import { errorMessage } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { isOpenOrder, orderStoreId } from '@/lib/order';

function HistoryCard({
  order,
  loadStore,
}: {
  order: Order;
  loadStore: (storeId?: string, kioskId?: string | null) => Promise<Store | undefined>;
}) {
  const { language } = useTranslation();
  const [store, setStore] = useState<Store>();
  const { kioskId, storeId } = order;
  useEffect(() => {
    let active = true;
    setStore(undefined);
    void loadStore(storeId, kioskId).then((value) => {
      if (active) setStore(value);
    });
    return () => {
      active = false;
    };
  }, [loadStore, kioskId, storeId]);
  const when = order.createdAtMs
    ? new Date(order.createdAtMs).toLocaleString(language === 'en' ? 'en-US' : 'ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : undefined;
  return (
    <Card className="py-4 shadow-none">
      <CardContent className="gap-3 px-4">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          {store ? (
            <Text variant="h3" translate={false} className="shrink">
              {(language === 'en' && store.nameEn) || store.name}
            </Text>
          ) : (
            <Text variant="h3">{`주문 번호 ${order.orderNumber}`}</Text>
          )}
          <StatusBadge selected={isOpenOrder(order)}>{statusLabels[order.status]}</StatusBadge>
        </View>
        <View className="flex-row flex-wrap gap-x-2">
          {store && <Text variant="muted">{`주문 번호 ${order.orderNumber}`}</Text>}
          {when && <Text variant="muted">{when}</Text>}
        </View>
        <View className="flex-row flex-wrap items-baseline justify-between gap-2">
          <Text translate={false} className="shrink">
            {order.lines?.length
              ? order.lines
                  .map((line) => `${(language === 'en' && line.nameEn) || line.name} × ${line.qty}`)
                  .join(' · ')
              : order.summary}
          </Text>
          <Text className="font-bold">{money(order.total)}</Text>
        </View>
        <NavLink
          href={{ pathname: '/orders/[orderId]', params: { orderId: order.orderId } }}
          icon={ChevronRight}
          className="flex-row-reverse justify-between"
        >
          주문 상세 보기
        </NavLink>
      </CardContent>
    </Card>
  );
}

export default function Orders() {
  const app = useApp();
  const [history, setHistory] = useState<{ base: string; orders: Order[] }>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const base = app.api.base;
  const loadStore = useMemo(() => {
    const stores = new Map<string, Promise<Store | undefined>>();
    return (storeId?: string, kioskId?: string | null) => {
      const key = storeId ? `store:${storeId}` : `kiosk:${kioskId ?? ''}`;
      const cached = stores.get(key);
      if (cached) return cached;
      const request = orderStoreId(app.api, storeId, kioskId)
        .then((id) => (id ? app.api.store(id) : undefined))
        .catch(() => {
          stores.delete(key);
          return undefined;
        });
      stores.set(key, request);
      return request;
    };
  }, [app.api]);
  useFocusEffect(
    useCallback(() => {
      if (!app.ready) return;
      let active = true;
      setLoading(true);
      setError('');
      void app
        .getOrders()
        .then((orders) => {
          if (active) setHistory({ base, orders });
        })
        .catch((reason) => {
          if (active) setError(errorMessage(reason));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [app.getOrders, app.ready, base, revision]),
  );
  const historyOrders = history?.base === base ? history.orders : [];
  const latest = app.order;
  const orders =
    latest && history?.base === base
      ? historyOrders.map((order) =>
          order.orderId === latest.orderId && (latest.updatedAtMs ?? 0) >= (order.updatedAtMs ?? 0)
            ? latest
            : order,
        )
      : historyOrders;
  const visibleOrders =
    latest && !orders.some((order) => order.orderId === latest.orderId)
      ? [latest, ...orders]
      : orders;

  return (
    <Screen title="주문내용" subtitle="장바구니 메뉴와 보낸 주문 상태를 확인하세요." voice={false}>
      <SubmissionRecovery />
      {app.connection && !app.pendingSubmission && (
        <Card className="py-4 shadow-none">
          <CardContent className="gap-3 px-4">
            <Text variant="h3">장바구니</Text>
            {app.store && <Text translate={false}>{app.store.name}</Text>}
            {app.items.length > 0 && <Text className="font-semibold">{money(app.cart.total)}</Text>}
            <NavLink href="/cart" icon={ShoppingCart}>
              장바구니 확인
            </NavLink>
          </CardContent>
        </Card>
      )}
      <Text variant="h2">보낸 주문 내역</Text>
      {!!error && (
        <Problem message={error} retry={() => setRevision((value) => value + 1)} busy={loading} />
      )}
      {loading && visibleOrders.length === 0 && (
        <Text accessibilityLiveRegion="polite">주문 내역을 확인하고 있어요.</Text>
      )}
      {visibleOrders.map((order) => (
        <HistoryCard key={order.orderId} order={order} loadStore={loadStore} />
      ))}
      {!loading && !error && visibleOrders.length === 0 && !app.pendingSubmission && (
        <EmptyState
          icon={ReceiptText}
          title="아직 보낸 주문이 없어요"
          description="홈에서 매장을 고르거나 큐알주문을 통해 첫 주문을 시작해 보세요."
        >
          <NavLink href="/">매장 찾으러 가기</NavLink>
        </EmptyState>
      )}
    </Screen>
  );
}
