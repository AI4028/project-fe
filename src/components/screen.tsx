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
        {icon && <Icon as={icon} size={20} accessible={false} />}
        <Text className="shrink text-center font-bold">{children}</Text>
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
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  voice?: boolean;
  onTranscript?: (text: string) => boolean;
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
            'border',
            isActive(href) ? 'border-primary' : 'border-transparent',
            compact
              ? 'min-w-[70px] flex-1 flex-col gap-1 rounded-xl px-1 py-2'
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
              'shrink font-bold',
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
            className="w-64 shrink-0 border-r border-border bg-card"
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
            <View className="mt-auto gap-3 rounded-2xl border border-border bg-background p-4">
              <Text className="font-bold">내 방식대로, 차근차근.</Text>
              <Text variant="muted" className="leading-6">
                필요한 정보를 살펴보고 직접 선택해 주세요.
              </Text>
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
          <View className="border-b border-border bg-card px-5 py-3 sm:px-8">
            <View className="mx-auto w-full max-w-6xl flex-row flex-wrap items-center justify-between gap-3">
              {desktop ? (
                <Text variant="small" className="font-bold text-muted-foreground">
                  {staff ? '매장 관리' : '매장 정보부터 스마트폰 주문까지'}
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
            contentContainerClassName="grow px-5 py-6 sm:px-8 sm:py-8"
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            <View className="mx-auto w-full max-w-6xl gap-6">
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
                ) : (
                  <Text variant="small" className="font-bold text-primary">
                    {staff ? '직원 전용' : '나에게 맞는 선택'}
                  </Text>
                )}
                {app.connection && (
                  <View className="flex-row items-center gap-2 rounded-full border border-primary bg-secondary px-3 py-2">
                    <Icon as={Check} className="text-primary" size={16} accessible={false} />
                    <Text variant="small" className="shrink text-primary">
                      {app.store?.name ?? '매장'} 연결됨
                    </Text>
                  </View>
                )}
              </View>
              <View className="max-w-3xl gap-3">
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
              <View className="mt-2 flex-row flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                <Text variant="muted">갈지도 · 필요한 정보를 연결해요</Text>
                <NavLink href="/onboarding" variant="ghost">
                  이용 안내
                </NavLink>
              </View>
            </View>
          </ScrollView>
          {!desktop && (
            <View className="flex-row border-t border-border bg-card px-2 py-2">{nav(true)}</View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
