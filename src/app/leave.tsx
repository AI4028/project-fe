import { useState } from 'react';
import { router } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Problem, SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { errorMessage } from '@/lib/api';
export default function Leave() {
  const app = useApp();
  const [error, setError] = useState('');
  return (
    <Screen title="주문을 잠시 멈추시겠어요?" voice={false}>
      <SubmissionRecovery />
      {!app.pendingSubmission && app.connection ? (
        <>
          <Text>
            {app.store?.name}의 장바구니를 유지하며 둘러보거나, 장바구니를 비우고 매장 연결을 종료할
            수 있습니다.
          </Text>
          <Text variant="muted">
            장바구니는 현재 매장 연결에 보관됩니다. 오래 이용하지 않아 연결이 만료되면 다시 선택해야
            할 수 있어요.
          </Text>
          <NavLink href="/">장바구니 유지하고 둘러보기</NavLink>
          <NavLink href="/cart">주문 계속하기</NavLink>
          {!!error && <Problem message={error} />}
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
            <Text>장바구니 비우고 연결 종료</Text>
          </Button>
        </>
      ) : (
        !app.pendingSubmission && (
          <>
            <Text>
              진행 중인 매장 연결이 없습니다. 이미 제출한 주문은 주문 상태에서 취소 가능 여부를
              확인해 주세요.
            </Text>
            <NavLink href="/">매장 찾기로</NavLink>
          </>
        )
      )}
    </Screen>
  );
}
