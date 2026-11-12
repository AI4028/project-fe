import type { ReactNode } from 'react';
import { Image, View } from 'react-native';
import { Check, type LucideIcon } from 'lucide-react-native';
import { Text } from './ui/text';
import { Icon } from './ui/icon';
import { cn } from '@/lib/utils';
import { brandColors } from '@/lib/theme';
import { useApp } from '@/providers/app-provider';

export function BrandLockup() {
  const { settings } = useApp();
  return (
    <View accessible accessibilityLabel="갈지도" className="flex-row items-center gap-3">
      <Image
        source={require('../../assets/brand/galjido-logo-654B3C.png')}
        resizeMode="contain"
        style={{
          width: 34,
          height: 44,
          tintColor: settings.contrast ? brandColors.beige : brandColors.walnut,
        }}
        accessible={false}
      />
      <View className="gap-0.5">
        <Text className="text-2xl font-bold tracking-tight text-primary">갈지도</Text>
        <Text variant="small" style={{ color: brandColors.logoEnglish }}>
          Galjido Service
        </Text>
      </View>
    </View>
  );
}

export function IconTile({ icon, small = false }: { icon: LucideIcon; small?: boolean }) {
  return (
    <View
      className={cn(
        'items-center justify-center rounded-2xl bg-secondary',
        small ? 'h-10 w-10' : 'h-14 w-14',
      )}
      accessible={false}
    >
      <Icon as={icon} size={small ? 20 : 26} className="text-secondary-foreground" />
    </View>
  );
}

export function Eyebrow({ children }: { children: string }) {
  return (
    <Text variant="small" className="font-bold tracking-wide text-primary">
      {children}
    </Text>
  );
}

export function SectionHeading({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <View className="flex-row flex-wrap items-end justify-between gap-3">
      <View className="gap-1">
        <Text variant="h2">{title}</Text>
        {detail && <Text variant="muted">{detail}</Text>}
      </View>
      {children}
    </View>
  );
}

export function StatusBadge({
  children,
  selected = false,
}: {
  children: string;
  selected?: boolean;
}) {
  return (
    <View
      className={cn(
        'flex-row items-center gap-1.5 self-start rounded-full border px-3 py-1.5',
        selected ? 'border-primary bg-secondary' : 'border-border bg-card',
      )}
    >
      {selected && <Icon as={Check} size={16} className="text-primary" accessible={false} />}
      <Text variant="small" className="font-medium">
        {children}
      </Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <View className="items-center gap-4 rounded-3xl border border-border bg-card px-6 py-10">
      <IconTile icon={icon} />
      <Text variant="h3" className="text-center">
        {title}
      </Text>
      <Text className="max-w-md text-center leading-7 text-muted-foreground">{description}</Text>
      {children}
    </View>
  );
}

export function OrderSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <View className="flex-row flex-wrap gap-3" accessibilityLabel={`주문 3단계 중 ${current}단계`}>
      {['메뉴 선택', '장바구니', '최종 확인'].map((label, index) => (
        <View
          key={label}
          className={cn(
            'flex-row items-center gap-2 rounded-full border px-3 py-2',
            current === index + 1 ? 'border-primary bg-secondary' : 'border-border bg-card',
          )}
        >
          <Text
            variant="small"
            className={cn(
              'font-bold',
              current === index + 1 ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {index + 1} · {label}
          </Text>
        </View>
      ))}
    </View>
  );
}
