import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Review from '@/app/review';

// Found on dev.galjido.shop: after a lost submit response the app recovered the
// order in the background, but the review screen kept "서버에 연결할 수 없습니다"
// and "제출할 장바구니가 없어요" until the customer found the order themselves.
jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/components/screen', () => {
  const { Text, View } = require('react-native');
  return {
    Screen: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
      <View>
        {children}
        {footer}
      </View>
    ),
    NavLink: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});
jest.mock('@/components/brand', () => ({ OrderSteps: () => null }));
jest.mock('@/components/feedback', () => {
  const { Text } = require('react-native');
  return {
    Problem: ({ message }: { message: string }) => <Text>{message}</Text>,
    SubmissionRecovery: () => null,
  };
});

type MockApp = Record<string, unknown> & { order: unknown; pendingSubmission: string | null };
let mockApp: MockApp;
jest.mock('@/providers/app-provider', () => ({ useApp: () => mockApp }));

beforeEach(() => {
  jest.clearAllMocks();
  mockApp = {
    busy: false,
    connection: { sessionId: 's1', kioskId: 'GK01', storeId: 'cafe' },
    store: { storeId: 'cafe', name: '카페', address: '' },
    items: [{ itemId: 'croissant', qty: 1, options: {} }],
    cart: {
      quoteId: 'q1',
      total: 3000,
      summary: '크루아상 1개',
      lines: [{ itemId: 'croissant', name: '크루아상', qty: 1, options: [], lineTotal: 3000 }],
    },
    checkout: { payment: 'counter', note: '' },
    setCheckout: jest.fn(),
    order: null,
    pendingSubmission: null,
    submit: jest.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  };
});

test('opens the recovered order once the app learns it after a lost response', async () => {
  const view = await render(<Review />);
  await act(async () => {
    fireEvent.press(screen.getByText('이 내용으로 주문 제출'));
  });
  expect(screen.getByText(/서버에 연결할 수 없습니다/)).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();

  // Background recovery: the session turned into order #10, cart cleared.
  mockApp = {
    ...mockApp,
    connection: null,
    items: [],
    order: { orderId: 'o10', orderNumber: 10, sessionId: 's1', status: 'submitted' },
  };
  await view.rerender(<Review />);
  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/orders/[orderId]',
    params: { orderId: 'o10' },
  });
});

test('does not jump to an older order from a different connection', async () => {
  mockApp.order = { orderId: 'old', orderNumber: 3, sessionId: 'earlier', status: 'cancelled' };
  const view = await render(<Review />);
  await act(async () => {
    fireEvent.press(screen.getByText('이 내용으로 주문 제출'));
  });
  await view.rerender(<Review />);
  expect(router.replace).not.toHaveBeenCalled();
});
