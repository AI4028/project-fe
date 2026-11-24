import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { ArrowUp, Compass, List, MapPin, Volume2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Problem } from '@/components/feedback';
import { KioskFinder } from '@/components/kiosk-finder';
import { NavLink, Screen } from '@/components/screen';
import { SpokenGroup } from '@/components/spoken-group';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/lib/api';
import { arrivalRadius, formatDistance, guidance } from '@/lib/direction';
import { useTranslation } from '@/lib/i18n';
import { distanceM, type Position } from '@/lib/location';
import type { Store } from '@/lib/types';
import { bleScanSupported } from '@/lib/use-ble-scan';
import { useHeading } from '@/lib/use-heading';
import { currentInstruction, isOffRoute, routeProgress, type WalkRoute } from '@/lib/walk-route';
import { useApp } from '@/providers/app-provider';

type Fix = Position & { accuracy: number | null };
type LocationState = 'asking' | 'watching' | 'denied' | 'failed';
type RouteState = 'waiting' | 'loading' | 'ready' | 'unavailable';

// Straight-line guidance: speak again only when it meaningfully changes, at most this often.
const ANNOUNCE_EVERY_MS = 6000;
/** Ask for a new route at most this often after leaving the line. */
const REROUTE_EVERY_MS = 20000;
const ARRIVED = '매장 근처에 도착했어요. 입구는 매장 안내나 직원에게 확인해 주세요.';

/**
 * In-app walk to the venue. Outdoors: a turn-by-turn walking route (길동무),
 * falling back to a straight-line arrow when no route is available. Indoors:
 * once the kiosk's Bluetooth signal is heard, its arrow and distance lead.
 */
