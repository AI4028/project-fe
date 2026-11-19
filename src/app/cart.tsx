import { useLocalSearchParams } from 'expo-router';
import { CartScreen } from '@/components/cart-screen';

export default function Cart() {
  const { edit, itemId, storeId } = useLocalSearchParams<{
    edit?: string;
    itemId?: string;
    storeId?: string;
  }>();
  return (
    <CartScreen
      key={`${storeId}:${edit}:${itemId}`}
      initialEdit={edit}
      initialItemId={itemId}
      initialStoreId={storeId}
    />
  );
}
