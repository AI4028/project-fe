import { CatalogThumbnail } from './catalog-thumbnail';
import { VenueHours } from './venue-hours';
import { venueAddress, venueDistance } from '@/lib/catalog';
import { View } from 'react-native';
import { X, MapPin, Clock } from 'lucide-react-native';
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
  const distance = venueDistance(store, language, t);
  return (
    <View className="gap-2 rounded-3xl border border-border bg-card p-3">
      <View className="flex-row items-start gap-2">
        <CatalogThumbnail imageUrl={store.imageUrl} size={48} />
        <View className="min-w-0 flex-1 gap-1">
          <Text variant="h3" translate={false}>
            {language === 'en' ? store.nameEn || store.name : store.name}
          </Text>
          <Text variant="muted" translate={false}>
            {venueAddress(store, language)}
          </Text>
        </View>
        <PlaceBookmark store={store} />
        <Button variant="ghost" size="icon" accessibilityLabel="닫기" onPress={onClose}>
          <Icon as={X} size={20} />
        </Button>
      </View>
      {!!distance && (
        <View className="flex-row items-center gap-2">
          <Icon as={MapPin} size={16} className="text-primary" />
          <Text variant="small" translate={false}>{distance}</Text>
        </View>
      )}
      {!!(store.hours || store.hoursEn) && (
        <View className="flex-row items-center gap-2">
          <Icon as={Clock} size={16} className="text-primary" />
          <VenueHours store={store} />
        </View>
      )}
      <PlaceActions store={store} />
      <Text variant="small">
        {store.directoryOnly
          ? '일반 장소 · 주문 미지원'
          : accessibilitySummary(store).split(' · ').map(t).join(' · ')}
      </Text>
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
