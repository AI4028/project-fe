import { useEffect, useState } from 'react';
import { Image, View, ScrollView, useWindowDimensions } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Check, Coffee, RefreshCw, ShoppingBag } from 'lucide-react-native';
import { OrderSteps } from '@/components/brand';
import { useTranslation } from '@/lib/i18n';
import { OrderingPaused, Problem } from '@/components/feedback';
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
  const { language } = useTranslation();
  const app = useApp();
  const { width } = useWindowDimensions();
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
    <Screen
      title={store?.name ?? '메뉴 고르기'}
      subtitle="오늘은 무엇을 드실까요?"
      footer={
        app.items.length > 0 ? (
          <NavLink href="/cart" variant="default" icon={ShoppingBag}>
            {`장바구니 ${app.items.reduce((sum, item) => sum + item.qty, 0)}개 · ${money(app.cart.total)}`}
          </NavLink>
        ) : store && !app.connection ? (
          <NavLink
            href={{ pathname: '/connect', params: { storeId: store.storeId } }}
            variant="default"
          >
            매장에서 주문 시작하기
          </NavLink>
        ) : undefined
      }
    >
      {loading && <Text accessibilityLiveRegion="polite">메뉴를 불러오는 중입니다.</Text>}
      {!!error && (
        <Problem message={error} busy={loading} retry={() => setRevision((value) => value + 1)} />
      )}
      {!store ? (
        <NavLink href="/">먼저 매장을 선택해 주세요</NavLink>
      ) : (
        <>
          {app.connection && <OrderSteps current={1} />}
          {store.orderingPaused && <OrderingPaused />}
          {!app.connection && (
            <View className="gap-1 rounded-2xl bg-secondary p-4">
              <Text className="font-semibold text-primary">메뉴를 미리 살펴보세요</Text>
              <Text variant="muted">주문은 매장에 도착한 뒤 코드로 연결하면 돼요.</Text>
            </View>
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 pb-1"
            accessibilityRole="radiogroup"
            accessibilityLabel="메뉴 분류"
          >
            {['전체', ...categories].map((value) => (
              <Button
                key={value}
                variant={category === value ? 'default' : 'outline'}
                className="rounded-full px-5"
                accessibilityRole="radio"
                accessibilityState={{ checked: category === value }}
                onPress={() => setCategory(value)}
              >
                {category === value && (
                  <Icon as={Check} size={16} className="text-primary-foreground" />
                )}
                <Text>{value}</Text>
              </Button>
            ))}
          </ScrollView>
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
              <Card
                key={item.id}
                className="overflow-hidden p-0"
                style={{ width: width >= 760 ? '48%' : '100%' }}
              >
                <View className="flex-row items-center gap-4 p-4">
                  {photos[item.id] ? (
                    <Image
                      source={photos[item.id]}
                      style={{ width: 96, height: 112, borderRadius: 16 }}
                      accessibilityIgnoresInvertColors
                      accessible={false}
                    />
                  ) : (
                    <View className="h-28 w-24 items-center justify-center rounded-2xl bg-secondary">
                      <Icon as={Coffee} size={28} className="text-primary" />
                    </View>
                  )}
                  <View className="min-w-0 flex-1 gap-2">
                    <Text translate={false} variant="small" className="text-muted-foreground">
                      {item.category}
                    </Text>
                    <View className="gap-1">
                      <Text translate={false} variant="h3">
                        {language === 'en' ? item.nameEn || item.name : item.name}
                      </Text>
                    </View>
                    <Text className="text-lg font-semibold text-foreground">
                      {money(item.price)}
                    </Text>
                  </View>
                </View>
                <CardContent className="gap-3 px-4 pb-4">
                  {!!item.description && (
                    <Text translate={false} variant="muted">
                      {item.description}
                    </Text>
                  )}
                  {item.available ? (
                    <Link
                      href={{ pathname: '/menu/[itemId]', params: { itemId: item.id } }}
                      asChild
                    >
                      <Button
                        accessibilityLabel={item.name + ' 옵션 선택'}
                        variant="secondary"
                        className="w-full justify-between"
                      >
                        <Text>담으러 가기</Text>
                        <Icon as={ArrowRight} size={18} className="text-primary" />
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
          <View className="flex-row flex-wrap gap-3 border-t border-border pt-4">
            <NavLink href="/guide" variant="ghost">
              매장 이용 안내
            </NavLink>
            <NavLink href="/help" variant="ghost">
              주문 도움받기
            </NavLink>
          </View>
        </>
      )}
    </Screen>
  );
}
