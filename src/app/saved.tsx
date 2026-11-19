import { View } from 'react-native';
import { Bookmark, Coffee, Store as StoreIcon } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { EmptyState } from '@/components/brand';
import { MenuThumbnail } from '@/components/menu-controls';
import { StoreCard } from '@/components/store-card';
import { PlacePreview } from '@/components/place-preview';
import { useApp } from '@/providers/app-provider';
import { useCallback, useState } from 'react';
import { ApiError } from '@/lib/api';
import type { Store } from '@/lib/types';
import { useSavedMenus } from '@/lib/use-saved-menus';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Text } from '@/components/ui/text';

export default function Saved() {
  const app = useApp();
  const [section, setSection] = useState<'places' | 'menus'>('places');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = app.savedPlaces.find((store) => store.storeId === selectedId);
  return (
    <Screen
      title={section === 'menus' ? '저장된 메뉴' : '저장된 매장'}
      subtitle="저장한 매장과 메뉴를 다시 찾아요."
      voice={false}
      footer={
        selected && section === 'places' ? (
          <PlacePreview store={selected} onClose={() => setSelectedId(null)} />
        ) : undefined
      }
    >
      <SegmentedControl
        value={section}
        onChange={setSection}
        label="저장한 항목 종류"
        options={[
          { value: 'places', label: '매장', icon: StoreIcon },
          { value: 'menus', label: '메뉴', icon: Coffee },
        ]}
      />
      {section === 'menus' ? (
        <SavedMenus />
      ) : app.savedPlacesError ? (
        <Card>
          <CardContent className="gap-3">
            <Text accessibilityRole="alert">{app.savedPlacesError}</Text>
            <Button variant="outline" onPress={() => void app.reloadSavedPlaces()}>
              <Text>다시 시도</Text>
            </Button>
          </CardContent>
        </Card>
      ) : !app.savedPlacesReady ? (
        <Text accessibilityLiveRegion="polite">저장한 장소를 불러오는 중이에요.</Text>
      ) : !app.savedPlaces.length ? (
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
              actions
              onPress={() => setSelectedId(store.storeId)}
            />
          ))}
          <NavLink href="/">다른 매장 둘러보기</NavLink>
        </View>
      )}
    </Screen>
  );
}

type Lookup = { status: 'ready'; store: Store } | { status: 'unavailable' | 'error' };

function SavedMenus() {
  const app = useApp();
  const { t, language } = useTranslation();
  const saved = useSavedMenus(app.api.base);
  const [results, setResults] = useState<{ key: string; values: Map<string, Lookup> }>();
  const [revision, setRevision] = useState(0);
  const storeIds = JSON.stringify([...new Set(saved.entries.map((entry) => entry.storeId))]);
  const key = JSON.stringify([app.api.base, storeIds, revision]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const ids: string[] = JSON.parse(storeIds);
      setResults(undefined);
      if (ids.length) {
        void Promise.all(
          ids.map(async (id): Promise<[string, Lookup]> => {
            try {
              return [id, { status: 'ready', store: await app.api.store(id) }];
            } catch (reason) {
              return [
                id,
                {
                  status:
                    reason instanceof ApiError && reason.status === 404 ? 'unavailable' : 'error',
                },
              ];
            }
          }),
        ).then((values) => {
          if (active) setResults({ key, values: new Map(values) });
        });
      }
      return () => {
        active = false;
      };
    }, [app.api, key, storeIds]),
  );

  if (saved.error)
    return (
      <Card>
        <CardContent className="gap-3">
          <Text accessibilityRole="alert">저장한 메뉴를 불러오지 못했어요</Text>
          <Button variant="outline" onPress={() => void saved.reload()}>
            <Text>다시 시도</Text>
          </Button>
        </CardContent>
      </Card>
    );
  if (!saved.ready)
    return <Text accessibilityLiveRegion="polite">저장한 메뉴를 불러오는 중이에요.</Text>;
  if (!saved.entries.length)
    return (
      <EmptyState
        icon={Coffee}
        title="아직 저장한 메뉴가 없어요"
        description="다시 고르고 싶은 메뉴의 북마크를 눌러보세요."
      >
        <NavLink href="/">매장 둘러보기</NavLink>
      </EmptyState>
    );
  const lookups = results?.key === key ? results.values : undefined;
  return (
    <View className="gap-3">
      {!lookups && (
        <Text accessibilityLiveRegion="polite">현재 메뉴와 가격을 확인하고 있어요.</Text>
      )}
      {saved.entries.map((entry) => {
        const lookup = lookups?.get(entry.storeId);
        const store = lookup?.status === 'ready' ? lookup.store : undefined;
        const item = store?.menu?.find((item) => item.id === entry.itemId);
        const available = store && item?.available && !store.orderingPaused;
        const name =
          (language === 'en' ? item?.nameEn || item?.name : item?.name) || entry.itemName;
        const storeName =
          (language === 'en' ? store?.nameEn || store?.name : store?.name) || entry.storeName;
        return (
          <Card key={JSON.stringify([entry.storeId, entry.itemId])} className="rounded-3xl">
            <CardContent className="gap-3">
              <View className="flex-row items-start gap-3">
                <MenuThumbnail imageUrl={item?.imageUrl} size={52} />
                <View className="min-w-0 flex-1 gap-1">
                  <Text variant="h3" translate={false}>
                    {name}
                  </Text>
                  <Text variant="muted" translate={false}>
                    {storeName}
                  </Text>
                  {item && (
                    <Text className="font-semibold text-primary">{`${item.price.toLocaleString('ko-KR')}원`}</Text>
                  )}
                </View>
                <Button
                  variant="ghost"
                  size="icon"
                  accessibilityRole="switch"
                  accessibilityState={{ checked: true }}
                  accessibilityLabel={t('저장한 메뉴에서 삭제')}
                  accessibilityHint={name}
                  onPress={() => void saved.toggle(entry).catch(app.report)}
                >
                  <Icon
                    as={Bookmark}
                    fill="currentColor"
                    size={21}
                    className="text-primary"
                    accessible={false}
                  />
                </Button>
              </View>
              {lookup?.status === 'error' ? (
                <>
                  <Text accessibilityRole="alert">현재 가격과 판매 상태를 확인하지 못했어요.</Text>
                  <Button variant="outline" onPress={() => setRevision((value) => value + 1)}>
                    <Text>다시 시도</Text>
                  </Button>
                </>
              ) : available ? (
                <NavLink
                  href={{
                    pathname: '/menu/[itemId]',
                    params: { storeId: entry.storeId, itemId: entry.itemId },
                  }}
                  variant="default"
                >
                  메뉴 고르기
                </NavLink>
              ) : lookup ? (
                <>
                  <Text>
                    {store?.orderingPaused
                      ? '지금은 주문을 받지 않아요.'
                      : '현재 판매하지 않는 메뉴예요.'}
                  </Text>
                  {store ? (
                    <NavLink href={{ pathname: '/menu', params: { storeId: entry.storeId } }}>
                      매장의 다른 메뉴 보기
                    </NavLink>
                  ) : (
                    <NavLink href="/">매장 둘러보기</NavLink>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </View>
  );
}
