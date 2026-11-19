import { View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

export function MapUnavailable() {
  return (
    <View className="items-center gap-3 bg-muted px-6 py-12">
      <Icon as={MapPin} size={30} className="text-primary" accessible={false} />
      <Text variant="h3">지도를 표시할 수 없어요</Text>
      <Text className="max-w-sm text-center text-muted-foreground">
        검색으로 장소를 찾거나 외부 지도 앱을 이용해 주세요.
      </Text>
    </View>
  );
}
