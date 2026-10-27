import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useApp } from '@/providers/app-provider';
import { statusLabels, type Order } from '@/lib/types';
import { money } from '@/lib/cart';
export default function OrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const app = useApp();
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const current = app.order?.orderId === orderId ? app.order : order;
  const refresh = () => app.getOrder(orderId).then(setOrder).catch(app.report);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
  }, [orderId, app.api]);
  return (
    <Screen title={current ? `주문 번호 ${current.orderNumber}` : '주문 상태'}>
      {current && (
        <Card>
          <CardContent className="gap-4 pt-6">
            <Text variant="h2" accessibilityLiveRegion="polite">
              {statusLabels[current.status]}
            </Text>
            <Text>{current.summary}</Text>
            <Text variant="h3">{money(current.total)}</Text>
            <Text>
              {current.paymentMethod === 'counter' ? '카운터' : '키오스크'}에서 결제해 주세요.
            </Text>
            {!!current.note && <Text>요청 사항: {current.note}</Text>}
            {current.status === 'submitted' && (
              <Button
                variant="outline"
                disabled={busy}
                onPress={() => {
                  setBusy(true);
                  void app
                    .cancel(orderId)
                    .then(refresh)
                    .catch(app.report)
                    .finally(() => setBusy(false));
                }}
              >
                <Text>주문 취소</Text>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      <Button
        variant="secondary"
        onPress={() => {
          void refresh();
          void app.refresh().catch(app.report);
        }}
      >
        <Text>상태 새로고침</Text>
      </Button>
      <NavLink href="/">매장 화면으로</NavLink>
    </Screen>
  );
}
