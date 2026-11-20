import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Problem } from '@/components/feedback';
import { useApp } from '@/providers/app-provider';
import { useTranslation } from '@/lib/i18n';
import { errorMessage } from '@/lib/api';
import { featureLabels } from '@/lib/place-search';
import type { AccessibilityRecords } from '@/lib/types';

export default function AccessibilityDetails() {
  const app = useApp();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ lat?: string; lng?: string; name?: string }>();
  const lat = Number(params.lat),
    lng = Number(params.lng);
  const valid =
    params.lat !== undefined &&
    params.lng !== undefined &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;
  const [data, setData] = useState<AccessibilityRecords | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    if (valid)
      void app.api
        .accessibilityNearby(lat, lng)
        .then((result) => {
          if (active) setData(result);
        })
        .catch((reason) => {
          if (active) setError(errorMessage(reason));
        });
    return () => {
      active = false;
    };
  }, [app.api, lat, lng, valid, revision]);
  return (
    <Screen
      title="주변 접근성 정보"
      subtitle={params.name}
      reading
      onTranscript={(text) => {
        if (/읽|안내|read/i.test(text) && data) {
          app.readAloud(
            data.groups
              .map(
                (group) =>
                  `${t(featureLabels[group.kind])}. ${t(group.status === 'outside-coverage' ? '자료 제공 지역 밖이에요.' : group.status === 'not-recorded' ? '주변에 등록된 자료가 없어요. 시설이 없다는 뜻은 아니에요.' : '등록된 시설 정보')}. ${group.items.map((item) => `${item.distanceM}m. ${item.detail ?? ''}`).join(' ')}. ${group.source.name}. ${group.source.date}`,
              )
              .join(' '),
          );
          return true;
        }
        return false;
      }}
    >
      <Text>
        선택한 장소 주변 300m의 기록이에요. 실제 작동 여부나 접근 가능한 경로를 보장하지 않아요.
      </Text>
      {!valid ? (
        <Text>장소의 좌표가 없어 주변 정보를 확인할 수 없어요.</Text>
      ) : error ? (
        <Problem message={error} retry={() => setRevision((value) => value + 1)} />
      ) : !data ? (
        <Text accessibilityLiveRegion="polite">접근성 자료를 불러오는 중이에요.</Text>
      ) : (
        data.groups.map((group) => (
          <Card key={group.kind}>
            <CardContent className="gap-3">
              <Text variant="h2">{featureLabels[group.kind]}</Text>
              {group.status !== 'records' ? (
                <Text>
                  {group.status === 'outside-coverage'
                    ? '자료 제공 지역 밖이에요.'
                    : '주변에 등록된 자료가 없어요. 시설이 없다는 뜻은 아니에요.'}
                </Text>
              ) : (
                group.items.map((item) => (
                  <View key={item.id} className="gap-1 border-b border-border pb-3">
                    <Text>{`${t('직선거리')} ${item.distanceM}m${item.coordinatePrecision === 'station' ? ` · ${t('역 기준 위치')}` : ''}`}</Text>
                    {!!item.detail && <Text translate={false}>{item.detail}</Text>}
                  </View>
                ))
              )}
              <Text
                variant="muted"
                translate={false}
              >{`${group.source.name} · ${group.source.date} · ${group.source.license}`}</Text>
              <Button
                variant="ghost"
                className="self-start"
                onPress={() => void Linking.openURL(group.source.url).catch(app.report)}
              >
                <Text>자료 출처</Text>
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </Screen>
  );
}
