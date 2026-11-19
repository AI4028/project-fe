import { directoryPlaces, directionsUrl, placeSearchUrl } from '@/lib/navigation';
import { developmentApiBase } from '@/lib/development-api';
test('native development maps loopback API to the Metro LAN host without changing production origins', () => {
  expect(developmentApiBase('http://127.0.0.1:8000', '192.168.1.5:8081', true)).toBe(
    'http://192.168.1.5:8000',
  );
  expect(developmentApiBase('https://api.example.com', '192.168.1.5:8081', true)).toBe(
    'https://api.example.com',
  );
  expect(developmentApiBase('http://localhost:8000', '192.168.1.5:8081', false)).toBe(
    'http://localhost:8000',
  );
});
test('directory results never invent ordering or accessibility', () => {
  const result = directoryPlaces([{ id: '1', place_name: 'Cafe', x: '127', y: '37', rating: 5 }]);
  expect(result[0]).toMatchObject({ directoryOnly: true, accessibility: {}, storeId: 'place:1' });
  expect(result[0]?.menu).toBeUndefined();
  expect(directoryPlaces([{ id: '1', place_name: 'Bad', x: 'Infinity', y: '37' }])).toEqual([]);
  expect(directoryPlaces(null)).toEqual([]);
});
test('Kakao directions use coordinates and walking mode', () => {
  const url = new URL(
    directionsUrl({
      storeId: '1',
      name: 'A&B',
      address: 'Seoul',
      accessibility: {},
      location: { lat: 37, lng: 127 },
    }),
  );
  expect(url.hostname).toBe('m.map.kakao.com');
  expect(url.pathname).toBe('/scheme/route');
  expect(url.searchParams.get('ep')).toBe('37,127');
  expect(url.searchParams.get('by')).toBe('foot');
  expect(new URL(placeSearchUrl('A&B')).searchParams.get('q')).toBe('A&B');
});

test('directions fall back to Kakao place search without coordinates', () => {
  const url = new URL(
    directionsUrl({
      storeId: '1',
      name: 'A&B',
      address: 'Seoul',
      accessibility: {},
    }),
  );
  expect(url.hostname).toBe('map.kakao.com');
  expect(url.searchParams.get('q')).toBe('A&B Seoul');
});
