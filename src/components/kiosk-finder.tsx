import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowUp, Bluetooth, Compass, RotateCw, Volume2, VolumeX } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  DEFAULT_RSSI_AT_1M,
  distanceStep,
  estimateDirection,
  estimateDistanceM,
  hotCold,
  locateBeacon,
  signalFaded,
  turnCoverage,
  type HeatLevel,
  type Located,
  type Sample,
  type TrackSample,
} from '@/lib/ble-direction';
import { clockPosition, relativeDeg, sideLabel } from '@/lib/direction';
import { useTranslation } from '@/lib/i18n';
import { useBeeps } from '@/lib/use-beeps';
import { useBleScan } from '@/lib/use-ble-scan';
import type { HeadingStatus } from '@/lib/use-heading';
import { STEP_LENGTH_M, requestMotionPermission, useWalking } from '@/lib/use-walking';
import { useApp } from '@/providers/app-provider';

// "약 3m" → "약 3m예요.", "10m 이상" → "10m 이상이에요."
const withCopula = (label: string) => `${label}${label.endsWith('이상') ? '이에요' : '예요'}.`;

const CALIBRATION_KEY = 'ble:rssiAt1m';
const LOST_AFTER_MS = 5000;
const TURN_LIMIT_MS = 25000;
const HISTORY_MS = 25000;
const TRACK_MEMORY_MS = 60000;
const LOCATE_EVERY_MS = 1000;
/** A turn-only arrow is dropped after this long or after walking this far. */
const TURN_VALID_MS = 30000;
const TURN_VALID_M = 3;

const heatWords: Record<HeatLevel, string> = {
  cold: '차가워요',
  cool: '미지근해요',
  warm: '따뜻해요',
  hot: '뜨거워요',
};
const changeWords = {
  warmer: '따뜻해지고 있어요. 이 방향이 맞아요.',
  colder: '차가워지고 있어요. 다른 방향으로 가 보세요.',
  steady: '',
};

type Props = {
  heading: number | null;
  compassStatus: HeadingStatus;
  allowCompass: () => Promise<void>;
};

type TurnTarget = { bearing: number; strength: number; at: number; x: number; y: number };

/**
 * Guidance to the kiosk from its single BLE beacon (the XIAO "LK…" broadcast).
 * Web: Android Chrome with the experimental Web Platform features flag.
 *
 * - Hot/cold: heat meter, "warmer / colder", and beeps + vibration that speed
 *   up as the signal gets stronger. Works while turning or walking, no compass.
 * - Arrow: steps and compass give a rough track; the kiosk position that best
 *   explains the signal along it (distance + body shadow) gives the arrow.
 *   Turning on the spot and walking both count. The guided turn is a fallback.
 * - Distance: signal strength in steps, with a 1 m calibration.
 */
