import { useEffect, useRef, useState, useMemo } from 'react';
import { View } from 'react-native';
import { Redirect, router } from 'expo-router';
import * as Location from 'expo-location';
import { Screen, NavLink } from '@/components/screen';
import StoreMap from '@/components/store-map';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useApp } from '@/providers/app-provider';
import { ApiError } from '@/lib/api';
import {
  accessibilitySummary,
  assistanceLabels,
  knownText,
  nearbyStores,
  distanceM,
  type Position,
} from '@/lib/location';
import type { Store } from '@/lib/types';
export default function Discovery() {
  const app = useApp();
  const [fetchedStores, setStores] = useState<Store[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [queryPosition, setQueryPosition] = useState<Position | null>(null);
  const stores = useMemo(
    () => (position ? nearbyStores(fetchedStores, position) : fetchedStores),
    [fetchedStores, position],
  );
  useEffect(() => {
    if (position && (!queryPosition || distanceM(queryPosition, position) >= 100))
      setQueryPosition(position);
  }, [position, queryPosition]);
  const [locationMessage, setLocationMessage] = useState(
    '위치를 사용하면 가까운 매장을 찾을 수 있습니다.',
  );
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const locationWatch = useRef<Location.LocationSubscription | null>(null);
  const mounted = useRef(true);
  const arrived = useRef(new Set<string>());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      locationWatch.current?.remove();
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = queryPosition
      ? app.api.nearby(queryPosition.lat, queryPosition.lng).catch(async (error) => {
          // Older backend checkouts do not have /stores/nearby yet.
          if (error instanceof ApiError && error.status === 404)
            return nearbyStores(await app.api.stores(), queryPosition);
          throw error;
        })
      : app.api.stores();
    void load
      .then((list) => {
        if (active) setStores(list);
      })
      .catch((error) => {
        if (active) app.report(error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [app.api, queryPosition, revision]);
  useEffect(() => {
    const inside = stores.filter((store) => store.insideGeofence);
    const next = inside.find((store) => !arrived.current.has(store.storeId));
    if (next)
      app.announce(`${next.name} 근처에 도착했어요. 매장을 선택하면 연결을 시작할 수 있습니다.`);
    arrived.current = new Set(inside.map((store) => store.storeId));
  }, [stores]);
  async function locate() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setLocationMessage('위치 권한이 꺼져 있어요. 전체 매장 목록을 이용해 주세요.');
      return;
    }
    locationWatch.current?.remove();
    const subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
      (result) => {
        if (!mounted.current) return;
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude });
        setLocationMessage(`내 위치 · 오차 약 ${Math.round(result.coords.accuracy ?? 0)}m`);
      },
    );
    if (mounted.current) locationWatch.current = subscription;
    else subscription.remove();
  }
  const select = (store: Store) =>
    void app
      .selectStore(store.storeId)
      .then(() => router.push('/store'))
      .catch(app.report);
  if (!app.settings.assistance) return <Redirect href="/onboarding" />;
  return (
    <Screen
      title={`${assistanceLabels[app.settings.assistance]} 지도`}
      subtitle="나의 속도로, 편안하게. 가까운 매장과 접근성 정보를 확인하세요."
    >
      <View className="flex-row flex-wrap gap-2">
        <NavLink href="/onboarding">유형 변경</NavLink>
        <Button variant="secondary" onPress={() => void locate().catch(app.report)}>
          <Text>내 위치 찾기</Text>
        </Button>
      </View>
      <Text accessibilityLiveRegion="polite">{locationMessage}</Text>
      <StoreMap stores={stores} position={position} onSelect={select} />
      {app.demo && (
        <Button
          variant="outline"
          onPress={() => {
            const target = stores.find((store) => store.location)?.location;
            if (target) {
              locationWatch.current?.remove();
              setPosition({ ...target, lat: target.lat - 0.00009 });
              setLocationMessage('데모 위치 · 매장 앞');
            }
          }}
        >
          <Text>데모: 매장 앞으로 이동</Text>
        </Button>
      )}
      {app.connection && (
        <Card>
          <CardContent className="gap-3 pt-6">
            <Text>{app.store?.name} · 연결 중</Text>
            <NavLink href="/menu">주문 이어가기</NavLink>
            <Button
              variant="outline"
              disabled={app.busy}
              onPress={() => void app.disconnect().catch(app.report)}
            >
              <Text>연결 종료</Text>
            </Button>
          </CardContent>
        </Card>
      )}
      {app.order && (
        <NavLink href={{ pathname: '/orders/[orderId]', params: { orderId: app.order.orderId } }}>
          최근 주문 상태 보기
        </NavLink>
      )}
      <View className="flex-row items-center justify-between">
        <Text variant="h3">{position ? '주변 매장' : '전체 매장'}</Text>
        <Button variant="ghost" disabled={loading} onPress={() => setRevision(revision + 1)}>
          <Text>새로고침</Text>
        </Button>
      </View>
      {loading && <Text>매장을 불러오는 중입니다.</Text>}
      {!loading && !stores.length && (
        <Text>표시할 매장이 없습니다. 위치나 서버 연결을 확인해 주세요.</Text>
      )}
      {stores.map((store) => (
        <Card key={store.storeId}>
          <CardContent className="gap-3 pt-6">
            <Text variant="h3">{store.name}</Text>
            <Text>{store.address}</Text>
            {store.distanceM != null && (
              <Text>
                {store.distanceM}m {store.insideGeofence ? '· 매장 근처에 도착했어요' : ''}
              </Text>
            )}
            <Text>{accessibilitySummary(store)}</Text>
            <Text variant="muted">{knownText(store.accessibility.notes)}</Text>
            <Button disabled={app.busy} onPress={() => select(store)}>
              <Text>매장 상세 보기</Text>
            </Button>
          </CardContent>
        </Card>
      ))}
      <NavLink href="/connect">연결 코드로 키오스크 연결</NavLink>
      <NavLink href="/kiosk">매장 키오스크</NavLink>
    </Screen>
  );
}
