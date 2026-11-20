import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useApp } from '@/providers/app-provider';
import { useTranslation } from '@/lib/i18n';
import { Text } from './ui/text';
import { SegmentedControl } from './ui/segmented-control';

export function LanguageSwitch({
  compact = false,
  showHeading = true,
  disabled = false,
}: {
  compact?: boolean;
  showHeading?: boolean;
  disabled?: boolean;
}) {
  const app = useApp();
  const { language, t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  async function change(next: 'ko' | 'en') {
    if (next === language || pending.current) return;
    pending.current = true;
    setSaving(true);
    try {
      await app.updateSettings({ language: next });
    } catch (reason) {
      app.report(reason);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  const control = (
    <SegmentedControl<'ko' | 'en'>
      value={language}
      compact={compact}
      disabled={disabled || app.busy || saving}
      onChange={(next) => void change(next)}
      label={t('언어 선택')}
      options={[
        { value: 'ko', label: '한국어', accessibilityLabel: '한국어로 전환' },
        {
          value: 'en',
          label: compact ? 'Eng' : 'English',
          accessibilityLabel: 'Switch to English',
        },
      ]}
    />
  );
  if (compact || !showHeading) return control;
  return (
    <View className="gap-3">
      <Text variant="h2">언어 선택</Text>
      {control}
    </View>
  );
}
