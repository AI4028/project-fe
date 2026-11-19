import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Contrast, Type, Volume2, Mic, ChevronDown, ChevronUp, Server } from 'lucide-react-native';
import { Screen, NavLink } from '@/components/screen';
import { IconTile } from '@/components/brand';
import { PreferenceSwitch } from '@/components/preference-switch';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useApp } from '@/providers/app-provider';
import { LanguageSwitch } from '@/components/language-switch';
import { AssistancePicker } from '@/components/assistance-picker';
import { resolveTextSize, textSizes } from '@/lib/text-size';
import { resolveExploreMode, type ExploreMode } from '@/lib/location';
import { useTranslation } from '@/lib/i18n';

const preferences = [
  {
    key: 'contrast',
    icon: Contrast,
    title: '고대비 화면',
    description: '검은 배경과 밝은 글자, 선명한 테두리로 구분해요.',
  },
  {
    key: 'voiceInput',
    icon: Mic,
    title: '음성 명령',
    description: '메뉴 이름이나 원하는 동작을 말해서 선택해요.',
  },
  {
    key: 'speech',
    icon: Volume2,
    title: '추가 음성 안내',
    description: '선택한 내용과 진행 상태를 소리로 안내해요.',
  },
] as const;

export default function Settings() {
  const app = useApp();
  const { t } = useTranslation();
  const { settings } = app;
  const [base, setBase] = useState(settings.apiBase);
  const [showServer, setShowServer] = useState(false);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const disabled = app.busy || saving;

  async function save(patch: Parameters<typeof app.updateSettings>[0], confirmation?: string) {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    try {
      await app.updateSettings(patch);
      if (confirmation) app.announce(confirmation);
    } catch (reason) {
      app.report(reason);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <Screen
      title="환경설정"
      subtitle="필요한 기능만 골라 켜 주세요. 언제든 다시 바꿀 수 있어요."
      voice={false}
      reading
      roomy
    >
      <Card>
        <CardContent>
          <LanguageSwitch disabled={disabled} />
        </CardContent>
      </Card>

      <View className="gap-3">
        <Text variant="h2">화면과 음성</Text>
        {preferences.map(({ key, icon, title, description }) => (
          <PreferenceSwitch
            key={key}
            title={title}
            description={description}
            icon={icon}
            value={!!settings[key]}
            disabled={disabled}
            onChange={(value) => void save({ [key]: value })}
          />
        ))}
        <Card>
          <CardContent className="gap-3">
            <View className="flex-row items-center gap-3">
              <IconTile icon={Type} small />
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="font-bold">글자 크기</Text>
                <Text variant="muted">화면의 글자와 입력 내용을 최대 200%까지 키워요.</Text>
              </View>
            </View>
            <View
              className="flex-row flex-wrap gap-2"
              accessibilityRole="radiogroup"
              accessibilityLabel={t('글자 크기')}
            >
              {textSizes.map((size) => {
                const selected = resolveTextSize(settings) === size.key;
                return (
                  <Button
                    key={size.key}
                    variant={selected ? 'default' : 'outline'}
                    className="min-h-12 flex-1 flex-wrap gap-1 px-2"
                    style={{ flexBasis: 112 }}
                    accessibilityRole="radio"
                    accessibilityLabel={`${size.label} ${size.percent}%`}
                    accessibilityState={{ checked: selected }}
                    disabled={disabled}
                    onPress={() =>
                      void save({ textSize: size.key, largeText: size.key !== 'base' })
                    }
                  >
                    <Text className="font-bold">{size.label}</Text>
                    <Text variant="small">{size.percent}%</Text>
                  </Button>
                );
              })}
            </View>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="gap-2">
            <Text variant="h3">지금, 편하게 보이시나요?</Text>
            <Text variant="muted">
              변경한 설정이 이 화면에도 바로 적용돼요. 휴대폰의 글자 크기와 화면 읽기 설정도 함께
              사용할 수 있어요.
            </Text>
            <Text variant="muted">화면 읽기가 켜져 있으면 추가 음성 안내는 재생하지 않아요.</Text>
          </CardContent>
        </Card>
      </View>

      <Card>
        <CardContent className="gap-4">
          <Text variant="h2">위치 및 지도 기본 설정</Text>
          <View className="gap-2">
            <Text className="font-bold">시작 화면 기본 모드</Text>
            <SegmentedControl<ExploreMode>
              value={resolveExploreMode(settings.assistance, settings.exploreMode) ?? 'list'}
              onChange={(exploreMode) => void save({ exploreMode })}
              label={t('시작 화면 기본 모드')}
              disabled={disabled}
              options={[
                { value: 'list', label: '글 지도' },
                { value: 'map', label: '그림 지도' },
              ]}
            />
          </View>
          <View className="gap-3 border-t border-border pt-4">
            <Text variant="h3">장애 유형</Text>
            <Text variant="muted">선택한 유형에 맞는 접근성 정보를 매장 화면에 먼저 보여줘요.</Text>
            <AssistancePicker
              value={settings.assistance}
              disabled={disabled}
              onSelect={(assistance) => void save({ assistance })}
            />
            {settings.assistance && (
              <Button
                variant="ghost"
                disabled={disabled}
                className="self-start"
                onPress={() =>
                  void save({
                    assistance: undefined,
                    exploreMode: resolveExploreMode(settings.assistance, settings.exploreMode),
                  })
                }
              >
                <Text>선택 지우기</Text>
              </Button>
            )}
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="gap-4">
          <Button
            variant="ghost"
            className="justify-between px-0"
            onPress={() => setShowServer(!showServer)}
            accessibilityLabel="서버 연결 설정"
            accessibilityState={{ expanded: showServer }}
          >
            <View className="flex-row items-center gap-3">
              <Icon as={Server} size={20} accessible={false} />
              <Text className="shrink text-left font-bold">서버 연결 설정</Text>
            </View>
            <Icon as={showServer ? ChevronUp : ChevronDown} size={20} accessible={false} />
          </Button>
          {showServer && (
            <>
              <Text variant="muted">
                휴대폰과 매장 기기는 같은 서버에 연결해야 해요. 휴대폰에서는 컴퓨터의 LAN IP 또는
                HTTPS 주소를 입력해 주세요.
              </Text>
              <Text className="font-bold">서버 주소</Text>
              <Input
                value={base}
                onChangeText={setBase}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel="백엔드 서버 주소"
              />
              <Button
                className="self-start"
                disabled={disabled}
                onPress={() => void save({ apiBase: base }, '설정을 저장했습니다.')}
              >
                <Text>서버 주소 저장</Text>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      {app.connection && (
        <NavLink href="/leave" className="self-start">
          주문 중단 · 매장 연결 종료
        </NavLink>
      )}
      <NavLink href="/kiosk" className="self-start">
        매장 직원 화면
      </NavLink>
    </Screen>
  );
}
