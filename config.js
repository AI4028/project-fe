// 백엔드(project-be) 주소. 비워 두면 이 페이지를 제공한 서버를 그대로 사용합니다
// (백엔드를 FRONTEND_DIR 로 실행해 /app/ 에서 열 때).
// 다른 곳에서 열 때 예: 'http://192.168.0.10:8000'
// 주소창에 ?api=http://... 를 붙여 임시로 바꿀 수도 있습니다.
window.GALJIDO_CONFIG = {
  apiBase: '',

  // 카카오맵 JavaScript 키 (developers.kakao.com > [앱] > [플랫폼 키] > [JavaScript 키]).
  // 브라우저에 그대로 노출되는 키라서 넣어도 되지만, [JavaScript SDK 도메인] 에 등록한 주소에서만 동작합니다.
  // [카카오맵] > [사용 설정] > 상태 ON 도 필요합니다.
  // 비워 두면 지도 대신 매장 목록만 보여 줍니다.
  kakaoMapKey: '80ea883fc82a1834063d3bf5c92c1695',
};
