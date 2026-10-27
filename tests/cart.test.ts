import { estimate, restoreCart, validateItem } from '@/lib/cart';
import type { MenuItem, PricedLine } from '@/lib/types';
const item: MenuItem = {
  id: 'coffee',
  name: '커피',
  description: '',
  category: '커피',
  available: true,
  price: 2500,
  options: [
    {
      id: 'temp',
      name: '온도',
      required: true,
      type: 'single',
      choices: [{ id: 'ice', name: '아이스', priceDelta: 0 }],
    },
    {
      id: 'extra',
      name: '추가',
      required: false,
      type: 'multi',
      maxChoices: 1,
      choices: [
        { id: 'shot', name: '샷', priceDelta: 500 },
        { id: 'milk', name: '우유', priceDelta: 500, available: false },
      ],
    },
  ],
};
test('requires options and rejects sold-out choices and quantities outside backend limits', () => {
  expect(validateItem(item, 1, {})).toContain('온도');
  expect(validateItem(item, 11, { temp: 'ice' })).not.toBeNull();
  expect(validateItem(item, 1, { temp: 'ice', extra: ['milk'] })).not.toBeNull();
  expect(validateItem(item, 1, { temp: 'ice', extra: ['shot', 'shot'] })).not.toBeNull();
  expect(validateItem(item, 1, { temp: ['ice'] })).not.toBeNull();
  expect(validateItem({ ...item, available: false }, 1, { temp: 'ice' })).not.toBeNull();
  expect(validateItem(item, 2, { temp: 'ice', extra: ['shot'] })).toBeNull();
});
test('estimates choice deltas and restores backend choice objects without sending prices', () => {
  expect(estimate(item, 2, { temp: 'ice', extra: ['shot'] })).toBe(6000);
  const lines: PricedLine[] = [
    {
      itemId: 'coffee',
      name: '커피',
      qty: 2,
      lineTotal: 6000,
      options: [
        { optionId: 'temp', choiceId: 'ice', choiceName: '아이스' },
        { optionId: 'extra', choiceId: 'shot', choiceName: '샷' },
      ],
    },
  ];
  expect(restoreCart(lines, [item])).toEqual([
    { itemId: 'coffee', qty: 2, options: { temp: 'ice', extra: ['shot'] } },
  ]);
});
