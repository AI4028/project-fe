import { Link } from 'expo-router';
import { View } from 'react-native';
import { layout } from '@/lib/theme';
import { BrandLockup } from './brand';
import { LanguageSwitch } from './language-switch';
import { Button } from './ui/button';
import { LimitTextScale } from './ui/text';

export function AppHeader({
  onboarding = false,
  contrast,
  disabled = false,
}: {
  onboarding?: boolean;
  contrast?: boolean;
  disabled?: boolean;
}) {
  return (
    <LimitTextScale max={1.3}>
      <View className="border-b border-border bg-card px-4 py-1.5 sm:px-7 sm:py-2">
        <View
          className="mx-auto w-full flex-row items-center justify-between gap-2"
          style={{ maxWidth: layout.shellWidth }}
        >
          {onboarding ? (
            <BrandLockup contrast={contrast} />
          ) : (
            <Link href="/" asChild>
              <Button variant="ghost" accessibilityLabel="갈지도 홈" className="shrink px-0 py-0">
                <BrandLockup contrast={contrast} />
              </Button>
            </Link>
          )}
          <LanguageSwitch compact disabled={disabled} />
        </View>
      </View>
    </LimitTextScale>
  );
}
