import '../global.css';
import { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { PortalHost } from '@rn-primitives/portal';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import { AppProvider, useApp } from '@/providers/app-provider';
import { themeVariables } from '@/lib/theme';
import { TextScaleContext, FontReadyContext } from '@/components/ui/text';
import { LanguageContext, translate } from '@/lib/i18n';
function Layout() {
  const { ready, settings } = useApp();
  const [fontsLoaded, fontError] = useFonts({
    PretendardRegular: require('../../assets/fonts/pretendard-regular.otf'),
    PretendardSemiBold: require('../../assets/fonts/pretendard-semibold.otf'),
    PretendardBold: require('../../assets/fonts/pretendard-bold.otf'),
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
        <TextScaleContext.Provider value={settings.largeText ? 1.3 : 1}>
          <View style={[{ flex: 1 }, vars(themeVariables(settings.contrast))]}>
            <StatusBar style={settings.contrast ? 'light' : 'dark'} />
            {ready && (fontsLoaded || fontError) ? (
              <Stack screenOptions={{ headerShown: false }} />
            ) : (
              <ActivityIndicator
                accessibilityLabel={translate('앱 준비 중', settings.language ?? 'ko')}
              />
            )}
            <PortalHost />
          </View>
        </TextScaleContext.Provider>
      </FontReadyContext.Provider>
    </LanguageContext.Provider>
  );
}
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Layout />
      </AppProvider>
    </SafeAreaProvider>
  );
}
