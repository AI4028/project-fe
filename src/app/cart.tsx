import { useState } from 'react';
import { Image, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Pencil, ShoppingBag, Trash2 } from 'lucide-react-native';
import { Screen, NavLink } from '@/components/screen';
import { EmptyState, OrderSteps } from '@/components/brand';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { ConfirmAction, Problem, SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { errorMessage } from '@/lib/api';
import { money } from '@/lib/cart';

const photos: Record<string, number> = {
  americano: require('../../assets/menu/americano.jpg'),
  'cafe-latte': require('../../assets/menu/cafe-latte.jpg'),
  'vanilla-latte': require('../../assets/menu/vanilla-latte.jpg'),
  'grapefruit-ade': require('../../assets/menu/grapefruit-ade.jpg'),
};

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
    <Screen
      title="장바구니"
      subtitle={app.store?.name ? app.store.name + '에서 고른 메뉴예요.' : undefined}
    >
      <OrderSteps current={2} />
      <SubmissionRecovery />
      {!!error && <Problem message={error} />}
      {!app.items.length ? (
        <EmptyState
          icon={ShoppingBag}
          title="장바구니가 비어 있어요"
          description="메뉴를 골라 주문을 시작해 보세요."
        >
          <NavLink href="/menu" variant="default">
            메뉴 보러 가기
          </NavLink>
        </EmptyState>
      ) : (
        <>
          <View className="gap-4">
            {app.cart.lines.map((line, index) => (
              <Card key={line.itemId + '-' + index} className="overflow-hidden p-0">
                <CardContent className="gap-4 py-5">
                  <View className="flex-row items-start gap-4">
                    {photos[line.itemId] && (
                      <Image
                        source={photos[line.itemId]}
                        style={{ width: 76, height: 76, borderRadius: 12 }}
                        accessibilityIgnoresInvertColors
                        accessible={false}
                      />
                    )}
                    <View className="min-w-0 flex-1 gap-1">
                      <Text variant="h3">{line.name}</Text>
                      <Text variant="muted">
                        {line.options.map((option) => option.choiceName).join(' · ') ||
                          '추가 옵션 없음'}
                      </Text>
                      <Text>{line.qty}개</Text>
                    </View>
                    <Text className="font-bold">{money(line.lineTotal)}</Text>
                  </View>
                  <View className="flex-row flex-wrap gap-2 border-t border-border pt-4">
                    <Button
                      variant="outline"
                      disabled={app.busy || !!app.pendingSubmission}
                      accessibilityLabel={line.name + ' 옵션과 수량 수정'}
                      onPress={() =>
                        router.push({
                          pathname: '/menu/[itemId]',
                          params: { itemId: line.itemId, edit: String(index) },
                        })
                      }
                    >
                      <Icon as={Pencil} size={16} />
                      <Text>옵션 · 수량 수정</Text>
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={app.busy || !!app.pendingSubmission}
                      accessibilityLabel={line.name + ' 삭제'}
                      onPress={() => setRemove(index)}
                    >
                      <Icon as={Trash2} size={17} />
                      <Text>삭제</Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>

          <Card className="border-0 bg-secondary shadow-none">
            <CardContent className="gap-4 py-6">
              <View className="flex-row flex-wrap items-baseline justify-between gap-3">
                <Text variant="h2">합계</Text>
                <Text variant="h2" accessibilityLiveRegion="polite">
                  {money(app.cart.total)}
                </Text>
              </View>
              <Text className="text-sm text-secondary-foreground">
                매장에서 확인한 금액이에요. 아직 주문은 제출되지 않았어요.
              </Text>
            </CardContent>
          </Card>

          <Button
            size="lg"
            className="w-full justify-between"
            disabled={app.busy || checking || !!app.pendingSubmission}
            onPress={() => void review()}
          >
            <Text>{checking ? '가격과 재고 확인 중' : '주문 최종 확인'}</Text>
            <Icon as={ArrowRight} size={19} className="text-primary-foreground" />
          </Button>
          <View className="flex-row flex-wrap gap-2">
            <NavLink href="/menu">다른 메뉴 추가</NavLink>
            <NavLink href="/leave">주문 중단 · 장바구니 관리</NavLink>
          </View>
        </>
      )}
      <ConfirmAction
        open={remove !== null}
        onOpenChange={(open) => {
          if (!open) setRemove(null);
        }}
        title="메뉴를 삭제할까요?"
        description={
          (remove !== null ? (app.cart.lines[remove]?.name ?? '선택한 메뉴') : '') +
          '를 장바구니에서 삭제합니다.'
        }
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
