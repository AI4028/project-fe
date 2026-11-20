import { useContext } from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Text, TextScaleContext } from './text';
import { Icon } from './icon';

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  iconsOnly = false,
  compact = false,
  mapChoice = false,
  disabled = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string; accessibilityLabel?: string; icon?: LucideIcon }[];
  label: string;
  iconsOnly?: boolean;
  compact?: boolean;
  mapChoice?: boolean;
  disabled?: boolean;
}) {
  const scale = useContext(TextScaleContext);
  const { fontScale } = useWindowDimensions();
  const stacked = mapChoice && (scale > 1 || fontScale > 1);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      className={cn(
        stacked ? 'flex-col' : 'flex-row',
        mapChoice ? 'gap-2' : 'gap-1 rounded-2xl border border-border bg-secondary',
        !compact && !mapChoice && 'p-1',
      )}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          disabled={disabled}
          variant={value === option.value ? 'default' : 'ghost'}
          className={cn(
            'min-h-12 min-w-12 rounded-xl px-3',
            compact ? 'px-2 py-1' : !iconsOnly && !stacked && 'min-w-0 flex-1',
            mapChoice && 'rounded-[14px] border border-primary',
            mapChoice && value !== option.value && 'bg-card',
            stacked && 'min-h-[80px] w-full',
          )}
          accessibilityRole="radio"
          accessibilityLabel={option.accessibilityLabel ?? option.label}
          accessibilityState={{ checked: value === option.value }}
          onPress={() => onChange(option.value)}
        >
          {option.icon && (
            <Icon
              as={option.icon}
              size={24}
              className={value === option.value ? 'text-primary-foreground' : 'text-primary'}
              accessible={false}
            />
          )}
          {!iconsOnly && (
            <Text className={cn('shrink text-center font-bold', compact && 'text-xs')}>
              {option.label}
            </Text>
          )}
        </Button>
      ))}
    </View>
  );
}
