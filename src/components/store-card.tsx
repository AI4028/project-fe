import { View } from 'react-native';
import { ArrowUpRight, Store as StoreIcon, DoorOpen, Accessibility } from 'lucide-react-native';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { Icon } from './ui/icon';
import type { Store } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';
import { accessibilitySummary, assistanceSummary } from '@/lib/location';
import { useApp } from '@/providers/app-provider';

export function StoreCard({
  store,
  onPress,
  showDistance,
}: {
  store: Store;
  onPress: () => void;
  showDistance: boolean;
}) {
  const access = store.accessibility;
  const { t } = useTranslation();
  const { settings } = useApp();
  return (
    <Button
      variant="outline"
      onPress={onPress}
      accessibilityLabel={`${store.name} 매장 정보 보기`}
      accessibilityHint={`${store.address || t('주소 확인 필요')}. ${accessibilitySummary(store).split(' · ').map(t).join(' · ')}`}
      className="w-full flex-col items-stretch gap-5 rounded-3xl p-5"
    >
      <View className="flex-row items-start gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
          <Icon as={StoreIcon} size={23} className="text-primary" accessible={false} />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text translate={false} className="text-left text-lg font-semibold text-foreground">
            {store.name}
          </Text>
          <Text variant="muted" className="text-left font-normal text-muted-foreground">
            {store.address || '주소 확인 필요'}
          </Text>
        </View>
        <Icon as={ArrowUpRight} size={20} className="text-muted-foreground" accessible={false} />
      </View>
      <View className="flex-row flex-wrap items-center gap-2">
        {access.stepFreeEntrance === true && (
          <View className="flex-row items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5">
            <Icon as={DoorOpen} size={15} className="text-primary" accessible={false} />
            <Text variant="small" className="font-medium text-foreground">
              턱 없는 입구
            </Text>
          </View>
        )}
        {access.accessibleRestroom === true && (
          <View className="flex-row items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5">
            <Icon as={Accessibility} size={15} className="text-primary" accessible={false} />
            <Text variant="small" className="font-medium text-foreground">
              장애인 화장실
            </Text>
          </View>
        )}
        {access.stepFreeEntrance !== true && (
          <Text variant="small" className="text-left font-normal text-muted-foreground">
            {access.stepFreeEntrance === false
              ? '입구에 턱 있음 · 상세 확인'
              : '입구 정보 확인 필요'}
          </Text>
        )}
      </View>
      <Text className="text-left font-normal" translate={false}>
        {assistanceSummary(store, settings.assistance).split(' · ').map(t).join(' · ')}
      </Text>
      {showDistance && store.distanceM != null && (
        <Text variant="small" className="text-left font-medium text-primary">
          {store.distanceM >= 1000
            ? `${(store.distanceM / 1000).toFixed(1)}km`
            : `${Math.round(store.distanceM)}m`}{' '}
          · 직선거리
        </Text>
      )}
    </Button>
  );
}
