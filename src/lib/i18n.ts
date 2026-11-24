import { createContext, useContext } from 'react';
import english from './locales/en.json';

export type Language = 'ko' | 'en';
export const LanguageContext = createContext<Language>('ko');
const messages: Record<string, string> = english;
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
