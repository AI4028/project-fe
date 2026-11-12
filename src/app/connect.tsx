import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Check, Hash, Link2, ShieldCheck, Store as StoreIcon } from 'lucide-react-native';
import { Problem, SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { ApiError, errorMessage } from '@/lib/api';
import type { Store } from '@/lib/types';
export default function Connect() {
  const app = useApp();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ kioskId?: string; token?: string; storeId?: string }>();
  const [kioskId, setKioskId] = useState(params.kioskId ?? '');
  const [code, setCode] = useState(params.token ?? '');
  const [candidate, setCandidate] = useState<{
    kioskId: string;
    name: string;
    store: Store;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);
  const mismatch = candidate && params.storeId && candidate.store.storeId !== params.storeId;
  async function inspect(demo = false) {
    setLoading(true);
    setError('');
    setWaiting(false);
    setCandidate(null);
    try {
      const id = demo ? 'GK01' : kioskId.trim().toUpperCase();
      const kiosk = await app.api.kioskInfo(id);
      const store = await app.api.store(kiosk.storeId);
      if (demo) {
        setKioskId(id);
        setCode((await app.api.demoToken(id)).token);
      }
      setCandidate({ kioskId: id, name: kiosk.name, store });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }
  async function connect() {
    if (!candidate || mismatch) return;
    setLoading(true);
    setError('');
    setWaiting(false);
    try {
      await app.connect(candidate.kioskId, code, candidate.store.storeId);
      router.replace('/menu');
    } catch (reason) {
      setWaiting(reason instanceof ApiError && reason.code === 'kiosk-busy');
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Screen
      title="매장에서 주문 시작"
      subtitle="받은 코드를 입력하고, 연결할 매장을 확인해 주세요."
      voice={false}
    >
      <SubmissionRecovery />
      {app.connection ? (
        <Card className="rounded-3xl border-primary/30 bg-secondary">
          <CardContent className="gap-4 pt-6">
            <Icon as={Check} size={28} className="text-primary" />
            <Text variant="h3">{app.store?.name}에 연결되어 있습니다</Text>
            <Text>주문을 이어서 진행할 수 있어요.</Text>
            <NavLink href="/menu">메뉴로 이어가기</NavLink>
            <NavLink href="/leave">다른 매장으로 변경</NavLink>
          </CardContent>
        </Card>
      ) : (
        !app.pendingSubmission && (
          <>
            <View className="flex-row flex-wrap gap-4">
              <Card
                className="min-w-0 rounded-3xl"
                style={width >= 760 ? { width: '60%' } : { width: '100%' }}
              >
                <CardContent className="gap-4 pt-6">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                    <Icon as={Hash} size={24} className="text-primary" />
                  </View>
                  <Text className="text-sm font-semibold text-primary">1단계 · 코드 입력</Text>
                  <Text variant="h3">매장에서 받은 코드</Text>
                  <Text className="text-muted-foreground">
                    코드나 연결 링크는 직원에게 요청할 수 있어요. 카메라나 위치 권한은 필요하지
                    않습니다.
                  </Text>
                  <Text className="font-semibold">매장 기기 코드 · 4자리</Text>
                  <Input
                    accessibilityLabel="매장 기기 코드"
                    placeholder="예: GK01"
                    value={kioskId}
                    editable={!loading}
                    onChangeText={(value) => {
                      setKioskId(value.toUpperCase());
                      setCandidate(null);
                      setError('');
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={4}
                  />
                  <Text className="font-semibold">연결 코드 · 8자리</Text>
                  <Input
                    accessibilityLabel="연결 코드"
                    value={code}
                    editable={!loading}
                    onChangeText={(value) => {
                      setCode(value.toUpperCase());
                      setCandidate(null);
                      setError('');
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={8}
                  />
                  <Button
                    disabled={
                      loading || app.busy || kioskId.trim().length !== 4 || code.trim().length !== 8
                    }
                    onPress={() => void inspect()}
                  >
                    <Text>{loading ? '확인 중' : '연결할 매장 확인하기'}</Text>
                  </Button>
                  {app.demo && (
                    <Button
                      variant="secondary"
                      disabled={loading || app.busy}
                      onPress={() => void inspect(true)}
                    >
                      <Text>데모 매장 확인</Text>
                    </Button>
                  )}
                </CardContent>
              </Card>
              <Card
                className="min-w-0 rounded-3xl bg-secondary"
                style={width >= 760 ? { width: '37%' } : { width: '100%' }}
              >
                <CardContent className="gap-4 pt-6">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-card">
                    <Icon as={ShieldCheck} size={24} className="text-primary" />
                  </View>
                  <Text variant="h4">안심하고 연결하세요</Text>
                  <Text>코드로 매장을 확인한 뒤 연결 여부를 직접 선택합니다.</Text>
                  <View className="flex-row items-start gap-3">
                    <Icon as={StoreIcon} size={19} className="mt-1 text-primary" />
                    <Text className="flex-1">매장 이름과 주소를 확인하세요.</Text>
                  </View>
                  <View className="flex-row items-start gap-3">
                    <Icon as={Link2} size={19} className="mt-1 text-primary" />
                    <Text className="flex-1">코드를 찾기 어렵다면 직원에게 문의하세요.</Text>
                  </View>
                </CardContent>
              </Card>
            </View>
            {!!error && <Problem message={error} />}
            {waiting && (
              <Text>
                다른 고객이 주문 중입니다. 자동으로 대기 등록되지는 않습니다. 잠시 후 다시
                연결하거나 직원에게 직접 주문해 주세요.
              </Text>
            )}
            {candidate && (
              <Card className="rounded-3xl border-primary/30">
                <CardContent className="gap-3 pt-6">
                  <Text className="text-sm font-semibold text-primary">2단계 · 매장 확인</Text>
                  <Text variant="h3">이 매장이 맞나요?</Text>
                  <View className="gap-2 rounded-2xl bg-secondary p-4">
                    <Text variant="h4">{candidate.store.name}</Text>
                    <Text>{candidate.store.address || '주소 확인 필요'}</Text>
                    <Text variant="muted">매장 기기: {candidate.name}</Text>
                  </View>
                  {mismatch ? (
                    <>
                      <Text accessibilityRole="alert">
                        선택했던 매장과 다릅니다. 연결하지 않았습니다. 코드나 지점을 다시 확인해
                        주세요.
                      </Text>
                      <NavLink href="/">매장 다시 선택</NavLink>
                    </>
                  ) : (
                    <Button disabled={loading || app.busy} onPress={() => void connect()}>
                      <Text>{waiting ? '다시 연결하기' : '이 매장이 맞아요 · 연결하기'}</Text>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={loading}
                    onPress={() => {
                      setCandidate(null);
                      setCode('');
                      setWaiting(false);
                      setError('');
                    }}
                  >
                    <Text>다른 코드 입력</Text>
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )
      )}
      <NavLink
        href={{ pathname: '/help', params: params.storeId ? { storeId: params.storeId } : {} }}
      >
        코드 없이 이용하기 · 직원에게 문의
      </NavLink>
      <NavLink
        href={params.storeId ? { pathname: '/store', params: { storeId: params.storeId } } : '/'}
      >
        연결하지 않고 돌아가기
      </NavLink>
    </Screen>
  );
}
