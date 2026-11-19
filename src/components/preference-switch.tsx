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
          'min-h-8 shrink-0 items-center justify-center rounded-xl border border-primary px-2',
          value ? 'bg-primary' : 'bg-card',
        )}
      >
        <Text
          variant="small"
          className={value ? 'font-bold text-primary-foreground' : 'font-bold text-primary'}
        >
          {value ? '켜짐' : '꺼짐'}
        </Text>
      </View>
    </Button>
  );
}
