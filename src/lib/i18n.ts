import { createContext, useContext } from 'react';
import english from './locales/en.json';

export type Language = 'ko' | 'en';
export const LanguageContext = createContext<Language>('ko');
const messages: Record<string, string> = english;
const directionWords: Record<string, string> = {
  정면: 'straight ahead',
  '오른쪽 앞': 'ahead on your right',
  오른쪽: 'on your right',
  '오른쪽 뒤': 'behind you on the right',
  뒤쪽: 'behind you',
  '왼쪽 뒤': 'behind you on the left',
  왼쪽: 'on your left',
  '왼쪽 앞': 'ahead on your left',
};
const compassWords: Record<string, string> = {
  북: 'north',
  북동: 'northeast',
  동: 'east',
  남동: 'southeast',
  남: 'south',
  남서: 'southwest',
  서: 'west',
  북서: 'northwest',
};
const distanceStepEn = (step: string) =>
  messages[step] ?? step.replace(/^약 (\d+)m$/, 'About $1 m');
const itemCount = (count: string) => `${count} ${count === '1' ? 'item' : 'items'}`;
const patterns: [RegExp, (...parts: string[]) => string][] = [
  [/^장바구니 (\d+)개 · ([\d,]+)원$/, (count, total) => `Cart · ${itemCount(count)} · ₩${total}`],
  [/^(\d+) 개의 장소$/, (count) => `${count} ${count === '1' ? 'place' : 'places'}`],
  [/^장소 (\d+)곳을 찾았어요$/, (n) => `Found ${n} ${n === '1' ? 'place' : 'places'}`],
  [/^주문 번호 (\d+)$/, (number) => `Order #${number}`],
  [/^주문 (\d)단계 중 (\d)단계$/, (total, step) => `Order step ${step} of ${total}`],
  [/^(\d+) · (메뉴 선택|장바구니|최종 확인)$/, (step, label) => `${step} · ${messages[label]}`],
  [/^(-?\d+)층\.?$/, (floor) => `Floor ${floor}`],
  [/^([\d,]+)원$/, (amount) => `₩${amount}`],
  [/^(\d+)개$/, itemCount],
  [/^장바구니 (\d+)개$/, (count) => `Cart · ${itemCount(count)}`],
  [/^(.+)에 연결되었습니다\.$/, (name) => `Connected to ${name}.`],
  [/^장바구니가 변경되었습니다\. 합계 ([\d,]+)원$/, (total) => `Cart updated. Total ₩${total}`],
  [
    /^주문 (\d+)번을 전송했습니다\. 매장 접수를 기다려 주세요\.$/,
    (number) => `Order #${number} sent. Waiting for store acceptance.`,
  ],
  [/^주문 (\d+)번, (.+)$/, (number, status) => `Order #${number}, ${messages[status] ?? status}`],
  [
    /^주문 (\d*)번입니다\. 매장이 먼저 접수하면 취소할 수 없습니다\. 주문 취소와 환불은 별도입니다\.$/,
    (number) =>
      `Order #${number}. You can cancel only before store acceptance. Cancellation and refunds are separate.`,
  ],
  [
    /^현재 위치 기준 3km 이내 매장 · 위치 오차 약 (\d+)m$/,
    (accuracy) => `Stores within 3 km · location accuracy about ${accuracy} m`,
  ],
  [
    /^매장은 (정면|오른쪽 앞|오른쪽|오른쪽 뒤|뒤쪽|왼쪽 뒤|왼쪽|왼쪽 앞), (\d+)시 방향으로 약 ([\d.]+k?m) 떨어져 있어요\.$/,
    (side, clock, distance) =>
      `The venue is ${directionWords[side] ?? side}, at ${clock} o'clock, about ${distance} away.`,
  ],
  [
    /^매장은 (북|북동|동|남동|남|남서|서|북서)쪽으로 약 ([\d.]+k?m) 떨어져 있어요\.$/,
    (heading, distance) =>
      `The venue is about ${distance} to the ${compassWords[heading] ?? heading}.`,
  ],
  [
    /^(정면|오른쪽 앞|오른쪽|오른쪽 뒤|뒤쪽|왼쪽 뒤|왼쪽|왼쪽 앞) · (\d+)시 방향$/,
    (side, clock) => `${directionWords[side] ?? side} · ${clock} o'clock`,
  ],
  [
    /^(북|북동|동|남동|남|남서|서|북서)쪽 방향$/,
    (heading) => `To the ${compassWords[heading] ?? heading}`,
  ],
  [
    /^위치 정확도가 낮아요 \(약 (\d+)m\)\. 건물 밖에서 더 정확해요\.$/,
    (meters) => `Location accuracy is low (about ${meters} m). It is more accurate outdoors.`,
  ],
  [/^약 (\d+)m$/, (meters) => `About ${meters} m`],
  [/^([A-Z0-9]{4}) 키오스크$/, (id) => `Kiosk ${id}`],
  [/^연결 코드 ([0-9A-Z]{8})$/, (code) => `Connection code ${code}`],
  [/^([A-Z0-9]{4}) 키오스크 바로 앞이에요\.$/, (id) => `You're right in front of kiosk ${id}.`],
  [
    /^([A-Z0-9]{4}) 키오스크 신호를 찾았어요\. (.+?)(?:이에요|예요)\.$/,
    (id, step) => `Found the signal of kiosk ${id}. ${distanceStepEn(step)}.`,
  ],
  [
    /^키오스크는 (정면|오른쪽 앞|오른쪽|오른쪽 뒤|뒤쪽|왼쪽 뒤|왼쪽|왼쪽 앞), (\d+)시 방향, (.+?)(?:이에요|예요)\.$/,
    (side, clock, step) =>
      `The kiosk is ${directionWords[side] ?? side}, at ${clock} o'clock, ${distanceStepEn(step).toLowerCase()}.`,
  ],
  [
    /^신호 (-?\d+)dBm · 1m 기준 (-?\d+)dBm$/,
    (rssi, ref) => `Signal ${rssi} dBm · 1 m reference ${ref} dBm`,
  ],
  [
    /^나침반 (\d+)° · 키오스크 방위 (\d+)°$/,
    (heading, bearing) => `Compass ${heading}° · kiosk bearing ${bearing}°`,
  ],
  [/^나침반 (\d+)°$/, (heading) => `Compass ${heading}°`],
  [/^돌아본 범위 (\d+)° \/ 360°$/, (deg) => `Turned ${deg}° of 360°`],
  [/^1미터 기준을 (-?\d+)dBm으로 맞췄어요\.$/, (value) => `Set the 1 m reference to ${value} dBm.`],
  [/^신호 온도 (\d+)%$/, (percent) => `Signal heat ${percent}%`],
  [/^(.+) 매장 정보 보기$/, (name) => `View details for ${name}`],
  [/^(.+) 옵션 선택$/, (name) => `Choose options for ${name}`],
  [/^(.+) 옵션과 수량 수정$/, (name) => `Edit options and quantity for ${name}`],
  [/^(.+) 삭제$/, (name) => `Remove ${name}`],
  [/^(.+) 품절$/, (name) => `${name} · sold out`],
  [/^(.+)에서 고른 메뉴예요\.$/, (name) => `Your items from ${name}`],
  [/^(.+) 옵션을 선택해 주세요\.$/, (name) => `Choose an option for ${messages[name] ?? name}.`],
  [
    /^(.+) 선택 개수를 확인해 주세요\.$/,
    (name) => `Check the number of choices for ${messages[name] ?? name}.`,
  ],
  [
    /^(.+?)(?:을|를|을\(를\)) 장바구니에서 삭제합니다\.$/,
    (name) => `Remove ${name} from your cart.`,
  ],
  [/^들은 말: (.+)$/, (text) => `Heard: ${text}`],
  [/^음성 인식: (.+)$/, (text) => `Speech recognition: ${messages[text] ?? text}`],
];

// Korean object particle for a menu name: 을 after a final consonant, 를 after a
// vowel, 을(를) when the name doesn't end in Hangul (e.g. "Latte").
export function objectParticle(word: string): string {
  const code = word.trim().charCodeAt(word.trim().length - 1);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return '을(를)';
  return (code - 0xac00) % 28 === 0 ? '를' : '을';
}

// Exact messages only: never replace words inside names, addresses or user input.
export function translate(value: string, language: Language): string {
  if (language === 'ko') return value;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (messages[normalized]) return messages[normalized];
  for (const [pattern, format] of patterns) {
    const match = normalized.match(pattern);
    if (match) return format(...match.slice(1));
  }
  return value;
}

export function useTranslation() {
  const language = useContext(LanguageContext);
  return { language, t: (value: string) => translate(value, language) };
}
