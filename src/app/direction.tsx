import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { ArrowUp, Compass, MapPin, Volume2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Problem } from '@/components/feedback';
import { NavLink, Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/lib/api';
import { guidance } from '@/lib/direction';
import { useTranslation } from '@/lib/i18n';
import type { Position } from '@/lib/location';
import type { Store } from '@/lib/types';
import { useHeading } from '@/lib/use-heading';
import { useApp } from '@/providers/app-provider';

type Fix = Position & { accuracy: number | null };
type LocationState = 'asking' | 'watching' | 'denied' | 'failed';

// Speak again only when the guidance meaningfully changes, at most this often.
const ANNOUNCE_EVERY_MS = 6000;

export default function Direction() {
  const app = useApp();
  const { language } = useTranslation();
  const { storeId } = useLocalSearchParams<{ storeId?: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState('');
  const [fix, setFix] = useState<Fix | null>(null);
  const [locationState, setLocationState] = useState<LocationState>('asking');
  const { heading, status: compassStatus, request: allowCompass } = useHeading(!!store?.location);
  const lastSpoken = useRef({ key: '', at: 0 });
  const arrivedOnce = useRef(false);

  useEffect(() => {
    let active = true;
    if (!storeId) return;
    if (app.store?.storeId === storeId) {
      setStore(app.store);
      return;
    }
    void app.api
      .store(storeId)
      .then((value) => active && setStore(value))
      .catch((reason) => active && setError(errorMessage(reason)));
    return () => {
      active = false;
    };
  }, [storeId, app.api, app.store]);

  useEffect(() => {
    if (!store?.location) return;
    let subscription: { remove: () => void } | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          if (!cancelled) setLocationState('denied');
          return;
        }
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 2 },
          (reading) => {
            setFix({
              lat: reading.coords.latitude,
              lng: reading.coords.longitude,
              accuracy: reading.coords.accuracy ?? null,
            });
            setLocationState('watching');
          },
        );
        if (cancelled) sub.remove();
        else subscription = sub;
      } catch {
        if (!cancelled) setLocationState('failed');
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [store?.location]);

  const venue = store?.location ?? null;
  const guide = fix && venue ? guidance(fix, venue, heading, fix.accuracy) : null;

  // Announce direction changes for screen reader and speech users.
  useEffect(() => {
    if (!guide) return;
    const key = guide.arrived ? 'arrived' : `${guide.side ?? guide.compass}|${guide.distance}`;
    const now = Date.now();
    if (key === lastSpoken.current.key) return;
    const directionChanged = lastSpoken.current.key.split('|')[0] !== key.split('|')[0];
    if (!guide.arrived && !directionChanged && now - lastSpoken.current.at < ANNOUNCE_EVERY_MS)
      return;
    lastSpoken.current = { key, at: now };
    app.announce(guide.sentence);
    if (guide.arrived && !arrivedOnce.current) {
      arrivedOnce.current = true;
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [guide, app]);

  const displayName = store && (language === 'en' ? store.nameEn || store.name : store.name);
  // Arrow points up = straight ahead; rotate by the venue's angle relative to the phone.
  const rotation = guide?.relative ?? 0;

  return (
    <Screen
      title="매장 방향 안내"
      subtitle="현재 위치에서 매장까지의 직선 방향과 거리예요. 실제 길과 다를 수 있어요."
      voice={false}
    >
      {!!error && <Problem message={error} />}
      {!storeId && <Text>안내할 매장을 먼저 선택해 주세요.</Text>}
      {store && !store.location && (
        <Text>
          이 매장은 위치 정보가 없어 방향을 안내할 수 없어요. 지도 앱에서 주소로 찾아 주세요.
        </Text>
      )}
      {store?.location && (
        <View className="gap-5">
          <View className="items-center gap-2 rounded-3xl bg-card p-6">
            <Text translate={false} variant="h3" className="text-center">
              {displayName}
            </Text>
            {locationState === 'asking' && <Text>현재 위치를 확인하는 중이에요.</Text>}
            {locationState === 'denied' && (
              <Text accessibilityRole="alert">
                위치 권한이 없어 방향을 안내할 수 없어요. 설정에서 위치 권한을 허용해 주세요.
              </Text>
            )}
            {locationState === 'failed' && (
              <Text accessibilityRole="alert">현재 위치를 확인하지 못했어요.</Text>
            )}
            {guide && (
              <>
                <View
                  className="my-4 h-40 w-40 items-center justify-center rounded-full border-4 border-primary"
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                >
                  {guide.arrived ? (
                    <Icon as={MapPin} size={72} className="text-primary" />
                  ) : heading != null ? (
                    <View
                      testID="direction-arrow"
                      style={{ transform: [{ rotate: `${rotation}deg` }] }}
                    >
                      <Icon as={ArrowUp} size={96} className="text-primary" />
                    </View>
                  ) : (
                    <Icon as={Compass} size={72} className="text-primary" />
                  )}
                </View>
                <Text className="text-4xl font-bold">
                  {guide.arrived ? '도착' : guide.distance}
                </Text>
                <Text className="text-center text-xl font-semibold">
                  {guide.arrived
                    ? '매장 근처예요'
                    : guide.side
                      ? `${guide.side} · ${guide.clock}시 방향`
                      : `${guide.compass} 방향`}
                </Text>
                {fix?.accuracy != null && fix.accuracy > 25 && !guide.arrived && (
                  <Text variant="muted" className="text-center">
                    위치 정확도가 낮아요 (약 {Math.round(fix.accuracy)}m). 건물 밖에서 더 정확해요.
                  </Text>
                )}
              </>
            )}
          </View>

          {compassStatus === 'needs-permission' && !guide?.arrived && (
            <Button variant="outline" onPress={() => void allowCompass()}>
              <Icon as={Compass} size={19} className="text-primary" accessible={false} />
              <Text>나침반 허용하고 화살표 보기</Text>
            </Button>
          )}
          {compassStatus === 'unavailable' && !guide?.arrived && (
            <Text variant="muted">
              이 기기에서는 나침반을 쓸 수 없어 화살표 대신 방위로 안내해요.
            </Text>
          )}
          {guide && (
            <Button variant="default" onPress={() => app.readAloud(guide.sentence)}>
              <Icon as={Volume2} size={19} className="text-primary-foreground" accessible={false} />
              <Text>지금 방향 듣기</Text>
            </Button>
          )}
          <Text variant="muted">
            휴대폰을 몸 앞에 수평으로 들고 천천히 돌려 보세요. 화살표가 매장 쪽을 가리켜요. 차도와
            계단에 주의하고, 입구는 매장 안내나 직원에게 확인해 주세요.
          </Text>
          <NavLink href="/find-kiosk">매장 안에서: 블루투스로 키오스크 찾기 (테스트)</NavLink>
          {storeId && (
            <NavLink href={{ pathname: '/guide', params: { storeId } }}>길 안내로 돌아가기</NavLink>
          )}
        </View>
      )}
    </Screen>
  );
}
