import { Image, View } from 'react-native';
import { Coffee, Minus, Plus } from 'lucide-react-native';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Text } from './ui/text';
import { useTranslation } from '@/lib/i18n';
import type { PricedLine } from '@/lib/types';

const photos: Record<string, number> = {
  americano: require('../../assets/menu/americano.jpg'),
  'cafe-latte': require('../../assets/menu/cafe-latte.jpg'),
  'vanilla-latte': require('../../assets/menu/vanilla-latte.jpg'),
  'grapefruit-ade': require('../../assets/menu/grapefruit-ade.jpg'),
};

export function MenuThumbnail({
  itemId,
  imageUrl,
  size = 68,
}: {
  itemId: string;
  imageUrl?: string;
  size?: number;
}) {
  const source = imageUrl ? { uri: imageUrl } : photos[itemId];
  return (
    <View
      className="shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary"
      style={{ width: size, height: size }}
      accessible={false}
    >
      {source ? (
        <Image
          source={source}
          style={{ width: size, height: size }}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      ) : (
        <Icon as={Coffee} size={22} className="text-primary" accessible={false} />
      )}
    </View>
  );
}

export function QuantityStepper({
  qty,
  onChange,
  name,
  disabled = false,
}: {
  qty: number;
  onChange: (qty: number) => void;
  name?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const label = (text: string) => (name ? `${name}, ${t(text)}` : text);
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Button
        variant="outline"
        size="icon"
        disabled={disabled || qty <= 1}
        accessibilityLabel={label('수량 줄이기')}
        onPress={() => onChange(qty - 1)}
      >
        <Icon as={Minus} size={20} accessible={false} />
      </Button>
      <Text variant="h3" accessibilityLiveRegion="polite">
        {`${qty}개`}
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
      <Text translate={false} className="font-bold">
        {name} × {line.qty}
      </Text>
      <Text variant="muted" translate={false}>
        {line.options.map((option) => t(option.choiceName)).join(' · ') || t('추가 옵션 없음')}
      </Text>
    </View>
  );
}
