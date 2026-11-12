// Adapted from React Native Reusables (MIT); see THIRD_PARTY_NOTICES.md.
import { cn } from '@/lib/utils';
import { typography } from '@/lib/theme';
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
          'text-left text-[32px] font-bold leading-tight tracking-tight',
          Platform.select({ web: 'scroll-m-20 text-balance' }),
        ),
        h2: cn(
          'text-2xl font-bold leading-8 tracking-tight',
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
        muted: 'text-muted-foreground text-sm leading-6',
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

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  asChild = false,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof RNText> &
  React.RefAttributes<typeof RNText> &
  TextVariantProps & {
    asChild?: boolean;
  }) {
  const scale = React.useContext(TextScaleContext);
  const fontsReady = React.useContext(FontReadyContext);
  const textClass = React.useContext(TextClassContext);
  const resolvedClass = cn(textVariants({ variant }), textClass, className);
  const bold = /font-(medium|semibold|bold|extrabold|black)/.test(resolvedClass);
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
      style={[
        fontsReady && !resolvedClass.includes('font-mono')
          ? { fontFamily: bold ? 'KoddiUDBold' : 'KoddiUDRegular', fontWeight: 'normal' }
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
