import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { useApp } from '@/providers/app-provider';
import { subscribe } from '@/lib/live';
export default function Connect() {
  const app = useApp();
  const params = useLocalSearchParams<{ kioskId?: string; token?: string }>();
  const [kioskId, setKioskId] = useState(
    typeof params.kioskId === 'string' ? params.kioskId : 'GK01',
  );
  const [code, setCode] = useState(typeof params.token === 'string' ? params.token : '');
  const [nearby, setNearby] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!app.demo) return;
    return subscribe(
      app.api.wsUrl('/ws/proximity'),
      (event) => {
        if (
          event.type === 'proximity' &&
          typeof event.distance === 'number' &&
          typeof event.kioskId === 'string'
        ) {
          setNearby(`${String(event.storeName)} · 약 ${event.distance.toFixed(1)}m`);
          setKioskId(event.kioskId);
        }
      },
      () => {},
      () => setNearby('데모 비콘 연결을 사용할 수 없습니다.'),
    );
  }, [app.api, app.demo]);
  async function connect(demo = false) {
    setLoading(true);
    try {
      const token = demo ? (await app.api.demoToken(kioskId)).token : code;
      await app.connect(kioskId, token);
      router.replace('/menu');
    } catch (error) {
      app.report(error);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Screen
      title="키오스크 연결"
      subtitle="매장의 연결 코드를 입력하거나 키오스크의 QR을 스캔해 주세요."
    >
      {app.connection ? (
        <>
          <Text>이미 연결되어 있습니다.</Text>
          <NavLink href="/menu">주문 이어가기</NavLink>
        </>
      ) : (
        <Card>
          <CardContent className="gap-4 pt-6">
            {!!nearby && <Text accessibilityLiveRegion="polite">{nearby}</Text>}
            <Text>키오스크 ID</Text>
            <Input
              value={kioskId}
              onChangeText={setKioskId}
              accessibilityLabel="키오스크 ID"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={4}
            />
            <Text>8자리 연결 코드</Text>
            <Input
              value={code}
              onChangeText={setCode}
              accessibilityLabel="연결 코드"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
            />
            <Button
              disabled={loading || app.busy || code.length !== 8 || kioskId.length !== 4}
              onPress={() => void connect()}
            >
              <Text>연결하고 주문 시작</Text>
            </Button>
            {app.demo && (
              <Button
                variant="secondary"
                disabled={loading || app.busy}
                onPress={() => void connect(true)}
              >
                <Text>데모 키오스크 연결</Text>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </Screen>
  );
}
