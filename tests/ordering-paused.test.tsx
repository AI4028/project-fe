import { fireEvent, render, screen } from '@testing-library/react-native';
import { Api, ApiError, errorMessage } from '@/lib/api';
import Connect from '@/app/connect';

jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/components/screen', () => {
  const { Text, View } = require('react-native');
  return {
    Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    NavLink: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});
jest.mock('@/components/feedback', () => {
  const { Text } = require('react-native');
  return {
    OrderingPaused: () => <Text>지금은 주문을 받지 않고 있어요</Text>,
    Problem: ({ message }: { message: string }) => <Text>{message}</Text>,
    SubmissionRecovery: () => null,
  };
});

const store = { storeId: 'gist-cafe', name: 'GIST 카페', address: '광주', accessibility: {} };
const mockApp = {
  busy: false,
  connection: null,
  pendingSubmission: null,
  api: {
    kioskInfo: jest.fn(),
    store: jest.fn(),
  },
  connect: jest.fn(),
};
jest.mock('@/providers/app-provider', () => ({ useApp: () => mockApp }));

async function checkStore() {
  await render(<Connect />);
  await fireEvent.changeText(screen.getByLabelText('매장 기기 코드'), 'GK01');
  await fireEvent.changeText(screen.getByLabelText('연결 코드'), 'ABCDEFGH');
  await fireEvent.press(screen.getByText('연결할 매장 확인하기'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApp.api.kioskInfo.mockResolvedValue({
    kioskId: 'GK01',
    storeId: 'gist-cafe',
    name: '키오스크 1',
  });
});

test('staff pause call and the Korean message', async () => {
  const transport = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ storeId: 'gist-cafe', orderingPaused: true }),
  });
  await new Api('https://example.test', transport).ordering(true, 'ksk_test');
  expect(transport).toHaveBeenCalledWith(
    'https://example.test/kiosk/ordering',
    expect.objectContaining({ method: 'PUT', body: JSON.stringify({ paused: true }) }),
  );
  expect(errorMessage(new ApiError('ordering-paused', 409, 'paused'))).toContain(
    '휴대폰 주문을 받지 않아요',
  );
});

test('a paused store shows the notice instead of the connect button', async () => {
  mockApp.api.store.mockResolvedValue({ ...store, orderingPaused: true });
  await checkStore();
  expect(screen.getByText('지금은 주문을 받지 않고 있어요')).toBeTruthy();
  expect(screen.queryByText('이 매장이 맞아요 · 연결하기')).toBeNull();
});

test('a pause that happens after checking the store also shows the notice', async () => {
  mockApp.api.store.mockResolvedValue({ ...store, orderingPaused: false });
  mockApp.connect.mockRejectedValue(new ApiError('ordering-paused', 409, 'paused'));
  await checkStore();
  await fireEvent.press(screen.getByText('이 매장이 맞아요 · 연결하기'));
  expect(screen.getByText('지금은 주문을 받지 않고 있어요')).toBeTruthy();
  expect(screen.queryByText('이 매장이 맞아요 · 연결하기')).toBeNull();
});
