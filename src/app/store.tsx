import { useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Accessibility, MapPin, Navigation, ShoppingBag } from 'lucide-react-native';
import { Problem } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { knownText } from '@/lib/location';
import { errorMessage } from '@/lib/api';
import type { Store } from '@/lib/types';
export default function StoreDetails() {
  const app = useApp();
  const { width } = useWindowDimensions();
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
      subtitle="방문하기 전에 접근성과 주문 방법을 확인하세요."
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
          <View className="rounded-3xl bg-primary p-6 sm:p-8">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-background">
              <Icon as={MapPin} size={24} className="text-primary" />
            </View>
            <Text className="mt-4 text-sm font-semibold text-primary-foreground">매장 위치</Text>
            <Text className="mt-2 text-xl font-bold text-primary-foreground">
              {store.address || '주소 확인 필요'}
            </Text>
            <Text className="mt-3 text-primary-foreground">
              이 매장의 방문 정보와 주문 방법을 아래에서 확인하세요.
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-4">
            <Card
              className="min-w-0 rounded-3xl"
              style={width >= 760 ? { width: '48%' } : { width: '100%' }}
            >
              <CardContent className="gap-4 pt-6">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
                  <Icon as={Accessibility} size={22} className="text-primary" />
                </View>
                <Text variant="h3">접근성 정보</Text>
                <Text>
                  층수 ·{' '}
                  {store.accessibility.floor != null
                    ? `${store.accessibility.floor}층`
                    : '확인 필요'}
                </Text>
                <Text>
                  입구 단차 ·{' '}
                  {store.accessibility.stepFreeEntrance === true
                    ? '턱 없는 입구'
                    : store.accessibility.stepFreeEntrance === false
                      ? '입구에 턱 있음'
                      : '확인 필요'}
                </Text>
                <Text>
                  자동문 ·{' '}
                  {store.accessibility.automaticDoor === true
                    ? '있음'
                    : store.accessibility.automaticDoor === false
                      ? '없음'
                      : '확인 필요'}
                </Text>
                <Text>
                  엘리베이터 ·{' '}
                  {store.accessibility.elevator === true
                    ? '있음'
                    : store.accessibility.elevator === false
                      ? '없음'
                      : '확인 필요'}
                </Text>
                <Text>
                  장애인 화장실 ·{' '}
                  {store.accessibility.accessibleRestroom === true
                    ? '있음'
                    : store.accessibility.accessibleRestroom === false
                      ? '없음'
                      : '확인 필요'}
                </Text>
                <View className="h-px bg-border" />
                <Text className="font-semibold">추가 안내</Text>
                <Text>{knownText(store.accessibility.notes)}</Text>
                <Text variant="muted">
                  정보 출처와 확인 날짜는 아직 제공되지 않았습니다. 이용 가능 여부는 직원에게 확인해
                  주세요.
                </Text>
              </CardContent>
            </Card>
            <Card
              className="min-w-0 rounded-3xl"
              style={width >= 760 ? { width: '48%' } : { width: '100%' }}
            >
              <CardContent className="gap-4 pt-6">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
                  <Icon as={Navigation} size={22} className="text-primary" />
                </View>
                <Text variant="h3">실내 이동 안내</Text>
                <Text>{knownText(store.indoorDirections)}</Text>
                <Text variant="muted">
                  안내가 없거나 현장과 다르면 직원에게 이동 경로를 확인해 주세요.
                </Text>
                <NavLink href={{ pathname: '/guide', params: { storeId: store.storeId } }}>
                  안내 자세히 보기
                </NavLink>
              </CardContent>
            </Card>
          </View>
          <Card className="rounded-3xl">
            <CardContent className="gap-4 pt-6">
              <View className="flex-row items-center gap-3">
                <Icon as={ShoppingBag} size={23} className="text-primary" />
                <Text variant="h3">주문 방법</Text>
              </View>
              <Text>
                {store.orderingMethods?.map((method) => methods[method] ?? method).join(', ') ||
                  '등록된 주문 방법이 없습니다. 직원 확인이 필요합니다.'}
              </Text>
              <Text variant="muted">
                휴대폰 주문 지원 여부와 현재 운영 상태는 매장에서 확인해 주세요. 가까이 있다는
                것만으로 주문이 연결되지는 않습니다.
              </Text>
              {different ? (
                <View className="gap-3 rounded-2xl bg-secondary p-4">
                  <Text>
                    다른 매장에서 주문 중입니다. 장바구니를 유지하거나 연결 종료 후 이 매장으로
                    변경할 수 있어요.
                  </Text>
                  <NavLink href="/leave">현재 주문 정리하기</NavLink>
                </View>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  <NavLink href={{ pathname: '/menu', params: { storeId: store.storeId } }}>
                    메뉴와 가격 먼저 보기
                  </NavLink>
                  <NavLink href={{ pathname: '/connect', params: { storeId: store.storeId } }}>
                    지금 이 매장에서 주문하기
                  </NavLink>
                </View>
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
