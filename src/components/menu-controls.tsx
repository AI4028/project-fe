import { View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Text } from './ui/text';
import { SpokenGroup } from './spoken-group';
import { useTranslation } from '@/lib/i18n';
import { optionSummary } from '@/lib/cart';
import type { PricedLine } from '@/lib/types';

export function QuantityStepper({
  qty,
  onChange,
  name,
  disabled = false,
  compact = false,
}: {
  qty: number;
  onChange: (qty: number) => void;
  name?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const label = (text: string) => (name ? `${name}, ${t(text)}` : text);
  return (
    <View
      className={
        compact
          ? 'flex-row flex-wrap items-center gap-2'
          : 'flex-row items-center justify-between gap-3'
      }
    >
      <Button
        variant="outline"
        size="icon"
        disabled={disabled || qty <= 1}
        accessibilityLabel={label('수량 줄이기')}
        onPress={() => onChange(qty - 1)}
      >
        <Icon as={Minus} size={20} accessible={false} />
      </Button>
      <Text
        className="font-bold"
        accessibilityLabel={t(`${qty}개`)}
        accessibilityLiveRegion="polite"
      >
        {compact ? qty : `${qty}개`}
      </Text>
      <Button
        variant="outline"
        size="icon"
        disabled={disabled || qty >= 10}
        accessibilityLabel={label('수량 늘리기')}
        onPress={() => onChange(qty + 1)}
      >
        <Icon as={Plus} size={20} accessible={false} />
      </Button>
    </View>
  );
}

export function CartLineSummary({ line }: { line: PricedLine }) {
  const { language, t } = useTranslation();
  const name = language === 'en' ? line.nameEn || line.name : line.name;
  return (
    <View className="gap-1">
      <SpokenGroup label={`${name} ${t(`${line.qty}개`)}`}>
        <Text translate={false} className="text-lg font-bold">
          {`${name} × ${line.qty}`}
        </Text>
      </SpokenGroup>
      <Text variant="muted" translate={false}>
        {optionSummary(line, t) || t('추가 옵션 없음')}
      </Text>
    </View>
  );
}
