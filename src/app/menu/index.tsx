import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Check, MapPin, RefreshCw, ShoppingBag } from 'lucide-react-native';
import { Problem } from '@/components/feedback';
import { errorMessage } from '@/lib/api';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
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
  const [category, setCategory] = useState('전체');
  const id = storeId || app.store?.storeId;

  useEffect(() => setCategory('전체'), [id]);

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

  const store = app.store?.storeId === id ? app.store : null;
  const menu = store?.menu ?? [];
  const categories = [...new Set(menu.map((item) => item.category))];
  const shown = menu.filter((item) => category === '전체' || item.category === category);

  return (
    <Screen title="메뉴 고르기" subtitle="마음에 드는 메뉴를 고르고, 옵션을 선택해 주세요.">
      {loading && <Text accessibilityLiveRegion="polite">메뉴를 불러오는 중입니다.</Text>}
      {!!error && (
        <Problem message={error} busy={loading} retry={() => setRevision((value) => value + 1)} />
      )}
      {!store ? (
        <NavLink href="/">먼저 매장을 선택해 주세요</NavLink>
      ) : (
        <>
          <Card className="overflow-hidden border-0 bg-secondary shadow-none">
            <CardContent className="gap-4 py-6">
              <View className="flex-row items-start gap-3">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-card">
                  <Icon as={MapPin} size={22} className="text-primary" />
                </View>
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-sm font-semibold text-primary">지금 보고 있는 매장</Text>
                  <Text variant="h2">{store.name}</Text>
                  <Text variant="muted">{store.address}</Text>
                </View>
              </View>
              <NavLink href="/guide">매장 정보와 실내 안내</NavLink>
            </CardContent>
          </Card>
          {!app.connection && (
            <Card className="border-primary/20 bg-card shadow-none">
              <CardContent className="gap-3 pt-6">
                <Text className="text-sm font-semibold text-primary">메뉴 미리보기</Text>
                <Text>주문하려면 매장 키오스크에 먼저 연결해 주세요.</Text>
                <NavLink href={{ pathname: '/connect', params: { storeId: store.storeId } }}>
                  이 매장에서 주문 시작
                </NavLink>
              </CardContent>
            </Card>
          )}
          <View className="flex-row flex-wrap items-end justify-between gap-3">
            <View className="gap-1">
              <Text variant="h2">전체 메뉴</Text>
              <Text variant="muted">
                {categories.length}개 분류 · {menu.length}개 메뉴
              </Text>
            </View>
            <Button
              variant="outline"
              disabled={loading || app.busy}
              onPress={() => setRevision((value) => value + 1)}
              accessibilityLabel="메뉴와 판매 상태 새로고침"
            >
              <Icon as={RefreshCw} size={17} />
              <Text>새로고침</Text>
            </Button>
          </View>
          <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
            {['전체', ...categories].map((value) => (
              <Button
                key={value}
                variant={category === value ? 'secondary' : 'outline'}
                className="rounded-full px-5"
                accessibilityRole="radio"
                accessibilityState={{ checked: category === value }}
                onPress={() => setCategory(value)}
              >
                {category === value && <Icon as={Check} size={16} className="text-primary" />}
                <Text>{value}</Text>
              </Button>
            ))}
          </View>
          {!loading && !menu.length && (
            <Card className="shadow-none">
              <CardContent className="gap-2 pt-6">
                <Text variant="h3">메뉴가 아직 없어요</Text>
                <Text variant="muted">매장 직원에게 주문 방법을 확인해 주세요.</Text>
              </CardContent>
            </Card>
          )}
          <View className="flex-row flex-wrap gap-4">
            {shown.map((item) => (
              <Card key={item.id} className="w-full overflow-hidden p-0 sm:w-[48%]">
                {photos[item.id] ? (
                  <Image
                    source={photos[item.id]}
                    style={{ width: '100%', height: 190 }}
                    accessibilityIgnoresInvertColors
                    accessible={false}
                  />
                ) : (
                  <View className="h-28 bg-secondary" />
                )}
                <CardContent className="flex-1 gap-3 py-5">
                  <Text className="text-xs font-semibold text-primary">{item.category}</Text>
                  <View className="gap-1">
                    <Text variant="h3">{item.name}</Text>
                    {!!item.description && <Text variant="muted">{item.description}</Text>}
                  </View>
                  <Text className="mt-auto text-xl font-bold text-foreground">
                    {money(item.price)}
                  </Text>
                  {item.available ? (
                    <Link
                      href={{ pathname: '/menu/[itemId]', params: { itemId: item.id } }}
                      asChild
                    >
                      <Button
                        accessibilityLabel={item.name + ' 옵션 선택'}
                        className="w-full justify-between"
                      >
                        <Text>옵션 선택하기</Text>
                        <Icon as={ArrowRight} size={18} className="text-primary-foreground" />
                      </Button>
                    </Link>
                  ) : (
                    <View className="min-h-12 justify-center rounded-lg bg-muted px-4">
                      <Text
                        accessibilityLabel={item.name + ' 품절'}
                        className="font-medium text-muted-foreground"
                      >
                        오늘은 품절이에요
                      </Text>
                    </View>
                  )}
                </CardContent>
              </Card>
            ))}
          </View>
          <View className="gap-3 border-t border-border pt-6">
            <Link href="/cart" asChild>
              <Button variant="secondary" className="w-full justify-between">
                <Icon as={ShoppingBag} size={19} className="text-secondary-foreground" />
                <Text>장바구니 확인</Text>
                <Icon as={ArrowRight} size={18} className="text-secondary-foreground" />
              </Button>
            </Link>
            <NavLink href="/help">메뉴 이용이 어려워요</NavLink>
          </View>
        </>
      )}
    </Screen>
  );
}
