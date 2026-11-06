import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
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
      subtitle="매장, 옵션, 수량과 금액을 확인해 주세요."
      voice={false}
    >
      {sending ? (
        <Text accessibilityLiveRegion="polite">주문 전송 중입니다. 잠시 기다려 주세요.</Text>
      ) : (
        <SubmissionRecovery />
      )}
      {!!error && <Problem message={error} />}
      {app.items.length && app.connection ? (
        <>
          <Text variant="h2">{app.store?.name}</Text>
          <Text>{app.store?.address}</Text>
          {app.cart.lines.map((line, i) => (
            <View key={i} className="gap-2 border-b border-border pb-3">
              <Text>
                {line.name} · {line.qty}개
              </Text>
              <Text>
                {line.options.map((choice) => choice.choiceName).join(' · ') || '추가 옵션 없음'}
              </Text>
              <Text>{money(line.lineTotal)}</Text>
            </View>
          ))}
          <Text variant="h2">합계 {money(app.cart.total)}</Text>
          <Text variant="h3">결제할 장소</Text>
          <Text>앱에서는 결제하지 않습니다. 매장 접수 후 직원 안내에 따라 결제해 주세요.</Text>
          <View className="flex-row flex-wrap gap-2">
            {(['counter', 'kiosk'] as const).map((payment) => (
              <Button
                key={payment}
                variant={app.checkout.payment === payment ? 'default' : 'outline'}
                disabled={sending || !!app.pendingSubmission}
                accessibilityRole="radio"
                accessibilityState={{ checked: app.checkout.payment === payment }}
                onPress={() => app.setCheckout({ ...app.checkout, payment })}
              >
                <Text>{payment === 'counter' ? '카운터' : '키오스크'}</Text>
              </Button>
            ))}
          </View>
          <Text>요청 사항 (선택 · 최대 200자)</Text>
          <Input
            accessibilityLabel="주문 요청 사항"
            value={app.checkout.note}
            maxLength={200}
            editable={!sending && !app.pendingSubmission}
            onChangeText={(note) => app.setCheckout({ ...app.checkout, note })}
          />
          <Button
            disabled={app.busy || sending || !!app.pendingSubmission}
            onPress={() => void submit()}
          >
            <Text>{sending ? '전송 중' : '확인한 내용으로 주문 제출'}</Text>
          </Button>
          <NavLink href="/cart">돌아가서 수정</NavLink>
        </>
      ) : (
        !app.pendingSubmission && (
          <>
            <Text>제출할 장바구니가 없습니다.</Text>
            <NavLink href="/menu">메뉴 보기</NavLink>
          </>
        )
      )}
    </Screen>
  );
}
