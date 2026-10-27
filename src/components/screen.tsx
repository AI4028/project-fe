import { useState, useCallback, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Link, router, useFocusEffect, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from './ui/text';
import { Button } from './ui/button';
import { VoiceControls } from './voice-controls';
import { useApp } from '@/providers/app-provider';
export function NavLink({ href, children }: { href: Href; children: string }) {
  return (
    <Link href={href} asChild>
      <Button variant="outline">
        <Text>{children}</Text>
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
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  voice?: boolean;
  onTranscript?: (text: string) => boolean;
}) {
  const app = useApp();
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="grow p-5 sm:p-8">
        <View className="mx-auto w-full max-w-4xl gap-6">
          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <Link href="/" accessibilityLabel="갈지도 홈">
              <Text className="text-2xl font-bold text-primary">
                갈지도 <Text variant="muted">GALJIDO</Text>
              </Text>
            </Link>
            <View className="flex-row flex-wrap gap-2">
              {router.canGoBack() && (
                <Button variant="ghost" onPress={() => router.back()}>
                  <Text>뒤로</Text>
                </Button>
              )}
              <NavLink href="/settings">접근성 · 설정</NavLink>
            </View>
          </View>
          <View className="gap-2">
            <Text variant="h1" className="text-left">
              {title}
            </Text>
            {subtitle && <Text className="text-muted-foreground">{subtitle}</Text>}
          </View>
          {app.busy && <ActivityIndicator accessibilityLabel="요청 처리 중" />}
          {!!app.notice && (
            <View className="rounded-lg border border-border bg-secondary p-4">
              <Text accessibilityLiveRegion="polite">{app.notice}</Text>
            </View>
          )}
          {children}
          {voice && focused && <VoiceControls onTranscript={onTranscript} />}
          <View className="flex-row flex-wrap gap-2">
            <NavLink href="/">매장 찾기</NavLink>
            <NavLink href="/menu">메뉴</NavLink>
            <NavLink href="/cart">장바구니</NavLink>
            {app.connection && (
              <Button
                variant="secondary"
                disabled={app.busy}
                onPress={() => void app.help().catch(app.report)}
              >
                <Text>직원 호출</Text>
              </Button>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
