import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useApp } from '@/providers/app-provider';
import { money } from '@/lib/cart';
export default function CartScreen() {
  const app = useApp();
  const [payment, setPayment] = useState<'counter' | 'kiosk'>('counter');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  async function submit() {
    try {
      const order = await app.submit(payment, note);
      setConfirm(false);
      router.replace({ pathname: '/orders/[orderId]', params: { orderId: order.orderId } });
    } catch (error) {
      app.report(error);
      setConfirm(false);
      void app.refresh().catch(app.report);
    }
  }
  return (
    <Screen
      title="장바구니"
      subtitle="주문 내용과 결제 장소를 확인해 주세요."
      onTranscript={(text) => {
        if (/주문|결제/.test(text)) {
          if (app.items.length) {
            setConfirm(true);
            app.announce(`합계 ${money(app.cart.total)}입니다. 주문 확인 버튼을 눌러 주세요.`);
          }
          return true;
        }
        return false;
      }}
    >
      {!app.items.length ? (
        <>
          <Text>장바구니가 비어 있습니다.</Text>
          <NavLink href="/menu">메뉴 보러 가기</NavLink>
        </>
      ) : (
        <>
          {app.cart.lines.map((line, index) => (
            <Card key={`${line.itemId}-${index}`}>
              <CardContent className="gap-3 pt-6">
                <Text variant="h3">{line.name}</Text>
                <Text>{line.options.map((option) => option.choiceName).join(' · ')}</Text>
                <Text>
                  {line.qty}개 · {money(line.lineTotal)}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={app.busy || line.qty <= 1}
                    accessibilityLabel={`${line.name} 수량 줄이기`}
                    onPress={() =>
                      void app
                        .updateCart(
                          app.items.map((item, i) =>
                            i === index ? { ...item, qty: item.qty - 1 } : item,
                          ),
                        )
                        .catch(app.report)
                    }
                  >
                    <Text>−</Text>
                  </Button>
                  <Button
                    variant="outline"
                    disabled={app.busy || line.qty >= 10}
                    accessibilityLabel={`${line.name} 수량 늘리기`}
                    onPress={() =>
                      void app
                        .updateCart(
                          app.items.map((item, i) =>
                            i === index ? { ...item, qty: item.qty + 1 } : item,
                          ),
                        )
                        .catch(app.report)
                    }
                  >
                    <Text>+</Text>
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={app.busy}
                    accessibilityLabel={`${line.name} 삭제`}
                    onPress={() =>
                      void app.updateCart(app.items.filter((_, i) => i !== index)).catch(app.report)
                    }
                  >
                    <Text>삭제</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          ))}
          <Text variant="h3">합계 {money(app.cart.total)}</Text>
          <View className="flex-row flex-wrap gap-2">
            {(['counter', 'kiosk'] as const).map((value) => (
              <Button
                key={value}
                variant={payment === value ? 'default' : 'outline'}
                accessibilityRole="radio"
                accessibilityState={{ checked: payment === value }}
                onPress={() => setPayment(value)}
              >
                <Text>{value === 'counter' ? '카운터에서 결제' : '키오스크에서 결제'}</Text>
              </Button>
            ))}
          </View>
          <Text>요청 사항 (최대 200자)</Text>
          <Input
            value={note}
            onChangeText={setNote}
            maxLength={200}
            accessibilityLabel="주문 요청 사항"
          />
          <Button disabled={app.busy} onPress={() => setConfirm(true)}>
            <Text>주문 내용 확인</Text>
          </Button>
          <Dialog open={confirm} onOpenChange={setConfirm}>
            <DialogContent>
              <DialogTitle>주문하시겠어요?</DialogTitle>
              <DialogDescription>
                {app.cart.summary}. 합계 {money(app.cart.total)}.{' '}
                {payment === 'counter' ? '카운터' : '키오스크'}에서 결제해 주세요.
              </DialogDescription>
              <Button disabled={app.busy} onPress={() => void submit()}>
                <Text>주문 확인</Text>
              </Button>
              <Button variant="outline" disabled={app.busy} onPress={() => setConfirm(false)}>
                <Text>돌아가기</Text>
              </Button>
            </DialogContent>
          </Dialog>
        </>
      )}
      {app.order && (
        <NavLink href={{ pathname: '/orders/[orderId]', params: { orderId: app.order.orderId } }}>
          최근 주문 상태
        </NavLink>
      )}
    </Screen>
  );
}
