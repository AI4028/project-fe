import { parseKioskAdvertisement } from '@/lib/kiosk-scan';

test('reads the kiosk ID and token from a matching advertisement', () => {
  expect(parseKioskAdvertisement('LKGK017H3KQ9ZC')).toEqual({
    kioskId: 'GK01',
    token: '7H3KQ9ZC',
  });
});

test.each(['XXGK017H3KQ9ZC', 'LKGK017H3KQ9ZC\n', 'LK@K017H3KQ9ZC', 'LKGK017H3KQ9UC'])(
  'ignores malformed or unrelated advertisement %j',
  (payload) => expect(parseKioskAdvertisement(payload)).toBeNull(),
);
