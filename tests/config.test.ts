import config from '../app.json';
test('registers Expo Router and typed file routes', () => {
  expect(config.expo.plugins).toContain('expo-router');
  expect(config.expo.experiments.typedRoutes).toBe(true);
});
