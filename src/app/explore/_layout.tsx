import { Redirect, Stack, usePathname } from 'expo-router';
import { useApp } from '@/providers/app-provider';
import { exploreRoute } from '@/lib/location';

export default function ExploreLayout() {
  const { settings } = useApp();
  const path = usePathname();
  const profileHome = exploreRoute(settings.assistance);
  if (path.startsWith('/explore') && !settings.exploreMode && path !== profileHome)
    return <Redirect href={profileHome} />;
  return <Stack key={profileHome} screenOptions={{ headerShown: false }} />;
}
