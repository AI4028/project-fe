import type { Store } from './types';
export const featureLabels = {
  all: '모든 장소',
  stations: '지하철역',
  station: '지하철역',
  venue: '장소',
  audio_signals: '음향신호기',
  voice_guides: '역 음성유도기',
  tactile: '점자블록',
  crossings: '횡단보도',
} as const;
export function displayPlace(place: Store, english: boolean): Store {
  const feature = place.placeKind && !['station', 'venue'].includes(place.placeKind);
  return {
    ...place,
    name: feature
      ? featureLabels[place.placeKind!]
      : english && place.nameEn
        ? place.nameEn
        : place.name,
  };
}
