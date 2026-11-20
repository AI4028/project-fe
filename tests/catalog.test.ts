import { dailyOpen } from '../src/lib/catalog';

describe('Korean daily opening hours', () => {
  const at = (utc: string) => new Date(`2026-11-20T${utc}:00Z`);

  it('includes opening time and excludes closing time in Seoul', () => {
    expect(dailyOpen('매일 09:00–21:00', at('00:00'))).toBe(true);
    expect(dailyOpen('매일 09:00–21:00', at('12:00'))).toBe(false);
  });

  it('supports overnight service and leaves unconfirmed schedules unlabeled', () => {
    expect(dailyOpen('매일 21:00–06:00', at('16:30'))).toBe(true);
    expect(dailyOpen('매일 21:00–06:00', at('00:00'))).toBe(false);
    for (const hours of [undefined, '09:00–21:00', '월–금 09:00–18:00', '매일 09:00–09:00'])
      expect(dailyOpen(hours, at('00:00'))).toBeNull();
  });
});
