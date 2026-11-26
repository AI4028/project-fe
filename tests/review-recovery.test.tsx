import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Review from '@/app/review';
import { CartChangedError } from '@/lib/api';
import type { Cart } from '@/lib/types';

// Found on dev.galjido.shop: after a lost submit response the app recovered the
// order in the background, but the review screen kept "서버에 연결할 수 없습니다"
// and "제출할 장바구니가 없어요" until the customer found the order themselves.
jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/components/screen', () => {
  const { Text, View } = require('react-native');
  return {
    Screen: ({
      title,
      subtitle,
      children,
      footer,
    }: {
      title: string;
      subtitle?: string;
      children: React.ReactNode;
      footer?: React.ReactNode;
    }) => (
      <View>
        <Text>{title}</Text>
        {subtitle && <Text>{subtitle}</Text>}
        {children}
        {footer}
      </View>
    ),
    NavLink: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});
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
    checkout: { payment: 'counter', note: '', diningOption: 'dine_in' },
    setCheckout: jest.fn(),
    order: null,
    pendingSubmission: null,
    submit: jest.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  };
});

test('requires a named dining choice and exposes which radio button is checked', async () => {
  mockApp.checkout = { payment: 'counter', note: '', diningOption: null };
  mockApp.setCheckout = jest.fn((checkout) => {
    mockApp.checkout = checkout;
  });
  const view = await render(<Review />);
  const forHere = () => screen.getByRole('radio', { name: '매장에서 먹기' });
  const toGo = () => screen.getByRole('radio', { name: '포장하기' });
  const placeOrder = () => screen.getByRole('button', { name: /주문 완료/ });
  expect(forHere().props.accessibilityState.checked).toBe(false);
  expect(toGo().props.accessibilityState.checked).toBe(false);
  expect(placeOrder()).toBeDisabled();

  await fireEvent.press(forHere());
  await view.rerender(<Review />);
  expect(forHere().props.accessibilityState.checked).toBe(true);
  expect(toGo().props.accessibilityState.checked).toBe(false);

  await fireEvent.press(toGo());
  await view.rerender(<Review />);
  expect(forHere().props.accessibilityState.checked).toBe(false);
  expect(toGo().props.accessibilityState.checked).toBe(true);
  await fireEvent.press(placeOrder());
  expect(mockApp.submit).toHaveBeenCalledWith('counter', '', 'takeaway');
});

test('opens the recovered order once the app learns it after a lost response', async () => {
  const view = await render(<Review />);
  await act(async () => {
    fireEvent.press(screen.getByText('주문 완료'));
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
    fireEvent.press(screen.getByText('주문 완료'));
  });
  await view.rerender(<Review />);
  expect(router.replace).not.toHaveBeenCalled();
});

test('requires confirmation of the new server price before restarting submission', async () => {
  const before = mockApp.cart as Cart;
  const after = {
    ...before,
    total: 3600,
    lines: before.lines.map((line) => ({ ...line, lineTotal: 3600 })),
  };
  const submit = jest
    .fn()
    .mockRejectedValueOnce(new CartChangedError(before, after))
    .mockResolvedValueOnce({ orderId: 'price-confirmed', sessionId: 's1' });
  mockApp.submit = submit;
  await render(<Review />);
  await act(async () => fireEvent.press(screen.getByText('주문 완료')));
  expect(screen.getByText('변경 전 3,000원')).toBeTruthy();
  expect(screen.getByText('변경 후 3,600원')).toBeTruthy();
  expect(submit).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => fireEvent.press(screen.getByText('변경된 금액으로 주문 보내기')));
  expect(submit).toHaveBeenCalledTimes(2);
  expect(router.replace).toHaveBeenCalledWith({
    pathname: '/orders/[orderId]',
    params: { orderId: 'price-confirmed' },
  });
});

test('offers recovery instead of a new submission when the original result is uncertain', async () => {
  mockApp.pendingSubmission = 's1';
  await render(<Review />);
  expect(screen.getByText('주문 결과를 확인해 주세요')).toBeTruthy();
  expect(screen.queryByText('전송 실패')).toBeNull();
  expect(screen.queryByText('주문 완료')).toBeNull();
  expect(mockApp.submit).not.toHaveBeenCalled();
});

test('offers simulated wallets only in demo checkout', async () => {
  const view = await render(<Review />);
  expect(screen.getByText('주문을 보내고 매장에서 결제해 주세요.')).toBeTruthy();
  expect(screen.queryByText('카카오페이')).toBeNull();
  mockApp.demo = true;
  await view.rerender(<Review />);
  expect(screen.getByText('카카오페이')).toBeTruthy();
  expect(screen.getByText(/모의 결제입니다/)).toBeTruthy();
});
