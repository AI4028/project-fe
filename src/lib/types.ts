export type Options = Record<string, string | string[]>;
export type Choice = { id: string; name: string; priceDelta: number; available?: boolean };
export type MenuOption = {
  id: string;
  name: string;
  type: 'single' | 'multi';
  required: boolean;
  maxChoices?: number;
  choices: Choice[];
};
export type MenuItem = {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  category: string;
  price: number;
  available: boolean;
  options: MenuOption[];
};
export type Store = {
  storeId: string;
  name: string;
  address: string;
  accessibility: {
    floor?: number;
    notes?: string;
    stepFreeEntrance?: boolean | null;
    automaticDoor?: boolean | null;
    elevator?: boolean | null;
    accessibleRestroom?: boolean | null;
  };
  location?: { lat: number; lng: number } | null;
  geofenceRadiusM?: number;
  distanceM?: number;
  insideGeofence?: boolean;
  orderingMethods?: string[];
  indoorDirections?: string;
  menu?: MenuItem[];
};
export type CartItem = { itemId: string; qty: number; options: Options };
export type PricedLine = {
  itemId: string;
  name: string;
  qty: number;
  lineTotal: number;
  options: { optionId: string; choiceId: string; choiceName: string }[];
};
export type Cart = { total: number; summary: string; lines: PricedLine[] };
export type Session = {
  sessionId: string;
  kioskId: string;
  storeId: string;
  status: 'active' | 'ordered' | 'ended' | 'expired';
  cart: Cart;
  helpRequested: boolean;
  orderId?: string;
};
export type Connection = { sessionId: string; kioskId: string; storeId: string };
export type OrderStatus =
  | 'submitted'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'cancelled';
export type Order = {
  orderId: string;
  orderNumber: number;
  sessionId: string;
  status: OrderStatus;
  total: number;
  summary: string;
  paymentMethod: 'counter' | 'kiosk';
  note: string;
};
export type Heartbeat = {
  kioskId: string;
  token: string;
  expiresAtMs: number;
  refreshInMs: number;
};
export type Proximity = {
  type: 'proximity';
  kioskId: string;
  storeName: string;
  distance: number;
  rssi?: number;
};
export type LiveEvent = {
  type: string;
  sessionId?: string;
  orderId?: string;
  status?: OrderStatus;
  [key: string]: unknown;
};
export const statusLabels: Record<OrderStatus, string> = {
  submitted: '주문 접수 대기',
  accepted: '주문 접수',
  preparing: '준비 중',
  ready: '픽업해 주세요',
  picked_up: '픽업 완료',
  cancelled: '주문 취소',
};
export const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  submitted: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'picked_up',
};
