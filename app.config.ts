import type { ExpoConfig } from 'expo/config';
import config from './app.json';
export default (): ExpoConfig => ({
  ...(config.expo as ExpoConfig),
  plugins: [
    ...(config.expo.plugins as NonNullable<ExpoConfig['plugins']>),
    [
      'expo-location',
      { locationWhenInUsePermission: '가까운 매장과 도착 안내를 위해 위치를 사용합니다.' },
    ],
    [
      'react-native-maps',
      { androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '' },
    ],
  ],
});
