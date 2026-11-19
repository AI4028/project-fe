import { AppNavigation } from './app-navigation';
import { useState, useCallback, type ReactNode } from 'react';
import { ActivityIndicator, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { Link, router, useFocusEffect, usePathname, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, type LucideIcon } from 'lucide-react-native';
import { Text } from './ui/text';
import { Button, type ButtonProps } from './ui/button';
import { Icon } from './ui/icon';
import { VoiceControls } from './voice-controls';
import { AppHeader } from './app-header';
import { useApp } from '@/providers/app-provider';
import { cn } from '@/lib/utils';
import { layout } from '@/lib/theme';
import { useTranslation } from '@/lib/i18n';

export function NavLink({
  href,
  children,
  variant = 'outline',
  className,
  icon,
  ...props
}: {
  href: Href;
  children: string;
  icon?: LucideIcon;
} & Omit<ButtonProps, 'children'>) {
  return (
    <Link href={href} asChild>
      <Button variant={variant} className={cn('gap-2', className)} {...props}>
        {icon && (
          <Icon
            as={icon}
            size={20}
            accessible={false}
            className={
              variant === 'default'
                ? 'text-primary-foreground'
                : variant === 'destructive'
                  ? 'text-destructive-foreground'
                  : 'text-primary'
            }
          />
        )}
        <Text className="shrink text-center font-semibold">{children}</Text>
      </Button>
    </Link>
  );
}

export function Screen({
  title,
  subtitle,
  children,
  voice = true,
  onTranscript,
  footer,
  reading = false,
  roomy = false,
  chrome = 'app',
  headerDisabled = false,
  contrast,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  voice?: boolean;
  onTranscript?: (text: string) => boolean;
  footer?: ReactNode;
  reading?: boolean;
  roomy?: boolean;
  chrome?: 'app' | 'onboarding' | 'minimal';
  headerDisabled?: boolean;
  contrast?: boolean;
}) {
  const app = useApp();
  const { t } = useTranslation();
  const path = usePathname();
  const { width } = useWindowDimensions();
  const desktop = width >= layout.desktopBreakpoint;
  const showNavigation = chrome === 'app';
  const onboarding = chrome === 'onboarding';
  const showBack = !onboarding && path !== '/' && router.canGoBack();
  const paired = !!app.connection?.kioskId;
  const maxWidth = onboarding
    ? layout.onboardingWidth
    : reading
      ? layout.readingWidth
      : layout.contentWidth;
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return (
    <SafeAreaView className="flex-1 bg-card" edges={['top', 'left', 'right']}>
      <AppHeader onboarding={onboarding} contrast={contrast} disabled={headerDisabled} />
      <View className="flex-1 bg-background">
        <View className="mx-auto w-full flex-1 flex-row" style={{ maxWidth: layout.shellWidth }}>
          {desktop && showNavigation && (
            <ScrollView
              className="w-52 shrink-0 border-r border-border"
              style={{ flexGrow: 0 }}
              contentContainerClassName="px-4 py-6"
            >
              <AppNavigation vertical />
            </ScrollView>
          )}
          <View className="min-w-0 flex-1">
            <ScrollView
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              contentContainerClassName="grow px-4 pb-8 pt-5 sm:px-7 sm:pt-8"
            >
              <View
                className={cn('mx-auto w-full', roomy ? 'gap-7 sm:gap-9' : 'gap-5')}
                style={{ maxWidth }}
              >
                {!onboarding && (showBack || paired) && (
                  <View className="flex-row flex-wrap items-center justify-between gap-2">
                    {showBack && (
                      <Button
                        variant="ghost"
                        onPress={() => router.back()}
                        className="self-start px-0"
                        accessibilityLabel="이전 화면으로"
                      >
                        <Icon as={ArrowLeft} size={20} accessible={false} />
                        <Text>뒤로</Text>
                      </Button>
                    )}
                    {paired && (
                      <View className="flex-row items-center gap-2 rounded-full bg-secondary px-3 py-2">
                        <Icon as={Check} className="text-primary" size={16} accessible={false} />
                        <Text variant="small" className="shrink text-primary">
                          {app.store?.name ?? '매장'} 연결됨
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                <View className="max-w-3xl gap-2">
                  <Text variant="h1" className="text-left">
                    {title}
                  </Text>
                  {subtitle && <Text className="leading-7 text-muted-foreground">{subtitle}</Text>}
                </View>
                {app.busy && (
                  <View className="flex-row items-center gap-3">
                    <ActivityIndicator accessibilityLabel={t('요청 처리 중')} />
                    <Text variant="muted">잠시만 기다려 주세요.</Text>
                  </View>
                )}
                {!!app.notice && (
                  <View className="rounded-2xl border border-primary bg-secondary p-4">
                    <Text accessibilityLiveRegion={Platform.OS === 'web' ? 'polite' : undefined}>
                      {app.notice}
                    </Text>
                  </View>
                )}
                {children}
                {voice && app.settings.voiceInput && focused && (
                  <VoiceControls onTranscript={onTranscript} />
                )}
              </View>
            </ScrollView>
            {footer && (
              <View className="shrink-0 border-t border-border bg-card px-4 py-2 sm:px-7">
                <View className="mx-auto w-full gap-2" style={{ maxWidth }}>
                  {footer}
                </View>
              </View>
            )}
            {!desktop && showNavigation && <AppNavigation />}
          </View>
        </View>
      </View>
      <SafeAreaView edges={['bottom']} className="bg-card" />
    </SafeAreaView>
  );
}
