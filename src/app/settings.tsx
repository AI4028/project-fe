import { useState } from 'react';
import { Linking } from 'react-native';
import * as Location from 'expo-location';
import { Screen } from '@/components/screen';
import { LanguageSwitch } from '@/components/language-switch';
import { PreferenceSwitch } from '@/components/preference-switch';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useApp } from '@/providers/app-provider';
import { resolveExploreMode, type ExploreMode } from '@/lib/location';
import { resolveTextSize } from '@/lib/text-size';
import { useTranslation } from '@/lib/i18n';

export default function Settings() {
  const app = useApp();
  const { settings } = app;
  const { t } = useTranslation();
  const [permissions, setPermissions] = useState(false);
  const [location, setLocation] = useState('');
  const [confirm, setConfirm] = useState(false);
  const registrationUrl = process.env.EXPO_PUBLIC_STORE_REGISTRATION_URL;
  const save = (patch: Parameters<typeof app.updateSettings>[0]) =>
    app.updateSettings(patch).catch(app.report);
  const checkLocation = async (request: boolean) => {
    try {
      const result = request
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      setLocation(result.granted ? '위치 · 허용됨' : '위치 · 허용 안 됨');
    } catch {
      setLocation('위치를 확인하지 못했어요');
    }
  };
  if (permissions)
    return (
      <Screen
        onBack={() => setPermissions(false)}
        title="기기 권한"
        subtitle="필요한 기능을 사용할 때만 권한을 요청해요."
        voice={false}
      >
        <Card>
          <CardContent>
            <Text variant="h3">{location || '위치'}</Text>
            <Button onPress={() => void checkLocation(true)}>
              <Text>위치 권한 다시 확인</Text>
            </Button>
          </CardContent>
        </Card>
        <Text>마이크 · 음성 검색을 시작할 때 요청해요.</Text>
        <Text>Bluetooth · 매장 검색과 주문에는 필요하지 않아요.</Text>
      </Screen>
    );
  return (
    <Screen
      title="이용 설정"
      subtitle="변경 내용은 이 기기에 저장돼요."
      voice={false}
      reading
      brandedHeader
    >
      <Card>
        <CardContent className="gap-3">
          <LanguageSwitch />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="gap-3">
          <Text variant="h2">접근성</Text>
          <PreferenceSwitch
            title="고대비"
            description="글자와 버튼 경계를 선명하게"
            value={settings.contrast}
            onChange={(contrast) => void save({ contrast })}
          />
          <PreferenceSwitch
            title="큰 글씨"
            description="기본 글자의 2배로 확대"
            value={resolveTextSize(settings) === 'xlarge'}
            onChange={(largeText) =>
              void save({ largeText, textSize: largeText ? 'xlarge' : 'base' })
            }
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="gap-3">
          <Text variant="h2">위치와 지도</Text>
          <PreferenceSwitch
            title="시작 시 현재 위치 감지"
            description="GPS로 가까운 매장을 찾아요."
            value={!!settings.locateOnStart}
            onChange={(locateOnStart) => void save({ locateOnStart })}
          />
          <Button
            variant="outline"
            onPress={() => {
              setPermissions(true);
              void checkLocation(false);
            }}
          >
            <Text>기기 권한 확인</Text>
          </Button>
          <Text>시작 화면 지도 방식</Text>
          <SegmentedControl<ExploreMode>
            mapChoice
            value={resolveExploreMode(settings.assistance, settings.exploreMode) ?? 'list'}
            onChange={(exploreMode) => void save({ exploreMode })}
            label={t('지도 방식')}
            options={[
              { value: 'list', label: '글 지도' },
              { value: 'map', label: '그림 지도' },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="gap-3">
          <Text variant="h2">기기 설정</Text>
          <PreferenceSwitch
            title="음성 명령"
            description="말로 매장과 메뉴 검색"
            value={!!settings.voiceInput}
            onChange={(voiceInput) => void save({ voiceInput })}
          />
          <PreferenceSwitch
            title="주문 상태 알림"
            description="앱을 사용하는 동안 주문 상태가 바뀌면 알려요."
            value={settings.orderAlerts !== false}
            onChange={(orderAlerts) => void save({ orderAlerts })}
          />
          <PreferenceSwitch
            title="음성 안내"
            description="화면 안내를 소리로 읽어요."
            value={settings.speech}
            onChange={(speech) => void save({ speech })}
          />
          <PreferenceSwitch
            title="주문 진동"
            description="장바구니가 변경되면 진동으로 알려요."
            value={settings.vibration !== false}
            onChange={(vibration) => void save({ vibration })}
          />
          <PreferenceSwitch
            title="최근 검색어 저장"
            description="이 기기에 검색어를 저장해요."
            value={settings.saveRecentSearches !== false}
            onChange={(saveRecentSearches) => void save({ saveRecentSearches })}
          />
          <Button variant="outline" onPress={() => setConfirm(true)}>
            <Text>최근 검색어 지우기</Text>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="gap-3">
          <Text variant="h2">매장 등록</Text>
          <Button
            variant="outline"
            disabled={!registrationUrl?.startsWith('https://')}
            onPress={() => {
              if (registrationUrl) void Linking.openURL(registrationUrl).catch(app.report);
            }}
          >
            <Text>매장 등록 신청</Text>
          </Button>
          {!registrationUrl?.startsWith('https://') && (
            <Text variant="muted">매장 등록 링크가 준비되면 신청할 수 있어요.</Text>
          )}
        </CardContent>
      </Card>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>최근 검색어를 지울까요?</DialogTitle>
          <DialogDescription>북마크와 주문내역은 유지돼요.</DialogDescription>
          <Button
            variant="destructive"
            onPress={() =>
              void app
                .updateSettings({ recentSearches: [] })
                .then(() => setConfirm(false))
                .catch(app.report)
            }
          >
            <Text>검색어 지우기</Text>
          </Button>
          <Button variant="outline" onPress={() => setConfirm(false)}>
            <Text>취소</Text>
          </Button>
        </DialogContent>
      </Dialog>
    </Screen>
  );
}
