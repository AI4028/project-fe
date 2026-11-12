import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { Screen, NavLink } from '@/components/screen';
import StoreMap from '@/components/store-map';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/ui/icon';
import { ArrowRight, Compass, MapPin, Map, Search, ShoppingBag } from 'lucide-react-native';
import { Problem, SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { ApiError, errorMessage } from '@/lib/api';
import { accessibilitySummary, nearbyStores, distanceM, type Position } from '@/lib/location';
import type { Store } from '@/lib/types';
export default function Discovery() {
  const app = useApp();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [fetched, setStores] = useState<Store[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [queryPosition, setQueryPosition] = useState<Position | null>(null);
  const [search, setSearch] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [message, setMessage] = useState('위치 권한 없이 매장 이름이나 주소로 찾을 수 있어요.');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [revision, setRevision] = useState(0);
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const locationRequest = useRef(0);
  useFocusEffect(
    useCallback(
      () => () => {
        locationRequest.current++;
        watcher.current?.remove();
        watcher.current = null;
        setLocating(false);
      },
      [],
    ),
  );
  useEffect(() => {
    if (position && (!queryPosition || distanceM(queryPosition, position) >= 100))
      setQueryPosition(position);
  }, [position, queryPosition]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const load = queryPosition
      ? app.api.nearby(queryPosition.lat, queryPosition.lng).catch(async (reason) => {
          if (reason instanceof ApiError && reason.status === 404)
            return nearbyStores(await app.api.stores(), queryPosition);
          throw reason;
        })
      : app.api.stores();
    void load
      .then((list) => {
        if (active) setStores(list);
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
  }, [app.api, queryPosition, revision]);
  const stores = useMemo(() => {
    const list = position ? nearbyStores(fetched, position) : fetched;
    const query = search.trim().toLocaleLowerCase();
    return list.filter((store) =>
      `${store.name} ${store.address}`.toLocaleLowerCase().includes(query),
    );
  }, [fetched, position, search]);
  function allStores() {
    locationRequest.current++;
    watcher.current?.remove();
    watcher.current = null;
    setPosition(null);
    setQueryPosition(null);
    setLocating(false);
    setMessage('전체 매장을 표시합니다. 위치를 사용하지 않습니다.');
  }
  async function locate() {
    const id = ++locationRequest.current;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (id !== locationRequest.current) return;
      if (!permission.granted) {
        allStores();
        setMessage('위치 권한이 없어도 전체 매장 목록과 검색을 이용할 수 있어요.');
        return;
      }
      watcher.current?.remove();
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
        (result) => {
          if (id !== locationRequest.current) return;
          setPosition({ lat: result.coords.latitude, lng: result.coords.longitude });
          setMessage(
            `현재 위치 기준 3km 이내 매장 · 위치 오차 약 ${Math.round(result.coords.accuracy ?? 0)}m`,
          );
        },
      );
      if (id === locationRequest.current) watcher.current = subscription;
      else subscription.remove();
    } catch {
      if (id !== locationRequest.current) return;
      allStores();
      setMessage(
        '위치를 확인하지 못했습니다. 전체 매장에서 검색하거나 위치 찾기를 다시 선택해 주세요.',
      );
    } finally {
      if (id === locationRequest.current) setLocating(false);
    }
  }
  const select = (store: Store) =>
    router.push({ pathname: '/store', params: { storeId: store.storeId } });
  return (
    <Screen
      title="내게 맞는 매장을 찾아요"
      subtitle="방문 전 필요한 정보를 확인하고, 매장에서는 편하게 주문하세요."
    >
      <SubmissionRecovery />
      {app.connection && (
        <Card className="border-primary/30 bg-secondary">
          <CardContent className="gap-3 pt-6">
            <Text className="font-semibold text-primary">진행 중인 주문</Text>
            <Text variant="h4">{app.store?.name}</Text>
            <Text className="text-muted-foreground">장바구니를 이어서 확인할 수 있어요.</Text>
            <NavLink href="/cart">장바구니 · 주문 이어가기</NavLink>
            <NavLink href="/leave">다른 매장으로 변경 · 주문 중단</NavLink>
          </CardContent>
        </Card>
      )}
      <View className="overflow-hidden rounded-3xl bg-secondary p-6 sm:p-8">
        <View className="gap-4">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-card">
            <Icon as={Compass} size={25} className="text-primary" />
          </View>
          <Text variant="small" className="font-bold text-primary">
            이미 매장에 계신가요?
          </Text>
          <Text variant="h2" className="text-foreground">
            내 휴대폰으로, 내 방식대로.
          </Text>
          <Text className="max-w-xl text-base leading-7 text-foreground">
            매장 접근성부터 주문 방법까지 미리 살펴보세요. 이미 매장에 있다면 받은 코드로 연결할 수
            있어요.
          </Text>
          <View className="self-start">
            <NavLink href="/connect" variant="default">
              매장에서 주문 시작하기
            </NavLink>
          </View>
        </View>
      </View>
      <Card className="rounded-3xl">
        <CardContent className="gap-4 pt-6">
          <View className="flex-row items-center gap-3">
            <Icon as={Search} size={23} className="text-primary" />
            <Text variant="h3">방문할 매장 찾기</Text>
          </View>
          <Text className="text-muted-foreground">이름이나 주소를 입력해 찾아보세요.</Text>
          <Input
            accessibilityLabel="매장 이름 또는 주소 검색"
            placeholder="매장 이름 또는 주소 검색"
            value={search}
            onChangeText={setSearch}
          />
          <View className="flex-row flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={locating}
              onPress={() => void locate()}
              accessibilityLabel={locating ? '위치 확인 중' : '내 주변 매장 찾기'}
            >
              <Icon as={MapPin} size={18} />
              <Text>{locating ? '위치 확인 중' : '내 주변 매장'}</Text>
            </Button>
            <Button variant="outline" onPress={allStores}>
              <Text>전체 매장</Text>
            </Button>
            <Button
              variant="outline"
              accessibilityState={{ expanded: showMap }}
              onPress={() => setShowMap(!showMap)}
            >
              <Icon as={Map} size={18} />
              <Text>{showMap ? '지도 닫기' : '지도 보기'}</Text>
            </Button>
          </View>
          <Text variant="muted">{message}</Text>
        </CardContent>
      </Card>
      {showMap && <StoreMap stores={stores} position={position} onSelect={select} />}
      {!!error && (
        <Problem
          message={`${error}${fetched.length ? ' 이전에 불러온 목록을 표시합니다.' : ''}`}
          busy={loading}
          retry={() => setRevision((value) => value + 1)}
        />
      )}
      {loading && <Text accessibilityLiveRegion="polite">매장을 불러오는 중입니다.</Text>}
      {!loading && !error && (
        <View className="gap-1">
          <Text variant="h3">
            검색 결과 <Text className="text-primary">{stores.length}</Text>
          </Text>
          {position && (
            <Text variant="muted">직선거리 기준이며 실제 이동 경로와 다를 수 있어요.</Text>
          )}
        </View>
      )}
      {!loading && !error && !stores.length && (
        <Card>
          <CardContent className="gap-3 pt-6">
            <Text>조건에 맞는 매장이 없습니다. 검색어를 바꾸거나 전체 매장을 확인해 주세요.</Text>
            <Button
              variant="outline"
              onPress={() => {
                setSearch('');
                allStores();
              }}
            >
              <Text>검색 조건 초기화</Text>
            </Button>
          </CardContent>
        </Card>
      )}
      <View className="flex-row flex-wrap gap-4">
        {stores.map((store) => (
          <Card
            key={store.storeId}
            className="min-w-0 rounded-3xl"
            style={wide ? { width: '48%' } : { width: '100%' }}
          >
            <CardContent className="flex-1 gap-3 pt-6">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-secondary">
                <Icon as={ShoppingBag} size={21} className="text-primary" />
              </View>
              <Text variant="h4">{store.name}</Text>
              <Text className="text-muted-foreground">{store.address || '주소 확인 필요'}</Text>
              {position && store.distanceM != null && (
                <Text className="font-medium text-primary">
                  약 {store.distanceM}m · 직선거리{store.insideGeofence ? ' · 근처 매장' : ''}
                </Text>
              )}
              <View className="rounded-2xl bg-secondary p-3">
                <Text>{accessibilitySummary(store)}</Text>
              </View>
              <Button
                className="mt-auto"
                accessibilityLabel={`${store.name} 상세 보기`}
                onPress={() => select(store)}
              >
                <Text>매장 정보 보기</Text>
                <Icon as={ArrowRight} size={18} />
              </Button>
            </CardContent>
          </Card>
        ))}
      </View>
      <Text variant="h3">더 알아보기</Text>
      <NavLink href="/onboarding">이용 설정 안내</NavLink>
      <NavLink href="/kiosk">매장 직원 화면</NavLink>
    </Screen>
  );
}
