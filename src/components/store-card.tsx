import { CatalogThumbnail } from './catalog-thumbnail';
import { VenueHours } from './venue-hours';
import { venueAddress, venueDistance } from '@/lib/catalog';
import { View } from 'react-native';
import { Store as StoreIcon, Clock, MapPin } from 'lucide-react-native';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { Icon } from './ui/icon';
import type { Store } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';
import { accessibilitySummary } from '@/lib/location';
import { PlaceActions, PlaceBookmark } from './place-actions';

export function StoreCard({
  store,
  onPress,
  showDistance,
  actions = false,
}: {
  store: Store;
  onPress: () => void;
  showDistance: boolean;
  actions?: boolean;
}) {
  const { t, language } = useTranslation();
  const hours = (language === 'en' && store.hoursEn) || store.hours;
  const name = language === 'en' ? store.nameEn || store.name : store.name;
  const distanceText = showDistance ? venueDistance(store, language, t) : '';
  return (
    <View className="gap-2 rounded-3xl border border-border bg-card p-3">
      <View className="flex-row items-start gap-1">
        <Button
          variant="ghost"
          onPress={onPress}
          accessibilityLabel={`${name} 매장 정보 보기`}
          accessibilityHint={`${distanceText ? distanceText + '. ' : ''}${venueAddress(store, language) || t('주소 확인 필요')}. ${accessibilitySummary(store).split(' · ').map(t).join(' · ')}`}
          className="min-w-0 flex-1 flex-col items-stretch gap-3 rounded-2xl p-2"
        >
          <View className="flex-row items-start gap-3">
            <CatalogThumbnail
              imageUrl={store.imageUrl}
              size={72}
              height={80}
              fallback={StoreIcon}
            />
            <View className="min-w-0 flex-1 gap-1">
              <Text translate={false} className="text-left text-lg font-semibold text-foreground">
                {name}
              </Text>
              <Text variant="muted" className="text-left font-normal text-muted-foreground">
                {venueAddress(store, language) || '주소 확인 필요'}
              </Text>
            </View>
          </View>
          {!!distanceText && (
            <View className="flex-row items-center gap-2">
              <Icon as={MapPin} size={16} className="text-primary" accessible={false} />
              <Text variant="small" translate={false}>
                {distanceText}
              </Text>
            </View>
          )}
          {hours && (
            <View className="flex-row items-center gap-2">
              <Icon as={Clock} size={16} className="text-primary" accessible={false} />
              <VenueHours store={store} />
            </View>
          )}
        </Button>
        {actions && <PlaceBookmark store={store} />}
      </View>
      {actions && <PlaceActions store={store} />}
    </View>
  );
}
