import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { Text } from './ui/text';

/**
 * Reads its children as one phrase, e.g. "합계, 4,000원", instead of one swipe per
 * text. Native groups an accessible View; on web, VoiceOver ignores labels on plain
 * elements, so a hidden label replaces the visible copy for screen readers.
 * `label` must already be translated.
 */
export function SpokenGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  if (Platform.OS !== 'web') {
    return (
      <View accessible accessibilityLabel={label} className={className}>
        {children}
      </View>
    );
  }
  return (
    <>
      <Text className="sr-only" translate={false}>
        {label}
      </Text>
      <View aria-hidden className={className}>
        {children}
      </View>
    </>
  );
}
