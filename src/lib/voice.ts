import type { MenuItem, Options } from './types';
export function voiceSelection(text: string, menu: MenuItem[]) {
  const normalized = text.replace(/\s/g, '').toLowerCase();
  const item = menu.find((entry) =>
    normalized.includes(entry.name.replace(/\s/g, '').toLowerCase()),
  );
  const options: Options = {};
  if (/아이스|차갑|시원/.test(text)) options.temp = 'ice';
  if (/따뜻|뜨거|핫/.test(text)) options.temp = 'hot';
  if (/라지|크게|큰/.test(text)) options.size = 'large';
  if (/레귤러|보통|기본/.test(text)) options.size = 'regular';
  const count = text.match(/(\d+)\s*(잔|개)/)?.[1];
  const qty = count
    ? Number(count)
    : /두\s*(잔|개)|둘/.test(text)
      ? 2
      : /세\s*(잔|개)|셋/.test(text)
        ? 3
        : 1;
  return { item, options, qty };
}
