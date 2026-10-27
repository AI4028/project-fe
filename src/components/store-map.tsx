import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { Text } from './ui/text';
import MapView, { Circle, Marker } from 'react-native-maps';
import type { Store } from '@/lib/types';
import type { Position } from '@/lib/location';
export type StoreMapProps = {
  stores: Store[];
  position: Position | null;
  onSelect: (store: Store) => void;
};
export default function StoreMap({ stores, position, onSelect }: StoreMapProps) {
  const ref = useRef<MapView>(null);
  const center = position ??
    stores.find((store) => store.location)?.location ?? { lat: 35.2286, lng: 126.8436 };
  useEffect(() => {
    if (position)
      ref.current?.animateToRegion(
        {
          latitude: position.lat,
          longitude: position.lng,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        },
        300,
      );
  }, [position?.lat, position?.lng]);
  if (Platform.OS === 'android' && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)
    return (
      <View className="rounded-lg bg-secondary p-6">
        <Text>지도 연결 전에는 아래 매장 목록을 이용해 주세요.</Text>
      </View>
    );
  return (
    <MapView
      ref={ref}
      style={{ height: 300, width: '100%', borderRadius: 16 }}
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
          title="내 위치"
          pinColor="blue"
        />
      )}
      {stores.map(
        (store) =>
          store.location && (
            <Marker
              key={store.storeId}
              coordinate={{ latitude: store.location.lat, longitude: store.location.lng }}
              title={store.name}
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
              fillColor="rgba(0,110,80,0.12)"
              strokeColor="#14634f"
            />
          ),
      )}
    </MapView>
  );
}
