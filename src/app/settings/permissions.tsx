import { useCallback, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { recognition } from '@/lib/speech-recognition';
import { useApp } from '@/providers/app-provider';

const permissionLabels = {
  granted: '허용됨',
  denied: '허용 안 됨',
  undetermined: '아직 선택하지 않았어요',
  unavailable: '이 환경에서 사용할 수 없어요',
  unknown: '상태를 확인할 수 없어요',
  checking: '확인 중',
} as const;
type Access = keyof typeof permissionLabels;

async function microphoneAccess(): Promise<Access> {
  const module = recognition?.ExpoSpeechRecognitionModule;
  if (!module?.isRecognitionAvailable()) return 'unavailable';
  if (Platform.OS === 'web') {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return result.state === 'prompt' ? 'undetermined' : result.state;
  }
  return (await module.getPermissionsAsync()).status;
}

export default function Permissions() {
  const app = useApp();
  const [location, setLocation] = useState<Access>('checking');
  const [microphone, setMicrophone] = useState<Access>('checking');
  const revision = useRef(0);
  const check = useCallback(() => {
    const id = ++revision.current;
    setLocation('checking');
    setMicrophone('checking');
    void Location.getForegroundPermissionsAsync()
      .then((result) => {
        if (id === revision.current) setLocation(result.status);
      })
      .catch(() => {
        if (id === revision.current) setLocation('unknown');
      });
    void microphoneAccess()
      .then((result) => {
        if (id === revision.current) setMicrophone(result);
      })
      .catch(() => {
        if (id === revision.current) setMicrophone('unknown');
      });
  }, []);
  useFocusEffect(
    useCallback(() => {
      check();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') check();
      });
      return () => {
        revision.current++;
        subscription.remove();
      };
    }, [check]),
  );
  const back = () => router.dismissTo('/settings');
  return (
    <Screen
      title="기기 권한"
      subtitle="필요한 기능을 사용할 때만 권한을 요청해요."
      onBack={back}
      voice={false}
      reading
    >
      <Card>
        <CardContent className="gap-2">
          <Text variant="h2">위치</Text>
          <Text accessibilityLiveRegion="polite">{permissionLabels[location]}</Text>
          <Text>
            위치를 허용하면 가까운 매장을 찾아요. 허용하지 않아도 매장이나 메뉴를 검색할 수 있어요.
          </Text>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="gap-2">
          <Text variant="h2">마이크와 음성 인식</Text>
          <Text accessibilityLiveRegion="polite">{permissionLabels[microphone]}</Text>
          <Text>
            말로 검색하거나 주문할 때 권한을 요청해요. 글자 검색과 터치 주문도 이용할 수 있어요.
          </Text>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="gap-2">
          <Text variant="h2">Bluetooth</Text>
          <Text>
            현재는 매장에 등록된 실내 안내를 제공해요. 실시간 비콘 안내는 제공하지 않으며, 검색과
            주문에 Bluetooth 권한은 필요하지 않아요.
          </Text>
        </CardContent>
      </Card>
      <Text>
        {Platform.OS === 'web'
          ? '브라우저의 사이트 설정에서 이 사이트의 위치와 마이크 권한을 변경한 뒤 다시 확인해 주세요.'
          : '기기 설정에서 갈지도의 위치, 마이크 및 음성 인식 권한을 변경한 뒤 돌아오세요.'}
      </Text>
      {Platform.OS !== 'web' && (
        <Button variant="outline" onPress={() => void Linking.openSettings().catch(app.report)}>
          <Text>기기 설정 열기</Text>
        </Button>
      )}
      <Button variant="outline" onPress={check}>
        <Text>권한 다시 확인</Text>
      </Button>
      <Button variant="ghost" onPress={back}>
        <Text>이용 설정으로 돌아가기</Text>
      </Button>
    </Screen>
  );
}
