import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { IconTile } from './brand';
import { Button } from './ui/button';
import { Text } from './ui/text';

export function PreferenceSwitch({
  title,
  description,
  icon,
  value,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Button
      variant="outline"
      className={cn(
        'w-full justify-start gap-3 rounded-2xl bg-card px-4 py-3',
        value ? 'border-primary' : 'border-input',
      )}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ checked: value }}
      disabled={disabled}
      onPress={() => onChange(!value)}
    >
      {icon && <IconTile icon={icon} small />}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-left font-bold text-foreground">{title}</Text>
        <Text variant="muted" className="text-left font-normal text-muted-foreground">
          {description}
        </Text>
      </View>
      <View
        accessible={false}
        className={cn(
          'h-7 w-12 shrink-0 flex-row items-center rounded-full border border-primary px-0.5',
          value ? 'justify-end bg-primary' : 'justify-start bg-secondary',
        )}
      >
        <View
          className={cn('h-5 w-5 rounded-full', value ? 'bg-primary-foreground' : 'bg-primary')}
        />
      </View>
    </Button>
  );
}
