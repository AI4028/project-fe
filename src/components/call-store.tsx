import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Phone } from 'lucide-react-native';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

export function CallStore({ phone }: { phone?: string | null }) {
  const [failedNumber, setFailedNumber] = useState('');
  const number = phone?.replace(/[\s()-]/g, '');
  if (!number || !/^\+?\d{7,15}$/.test(number)) return null;
  return (
    <View className="gap-2">
      <Button
        variant="outline"
        onPress={() => {
          setFailedNumber('');
          void Linking.openURL(`tel:${number}`).catch(() => setFailedNumber(number));
        }}
      >
        <Icon as={Phone} size={19} className="text-primary" accessible={false} />
        <Text className="shrink text-center">
          매장 전화 <Text translate={false}>({phone})</Text>
        </Text>
      </Button>
      {failedNumber === number && (
        <Text accessibilityRole="alert">전화 앱을 열 수 없어요. 표시된 번호로 전화해 주세요.</Text>
      )}
    </View>
  );
}
