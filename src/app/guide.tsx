import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { knownText } from '@/lib/location';
import { useApp } from '@/providers/app-provider';
import { errorMessage } from '@/lib/api';
import type { Store } from '@/lib/types';
export default function Guide() {
  const app = useApp();
  const { storeId } = useLocalSearchParams<{ storeId?: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setError('');
    if (!storeId) {
      setStore(app.store ?? null);
      return;
    }
    if (app.store?.storeId === storeId) {
      setStore(app.store);
      return;
    }
    setStore(null);
    void app.api
      .store(storeId)
      .then((value) => {
        if (active) setStore(value);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [storeId, app.api, app.store]);
  const description = store
    ? `${store.name}. ${store.address}. ${store.accessibility.floor ? `${store.accessibility.floor}층.` : ''} ${knownText(store.accessibility.notes)} ${knownText(store.indoorDirections)}`
    : '매장을 먼저 선택해 주세요.';
  return (
    <Screen title="매장 정보 · 실내 안내">
      {!!error && <Text>{error}</Text>}
      <Text>{description}</Text>
      <Button onPress={() => app.announce(description)}>
        <Text>안내 듣기</Text>
      </Button>
      <NavLink
        href={store ? { pathname: '/menu', params: { storeId: store.storeId } } : { pathname: '/menu' }}
      >
        메뉴 보기
      </NavLink>
    </Screen>
  );
}
