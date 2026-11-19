import { Image, View } from 'react-native';
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
  return (
    <View className="gap-2 rounded-3xl border border-border bg-card p-3">
      <View className="flex-row items-start gap-1">
        <Button
          variant="ghost"
          onPress={onPress}
          accessibilityLabel={`${name} 매장 정보 보기`}
          accessibilityHint={`${store.address || t('주소 확인 필요')}. ${accessibilitySummary(store).split(' · ').map(t).join(' · ')}`}
          className="min-w-0 flex-1 flex-col items-stretch gap-3 rounded-2xl p-2"
        >
          <View className="flex-row items-start gap-3">
            {store.imageUrl ? (
              <Image
                source={{ uri: store.imageUrl }}
                className="h-20 w-20 rounded-xl bg-secondary"
                accessible={false}
              />
            ) : (
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                <Icon as={StoreIcon} size={23} className="text-primary" accessible={false} />
              </View>
            )}
            <View className="min-w-0 flex-1 gap-1">
              <Text translate={false} className="text-left text-lg font-semibold text-foreground">
                {name}
              </Text>
              <Text variant="muted" className="text-left font-normal text-muted-foreground">
                {store.address || '주소 확인 필요'}
              </Text>
            </View>
          </View>
          {showDistance && store.distanceM != null && (
            <View className="flex-row items-center gap-2">
              <Icon as={MapPin} size={16} className="text-primary" accessible={false} />
              <Text variant="small">
                {store.distanceM >= 1000
                  ? `${(store.distanceM / 1000).toFixed(1)} km`
                  : `${Math.round(store.distanceM)} m`}{' '}
                · {t('직선거리')}
              </Text>
            </View>
          )}
          {hours && (
            <View className="flex-row items-center gap-2">
              <Icon as={Clock} size={16} className="text-primary" accessible={false} />
              <Text variant="small">
                {t('영업시간')} · {hours}
              </Text>
            </View>
          )}
        </Button>
        {actions && <PlaceBookmark store={store} />}
      </View>
      {actions && <PlaceActions store={store} />}
    </View>
  );
}
