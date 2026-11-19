import { Linking } from 'react-native';
import { Phone } from 'lucide-react-native';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Text } from './ui/text';
import { isKnown } from '@/lib/location';

/** Opens the phone dialer for the store. Renders nothing until the store lists a number. */
export function CallStore({ phone }: { phone?: string | null }) {
  if (!isKnown(phone ?? undefined)) return null;
  return (
    <Button
      variant="outline"
      onPress={() => void Linking.openURL(`tel:${phone!.replace(/-/g, '')}`)}
    >
      <Icon as={Phone} size={19} className="text-primary" accessible={false} />
      <Text className="shrink text-center">
        매장 전화 <Text translate={false}>({phone})</Text>
      </Text>
    </Button>
  );
}
