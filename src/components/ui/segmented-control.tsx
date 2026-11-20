import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Text } from './text';
import { Icon } from './icon';

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  iconsOnly = false,
  compact = false,
  disabled = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string; accessibilityLabel?: string; icon?: LucideIcon }[];
  label: string;
  iconsOnly?: boolean;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      className={cn(
        'flex-row gap-1 rounded-2xl border border-border bg-secondary',
        !compact && 'p-1',
      )}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          disabled={disabled}
          variant={value === option.value ? 'default' : 'ghost'}
          className={cn(
            'min-h-12 min-w-12 rounded-xl px-3',
            compact ? 'px-2 py-1' : !iconsOnly && 'min-w-0 flex-1',
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
