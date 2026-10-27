import { useState } from 'react';
import { Image, View } from 'react-native';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useApp } from '@/providers/app-provider';
import { money } from '@/lib/cart';
const photos: Record<string, number> = {
  americano: require('../../../assets/menu/americano.jpg'),
  'cafe-latte': require('../../../assets/menu/cafe_latte.jpg'),
  'vanilla-latte': require('../../../assets/menu/vanilla_latte.jpg'),
  'grapefruit-ade': require('../../../assets/menu/grapefruit_ade.jpg'),
};
export default function Menu() {
  const app = useApp();
  const [category, setCategory] = useState('전체');
  const menu = app.store?.menu ?? [];
  return (
    <Screen
      title={app.store?.name ?? '메뉴'}
      subtitle="옵션과 수량을 선택해 장바구니에 담아 주세요."
    >
      {!app.store ? (
        <NavLink href="/">먼저 매장을 선택해 주세요</NavLink>
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2">
            <NavLink href="/guide">매장 정보 · 실내 안내</NavLink>
            <Button
              variant="outline"
              onPress={() => void app.selectStore(app.store!.storeId).catch(app.report)}
            >
              <Text>메뉴 새로고침</Text>
            </Button>
          </View>
          {!app.connection && <NavLink href="/connect">키오스크에 연결하기</NavLink>}
          <View className="flex-row flex-wrap gap-2">
            {['전체', ...new Set(menu.map((item) => item.category))].map((value) => (
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
                        옵션 선택
                      </NavLink>
                    ) : (
                      <Text accessibilityLabel={`${item.name} 품절`}>오늘은 품절입니다</Text>
                    )}
                  </CardContent>
                </Card>
              ))}
          </View>
          <NavLink href="/cart">장바구니 확인</NavLink>
        </>
      )}
    </Screen>
  );
}
