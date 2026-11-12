import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Pause, ShoppingBag, LogOut } from 'lucide-react-native';
import { Screen, NavLink } from '@/components/screen';
import { EmptyState, IconTile } from '@/components/brand';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent } from '@/components/ui/card';
import { Problem, SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { errorMessage } from '@/lib/api';
export default function Leave() {
  const app = useApp();
  const [error, setError] = useState('');
  return (
    <Screen
      title="잠시 멈춰도 괜찮아요."
      subtitle="장바구니를 유지할지, 매장 연결을 종료할지 선택해 주세요."
      voice={false}
    >
      <SubmissionRecovery />
      {!app.pendingSubmission && app.connection ? (
        <>
          <View className="flex-row flex-wrap gap-5">
            <Card className="flex-1" style={{ flexBasis: 320 }}>
              <CardContent className="gap-5">
                <IconTile icon={Pause} />
                <Text variant="h2">장바구니는 그대로</Text>
                <Text>{app.store?.name}에서 고른 메뉴를 유지하고 매장을 더 살펴볼 수 있어요.</Text>
                <Text variant="muted">
                  오래 이용하지 않아 연결이 만료되면 메뉴를 다시 선택해야 할 수 있어요.
                </Text>
                <NavLink href="/" variant="default">
                  장바구니 유지하고 둘러보기
                </NavLink>
                <NavLink href="/cart" icon={ShoppingBag}>
                  주문 계속하기
                </NavLink>
              </CardContent>
            </Card>
            <Card className="flex-1" style={{ flexBasis: 320 }}>
              <CardContent className="gap-5">
                <IconTile icon={LogOut} />
                <Text variant="h2">이 매장과 연결 종료</Text>
                <Text>
                  현재 장바구니를 비우고 연결을 종료해요. 다른 매장에서 주문하려면 새로 연결해
                  주세요.
                </Text>
                <Text variant="muted">아직 제출하지 않은 장바구니가 삭제돼요.</Text>
                <Button
                  variant="destructive"
                  disabled={app.busy}
                  onPress={() => {
                    setError('');
                    void app
                      .disconnect()
                      .then(() => router.replace('/'))
                      .catch((reason) => setError(errorMessage(reason)));
                  }}
                >
                  <Icon as={LogOut} size={20} accessible={false} />
                  <Text className="shrink">장바구니 비우고 연결 종료</Text>
                </Button>
              </CardContent>
            </Card>
          </View>
          {!!error && <Problem message={error} />}
        </>
      ) : (
        !app.pendingSubmission && (
          <EmptyState
            icon={ShoppingBag}
            title="진행 중인 매장 연결이 없어요"
            description="이미 제출한 주문은 주문 상태 화면에서 확인해 주세요."
          >
            <NavLink href="/" variant="default">
              매장 찾기로
            </NavLink>
          </EmptyState>
        )
      )}
    </Screen>
  );
}
