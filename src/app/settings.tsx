import { Children, useState, type ReactNode } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import {
  Accessibility,
  Bell,
  MapPin,
  Search,
  Languages,
  Store,
  Newspaper,
  type LucideIcon,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
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

function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-4">
        <View className="flex-row items-center gap-3 py-4">
          <Icon as={icon} size={24} className="text-primary" />
          <Text variant="h2">{title}</Text>
        </View>
        {Children.toArray(children).map((row, index) => (
          <View key={index} className="border-t border-border py-1">
            {row}
          </View>
        ))}
      </CardContent>
    </Card>
  );
}

function publicForm(value?: string) {
  try {
    const url = new URL(value ?? '');
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {}
}

export default function Settings() {
  const app = useApp();
  const { settings } = app;
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  const registrationUrl = publicForm(process.env.EXPO_PUBLIC_STORE_REGISTRATION_URL);
  const newsUrl = publicForm(process.env.EXPO_PUBLIC_ACCESSIBILITY_NEWS_URL);
  const save = (patch: Parameters<typeof app.updateSettings>[0]) =>
    app.updateSettings(patch).catch(app.report);
  return (
    <Screen
      title="이용 설정"
      subtitle="변경 내용은 이 기기에 저장돼요."
      voice={false}
      reading
      brandedHeader
    >
      <SettingsSection title="언어 선택" icon={Languages}>
        <LanguageSwitch showHeading={false} />
      </SettingsSection>
      <SettingsSection title="접근성" icon={Accessibility}>
        <PreferenceSwitch
          flat
          title="고대비"
          description="글자와 버튼 경계를 선명하게"
          value={settings.contrast}
          onChange={(contrast) => void save({ contrast })}
        />
        <PreferenceSwitch
          flat
          title="큰 글씨"
          description="기본 글자의 2배로 확대"
          value={resolveTextSize(settings) !== 'base'}
          onChange={(largeText) =>
            void save({ largeText, textSize: largeText ? 'xlarge' : 'base' })
          }
        />
        <PreferenceSwitch
          flat
          title="음성 명령"
          description="말로 메뉴를 선택하거나 장바구니를 열어요."
          value={!!settings.voiceInput}
          onChange={(voiceInput) => void save({ voiceInput })}
        />
        <PreferenceSwitch
          flat
          title="음성 안내"
          description="앱의 안내와 상태 변경을 소리로 들어요."
          value={settings.speech}
          onChange={(speech) => void save({ speech })}
        />
      </SettingsSection>
      <SettingsSection title="위치와 지도" icon={MapPin}>
        <PreferenceSwitch
          flat
          title="시작 시 현재 위치 감지"
          description="앱을 열 때 가까운 매장을 찾아요. 위치 없이도 검색할 수 있어요."
          value={!!settings.locateOnStart}
          onChange={(locateOnStart) => void save({ locateOnStart })}
        />
        <View className="gap-2 py-2">
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
        </View>
        <Button variant="ghost" onPress={() => router.push('/settings/permissions')}>
          <Text>기기 권한 확인</Text>
        </Button>
      </SettingsSection>
      <SettingsSection title="주문 알림" icon={Bell}>
        <PreferenceSwitch
          flat
          title="주문 진행 알림"
          description="앱을 이용하는 동안 주문 접수, 준비, 픽업 등 상태 변경을 알려요."
          value={settings.orderAlerts !== false}
          onChange={(orderAlerts) => void save({ orderAlerts })}
        />
        <PreferenceSwitch
          flat
          title="픽업 준비 진동"
          description="주문을 받을 준비가 되면 지원 기기에서 진동해요."
          value={settings.vibration !== false}
          onChange={(vibration) => void save({ vibration })}
        />
      </SettingsSection>
      <SettingsSection title="검색 기록" icon={Search}>
        <PreferenceSwitch
          flat
          title="최근 검색어 저장"
          description="이 기기에 검색어를 저장해요."
          value={settings.saveRecentSearches !== false}
          onChange={(saveRecentSearches) => void save({ saveRecentSearches })}
        />
        <Button variant="ghost" onPress={() => setConfirm(true)}>
          <Text>최근 검색어 지우기</Text>
        </Button>
      </SettingsSection>
      {newsUrl && (
        <SettingsSection title="접근성 소식과 혜택" icon={Newspaper}>
          <Button variant="outline" onPress={() => void Linking.openURL(newsUrl).catch(app.report)}>
            <Text>소식과 혜택 신청하기</Text>
          </Button>
        </SettingsSection>
      )}
      {registrationUrl && (
        <SettingsSection title="매장 등록" icon={Store}>
          <Button
            variant="outline"
            onPress={() => void Linking.openURL(registrationUrl).catch(app.report)}
          >
            <Text>매장 등록 신청</Text>
          </Button>
        </SettingsSection>
      )}
      <Text variant="muted">
        VoiceOver와 TalkBack은 기기 설정을 따릅니다. 진동과 권한은 기기와 브라우저에 따라 달라요.
      </Text>
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
