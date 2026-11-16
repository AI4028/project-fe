import { View } from 'react-native';
import { Bookmark } from 'lucide-react-native';
import { Screen, NavLink } from '@/components/screen';
import { EmptyState } from '@/components/brand';
import { StoreCard } from '@/components/store-card';
import { PlacePreview } from '@/components/place-preview';
import { useApp } from '@/providers/app-provider';
import { useState } from 'react';
export default function Saved() {
  const app = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = app.savedPlaces.find((store) => store.storeId === selectedId);
  return (
    <Screen
      title="저장한 장소"
      subtitle="다시 찾고 싶은 장소를 모아 두세요."
      voice={false}
      footer={
        selected ? <PlacePreview store={selected} onClose={() => setSelectedId(null)} /> : undefined
      }
    >
      {!app.savedPlaces.length ? (
        <EmptyState
          icon={Bookmark}
          title="아직 저장한 장소가 없어요"
          description="장소 정보를 열고 저장 버튼을 눌러보세요."
        >
          <NavLink href="/">둘러보기</NavLink>
        </EmptyState>
      ) : (
        <View className="gap-3">
          {app.savedPlaces.map((store) => (
            <StoreCard
              key={store.storeId}
              store={store}
              showDistance={false}
              onPress={() => setSelectedId(store.storeId)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
