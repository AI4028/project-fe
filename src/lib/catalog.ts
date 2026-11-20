import type { Language } from './i18n';
import type { MenuItem, Store } from './types';

export function venueAddress(store: Store | null | undefined, language: Language) {
  return (language === 'en' && store?.addressEn?.trim()) || store?.address || '';
}

export function menuDescription(item: MenuItem, language: Language) {
  return (language === 'en' && item.descriptionEn?.trim()) || item.description || '';
}

// Only explicit daily schedules at Korean venues support an open/closed label.
export function dailyOpen(hours: string | undefined, now: Date) {
  const match = /^매일 ([01]\d|2[0-3]):([0-5]\d)[–-]([01]\d|2[0-3]):([0-5]\d)$/.exec(hours ?? '');
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  if (start === end) return null;
  const minute = ((now.getUTCHours() + 9) % 24) * 60 + now.getUTCMinutes();
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}
