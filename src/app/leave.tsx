import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ShoppingBag } from 'lucide-react-native';
import { NavLink, Screen } from '@/components/screen';
import { EmptyState } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Problem, SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { errorMessage } from '@/lib/api';

export default function Leave() {
  const app = useApp();
  const { storeId, itemId, next, from, section } = useLocalSearchParams<{
    storeId?: string;
    itemId?: string;
    next?: string;
    from?: string;
    section?: string;
  }>();
  const [error, setError] = useState('');
  const target = storeId
    ? { pathname: '/connect' as const, params: { storeId, itemId, next, from, section } }
    : ('/' as const);
  const browse = storeId ? { pathname: '/store' as const, params: { storeId } } : ('/' as const);

  return (
    <Screen title="매장을 바꿀까요?" reading voice={false}>
      <SubmissionRecovery />
      {!!error && <Problem message={error} />}
      {!app.pendingSubmission && app.connection && (
        <View className="gap-3">
          <View className="gap-2 rounded-2xl bg-secondary p-4">
            {!!app.store?.name && (
              <Text translate={false} className="font-bold">
                {app.store.name}
              </Text>
            )}
            <Text className="text-secondary-foreground">
              {app.items.length
                ? '매장을 바꾸면 현재 연결을 종료하고 장바구니를 비워요.'
                : '매장을 바꾸면 현재 매장 연결을 종료해요.'}
            </Text>
          </View>
          <NavLink href={app.items.length ? '/cart' : '/menu'} variant="default" size="lg">
            현재 매장 유지
          </NavLink>
          <Button
            variant="outline"
            size="lg"
            disabled={app.busy}
            onPress={() => {
              setError('');
              void app
                .disconnect()
                .then(() => router.replace(target))
                .catch((reason) => setError(errorMessage(reason)));
            }}
          >
            <Text>
              {app.items.length
                ? storeId
                  ? '비우고 새 키오스크에 연결하기'
                  : '비우고 다른 매장 찾기'
                : '다른 매장 찾기'}
            </Text>
          </Button>
          <NavLink href={browse} variant="ghost">
            장바구니 유지하고 둘러보기
          </NavLink>
        </View>
      )}
      {!app.pendingSubmission && !app.connection && !app.busy && (
        <EmptyState
          icon={ShoppingBag}
          title="진행 중인 매장 연결이 없어요"
          description="이미 제출한 주문은 주문 상태 화면에서 확인해 주세요."
        >
          <NavLink href={target} variant="default">
            {storeId ? '새 키오스크에 연결하기' : '매장 찾기로'}
          </NavLink>
        </EmptyState>
      )}
    </Screen>
  );
}
