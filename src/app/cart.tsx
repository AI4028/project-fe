import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmAction, Problem, SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { errorMessage } from '@/lib/api';
import { money } from '@/lib/cart';
export default function CartScreen() {
  const app = useApp();
  const [remove, setRemove] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  async function review() {
    setChecking(true);
    setError('');
    try {
      await app.updateCart(app.items);
      router.push('/review');
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setChecking(false);
    }
  }
  return (
    <Screen title="장바구니" subtitle={app.store?.name}>
      <SubmissionRecovery />
      {!!error && <Problem message={error} />}
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
                <Text>
                  {line.options.map((option) => option.choiceName).join(' · ') || '추가 옵션 없음'}
                </Text>
                <Text>
                  {line.qty}개 · {money(line.lineTotal)}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={app.busy || !!app.pendingSubmission}
                    accessibilityLabel={`${line.name} 옵션과 수량 수정`}
                    onPress={() =>
                      router.push({
                        pathname: '/menu/[itemId]',
                        params: { itemId: line.itemId, edit: String(index) },
                      })
                    }
                  >
                    <Text>옵션 · 수량 수정</Text>
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={app.busy || !!app.pendingSubmission}
                    accessibilityLabel={`${line.name} 삭제`}
                    onPress={() => setRemove(index)}
                  >
                    <Text>삭제</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          ))}
          <Text variant="h2">합계 {money(app.cart.total)}</Text>
          <Text>아직 제출하지 않은 장바구니입니다. 다음 화면에서 최종 확인 후 주문합니다.</Text>
          <Button
            disabled={app.busy || checking || !!app.pendingSubmission}
            onPress={() => void review()}
          >
            <Text>{checking ? '가격과 재고 확인 중' : '주문 최종 확인으로'}</Text>
          </Button>
          <NavLink href="/menu">다른 메뉴 추가</NavLink>
          <NavLink href="/leave">주문 중단 · 장바구니 유지 또는 비우기</NavLink>
        </>
      )}
      <ConfirmAction
        open={remove !== null}
        onOpenChange={(open) => {
          if (!open) setRemove(null);
        }}
        title="메뉴를 삭제할까요?"
        description={`${remove !== null ? (app.cart.lines[remove]?.name ?? '선택한 메뉴') : ''}를 장바구니에서 삭제합니다.`}
        label="삭제하기"
        busy={app.busy}
        onConfirm={() => {
          if (remove === null) return;
          setError('');
          void app
            .updateCart(app.items.filter((_, index) => index !== remove))
            .then(() => setRemove(null))
            .catch((reason) => {
              setRemove(null);
              setError(errorMessage(reason));
            });
        }}
      />
    </Screen>
  );
}
