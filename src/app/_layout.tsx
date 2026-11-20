import '../global.css';
import { useEffect } from 'react';
import { View, ActivityIndicator, Image, Platform } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { PortalHost } from '@rn-primitives/portal';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import { AppProvider, useApp } from '@/providers/app-provider';
import { brandColors, themeVariables } from '@/lib/theme';
import { Text, TextScaleContext, FontReadyContext } from '@/components/ui/text';
import { resolveTextSize, textScale } from '@/lib/text-size';
import { LanguageContext, translate } from '@/lib/i18n';
function Layout() {
  const { ready, settings } = useApp();
  const [fontsLoaded, fontError] = useFonts({
    KoddiRegular: require('../../assets/fonts/KoddiUDOnGothic-Regular.ttf'),
    KoddiExtraBold: require('../../assets/fonts/KoddiUDOnGothic-ExtraBold.ttf'),
    KoddiBold: require('../../assets/fonts/KoddiUDOnGothic-Bold.ttf'),
  });
  useEffect(() => {
    if (Platform.OS === 'web') document.documentElement.lang = settings.language ?? 'ko';
  }, [settings.language]);
  useEffect(() => {
    // Web dialogs portal to document.body; share the same token source there.
    if (Platform.OS === 'web') {
      for (const [name, value] of Object.entries(themeVariables(settings.contrast))) {
        document.documentElement.style.setProperty(name, value);
      }
    }
  }, [settings.contrast]);
  return (
    <LanguageContext.Provider value={settings.language ?? 'ko'}>
      <FontReadyContext.Provider value={fontsLoaded}>
        <TextScaleContext.Provider value={textScale(resolveTextSize(settings))}>
          <View style={[{ flex: 1 }, vars(themeVariables(settings.contrast))]}>
            <StatusBar style={settings.contrast ? 'light' : 'dark'} />
            {ready && (fontsLoaded || fontError) ? (
              <Stack screenOptions={{ headerShown: false }} />
            ) : (
              <View className="flex-1 items-center justify-center gap-6 bg-background px-8">
                <Text variant="h3" className="text-center">
                  갈 곳을 살피고, 내 방식으로 주문하다.
                </Text>
                <Image
                  source={require('../../assets/brand/galjido-logo-654B3C.png')}
                  resizeMode="contain"
                  style={{
                    width: 96,
                    height: 116,
                    tintColor: settings.contrast ? brandColors.beige : brandColors.walnut,
                  }}
                  accessible={false}
                />
                <View className="items-center">
                  <Text variant="h1" className="text-center text-primary">
                    갈지도
                  </Text>
                  <Text variant="muted" translate={false}>
                    Galjido Service
                  </Text>
                </View>
                <ActivityIndicator
                  accessibilityLabel={translate('앱 준비 중', settings.language ?? 'ko')}
                />
              </View>
            )}
            <PortalHost />
          </View>
        </TextScaleContext.Provider>
      </FontReadyContext.Provider>
    </LanguageContext.Provider>
  );
}
export default function RootLayout() {
  const path = usePathname();
  return (
    <SafeAreaProvider>
      <AppProvider path={path}>
        <Layout />
      </AppProvider>
    </SafeAreaProvider>
  );
}
