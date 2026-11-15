import { Linking, View } from 'react-native';
import { Navigation, X, ShoppingBag, Bookmark } from 'lucide-react-native';
import { router } from 'expo-router';
import { Text } from './ui/text';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { useApp } from '@/providers/app-provider';
import type { Store } from '@/lib/types';
import { directionsUrl } from '@/lib/navigation';
import { accessibilitySummary } from '@/lib/location';
import { useTranslation } from '@/lib/i18n';
export function PlacePreview({ store, onClose }: { store: Store; onClose: () => void }) {
  const app = useApp();
  const { t } = useTranslation();
  const saved = app.savedPlaces?.some((item) => item.storeId === store.storeId) ?? false;
  return (
    <View className="gap-3 rounded-t-3xl border-t border-border bg-card px-5 py-4">
      <View className="flex-row items-start gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text variant="small" className="text-primary">
            {store.directoryOnly ? '일반 장소 · 주문 미지원' : '갈지도 등록 매장'}
          </Text>
          <Text variant="h3" translate={false}>
            {store.name}
          </Text>
          <Text variant="muted" translate={false}>
            {store.address}
          </Text>
        </View>
        <Button
          variant="ghost"
          size="icon"
          accessibilityRole="switch"
          accessibilityState={{ checked: saved }}
          accessibilityLabel={saved ? '저장한 장소에서 삭제' : '장소 저장'}
          onPress={() => void app.toggleSaved(store).catch(app.report)}
        >
          <Icon
            as={Bookmark}
            size={20}
            className="text-primary"
            fill={saved ? 'currentColor' : 'none'}
            accessible={false}
          />
        </Button>
        <Button variant="ghost" size="icon" accessibilityLabel="닫기" onPress={onClose}>
          <Icon as={X} size={20} />
        </Button>
      </View>
      <Text variant="small">
        {store.directoryOnly
          ? '접근성 정보 확인 필요'
          : accessibilitySummary(store).split(' · ').map(t).join(' · ')}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="default"
          className="flex-1"
          onPress={() => void Linking.openURL(directionsUrl(store)).catch(app.report)}
        >
          <Icon as={Navigation} size={18} className="text-primary-foreground" />
          <Text>길찾기</Text>
        </Button>
        {!store.directoryOnly && (
          <Button
            variant="secondary"
            className="flex-1"
            onPress={() => router.push({ pathname: '/store', params: { storeId: store.storeId } })}
          >
            <Icon as={ShoppingBag} size={18} className="text-primary" />
            <Text>매장 정보 · 메뉴</Text>
          </Button>
        )}
      </View>
      <Text variant="muted">
        외부 지도에서 경로를 확인해요. 접근 가능한 경로인지는 별도 확인이 필요해요.
      </Text>
    </View>
  );
}
