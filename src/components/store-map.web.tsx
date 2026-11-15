import { useEffect, useMemo, useRef } from 'react';
import { MapUnavailable } from './map-unavailable';
import { brandColors, layout } from '@/lib/theme';
import type { StoreMapProps } from './store-map';
import { useTranslation } from '@/lib/i18n';
export default function StoreMap({ stores, position, onSelect }: StoreMapProps) {
  const { language, t } = useTranslation();
  const key = process.env.EXPO_PUBLIC_KAKAO_MAP_KEY;
  const frame = useRef<HTMLIFrameElement>(null);
  // Data is JSON-escaped before embedding; store names are assigned with text APIs.
  const html = useMemo(() => {
    const data = JSON.stringify({ stores, position, key, language }).replace(/</g, '\\u003c');
    return `<!doctype html><html lang="${language}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#map{height:100%;margin:0;font-family:sans-serif}p{padding:20px}</style></head><body><div id="map"></div><script>
const data=${data};
const script=document.createElement('script');
script.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey='+encodeURIComponent(data.key);
script.onerror=()=>document.getElementById('map').textContent=data.language==='en'?'Map unavailable. Please choose list view.':'지도를 불러오지 못했습니다. 목록 보기를 선택해 주세요.';
script.onload=()=>kakao.maps.load(()=>{
 const center=data.position||data.stores.find(s=>s.location)?.location||{lat:35.2286,lng:126.8436};
 const map=new kakao.maps.Map(document.getElementById('map'),{center:new kakao.maps.LatLng(center.lat,center.lng),level:5});
 for(const store of data.stores){if(!store.location)continue;const point=new kakao.maps.LatLng(store.location.lat,store.location.lng);const marker=new kakao.maps.Marker({map,position:point,title:store.name});kakao.maps.event.addListener(marker,'click',()=>parent.postMessage({type:'galjido-store',id:store.storeId},'*'));if(store.geofenceRadiusM)new kakao.maps.Circle({map,center:point,radius:store.geofenceRadiusM,strokeColor:'#14634f',fillColor:'#14634f',fillOpacity:0.1});}
 if(data.position)new kakao.maps.Marker({map,position:new kakao.maps.LatLng(data.position.lat,data.position.lng),title:data.language==='en'?'My location':'내 위치'});
});document.head.appendChild(script);</script></body></html>`;
  }, [stores, position, key, language]);
  useEffect(() => {
    function message(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.data?.type !== 'galjido-store')
        return;
      const store = stores.find((item) => item.storeId === event.data.id);
      if (store) onSelect(store);
    }
    window.addEventListener('message', message);
    return () => window.removeEventListener('message', message);
  }, [stores, onSelect]);
  if (!key) return <MapUnavailable />;
  return (
    <iframe
      ref={frame}
      title={t('주변 매장 지도. 목록 보기에서도 매장을 선택할 수 있습니다.')}
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin"
      style={{
        border: 0,
        width: '100%',
        height: layout.mapHeight,
        borderRadius: layout.radius,
        background: brandColors.beige,
      }}
    />
  );
}
