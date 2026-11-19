import { View } from 'react-native';
import { X } from 'lucide-react-native';
import { router } from 'expo-router';
import { Text } from './ui/text';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import type { Store } from '@/lib/types';
import { accessibilitySummary } from '@/lib/location';
import { useTranslation } from '@/lib/i18n';
import { PlaceActions, PlaceBookmark } from './place-actions';
export function PlacePreview({ store, onClose }: { store: Store; onClose: () => void }) {
  const { t, language } = useTranslation();
  return (
    <View className="gap-3 rounded-t-3xl border-t border-border bg-card px-5 py-4">
      <View className="flex-row items-start gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text variant="small" className="text-primary">
            {store.directoryOnly ? '일반 장소 · 주문 미지원' : '갈지도 등록 매장'}
          </Text>
          <Text variant="h3" translate={false}>
            {language === 'en' ? store.nameEn || store.name : store.name}
          </Text>
          <Text variant="muted" translate={false}>
            {store.address}
          </Text>
        </View>
        <PlaceBookmark store={store} />
        <Button variant="ghost" size="icon" accessibilityLabel="닫기" onPress={onClose}>
          <Icon as={X} size={20} />
        </Button>
      </View>
      <Text variant="small">
        {store.directoryOnly
          ? '접근성 정보 확인 필요'
          : accessibilitySummary(store).split(' · ').map(t).join(' · ')}
      </Text>
      <PlaceActions store={store} />
      {!store.directoryOnly && (
        <Button
          variant="ghost"
          onPress={() => router.push({ pathname: '/store', params: { storeId: store.storeId } })}
        >
          <Text>매장 정보 · 메뉴</Text>
        </Button>
      )}
      {store.location && (
        <Button
          variant="outline"
          onPress={() =>
            router.push({
              pathname: '/accessibility',
              params: {
                lat: String(store.location!.lat),
                lng: String(store.location!.lng),
                name: store.name,
              },
            })
          }
        >
          <Text>주변 접근성 정보</Text>
        </Button>
      )}
    </View>
  );
}
