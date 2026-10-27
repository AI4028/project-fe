import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import * as Speech from 'expo-speech';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { useApp } from '@/providers/app-provider';
import { voiceSelection } from '@/lib/voice';
export function VoiceControls({ onTranscript }: { onTranscript?: (text: string) => boolean }) {
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
    } else if (/연결.*(종료|해제|끊)/.test(text)) void app.disconnect().catch(app.report);
    else if (/직원|도움|도와/.test(text)) void app.help().catch(app.report);
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
    <View className="gap-2 border-t border-border pt-4">
      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="secondary"
          onPress={() =>
            listening ? ExpoSpeechRecognitionModule.stop() : void start().catch(app.report)
          }
          accessibilityLabel={listening ? '음성 인식 중지' : '음성으로 주문하기'}
        >
          <Text>{listening ? '듣고 있어요 · 중지' : '음성으로 주문하기'}</Text>
        </Button>
        <Button variant="outline" onPress={app.repeat}>
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
