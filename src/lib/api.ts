import type {
  Cart,
  CartItem,
  Connection,
  Heartbeat,
  LiveEvent,
  Order,
  OrderStatus,
  Session,
  Store,
} from './types';
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function normalizeBase(value: string) {
  const url = new URL(value.trim());
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('HTTP 또는 HTTPS 서버 주소를 입력해 주세요.');
  return url.toString().replace(/\/+$/, '');
}
export class Api {
  readonly base: string;
  constructor(
    base: string,
    private readonly transport: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.base = normalizeBase(base);
  }
  async request<T>(path: string, method = 'GET', body?: unknown, token?: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await this.transport(`${this.base}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new ApiError(
          data.error ?? 'server-error',
          response.status,
          data.message ?? '서버 요청에 실패했습니다.',
        );
      return data as T;
    } finally {
      clearTimeout(timeout);
    }
  }
  wsUrl(path: string, token?: string) {
    const url = new URL(`${this.base}${path}`);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    if (token) url.searchParams.set('token', token);
    return url.toString();
  }
  stores = () => this.request<Store[]>('/stores');
  nearby = (lat: number, lng: number) =>
    this.request<Store[]>(`/stores/nearby?lat=${lat}&lng=${lng}&radiusM=3000`);
  store = (id: string) => this.request<Store>(`/stores/${encodeURIComponent(id)}`);
  register = () => this.request<{ deviceId: string; token: string }>('/devices', 'POST');
  demoToken = (id: string) => this.request<Heartbeat>(`/kiosks/${encodeURIComponent(id)}/token`);
  connect = (kioskId: string, token: string, device: string) =>
    this.request<Connection>('/sessions', 'POST', { kioskId, token }, device);
  session = (id: string, device: string) =>
    this.request<Session>(`/sessions/${id}`, 'GET', undefined, device);
  cart = (id: string, items: CartItem[], device: string) =>
    this.request<Cart>(`/sessions/${id}/cart`, 'PUT', { items }, device);
  order = (id: string, device: string) =>
    this.request<Order>(`/orders/${id}`, 'GET', undefined, device);
  submit = (
    id: string,
    items: CartItem[],
    paymentMethod: 'counter' | 'kiosk',
    note: string,
    device: string,
  ) => this.request<Order>(`/sessions/${id}/order`, 'POST', { items, paymentMethod, note }, device);
  cancel = (id: string, device: string) =>
    this.request<LiveEvent>(`/orders/${id}/cancel`, 'POST', undefined, device);
  help = (id: string, device: string) =>
    this.request<LiveEvent>(`/sessions/${id}/help`, 'POST', undefined, device);
  end = (id: string, device: string) =>
    this.request<LiveEvent>(`/sessions/${id}/end`, 'POST', undefined, device);
  heartbeat = (key: string) => this.request<Heartbeat>('/kiosk/heartbeat', 'POST', undefined, key);
  kioskSession = (key: string) =>
    this.request<Session | null>('/kiosk/session', 'GET', undefined, key);
  kioskOrders = (key: string) => this.request<Order[]>('/kiosk/orders', 'GET', undefined, key);
  kioskInfo = (id: string) =>
    this.request<{ kioskId: string; storeId: string; name: string }>(
      `/kiosks/${encodeURIComponent(id)}`,
    );
  setStatus = (id: string, status: OrderStatus, key: string) =>
    this.request<LiveEvent>(`/kiosk/orders/${id}/status`, 'POST', { status }, key);
  resolveHelp = (id: string, key: string) =>
    this.request(`/kiosk/sessions/${id}/resolve-help`, 'POST', undefined, key);
  endKioskSession = (id: string, key: string) =>
    this.request(`/kiosk/sessions/${id}/end`, 'POST', undefined, key);
  availability = (id: string, available: boolean, key: string) =>
    this.request(`/kiosk/menu/${encodeURIComponent(id)}/availability`, 'PUT', { available }, key);
}
const messages: Record<string, string> = {
  'token-invalid': '연결 코드가 만료되었습니다. 키오스크에서 새 코드를 확인해 주세요.',
  'kiosk-busy': '다른 고객이 사용 중입니다. 잠시 후 다시 연결해 주세요.',
  'session-expired': '연결이 만료되었습니다. 다시 연결해 주세요.',
  'session-not-found': '연결을 찾을 수 없습니다. 다시 연결해 주세요.',
  'item-unavailable': '품절된 메뉴입니다. 메뉴를 새로고침해 주세요.',
  'choice-unavailable': '선택한 옵션이 품절되었습니다.',
  'missing-option': '필수 옵션을 모두 선택해 주세요.',
  'too-late-to-cancel': '이미 준비가 시작되었습니다. 직원에게 문의해 주세요.',
  'not-signed-in': '기기 인증이 만료되었습니다. 다시 연결해 주세요.',
  'not-kiosk': '키오스크 키를 확인해 주세요.',
  'demo-disabled': '데모 연결이 꺼져 있습니다. 키오스크의 연결 코드를 입력해 주세요.',
};
export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return messages[error.code] ?? error.message;
  if (error instanceof Error && error.name === 'AbortError')
    return '서버 응답 시간이 초과되었습니다. 연결 상태를 확인해 주세요.';
  if (error instanceof TypeError)
    return '서버에 연결할 수 없습니다. 설정에서 서버 주소와 네트워크를 확인해 주세요.';
  return error instanceof Error ? error.message : '요청에 실패했습니다. 다시 시도해 주세요.';
}
