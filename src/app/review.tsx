import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { ArrowRight, Check, Circle, CreditCard, MapPin, Store } from 'lucide-react-native';
import { Screen, NavLink } from '@/components/screen';
import { OrderLines } from '@/components/order-lines';
import { OrderProgress } from '@/components/order-progress';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { paymentLabels, type PaymentMethod } from '@/lib/types';
import { OrderingPaused, Problem, SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { money } from '@/lib/cart';
import { CartChangedError, errorMessage } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

export default function Review() {
  const app = useApp();
  const { language } = useTranslation();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [priceChange, setPriceChange] = useState<CartChangedError | null>(null);
  // The connection being submitted. If its result is lost, the app may recover
  // the order in the background; open it instead of leaving the stale error.
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    const order = app.order;
    if (!attempted.current || order?.sessionId !== attempted.current) return;
    attempted.current = null;
    setError('');
    router.replace({ pathname: '/orders/[orderId]', params: { orderId: order.orderId } });
  }, [app.order]);

  async function submit() {
    if (sending || app.pendingSubmission) return;
    setSending(true);
    setError('');
    setPriceChange(null);
    attempted.current = app.connection?.sessionId ?? null;
    try {
      const placed = await app.submit(app.checkout.payment, app.checkout.note);
      if (!attempted.current) return;
      attempted.current = null;
      router.replace({ pathname: '/orders/[orderId]', params: { orderId: placed.orderId } });
    } catch (reason) {
      if (reason instanceof CartChangedError) setPriceChange(reason);
      else setError(errorMessage(reason));
    } finally {
      setSending(false);
    }
  }

  const locked = sending || !!app.pendingSubmission;
  const checkedCart = priceChange?.after ?? app.cart;
  const title = sending
    ? '주문을 보내고 있어요'
    : app.pendingSubmission
      ? '주문 결과를 확인해 주세요'
      : priceChange
        ? '메뉴 가격이 바뀌었어요'
        : error
          ? '주문을 보내지 못했어요'
          : app.demo
            ? '결제하고 주문을 완료해요'
            : '주문 내용을 확인해 주세요';

  return (
    <Screen
      brandedHeader
      title={title}
      subtitle={
        !locked && !error && !priceChange
          ? app.demo
            ? '모의 결제입니다. 실제 요금은 청구되지 않아요.'
            : '주문을 보내고 매장에서 결제해 주세요.'
          : undefined
      }
      voice={false}
      reading
      footer={
        app.items.length > 0 && app.connection && !locked ? (
          <>
            <Button
              size="lg"
              className="w-full justify-between"
              disabled={app.busy || !!app.store?.orderingPaused}
              onPress={() => void submit()}
            >
              <Text>{money(checkedCart.total)}</Text>
              <Text className="shrink">
                {priceChange ? '변경된 금액으로 주문 보내기' : '주문 완료'}
              </Text>
              <Icon
                as={ArrowRight}
                size={19}
                className="text-primary-foreground"
                accessible={false}
              />
            </Button>
          </>
        ) : undefined
      }
    >
      {locked ? (
        <>
          <OrderProgress status="sending" />
          {sending ? (
            <Text accessibilityLiveRegion="polite">주문 전송 중입니다. 잠시 기다려 주세요.</Text>
          ) : (
            <>
              <SubmissionRecovery />
              <NavLink href="/help">직원에게 문의</NavLink>
            </>
          )}
        </>
      ) : (
        <>
          {app.store?.orderingPaused && <OrderingPaused />}
          {!!error && (
            <>
              <OrderProgress status="failed" />
              <Problem message={error} />
            </>
          )}
        </>
      )}
      {!locked && app.items.length > 0 && app.connection ? (
        <>
          <Card className="shadow-none">
            <CardContent className="gap-4 pt-6">
              <View className="flex-row items-start gap-3">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                  <Icon as={MapPin} size={20} className="text-primary" accessible={false} />
                </View>
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-sm font-semibold text-primary">주문 매장</Text>
                  <Text translate={false} variant="h3">
                    {(language === 'en' && app.store?.nameEn) || app.store?.name}
                  </Text>
                  {!!app.store?.address && (
                    <Text translate={false} variant="muted">
                      {app.store.address}
                    </Text>
                  )}
                </View>
              </View>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="gap-4 pt-6">
              <Text variant="h2">주문 메뉴</Text>
              {priceChange && (
                <View
                  className="gap-1 rounded-xl bg-secondary p-3"
                  accessibilityLiveRegion="polite"
                >
                  <Text className="font-bold">주문을 보내기 전 변경된 내용을 확인해 주세요.</Text>
                  <Text>변경 전 {money(priceChange.before.total)}</Text>
                  <Text className="font-bold">변경 후 {money(priceChange.after.total)}</Text>
                </View>
              )}
              <OrderLines lines={checkedCart.lines} />
              <View className="flex-row flex-wrap items-baseline justify-between gap-3 pt-1">
                <Text variant="h2">합계</Text>
                <Text variant="h2">{money(checkedCart.total)}</Text>
              </View>
              <Text variant="muted">매장에서 확인한 금액입니다.</Text>
            </CardContent>
          </Card>

          {app.demo && (
            <View className="gap-3">
              <View className="flex-row items-center gap-2">
                <Text variant="h2">결제 수단</Text>
              </View>
              <Text variant="muted">결제 수단을 하나 선택해 주세요.</Text>
              <View className="gap-2" accessibilityRole="radiogroup">
                {(
                  ['card', 'kakaopay', 'tosspay', 'naverpay', 'counter'] satisfies PaymentMethod[]
                ).map((payment) => {
                  const selected = app.checkout.payment === payment;
                  return (
                    <Button
                      key={payment}
                      variant={selected ? 'secondary' : 'outline'}
                      className={`min-h-14 w-full justify-between px-4 py-3 ${selected ? 'border border-primary' : ''}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={paymentLabels[payment]}
                      onPress={() => app.setCheckout({ ...app.checkout, payment })}
                    >
                      <View className="min-w-0 flex-1 flex-row items-center gap-3">
                        <Icon
                          as={payment === 'counter' ? Store : CreditCard}
                          size={21}
                          className="text-primary"
                          accessible={false}
                        />
                        <Text className="shrink font-semibold">{paymentLabels[payment]}</Text>
                      </View>
                      <View
                        className={`h-6 w-6 items-center justify-center rounded-full border border-primary ${selected ? 'bg-primary' : ''}`}
                      >
                        <Icon
                          as={selected ? Check : Circle}
                          size={selected ? 16 : 9}
                          className={selected ? 'text-primary-foreground' : 'text-primary'}
                          accessible={false}
                        />
                      </View>
                    </Button>
                  );
                })}
              </View>
            </View>
          )}

          <NavLink href="/cart">장바구니로 돌아가 수정</NavLink>
        </>
      ) : (
        !locked && (
          <Card className="shadow-none">
            <CardContent className="gap-3 pt-6">
              <Text variant="h3">제출할 장바구니가 없어요</Text>
              <Text variant="muted">메뉴를 선택한 뒤 다시 확인해 주세요.</Text>
              <NavLink href="/menu">메뉴 보기</NavLink>
            </CardContent>
          </Card>
        )
      )}
    </Screen>
  );
}
