import { venueAddress } from '@/lib/catalog';
import { useEffect, useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Problem } from '@/components/feedback';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Accessibility, MapPin, Navigation, Volume2 } from 'lucide-react-native';
import { accessDetails, knownText } from '@/lib/location';
import { directionsUrl } from '@/lib/navigation';
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
      subtitle="등록된 접근 정보를 읽거나 외부 지도에서 경로를 확인할 수 있어요."
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
            <Button
              variant="default"
              onPress={() => void Linking.openURL(directionsUrl(store)).catch(app.report)}
            >
              <Icon
                as={Navigation}
                size={19}
                className="text-primary-foreground"
                accessible={false}
              />
              <Text>지도 앱에서 길찾기</Text>
            </Button>
            <Text variant="muted">
              외부 지도에서 경로를 확인해요. 접근 가능한 경로인지는 별도 확인이 필요해요.
            </Text>
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
                <Card>
                  <CardContent className="gap-3 pt-6">
                    <Text variant="h3">접근성 정보</Text>
                    {details.map((detail, index) => (
                      <Text key={index} translate={false}>
                        {detail}
                      </Text>
                    ))}
                    <Text variant="h3">매장에 등록된 실내 이동 안내</Text>
                    <Text>{knownText(store.indoorDirections)}</Text>
                    <Button variant="outline" onPress={() => app.readAloud(description)}>
                      <Icon as={Volume2} size={19} className="text-primary" accessible={false} />
                      <Text>안내 듣기</Text>
                    </Button>
                  </CardContent>
                </Card>
              )}
              <NavLink href={{ pathname: '/menu', params: { storeId: store.storeId } }}>
                {store.hasOrderTerminal === false || store.orderingPaused
                  ? '메뉴 보기'
                  : '먼저 주문하기'}
              </NavLink>
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
