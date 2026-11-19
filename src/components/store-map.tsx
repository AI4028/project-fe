import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { MapUnavailable } from './map-unavailable';
import { brandColors, layout } from '@/lib/theme';
import { useTranslation } from '@/lib/i18n';
import MapView, { Circle, Marker } from 'react-native-maps';
import type { Store } from '@/lib/types';
import type { Position } from '@/lib/location';
export type StoreMapProps = {
  fill?: boolean;
  query?: string;
  stores: Store[];
  position: Position | null;
  onSelect: (store: Store) => void;
};
export default function StoreMap({ stores, position, onSelect, fill, query }: StoreMapProps) {
  const { t, language } = useTranslation();
  const ref = useRef<MapView>(null);
  const center = (query ? stores.find((store) => store.location)?.location : null) ??
    position ??
    stores.find((store) => store.location)?.location ?? { lat: 37.5445, lng: 127.056 };
  useEffect(() => {
    ref.current?.animateToRegion(
      { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.025, longitudeDelta: 0.025 },
      300,
    );
  }, [center.lat, center.lng]);
  if (Platform.OS === 'android' && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)
    return <MapUnavailable />;
  return (
    <MapView
      ref={ref}
      style={{
        height: fill ? '100%' : layout.mapHeight,
        width: '100%',
        borderRadius: fill ? 0 : layout.radius,
      }}
      initialRegion={{
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {position && (
        <Marker
          coordinate={{ latitude: position.lat, longitude: position.lng }}
          title={t('내 위치')}
          pinColor="blue"
        />
      )}
      {stores.map(
        (store) =>
          store.location && (
            <Marker
              key={store.storeId}
              coordinate={{ latitude: store.location.lat, longitude: store.location.lng }}
              title={language === 'en' ? store.nameEn || store.name : store.name}
              pinColor={brandColors.walnut}
              onPress={() => onSelect(store)}
            />
          ),
      )}
      {stores.map(
        (store) =>
          store.location &&
          store.geofenceRadiusM && (
            <Circle
              key={store.storeId}
              center={{ latitude: store.location.lat, longitude: store.location.lng }}
              radius={store.geofenceRadiusM}
              fillColor={`${brandColors.walnut}1F`}
              strokeColor={brandColors.walnut}
            />
          ),
      )}
    </MapView>
  );
}
