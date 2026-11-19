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
  imageUrl?: string;
  options: MenuOption[];
};
export type Store = {
  nameEn?: string;
  imageUrl?: string;
  hours?: string;
  hoursEn?: string;
  placeKind?: 'station' | 'venue' | 'audio_signals' | 'voice_guides' | 'tactile' | 'crossings';
  source?: DataSource;
  directoryOnly?: boolean;
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
  hasOrderTerminal?: boolean;
  orderingPaused?: boolean;
  indoorDirections?: string;
  pickupLocation?: string;
  phone?: string | null;
  menu?: MenuItem[];
  menuSuggestions?: Pick<MenuItem, 'name' | 'nameEn'>[];
};
export type DataSource = {
  name: string;
  url: string;
  license: string;
  date: string;
  coverage: string;
};
export type PlaceSearchKind =
  | 'all'
  | 'stations'
  | 'audio_signals'
  | 'voice_guides'
  | 'tactile'
  | 'crossings';
export type PlaceSearchResult = {
  places: Store[];
  status:
    | 'results'
    | 'empty'
    | 'records'
    | 'not-recorded'
    | 'outside-coverage'
    | 'needs-location'
    | 'unavailable';
  generalSearch: 'available' | 'not-configured' | 'not-requested' | 'unavailable';
};
export type AccessibilityRecords = {
  radiusM: number;
  groups: {
    kind: Exclude<PlaceSearchKind, 'all' | 'stations'>;
    status: 'records' | 'not-recorded' | 'outside-coverage';
    source: DataSource;
    items: {
      id: string;
      location: { lat: number; lng: number };
      distanceM: number;
      detail: string | null;
      coordinatePrecision: 'station' | 'recorded-point';
    }[];
  }[];
};
export type CartItem = { itemId: string; qty: number; options: Options };
export type PricedLine = {
  itemId: string;
  name: string;
  nameEn?: string | null;
  qty: number;
  lineTotal: number;
  options: { optionId: string; choiceId: string; choiceName: string }[];
};
export type Cart = { quoteId?: string; total: number; summary: string; lines: PricedLine[] };
export type Session = {
  sessionId: string;
  kioskId: string | null;
  storeId: string;
  status: 'active' | 'ordered' | 'ended' | 'expired';
  cart: Cart;
  helpRequested: boolean;
  helpState?: 'idle' | 'sent' | 'acknowledged';
  orderId?: string;
};
export type Connection = { sessionId: string; kioskId: string | null; storeId: string };
export type OrderStatus =
  | 'submitted'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'cancelled';
export const paymentLabels = {
  card: '신용·체크카드',
  kakaopay: '카카오페이',
  tosspay: '토스페이',
  naverpay: '네이버페이',
  counter: '만나서 현장 결제',
  kiosk: '키오스크에서 결제',
} as const;
export type PaymentMethod = keyof typeof paymentLabels;

export type Order = {
  orderId: string;
  kioskId?: string | null;
  storeId?: string;
  createdAtMs?: number;
  helpState?: 'idle' | 'sent' | 'acknowledged';
  cancelledBy?: 'customer' | 'staff' | null;
  updatedAtMs?: number;
  orderNumber: number;
  sessionId: string;
  status: OrderStatus;
  total: number;
  summary: string;
  lines?: PricedLine[];
  paymentMethod: PaymentMethod;
  simulatedApprovedAmount?: number | null;
  note: string;
};
export type StaffHelpRequest = { sessionId: string; orderNumber: number | null };
export type Heartbeat = {
  kioskId: string;
  token: string;
  expiresAtMs: number;
  refreshInMs: number;
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
