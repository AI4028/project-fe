import { useEffect, useMemo, useRef, useState } from 'react';
import { MapUnavailable } from './map-unavailable';
import { useTranslation } from '@/lib/i18n';
import { layout } from '@/lib/theme';
import type { StoreMapProps } from './store-map';

function mapDocument(key: string) {
  const publicKey = JSON.stringify(key).replace(/</g, '\\u003c');
  return `<!doctype html>
<html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body,#map{height:100%;margin:0;font-family:system-ui,sans-serif}
.pin{position:relative;display:grid;place-items:end center;background:none;border:0;width:48px;height:48px;padding:0;cursor:pointer}
.drop{display:grid;place-items:center;width:22px;height:22px;border-radius:50% 50% 50% 0;background:#bc4b21;border:2px solid white;transform:translateY(-5px) rotate(-45deg);box-shadow:0 1px 4px #0006}
.drop:after{content:"";background:white;width:8px;height:8px;border-radius:50%}
.pin[aria-pressed=true] .drop{background:#832e15}
.caption{position:absolute;left:50%;top:100%;transform:translateX(-50%);padding:3px 7px;color:white;border-radius:7px;font:bold 12px/1.4 system-ui;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis;background:#703019;pointer-events:none}
.me{position:relative;width:14px;height:14px;border-radius:50%;background:#4443c9;border:3px solid white;box-shadow:0 0 0 5px #514ede44;pointer-events:none}
.me .caption{background:#393399;margin-top:4px}
</style><div id="map"></div>
<script>
const origin = new URL(document.baseURI).origin;
const send = (type, fields = {}) => parent.postMessage({type, ...fields}, origin);
const host = document.getElementById('map');
let map, current, previousView, previousSelection;
let markers = [];

function update() {
  if (!map || !current) return;
  const { stores, position, query, language, selectedId } = current;
  document.documentElement.lang = language;
  const point = ({lat, lng}) => new kakao.maps.LatLng(lat, lng);
  const center = position || stores[0]?.location || {lat:37.5445,lng:127.056};
  for (const marker of markers) marker.setMap(null);
  markers = stores.map(({storeId, name, location}) => {
    const active = storeId === selectedId;
    const button = document.createElement('button');
    button.className = 'pin';
    button.title = name;
    button.setAttribute('aria-label', name);
    button.setAttribute('aria-pressed', String(active));
    button.appendChild(document.createElement('span')).className = 'drop';
    if (active) {
      const caption = button.appendChild(document.createElement('span'));
      caption.className = 'caption';
      caption.textContent = name;
    }
    button.onclick = () => send('galjido-store', {id:storeId});
    return new kakao.maps.CustomOverlay({map, position:point(location), content:button,
      clickable:true, yAnchor:1, zIndex:active ? 4 : 2});
  });
  if (position) {
    const dot = document.createElement('div');
    dot.className = 'me';
    const label = dot.appendChild(document.createElement('span'));
    label.className = 'caption';
    label.textContent = language === 'en' ? 'My location' : '내 위치';
    markers.push(new kakao.maps.CustomOverlay({map, position:point(position), content:dot, yAnchor:0.5, zIndex:1}));
  }
  const view = JSON.stringify([query, position, stores.map(store => store.location)]);
  if (previousView !== view) {
    previousView = view;
    if (stores.length > 1 || (position && stores.length)) {
      const bounds = new kakao.maps.LatLngBounds();
      for (const store of stores) bounds.extend(point(store.location));
      if (position) bounds.extend(point(position));
      map.setBounds(bounds, 55, 40, 55, 40);
    } else {
      map.setCenter(point(query && stores.length ? stores[0].location : center));
    }
  }
  if (selectedId && selectedId !== previousSelection) {
    const selected = stores.find(store => store.storeId === selectedId);
    if (selected) map.setCenter(point(selected.location));
  }
  previousSelection = selectedId;
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
    new ResizeObserver(() => {
      map.relayout();
      const selected = current?.stores.find(store => store.storeId === current.selectedId);
      if (selected) map.setCenter(new kakao.maps.LatLng(selected.location.lat, selected.location.lng));
    }).observe(host);
    update();
    send('galjido-map-ready');
  });
};
document.head.appendChild(script);
</script></html>`;
}

export default function StoreMap({
  stores,
  position,
  selectedId,
  onSelect,
  fill,
  query = '',
}: StoreMapProps) {
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
      { type: 'galjido-map-data', stores: pins, position, query, language, selectedId },
      window.location.origin,
    );
  }, [ready, stores, position, query, language, selectedId]);

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
