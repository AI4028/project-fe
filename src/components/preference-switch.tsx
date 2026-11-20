import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { IconTile } from './brand';
import { Button } from './ui/button';
import { Text, TextClassContext } from './ui/text';

export function PreferenceSwitch({
  title,
  description,
  icon,
  flat = false,
  value,
  disabled,
  onChange,
}: {
  title: string;
  description?: string;
  flat?: boolean;
  icon?: LucideIcon;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Button
      variant={flat ? 'ghost' : 'outline'}
      className={cn(
        'w-full justify-start gap-3 py-3',
        flat ? 'px-1' : 'rounded-2xl bg-card px-4',
        !flat && (value ? 'border-primary' : 'border-input'),
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
        {description && (
          <Text variant="muted" className="text-left font-normal text-muted-foreground">
            {description}
          </Text>
        )}
      </View>
      <TextClassContext.Provider value={undefined}>
        <View
          accessible={false}
          className={cn(
            'min-h-[44px] min-w-[72px] shrink-0 items-center justify-center rounded-[14px] border border-primary px-2',
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
      </TextClassContext.Provider>
    </Button>
  );
}
