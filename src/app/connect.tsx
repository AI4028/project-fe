import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, NavLink } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Problem, SubmissionRecovery } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { ApiError, errorMessage } from '@/lib/api';
import type { Store } from '@/lib/types';
export default function Connect() {
  const app = useApp();
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
      title="매장에 연결하기"
      subtitle="코드나 연결 링크로 시작합니다. 카메라나 위치 권한 없이도 이용할 수 있어요."
      voice={false}
    >
      <SubmissionRecovery />
      {app.connection ? (
        <>
          <Text>{app.store?.name}에 연결되어 있습니다.</Text>
          <NavLink href="/menu">메뉴로 이어가기</NavLink>
          <NavLink href="/leave">다른 매장으로 변경</NavLink>
        </>
      ) : (
        !app.pendingSubmission && (
          <>
            <Card>
              <CardContent className="gap-4 pt-6">
                <Text variant="h2">매장에서 받은 코드 입력</Text>
                <Text>
                  코드를 찾기 어렵다면 직원에게 연결 코드나 링크를 요청해 주세요. QR을 직접 스캔할
                  필요는 없습니다.
                </Text>
                <Text>매장 기기 코드 (4자리)</Text>
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
                <Text>연결 코드 (8자리)</Text>
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
                  <Text>{loading ? '확인 중' : '연결할 매장 확인'}</Text>
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
            {!!error && <Problem message={error} />}
            {waiting && (
              <Text>
                다른 고객이 주문 중입니다. 자동으로 대기 등록되지는 않습니다. 잠시 후 다시
                연결하거나 직원에게 직접 주문해 주세요.
              </Text>
            )}
            {candidate && (
              <Card>
                <CardContent className="gap-3 pt-6">
                  <Text variant="h2">이 매장이 맞나요?</Text>
                  <Text>{candidate.store.name}</Text>
                  <Text>{candidate.store.address || '주소 확인 필요'}</Text>
                  <Text>{candidate.name}</Text>
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
