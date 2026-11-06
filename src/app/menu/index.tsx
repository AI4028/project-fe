import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Problem } from '@/components/feedback';
import { errorMessage } from '@/lib/api';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useApp } from '@/providers/app-provider';
import { money } from '@/lib/cart';
const photos: Record<string, number> = {
  americano: require('../../../assets/menu/americano.jpg'),
  'cafe-latte': require('../../../assets/menu/cafe-latte.jpg'),
  'vanilla-latte': require('../../../assets/menu/vanilla-latte.jpg'),
  'grapefruit-ade': require('../../../assets/menu/grapefruit-ade.jpg'),
};
export default function Menu() {
  const app = useApp();
  const { storeId } = useLocalSearchParams<{ storeId?: string }>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const id = storeId || app.store?.storeId;
  useEffect(() => {
    let active = true;
    if (!id) return;
    setLoading(true);
    setError('');
    void app
      .selectStore(id)
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, app.api, revision]);
  const [category, setCategory] = useState('전체');
  const menu = app.store && app.store.storeId === id ? (app.store.menu ?? []) : [];
  const categories = [...new Set(menu.map((item) => item.category))];
  return (
    <Screen
      title={app.store?.name ?? '메뉴'}
      subtitle="옵션과 수량을 선택해 장바구니에 담아 주세요."
    >
      {loading && <Text>메뉴를 불러오는 중입니다.</Text>}
      {!!error && (
        <Problem message={error} busy={loading} retry={() => setRevision((value) => value + 1)} />
      )}
      {!app.store || app.store.storeId !== id ? (
        <NavLink href="/">먼저 매장을 선택해 주세요</NavLink>
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2">
            <NavLink href="/guide">매장 정보 · 실내 안내</NavLink>
            <Button
              variant="outline"
              disabled={loading || app.busy}
              onPress={() => setRevision((value) => value + 1)}
            >
              <Text>메뉴 새로고침</Text>
            </Button>
          </View>
          {!app.connection && (
            <>
              <Text>메뉴 미리보기입니다. 실제로 주문하려면 매장 연결이 필요합니다.</Text>
              <NavLink href={{ pathname: '/connect', params: { storeId: app.store.storeId } }}>
                이 매장에서 주문 시작
              </NavLink>
            </>
          )}
          <Text variant="h2">메뉴 구성</Text>
          <Text>
            카테고리 {categories.length}개 · 메뉴 {menu.length}개
          </Text>
          <Text>
            {categories
              .map((value) => `${value} ${menu.filter((item) => item.category === value).length}개`)
              .join(' · ')}
          </Text>
          {!loading && !menu.length && (
            <Text>등록된 메뉴가 없습니다. 매장 직원에게 주문 방법을 확인해 주세요.</Text>
          )}
          <View className="flex-row flex-wrap gap-2">
            {['전체', ...categories].map((value) => (
              <Button
                key={value}
                variant={category === value ? 'default' : 'outline'}
                accessibilityState={{ selected: category === value }}
                onPress={() => setCategory(value)}
              >
                <Text>{value}</Text>
              </Button>
            ))}
          </View>
          <View className="flex-row flex-wrap gap-4">
            {menu
              .filter((item) => category === '전체' || item.category === category)
              .map((item) => (
                <Card key={item.id} className="w-full sm:w-[48%] overflow-hidden">
                  {photos[item.id] && (
                    <Image
                      source={photos[item.id]}
                      style={{ width: '100%', height: 180 }}
                      accessibilityIgnoresInvertColors
                      accessible={false}
                    />
                  )}
                  <CardContent className="gap-3 pt-5">
                    <Text variant="h3">{item.name}</Text>
                    <Text variant="muted">{item.description}</Text>
                    <Text className="font-bold">{money(item.price)}</Text>
                    {item.available ? (
                      <NavLink href={{ pathname: '/menu/[itemId]', params: { itemId: item.id } }}>
                        {`${item.name} 옵션 선택`}
                      </NavLink>
                    ) : (
                      <Text accessibilityLabel={`${item.name} 품절`}>오늘은 품절입니다</Text>
                    )}
                  </CardContent>
                </Card>
              ))}
          </View>
          <NavLink href="/cart">장바구니 확인</NavLink>
          <NavLink href="/help">메뉴를 이용하기 어려워요</NavLink>
        </>
      )}
    </Screen>
  );
}
