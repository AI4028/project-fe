import { View } from 'react-native';
import { Languages } from 'lucide-react-native';
import { useApp } from '@/providers/app-provider';
import { useTranslation } from '@/lib/i18n';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { Icon } from './ui/icon';
import { SegmentedControl } from './ui/segmented-control';

export function LanguageSwitch({
  compact = false,
  disabled = false,
}: {
  compact?: boolean;
  disabled?: boolean;
}) {
  const app = useApp();
  const { language } = useTranslation();
  const change = (next: 'ko' | 'en') => {
    void app.saveSettings({ ...app.settings, language: next }).catch(app.report);
  };
  if (compact)
    return (
      <Button
        variant="ghost"
        accessibilityLabel={language === 'ko' ? 'Switch to English' : '한국어로 전환'}
        onPress={() => change(language === 'ko' ? 'en' : 'ko')}
        disabled={disabled || app.busy}
      >
        <Icon as={Languages} size={19} className="text-primary" accessible={false} />
        <Text translate={false}>{language === 'ko' ? 'English' : '한국어'}</Text>
      </Button>
    );
  return (
    <View className="gap-3">
      <Text variant="h2">Language / 언어</Text>
      <SegmentedControl
        value={language}
        disabled={disabled || app.busy}
        onChange={change}
        label="Language / 언어"
        options={[
          { value: 'ko', label: '한국어' },
          { value: 'en', label: 'English' },
        ]}
      />
    </View>
  );
}
