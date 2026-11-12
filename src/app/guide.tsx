import { useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Problem } from '@/components/feedback';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Accessibility, MapPin, Navigation, Volume2 } from 'lucide-react-native';
import { knownText } from '@/lib/location';
import { useApp } from '@/providers/app-provider';
import { errorMessage } from '@/lib/api';
import type { Store } from '@/lib/types';
export default function Guide() {
  const app = useApp();
  const { width } = useWindowDimensions();
  const { storeId } = useLocalSearchParams<{ storeId?: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    setLoading(false);
    if (!storeId) {
      setStore(app.store ?? null);
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
  }, [storeId, app.api, app.store, revision]);
  const description = store
    ? `${store.name}. ${store.address}. ${store.accessibility.floor ? `${store.accessibility.floor}층.` : ''} ${knownText(store.accessibility.notes)} ${knownText(store.indoorDirections)}`
    : '매장을 먼저 선택해 주세요.';
  return (
    <Screen
      title="매장 · 실내 안내"
      subtitle="방문 전에 이동 정보를 확인하고, 안내를 소리로 들을 수 있어요."
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
            <Text className="mt-2 text-2xl font-bold text-primary-foreground">{store.name}</Text>
            <Text className="mt-2 text-primary-foreground">
              {store.address || '주소 확인 필요'}
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
                <Text variant="h3">접근성 메모</Text>
                <Text>
                  {store.accessibility.floor != null
                    ? `${store.accessibility.floor}층`
                    : '층수 확인 필요'}
                </Text>
                <Text>{knownText(store.accessibility.notes)}</Text>
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
                <Text variant="h3">실내 이동 경로</Text>
                <Text>{knownText(store.indoorDirections)}</Text>
              </CardContent>
            </Card>
          </View>
          <Text variant="muted">
            정보가 없거나 현장과 다르면 직원에게 이동 경로를 확인해 주세요.
          </Text>
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
      <Button disabled={loading || !store} onPress={() => app.announce(description)}>
        <Icon as={Volume2} size={19} />
        <Text>안내 듣기</Text>
      </Button>
      <NavLink
        href={
          store ? { pathname: '/menu', params: { storeId: store.storeId } } : { pathname: '/menu' }
        }
      >
        메뉴 보기
      </NavLink>
    </Screen>
  );
}
