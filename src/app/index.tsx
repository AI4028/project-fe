import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { List, Map, LocateFixed, Search, Settings2, X } from 'lucide-react-native';
import { router } from 'expo-router';
import StoreMap from '@/components/store-map';
import { BrandLockup } from '@/components/brand';
import { NavLink } from '@/components/screen';
import { PlacePreview } from '@/components/place-preview';
import { StoreCard } from '@/components/store-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { filterStores, type AccessFilter } from '@/lib/discovery';
import { distanceM, type Position } from '@/lib/location';
import { placeSearchUrl } from '@/lib/navigation';
import type { Store } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';

export default function Discovery() {
  const app = useApp();
  const { t } = useTranslation();
  const [view, setView] = useState<'map' | 'list'>(
    app.settings?.assistance === 'visual' ? 'list' : 'map',
  );
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [registered, setRegistered] = useState<Store[]>([]);
  const [places, setPlaces] = useState<Store[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const [access, setAccess] = useState<AccessFilter>('all');
  const request = useRef(0);
  useEffect(() => {
    if (app.settings?.assistance === 'visual') setView('list');
  }, [app.settings?.assistance]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void app.api
      .stores()
      .then((result) => {
        if (active) {
          setRegistered(result);
          setFailed(false);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [app.api, revision]);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const stores = useMemo(() => {
    const filtered = filterStores([...registered, ...places], query, access);
    return position
      ? filtered
          .map((store) => ({
            ...store,
            distanceM: store.location ? Math.round(distanceM(position, store.location)) : undefined,
          }))
          .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
      : filtered;
  }, [registered, places, query, access, position]);
  const selected = stores.find((store) => store.storeId === selectedId);
  const mapStores = useMemo(
    () => filterStores(registered, query, access),
    [registered, query, access],
  );
  async function locate() {
    const id = ++request.current;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (id !== request.current) return;
      if (!permission.granted) {
        setLocationMessage('위치 없이 검색할 수 있어요.');
        return;
      }
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (id !== request.current) return;
      setPosition({ lat: result.coords.latitude, lng: result.coords.longitude });
      setLocationMessage('현재 위치를 표시합니다. 거리는 직선거리예요.');
    } catch {
      if (id === request.current)
        setLocationMessage('위치를 확인하지 못했어요. 검색으로 장소를 찾아주세요.');
    } finally {
      if (id === request.current) setLocating(false);
    }
  }
  const search = () => {
    setSubmitted(query.trim());
    setSelectedId(null);
  };
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="gap-2 px-3 pb-2 pt-1">
        <View className="flex-row flex-wrap items-center justify-between gap-1">
          <BrandLockup />
          <View className="flex-row items-center">
            <Button
              variant="ghost"
              size="icon"
              accessibilityLabel="이용 설정"
              onPress={() => router.push('/settings')}
            >
              <Icon as={Settings2} size={21} className="text-primary" />
            </Button>
          </View>
        </View>
        <View className="flex-row items-center rounded-2xl border border-input bg-card pl-3">
          <Input
            className="min-w-0 flex-1 border-0 bg-transparent"
            accessibilityLabel="매장 이름 또는 주소 검색"
            placeholder="매장 또는 메뉴를 검색해보세요"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            returnKeyType="search"
          />
          {!!query && (
            <Button
              variant="ghost"
              size="icon"
              accessibilityLabel="검색어 지우기"
              onPress={() => {
                setQuery('');
                setSubmitted('');
              }}
            >
              <Icon as={X} size={18} />
            </Button>
          )}
          <Button variant="ghost" size="icon" accessibilityLabel="검색 실행" onPress={search}>
            <Icon as={Search} size={21} className="text-primary" />
          </Button>
        </View>
        <SegmentedControl
          value={view}
          onChange={setView}
          label="매장 보기 방식"
          options={[
            { value: 'list', label: '목록', icon: List },
            { value: 'map', label: '지도', icon: Map },
          ]}
        />
        {(app.connection || app.order) && (
          <NavLink
            variant="secondary"
            href={
              app.order
                ? { pathname: '/orders/[orderId]', params: { orderId: app.order.orderId } }
                : '/cart'
            }
          >
            진행 중인 주문 확인
          </NavLink>
        )}
      </View>
      <View className="min-h-0 flex-1">
        <View
          className={view === 'map' ? 'flex-1' : 'h-0 overflow-hidden'}
          accessibilityElementsHidden={view !== 'map'}
          importantForAccessibility={view === 'map' ? 'auto' : 'no-hide-descendants'}
        >
          <StoreMap
            stores={mapStores}
            position={position}
            onSelect={(store) => {
              if (store.directoryOnly)
                setPlaces((previous) =>
                  previous.some((item) => item.storeId === store.storeId)
                    ? previous
                    : [...previous, store],
                );
              setSelectedId(store.storeId);
            }}
            fill
            showDirectory={access === 'all'}
            query={submitted}
            onPlaces={setPlaces}
          />
        </View>
        {view === 'list' && (
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-3 px-4 py-3"
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Text variant="h2">가까운 장소</Text>
              <Button variant="ghost" disabled={locating} onPress={() => void locate()}>
                <Icon as={LocateFixed} size={18} className="text-primary" accessible={false} />
                <Text>{locating ? '위치 확인 중…' : '내 주변에서 찾기'}</Text>
              </Button>
            </View>
            <View
              className="flex-row flex-wrap gap-2"
              accessibilityRole="radiogroup"
              accessibilityLabel="접근성 조건"
            >
              {(
                [
                  { value: 'all', label: '전체' },
                  { value: 'step-free', label: '턱 없는 입구' },
                  { value: 'restroom', label: '장애인 화장실' },
                ] as const
              ).map((option) => (
                <Button
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: access === option.value }}
                  variant={access === option.value ? 'default' : 'outline'}
                  onPress={() => setAccess(option.value)}
                >
                  <Text>{option.label}</Text>
                </Button>
              ))}
            </View>
            <Text variant="muted" accessibilityLiveRegion="polite">
              {loading ? '매장을 찾고 있어요…' : `${stores.length} ${t('개의 장소')}`}
            </Text>
            {stores.map((store) => (
              <StoreCard
                key={store.storeId}
                store={store}
                showDistance={!!position}
                onPress={() => setSelectedId(store.storeId)}
              />
            ))}
            {!loading && !failed && !stores.length && (
              <Text>검색 결과가 없어요. 검색어를 바꾸거나 지도 앱에서 찾아보세요.</Text>
            )}
            <Button
              variant="outline"
              onPress={() => void Linking.openURL(placeSearchUrl(query)).catch(app.report)}
            >
              <Text>지도 앱에서 검색</Text>
            </Button>
            <SubmissionRecovery />
          </ScrollView>
        )}
        {view === 'map' && (
          <View className="absolute bottom-4 right-4">
            <Button
              variant="outline"
              size="icon"
              accessibilityLabel={locating ? '위치 확인 중…' : '내 주변에서 찾기'}
              accessibilityState={{ busy: locating }}
              disabled={locating}
              onPress={() => void locate()}
            >
              <Icon as={LocateFixed} size={22} className="text-primary" accessible={false} />
            </Button>
          </View>
        )}
      </View>
      {(!!locationMessage || failed) && (
        <View className="gap-1 border-t border-border bg-card px-4 py-2">
          {!!locationMessage && (
            <Text variant="muted" accessibilityLiveRegion="polite">
              {locationMessage}
            </Text>
          )}
          {failed && (
            <Button variant="ghost" onPress={() => setRevision((value) => value + 1)}>
              <Text className="text-left text-sm">
                주문 매장 연결 불가 · 지도는 계속 이용할 수 있어요 · 다시 시도
              </Text>
            </Button>
          )}
        </View>
      )}
      {selected && <PlacePreview store={selected} onClose={() => setSelectedId(null)} />}
    </SafeAreaView>
  );
}
