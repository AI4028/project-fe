import { useEffect, useState } from 'react';
import { dailyOpen } from '@/lib/catalog';
import { useTranslation } from '@/lib/i18n';
import type { Store } from '@/lib/types';
import { Text } from './ui/text';

export function VenueHours({ store }: { store: Store }) {
  const { t, language } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  const open = dailyOpen(store.hours, now);
  const known = open !== null;
  useEffect(() => {
    if (!known) return;
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [known]);
  const hours = (language === 'en' && store.hoursEn) || store.hours;
  if (!hours) return null;
  return (
    <Text translate={false} variant="small">
      {[known && t(open ? '영업 중' : '영업 종료'), t('영업시간'), hours]
        .filter(Boolean)
        .join(' · ')}
    </Text>
  );
}
