import { AppNavigation } from './app-navigation';
import { useState, useCallback, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, View } from 'react-native';
import { Link, router, useFocusEffect, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import { Text } from './ui/text';
import { Button, type ButtonProps } from './ui/button';
import { Icon } from './ui/icon';
import { VoiceControls } from './voice-controls';
import { useApp } from '@/providers/app-provider';
import { cn } from '@/lib/utils';
import { brandColors, layout } from '@/lib/theme';
import { useTranslation } from '@/lib/i18n';
import { useScreenFocus } from '@/lib/use-screen-focus';

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
      {/* Link marks its child as a link; these look and act like the buttons around them. */}
      <Button role="button" variant={variant} className={cn('gap-2', className)} {...props}>
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
  onBack,
  brandedHeader = false,
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
  onBack?: () => void;
  brandedHeader?: boolean;
}) {
  const app = useApp();
  const { t } = useTranslation();
  const showNavigation = chrome === 'app';
  const onboarding = chrome === 'onboarding';
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
  const heading = useRef(null);
  useScreenFocus(heading);
  return (
    <SafeAreaView className="flex-1 bg-card" edges={['top', 'left', 'right']}>
      <View className="flex-1 bg-background">
        <View className="mx-auto w-full flex-1 flex-row" style={{ maxWidth: layout.shellWidth }}>
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
                {!onboarding && (
                  <View
                    className={cn(
                      'flex-row items-center justify-between',
                      brandedHeader && 'border-b border-border pb-2',
                    )}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="self-start"
                      accessibilityLabel="이전 화면으로"
                      onPress={
                        onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))
                      }
                    >
                      <Icon as={ArrowLeft} size={22} />
                    </Button>
                    {brandedHeader && (
                      <Image
                        source={require('../../assets/brand/galjido-logo-654B3C.png')}
                        resizeMode="contain"
                        accessible={false}
                        style={{
                          width: 32,
                          height: 40,
                          tintColor: app.settings.contrast ? brandColors.beige : brandColors.walnut,
                        }}
                      />
                    )}
                  </View>
                )}
                <View className="max-w-3xl gap-2">
                  <Text ref={heading} variant="h1" className="text-left">
                    {title}
                  </Text>
                  {subtitle && <Text variant="muted">{subtitle}</Text>}
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
            {showNavigation && <AppNavigation />}
          </View>
        </View>
      </View>
      <SafeAreaView edges={['bottom']} className="bg-card" />
    </SafeAreaView>
  );
}
