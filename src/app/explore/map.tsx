import { ExploreScreen } from '@/components/explore-screen';
import StoreMap from '@/components/store-map';

export default function MapExplore() {
  return <ExploreScreen view="map" renderMap={(props) => <StoreMap {...props} />} />;
}
