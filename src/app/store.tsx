import { VenueHours } from '@/components/venue-hours';
import { venueAddress } from '@/lib/catalog';
import { useEffect, useState } from 'react';
import { Image, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Navigation, ShoppingBag } from 'lucide-react-native';
import { OrderingPaused, Problem } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { knownText } from '@/lib/location';
import { errorMessage } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { StoreAccessibility } from '@/components/store-accessibility';
import { PlaceBookmark } from '@/components/place-actions';
import type { Store } from '@/lib/types';
export default function StoreDetails() {
  const app = useApp();
  const { language, t } = useTranslation();
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
    setLoading(false);
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
  const paired = !!app.connection?.kioskId && app.connection.storeId === id;
  return (
    <Screen
      title={(language === 'en' ? store?.nameEn || store?.name : store?.name) ?? '매장 정보'}
      subtitle={venueAddress(store, language) || '방문에 필요한 정보를 한눈에 확인하세요.'}
      footer={
        store &&
        !store.directoryOnly &&
        (paired || (!store.orderingPaused && store.hasOrderTerminal !== false)) ? (
          <NavLink
            href={{ pathname: paired ? '/menu' : '/connect', params: { storeId: store.storeId } }}
            variant="default"
            icon={ShoppingBag}
          >
            {paired ? '메뉴 보기' : '키오스크에 연결해 주문하기'}
          </NavLink>
        ) : undefined
      }
      onTranscript={(text) => {
        if (!id) return false;
        if (/메뉴.*(읽|알려)|\bread (?:the )?menu\b/i.test(text)) {
          const preview = paired ? app.store?.menu : undefined;
          if (preview?.length) {
            app.readAloud(
              preview
                .map(
                  (item) =>
                    `${language === 'en' ? item.nameEn || item.name : item.name} ${t(`${item.price.toLocaleString('ko-KR')}원`)}${item.available ? '' : ` ${t('품절')}`}`,
                )
                .join(', '),
            );
          } else {
            router.push({ pathname: paired ? '/menu' : '/connect', params: { storeId: id } });
          }
          return true;
        }
        if (/메뉴|\bmenu\b/i.test(text)) {
          router.push({ pathname: paired ? '/menu' : '/connect', params: { storeId: id } });
          return true;
        }
        if (/길|실내|어디|\bdirections\b/i.test(text)) {
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
          <Card className="rounded-3xl">
            <CardContent className="gap-3">
              {store.imageUrl && (
                <Image
                  accessible={false}
                  source={{ uri: store.imageUrl }}
                  className="h-48 w-full rounded-2xl bg-secondary"
                />
              )}
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <Text variant="h3">매장 이용 정보</Text>
                <PlaceBookmark store={store} />
              </View>
              <VenueHours store={store} />
              <NavLink
                href={{ pathname: '/guide', params: { storeId: store.storeId } }}
                icon={Navigation}
              >
                길 안내
              </NavLink>
            </CardContent>
          </Card>
          {store.orderingPaused && <OrderingPaused />}
          <View className="flex-row flex-wrap gap-4">
            <View className="min-w-0" style={{ width: width >= 760 ? '48%' : '100%' }}>
              <StoreAccessibility key={store.storeId} store={store} />
            </View>
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
                <NavLink
                  href={{
                    pathname: '/guide',
                    params: { storeId: store.storeId, section: 'access' },
                  }}
                >
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
              ) : null}
            </CardContent>
          </Card>
          <NavLink href={{ pathname: '/help', params: { storeId: store.storeId, from: 'store' } }}>
            다른 주문 방법 · 직원에게 문의
          </NavLink>
        </>
      )}
      <NavLink href="/">다른 매장 찾기</NavLink>
    </Screen>
  );
}
