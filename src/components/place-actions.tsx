import { View } from 'react-native';
import { Bookmark, Navigation, ShoppingBag } from 'lucide-react-native';
import { router } from 'expo-router';
import { useApp } from '@/providers/app-provider';
import type { Store } from '@/lib/types';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

export function PlaceBookmark({ store }: { store: Store }) {
  const app = useApp();
  const saved = app.savedPlaces?.some((item) => item.storeId === store.storeId) ?? false;
  return (
    <Button
      variant="ghost"
      size="icon"
      accessibilityRole="switch"
      accessibilityState={{ checked: saved }}
      accessibilityLabel={saved ? '저장한 장소에서 삭제' : '장소 저장'}
      accessibilityHint={store.name}
      onPress={() => void app.toggleSaved(store).catch(app.report)}
    >
      <Icon
        as={Bookmark}
        size={21}
        className="text-primary"
        fill={saved ? 'currentColor' : 'none'}
        accessible={false}
      />
    </Button>
  );
}

export function PlaceActions({ store }: { store: Store }) {
  const { connection } = useApp();
  const params = { storeId: store.storeId };
  const guide = store.directoryOnly
    ? {
        ...params,
        name: store.name,
        address: store.address ?? '',
        lat: String(store.location?.lat ?? ''),
        lng: String(store.location?.lng ?? ''),
      }
    : params;
  const paired = !!connection?.kioskId && connection.storeId === store.storeId;
  return (
    <View className="flex-row flex-wrap gap-2">
      <Button
        variant="outline"
        className="min-w-28 flex-1"
        onPress={() => router.push({ pathname: '/guide', params: guide })}
      >
        <Icon as={Navigation} size={18} className="text-primary" accessible={false} />
        <Text className="shrink text-center">길 안내</Text>
      </Button>
      {!store.directoryOnly &&
        (paired || (!store.orderingPaused && store.hasOrderTerminal !== false)) && (
          <Button
            variant="default"
            className="min-w-28 flex-1"
            onPress={() => router.push({ pathname: paired ? '/menu' : '/connect', params })}
          >
            <Icon
              as={ShoppingBag}
              size={18}
              className="text-primary-foreground"
              accessible={false}
            />
            <Text className="shrink text-center">
              {paired ? '메뉴 보기' : '키오스크에 연결해 주문하기'}
            </Text>
          </Button>
        )}
    </View>
  );
}
