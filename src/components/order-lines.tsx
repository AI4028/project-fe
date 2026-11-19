import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { money } from '@/lib/cart';
import { useTranslation } from '@/lib/i18n';
import type { PricedLine } from '@/lib/types';

export function OrderLines({ lines }: { lines: PricedLine[] }) {
  const { language, t } = useTranslation();
  return lines.map((line, index) => (
    <View key={`${line.itemId}:${index}`} className="gap-1 border-b border-border pb-3">
      <View className="flex-row flex-wrap justify-between gap-2">
        <Text className="shrink font-semibold" translate={false}>
          {(language === 'en' && line.nameEn) || line.name} × {line.qty}
        </Text>
        <Text className="font-semibold">{money(line.lineTotal)}</Text>
      </View>
      {line.options.length > 0 && (
        <Text variant="muted" translate={false}>
          {line.options.map((choice) => t(choice.choiceName)).join(' · ')}
        </Text>
      )}
    </View>
  ));
}
