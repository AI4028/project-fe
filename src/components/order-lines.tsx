import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { SpokenGroup } from '@/components/spoken-group';
import { money, optionSummary } from '@/lib/cart';
import { useTranslation } from '@/lib/i18n';
import type { PricedLine } from '@/lib/types';

export function OrderLines({ lines }: { lines: PricedLine[] }) {
  const { language, t } = useTranslation();
  return lines.map((line, index) => {
    const name = (language === 'en' && line.nameEn) || line.name;
    return (
      <View key={`${line.itemId}:${index}`} className="gap-1 border-b border-border pb-3">
        <SpokenGroup
          label={`${name} ${t(`${line.qty}개`)}, ${t(money(line.lineTotal))}`}
          className="flex-row flex-wrap justify-between gap-2"
        >
          <Text className="shrink font-semibold" translate={false}>
            {`${name} × ${line.qty}`}
          </Text>
          <Text className="font-semibold">{money(line.lineTotal)}</Text>
        </SpokenGroup>
        {line.options.length > 0 && (
          <Text variant="muted" translate={false}>
            {optionSummary(line, t)}
          </Text>
        )}
      </View>
    );
  });
}

export function TotalRow({
  total,
  className,
  heading = false,
}: {
  total: number;
  className?: string;
  heading?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <SpokenGroup
      label={`${t('합계')}, ${t(money(total))}`}
      className={className ?? 'flex-row flex-wrap justify-between gap-2'}
    >
      <Text variant={heading ? 'h2' : undefined}>합계</Text>
      <Text variant={heading ? 'h2' : undefined} className={heading ? undefined : 'font-bold'}>
        {money(total)}
      </Text>
    </SpokenGroup>
  );
}
