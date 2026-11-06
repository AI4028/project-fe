import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Problem } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { accessibilitySummary, knownText } from '@/lib/location';
import { errorMessage } from '@/lib/api';
import type { Store } from '@/lib/types';
export default function StoreDetails() {
  const app = useApp();
  const { storeId } = useLocalSearchParams<{ storeId?: string }>();
  const id = storeId || app.store?.storeId;
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setStore(null);
    setError('');
    if (!id) return;
    setLoading(true);
    void app.api
      .store(id)
      .then((value) => {
        if (active) setStore(value);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, app.api, revision]);
  const methods: Record<string, string> = {
    phone: '스마트폰 주문',
    kiosk: '키오스크',
    staff: '직원 주문',
    qr: 'QR 주문',
    table: '테이블 주문',
  };
  const different = app.connection && app.connection.storeId !== id;
  return (
    <Screen
      title={store?.name ?? '매장 정보'}
      subtitle="지점과 주소를 확인한 뒤 필요한 정보를 살펴보세요."
      onTranscript={(text) => {
        if (!id) return false;
        if (/메뉴.*(읽|알려)/.test(text)) {
          const preview = store?.menu;
          if (preview?.length) {
            app.announce(
              preview
                .map((item) => `${item.name} ${item.price}원${item.available ? '' : ' 품절'}`)
                .join(', '),
            );
          } else {
            router.push({ pathname: '/menu', params: { storeId: id } });
          }
          return true;
        }
        if (/메뉴/.test(text)) {
          router.push({ pathname: '/menu', params: { storeId: id } });
          return true;
        }
        if (/길|실내|어디/.test(text)) {
          router.push({ pathname: '/guide', params: { storeId: id } });
          return true;
        }
        return false;
      }}
    >
      {loading && <Text>매장 정보를 불러오는 중입니다.</Text>}
      {!!error && (
        <Problem message={error} busy={loading} retry={() => setRevision((value) => value + 1)} />
      )}
      {store && (
        <>
          <Text>{store.address || '주소 확인 필요'}</Text>
          <Card>
            <CardContent className="gap-3 pt-6">
              <Text variant="h2">방문 전 접근성 확인</Text>
              <Text>{accessibilitySummary(store)}</Text>
              <Text>{knownText(store.accessibility.notes)}</Text>
              <Text>실내 이동 안내: {knownText(store.indoorDirections)}</Text>
              <Text variant="muted">
                정보 출처와 확인 날짜는 아직 제공되지 않았습니다. 정보가 없으면 이용 가능 여부를
                직원에게 확인해 주세요.
              </Text>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="gap-3 pt-6">
              <Text variant="h2">주문 방법</Text>
              <Text>
                {store.orderingMethods?.map((method) => methods[method] ?? method).join(', ') ||
                  '등록된 주문 방법이 없습니다. 직원 확인이 필요합니다.'}
              </Text>
              <Text variant="muted">
                휴대폰 주문 지원 여부와 현재 운영 상태는 매장에서 확인해 주세요. 가까이 있다는
                것만으로 주문이 연결되지는 않습니다.
              </Text>
              {different ? (
                <>
                  <Text>
                    다른 매장에서 주문 중입니다. 장바구니를 유지하거나 연결 종료 후 이 매장으로
                    변경할 수 있어요.
                  </Text>
                  <NavLink href="/leave">현재 주문 정리하기</NavLink>
                </>
              ) : (
                <>
                  <NavLink href={{ pathname: '/menu', params: { storeId: store.storeId } }}>
                    메뉴와 가격 먼저 보기
                  </NavLink>
                  <NavLink href={{ pathname: '/connect', params: { storeId: store.storeId } }}>
                    지금 이 매장에서 주문하기
                  </NavLink>
                </>
              )}
            </CardContent>
          </Card>
          <NavLink href={{ pathname: '/help', params: { storeId: store.storeId } }}>
            다른 주문 방법 · 직원에게 문의
          </NavLink>
          <Button variant="outline" onPress={() => setRevision((value) => value + 1)}>
            <Text>매장 정보 새로고침</Text>
          </Button>
        </>
      )}
      <NavLink href="/">다른 매장 찾기</NavLink>
    </Screen>
  );
}
