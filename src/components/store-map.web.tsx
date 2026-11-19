import { useEffect, useMemo, useRef, useState } from 'react';
import { MapUnavailable } from './map-unavailable';
import { useTranslation } from '@/lib/i18n';
import { layout } from '@/lib/theme';
import type { StoreMapProps } from './store-map';

function mapDocument(key: string) {
  const publicKey = JSON.stringify(key).replace(/</g, '\\u003c');
  return `<!doctype html>
<html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body,#map{height:100%;margin:0;font-family:sans-serif}</style><div id="map"></div>
<script>
const origin = new URL(document.baseURI).origin;
const send = (type, fields = {}) => parent.postMessage({type, ...fields}, origin);
const host = document.getElementById('map');
let map, current, previousView;
let markers = [];

function update() {
  if (!map || !current) return;
  const { stores, position, query, language } = current;
  document.documentElement.lang = language;
  const point = ({lat, lng}) => new kakao.maps.LatLng(lat, lng);
  const center = position || stores[0]?.location || {lat:37.5445,lng:127.056};
  for (const marker of markers) marker.setMap(null);
  markers = stores.map(({storeId, name, location}) => {
    const marker = new kakao.maps.Marker({map, position:point(location), title:name});
    kakao.maps.event.addListener(marker, 'click', () => send('galjido-store', {id:storeId}));
    return marker;
  });
  if (position) {
    markers.push(new kakao.maps.Marker({
      map, position:point(position), title:language === 'en' ? 'My location' : '내 위치'
    }));
  }
  const view = JSON.stringify([query, position, stores.map(store => store.location)]);
  if (previousView !== view) {
    previousView = view;
    if (query && stores.length > 1) {
      const bounds = new kakao.maps.LatLngBounds();
      for (const store of stores) bounds.extend(point(store.location));
      map.setBounds(bounds);
    } else {
      map.setCenter(point(query && stores.length ? stores[0].location : center));
    }
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== parent || event.origin !== origin || event.data?.type !== 'galjido-map-data') return;
  current = event.data;
  update();
});
const script = document.createElement('script');
const fail = () => { clearTimeout(timeout); send('galjido-map-unavailable'); };
const timeout = setTimeout(fail, 15000);
script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=' + encodeURIComponent(${publicKey});
script.onerror = fail;
script.onload = () => {
  if (!window.kakao?.maps) return fail();
  kakao.maps.load(() => {
    clearTimeout(timeout);
    map = new kakao.maps.Map(host, {center:new kakao.maps.LatLng(37.5445,127.056), level:5});
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.TOPRIGHT);
    new ResizeObserver(() => map.relayout()).observe(host);
    update();
    send('galjido-map-ready');
  });
};
document.head.appendChild(script);
</script></html>`;
}

export default function StoreMap({ stores, position, onSelect, fill, query = '' }: StoreMapProps) {
  const key = process.env.EXPO_PUBLIC_KAKAO_MAP_KEY;
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const { language } = useTranslation();
  const html = useMemo(() => (key ? mapDocument(key) : ''), [key]);

  useEffect(() => {
    function message(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'galjido-map-ready') setReady(true);
      if (event.data?.type === 'galjido-map-unavailable') setFailed(true);
      if (event.data?.type === 'galjido-store') {
        const store = stores.find((item) => item.storeId === event.data.id);
        if (store) onSelect(store);
      }
    }
    window.addEventListener('message', message);
    return () => window.removeEventListener('message', message);
  }, [stores, onSelect]);

  useEffect(() => {
    if (!ready) return;
    const pins = stores.flatMap((store) =>
      store.location
        ? [
            {
              storeId: store.storeId,
              name: language === 'en' ? store.nameEn || store.name : store.name,
              location: store.location,
            },
          ]
        : [],
    );
    frame.current?.contentWindow?.postMessage(
      { type: 'galjido-map-data', stores: pins, position, query, language },
      window.location.origin,
    );
  }, [ready, stores, position, query, language]);

  if (!key || failed) return <MapUnavailable />;
  return (
    <iframe
      ref={frame}
      title={
        language === 'en'
          ? 'Nearby places map. Select a pin to view place details.'
          : '주변 장소 지도. 핀을 선택하면 장소 정보를 볼 수 있어요.'
      }
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin"
      style={{ border: 0, width: '100%', height: fill ? '100%' : layout.mapHeight }}
    />
  );
}
