import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { knownText } from '@/lib/location';
import { useApp } from '@/providers/app-provider';
export default function Guide() {
  const app = useApp();
  const store = app.store;
  const description = store
    ? `${store.name}. ${store.address}. ${store.accessibility.floor ? `${store.accessibility.floor}층.` : ''} ${knownText(store.accessibility.notes)} ${knownText(store.indoorDirections)}`
    : '매장을 먼저 선택해 주세요.';
  return (
    <Screen title="매장 정보 · 실내 안내">
      <Text>{description}</Text>
      <Button onPress={() => app.announce(description)}>
        <Text>안내 듣기</Text>
      </Button>
      <NavLink href="/menu">메뉴 보기</NavLink>
    </Screen>
  );
}
