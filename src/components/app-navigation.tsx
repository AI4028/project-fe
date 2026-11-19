import { View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Bookmark, House, ReceiptText, SlidersHorizontal } from 'lucide-react-native';
import { Button } from './ui/button';
import { LimitTextScale, Text } from './ui/text';
import { Icon } from './ui/icon';
import { useApp } from '@/providers/app-provider';
import { exploreRoute } from '@/lib/location';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/', label: '홈', icon: House },
  { href: '/orders', label: '주문내용', icon: ReceiptText },
  { href: '/saved', label: '자주가요', icon: Bookmark },
  { href: '/settings', label: '환경설정', icon: SlidersHorizontal },
] as const;
export function AppNavigation({ vertical = false }: { vertical?: boolean }) {
  const path = usePathname();
  const { settings } = useApp();
  const { t } = useTranslation();
  const home = exploreRoute(settings.assistance, settings.exploreMode);
  const active =
    path.startsWith('/orders') || ['/cart', '/review', '/connect', '/leave'].includes(path)
      ? '/orders'
      : path === '/saved'
        ? '/saved'
        : path === '/settings'
          ? '/settings'
          : '/';
  return (
    <LimitTextScale max={1.3}>
      <View
        accessibilityRole="tablist"
        accessibilityLabel={t('주요 탐색')}
        className={vertical ? 'gap-2' : 'flex-row gap-1 border-t border-border bg-card px-2 py-1'}
      >
        {tabs.map(({ href, label, icon }) => (
          <Button
            key={href}
            variant={active === href ? 'secondary' : 'ghost'}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: active === href }}
            className={cn(
              vertical
                ? 'justify-start gap-3 px-4'
                : 'min-w-0 flex-1 flex-col gap-0.5 rounded-xl px-0.5 py-1.5',
              active === href && 'border-primary',
            )}
            onPress={() => {
              const target = href === '/' ? home : href;
              if (path !== target) router.navigate(target);
            }}
          >
            <Icon
              as={icon}
              size={20}
              className={active === href ? 'text-primary' : 'text-muted-foreground'}
              accessible={false}
            />
            <Text
              variant="small"
              className={cn(
                'text-center leading-4',
                !vertical && 'text-[11px]',
                active === href ? 'font-bold text-primary' : 'font-medium text-foreground',
              )}
            >
              {label}
            </Text>
          </Button>
        ))}
      </View>
    </LimitTextScale>
  );
}
