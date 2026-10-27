import { assistanceFromSpeech, distanceM, knownText, nearbyStores } from '@/lib/location';
import { voiceSelection } from '@/lib/voice';
import type { MenuItem, Store } from '@/lib/types';
test('sorts nearby stores and recognizes arrival without claiming unknown access facts', () => {
  const store: Store = {
    storeId: 'cafe',
    name: 'Cafe',
    address: '',
    accessibility: {},
    location: { lat: 35.2286, lng: 126.8436 },
    geofenceRadiusM: 50,
  };
  const position = { lat: 35.2286, lng: 126.8436 };
  expect(distanceM(position, position)).toBe(0);
  const result = nearbyStores(
    [{ ...store, storeId: 'far', location: { lat: 37, lng: 127 } }, store],
    position,
  );
  expect(result).toHaveLength(1);
  expect(result[0]?.insideGeofence).toBe(true);
  expect(knownText('TODO: confirm')).toBe('확인 필요');
});
test('matches disability choices and menu names before generic order commands', () => {
  expect(assistanceFromSpeech('휠체어 타요')).toBe('wheelchair');
  expect(assistanceFromSpeech('앞이 잘 안 보여요')).toBe('visual');
  expect(assistanceFromSpeech('다리가 불편해요')).toBe('physical');
  const item = { id: 'americano', name: '아메리카노' } as MenuItem;
  expect(voiceSelection('아메리카노 아이스 두 잔 주문', [item])).toEqual({
    item,
    options: { temp: 'ice' },
    qty: 2,
  });
});
