import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as Speech from 'expo-speech';
import { AudioLines, Mic, MicOff } from 'lucide-react-native';
import { recognition, type SpeechRecognition } from '@/lib/speech-recognition';
import { useTranslation } from '@/lib/i18n';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Input } from './ui/input';
import { Text } from './ui/text';

type Props = {
  query: string;
  onEdit: (query: string) => void;
  onSearch: (query: string) => void;
  onClose: () => void;
};
type Stage = 'idle' | 'starting' | 'listening' | 'review' | 'denied' | 'failed' | 'unavailable';

export function VoiceSearch(props: Props) {
  return recognition ? (
    <RecognitionSearch {...props} recognition={recognition} />
  ) : (
    <VoiceSearchView {...props} value={props.query} stage="unavailable" />
  );
}

function RecognitionSearch({
  recognition: { ExpoSpeechRecognitionModule: module, useSpeechRecognitionEvent },
  ...props
}: Props & { recognition: SpeechRecognition }) {
  const { language } = useTranslation();
  const [stage, setStage] = useState<Stage>('idle');
  const [value, setValue] = useState(props.query);
  const operation = useRef(0);
  const receiving = useRef(false);

  useSpeechRecognitionEvent('start', () => {
    if (receiving.current) setStage('listening');
  });
  useSpeechRecognitionEvent('result', (result) => {
    const text = result.results[0]?.transcript.trim();
    if (!receiving.current || !result.isFinal || !text) return;
    receiving.current = false;
    setValue(text);
    setStage('review');
  });
  useSpeechRecognitionEvent('end', () => {
    if (!receiving.current) return;
    receiving.current = false;
    setStage('failed');
  });
  useSpeechRecognitionEvent('error', (event) => {
    if (!receiving.current) return;
    receiving.current = false;
    setStage(
      event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'denied' : 'failed',
    );
  });

  useEffect(
    () => () => {
      operation.current++;
      if (receiving.current) {
        receiving.current = false;
        module.abort();
      }
    },
    [module],
  );

  async function start() {
    const id = ++operation.current;
    setStage('starting');
    try {
      if (!module.isRecognitionAvailable()) {
        setStage('unavailable');
        return;
      }
      await Speech.stop();
      if (id !== operation.current) return;
      const permission = await module.requestPermissionsAsync();
      if (id !== operation.current) return;
      if (!permission.granted) {
        setStage('denied');
        return;
      }
      receiving.current = true;
      module.start({
        lang: language === 'en' ? 'en-US' : 'ko-KR',
        interimResults: false,
        continuous: false,
      });
    } catch {
      if (id === operation.current) {
        receiving.current = false;
        setStage('failed');
      }
    }
  }

  return (
    <VoiceSearchView
      {...props}
      stage={stage}
      value={value}
      onChange={setValue}
      start={() => void start()}
      stop={() => module.stop()}
      cancel={() => {
        receiving.current = false;
        module.abort();
        setStage('idle');
      }}
    />
  );
}

const messages: Record<Stage, { title: string; message: string }> = {
  idle: {
    title: '말로 검색해 볼까요?',
    message: '마이크를 켠 뒤 매장 이름이나 메뉴를 말해 주세요.',
  },
  starting: { title: '마이크 확인 중', message: '음성 인식 권한을 확인하고 있어요.' },
  listening: { title: '듣고 있어요', message: '매장 이름이나 메뉴를 말해 주세요.' },
  review: { title: '이렇게 들었어요', message: '틀린 부분은 글자로 고친 뒤 검색해 주세요.' },
  denied: {
    title: '마이크 권한이 꺼져 있어요',
    message: '기기에서 권한을 확인하거나 직접 입력해 주세요.',
  },
  failed: { title: '말을 알아듣지 못했어요', message: '다시 말하거나 글자로 검색해 주세요.' },
  unavailable: {
    title: '마이크를 사용할 수 없어요',
    message: '이 환경에서는 글자로 검색할 수 있어요.',
  },
};

function VoiceSearchView({
  stage,
  value,
  onChange,
  start,
  stop,
  cancel,
  onEdit,
  onSearch,
  onClose,
}: Props & {
  stage: Stage;
  value: string;
  onChange?: (value: string) => void;
  start?: () => void;
  stop?: () => void;
  cancel?: () => void;
}) {
  const { t } = useTranslation();
  const { title, message } = messages[stage];
  const listening = stage === 'listening';
  const active = listening || stage === 'starting';
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="mx-auto w-full max-w-lg gap-4 px-5 py-8"
      keyboardShouldPersistTaps="handled"
    >
      <View className="items-center gap-4 rounded-3xl border border-border bg-card p-6">
        <View
          className={`h-24 w-24 items-center justify-center rounded-full ${listening ? 'bg-primary' : 'bg-secondary'}`}
        >
          <Icon
            as={listening ? AudioLines : stage === 'review' ? Mic : MicOff}
            size={44}
            className={listening ? 'text-primary-foreground' : 'text-primary'}
            accessible={false}
          />
        </View>
        <Text variant="h2" className="text-center" accessibilityLiveRegion="polite">
          {title}
        </Text>
        <Text variant="muted" className="text-center">
          {message}
        </Text>
      </View>
      {stage === 'review' && (
        <>
          <Input
            value={value}
            onChangeText={onChange}
            returnKeyType="search"
            accessibilityLabel={t('들은 검색어 수정')}
          />
          <Button disabled={!value.trim()} onPress={() => onSearch(value)}>
            <Text>이 문구로 검색</Text>
          </Button>
        </>
      )}
      {active ? (
        <Button disabled={!listening} onPress={stop}>
          <Text>말하기 마치기</Text>
        </Button>
      ) : start && stage !== 'unavailable' ? (
        <Button variant={stage === 'review' ? 'outline' : 'default'} onPress={start}>
          <Icon as={Mic} size={20} accessible={false} />
          <Text>
            {stage === 'idle'
              ? '마이크 켜고 말하기'
              : stage === 'denied'
                ? '다시 확인'
                : '다시 말하기'}
          </Text>
        </Button>
      ) : null}
      {listening ? (
        <Button variant="outline" onPress={cancel}>
          <Text>녹음 취소</Text>
        </Button>
      ) : (
        <Button variant="outline" onPress={() => onEdit(value)}>
          <Text>글자로 입력하기</Text>
        </Button>
      )}
      <Button variant="ghost" onPress={onClose}>
        <Text>닫기</Text>
      </Button>
    </ScrollView>
  );
}
