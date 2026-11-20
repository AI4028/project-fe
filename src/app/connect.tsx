import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Check, Hash } from 'lucide-react-native';
import { OrderingPaused, Problem, SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { ApiError, errorMessage } from '@/lib/api';
import type { Store } from '@/lib/types';
export default function Connect() {
  const app = useApp();
  const params = useLocalSearchParams<{
    kioskId?: string;
    token?: string;
    storeId?: string;
    next?: string;
  }>();
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
      router.replace(
        params.next === 'help'
          ? { pathname: '/help', params: { storeId: candidate.store.storeId } }
          : '/menu',
      );
    } catch (reason) {
      setWaiting(reason instanceof ApiError && reason.code === 'kiosk-busy');
      if (reason instanceof ApiError && reason.code === 'ordering-paused') {
        // Paused after the store was checked: show the notice instead of an error.
        setCandidate((current) =>
          current ? { ...current, store: { ...current.store, orderingPaused: true } } : current,
        );
        return;
      }
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Screen
      title={candidate ? '이 매장이 맞나요?' : '내 휴대폰으로 주문하기'}
      subtitle={
        candidate
          ? '이름과 주소를 확인한 뒤 연결해 주세요.'
          : '매장 화면에 표시된 코드를 입력해 주세요.'
      }
      voice={false}
      reading
    >
      <SubmissionRecovery />
      {app.connection ? (
        <Card className="rounded-3xl border-primary/30 bg-secondary">
          <CardContent className="gap-4 pt-6">
            <Icon as={Check} size={28} className="text-primary" />
            <Text variant="h3">
              {app.connection.kioskId
                ? `${app.store?.name}에 연결되어 있습니다`
                : '장바구니가 열려 있어요'}
            </Text>
            <Text>
              {app.connection.kioskId
                ? '주문을 이어서 진행할 수 있어요.'
                : '이미 담은 메뉴가 있어요. 바로 주문하거나 장바구니를 비우고 기기 코드로 연결할 수 있어요.'}
            </Text>
            <NavLink href="/menu">메뉴로 이어가기</NavLink>
            <NavLink href="/leave">
              {app.connection.kioskId ? '다른 매장으로 변경' : '장바구니 비우고 기기 코드로 연결'}
            </NavLink>
          </CardContent>
        </Card>
      ) : (
        !app.pendingSubmission && (
          <>
            {!candidate && (
              <View className="gap-4">
                <Card className="w-full rounded-3xl py-0">
                  <CardContent className="gap-4 py-6">
                    <View className="h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                      <Icon as={Hash} size={24} className="text-primary" />
                    </View>
                    <Text className="text-sm font-semibold text-primary">1단계 · 코드 입력</Text>
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
                      placeholder="8자리 연결 코드"
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
                        loading ||
                        app.busy ||
                        kioskId.trim().length !== 4 ||
                        code.trim().length !== 8
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
                <Text variant="muted">
                  코드를 찾기 어렵다면 직원에게 요청하세요. 다음 화면에서 매장을 확인하고 연결할 수
                  있어요.
                </Text>
              </View>
            )}
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
                  <View className="gap-2 rounded-2xl bg-secondary p-4">
                    <Text translate={false} variant="h4">
                      {candidate.store.name}
                    </Text>
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
                  ) : candidate.store.orderingPaused ? (
                    <OrderingPaused />
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
