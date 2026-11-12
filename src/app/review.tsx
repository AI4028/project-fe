import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { ArrowRight, Check, CreditCard, MapPin, MessageSquareText } from 'lucide-react-native';
import { Screen, NavLink } from '@/components/screen';
import { OrderSteps } from '@/components/brand';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Problem, SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { money } from '@/lib/cart';
import { errorMessage } from '@/lib/api';

export default function Review() {
  const app = useApp();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSending(true);
    setError('');
    try {
      const placed = await app.submit(app.checkout.payment, app.checkout.note);
      router.replace({ pathname: '/orders/[orderId]', params: { orderId: placed.orderId } });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen
      title="주문 최종 확인"
      subtitle="메뉴와 금액을 확인한 뒤 주문을 보내 주세요."
      voice={false}
    >
      <OrderSteps current={3} />
      {sending ? (
        <Text accessibilityLiveRegion="polite">주문 전송 중입니다. 잠시 기다려 주세요.</Text>
      ) : (
        <SubmissionRecovery />
      )}
      {!!error && <Problem message={error} />}
      {app.items.length && app.connection ? (
        <>
          <Card className="shadow-none">
            <CardContent className="gap-4 pt-6">
              <View className="flex-row items-start gap-3">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                  <Icon as={MapPin} size={20} className="text-primary" />
                </View>
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-sm font-semibold text-primary">주문 매장</Text>
                  <Text variant="h3">{app.store?.name}</Text>
                  {!!app.store?.address && <Text variant="muted">{app.store.address}</Text>}
                </View>
              </View>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="gap-4 pt-6">
              <Text variant="h2">주문 메뉴</Text>
              {app.cart.lines.map((line, i) => (
                <View key={i} className="gap-1 border-b border-border pb-4">
                  <View className="flex-row flex-wrap justify-between gap-2">
                    <Text className="font-semibold">
                      {line.name} · {line.qty}개
                    </Text>
                    <Text className="font-semibold">{money(line.lineTotal)}</Text>
                  </View>
                  <Text variant="muted">
                    {line.options.map((choice) => choice.choiceName).join(' · ') ||
                      '추가 옵션 없음'}
                  </Text>
                </View>
              ))}
              <View className="flex-row flex-wrap items-baseline justify-between gap-3 pt-1">
                <Text variant="h2">합계</Text>
                <Text variant="h2">{money(app.cart.total)}</Text>
              </View>
              <Text variant="muted">매장에서 확인한 금액입니다.</Text>
            </CardContent>
          </Card>

          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Icon as={CreditCard} size={21} className="text-primary" />
              <Text variant="h2">결제 장소</Text>
            </View>
            <Text variant="muted">앱에서는 결제하지 않아요. 직원 안내에 따라 결제해 주세요.</Text>
            <View className="gap-2" accessibilityRole="radiogroup">
              {(['counter', 'kiosk'] as const).map((payment) => {
                const selected = app.checkout.payment === payment;
                return (
                  <Button
                    key={payment}
                    variant={selected ? 'secondary' : 'outline'}
                    className="min-h-14 w-full justify-between px-4 py-3"
                    disabled={sending || !!app.pendingSubmission}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => app.setCheckout({ ...app.checkout, payment })}
                  >
                    <Text className="font-semibold">
                      {payment === 'counter' ? '카운터에서 결제' : '키오스크에서 결제'}
                    </Text>
                    {selected && <Icon as={Check} size={20} className="text-primary" />}
                  </Button>
                );
              })}
            </View>
          </View>

          <Card className="shadow-none">
            <CardContent className="gap-3 pt-6">
              <View className="flex-row items-center gap-2">
                <Icon as={MessageSquareText} size={20} className="text-primary" />
                <Text variant="h2">요청 사항</Text>
              </View>
              <Text variant="muted">필요한 내용만 적어 주세요. 선택 사항 · 최대 200자</Text>
              <Input
                accessibilityLabel="주문 요청 사항"
                placeholder="예: 컵 홀더가 필요해요"
                value={app.checkout.note}
                maxLength={200}
                editable={!sending && !app.pendingSubmission}
                onChangeText={(note) => app.setCheckout({ ...app.checkout, note })}
              />
            </CardContent>
          </Card>

          <Button
            size="lg"
            className="w-full justify-between"
            disabled={app.busy || sending || !!app.pendingSubmission}
            onPress={() => void submit()}
          >
            <Text>{sending ? '전송 중' : '이 내용으로 주문 제출'}</Text>
            <Icon as={ArrowRight} size={19} className="text-primary-foreground" />
          </Button>
          <NavLink href="/cart">장바구니로 돌아가 수정</NavLink>
        </>
      ) : (
        !app.pendingSubmission && (
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
