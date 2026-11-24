import { useState } from 'react';
import { View } from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Building2,
  DoorStairwell,
  type LucideIcon,
} from 'lucide-react-native';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Icon } from './ui/icon';
import { Text } from './ui/text';
import { useTranslation } from '@/lib/i18n';
import { accessSourceNote, entranceStatus, facilityDetails, isKnown } from '@/lib/location';
import type { Store } from '@/lib/types';

function AccessCard({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Card className="rounded-2xl py-0">
      <CardContent className="flex-row items-center gap-3 px-4 py-4">
        <Icon as={icon} size={24} className="text-primary" accessible={false} />
        <View className="min-w-0 flex-1 gap-1">
          <Text translate={false} className="font-bold">
            {title}
          </Text>
          <Text variant="muted">{description}</Text>
        </View>
      </CardContent>
    </Card>
  );
}

export function StoreAccessibility({ store }: { store: Store }) {
  const { t, language } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { floor, elevator, staffAssistance, stepFreeEntrance, notes } = store.accessibility;
  const floorLabel = floor == null ? t('확인 필요') : t(`${floor}층`);
  return (
    <View className="gap-3">
      <Text variant="h3">접근성 정보</Text>
      <AccessCard
        icon={Building2}
        title={`${t('층수')} · ${floorLabel}`}
        description={
          elevator == null
            ? t('엘리베이터 이용 여부는 매장에 확인해 주세요.')
            : elevator
              ? t('엘리베이터가 있어요.')
              : t('엘리베이터가 없어요.')
        }
      />
      <AccessCard
        icon={DoorStairwell}
        title={`${t('입구 단차')} · ${t(entranceStatus(store))}`}
        description={
          stepFreeEntrance == null
            ? t('방문 전에 매장에 문의해 주세요.')
            : stepFreeEntrance
              ? t('입구에 단차 없이 들어갈 수 있어요.')
              : t('입구를 이용할 때 단차에 유의해 주세요.')
        }
      />
      <AccessCard
        icon={CircleHelp}
        title={`${t('직원 도움')} · ${t(staffAssistance == null ? '확인 필요' : staffAssistance ? '문의 가능' : '지원 불가')}`}
        description={
          staffAssistance == null
            ? t('필요한 도움을 받을 수 있는지 방문 전에 확인해 주세요.')
            : staffAssistance
              ? t('필요한 도움을 직원에게 요청할 수 있어요.')
              : t('직원 도움이 제공되지 않는 매장이에요.')
        }
      />
      <Text variant="muted">{t(accessSourceNote(store))}</Text>
      <Button
        variant="ghost"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
      >
        <Text>추가 시설 정보</Text>
        <Icon as={expanded ? ChevronUp : ChevronDown} size={18} accessible={false} />
      </Button>
      {expanded && (
        <View className="gap-2 px-4">
          {facilityDetails(store, t).map((detail) => (
            <Text key={detail} translate={false}>
              {detail}
            </Text>
          ))}
          {isKnown(notes) && <Text translate={false}>{notes}</Text>}
        </View>
      )}
    </View>
  );
}
