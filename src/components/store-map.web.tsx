import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { Text } from './ui/text';
import type { StoreMapProps } from './store-map';
export default function StoreMap({ stores, position, onSelect }: StoreMapProps) {
  const key = process.env.EXPO_PUBLIC_KAKAO_MAP_KEY;
  const frame = useRef<HTMLIFrameElement>(null);
  // Data is JSON-escaped before embedding; store names are assigned with text APIs.
  const html = useMemo(() => {
    const data = JSON.stringify({ stores, position, key }).replace(/</g, '\\u003c');
    return `<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#map{height:100%;margin:0;font-family:sans-serif}p{padding:20px}</style></head><body><div id="map"></div><script>
const data=${data};
const script=document.createElement('script');
script.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey='+encodeURIComponent(data.key);
script.onerror=()=>document.getElementById('map').textContent='지도를 불러오지 못했습니다. 아래 매장 목록을 이용해 주세요.';
script.onload=()=>kakao.maps.load(()=>{
 const center=data.position||data.stores.find(s=>s.location)?.location||{lat:35.2286,lng:126.8436};
 const map=new kakao.maps.Map(document.getElementById('map'),{center:new kakao.maps.LatLng(center.lat,center.lng),level:5});
 for(const store of data.stores){if(!store.location)continue;const point=new kakao.maps.LatLng(store.location.lat,store.location.lng);const marker=new kakao.maps.Marker({map,position:point,title:store.name});kakao.maps.event.addListener(marker,'click',()=>parent.postMessage({type:'galjido-store',id:store.storeId},'*'));if(store.geofenceRadiusM)new kakao.maps.Circle({map,center:point,radius:store.geofenceRadiusM,strokeColor:'#14634f',fillColor:'#14634f',fillOpacity:0.1});}
 if(data.position)new kakao.maps.Marker({map,position:new kakao.maps.LatLng(data.position.lat,data.position.lng),title:'내 위치'});
});document.head.appendChild(script);</script></body></html>`;
  }, [stores, position, key]);
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
  if (!key)
    return (
      <View className="h-40 justify-center rounded-lg bg-secondary p-6">
        <Text>지도 연결 전에는 아래 매장 목록으로 위치와 접근성 정보를 확인할 수 있습니다.</Text>
      </View>
    );
  return (
    <iframe
      ref={frame}
      title="주변 매장 지도. 같은 정보는 아래 목록에서 확인할 수 있습니다."
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin"
      style={{ border: 0, width: '100%', height: 300, borderRadius: 16 }}
    />
  );
}
