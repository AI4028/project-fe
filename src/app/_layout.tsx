import '../../global.css';
import { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PortalHost } from '@rn-primitives/portal';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { vars } from 'nativewind';
import { AppProvider, useApp } from '@/providers/app-provider';
import { themeVariables } from '@/lib/theme';
import { TextScaleContext } from '@/components/ui/text';
function Layout() {
  const { ready, settings } = useApp();
  useEffect(() => {
    // Web dialogs portal to document.body; share the same token source there.
    if (Platform.OS === 'web') {
      for (const [name, value] of Object.entries(themeVariables(settings.contrast))) {
        document.documentElement.style.setProperty(name, value);
      }
    }
  }, [settings.contrast]);
  return (
    <TextScaleContext.Provider value={settings.largeText ? 1.3 : 1}>
      <View style={[{ flex: 1 }, vars(themeVariables(settings.contrast))]}>
        <StatusBar style={settings.contrast ? 'light' : 'dark'} />
        {ready ? (
          <Stack screenOptions={{ headerShown: false }} />
        ) : (
          <ActivityIndicator accessibilityLabel="앱 준비 중" />
        )}
        <PortalHost />
      </View>
    </TextScaleContext.Provider>
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
