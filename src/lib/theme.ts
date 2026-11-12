// Galjido BI v1: exact sRGB source values, shared by native and web.
export const brandColors = {
  walnut: '#654B3C',
  beige: '#EDE3DA',
  offWhite: '#FAF8F5',
  white: '#FFFFFF',
  charcoal: '#2F2A24',
  logoEnglish: '#A6A6A6',
  black: '#000000',
} as const;

function hsl(hex: string) {
  const channel = (offset: number) => parseInt(hex.slice(offset, offset + 2), 16) / 255;
  const r = channel(1),
    g = channel(3),
    b = channel(5);
  const high = Math.max(r, g, b),
    low = Math.min(r, g, b),
    delta = high - low;
  const light = (high + low) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
  const hue =
    delta === 0
      ? 0
      : high === r
        ? ((g - b) / delta + 6) % 6
        : high === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
  return `${hue * 60} ${saturation * 100}% ${light * 100}%`;
}

export const typography = {
  default: 16,
  h1: 32,
  h2: 24,
  h3: 20,
  h4: 18,
  p: 16,
  blockquote: 16,
  code: 14,
  lead: 20,
  large: 18,
  small: 14,
  muted: 14,
} as const;

export const palettes = {
  light: {
    background: hsl(brandColors.offWhite),
    foreground: hsl(brandColors.charcoal),
    card: '0 0% 100%',
    'card-foreground': hsl(brandColors.charcoal),
    popover: '0 0% 100%',
    'popover-foreground': hsl(brandColors.charcoal),
    primary: hsl(brandColors.walnut),
    'primary-foreground': '0 0% 100%',
    secondary: hsl(brandColors.beige),
    'secondary-foreground': hsl(brandColors.walnut),
    muted: hsl('#F3EEE8'),
    'muted-foreground': hsl('#6D6259'),
    accent: hsl(brandColors.beige),
    'accent-foreground': hsl(brandColors.walnut),
    destructive: hsl('#A32D24'),
    'destructive-foreground': '0 0% 100%',
    border: hsl('#D8CEC5'),
    input: hsl('#88786C'),
    ring: hsl(brandColors.walnut),
  },
  contrast: {
    background: '0 0% 0%',
    foreground: '0 0% 100%',
    card: '0 0% 0%',
    'card-foreground': '0 0% 100%',
    popover: '0 0% 0%',
    'popover-foreground': '0 0% 100%',
    primary: hsl(brandColors.beige),
    'primary-foreground': '0 0% 0%',
    secondary: '0 0% 15%',
    'secondary-foreground': '0 0% 100%',
    muted: '0 0% 15%',
    'muted-foreground': '0 0% 90%',
    accent: '0 0% 15%',
    'accent-foreground': '0 0% 100%',
    destructive: '0 100% 80%',
    'destructive-foreground': '0 0% 0%',
    border: '0 0% 100%',
    input: '0 0% 100%',
    ring: hsl(brandColors.beige),
  },
} as const;
export function themeVariables(contrast: boolean) {
  return Object.fromEntries(
    Object.entries(palettes[contrast ? 'contrast' : 'light']).map(([key, value]) => [
      `--${key}`,
      value,
    ]),
  );
}
