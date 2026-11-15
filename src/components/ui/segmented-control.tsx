import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Button } from './button';
import { Text } from './text';
import { Icon } from './icon';

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  iconsOnly = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string; icon?: LucideIcon }[];
  label: string;
  iconsOnly?: boolean;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      className="flex-row gap-1 rounded-2xl border border-border bg-muted p-1"
    >
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? 'outline' : 'ghost'}
          className={
            iconsOnly ? 'min-h-12 min-w-12 rounded-xl px-3' : 'min-w-0 flex-1 rounded-xl px-3'
          }
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          accessibilityState={{ checked: value === option.value }}
          onPress={() => onChange(option.value)}
        >
          {option.icon && (
            <Icon
              as={option.icon}
              size={18}
              className={value === option.value ? 'text-primary' : 'text-muted-foreground'}
              accessible={false}
            />
          )}
          {!iconsOnly && (
            <Text className={value === option.value ? 'text-primary' : 'text-muted-foreground'}>
              {option.label}
            </Text>
          )}
        </Button>
      ))}
    </View>
  );
}
