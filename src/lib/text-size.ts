// Text size steps for the settings screen. Wireframe v3 (#01-3, #01-4) asks for
// up to 200%; the old on/off "큰 글자" setting maps to the middle step.
export type TextSize = 'base' | 'large' | 'xlarge';

export const textSizes: readonly {
  key: TextSize;
  label: string;
  percent: number;
  scale: number;
}[] = [
  { key: 'base', label: '기본', percent: 100, scale: 1 },
  { key: 'large', label: '크게', percent: 150, scale: 1.5 },
  { key: 'xlarge', label: '아주 크게', percent: 200, scale: 2 },
];

export function resolveTextSize(settings: { textSize?: unknown; largeText?: boolean }): TextSize {
  const saved = textSizes.find((size) => size.key === settings.textSize);
  if (saved) return saved.key;
  return settings.largeText ? 'large' : 'base';
}

export function textScale(size: TextSize): number {
  return textSizes.find((step) => step.key === size)?.scale ?? 1;
}
