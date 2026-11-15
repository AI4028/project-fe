import { Redirect } from 'expo-router';
import { useApp } from '@/providers/app-provider';
import { exploreRoute } from '@/lib/location';

export default function Home() {
  const { settings } = useApp();
  return <Redirect href={exploreRoute(settings.assistance)} />;
}
