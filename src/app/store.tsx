import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useApp } from '@/providers/app-provider';
import { accessibilitySummary, knownText } from '@/lib/location';
export default function StoreDetails() {
  const app = useApp();
  const store = app.store;
  const methods: Record<string, string> = {
    phone: '스마트폰 주문',
    kiosk: '키오스크',
    staff: '직원 주문',
    qr: 'QR 주문',
    table: '테이블 주문',
  };
  return (
    <Screen title={store?.name ?? '매장 선택'}>
      {store ? (
        <>
          <Text>{store.address}</Text>
          <Text>{accessibilitySummary(store)}</Text>
          <Text>{knownText(store.accessibility.notes)}</Text>
          <Text>
            주문 방법:{' '}
            {store.orderingMethods?.map((method) => methods[method] ?? method).join(', ') ||
              '확인 필요'}
          </Text>
          <Text>실내 안내: {knownText(store.indoorDirections)}</Text>
          <Button
            onPress={() =>
              app.announce(
                `${store.name}. ${accessibilitySummary(store)}. ${knownText(store.indoorDirections)}`,
              )
            }
          >
            <Text>매장 안내 듣기</Text>
          </Button>
          <NavLink href="/menu">메뉴 둘러보기</NavLink>
          <NavLink href="/connect">이 매장에서 주문하기</NavLink>
        </>
      ) : (
        <NavLink href="/">매장 선택하기</NavLink>
      )}
    </Screen>
  );
}
