import { useState } from 'react';
import { View } from 'react-native';
import { Screen, NavLink } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApp } from '@/providers/app-provider';
export default function Settings() {
  const app = useApp();
  const [base, setBase] = useState(app.settings.apiBase);
  return (
    <Screen title="접근성 · 설정" voice={false}>
      {(['contrast', 'largeText', 'speech', 'voiceInput'] as const).map((key) => (
        <View key={key} className="gap-2">
          <Button
            variant={app.settings[key] ? 'default' : 'outline'}
            accessibilityRole="switch"
            accessibilityState={{ checked: !!app.settings[key] }}
            onPress={() =>
              void app
                .saveSettings({ ...app.settings, [key]: !app.settings[key] })
                .catch(app.report)
            }
          >
            <Text>
              {
                {
                  contrast: '고대비 화면',
                  largeText: '큰 글자',
                  speech: '추가 음성 안내',
                  voiceInput: '음성 명령 사용',
                }[key]
              }{' '}
              · {app.settings[key] ? '켜짐' : '꺼짐'}
            </Text>
          </Button>
        </View>
      ))}
      <Text>휴대폰의 글자 크기와 화면 읽기 설정도 지원합니다.</Text>
      <Text variant="h3">서버 주소</Text>
      <Text variant="muted">휴대폰에서는 컴퓨터의 LAN IP 또는 HTTPS 주소를 사용해 주세요.</Text>
      <Input
        value={base}
        onChangeText={setBase}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        accessibilityLabel="백엔드 서버 주소"
      />
      <Button
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
      <Text variant="muted">
        추가 음성 안내는 스크린 리더가 켜져 있으면 재생하지 않습니다. 음성 명령을 켜도 마이크 권한은
        음성 입력을 시작할 때만 요청합니다.
      </Text>
      {app.connection && <NavLink href="/leave">주문 중단 · 매장 연결 종료</NavLink>}
    </Screen>
  );
}