export function KioskFinder({ heading, compassStatus, allowCompass }: Props) {
  const app = useApp();
  const { t } = useTranslation();
  const headingRef = useRef<number | null>(heading);
  headingRef.current = heading;
  const position = useRef({ x: 0, y: 0 });
  const onStep = useCallback(() => {
    const facing = headingRef.current;
    if (facing == null) return;
    position.current = {
      x: position.current.x + STEP_LENGTH_M * Math.sin((facing * Math.PI) / 180),
      y: position.current.y + STEP_LENGTH_M * Math.cos((facing * Math.PI) / 180),
    };
  }, []);
  const motion = useWalking(true, onStep);
  const [rssiAt1m, setRssiAt1m] = useState(DEFAULT_RSSI_AT_1M);
  const [turning, setTurning] = useState(false);
  const turningRef = useRef(false);
  turningRef.current = turning;
  const turnSamples = useRef<Sample[]>([]);
  const turnStarted = useRef(0);
  const track = useRef<TrackSample[]>([]);
  const history = useRef<{ at: number; rssi: number }[]>([]);
  const [coverage, setCoverage] = useState(0);
  const [turnTarget, setTurnTarget] = useState<TurnTarget | null>(null);
  const [located, setLocated] = useState<Located | null>(null);
  const lastLocate = useRef(0);
  const [turnMessage, setTurnMessage] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const [now, setNow] = useState(Date.now());
  const lastSpoken = useRef('');

  const onReading = useCallback((rssi: number) => {
    const at = Date.now();
    history.current = [...history.current.filter((h) => at - h.at < HISTORY_MS), { at, rssi }];
    const facing = headingRef.current;
    if (facing == null) return;
    if (turningRef.current) turnSamples.current.push({ heading: facing, rssi });
    track.current = [
      ...track.current.filter((s) => at - s.at < TRACK_MEMORY_MS),
      { at, x: position.current.x, y: position.current.y, heading: facing, rssi },
    ];
  }, []);
  const { state, beacon, start, stop } = useBleScan(onReading);

  useEffect(() => {
    void AsyncStorage.getItem(CALIBRATION_KEY)
      .then((value) => value && Number.isFinite(Number(value)) && setRssiAt1m(Number(value)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  // Where is the kiosk? Re-fit about once a second (a few ms each time).
  useEffect(() => {
    if (state !== 'scanning' || now - lastLocate.current < LOCATE_EVERY_MS) return;
    lastLocate.current = now;
    setLocated(locateBeacon(track.current, position.current));
  }, [state, now]);

  const finishTurn = useCallback(() => {
    setTurning(false);
    const result = estimateDirection(turnSamples.current);
    if (result.ok) {
      setTurnTarget({
        bearing: result.bearing,
        strength: result.strength,
        at: Date.now(),
        ...position.current,
      });
      setTurnMessage('방향을 찾았어요. 화살표 쪽으로 천천히 걸어 보세요.');
    } else {
      setTurnMessage(
        result.reason === 'not-enough-turn'
          ? '한 바퀴를 다 돌지 못했어요. 다시 천천히 돌아 주세요.'
          : '방향이 분명하지 않아요. 휴대폰을 가슴 앞에 붙이고 다시 돌아 주세요.',
      );
    }
  }, []);

  // Guided turn: progress, and finish on a full circle or after a time limit.
  useEffect(() => {
    if (!turning) return;
    const covered = turnCoverage(turnSamples.current);
    setCoverage(covered);
    if (covered >= 330 || now - turnStarted.current > TURN_LIMIT_MS) finishTurn();
  }, [turning, now, finishTurn]);

  const lost = !!beacon && now - beacon.lastSeenAt > LOST_AFTER_MS;
  const meters = beacon && !lost ? estimateDistanceM(beacon.rssi, rssiAt1m) : null;
  const step = meters != null ? distanceStep(meters) : null;
  const near = !!step?.near;
  const heat = beacon && !lost ? hotCold(history.current, now, rssiAt1m) : null;
  const turnStillValid =
    !!turnTarget &&
    now - turnTarget.at < TURN_VALID_MS &&
    Math.hypot(position.current.x - turnTarget.x, position.current.y - turnTarget.y) < TURN_VALID_M;
  const bearing = located?.ok ? located.bearing : turnStillValid ? turnTarget!.bearing : null;
  const faded =
    !located?.ok &&
    turnStillValid &&
    !!beacon &&
    !lost &&
    signalFaded(turnTarget!.strength, beacon.rssi);
  const relative = bearing != null && heading != null ? relativeDeg(bearing, heading) : null;
  const showArrow = relative != null && !lost && !faded && !near;

  const { unlock } = useBeeps(
    soundOn && state === 'scanning' && !!beacon && !lost,
    heat?.value ?? null,
    near,
  );

  const sentence = !beacon
    ? ''
    : lost
      ? '키오스크 신호를 잃었어요. 왔던 쪽으로 조금 돌아가 보세요.'
      : near
        ? `${beacon.kioskId} 키오스크 바로 앞이에요.`
        : showArrow
          ? `키오스크는 ${sideLabel(relative ?? 0)}, ${clockPosition(relative ?? 0)}시 방향, ${withCopula(step?.label ?? '')}`
          : `${beacon.kioskId} 키오스크 신호를 찾았어요. ${withCopula(step?.label ?? '')}`;

  useEffect(() => {
    if (!sentence) return;
    const key = sentence.replace(/\d+시 방향/, '');
    if (key === lastSpoken.current) return;
    lastSpoken.current = key;
    app.announce(sentence);
  }, [sentence, app]);

  const arrowSource = located?.ok
    ? located.walked >= 2
      ? '화살표: 걸은 길과 신호로 찾았어요'
      : '화살표: 돌면서 받은 신호로 찾았어요'
    : turnStillValid
      ? '화살표: 한 바퀴 돌기로 찾았어요'
      : !motion.available
        ? '제자리에서 천천히 한 바퀴 돌면 화살표가 나타나요.'
        : located?.reason === 'unclear' && located.walked >= 2.5
          ? '방향을 바꿔 몇 걸음 더 걸어 보세요. 화살표가 나타나요.'
          : '몇 걸음 걸어 보거나 제자리에서 천천히 돌아 보세요. 화살표가 나타나요.';

  async function begin() {
    unlock(); // Sound needs this tap.
    if (compassStatus === 'needs-permission') await allowCompass();
    await start();
    void requestMotionPermission();
  }

  function toggleSound() {
    if (!soundOn) unlock();
    setSoundOn((value) => !value);
  }

  function startTurn() {
    turnSamples.current = [];
    turnStarted.current = Date.now();
    setCoverage(0);
    setTurnMessage('휴대폰을 가슴 앞에 붙이고 제자리에서 천천히 한 바퀴 돌아 주세요.');
    setTurning(true);
  }

  async function calibrate() {
    if (!beacon) return;
    const value = Math.round(beacon.rssi);
    setRssiAt1m(value);
    await AsyncStorage.setItem(CALIBRATION_KEY, String(value)).catch(() => {});
    app.announce(`1미터 기준을 ${value}dBm으로 맞췄어요.`);
  }

  function readGuidance() {
    const parts = [
      sentence,
      heat ? heatWords[heat.level] : '',
      heat ? changeWords[heat.change] : '',
    ];
    app.readAloud(
      parts
        .filter(Boolean)
        .map((part) => t(part))
        .join(' '),
    );
  }

  const compassLine =
    heading != null
      ? bearing != null
        ? `나침반 ${Math.round(heading)}° · 키오스크 방위 ${Math.round(bearing)}°`
        : `나침반 ${Math.round(heading)}°`
      : compassStatus === 'unavailable'
        ? '나침반 없음'
        : '나침반 기다리는 중';
  const heatPercent = heat ? Math.round(heat.value * 100) : 0;

  return (
    <View className="gap-4">
      {state === 'unsupported' && (
        <View className="gap-2 rounded-2xl border border-border bg-card p-5">
          <Text variant="h4">이 브라우저는 블루투스 신호를 읽을 수 없어요</Text>
          <Text>Android 휴대폰의 Chrome에서만 테스트할 수 있어요.</Text>
          <Text>1. Chrome 주소창에 chrome://flags 를 입력해요.</Text>
          <Text>2. Experimental Web Platform features 를 Enabled로 바꿔요.</Text>
          <Text>3. Chrome을 다시 시작하고 이 화면을 다시 열어요.</Text>
        </View>
      )}
      {state === 'denied' && (
        <Text accessibilityRole="alert">
          블루투스 또는 위치 권한이 거부됐어요. Chrome 설정에서 허용한 뒤 다시 시도해 주세요.
        </Text>
      )}
      {state === 'failed' && (
        <Text accessibilityRole="alert">
          블루투스 검색을 시작하지 못했어요. 블루투스와 위치가 켜져 있는지 확인해 주세요.
        </Text>
      )}
      {(state === 'idle' || state === 'denied' || state === 'failed') && (
        <Button variant="default" onPress={() => void begin()}>
          <Icon as={Bluetooth} size={19} className="text-primary-foreground" accessible={false} />
          <Text>키오스크 신호 찾기 시작</Text>
        </Button>
      )}

      {state === 'scanning' && (
        <View className="items-center gap-2 rounded-3xl bg-card p-6">
          {!beacon && <Text>키오스크 신호를 찾는 중이에요. 키오스크 쪽으로 가까이 가 보세요.</Text>}
          {beacon && (
            <>
              <Text variant="h3">{`${beacon.kioskId} 키오스크`}</Text>
              <Text testID="beacon-name" translate={false} className="font-mono text-lg">
                {`LK${beacon.kioskId}${beacon.token}`}
              </Text>
              <Text>{`연결 코드 ${beacon.token}`}</Text>
              <View
                className="my-4 h-40 w-40 items-center justify-center rounded-full border-4 border-primary"
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              >
                {showArrow ? (
                  <View testID="kiosk-arrow" style={{ transform: [{ rotate: `${relative}deg` }] }}>
                    <Icon as={ArrowUp} size={96} className="text-primary" />
                  </View>
                ) : (
                  <Icon as={near ? Bluetooth : Compass} size={72} className="text-primary" />
                )}
              </View>
              <Text className="text-3xl font-bold">{lost ? '신호 없음' : (step?.label ?? '')}</Text>
              {showArrow && (
                <Text className="text-xl font-semibold">
                  {`${sideLabel(relative ?? 0)} · ${clockPosition(relative ?? 0)}시 방향`}
                </Text>
              )}

              {heat && (
                <View
                  className="mt-2 w-full gap-2"
                  accessible
                  accessibilityRole="progressbar"
                  accessibilityLabel={t(`신호 온도 ${heatPercent}%`)}
                  accessibilityValue={{ min: 0, max: 100, now: heatPercent }}
                >
                  <Text testID="kiosk-heat" className="text-center text-2xl font-bold">
                    {heatWords[heat.level]}
                  </Text>
                  <View className="h-4 w-full overflow-hidden rounded-full bg-secondary">
                    <View
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(4, heatPercent)}%` }}
                    />
                  </View>
                  {heat.change !== 'steady' && (
                    <Text testID="kiosk-heat-change" className="text-center text-lg font-semibold">
                      {changeWords[heat.change]}
                    </Text>
                  )}
                </View>
              )}

              {faded && (
                <Text accessibilityRole="alert" className="text-center">
                  신호가 약해졌어요. 다시 한 바퀴 돌아 방향을 찾아 주세요.
                </Text>
              )}
              {!lost && !near && (
                <Text testID="kiosk-arrow-source" className="text-center">
                  {arrowSource}
                </Text>
              )}
              <Text variant="muted">
                {`신호 ${Math.round(beacon.rssi)}dBm · 1m 기준 ${rssiAt1m}dBm`}
              </Text>
              <Text variant="muted">{compassLine}</Text>
            </>
          )}
        </View>
      )}

      {state === 'scanning' && beacon && !lost && (
        <>
          <Text>
            휴대폰을 가슴 앞에 들고 천천히 돌거나 걸어 보세요. 따뜻해지는 쪽으로 가면 키오스크예요.
          </Text>
          {soundOn && <Text variant="muted">신호가 강해질수록 삐 소리가 빨라져요.</Text>}
          <Button variant="outline" onPress={toggleSound}>
            <Icon
              as={soundOn ? VolumeX : Volume2}
              size={19}
              className="text-primary"
              accessible={false}
            />
            <Text>{soundOn ? '삐 소리·진동 끄기' : '삐 소리·진동 켜기'}</Text>
          </Button>
          {turning ? (
            <View className="gap-2 rounded-2xl bg-secondary p-5">
              <Text className="font-bold">{turnMessage}</Text>
              <Text>{`돌아본 범위 ${coverage}° / 360°`}</Text>
              {heading == null && (
                <Text accessibilityRole="alert">
                  나침반이 없어 방향을 기록할 수 없어요. 나침반을 허용해 주세요.
                </Text>
              )}
            </View>
          ) : (
            <Button variant={bearing != null ? 'outline' : 'default'} onPress={startTurn}>
              <Icon
                as={RotateCw}
                size={19}
                className={bearing != null ? 'text-primary' : 'text-primary-foreground'}
                accessible={false}
              />
              <Text>{turnTarget ? '다시 돌아서 방향 찾기' : '한 바퀴 돌며 방향 찾기'}</Text>
            </Button>
          )}
          {!turning && !!turnMessage && <Text>{turnMessage}</Text>}
          {!!sentence && (
            <Button variant="outline" onPress={readGuidance}>
              <Icon as={Volume2} size={19} className="text-primary" accessible={false} />
              <Text>지금 안내 듣기</Text>
            </Button>
          )}
          <Button variant="outline" onPress={() => void calibrate()}>
            <Text>키오스크 1m 앞에서 거리 보정</Text>
          </Button>
        </>
      )}
      {compassStatus === 'needs-permission' && state === 'scanning' && (
        <Button variant="outline" onPress={() => void allowCompass()}>
          <Icon as={Compass} size={19} className="text-primary" accessible={false} />
          <Text>나침반 허용하기</Text>
        </Button>
      )}
      {state === 'scanning' && (
        <Button variant="ghost" onPress={stop}>
          <Text>검색 멈추기</Text>
        </Button>
      )}
    </View>
  );
}
