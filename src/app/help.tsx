import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Problem } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { errorMessage } from '@/lib/api';
import { knownText } from '@/lib/location';
import type { Store } from '@/lib/types';
export default function Help() {
  const app = useApp();
  const { storeId, orderId } = useLocalSearchParams<{ storeId?: string; orderId?: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setStore(null);
    setError('');
    void (async () => {
      let id = storeId || app.connection?.storeId || app.store?.storeId;
      if (orderId) {
        const order = await app.getOrder(orderId);
        if (!order.kioskId) return;
        id = (await app.api.kioskInfo(order.kioskId)).storeId;
      }
      if (id) {
        const value = await app.api.store(id);
        if (active) setStore(value);
      }
    })().catch((reason) => {
      if (active) setError(errorMessage(reason));
    });
    return () => {
      active = false;
    };
  }, [storeId, orderId, app.api, app.connection?.storeId, revision]);
  const canRequest =
    !!app.connection &&
    !orderId &&
    !app.pendingSubmission &&
    (!storeId || storeId === app.connection.storeId);
  return (
    <Screen title="도움이 필요하세요?" voice={false}>
      {store && (
        <>
          <Text variant="h2">{store.name}</Text>
          <Text>{store.address}</Text>
        </>
      )}
      {!!error && <Problem message={error} retry={() => setRevision((value) => value + 1)} />}
      {canRequest ? (
        <Card>
          <CardContent className="gap-3 pt-6">
            <Text variant="h2">매장에 도움 요청 보내기</Text>
            <Text accessibilityLiveRegion="polite">
              {
                {
                  idle: '현재 연결된 매장으로 요청을 보낼 수 있습니다.',
                  sent: '요청을 보냈습니다. 직원의 확인을 기다리고 있어요.',
                  acknowledged:
                    '직원이 요청을 확인했습니다. 실제 도움 제공 여부는 직원에게 확인해 주세요.',
                }[app.helpState]
              }
            </Text>
            <Button
              disabled={app.busy || app.helpState === 'sent'}
              onPress={() => {
                setError('');
                void app.help().catch((reason) => setError(errorMessage(reason)));
              }}
            >
              <Text>{app.helpState === 'sent' ? '직원 확인 대기 중' : '도움 요청 보내기'}</Text>
            </Button>
            <Text>
              답이 없거나 기다리기 어렵다면 주변 직원에게 직접 요청해 주세요. 요청 전송만으로 도움이
              제공된 것은 아닙니다.
            </Text>
          </CardContent>
        </Card>
      ) : (
        <>
          <Text>
            연결 전이나 주문 제출 후에는 앱에서 도움 요청을 보낼 수 없습니다. 매장 직원에게 직접
            문의해 주세요.
          </Text>
          {orderId && (
            <NavLink href={{ pathname: '/orders/[orderId]', params: { orderId } }}>
              주문 번호와 상태 보여 주기
            </NavLink>
          )}
        </>
      )}
      <Text variant="h2">직원에게 이렇게 요청해 보세요</Text>
      <Text>
        {orderId
          ? '“휴대폰으로 주문했습니다. 주문 상태, 취소 또는 픽업 안내를 도와주세요.”'
          : '“휴대폰 주문 연결 코드나 링크를 알려주세요. 연결이 어렵다면 직접 주문을 도와주세요.”'}
      </Text>
      <Text>등록된 실내 안내: {knownText(store?.indoorDirections)}</Text>
      <Text variant="muted">
        매장 연락처와 직원 위치는 확인이 필요합니다. 주변 직원에게 직접 도움을 요청해 주세요.
      </Text>
      <NavLink href="/connect">연결 코드 다시 입력</NavLink>
      <NavLink href={store ? { pathname: '/store', params: { storeId: store.storeId } } : '/'}>
        매장 정보로 돌아가기
      </NavLink>
    </Screen>
  );
}
