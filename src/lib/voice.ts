import type { MenuItem, Options } from './types';

export function spokenQuantity(text: string): number | undefined {
  const korean = text.match(/(\d+|한|두|세)\s*(?:잔|개)|^(둘|셋)$/);
  const english = text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
  const count = korean?.[1] ?? korean?.[2] ?? english?.[1]?.toLowerCase();
  if (!count) return undefined;
  const words: Record<string, number> = {
    한: 1,
    두: 2,
    둘: 2,
    세: 3,
    셋: 3,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  return words[count] ?? Number(count);
}

export function voiceSelection(text: string, menu: MenuItem[]) {
  const normalize = (value: string) => value.toLowerCase().replace(/[\s-]/g, '');
  const normalized = normalize(text);
  // Prefer "vanilla latte" over "latte" when both are on the menu.
  let item: MenuItem | undefined;
  let longest = 0;
  for (const entry of menu) {
    for (const name of [entry.name, entry.nameEn]) {
      if (!name) continue;
      const alias = normalize(name);
      // English speech engines can pluralize item names ("two iced lattes").
      if (alias.length > longest && normalized.includes(alias)) {
        item = entry;
        longest = alias.length;
      }
    }
  }
  const options: Options = {};
  if (/아이스|차갑|시원|\b(iced?|cold)\b/i.test(text)) options.temp = 'ice';
  if (/따뜻|뜨거|핫|\b(hot|warm)\b/i.test(text)) options.temp = 'hot';
  if (/라지|크게|큰|\blarge\b/i.test(text)) options.size = 'large';
  if (/레귤러|보통|기본|\bregular\b/i.test(text)) options.size = 'regular';
  return { item, options, qty: spokenQuantity(text) ?? 1 };
}
