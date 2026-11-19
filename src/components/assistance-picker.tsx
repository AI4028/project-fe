import { View } from 'react-native';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { Icon } from './ui/icon';
import { Check, Eye, Accessibility, PersonStanding } from 'lucide-react-native';
import { assistanceLabels, type Assistance } from '@/lib/location';

const options = {
  visual: { icon: Eye, description: '화면 읽기에 맞춘 장소 목록과 접근성 정보를 제공해요.' },
  physical: { icon: PersonStanding, description: '지도에서 장소와 출입구 정보를 확인해요.' },
  wheelchair: {
    icon: Accessibility,
    description: '지도에서 턱 없는 입구와 화장실 정보를 확인해요.',
  },
} as const;

export function AssistancePicker({
  value,
  onSelect,
  disabled = false,
  descriptions = false,
}: {
  value?: Assistance;
  onSelect: (value: Assistance) => void;
  disabled?: boolean;
  descriptions?: boolean;
}) {
  return (
    <View className="gap-3" accessibilityRole="radiogroup" accessibilityLabel="장애 유형">
      {(Object.keys(assistanceLabels) as Assistance[]).map((type) => (
        <Button
          key={type}
          variant={value === type ? 'secondary' : 'outline'}
          className={descriptions ? 'justify-start gap-4 p-5' : undefined}
          accessibilityRole="radio"
          accessibilityLabel={assistanceLabels[type]}
          accessibilityHint={descriptions ? options[type].description : undefined}
          accessibilityState={{ checked: value === type }}
          disabled={disabled}
          onPress={() => onSelect(type)}
        >
          {descriptions && (
            <Icon as={options[type].icon} size={24} className="text-primary" accessible={false} />
          )}
          <View className={descriptions ? 'min-w-0 flex-1 gap-1' : undefined}>
            <Text className={descriptions ? 'text-left font-semibold' : undefined}>
              {assistanceLabels[type]}
            </Text>
            {descriptions && (
              <Text className="text-left text-sm font-normal text-muted-foreground">
                {options[type].description}
              </Text>
            )}
          </View>
          {value === type && (
            <Icon as={Check} size={20} className="text-primary" accessible={false} />
          )}
        </Button>
      ))}
    </View>
  );
}
