import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Help from '@/app/help';
import Orders from '@/app/orders';
import OrderScreen from '@/app/orders/[orderId]';
import { ApiError } from '@/lib/api';
import type { Order } from '@/lib/types';

let mockParams: { orderId?: string; storeId?: string };
let mockApp: ReturnType<typeof makeApp>;

jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('@/providers/app-provider', () => ({ useApp: () => mockApp }));
jest.mock('@/components/screen', () => {
  const { Text, View } = require('react-native');
  return {
    Screen: ({ title, children }: { title: string; children: React.ReactNode }) => (
      <View>
        <Text>{title}</Text>
        {children}
      </View>
    ),
    NavLink: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});
jest.mock('@/components/feedback', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Problem: ({ message, retry }: { message: string; retry?: () => void }) => (
      <>
        <Text>{message}</Text>
        {retry && (
          <Pressable onPress={retry}>
            <Text>다시 시도</Text>
          </Pressable>
        )}
      </>
    ),
    SubmissionRecovery: () => null,
  };
});
jest.mock('@/components/brand', () => {
  const { Text } = require('react-native');
  return {
    IconTile: () => null,
    EmptyState: ({ title }: { title: string }) => <Text>{title}</Text>,
    StatusBadge: Text,
  };
});
jest.mock('@/components/ui/dialog', () => {
  const { Text, View } = require('react-native');
  return {
    Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
      open ? children : null,
    DialogContent: View,
    DialogTitle: Text,
    DialogDescription: Text,
  };
});

const order: Order = {
  orderId: 'owned-order',
  orderNumber: 157,
  storeId: 'cafe',
  kioskId: null,
  sessionId: 'direct-session',
  status: 'submitted',
  total: 5800,
  summary: '카페 라떼 × 1',
  paymentMethod: 'counter',
  note: '',
  helpState: 'idle',
};

function makeApp() {
  return {
    ready: true,
    busy: false,
    pendingSubmission: null,
    connection: null,
    order: null,
    api: {
      base: 'https://example.com',
      store: jest.fn().mockResolvedValue({ storeId: 'cafe', name: '카페' }),
      kioskInfo: jest.fn(),
    },
    getOrder: jest.fn().mockResolvedValue(order),
    getOrders: jest.fn().mockResolvedValue([order]),
    cancel: jest.fn(),
    requestOrderHelp: jest.fn(),
    announce: jest.fn(),
  };
}

beforeEach(() => {
  mockParams = { orderId: order.orderId };
  mockApp = makeApp();
});

test('a history lookup failure has a retry and does not claim the list is empty', async () => {
  mockApp.getOrders.mockRejectedValueOnce(new Error('내역 조회 실패'));
  await render(<Orders />);
  await screen.findByText('내역 조회 실패');
  expect(screen.queryByText('아직 보낸 주문이 없어요')).toBeNull();
  await act(async () => fireEvent.press(screen.getByText('다시 시도')));
  await screen.findByText('주문 번호 157');
  expect(screen.getByText('주문 접수 대기')).toBeTruthy();
  expect(mockApp.api.kioskInfo).not.toHaveBeenCalled();
});

test('a cancel race returns to the accepted order instead of showing cancellation', async () => {
  mockApp.getOrder.mockResolvedValueOnce(order).mockResolvedValue({ ...order, status: 'accepted' });
  mockApp.cancel.mockRejectedValue(new ApiError('too-late-to-cancel', 409, 'Too late'));
  await render(<OrderScreen />);
  const cancel = await screen.findByText('주문 취소 요청');
  await act(async () => fireEvent.press(cancel));
  await act(async () => fireEvent.press(screen.getByText('취소 요청 보내기')));
  await screen.findByText('매장에서 주문을 접수했어요');
  expect(
    screen.getByText('매장에서 이미 주문을 접수했어요. 직원에게 취소를 문의해 주세요.'),
  ).toBeTruthy();
  expect(screen.queryByText('주문이 취소되었어요')).toBeNull();
  expect(screen.queryByText('주문 취소 요청')).toBeNull();
});

test('a ready order shows the store pickup location and hides seed placeholders', async () => {
  mockApp.getOrder.mockResolvedValue({ ...order, status: 'ready' });
  mockApp.api.store.mockResolvedValue({
    storeId: 'cafe',
    name: '카페',
    pickupLocation: '카운터 오른쪽 낮은 선반, 높이 약 75cm',
    indoorDirections: 'TODO: 입구 안내',
    phone: '062-715-0000',
  });
  const openURL = jest.spyOn(require('react-native').Linking, 'openURL').mockResolvedValue(true);
  await render(<OrderScreen />);
  expect(await screen.findByText('카운터 오른쪽 낮은 선반, 높이 약 75cm')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText('(062-715-0000)')));
  expect(openURL).toHaveBeenCalledWith('tel:0627150000');
  expect(screen.queryByText('픽업 위치는 매장 직원에게 확인해 주세요.')).toBeNull();
  expect(screen.queryByText(/TODO/)).toBeNull();
});

test('a ready order without a pickup location asks the customer to check with staff', async () => {
  mockApp.getOrder.mockResolvedValue({ ...order, status: 'ready' });
  mockApp.api.store.mockResolvedValue({
    storeId: 'cafe',
    name: '카페',
    pickupLocation: 'TODO: e.g. 카운터 오른쪽',
  });
  await render(<OrderScreen />);
  expect(await screen.findByText('픽업 위치는 매장 직원에게 확인해 주세요.')).toBeTruthy();
  expect(screen.queryByText(/TODO/)).toBeNull();
});

test('staff help for a direct order shows sent only after confirmation and then reads acknowledgement', async () => {
  mockApp.requestOrderHelp.mockResolvedValue(undefined);
  mockApp.getOrder
    .mockResolvedValueOnce(order)
    .mockResolvedValue({ ...order, helpState: 'acknowledged' });
  await render(<Help />);
  expect(screen.queryByText('도움 요청을 보냈어요')).toBeNull();
  expect(screen.queryByText('직원이 도움 요청을 확인했어요')).toBeNull();
  const request = await screen.findByText('앱으로 직원 도움 요청하기');
  await act(async () => fireEvent.press(request));
  await waitFor(() => expect(mockApp.requestOrderHelp).toHaveBeenCalledWith('owned-order'));
  expect(await screen.findByText('직원이 도움 요청을 확인했어요')).toBeTruthy();
  expect(mockApp.api.kioskInfo).not.toHaveBeenCalled();
});

test('before ordering, help offers kiosk pairing without claiming a request was sent', async () => {
  mockParams = { storeId: 'cafe' };
  await render(<Help />);
  expect(await screen.findByText('키오스크 코드로 연결해 도움 요청하기')).toBeTruthy();
  expect(screen.queryByText('앱으로 직원 도움 요청하기')).toBeNull();
  expect(screen.queryByText('도움 요청을 보냈어요')).toBeNull();
  expect(mockApp.requestOrderHelp).not.toHaveBeenCalled();
});
