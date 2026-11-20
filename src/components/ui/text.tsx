// Adapted from React Native Reusables (MIT); see THIRD_PARTY_NOTICES.md.
import { cn } from '@/lib/utils';
import { fontFamily, typography } from '@/lib/theme';
import { useTranslation } from '@/lib/i18n';
import { Slot } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type Role } from 'react-native';

const textVariants = cva(
  cn(
    'text-foreground text-base leading-7',
    Platform.select({
      web: 'select-text break-keep',
    }),
  ),
  {
    variants: {
      variant: {
        default: '',
        h1: cn(
          'text-left text-[26px] font-extrabold leading-tight tracking-tight',
          Platform.select({ web: 'scroll-m-20 text-balance' }),
        ),
        h2: cn(
          'text-[17px] font-bold leading-[26px] tracking-tight',
          Platform.select({ web: 'scroll-m-20 first:mt-0' }),
        ),
        h3: cn(
          'text-xl font-bold leading-7 tracking-tight',
          Platform.select({ web: 'scroll-m-20' }),
        ),
        h4: cn(
          'text-lg font-bold leading-7 tracking-tight',
          Platform.select({ web: 'scroll-m-20' }),
        ),
        p: 'mt-3 leading-7 sm:mt-6',
        blockquote: 'mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6',
        code: cn(
          'bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold',
        ),
        lead: 'text-muted-foreground text-xl',
        large: 'text-lg font-semibold',
        small: 'text-sm font-medium leading-5',
        muted: 'text-muted-foreground text-sm font-normal leading-[21px]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps['variant']>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  blockquote: Platform.select({ web: 'blockquote' as Role }),
  code: Platform.select({ web: 'code' as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: '1',
  h2: '2',
  h3: '3',
  h4: '4',
};

export const TextScaleContext = React.createContext(1);
export const FontReadyContext = React.createContext(false);

// Fixed bars (header, bottom tabs) grow only part of the way so page content
// keeps room at 200%; content itself always uses the full scale.
export function LimitTextScale({ max, children }: { max: number; children: React.ReactNode }) {
  const scale = React.useContext(TextScaleContext);
  return (
    <TextScaleContext.Provider value={Math.min(scale, max)}>{children}</TextScaleContext.Provider>
  );
}

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  asChild = false,
  variant = 'default',
  translate = true,
  ...props
}: React.ComponentProps<typeof RNText> &
  React.RefAttributes<typeof RNText> &
  TextVariantProps & {
    asChild?: boolean;
    translate?: boolean;
  }) {
  const scale = React.useContext(TextScaleContext);
  const { t } = useTranslation();
  const localize = (child: React.ReactNode): React.ReactNode =>
    typeof child === 'string' ? t(child) : Array.isArray(child) ? child.map(localize) : child;
  const fontsReady = React.useContext(FontReadyContext);
  const textClass = React.useContext(TextClassContext);
  const resolvedClass =
    variant === 'muted'
      ? cn(textClass, textVariants({ variant }), className)
      : cn(textVariants({ variant }), textClass, className);
  const weight = /font-(extrabold|black)/.test(resolvedClass)
    ? 'extraBold'
    : /font-(medium|semibold|bold)/.test(resolvedClass)
      ? 'bold'
      : 'regular';
  const sizeClass = resolvedClass.match(
    /(?:^| )text-(xs|sm|base|lg|xl|2xl|3xl|4xl|\[\d+px\])(?: |$)/,
  )?.[1];
  const classSizes: Record<string, number> = {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  };
  const baseSize = sizeClass?.startsWith('[')
    ? Number.parseInt(sizeClass.slice(1), 10)
    : (classSizes[sizeClass ?? ''] ?? typography[variant ?? 'default']);
  const Component = asChild ? Slot : RNText;
  return (
    <Component
      className={resolvedClass}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      {...props}
      children={translate ? localize(props.children) : props.children}
      accessibilityLabel={props.accessibilityLabel ? t(props.accessibilityLabel) : undefined}
      style={[
        fontsReady && !resolvedClass.includes('font-mono')
          ? { fontFamily: fontFamily[weight], fontWeight: 'normal' }
          : undefined,
        scale === 1
          ? undefined
          : {
              fontSize: baseSize * scale,
              lineHeight: baseSize * scale * 1.55,
            },
        props.style,
      ]}
    />
  );
}

export { Text, TextClassContext };
