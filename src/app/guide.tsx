import { venueAddress } from '@/lib/catalog';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { StoreAccessibility } from '@/components/store-accessibility';
import { Problem } from '@/components/feedback';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Accessibility, MapPin, Navigation, Volume2 } from 'lucide-react-native';
import { accessDetails, knownText } from '@/lib/location';
import { useTranslation } from '@/lib/i18n';
import { useApp } from '@/providers/app-provider';
import { errorMessage } from '@/lib/api';
import type { Store } from '@/lib/types';
export default function Guide() {
  const app = useApp();
  const { t, language } = useTranslation();
  const { storeId, name, address, lat, lng, section, stage } = useLocalSearchParams<{
    storeId?: string;
    section?: string;
    stage?: string;
    name?: string;
    address?: string;
    lat?: string;
    lng?: string;
  }>();
  const directoryPlace = useMemo<Store | null>(() => {
    if (!storeId || !name) return null;
    const latitude = Number(lat);
    const longitude = Number(lng);
    const hasCoordinates = !!lat && !!lng && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
    return {
      storeId,
      name,
      address: address ?? '',
      directoryOnly: true,
      accessibility: {},
      location: hasCoordinates ? { lat: latitude, lng: longitude } : undefined,
    };
  }, [storeId, name, address, lat, lng]);
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    setLoading(false);
    if (directoryPlace || !storeId) {
      setStore(directoryPlace ?? app.store ?? null);
      return;
    }
    if (app.store?.storeId === storeId) {
      setStore(app.store);
      return;
    }
    setStore(null);
    setLoading(true);
    void app.api
      .store(storeId)
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
  }, [storeId, app.api, app.store, revision, directoryPlace]);
  const displayName = store && (language === 'en' ? store.nameEn || store.name : store.name);
  const accessOpen = section === 'access' || (!section && stage === 'details');
  const details = store && !store.directoryOnly ? accessDetails(store, t) : [];
  const description = store
    ? [
        displayName,
        venueAddress(store, language),
        ...details,
        t('매장에 등록된 실내 이동 안내'),
        t(knownText(store.indoorDirections)),
      ]
        .filter(Boolean)
        .join('. ')
    : '';
  return (
    <Screen
      title="매장으로 길 안내"
      subtitle="매장까지 걷는 길을 안내받거나 등록된 접근 정보를 읽을 수 있어요."
      voice={false}
    >
      {!!error && (
        <Problem message={error} busy={loading} retry={() => setRevision((value) => value + 1)} />
      )}
      {loading && <Text accessibilityLiveRegion="polite">매장 안내를 불러오는 중입니다.</Text>}
      {store ? (
        <>
          <View className="rounded-3xl bg-primary p-6 sm:p-8">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-background">
              <Icon as={MapPin} size={24} className="text-primary" />
            </View>
            <Text className="mt-4 text-sm font-semibold text-primary-foreground">방문할 매장</Text>
            <Text translate={false} className="mt-2 text-2xl font-bold text-primary-foreground">
              {displayName}
            </Text>
            <Text className="mt-2 text-primary-foreground">
              {venueAddress(store, language) || '주소 확인 필요'}
            </Text>
          </View>
          <View className="gap-2">
            {store.location ? (
              <>
                <Button
                  variant="default"
                  onPress={() =>
                    router.push({
                      pathname: '/direction',
                      params: store.directoryOnly
                        ? {
                            storeId: store.storeId,
                            name: store.name,
                            lat: String(store.location!.lat),
                            lng: String(store.location!.lng),
                          }
                        : { storeId: store.storeId },
                    })
                  }
                >
                  <Icon
                    as={Navigation}
                    size={19}
                    className="text-primary-foreground"
                    accessible={false}
                  />
                  <Text>길 안내 시작</Text>
                </Button>
                <Text variant="muted">
                  현재 위치에서 매장까지 걷는 길을 안내해요. 매장 가까이에서 키오스크 신호가 잡히면
                  키오스크까지 안내해요.
                </Text>
              </>
            ) : (
              <Text variant="muted">
                이 장소는 위치 정보가 없어 길을 안내할 수 없어요. 매장 직원에게 문의해 주세요.
              </Text>
            )}
          </View>
          {store.directoryOnly ? (
            <Text variant="muted">이 장소에는 등록된 실내 이동 안내가 없어요.</Text>
          ) : (
            <>
              <Button
                variant="outline"
                accessibilityState={{ expanded: accessOpen }}
                onPress={() => router.setParams({ section: accessOpen ? 'overview' : 'access' })}
              >
                <Icon as={Accessibility} size={20} className="text-primary" accessible={false} />
                <Text>{accessOpen ? '접근 정보 접기' : '등록된 접근 정보 보기'}</Text>
              </Button>
              {accessOpen && (
                <View className="gap-4">
                  <StoreAccessibility key={store.storeId} store={store} />
                  <Card>
                    <CardContent className="gap-3 pt-6">
                      <Text variant="h3">매장에 등록된 실내 이동 안내</Text>
                      <Text>{knownText(store.indoorDirections)}</Text>
                      <Button variant="outline" onPress={() => app.readAloud(description)}>
                        <Icon as={Volume2} size={19} className="text-primary" accessible={false} />
                        <Text>안내 듣기</Text>
                      </Button>
                    </CardContent>
                  </Card>
                </View>
              )}
              {app.connection?.kioskId && app.connection.storeId === store.storeId ? (
                <NavLink href={{ pathname: '/menu', params: { storeId: store.storeId } }}>
                  메뉴 보기
                </NavLink>
              ) : !store.orderingPaused && store.hasOrderTerminal !== false ? (
                <NavLink href={{ pathname: '/connect', params: { storeId: store.storeId } }}>
                  키오스크에 연결해 주문하기
                </NavLink>
              ) : null}
              <NavLink
                href={{
                  pathname: '/help',
                  params: {
                    storeId: store.storeId,
                    from: 'guide',
                    ...(accessOpen && { section: 'access' }),
                  },
                }}
              >
                직원에게 문의
              </NavLink>
              <NavLink href={{ pathname: '/store', params: { storeId: store.storeId } }}>
                매장 정보 보기
              </NavLink>
            </>
          )}
        </>
      ) : !loading && !error ? (
        <Card className="rounded-3xl">
          <CardContent className="gap-3 pt-6">
            <Text variant="h3">매장을 먼저 선택해 주세요</Text>
            <Text>매장을 선택하면 실내 이동 정보를 확인할 수 있어요.</Text>
            <NavLink href="/">매장 찾기</NavLink>
          </CardContent>
        </Card>
      ) : null}
      <Button
        variant="ghost"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      >
        <Text>안내 닫기</Text>
      </Button>
    </Screen>
  );
}
