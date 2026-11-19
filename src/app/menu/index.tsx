import { useLocalSearchParams } from 'expo-router';
import { MenuScreen } from '@/components/menu-screen';

export default function Menu() {
  const { storeId } = useLocalSearchParams<{ storeId?: string }>();
  return <MenuScreen key={storeId} storeId={storeId} />;
}
