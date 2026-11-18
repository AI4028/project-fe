import { View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Compass, Bookmark, ReceiptText, Settings2 } from 'lucide-react-native';
import { Button } from './ui/button';
import { LimitTextScale, Text } from './ui/text';
import { Icon } from './ui/icon';
import { useApp } from '@/providers/app-provider';
import { exploreRoute } from '@/lib/location';

const tabs = [
  { href: '/', label: '둘러보기', icon: Compass },
  { href: '/saved', label: '저장', icon: Bookmark },
  { href: '/orders', label: '주문', icon: ReceiptText },
  { href: '/settings', label: '설정', icon: Settings2 },
] as const;
export function AppNavigation({ vertical = false }: { vertical?: boolean }) {
  const path = usePathname();
  const { settings } = useApp();
  const home = exploreRoute(settings.assistance);
  const active =
    path.startsWith('/orders') || ['/cart', '/review', '/connect', '/leave'].includes(path)
      ? '/orders'
      : path === '/saved'
        ? '/saved'
        : path === '/settings'
          ? '/settings'
          : '/';
  return (
    <LimitTextScale max={vertical ? 2 : 1.3}>
      <View
        accessibilityRole="tablist"
        accessibilityLabel="주요 탐색"
        className={vertical ? 'gap-2' : 'flex-row border-t border-border bg-card px-2 py-2'}
      >
        {tabs.map(({ href, label, icon }) => (
          <Button
            key={href}
            variant="ghost"
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: active === href }}
            className={
              vertical
                ? 'justify-start gap-3 px-4'
                : 'min-w-0 flex-1 flex-col gap-1 rounded-2xl px-1 py-2'
            }
            onPress={() => {
              const target = href === '/' ? home : href;
              if (path !== target) router.navigate(target);
            }}
          >
            <Icon
              as={icon}
              size={22}
              className={active === href ? 'text-primary' : 'text-muted-foreground'}
              accessible={false}
            />
            <Text
              variant="small"
              className={
                active === href ? 'font-semibold text-primary' : 'font-normal text-muted-foreground'
              }
            >
              {label}
            </Text>
          </Button>
        ))}
      </View>
    </LimitTextScale>
  );
}
