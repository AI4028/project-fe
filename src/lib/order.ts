import type { Api } from './api';
import type { Order } from './types';

export function isOpenOrder(order: Order) {
  return order.status !== 'picked_up' && order.status !== 'cancelled';
}

export async function orderStoreId(api: Api, storeId?: string, kioskId?: string | null) {
  return storeId ?? (kioskId ? (await api.kioskInfo(kioskId)).storeId : undefined);
}
