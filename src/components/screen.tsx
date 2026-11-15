import { useState, useCallback, type ReactNode } from 'react';
import { ActivityIndicator, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { Link, router, useFocusEffect, usePathname, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowUpRight,
  MapPin,
  ShoppingBag,
  Utensils,
  HandHelping,
  Settings2,
  Store,
  Check,
  type LucideIcon,
} from 'lucide-react-native';
import { Text } from './ui/text';
import { Button, type ButtonProps } from './ui/button';
import { Icon } from './ui/icon';
import { VoiceControls } from './voice-controls';
import { BrandLockup } from './brand';
import { useApp } from '@/providers/app-provider';
import { cn } from '@/lib/utils';
import { layout } from '@/lib/theme';

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

const navigation = [
  { href: '/', label: '매장 찾기', icon: MapPin },
  { href: '/menu', label: '메뉴', icon: Utensils },
  { href: '/cart', label: '장바구니', icon: ShoppingBag },
  { href: '/help', label: '도움 요청', icon: HandHelping },
] as const;

export function Screen({
  title,
  subtitle,
  children,
  voice = true,
  onTranscript,
  footer,
  reading = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  voice?: boolean;
  onTranscript?: (text: string) => boolean;
  footer?: ReactNode;
  reading?: boolean;
}) {
  const app = useApp();
  const path = usePathname();
  const { width } = useWindowDimensions();
  const desktop = width >= 1080;
  const staff = path === '/kiosk';
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const count = app.items.reduce((sum, item) => sum + item.qty, 0);
  const isActive = (href: string) =>
    href === '/'
      ? path === '/' || path === '/store'
      : href === '/cart'
        ? path === '/cart' || path === '/review'
        : path.startsWith(href);
  const nav = (compact = false) =>
    navigation.map(({ href, label, icon }) => (
      <Link key={href} href={href} asChild>
        <Button
          variant={isActive(href) ? 'secondary' : 'ghost'}
          accessibilityState={{ selected: isActive(href) }}
          accessibilityLabel={`${label}${href === '/cart' && count ? ` ${count}개` : ''}`}
          className={cn(
            compact
              ? 'min-w-0 flex-1 flex-col gap-1 rounded-2xl px-1 py-2'
              : 'justify-start gap-3 px-4 py-4',
          )}
        >
          <Icon
            as={icon}
            size={22}
            className={isActive(href) ? 'text-primary' : 'text-muted-foreground'}
            accessible={false}
          />
          <Text
            variant={compact ? 'small' : 'default'}
            className={cn(
              'shrink font-semibold',
              isActive(href) ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {label}
            {href === '/cart' && count > 0 ? ` ${count}` : ''}
          </Text>
        </Button>
      </Link>
    ));
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 flex-row">
        {desktop && (
          <ScrollView
            className="w-56 shrink-0 border-r border-border bg-background"
            style={{ flexGrow: 0 }}
            contentContainerClassName="grow px-5 py-8"
          >
            <Link href="/" asChild>
              <Button
                variant="ghost"
                accessibilityLabel="갈지도 홈"
                className="mb-10 justify-start px-3 py-2"
              >
                <BrandLockup />
              </Button>
            </Link>
            <View className="gap-2">{nav()}</View>
            <View className="mt-8 gap-2 border-t border-border pt-5">
              <NavLink href="/settings" variant="ghost" icon={Settings2} className="justify-start">
                이용 설정
              </NavLink>
              <NavLink href="/kiosk" variant="ghost" icon={Store} className="justify-start">
                매장 직원 화면
              </NavLink>
            </View>
            <View className="mt-auto gap-3 pt-10">
              <Text variant="muted">어디든, 내 방식대로.</Text>
              <NavLink
                href="/onboarding"
                variant="ghost"
                className="justify-start px-0"
                icon={ArrowUpRight}
              >
                이용 안내
              </NavLink>
            </View>
          </ScrollView>
        )}
        <View className="min-w-0 flex-1">
          <View className="border-b border-border bg-background px-5 py-2 sm:px-8">
            <View className="mx-auto w-full max-w-6xl flex-row flex-wrap items-center justify-between gap-3">
              {desktop ? (
                <Text variant="small" className="font-bold text-muted-foreground">
                  {staff ? '매장 관리' : (app.store?.name ?? '어디든, 내 방식대로')}
                </Text>
              ) : (
                <Link href="/" asChild>
                  <Button
                    variant="ghost"
                    accessibilityLabel="갈지도 홈"
                    className="items-start px-0"
                  >
                    <BrandLockup />
                  </Button>
                </Link>
              )}
              <NavLink href="/settings" variant="ghost" icon={Settings2}>
                이용 설정
              </NavLink>
            </View>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            contentContainerClassName="grow px-5 py-5 sm:px-8 sm:py-8"
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            <View
              className="mx-auto w-full gap-6"
              style={{ maxWidth: reading ? layout.readingWidth : layout.contentWidth }}
            >
              {(path !== '/' || app.connection) && (
                <View className="flex-row flex-wrap items-center justify-between gap-3">
                  {path !== '/' && router.canGoBack() ? (
                    <Button
                      variant="ghost"
                      onPress={() => router.back()}
                      className="self-start px-0"
                      accessibilityLabel="이전 화면으로"
                    >
                      <Icon as={ArrowLeft} size={20} accessible={false} />
                      <Text>뒤로</Text>
                    </Button>
                  ) : null}
                  {app.connection && (
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
                  <ActivityIndicator accessibilityLabel="요청 처리 중" />
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
              {app.order && (
                <NavLink
                  href={{ pathname: '/orders/[orderId]', params: { orderId: app.order.orderId } }}
                  icon={ShoppingBag}
                  className="self-start"
                >
                  진행 중인 주문 확인
                </NavLink>
              )}
            </View>
          </ScrollView>
          {footer && (
            <View className="border-t border-border bg-card px-5 py-3 sm:px-8">
              <View
                className="mx-auto w-full gap-2"
                style={{ maxWidth: reading ? layout.readingWidth : layout.contentWidth }}
              >
                {footer}
              </View>
            </View>
          )}
          {!desktop && (
            <View className="flex-row border-t border-border bg-card px-2 py-2">{nav(true)}</View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
