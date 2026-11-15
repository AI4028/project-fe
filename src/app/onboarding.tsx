import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { BrandLockup } from '@/components/brand';
import { AssistancePicker } from '@/components/assistance-picker';
import { LanguageSwitch } from '@/components/language-switch';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useApp } from '@/providers/app-provider';
import { exploreRoute, isAssistance, type Assistance } from '@/lib/location';
import { errorMessage } from '@/lib/api';
import { layout } from '@/lib/theme';

export default function Onboarding() {
  const app = useApp();
  const [choice, setChoice] = useState<Assistance | undefined>(
    isAssistance(app.settings.assistance) ? app.settings.assistance : undefined,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function start() {
    if (!choice || saving) return;
    setSaving(true);
    setError('');
    try {
      await app.saveSettings({ ...app.settings, assistance: choice });
      router.replace(exploreRoute(choice));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row flex-wrap items-center justify-between gap-2 px-5 py-3">
        <BrandLockup />
        <LanguageSwitch compact disabled={saving} />
      </View>
      <ScrollView
        contentContainerClassName="grow justify-center px-5 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mx-auto w-full gap-7" style={{ maxWidth: layout.readingWidth }}>
          <View className="gap-3">
            <Text variant="h1">나에게 맞는 지도로 시작해요</Text>
            <Text className="leading-7 text-muted-foreground">
              장애 유형을 선택하면 나에게 맞는 장소 탐색 화면이 열려요.
            </Text>
          </View>
          <AssistancePicker value={choice} onSelect={setChoice} disabled={saving} descriptions />
          <View className="gap-4">
            <Text variant="muted">선택은 이 기기에 저장돼요. 설정에서 언제든 바꿀 수 있어요.</Text>
            <Text variant="muted">
              VoiceOver와 TalkBack, 큰 글자와 고대비 설정도 함께 사용할 수 있어요.
            </Text>
            {!!error && <Text accessibilityRole="alert">{error}</Text>}
            <Button
              disabled={!choice || saving}
              size="lg"
              accessibilityState={{ busy: saving }}
              onPress={() => void start()}
            >
              <Text>{saving ? '저장 중…' : '시작하기'}</Text>
              <Icon
                as={ArrowRight}
                size={20}
                className="text-primary-foreground"
                accessible={false}
              />
            </Button>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
