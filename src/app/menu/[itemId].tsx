import { Redirect, useLocalSearchParams } from 'expo-router';
import { MenuScreen } from '@/components/menu-screen';

export default function ItemOptions() {
  const { storeId, itemId, speech, edit } = useLocalSearchParams<{
    storeId?: string;
    itemId: string;
    speech?: string;
    edit?: string;
  }>();
  if (edit !== undefined)
    return <Redirect href={{ pathname: '/cart', params: { edit, itemId, storeId } }} />;
  return (
    <MenuScreen
      key={`${storeId}:${itemId}:${speech}`}
      storeId={storeId}
      initialItemId={itemId}
      initialSpeech={speech}
    />
  );
}
