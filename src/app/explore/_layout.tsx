import { Redirect, Stack, usePathname } from 'expo-router';
import { useApp } from '@/providers/app-provider';
import { exploreRoute } from '@/lib/location';

export default function ExploreLayout() {
  const { settings } = useApp();
  const path = usePathname();
  const home = exploreRoute(settings.assistance);
  if (path.startsWith('/explore') && path !== home) return <Redirect href={home} />;
  return <Stack key={home} screenOptions={{ headerShown: false }} />;
}
