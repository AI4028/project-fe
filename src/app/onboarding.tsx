import { useRef, useState } from 'react';
import { View } from 'react-native';
import { vars } from 'nativewind';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { PreferenceSwitch } from '@/components/preference-switch';
import { LanguageSwitch } from '@/components/language-switch';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Text, TextScaleContext } from '@/components/ui/text';
import { useApp } from '@/providers/app-provider';
import { exploreRoute, resolveExploreMode, type ExploreMode } from '@/lib/location';
import { errorMessage } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { resolveTextSize, textScale } from '@/lib/text-size';
import { themeVariables } from '@/lib/theme';

export default function Onboarding() {
  const app = useApp();
  const { t } = useTranslation();
  const [contrast, setContrast] = useState(app.settings.contrast);
  const [size, setSize] = useState(() => resolveTextSize(app.settings));
  const compactCopy = size !== 'base';
  const [mode, setMode] = useState(
    () => resolveExploreMode(app.settings.assistance, app.settings.exploreMode) ?? 'list',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);

  async function start() {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError('');

    try {
      await app.updateSettings({
        exploreMode: mode,
        textSize: size,
        largeText: size !== 'base',
        contrast,
      });
      router.replace(exploreRoute(undefined, mode));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <TextScaleContext.Provider value={textScale(size)}>
      <View style={[{ flex: 1 }, vars(themeVariables(contrast))]}>
        <Screen
          title={size === 'xlarge' ? '크게 확인해요' : '나에게 편한 이용 설정'}
          subtitle={compactCopy ? '필요한 기능을 선택하세요.' : '필요한 기능만 골라 켜 주세요.'}
          chrome="onboarding"
          footer={
            <Button
              size="lg"
              disabled={saving}
              accessibilityState={{ busy: saving }}
              onPress={() => void start()}
            >
              <Text>
                {saving ? '저장 중…' : compactCopy ? '시작하기' : '설정 완료하고 시작하기'}
              </Text>
              <Icon
                as={ArrowRight}
                size={20}
                className="text-primary-foreground"
                accessible={false}
              />
            </Button>
          }
          voice={false}
        >
          <LanguageSwitch disabled={saving} />
          <View className="gap-3">
            <PreferenceSwitch
              title="고대비"
              description={compactCopy ? undefined : '글자와 버튼 경계를 선명하게'}
              value={contrast}
              disabled={saving}
              onChange={setContrast}
            />
            <PreferenceSwitch
              title="큰 글씨"
              description={compactCopy ? undefined : '기본 글자의 2배로 확대'}
              value={size !== 'base'}
              disabled={saving}
              onChange={(enabled) => setSize(enabled ? 'xlarge' : 'base')}
            />
          </View>
          <View className="gap-2">
            <Text variant="h3">지도 방식</Text>
            <SegmentedControl<ExploreMode>
              mapChoice
              value={mode}
              onChange={setMode}
              label={t('지도 방식')}
              disabled={saving}
              options={[
                { value: 'list', label: '글 지도' },
                { value: 'map', label: '그림 지도' },
              ]}
            />
          </View>
          {!!error && <Text accessibilityRole="alert">{error}</Text>}
        </Screen>
      </View>
    </TextScaleContext.Provider>
  );
}
