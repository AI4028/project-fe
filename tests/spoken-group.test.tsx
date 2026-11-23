import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { OrderLines, TotalRow } from '@/components/order-lines';
import { LanguageContext } from '@/lib/i18n';
import type { PricedLine } from '@/lib/types';

jest.mock('@rn-primitives/slot', () => ({ Slot: jest.fn() }));

const originalOS = Platform.OS;
const latte = {
  itemId: 'latte',
  name: '카페라떼',
  qty: 1,
  lineTotal: 4000,
  options: [],
} as unknown as PricedLine;

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
});

test('native reads the total and each order line as one phrase', async () => {
  await render(
    <>
      <OrderLines lines={[latte]} />
      <TotalRow total={4000} />
    </>,
  );

  expect(screen.getByLabelText('카페라떼 1개, 4,000원')).toBeTruthy();
  expect(screen.getByLabelText('합계, 4,000원')).toBeTruthy();
});

test('web reads a hidden phrase and hides the visible pieces', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  await render(
    <LanguageContext.Provider value="en">
      <TotalRow total={4000} />
    </LanguageContext.Provider>,
  );

  expect(screen.getByText('Total, ₩4,000')).toBeTruthy();
  expect(screen.getByText('Total', { includeHiddenElements: true })).not.toBeVisible();
});
