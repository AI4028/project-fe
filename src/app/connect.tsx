import { useTranslation } from '@/lib/i18n';
import { venueAddress } from '@/lib/catalog';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import { androidKioskScanAvailable, scanAndroidAdvertisements } from '@/lib/android-kiosk-ble';
import {
  inspectKiosk,
  resolveKioskAdvertisements,
  scanDemoKiosks,
  type KioskCandidate,
  type ScannedKiosk,
} from '@/lib/kiosk-scan';

const scanMessages = {
  demo: {
    subtitle: '데모 기기를 검색하거나 매장 화면에 표시된 코드를 입력해 주세요.',
    start: '주변 데모 기기 검색',
    busy: '데모 기기 검색 중',
    results: '연결할 데모 기기를 선택해 주세요.',
    empty: '데모 기기를 찾지 못했어요. 다시 검색하거나 코드를 입력해 주세요.',
    expired: '연결 코드가 만료되었어요. 데모 기기를 다시 검색해 주세요.',
  },
  bluetooth: {
    subtitle: '주변 키오스크를 검색하거나 매장 화면에 표시된 코드를 입력해 주세요.',
    start: '주변 키오스크 검색',
    busy: '주변 키오스크 검색 중',
    results: '연결할 키오스크를 선택해 주세요.',
    empty: '주변 키오스크를 찾지 못했어요. 다시 검색하거나 코드를 입력해 주세요.',
    expired: '연결 코드가 만료되었어요. 주변 키오스크를 다시 검색해 주세요.',
  },
};

export default function Connect() {
  const app = useApp();
  const { language, t } = useTranslation();
  const params = useLocalSearchParams<{
    kioskId?: string;
    token?: string;
    storeId?: string;
    next?: string;
    from?: string;
    section?: string;
  }>();
  const [kioskId, setKioskId] = useState(params.kioskId ?? '');
  const [code, setCode] = useState(params.token ?? '');
  const [candidate, setCandidate] = useState<KioskCandidate | ScannedKiosk | null>(null);
  const [scanResults, setScanResults] = useState<ScannedKiosk[] | null>(null);
  const [action, setAction] = useState<'scan' | 'inspect' | 'connect' | null>(null);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);
  const activeScan = useRef<AbortController | null>(null);
  const scanMode = app.demo ? 'demo' : androidKioskScanAvailable ? 'bluetooth' : null;
  const scanCopy = scanMessages[scanMode === 'demo' ? 'demo' : 'bluetooth'];
  const loading = action !== null;
  const mismatch = candidate && params.storeId && candidate.store.storeId !== params.storeId;

  useFocusEffect(useCallback(() => () => activeScan.current?.abort(), []));

  async function inspect() {
    setAction('inspect');
    setError('');
    setWaiting(false);
    setCandidate(null);
    try {
      setCandidate(await inspectKiosk(app.api, kioskId.trim().toUpperCase()));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setAction(null);
    }
  }

  async function scan() {
    if (!scanMode || activeScan.current) return;
    const controller = new AbortController();
    activeScan.current = controller;
    const { signal } = controller;
    setAction('scan');
    setScanResults(null);
    setError('');
    setWaiting(false);
    try {
      if (scanMode === 'demo') {
        const results = await scanDemoKiosks(app.api, params.storeId);
        if (!signal.aborted) setScanResults(results);
      } else {
        const advertisements = await scanAndroidAdvertisements(signal);
        if (signal.aborted || advertisements === null) return;
        const results = await resolveKioskAdvertisements(app.api, advertisements, params.storeId);
        if (!signal.aborted) setScanResults(results);
      }
    } catch (reason) {
      if (!signal.aborted) setError(errorMessage(reason));
    } finally {
      activeScan.current = null;
      setAction(null);
    }
  }

  function scanExpired() {
    setCandidate(null);
    setScanResults(null);
    setWaiting(false);
    setError(scanCopy.expired);
  }

  async function connect() {
    if (!candidate || mismatch) return;
    const scanned = 'token' in candidate ? candidate : null;
    if (scanned?.expiresAtMs !== undefined && scanned.expiresAtMs <= Date.now()) {
      scanExpired();
      return;
    }
    setAction('connect');
    setError('');
    setWaiting(false);
    try {
      await app.connect(candidate.kioskId, scanned?.token ?? code, candidate.store.storeId);
      router.replace(
        params.next === 'help'
          ? {
              pathname: '/help',
              params: {
                storeId: candidate.store.storeId,
                from: params.from,
                section: params.section,
              },
            }
          : '/menu',
      );
    } catch (reason) {
      if (scanned && reason instanceof ApiError && reason.code === 'token-invalid') {
        scanExpired();
        return;
      }
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
      setAction(null);
    }
  }
  return (
    <Screen
      title={candidate ? '이 매장이 맞나요?' : '내 휴대폰으로 주문하기'}
      subtitle={
        candidate
          ? '이름과 주소를 확인한 뒤 연결해 주세요.'
          : scanMode
            ? scanCopy.subtitle
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
            {!!error && <Problem message={error} />}
            {!candidate && (
              <View className="gap-4">
                {scanMode && (
                  <Card className="rounded-3xl">
                    <CardContent className="gap-3 pt-6">
                      <Button
                        variant="secondary"
                        disabled={loading || app.busy}
                        accessibilityState={{
                          busy: action === 'scan',
                          disabled: loading || app.busy,
                        }}
                        onPress={() => void scan()}
                      >
                        <Text>{action === 'scan' ? scanCopy.busy : scanCopy.start}</Text>
                      </Button>
                      {scanResults && (
                        <>
                          <Text accessibilityLiveRegion="polite">
                            {scanResults.length ? scanCopy.results : scanCopy.empty}
                          </Text>
                          {scanResults.map((result) => {
                            const address =
                              venueAddress(result.store, language) || t('주소 확인 필요');
                            return (
                              <Button
                                key={result.kioskId}
                                variant="outline"
                                className="h-auto min-h-12 flex-col items-start py-3"
                                accessibilityLabel={`${result.store.name}, ${result.name}, ${result.kioskId}, ${address}`}
                                disabled={loading || app.busy}
                                onPress={() => {
                                  setError('');
                                  setWaiting(false);
                                  setCandidate(result);
                                }}
                              >
                                <Text translate={false} className="text-left">
                                  {result.store.name}
                                </Text>
                                <Text className="text-left font-normal">
                                  {`${result.name} · ${result.kioskId}`}
                                </Text>
                                <Text className="text-left font-normal">{address}</Text>
                              </Button>
                            );
                          })}
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
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
                      <Text>{action === 'inspect' ? '확인 중' : '연결할 매장 확인하기'}</Text>
                    </Button>
                  </CardContent>
                </Card>
                <Text variant="muted">
                  코드를 찾기 어렵다면 직원에게 요청하세요. 다음 화면에서 매장을 확인하고 연결할 수
                  있어요.
                </Text>
              </View>
            )}
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
                    <Text>{venueAddress(candidate.store, language) || '주소 확인 필요'}</Text>
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
                      if (!('token' in candidate)) setCode('');
                      setWaiting(false);
                      setError('');
                    }}
                  >
                    <Text>
                      {'token' in candidate
                        ? '기기 목록과 코드 입력으로 돌아가기'
                        : '다른 코드 입력'}
                    </Text>
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )
      )}
      <NavLink
        href={{
          pathname: '/help',
          params: { storeId: params.storeId, from: params.from, section: params.section },
        }}
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
