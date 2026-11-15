import { View } from 'react-native';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { assistanceLabels, type Assistance } from '@/lib/location';

export function AssistancePicker({
  value,
  onSelect,
  disabled = false,
}: {
  value?: Assistance;
  onSelect: (value: Assistance) => void;
  disabled?: boolean;
}) {
  return (
    <View className="gap-3" accessibilityRole="radiogroup" accessibilityLabel="장애 유형">
      {(Object.keys(assistanceLabels) as Assistance[]).map((type) => (
        <Button
          key={type}
          variant={value === type ? 'default' : 'outline'}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === type }}
          disabled={disabled}
          onPress={() => onSelect(type)}
        >
          <Text>{assistanceLabels[type]}</Text>
        </Button>
      ))}
    </View>
  );
}
