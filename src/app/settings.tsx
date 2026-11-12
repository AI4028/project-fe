import { useState } from 'react';
import { View } from 'react-native';
import {
  Contrast,
  Type,
  Volume2,
  Mic,
  Check,
  ChevronDown,
  ChevronUp,
  Settings2,
  Server,
} from 'lucide-react-native';
import { Screen, NavLink } from '@/components/screen';
import { IconTile, SectionHeading } from '@/components/brand';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent } from '@/components/ui/card';
import { useApp } from '@/providers/app-provider';

const preferences = [
  {
    key: 'contrast',
    icon: Contrast,
    title: '고대비 화면',
    description: '검은 배경과 밝은 글자, 선명한 테두리로 구분해요.',
  },
  {
    key: 'largeText',
    icon: Type,
    title: '큰 글자',
    description: '화면의 글자와 입력 내용을 더 크게 보여 드려요.',
  },
  {
    key: 'speech',
    icon: Volume2,
    title: '추가 음성 안내',
    description: '선택한 내용과 진행 상태를 소리로 안내해요.',
  },
  {
    key: 'voiceInput',
    icon: Mic,
    title: '음성 명령',
    description: '메뉴 이름이나 원하는 동작을 말해서 선택해요.',
  },
] as const;

export default function Settings() {
  const app = useApp();
  const [base, setBase] = useState(app.settings.apiBase);
  const [showServer, setShowServer] = useState(false);
  return (
    <Screen
      title="나에게 편한 이용 설정"
      subtitle="필요한 기능만 골라 켜 주세요. 언제든 다시 바꿀 수 있어요."
      voice={false}
    >
      <View className="flex-row flex-wrap gap-6">
        <View className="min-w-0 flex-1 gap-4" style={{ flexBasis: 500 }}>
          <SectionHeading title="화면과 음성" detail="설정은 이 기기에 저장돼요." />
          {preferences.map(({ key, icon, title, description }) => (
            <Button
              key={key}
              variant="ghost"
              className="flex-col items-stretch gap-4 rounded-2xl border border-border bg-card p-5"
              accessibilityRole="switch"
              accessibilityLabel={title}
              accessibilityHint={description}
              accessibilityState={{ checked: !!app.settings[key] }}
              disabled={app.busy}
              onPress={() =>
                void app
                  .saveSettings({ ...app.settings, [key]: !app.settings[key] })
                  .catch(app.report)
              }
            >
              <View className="flex-row items-center gap-3">
                <IconTile icon={icon} small />
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-left font-bold">{title}</Text>
                </View>
                <View
                  className={
                    app.settings[key]
                      ? 'flex-row items-center gap-1 rounded-full border border-primary bg-secondary px-3 py-2'
                      : 'rounded-full border border-input px-3 py-2'
                  }
                >
                  {app.settings[key] && (
                    <Icon as={Check} size={16} className="text-primary" accessible={false} />
                  )}
                  <Text variant="small" className="font-bold">
                    {app.settings[key] ? '켜짐' : '꺼짐'}
                  </Text>
                </View>
              </View>
              <Text variant="muted" className="text-left text-sm font-normal text-muted-foreground">
                {description}
              </Text>
            </Button>
          ))}
        </View>
        <Card className="flex-1 self-start" style={{ flexBasis: 280 }}>
          <CardContent className="gap-4">
            <IconTile icon={Settings2} />
            <Text variant="h3">지금, 편하게 보이시나요?</Text>
            <Text className="leading-7">
              변경한 설정이 이 화면에도 바로 적용돼요. 휴대폰의 글자 크기와 화면 읽기 설정도 함께
              사용할 수 있어요.
            </Text>
            <View className="gap-3 border-t border-border pt-4">
              <Text variant="muted">화면 읽기가 켜져 있으면 추가 음성 안내는 재생하지 않아요.</Text>
              <Text variant="muted">
                마이크 권한은 음성 입력을 시작할 때 요청해요. 음성을 사용할 수 없어도 터치로 주문할
                수 있어요.
              </Text>
            </View>
          </CardContent>
        </Card>
      </View>
      <Card>
        <CardContent className="gap-4">
          <Button
            variant="ghost"
            className="justify-between px-0"
            onPress={() => setShowServer(!showServer)}
            accessibilityState={{ expanded: showServer }}
          >
            <View className="flex-row items-center gap-3">
              <Icon as={Server} size={20} accessible={false} />
              <Text className="font-bold">서버 연결 설정</Text>
            </View>
            <Icon as={showServer ? ChevronUp : ChevronDown} size={20} accessible={false} />
          </Button>
          {showServer && (
            <>
              <Text variant="muted">
                휴대폰과 매장 기기는 같은 서버에 연결해야 해요. 휴대폰에서는 컴퓨터의 LAN IP 또는
                HTTPS 주소를 입력해 주세요.
              </Text>
              <Text className="font-bold">서버 주소</Text>
              <Input
                value={base}
                onChangeText={setBase}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel="백엔드 서버 주소"
              />
              <Button
                className="self-start"
                disabled={app.busy}
                onPress={() =>
                  void app
                    .saveSettings({ ...app.settings, apiBase: base })
                    .then(() => app.announce('설정을 저장했습니다.'))
                    .catch(app.report)
                }
              >
                <Text>서버 주소 저장</Text>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      {app.connection && (
        <NavLink href="/leave" className="self-start">
          주문 중단 · 매장 연결 종료
        </NavLink>
      )}
    </Screen>
  );
}