export default function Direction() {
  const app = useApp();
  const { t, language } = useTranslation();
  const { storeId, name, lat, lng } = useLocalSearchParams<{
    storeId?: string;
    name?: string;
    lat?: string;
    lng?: string;
  }>();
  const directoryPlace = useMemo<Store | null>(() => {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!storeId || !name || !lat || !lng || !Number.isFinite(latitude + longitude)) return null;
    return {
      storeId,
      name,
      address: '',
      directoryOnly: true,
      accessibility: {},
      location: { lat: latitude, lng: longitude },
    };
  }, [storeId, name, lat, lng]);
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState('');
  const [fix, setFix] = useState<Fix | null>(null);
  const [locationState, setLocationState] = useState<LocationState>('asking');
  const { heading, status: compassStatus, request: allowCompass } = useHeading(!!storeId);
  const [route, setRoute] = useState<WalkRoute | null>(null);
  const [routeState, setRouteState] = useState<RouteState>('waiting');
  const [routeFrom, setRouteFrom] = useState<Position | null>(null);
  const [manualArrival, setManualArrival] = useState(false);
  const [bleHeard, setBleHeard] = useState(false);
  const lastSpoken = useRef({ key: '', at: 0 });
  const arrivedOnce = useRef(false);
  const lastRouteAt = useRef(0);
  const stepFloor = useRef(0);
  const offRoute = useRef(0);

  useEffect(() => {
    let active = true;
    if (directoryPlace) {
      setStore(directoryPlace);
      return;
    }
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
  }, [storeId, directoryPlace, app.api, app.store]);

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

  // The first position asks for a route; leaving it asks again from where we are.
  useEffect(() => {
    if (fix && venue && !routeFrom) setRouteFrom({ lat: fix.lat, lng: fix.lng });
  }, [fix, venue, routeFrom]);

  useEffect(() => {
    if (!routeFrom || !venue) return;
    let active = true;
    lastRouteAt.current = Date.now();
    // While re-routing, the old route stays on screen.
    setRouteState((current) => (current === 'ready' ? current : 'loading'));
    Promise.resolve()
      .then(() => app.api.walkRoute(routeFrom, venue, language))
      .then((next) => {
        if (!active) return;
        if (next.status === 'ok' && next.steps.length) {
          stepFloor.current = 0;
          offRoute.current = 0;
          setRoute(next);
          setRouteState('ready');
        } else {
          setRoute(null);
          setRouteState('unavailable');
        }
      })
      .catch(() => {
        if (active) setRouteState((current) => (current === 'ready' ? current : 'unavailable'));
      });
    return () => {
      active = false;
    };
  }, [routeFrom, venue, language, app.api]);

  const progress = route && fix ? routeProgress(route.steps, fix, stepFloor.current) : null;
  useEffect(() => {
    if (!route || !fix) return;
    const here = routeProgress(route.steps, fix, stepFloor.current);
    if (!here) return;
    stepFloor.current = Math.max(stepFloor.current, here.step);
    offRoute.current = isOffRoute(here, fix.accuracy) ? offRoute.current + 1 : 0;
    // Two fixes in a row off the line, so one GPS jump doesn't re-route.
    if (offRoute.current >= 2 && Date.now() - lastRouteAt.current > REROUTE_EVERY_MS) {
      offRoute.current = 0;
      app.announce('경로를 벗어나 새 경로를 찾고 있어요.');
      setRouteFrom({ lat: fix.lat, lng: fix.lng });
    }
  }, [fix, route, app]);

  const radius = arrivalRadius(fix?.accuracy);
  const arrived =
    manualArrival ||
    (!!fix && !!venue && distanceM(fix, venue) <= radius) ||
    (!!progress && progress.remainingM <= radius && progress.offRouteM < 30);
  const instruction = route && progress ? currentInstruction(route.steps, progress) : null;
  const upcoming = route && progress ? route.steps.slice(progress.step + 1) : [];
  const straight =
    routeState === 'unavailable' && fix && venue
      ? guidance(fix, venue, heading, fix.accuracy)
      : null;

  // One voice at a time: the kiosk finder speaks once its signal is heard.
  const speech = bleHeard
    ? null
    : arrived
      ? { key: 'arrived', text: ARRIVED, urgent: true }
      : instruction && progress
        ? {
            key: `route|${progress.step}|${progress.toTurnM <= 20 ? 'turn' : 'walk'}`,
            text: instruction.sentence,
            urgent: true,
          }
        : straight
          ? {
              key: `${straight.side ?? straight.compass}|${straight.distance}`,
              text: straight.sentence,
              urgent: false,
            }
          : null;

  useEffect(() => {
    if (!speech || speech.key === lastSpoken.current.key) return;
    const now = Date.now();
    const turned = lastSpoken.current.key.split('|')[0] !== speech.key.split('|')[0];
    if (!speech.urgent && !turned && now - lastSpoken.current.at < ANNOUNCE_EVERY_MS) return;
    lastSpoken.current = { key: speech.key, at: now };
    app.announce(speech.text);
    if (speech.key === 'arrived' && !arrivedOnce.current) {
      arrivedOnce.current = true;
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [speech?.key, speech?.text, speech?.urgent, app]);

  const displayName = store && (language === 'en' ? store.nameEn || store.name : store.name);
  const spokenNow = instruction?.sentence ?? straight?.sentence;

  const routeSection = (
    <View key="route" className="gap-4">
      {bleHeard ? (
        <Text variant="muted">키오스크 신호를 찾아 블루투스 안내로 바꿨어요.</Text>
      ) : (
        <>
          {store && !venue && (
            <Text>
              이 매장은 위치 정보가 없어 길을 안내할 수 없어요. 매장 직원에게 문의해 주세요.
            </Text>
          )}
          {venue && locationState === 'asking' && <Text>현재 위치를 확인하는 중이에요.</Text>}
          {venue && locationState === 'denied' && (
            <Text accessibilityRole="alert">
              위치 권한이 없어 길을 안내할 수 없어요. 설정에서 위치 권한을 허용해 주세요.
            </Text>
          )}
          {venue && locationState === 'failed' && (
            <Text accessibilityRole="alert">현재 위치를 확인하지 못했어요.</Text>
          )}
          {venue && fix && arrived && (
            <View
              testID="route-arrived"
              className="items-center gap-2 rounded-3xl bg-secondary p-6"
            >
              <Icon as={MapPin} size={56} className="text-primary" accessible={false} />
              <Text className="text-2xl font-bold">매장 근처예요</Text>
              <Text className="text-center">입구는 매장 안내나 직원에게 확인해 주세요.</Text>
            </View>
          )}
          {!arrived && instruction && progress && (
            <>
              <View className="gap-2 rounded-2xl border border-border bg-card p-4">
                <View className="flex-row items-center gap-2">
                  <Icon as={List} size={18} className="text-primary" accessible={false} />
                  <Text className="font-bold">현재 안내</Text>
                </View>
                <Text testID="route-now" className="text-xl font-bold">
                  {instruction.now}
                </Text>
                <Text variant="muted">{`총 ${formatDistance(progress.remainingM)} 남았어요`}</Text>
                <Text variant="muted">현재 위치를 기준으로 다음 안내가 갱신돼요.</Text>
              </View>
              {upcoming.length > 0 && (
                <View className="gap-2">
                  <Text variant="h4">이어서 갈 길</Text>
                  {upcoming.map((step, index) => (
                    <SpokenGroup
                      key={`${progress.step + 1 + index}`}
                      label={`${index + 1}. ${step.instruction}`}
                      className="gap-2 rounded-2xl border border-border bg-card p-4"
                    >
                      <View className="self-start rounded-md bg-primary px-2 py-0.5">
                        <Text
                          translate={false}
                          className="text-sm font-bold text-primary-foreground"
                        >
                          {String(index + 1).padStart(2, '0')}
                        </Text>
                      </View>
                      <Text translate={false}>{step.instruction}</Text>
                    </SpokenGroup>
                  ))}
                </View>
              )}
            </>
          )}
          {venue && fix && !arrived && !instruction && routeState !== 'unavailable' && (
            <Text accessibilityLiveRegion="polite">걷는 경로를 찾고 있어요.</Text>
          )}
          {!arrived && straight && (
            <>
              <Text variant="muted">
                걷는 경로를 불러오지 못해 매장까지의 직선 방향으로 안내해요. 실제 길과 다를 수
                있어요.
              </Text>
              <View className="items-center gap-2 rounded-3xl bg-card p-6">
                <Text translate={false} variant="h3" className="text-center">
                  {displayName}
                </Text>
                <View
                  className="my-4 h-40 w-40 items-center justify-center rounded-full border-4 border-primary"
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                >
                  {heading != null ? (
                    <View
                      testID="direction-arrow"
                      style={{ transform: [{ rotate: `${straight.relative ?? 0}deg` }] }}
                    >
                      <Icon as={ArrowUp} size={96} className="text-primary" />
                    </View>
                  ) : (
                    <Icon as={Compass} size={72} className="text-primary" />
                  )}
                </View>
                <Text className="text-4xl font-bold">{straight.distance}</Text>
                <Text className="text-center text-xl font-semibold">
                  {straight.side
                    ? `${straight.side} · ${straight.clock}시 방향`
                    : `${straight.compass} 방향`}
                </Text>
                {fix?.accuracy != null && fix.accuracy > 25 && (
                  <Text variant="muted" className="text-center">
                    위치 정확도가 낮아요 (약 {Math.round(fix.accuracy)}m). 건물 밖에서 더 정확해요.
                  </Text>
                )}
              </View>
              {compassStatus === 'needs-permission' && (
                <Button variant="outline" onPress={() => void allowCompass()}>
                  <Icon as={Compass} size={19} className="text-primary" accessible={false} />
                  <Text>나침반 허용하고 화살표 보기</Text>
                </Button>
              )}
              {compassStatus === 'unavailable' && (
                <Text variant="muted">
                  이 기기에서는 나침반을 쓸 수 없어 화살표 대신 방위로 안내해요.
                </Text>
              )}
            </>
          )}
          {!arrived && !!spokenNow && (
            <Button variant="default" onPress={() => app.readAloud(spokenNow)}>
              <Icon as={Volume2} size={19} className="text-primary-foreground" accessible={false} />
              <Text>지금 안내 듣기</Text>
            </Button>
          )}
          {!arrived && (instruction || straight) && (
            <Button variant="outline" onPress={() => setManualArrival(true)}>
              <Text>근처에 도착했어요</Text>
            </Button>
          )}
          {venue && (
            <Text variant="muted">
              차도와 계단에 주의하고, 입구는 매장 안내나 직원에게 확인해 주세요.
            </Text>
          )}
          {route && <Text variant="muted">경로 제공: 길동무</Text>}
        </>
      )}
    </View>
  );

  const kioskSection =
    storeId && !store?.directoryOnly ? (
      <View key="kiosk" className={bleHeard ? 'gap-3' : 'mt-4 gap-3 border-t border-border pt-6'}>
        <Text variant="h3">매장 안에서: 키오스크 찾기</Text>
        {bleScanSupported() ? (
          <>
            <Text variant="muted">
              매장 가까이 오면 키오스크의 블루투스 신호로 방향과 거리를 안내해요.
            </Text>
            <KioskFinder
              heading={heading}
              compassStatus={compassStatus}
              allowCompass={allowCompass}
              onBeacon={setBleHeard}
            />
          </>
        ) : (
          <Text variant="muted">
            이 기기에서는 키오스크 블루투스 신호를 읽을 수 없어요. 매장에 도착하면 직원에게 키오스크
            위치를 물어봐 주세요.
          </Text>
        )}
      </View>
    ) : null;

  return (
    <Screen
      title="매장까지 길 안내"
      subtitle={displayName ? `${t('목적지')} · ${displayName}` : undefined}
      voice={false}
    >
      {!!error && <Problem message={error} />}
      {!storeId && <Text>안내할 매장을 먼저 선택해 주세요.</Text>}
      {/* Keyed so the kiosk finder keeps scanning when it moves to the top. */}
      {bleHeard ? [kioskSection, routeSection] : [routeSection, kioskSection]}
      {storeId && (
        <NavLink
          href={{
            pathname: '/guide',
            params: directoryPlace ? { storeId, name, lat, lng } : { storeId },
          }}
        >
          길 안내로 돌아가기
        </NavLink>
      )}
    </Screen>
  );
}
