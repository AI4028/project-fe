import { Compass, MapPin } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  ANCHOR_LETTERS,
  setupProblem,
  type AnchorLetter,
  type BoardSetup,
  type Position,
  type Spot,
} from '@/lib/ble-position';
import type { AnchorReading } from '@/lib/use-ble-scan';

type Props = {
  setup: BoardSetup;
  onChange: (setup: BoardSetup) => void;
  heading: number | null;
  kioskRssi: number | null;
  anchors: Partial<Record<AnchorLetter, AnchorReading>>;
  now: number;
};

const HEARD_MS = 3000;

/** Text field for one coordinate; keeps what is typed until it is a number. */
function MetreField({
  label,
  value,
  onValue,
}: {
  label: string;
  value: number;
  onValue: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // Only follow outside changes (e.g. a loaded setup), not every keystroke.
  }, [value]);
  return (
    <View className="flex-1 gap-1">
      <Text variant="small">{label}</Text>
      <Input
        value={text}
        accessibilityLabel={label}
        inputMode="decimal"
        onChangeText={(next) => {
          setText(next);
          const number = Number(next.replace(',', '.'));
          if (next.trim() !== '' && Number.isFinite(number)) onValue(number);
        }}
      />
    </View>
  );
}

/**
 * Setup for three-board finding: where boards B and C stand (metres from the
 * kiosk board; "forward" = toward board B), the compass direction of forward,
 * and a 1 m calibration for each position board.
 */
export function BoardSetupPanel({ setup, onChange, heading, kioskRssi, anchors, now }: Props) {
  const heard = (letter: AnchorLetter) => {
    const reading = anchors[letter];
    return reading && now - reading.lastSeenAt < HEARD_MS ? reading : null;
  };
  const problem = setupProblem(setup);
  const setSpot = (letter: AnchorLetter, spot: Spot) =>
    onChange({ ...setup, spots: { ...setup.spots, [letter]: spot } });

  return (
    <View className="gap-4 rounded-2xl border border-border bg-card p-5">
      <Text variant="h4">보드 3개 설정</Text>
      <Text>
        키오스크 보드를 기준(0, 0)으로 해요. 키오스크에서 보드 B 쪽이 '앞'이에요. 보드 위치를 줄자로
        재서 미터로 적어 주세요.
      </Text>

      <View className="gap-1">
        <Text testID="board-heard-A">
          {kioskRssi != null
            ? `키오스크 보드: 신호 ${Math.round(kioskRssi)}dBm`
            : '키오스크 보드: 신호 없음'}
        </Text>
        {ANCHOR_LETTERS.map((letter) => {
          const reading = heard(letter);
          return (
            <Text key={letter} testID={`board-heard-${letter}`}>
              {reading
                ? `보드 ${letter}: 신호 ${Math.round(reading.rssi)}dBm`
                : `보드 ${letter}: 신호 없음`}
            </Text>
          );
        })}
      </View>

      {ANCHOR_LETTERS.map((letter) => (
        <View key={letter} className="gap-2">
          <Text className="font-bold">{`보드 ${letter} 위치`}</Text>
          <View className="flex-row gap-3">
            <MetreField
              label={`보드 ${letter} 오른쪽 (m)`}
              value={setup.spots[letter].x}
              onValue={(x) => setSpot(letter, { ...setup.spots[letter], x })}
            />
            <MetreField
              label={`보드 ${letter} 앞 (m)`}
              value={setup.spots[letter].y}
              onValue={(y) => setSpot(letter, { ...setup.spots[letter], y })}
            />
          </View>
        </View>
      ))}
      <Text variant="muted">왼쪽과 뒤쪽은 음수로 적어요. 예: 왼쪽 2m는 -2.</Text>

      <View className="gap-2">
        <Text className="font-bold">앞 방향</Text>
        <Text testID="board-forward">
          {setup.forwardHeading != null
            ? `저장된 앞 방향: 나침반 ${setup.forwardHeading}°`
            : '앞 방향이 아직 없어요.'}
        </Text>
        <Button
          variant="outline"
          disabled={heading == null}
          onPress={() =>
            heading != null && onChange({ ...setup, forwardHeading: Math.round(heading) })
          }
        >
          <Icon as={Compass} size={19} className="text-primary" accessible={false} />
          <Text>키오스크 앞에서 보드 B 쪽을 보고 저장</Text>
        </Button>
      </View>

      <View className="gap-2">
        <Text className="font-bold">거리 보정</Text>
        {ANCHOR_LETTERS.map((letter) => {
          const reading = heard(letter);
          return (
            <Button
              key={letter}
              variant="outline"
              disabled={!reading}
              onPress={() =>
                reading &&
                onChange({
                  ...setup,
                  rssiAt1m: { ...setup.rssiAt1m, [letter]: Math.round(reading.rssi) },
                })
              }
            >
              <Text>{`보드 ${letter} 1m 앞에서 보정 (지금 ${setup.rssiAt1m[letter]}dBm)`}</Text>
            </Button>
          );
        })}
      </View>

      {problem === 'boards-in-line' && (
        <Text accessibilityRole="alert">
          보드가 너무 가깝거나 한 줄에 있어요. 보드 3개를 1m 이상 떨어진 삼각형 모양으로 놓아
          주세요.
        </Text>
      )}
      {problem === 'no-forward' && (
        <Text accessibilityRole="alert">앞 방향을 저장하면 보드 3개 모드를 쓸 수 있어요.</Text>
      )}
    </View>
  );
}

