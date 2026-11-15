import { AppNavigation } from '@/components/app-navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { List, Map, LocateFixed, Search, X } from 'lucide-react-native';
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
import type { Store, PlaceSearchKind, PlaceSearchResult } from '@/lib/types';
import { displayPlace, featureLabels } from '@/lib/place-search';
import { useTranslation } from '@/lib/i18n';
import { errorMessage } from '@/lib/api';

export default function Discovery() {
  const app = useApp();
  const { t, language } = useTranslation();
  const [view, setView] = useState<'map' | 'list'>(
    app.settings?.assistance === 'visual' ? 'list' : 'map',
  );
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [submitted, setSubmitted] = useState('');
  const [searchKind, setSearchKind] = useState<PlaceSearchKind>('all');
  const [placeStatus, setPlaceStatus] = useState<PlaceSearchResult | null>(null);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [placeRevision, setPlaceRevision] = useState(0);
  const [registered, setRegistered] = useState<Store[]>([]);
  const [places, setPlaces] = useState<Store[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const [access, setAccess] = useState<AccessFilter>('all');
  const request = useRef(0);
  useEffect(() => {
    let active = true;
    setPlaces([]);
    setPlaceStatus(null);
    setPlaceError('');
    if (!submitted && !position && searchKind === 'all') {
      setPlaceLoading(false);
      return;
    }
    setPlaceLoading(true);
    void app.api
      .searchPlaces(submitted, searchKind, position)
      .then((result) => {
        if (!active) return;
        setPlaceStatus(result);
        setPlaces(
          result.places.map((place, index) => {
            const mapped = displayPlace(place, language === 'en');
            return place.placeKind && !['station', 'venue'].includes(place.placeKind)
              ? { ...mapped, name: `${t(mapped.name)} ${index + 1}` }
              : mapped;
          }),
        );
      })
      .catch((reason) => {
        if (active) setPlaceError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setPlaceLoading(false);
      });
    return () => {
      active = false;
    };
  }, [app.api, submitted, position, searchKind, language, placeRevision]);
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
        if (active) {
          setFailed(true);
          setNoticeDismissed(false);
        }
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
    const nearbyRegistered =
      position && !submitted
        ? registered.filter(
            (store) => store.location && distanceM(position, store.location) <= 5000,
          )
        : registered;
    const filtered = [
      ...(searchKind === 'all' ? filterStores(nearbyRegistered, query, access) : []),
      ...filterStores(places, '', access),
    ];
    return position
      ? filtered
          .map((store) => ({
            ...store,
            distanceM: store.location ? Math.round(distanceM(position, store.location)) : undefined,
          }))
          .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
      : filtered;
  }, [registered, places, query, access, position, searchKind, submitted]);
  const selected = stores.find((store) => store.storeId === selectedId);
  const mapStores = stores;
  async function locate() {
    setView('list');
    setSearchOpen(false);
    Keyboard.dismiss();
    setSelectedId(null);
    setQuery('');
    setSubmitted('');
    setAccess('all');
    setLocationMessage('');
    setNoticeDismissed(false);
    const id = ++request.current;
    setLocating(true);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (id !== request.current) return;
      if (!permission.granted) {
        setLocationMessage(
          '위치 권한이 꺼져 있어요. 기기 설정에서 허용하거나 장소 이름을 검색해 주세요.',
        );
        return;
      }
      const result = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('location-timeout')), 12000);
        }),
      ]);
      if (id !== request.current) return;
      setPosition({ lat: result.coords.latitude, lng: result.coords.longitude });
      setLocationMessage('현재 위치를 표시합니다. 거리는 직선거리예요.');
    } catch {
      if (id === request.current)
        setLocationMessage('위치를 확인하지 못했어요. 검색으로 장소를 찾아주세요.');
    } finally {
      clearTimeout(timeout);
      if (id === request.current) setLocating(false);
    }
  }
  const search = () => {
    setSubmitted(query.trim());
    setSelectedId(null);
    setSearchOpen(false);
    Keyboard.dismiss();
    setView('list');
  };
  const notice =
    !noticeDismissed && (!!locationMessage || (failed && !placeError)) ? (
      <View className="flex-row flex-wrap items-center gap-1 rounded-2xl border border-border bg-card p-2">
        <Text
          variant="small"
          className="min-w-0 flex-1 px-2 font-normal"
          accessibilityLiveRegion="polite"
        >
          {locationMessage || '주문 연결 불가'}
        </Text>
        {failed && !locationMessage && (
          <Button
            variant="ghost"
            disabled={loading}
            accessibilityLabel="주문 연결 다시 시도"
            onPress={() => setRevision((value) => value + 1)}
          >
            <Text>{loading ? '확인 중' : '다시 시도'}</Text>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          accessibilityLabel="알림 닫기"
          onPress={() => {
            setNoticeDismissed(true);
            setLocationMessage('');
          }}
        >
          <Icon as={X} size={18} className="text-muted-foreground" accessible={false} />
        </Button>
      </View>
    ) : null;
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="gap-2 px-3 pb-2 pt-1">
        {searchOpen ? (
          <View className="flex-row items-center gap-1">
            <View className="min-w-0 flex-1 flex-row items-center rounded-2xl border border-input bg-card">
              <Input
                autoFocus
                className="min-w-0 flex-1 border-0 bg-transparent"
                accessibilityLabel="매장 이름 또는 주소 검색"
                placeholder="매장 또는 메뉴를 검색해보세요"
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                onSubmitEditing={search}
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
                  <Icon as={X} size={18} accessible={false} />
                </Button>
              )}
              <Button variant="ghost" size="icon" accessibilityLabel="검색 실행" onPress={search}>
                <Icon as={Search} size={21} className="text-primary" accessible={false} />
              </Button>
            </View>
            <Button
              variant="ghost"
              size="icon"
              accessibilityLabel="검색 닫기"
              onPress={() => setSearchOpen(false)}
            >
              <Icon as={X} size={21} accessible={false} />
            </Button>
          </View>
        ) : (
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <BrandLockup />
            <View className="flex-row items-center gap-1">
              <Button
                variant={query ? 'secondary' : 'ghost'}
                size="icon"
                accessibilityLabel="검색 열기"
                accessibilityState={{ expanded: false }}
                onPress={() => setSearchOpen(true)}
              >
                <Icon as={Search} size={22} className="text-primary" accessible={false} />
              </Button>
              <SegmentedControl
                iconsOnly
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
        )}
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
            query={submitted}
          />
        </View>
        {view === 'list' && (
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-3 px-4 py-3"
            keyboardShouldPersistTaps="handled"
          >
            {notice}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 pb-2"
              accessibilityRole="radiogroup"
              accessibilityLabel="장소 검색 종류"
            >
              {(
                [
                  'all',
                  'stations',
                  'audio_signals',
                  'voice_guides',
                  'tactile',
                  'crossings',
                ] as const
              ).map((kind) => (
                <Button
                  key={kind}
                  variant={searchKind === kind ? 'secondary' : 'outline'}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: searchKind === kind }}
                  onPress={() => {
                    setSearchKind(kind);
                    setAccess('all');
                  }}
                >
                  <Text>{featureLabels[kind]}</Text>
                </Button>
              ))}
            </ScrollView>
            {!!placeError && (
              <View className="gap-3 rounded-2xl border border-border bg-card p-4">
                <Text variant="h3">장소를 불러오지 못했어요</Text>
                <Text accessibilityRole="alert">{placeError}</Text>
                <Button
                  variant="outline"
                  onPress={() => {
                    setPlaceRevision((value) => value + 1);
                    if (failed) setRevision((value) => value + 1);
                  }}
                >
                  <Text>장소 검색 다시 시도</Text>
                </Button>
                <NavLink href="/settings" variant="ghost">
                  서버 연결 설정
                </NavLink>
              </View>
            )}
            {placeStatus?.generalSearch === 'not-configured' && (
              <Text variant="muted">
                일반 장소 검색은 준비 중이에요. 지하철역과 공공 접근성 자료는 검색할 수 있어요.
              </Text>
            )}
            {placeStatus?.generalSearch === 'unavailable' && placeStatus.status === 'results' && (
              <Text variant="muted">
                일반 장소 검색에 연결하지 못했어요. 지하철역 검색 결과만 표시합니다.
              </Text>
            )}
            {placeStatus?.status === 'needs-location' && (
              <Text>현재 위치를 허용하거나 지하철역 이름을 검색해 주세요.</Text>
            )}
            {placeStatus?.status === 'outside-coverage' && <Text>자료 제공 지역 밖이에요.</Text>}
            {placeStatus?.status === 'not-recorded' && (
              <Text>주변에 등록된 자료가 없어요. 시설이 없다는 뜻은 아니에요.</Text>
            )}
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Text variant="h2">{submitted ? '검색 결과' : '가까운 장소'}</Text>
              <Button variant="ghost" disabled={locating} onPress={() => void locate()}>
                <Icon as={LocateFixed} size={18} className="text-primary" accessible={false} />
                <Text>{locating ? '위치 확인 중…' : '내 주변에서 찾기'}</Text>
              </Button>
            </View>
            {!position && !submitted && !placeError && (
              <Text variant="muted">
                내 주변에서 찾기를 누르거나 검색 버튼으로 장소 이름을 입력해 주세요.
              </Text>
            )}
            {!!position && !submitted && searchKind === 'all' && (
              <Text variant="muted">주변 카페와 지하철역을 표시해요. 거리순으로 정렬합니다.</Text>
            )}
            {searchKind === 'all' && (
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
            )}
            {!placeError && (
              <Text variant="muted" accessibilityLiveRegion="polite">
                {placeLoading
                  ? '장소를 검색하고 있어요.'
                  : loading
                    ? '매장을 찾고 있어요…'
                    : `${stores.length} ${t('개의 장소')}`}
              </Text>
            )}
            {stores.map((store) => (
              <StoreCard
                key={store.storeId}
                store={store}
                showDistance={!!position || (searchKind !== 'all' && searchKind !== 'stations')}
                onPress={() => setSelectedId(store.storeId)}
              />
            ))}
            {!loading &&
              !placeLoading &&
              !failed &&
              !placeError &&
              !stores.length &&
              (!placeStatus || placeStatus.status === 'empty') && (
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
        {view === 'map' && notice && (
          <View className="absolute left-3 right-3 top-3">{notice}</View>
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
      {selected && <PlacePreview store={selected} onClose={() => setSelectedId(null)} />}
      <AppNavigation />
    </SafeAreaView>
  );
}
