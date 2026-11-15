import { useEffect, useMemo, useRef } from 'react';
import { MapUnavailable } from './map-unavailable';
import { useTranslation } from '@/lib/i18n';
import { directoryPlaces } from '@/lib/navigation';
import { layout } from '@/lib/theme';
import type { StoreMapProps } from './store-map';

export default function StoreMap({
  stores,
  position,
  onSelect,
  fill,
  query = '',
  onPlaces,
  showDirectory = true,
}: StoreMapProps) {
  const key = process.env.EXPO_PUBLIC_KAKAO_MAP_KEY;
  const frame = useRef<HTMLIFrameElement>(null);
  const results = useRef<ReturnType<typeof directoryPlaces>>([]);
  const { language } = useTranslation();
  const html = useMemo(() => {
    const data = JSON.stringify({ stores, position, key, query, language, showDirectory }).replace(
      /</g,
      '\\u003c',
    );
    return `<!doctype html><html lang="${language}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#map{height:100%;margin:0;font-family:sans-serif}#error{position:absolute;inset:20px;background:white;padding:16px;z-index:10}</style><div id="map"></div><script>
const data=${data};
const send=(type,payload)=>parent.postMessage({type,...payload},'*');
const fail=()=>{const e=document.createElement('p');e.id='error';e.textContent=data.language==='en'?'Map unavailable. Use list view or search in a map app.':'지도를 불러오지 못했어요. 목록이나 지도 앱 검색을 이용하세요.';document.body.appendChild(e);};
const script=document.createElement('script');script.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&libraries=services&appkey='+encodeURIComponent(data.key);script.onerror=fail;
const timeout=setTimeout(fail,15000);
script.onload=()=>{if(!window.kakao?.maps){fail();return;}kakao.maps.load(()=>{
clearTimeout(timeout);
const center=data.position||data.stores.find(s=>s.location)?.location||{lat:37.5445,lng:127.056};
const map=new kakao.maps.Map(document.getElementById('map'),{center:new kakao.maps.LatLng(center.lat,center.lng),level:5});
const add=(point,name,id)=>{const marker=new kakao.maps.Marker({map,position:point,title:name});kakao.maps.event.addListener(marker,'click',()=>send('galjido-store',{id}));};
data.stores.forEach(store=>{if(store.location)add(new kakao.maps.LatLng(store.location.lat,store.location.lng),store.name,store.storeId);});
if(data.position)add(new kakao.maps.LatLng(center.lat,center.lng),data.language==='en'?'My location':'내 위치','user');
new ResizeObserver(()=>{map.relayout();}).observe(document.getElementById('map'));
if(data.showDirectory && kakao.maps.services){const places=new kakao.maps.services.Places();const callback=(items,status)=>{
 if(status===kakao.maps.services.Status.OK){send('galjido-places',{items});const bounds=new kakao.maps.LatLngBounds();items.forEach(item=>{const point=new kakao.maps.LatLng(Number(item.y),Number(item.x));bounds.extend(point);add(point,item.place_name,'place:'+item.id);});if(data.query)map.setBounds(bounds);}
 else send('galjido-places',{items:[]});
};
if(data.query)places.keywordSearch(data.query,callback,{location:new kakao.maps.LatLng(center.lat,center.lng),size:15});
else places.categorySearch('CE7',callback,{location:new kakao.maps.LatLng(center.lat,center.lng),radius:2000,size:15});}
});};document.head.appendChild(script);</script></html>`;
  }, [stores, position, key, query, language, showDirectory]);
  useEffect(() => {
    function message(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'galjido-places') {
        results.current = directoryPlaces(event.data.items);
        onPlaces?.(results.current);
      }
      if (event.data?.type === 'galjido-store') {
        const store = [...stores, ...results.current].find(
          (item) => item.storeId === event.data.id,
        );
        if (store) onSelect(store);
      }
    }
    window.addEventListener('message', message);
    return () => window.removeEventListener('message', message);
  }, [stores, onSelect, onPlaces]);
  if (!key) return <MapUnavailable />;
  return (
    <iframe
      ref={frame}
      title={
        language === 'en'
          ? 'Nearby places map. List view offers the same place actions.'
          : '주변 장소 지도. 목록에서도 장소를 선택할 수 있어요.'
      }
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin"
      style={{ border: 0, width: '100%', height: fill ? '100%' : layout.mapHeight }}
    />
  );
}