/**
 * Small top-down map of the room: forward is up. Decorative; the same
 * information is in the text above it.
 */
export function BoardMap({ setup, position }: { setup: BoardSetup; position: Position | null }) {
  const size = 240;
  const points: Spot[] = [{ x: 0, y: 0 }, setup.spots.B, setup.spots.C];
  if (position) points.push(position);
  const minX = Math.min(...points.map((p) => p.x)) - 1;
  const maxX = Math.max(...points.map((p) => p.x)) + 1;
  const minY = Math.min(...points.map((p) => p.y)) - 1;
  const maxY = Math.max(...points.map((p) => p.y)) + 1;
  const scale = size / Math.max(maxX - minX, maxY - minY);
  const place = (p: Spot) => ({ left: (p.x - minX) * scale, top: (maxY - p.y) * scale });
  const dot = (p: Spot, label: string, strong = false) => (
    <View
      key={label}
      className={`absolute h-8 w-8 items-center justify-center rounded-full ${strong ? 'bg-primary' : 'bg-secondary'}`}
      style={{ left: place(p).left - 16, top: place(p).top - 16 }}
    >
      <Text
        translate={false}
        className={`text-sm font-bold ${strong ? 'text-primary-foreground' : 'text-secondary-foreground'}`}
      >
        {label}
      </Text>
    </View>
  );
  return (
    <View
      testID="board-map"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      className="self-center rounded-2xl border border-border bg-muted"
      style={{ width: size + 32, height: size + 32, padding: 16 }}
    >
      <View style={{ width: size, height: size }}>
        {position && (
          <View
            className="absolute rounded-full border-2 border-primary"
            style={{
              left: place(position).left - Math.max(12, position.uncertainty * scale),
              top: place(position).top - Math.max(12, position.uncertainty * scale),
              width: 2 * Math.max(12, position.uncertainty * scale),
              height: 2 * Math.max(12, position.uncertainty * scale),
            }}
          />
        )}
        {dot({ x: 0, y: 0 }, 'K', true)}
        {dot(setup.spots.B, 'B')}
        {dot(setup.spots.C, 'C')}
        {position && (
          <View
            testID="board-map-me"
            className="absolute"
            style={{ left: place(position).left - 12, top: place(position).top - 12 }}
          >
            <Icon as={MapPin} size={24} className="text-primary" />
          </View>
        )}
      </View>
    </View>
  );
}
