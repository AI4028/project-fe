import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { Screen, NavLink } from '@/components/screen';
import StoreMap from '@/components/store-map';
import { StoreCard } from '@/components/store-card';
import { EmptyState } from '@/components/brand';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { filterStores, type AccessFilter } from '@/lib/discovery';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/ui/icon';
import {
  ArrowRight,
  LocateFixed,
  List,
  Map,
  Search,
  X,
  SlidersHorizontal,
} from 'lucide-react-native';
import { Problem, SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { ApiError, errorMessage } from '@/lib/api';
import { nearbyStores, distanceM, type Position } from '@/lib/location';
import type { Store } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';
export default function Discovery() {
  const { t } = useTranslation();
  const app = useApp();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [fetched, setStores] = useState<Store[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [queryPosition, setQueryPosition] = useState<Position | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [access, setAccess] = useState<AccessFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    return filterStores(list, search, access);
  }, [fetched, position, search, access]);
  const selected = stores.find((store) => store.storeId === selectedId) ?? stores[0];
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
    <Screen title="어디로 갈까요?" subtitle="나에게 편한 공간을 발견해 보세요.">
      <SubmissionRecovery />
      {app.connection && (
        <View className="gap-3 rounded-2xl bg-secondary p-4">
          <Text className="font-semibold">{app.store?.name ?? '매장'}에서 주문 중이에요</Text>
          <View className="flex-row flex-wrap gap-2">
            <NavLink href="/cart" variant="default">
              주문 이어가기
            </NavLink>
            <NavLink href="/leave" variant="ghost">
              매장 변경
            </NavLink>
          </View>
        </View>
      )}
      <View className="gap-4">
        <View className="flex-row items-center rounded-2xl border border-input bg-card pl-4">
          <Icon as={Search} size={22} className="text-muted-foreground" accessible={false} />
          <Input
            accessibilityLabel="매장 이름 또는 주소 검색"
            placeholder="어떤 매장을 찾으세요?"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            className="min-w-0 flex-1 border-0 bg-transparent px-3"
          />
          {!!search && (
            <Button
              variant="ghost"
              size="icon"
              accessibilityLabel="검색어 지우기"
              onPress={() => setSearch('')}
            >
              <Icon as={X} size={19} className="text-muted-foreground" />
            </Button>
          )}
        </View>
        <View
          className="flex-row flex-wrap items-center gap-2"
          accessibilityRole="radiogroup"
          accessibilityLabel="접근성 조건"
        >
          {(
            [
              { value: 'all', label: '전체' },
              { value: 'step-free', label: '턱 없는 입구' },
              { value: 'restroom', label: '장애인 화장실' },
            ] as const
          ).map((filter) => (
            <Button
              key={filter.value}
              variant={access === filter.value ? 'default' : 'outline'}
              className="rounded-full px-4"
              accessibilityRole="radio"
              accessibilityState={{ checked: access === filter.value }}
              onPress={() => setAccess(filter.value)}
            >
              <Text>{filter.label}</Text>
            </Button>
          ))}
        </View>
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            disabled={locating}
            className="px-0"
            onPress={() => void locate()}
          >
            <Icon as={LocateFixed} size={18} className="text-primary" />
            <Text className="text-primary">
              {locating ? '위치 확인 중…' : position ? '내 주변 · 3km' : '내 주변에서 찾기'}
            </Text>
          </Button>
          {position && (
            <Button variant="ghost" onPress={allStores}>
              <Text>전체 지역</Text>
            </Button>
          )}
        </View>
        <Text variant="muted" accessibilityLiveRegion="polite">
          {message}
        </Text>
      </View>
      <View className="gap-4">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="flex-row items-baseline gap-2">
            <Text variant="h3">
              {search.trim() ? '검색한 매장' : position ? '가까운 매장' : '둘러볼 매장'}
            </Text>
            {!loading && <Text className="font-semibold text-primary">{stores.length}</Text>}
          </View>
          <View className="min-w-[200px]">
            <SegmentedControl
              value={view}
              onChange={setView}
              label="매장 보기 방식"
              options={[
                { value: 'list', label: '목록', icon: List },
                { value: 'map', label: '지도', icon: Map },
              ]}
            />
          </View>
        </View>
        {!!error && (
          <Problem
            message={`${t(error)}${fetched.length ? ` ${t('이전 목록을 표시합니다.')}` : ''}`}
            busy={loading}
            retry={() => setRevision((value) => value + 1)}
          />
        )}
        {loading && (
          <View
            className="gap-3 rounded-3xl border border-border bg-card p-6"
            accessibilityLiveRegion="polite"
          >
            <Text className="font-medium">매장을 찾고 있어요…</Text>
            <Text variant="muted">위치와 접근성 정보를 불러옵니다.</Text>
          </View>
        )}
        {!loading && !error && !stores.length && (
          <EmptyState
            icon={SlidersHorizontal}
            title="아직 맞는 매장이 없어요"
            description="검색어나 접근성 조건을 바꿔 보세요."
          >
            <Button
              variant="secondary"
              onPress={() => {
                setSearch('');
                setAccess('all');
                allStores();
              }}
            >
              <Text>전체 매장 보기</Text>
            </Button>
          </EmptyState>
        )}
        {view === 'map' ? (
          <View className="gap-3">
            <View className="overflow-hidden rounded-3xl border border-border">
              <StoreMap
                stores={stores}
                position={position}
                onSelect={(store) => setSelectedId(store.storeId)}
              />
            </View>
            {selected && (
              <>
                <Text variant="muted">지도에서 매장을 선택하고 자세히 살펴보세요.</Text>
                <StoreCard
                  store={selected}
                  onPress={() => select(selected)}
                  showDistance={!!position}
                />
              </>
            )}
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-3">
            {stores.map((store) => (
              <View key={store.storeId} style={{ width: wide ? '48.8%' : '100%' }}>
                <StoreCard store={store} onPress={() => select(store)} showDistance={!!position} />
              </View>
            ))}
          </View>
        )}
        {access !== 'all' && (
          <Text variant="muted">
            선택한 시설이 있다고 등록된 매장만 보여 드려요. 현장 상황은 매장에 확인해 주세요.
          </Text>
        )}
      </View>
      {!app.connection && (
        <View className="gap-3 border-t border-border pt-5">
          <Text className="font-semibold">이미 매장에 도착하셨나요?</Text>
          <NavLink href="/connect" variant="secondary" icon={ArrowRight} className="justify-start">
            매장 코드로 주문 시작
          </NavLink>
        </View>
      )}
    </Screen>
  );
}
