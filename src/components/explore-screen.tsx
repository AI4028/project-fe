import { AppNavigation } from '@/components/app-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Linking, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { ReceiptText, LocateFixed, MapPin, Mic, Search, X } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import StoreMap from '@/components/store-map';

import { PlacePreview } from '@/components/place-preview';
import { StoreCard } from '@/components/store-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { VoiceSearch } from '@/components/voice-search';
import { SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { filterStores } from '@/lib/discovery';
import { distanceM, type Position } from '@/lib/location';
import { placeSearchUrl } from '@/lib/navigation';
import type { Store, PlaceSearchResult } from '@/lib/types';
import { displayPlace } from '@/lib/place-search';
import { useTranslation } from '@/lib/i18n';
import { errorMessage } from '@/lib/api';
import { layout } from '@/lib/theme';
import { useScreenFocus } from '@/lib/use-screen-focus';

type Presentation = 'list' | 'map';

export function ExploreScreen({ initialView }: { initialView: Presentation }) {
  const app = useApp();
  const { t, language } = useTranslation();
  const [view, setView] = useState(app.settings.exploreMode ?? initialView);
  const [savingView, setSavingView] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const mic = useRef<{ start: () => void }>(null);
  const heading = useRef(null);
  useScreenFocus(heading);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [panelTop, setPanelTop] = useState(64);
  const { height } = useWindowDimensions();
  const [submitted, setSubmitted] = useState('');
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
  const request = useRef(0);
  useEffect(() => {
    if (app.settings.exploreMode) setView(app.settings.exploreMode);
  }, [app.settings.exploreMode]);
  useFocusEffect(useCallback(() => () => setVoiceOpen(false), []));
  useEffect(() => {
    let active = true;
    setPlaces([]);
    setPlaceStatus(null);
    setPlaceError('');
    if (!submitted && !position) {
      setPlaceLoading(false);
      return;
    }
    setPlaceLoading(true);
    void app.api
      .searchPlaces(submitted, 'all', position)
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
  }, [app.api, submitted, position, language, placeRevision]);
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
    const merged = [...filterStores(nearbyRegistered, submitted, 'all'), ...places];
    const seen = new Set<string>();
    const filtered = merged.filter((store) => {
      if (seen.has(store.storeId)) return false;
      seen.add(store.storeId);
      return true;
    });
    return position
      ? filtered
          .map((store) => ({
            ...store,
            distanceM: store.location ? Math.round(distanceM(position, store.location)) : undefined,
          }))
          .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
      : filtered;
  }, [registered, places, position, submitted]);
  const selected = stores.find((store) => store.storeId === selectedId);
  const mapStores = stores;
  async function locate() {
    setSearchOpen(false);
    Keyboard.dismiss();
    setSelectedId(null);
    setQuery('');
    setSubmitted('');
    setPosition(null);
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
  useEffect(() => {
    if (app.settings.locateOnStart) void locate();
  }, [app.settings.locateOnStart]);
  function search(value = query) {
    const next = value.trim();
    request.current++;
    setLocating(false);
    if (next && app.settings.saveRecentSearches !== false)
      void app.rememberSearch(next).catch(app.report);
    setLocationMessage('');
    setQuery(next);
    if (submitted === next) setPlaceRevision((revision) => revision + 1);
    setSubmitted(next);
    setSelectedId(null);
    setSearchOpen(false);
    setVoiceOpen(false);
    Keyboard.dismiss();
  }
  function openSearch() {
    setQuery(submitted);
    setSearchOpen(true);
  }
  function resetSearch() {
    setPosition(null);
    setNoticeDismissed(false);
    search('');
  }
  async function changeView(next: Presentation) {
    if (next === view || savingView) return;
    setView(next);
    setSavingView(true);
    try {
      await app.updateSettings({ exploreMode: next });
    } catch (reason) {
      app.report(reason);
    } finally {
      setSavingView(false);
    }
  }
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
        {!!locationMessage && !position && (
          <View className="w-full flex-row flex-wrap gap-2">
            <Button variant="outline" onPress={openSearch}>
              <Text>매장 이름이나 주소 입력</Text>
            </Button>
            <Button variant="outline" onPress={() => router.push('/settings/permissions')}>
              <Text>기기 권한 확인</Text>
            </Button>
            <Button variant="outline" disabled={locating} onPress={() => void locate()}>
              <Text>위치 다시 확인하기</Text>
            </Button>
            <Button variant="ghost" onPress={resetSearch}>
              <Text>전체 매장 보기</Text>
            </Button>
          </View>
        )}
        {!!locationMessage && !!position && (
          <Button variant="ghost" onPress={resetSearch}>
            <Text>전체 매장 보기</Text>
          </Button>
        )}
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
  const searchFeedback = (
    <>
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
        </View>
      )}
      {placeStatus?.generalSearch === 'not-configured' && (
        <Text variant="muted">등록 매장과 공공 자료에서 찾은 결과예요.</Text>
      )}
      {placeStatus?.generalSearch === 'unavailable' && placeStatus.status === 'results' && (
        <Text variant="muted">
          일반 장소 검색에 연결하지 못했어요. 찾은 등록 매장과 공공 자료를 표시합니다.
        </Text>
      )}
      {placeStatus?.status === 'needs-location' && (
        <Text>현재 위치를 허용하거나 지하철역 이름을 검색해 주세요.</Text>
      )}
      {placeStatus?.status === 'outside-coverage' && <Text>자료 제공 지역 밖이에요.</Text>}
      {placeStatus?.status === 'not-recorded' && (
        <Text>주변에 등록된 자료가 없어요. 시설이 없다는 뜻은 아니에요.</Text>
      )}
    </>
  );
  const settled = !loading && !placeLoading;
  const emptyCatalog =
    !!submitted &&
    settled &&
    !placeError &&
    !stores.length &&
    (placeStatus?.status === 'empty' ||
      (placeStatus?.status === 'unavailable' && placeStatus.generalSearch === 'not-configured'));
  const resultCount = (
    <View className="min-w-0 shrink gap-1">
      {!!submitted && (
        <Text variant="h2" translate={false}>
          {language === 'en' ? `Results for “${submitted}”` : `“${submitted}” 검색 결과`}
        </Text>
      )}
      {!placeError && (!failed || stores.length > 0) && !emptyCatalog && (
        <Text variant="muted" accessibilityLiveRegion="polite">
          {placeLoading
            ? '장소를 검색하고 있어요.'
            : loading
              ? '매장을 찾고 있어요…'
              : submitted && stores.length
                ? t(`장소 ${stores.length}곳을 찾았어요`)
                : t(`${stores.length} 개의 장소`)}
        </Text>
      )}
      {!!submitted && !emptyCatalog && (
        <Button variant="ghost" onPress={resetSearch}>
          <Text>전체 매장 보기</Text>
        </Button>
      )}
    </View>
  );
  const noResults =
    emptyCatalog ||
    (!submitted &&
      settled &&
      !failed &&
      !placeError &&
      !stores.length &&
      (!placeStatus || placeStatus.status === 'empty'));
  const emptyResults = noResults && (
    <View className="gap-3 rounded-2xl border border-border bg-card p-4">
      <Text variant="h3" accessibilityLiveRegion="polite">
        검색 결과가 없어요
      </Text>
      <Text variant="muted">다른 매장명이나 메뉴로 찾아보세요.</Text>
      <View className="flex-row flex-wrap gap-2">
        <Button variant="outline" onPress={openSearch}>
          <Text>검색어 수정</Text>
        </Button>
        <Button variant="ghost" onPress={resetSearch}>
          <Text>전체 매장 보기</Text>
        </Button>
      </View>
    </View>
  );
  const matchesDraft = (term: string) =>
    term.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const recent =
    app.settings.saveRecentSearches === false
      ? []
      : (app.settings.recentSearches ?? []).filter(matchesDraft);
  const suggestions = new globalThis.Map<string, '매장' | '메뉴'>();
  for (const store of registered) {
    const name = (language === 'en' && store.nameEn) || store.name;
    if (matchesDraft(name)) suggestions.set(name, '매장');
    for (const item of store.menuSuggestions ?? []) {
      const term = (language === 'en' && item.nameEn) || item.name;
      if (matchesDraft(term) && !suggestions.has(term)) suggestions.set(term, '메뉴');
    }
  }
  const searchOptions = searchOpen && (recent.length > 0 || suggestions.size > 0) && (
    <View
      className="absolute left-6 right-6 z-20 rounded-[14px] border border-search-border bg-card"
      style={{ top: panelTop, maxHeight: height * 0.36 }}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-1 p-2">
        {!!recent.length && <Text variant="h2">최근 검색어</Text>}
        {recent.map((term) => (
          <Button
            key={term}
            variant="ghost"
            className="justify-start"
            accessibilityLabel={term}
            onPress={() => search(term)}
          >
            <Text translate={false}>{term}</Text>
          </Button>
        ))}
        {!!suggestions.size && <Text variant="h2">추천 검색어</Text>}
        {Array.from(suggestions)
          .slice(0, 6)
          .map(([term, kind]) => (
            <Button
              key={term}
              variant="ghost"
              className="justify-between"
              accessibilityLabel={`${term}, ${t(kind)}`}
              onPress={() => search(term)}
            >
              <Text translate={false}>{term}</Text>
              <Text variant="muted">{kind}</Text>
            </Button>
          ))}
      </ScrollView>
    </View>
  );
  function openVoice() {
    setSearchOpen(false);
    Keyboard.dismiss();
    mic.current?.start();
    setVoiceOpen(true);
  }
  return (
    <SafeAreaView className="flex-1 bg-card" edges={['top', 'left', 'right']}>
      <View className="min-h-0 flex-1 bg-background">
        {Platform.OS === 'web' && (
          <Text ref={heading} variant="h1" className="sr-only">
            매장 찾기
          </Text>
        )}
        <VoiceSearch
          open={voiceOpen}
          mic={mic}
          query={query}
          onSearch={search}
          onEdit={(value) => {
            setQuery(value);
            setVoiceOpen(false);
            setSearchOpen(true);
          }}
          onClose={() => setVoiceOpen(false)}
        />
        {!voiceOpen && (
          <View
            className="min-h-0 w-full flex-1 self-center"
            style={{ maxWidth: view === 'list' ? layout.readingWidth : layout.shellWidth }}
          >
            <View
              className="px-6 pt-2"
              onLayout={({ nativeEvent: { layout } }) => setPanelTop(layout.y + layout.height)}
            >
              {searchOpen ? (
                <View className="min-h-[56px] flex-row items-center gap-1 rounded-[14px] border border-search-border bg-card px-2 web:focus-within:ring-2 web:focus-within:ring-ring">
                  <Button
                    variant="secondary"
                    size="icon"
                    accessibilityLabel="말로 검색"
                    onPress={openVoice}
                  >
                    <Icon
                      as={Mic}
                      size={24}
                      strokeWidth={2.4}
                      className="text-primary"
                      accessible={false}
                    />
                  </Button>
                  <View className="min-w-0 flex-1 flex-row items-center">
                    <Input
                      autoFocus
                      className="min-h-12 min-w-0 flex-1 border-0 bg-transparent px-1 web:focus-visible:ring-0 web:focus-visible:ring-offset-0"
                      accessibilityLabel="매장 또는 메뉴 검색"
                      maxLength={100}
                      placeholder={t('매장 또는 메뉴 검색')}
                      value={query}
                      onChangeText={setQuery}
                      returnKeyType="search"
                      onSubmitEditing={() => search()}
                    />
                    {!!query && (
                      <Button
                        variant="ghost"
                        size="icon"
                        accessibilityLabel="검색어 지우기"
                        onPress={() => {
                          setQuery('');
                        }}
                      >
                        <Icon as={X} size={18} accessible={false} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      accessibilityLabel="검색 실행"
                      onPress={() => search()}
                    >
                      <Icon
                        as={Search}
                        size={24}
                        strokeWidth={2.4}
                        className="text-primary"
                        accessible={false}
                      />
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
                <View className="min-h-[56px] flex-row items-center rounded-[14px] border border-search-border bg-card px-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    accessibilityLabel="말로 검색"
                    onPress={openVoice}
                  >
                    <Icon
                      as={Mic}
                      size={24}
                      strokeWidth={2.4}
                      className="text-primary"
                      accessible={false}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-12 min-w-0 flex-1 justify-start px-2 py-1"
                    accessibilityLabel="매장 또는 메뉴 검색"
                    accessibilityState={{ expanded: false }}
                    onPress={openSearch}
                  >
                    {submitted ? (
                      <Text
                        translate={false}
                        className="flex-1 text-left text-base font-normal"
                        numberOfLines={1}
                      >
                        {submitted}
                      </Text>
                    ) : (
                      <Text
                        variant="muted"
                        className="flex-1 text-left text-base font-normal"
                        numberOfLines={1}
                      >
                        매장 또는 메뉴 검색
                      </Text>
                    )}
                    <Icon
                      as={Search}
                      size={24}
                      strokeWidth={2.4}
                      className="text-primary"
                      accessible={false}
                    />
                  </Button>
                </View>
              )}
            </View>
            {searchOptions}
            <View className="px-3 py-2">
              <SegmentedControl
                mapChoice
                value={view}
                onChange={(next) => void changeView(next)}
                disabled={savingView}
                label={t('매장 보기 방식')}
                options={[
                  { value: 'list', label: '글 지도', icon: ReceiptText },
                  { value: 'map', label: '그림 지도', icon: MapPin },
                ]}
              />
            </View>
            <View className="min-h-0 flex-1">
              {view === 'map' && (
                <View className="flex-1">
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
              )}
              {view === 'list' && (
                <ScrollView
                  className="flex-1"
                  contentContainerClassName="gap-3 px-4 py-3"
                  keyboardShouldPersistTaps="handled"
                >
                  {notice}
                  {searchFeedback}
                  <View className="flex-row flex-wrap items-center justify-between gap-2">
                    {resultCount}
                    <Button
                      variant="ghost"
                      accessibilityLabel={locating ? '위치 확인 중…' : '내 주변에서 찾기'}
                      accessibilityState={{ busy: locating }}
                      disabled={locating}
                      onPress={() => void locate()}
                    >
                      <Icon
                        as={LocateFixed}
                        size={18}
                        className="text-primary"
                        accessible={false}
                      />
                      <Text>{locating ? '위치 확인 중…' : '내 주변에서 찾기'}</Text>
                    </Button>
                  </View>
                  {stores.map((store) => (
                    <StoreCard
                      key={store.storeId}
                      store={store}
                      actions
                      showDistance={!!position}
                      onPress={() =>
                        store.directoryOnly
                          ? setSelectedId(store.storeId)
                          : router.push({ pathname: '/store', params: { storeId: store.storeId } })
                      }
                    />
                  ))}
                  {emptyResults}

                  <SubmissionRecovery />
                </ScrollView>
              )}
              {view === 'map' &&
                (notice || placeError || placeStatus || placeLoading || noResults) && (
                  <View className="absolute left-3 right-3 top-3" style={{ maxHeight: '55%' }}>
                    <ScrollView
                      contentContainerClassName="gap-3 rounded-2xl border border-border bg-card p-3"
                      keyboardShouldPersistTaps="handled"
                    >
                      {notice}
                      {searchFeedback}
                      {(submitted || position || placeLoading) && resultCount}
                      {emptyResults}
                      {!!placeError && (
                        <Button
                          variant="outline"
                          onPress={() =>
                            void Linking.openURL(placeSearchUrl(submitted)).catch(app.report)
                          }
                        >
                          <Text>지도 앱에서 검색</Text>
                        </Button>
                      )}
                    </ScrollView>
                  </View>
                )}
              {view === 'map' && !selected && !!stores.length && (
                <View className="absolute bottom-4 left-3 right-20">
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerClassName="gap-2"
                    keyboardShouldPersistTaps="handled"
                    accessibilityLabel="장소 선택"
                  >
                    {stores.map((store) => (
                      <Button
                        key={store.storeId}
                        variant="outline"
                        className="max-w-64 items-start"
                        accessibilityLabel={`${language === 'en' ? store.nameEn || store.name : store.name} 매장 정보 보기`}
                        onPress={() => setSelectedId(store.storeId)}
                      >
                        <Text translate={false} className="text-left">
                          {language === 'en' ? store.nameEn || store.name : store.name}
                        </Text>
                      </Button>
                    ))}
                  </ScrollView>
                </View>
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
            {selected && (view === 'map' || selected.directoryOnly) && (
              <ScrollView
                style={{ flexGrow: 0, maxHeight: '46%' }}
                keyboardShouldPersistTaps="handled"
              >
                <PlacePreview store={selected} onClose={() => setSelectedId(null)} />
              </ScrollView>
            )}
          </View>
        )}
      </View>
      <AppNavigation />
      <SafeAreaView edges={['bottom']} className="bg-card" />
    </SafeAreaView>
  );
}
