import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { Mic, Volume2 } from 'lucide-react-native';
import { Icon } from './ui/icon';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { useApp } from '@/providers/app-provider';
import { voiceSelection } from '@/lib/voice';
type SpeechRecognition = typeof import('expo-speech-recognition');
type VoiceControlsProps = { onTranscript?: (text: string) => boolean };
// Expo Go has no ExpoSpeechRecognition native module and the package throws on import there,
// so only load it when the build (or the browser implementation on web) provides it.
const recognition: SpeechRecognition | null =
  Platform.OS === 'web' || requireOptionalNativeModule('ExpoSpeechRecognition')
    ? require('expo-speech-recognition')
    : null;
export function VoiceControls(props: VoiceControlsProps) {
  return recognition ? (
    <RecognitionVoiceControls {...props} recognition={recognition} />
  ) : (
    <TouchOnlyVoiceControls />
  );
}
function RecognitionVoiceControls({
  onTranscript,
  recognition: { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent },
}: VoiceControlsProps & { recognition: SpeechRecognition }) {
  const app = useApp();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    app.announce(`음성 인식: ${event.message || '마이크 권한과 지원 여부를 확인해 주세요.'}`);
  });
  useSpeechRecognitionEvent('result', (event) => {
    if (!event.isFinal) return;
    const text = event.results[0]?.transcript ?? '';
    setTranscript(text);
    if (onTranscript?.(text)) return;
    const selected = voiceSelection(text, app.store?.menu ?? []);
    if (selected.item) {
      router.push({
        pathname: '/menu/[itemId]',
        params: { itemId: selected.item.id, speech: text },
      });
    } else if (/연결.*(종료|해제|끊)/.test(text)) router.push('/leave');
    else if (/직원|도움|도와/.test(text)) router.push('/help');
    else if (/다시|반복/.test(text)) app.repeat();
    else if (/장바구니|주문|결제/.test(text)) router.push('/cart');
    else if (/고대비|글자|설정/.test(text)) router.push('/settings');
    else if (/길|실내|어디/.test(text)) router.push('/guide');
    else if (/연결/.test(text)) router.push('/connect');
    else if (/메뉴.*(읽|알려)/.test(text))
      app.announce(
        app.store?.menu
          ?.map((item) => `${item.name} ${item.price}원${item.available ? '' : ' 품절'}`)
          .join(', ') || '먼저 매장을 선택해 주세요.',
      );
    else if (/메뉴/.test(text)) router.push('/menu');
    else if (/뒤로|닫|취소/.test(text)) {
      if (router.canGoBack()) router.back();
    } else app.announce('메뉴 이름, 장바구니, 직원 호출, 다시 듣기라고 말해 주세요.');
  });
  useEffect(() => () => ExpoSpeechRecognitionModule.abort(), []);
  async function start() {
    await Speech.stop();
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        '음성 주문을 사용하려면 마이크와 음성 인식 권한이 필요합니다. 터치로도 주문할 수 있습니다.',
      );
    ExpoSpeechRecognitionModule.start({ lang: 'ko-KR', interimResults: false, continuous: false });
  }
  return (
    <View className="gap-4 rounded-2xl border border-border bg-card p-5">
      <View className="flex-row items-center gap-2">
        <Icon as={Mic} size={20} className="text-primary" accessible={false} />
        <Text className="font-bold">말로도 선택할 수 있어요</Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="secondary"
          onPress={() =>
            listening ? ExpoSpeechRecognitionModule.stop() : void start().catch(app.report)
          }
          accessibilityLabel={listening ? '음성 인식 중지' : '음성으로 주문하기'}
        >
          <Icon as={Mic} size={20} accessible={false} />
          <Text>{listening ? '듣고 있어요 · 중지' : '음성으로 주문하기'}</Text>
        </Button>
        <Button variant="outline" onPress={app.repeat}>
          <Icon as={Volume2} size={20} accessible={false} />
          <Text>다시 듣기</Text>
        </Button>
      </View>
      <Text variant="muted">
        {transcript
          ? `들은 말: ${transcript}`
          : '“아메리카노 아이스 두 잔”, “장바구니”, “직원 호출”'}
      </Text>
    </View>
  );
}
function TouchOnlyVoiceControls() {
  const app = useApp();
  return (
    <View className="gap-4 rounded-2xl border border-border bg-card p-5">
      <View className="flex-row flex-wrap gap-2">
        <Button variant="outline" onPress={app.repeat}>
          <Text>다시 듣기</Text>
        </Button>
      </View>
      <Text variant="muted">
        이 환경에서는 음성 주문을 사용할 수 없습니다. 터치로 주문해 주세요.
      </Text>
    </View>
  );
}
