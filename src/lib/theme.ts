// Shared design tokens for native and web, including high-contrast mode.
export const palettes = {
  light: {
    background: '40 33% 97%',
    foreground: '160 28% 13%',
    card: '0 0% 100%',
    'card-foreground': '160 28% 13%',
    popover: '0 0% 100%',
    'popover-foreground': '160 28% 13%',
    primary: '163 68% 23%',
    'primary-foreground': '0 0% 100%',
    secondary: '155 24% 91%',
    'secondary-foreground': '160 28% 13%',
    muted: '150 13% 92%',
    'muted-foreground': '160 10% 36%',
    accent: '155 24% 91%',
    'accent-foreground': '160 28% 13%',
    destructive: '0 72% 40%',
    'destructive-foreground': '0 0% 100%',
    border: '150 12% 80%',
    input: '150 12% 80%',
    ring: '163 68% 23%',
  },
  contrast: {
    background: '0 0% 0%',
    foreground: '0 0% 100%',
    card: '0 0% 0%',
    'card-foreground': '0 0% 100%',
    popover: '0 0% 0%',
    'popover-foreground': '0 0% 100%',
    primary: '55 100% 60%',
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
    ring: '55 100% 60%',
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
