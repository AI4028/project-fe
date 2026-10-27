/**
 * map.js - 장애 유형 선택 → 유형별 지도 (project-be docs/map-flow.md)
 *
 * 1. 첫 화면: 시각 / 지체 / 휠체어 중 하나를 버튼이나 음성으로 고르면 쿠키에 저장.
 *    다음부터는 바로 지도로 시작.
 * 2. 지도 화면: 카카오맵 + 내 위치 + 주변 매장 (GET /stores/nearby).
 *    매장의 지오펜스(geofenceRadiusM) 안에 들어오면 도착 안내 →
 *    블루투스 탐색 / 주문 화면(app.js)으로 이어짐.
 *
 * 세 지도의 차이는 팀에서 정하는 중이라, 지금은 공통 화면에 data-map-type 만 다릅니다.
 */
(function () {
  'use strict';

  const COOKIE_NAME = 'galjido_disability';
  const TYPES = {
    visual: { name: '시각', mapTitle: '시각 지도' },
    physical: { name: '지체', mapTitle: '지체 지도' },
    wheelchair: { name: '휠체어', mapTitle: '휠체어 지도' },
  };
  const SEARCH_RADIUS_M = 3000;
  const REFETCH_AFTER_MOVE_M = 100; // 이만큼 움직이면 주변 매장을 서버에서 다시 조회
  const GIST = { lat: 35.2286, lng: 126.8436 }; // 위치를 모를 때 지도 중심

  const ORDERING_METHOD_NAMES = {
    kiosk: '키오스크',
    phone: '스마트폰 주문',
    staff: '직원 주문',
    qr: 'QR 주문',
    table: '테이블 주문',
  };

  const $ = (id) => document.getElementById(id);
  const app = () => window.galjido; // app.js 가 먼저 로드됨

  const state = {
    type: null,
    position: null, // { lat, lng, accuracy, simulated }
    fetchedAt: null, // 마지막으로 매장을 조회한 위치
    stores: [],
    loading: false,
    loadError: false,
    introSpeaking: false,
    pendingSpeech: null,
    arrivedIds: new Set(), // 도착 안내를 이미 한 매장
    nearestAnnounced: false,
    watchId: null,
    kakaoMap: null,
    mapReady: null,
    overlays: [],
    myLocationOverlay: null,
    centeredOnUser: false,
    sheetReturnFocus: null,
  };

  // ---------- 장애 유형 (쿠키) ----------

  function readType() {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([a-z]+)`));
    return match && TYPES[match[1]] ? match[1] : null;
  }

  function saveType(type) {
    document.cookie = `${COOKIE_NAME}=${type}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
  }

  function clearType() {
    document.cookie = `${COOKIE_NAME}=; max-age=0; path=/; SameSite=Lax`;
  }

  // 음성으로 들은 말에서 장애 유형 찾기 ("휠체어 타요", "앞이 잘 안 보여요", "다리가 불편해요")
  function typeFromSpeech(text) {
    const t = (text || '').replace(/\s+/g, '');
    if (/휠체어|휠/.test(t)) return 'wheelchair';
    if (/시각|시력|맹인|전맹|눈|안보|보이지|앞이/.test(t)) return 'visual';
    if (/지체|다리|걷|거동|목발|팔|몸/.test(t)) return 'physical';
    return null;
  }

  // ---------- 화면 전환 ----------

  function hideScreens() {
    ['onboarding-view', 'map-view', 'galjido-discovery-view'].forEach(id => {
      const el = $(id);
      if (el) el.style.display = 'none';
    });
  }

  function showOnboarding() {
    hideScreens();
    $('onboarding-view').style.display = 'flex';
    $('onboarding-voice-status').textContent = '';
    app().announce('갈지도입니다. 어떤 도움이 필요하세요? 시각, 지체, 휠체어 중에서 고르시거나, 말로 선택하기 버튼을 누르고 말씀해 주세요.');
  }

  function chooseType(type) {
    state.type = type;
    saveType(type);
    if (window.soundFeedback) window.soundFeedback.tick();
    showMap();
  }

  function showMap() {
    hideScreens();
    const view = $('map-view');
    view.style.display = 'flex';
    view.dataset.mapType = state.type;
    $('map-type-label').textContent = TYPES[state.type].mapTitle;
    state.nearestAnnounced = false;

    sayIntro(`${TYPES[state.type].mapTitle}입니다. 주변 매장을 찾고 있어요.`);
    startLocation();
    initMap().then(map => {
      if (!map) return;
      map.relayout(); // 숨겨져 있던 지도는 크기를 다시 계산해야 함
      centerMap();
    });
    if (!state.stores.length && !state.loading) loadStores();
    else render();
  }

  // 화면 안내 → 그다음 안내 순서로 읽기 (새 안내가 읽던 안내를 끊지 않도록)
  function sayIntro(text) {
    state.introSpeaking = true;
    const done = () => {
      if (!state.introSpeaking) return;
      state.introSpeaking = false;
      if (state.pendingSpeech) {
        const next = state.pendingSpeech;
        state.pendingSpeech = null;
        app().announce(next);
      }
    };
    app().announce(text, { onEnd: done });
    setTimeout(done, 4000); // 음성 안내가 꺼져 있으면 onEnd 가 오지 않음
  }

  function sayAfterIntro(text) {
    if (state.introSpeaking) state.pendingSpeech = text;
    else app().announce(text);
  }

  function goOrder() {
    closeSheet();
    app().showDiscovery();
  }

  // ---------- 위치 ----------

  // 데모: ?lat=35.2286&lng=126.8436 으로 위치를 정할 수 있음
  function positionFromUrl() {
    const params = new URLSearchParams(location.search);
    const lat = parseFloat(params.get('lat'));
    const lng = parseFloat(params.get('lng'));
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, accuracy: 0, simulated: true } : null;
  }

  function startLocation() {
    if (state.position && state.position.simulated) return;
    const fromUrl = positionFromUrl();
    if (fromUrl) {
      setPosition(fromUrl);
      return;
    }
    if (state.watchId !== null) return;
    if (!navigator.geolocation) {
      setLocationStatus('이 브라우저는 위치 정보를 지원하지 않아요');
      return;
    }
    setLocationStatus('내 위치를 찾는 중…');
    state.watchId = navigator.geolocation.watchPosition(
      pos => {
        if (state.position && state.position.simulated) return;
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      },
      err => {
        if (state.position) return;
        setLocationStatus(err.code === err.PERMISSION_DENIED ? '위치 권한이 꺼져 있어요' : '위치를 찾지 못했어요');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }

  function setPosition(position) {
    state.position = position;
    setLocationStatus(position.simulated ? '데모 위치' : `내 위치 · 오차 약 ${Math.round(position.accuracy)}m`);
    drawMyLocation();

    const moved = state.fetchedAt ? distanceM(state.fetchedAt, position) : Infinity;
    if (moved >= REFETCH_AFTER_MOVE_M) {
      loadStores();
    } else {
      updateDistances();
      render();
    }
  }

  function setLocationStatus(text) {
    $('location-status').textContent = text;
  }

  // 두 지점 사이 거리 (m). 백엔드 app/logic.py 의 distance_m 과 같은 계산
  function distanceM(a, b) {
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(h));
  }

  // ---------- 매장 ----------

  async function loadStores() {
    if (state.loading) return; // 다음 위치 갱신 때 다시 조회됨
    state.loading = true;
    const p = state.position;
    const path = p ? `/stores/nearby?lat=${p.lat}&lng=${p.lng}&radiusM=${SEARCH_RADIUS_M}` : '/stores';
    try {
      const res = await fetch(app().apiBase + path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.stores = await res.json();
      state.loadError = false;
      state.fetchedAt = p;
    } catch (err) {
      console.warn('주변 매장을 불러오지 못했어요:', err);
      state.loadError = true;
    } finally {
      state.loading = false;
    }
    updateDistances();
    render();
  }

  // 서버 조회 사이에도 걸을 때마다 거리와 도착 여부를 바로 갱신
  function updateDistances() {
    const p = state.position;
    if (p) {
      state.stores.forEach(store => {
        if (!store.location) return;
        store.distanceM = Math.round(distanceM(p, store.location));
        store.insideGeofence = store.geofenceRadiusM != null && store.distanceM <= store.geofenceRadiusM;
      });
      state.stores.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
    }
    checkArrival();
  }

  function checkArrival() {
    state.stores.forEach(store => {
      if (!store.insideGeofence) state.arrivedIds.delete(store.storeId); // 벗어나면 다음에 다시 안내
    });
    const arrived = state.stores.find(store => store.insideGeofence);
    if (!arrived) {
      $('arrival-banner').style.display = 'none';
      return;
    }
    if (state.arrivedIds.has(arrived.storeId) || $('map-view').style.display === 'none') return;
    state.arrivedIds.add(arrived.storeId);

    $('arrival-text').textContent = `${arrived.name}에 도착했어요`;
    $('arrival-banner').style.display = 'block';
    if (window.soundFeedback) window.soundFeedback.beaconFound();
    app().announce(`${arrived.name} 근처에 도착했어요. 주문하러 가기 버튼을 누르면 매장 연결을 시작합니다.`, { priority: 'high' });
  }

  function formatDistance(m) {
    if (m == null) return '';
    return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
  }

  function spokenDistance(m) {
    if (m == null) return '';
    return m < 1000 ? `${m}미터` : `${(m / 1000).toFixed(1)}킬로미터`;
  }

  // 아직 확인 안 된 정보는 'TODO…' 로 들어 있음 → 사용자에게는 '확인 필요'
  function knownText(text) {
    return text && !/^TODO/i.test(text.trim()) ? text : null;
  }

  // 목록에 보일 짧은 접근성 요약. tone: good | warn | unknown
  function accessibilityChips(store) {
    const a = store.accessibility || {};
    const chips = [];
    if (typeof a.floor === 'number') chips.push({ text: `${a.floor}층`, tone: 'neutral' });
    if (a.stepFreeEntrance === true) chips.push({ text: '턱 없는 입구', tone: 'good' });
    else if (a.stepFreeEntrance === false) chips.push({ text: '입구에 턱 있음', tone: 'warn' });
    else chips.push({ text: '입구 정보 확인 필요', tone: 'unknown' });
    if (a.automaticDoor === true) chips.push({ text: '자동문', tone: 'good' });
    if (a.elevator === true) chips.push({ text: '엘리베이터', tone: 'good' });
    else if (a.elevator === false && a.floor > 1) chips.push({ text: '엘리베이터 없음', tone: 'warn' });
    return chips;
  }

  function orderingMethodsText(store) {
    return (store.orderingMethods || []).map(m => ORDERING_METHOD_NAMES[m] || m).join(', ');
  }

  // ---------- 그리기: 목록 ----------

  function render() {
    renderList();
    renderMarkers();
  }

  function renderList() {
    const list = $('store-list');
    list.textContent = '';

    if (!state.stores.length) {
      const li = document.createElement('li');
      li.className = 'gj-store-empty';
      li.textContent = state.loadError
        ? '매장 정보를 불러오지 못했어요. 서버 연결을 확인해 주세요.'
        : `주변 ${formatDistance(SEARCH_RADIUS_M)} 안에 등록된 매장이 없어요.`;
      list.appendChild(li);
      return;
    }

    state.stores.forEach(store => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gj-store-item' + (store.insideGeofence ? ' arrived' : '');

      const head = document.createElement('span');
      head.className = 'gj-store-head';
      const name = document.createElement('strong');
      name.className = 'gj-store-name';
      name.textContent = store.name;
      head.appendChild(name);
      if (store.distanceM != null) {
        const dist = document.createElement('span');
        dist.className = 'gj-store-distance';
        dist.textContent = store.insideGeofence ? '도착' : formatDistance(store.distanceM);
        head.appendChild(dist);
      }

      const chipRow = document.createElement('span');
      chipRow.className = 'gj-chips';
      accessibilityChips(store).forEach(chip => {
        const el = document.createElement('span');
        el.className = `gj-chip ${chip.tone}`;
        el.textContent = chip.text;
        chipRow.appendChild(el);
      });

      const methods = document.createElement('span');
      methods.className = 'gj-store-methods';
      methods.textContent = orderingMethodsText(store) ? `주문: ${orderingMethodsText(store)}` : '';

      btn.append(head, chipRow, methods);
      btn.setAttribute('aria-label', storeSummary(store));
      btn.addEventListener('click', () => openSheet(store, btn));
      li.appendChild(btn);
      list.appendChild(li);
    });

    if (!state.nearestAnnounced && state.stores[0] && state.stores[0].distanceM != null && $('map-view').style.display !== 'none') {
      state.nearestAnnounced = true;
      const nearest = state.stores[0];
      if (!nearest.insideGeofence) {
        sayAfterIntro(`가장 가까운 매장은 ${nearest.name}, ${spokenDistance(nearest.distanceM)}입니다.`);
      }
    }
  }

  // 스크린 리더가 읽을 한 줄 요약
  function storeSummary(store) {
    const parts = [store.name];
    if (store.insideGeofence) parts.push('도착');
    else if (store.distanceM != null) parts.push(spokenDistance(store.distanceM));
    parts.push(accessibilityChips(store).map(c => c.text).join(', '));
    if (orderingMethodsText(store)) parts.push(`주문 방법 ${orderingMethodsText(store)}`);
    return parts.join('. ');
  }

  // ---------- 매장 상세 시트 ----------

  function yesNo(value) {
    if (value === true) return '있음';
    if (value === false) return '없음';
    return '확인 필요';
  }

  function openSheet(store, returnFocusTo) {
    state.sheetReturnFocus = returnFocusTo || null;
    const a = store.accessibility || {};
    const k = store.kioskFeatures || {};

    $('sheet-title').textContent = store.name;
    $('sheet-meta').textContent = [
      store.insideGeofence ? '도착' : formatDistance(store.distanceM),
      store.address,
    ].filter(Boolean).join(' · ');

    const facts = [
      ['층', typeof a.floor === 'number' ? `${a.floor}층` : '확인 필요'],
      ['턱 없는 입구', yesNo(a.stepFreeEntrance)],
      ['자동문', yesNo(a.automaticDoor)],
      ['엘리베이터', yesNo(a.elevator)],
      ['장애인 화장실', yesNo(a.accessibleRestroom)],
      ['주문 방법', orderingMethodsText(store) || '확인 필요'],
      ['키오스크 음성 안내', yesNo(k.audioGuide)],
      ['낮은 키오스크 화면', yesNo(k.lowPositionScreen)],
      ['화면 확대', yesNo(k.screenMagnifier)],
      ['고대비 화면', yesNo(k.highContrast)],
    ];
    const notes = knownText(a.notes);
    if (notes) facts.push(['참고', notes]);

    const dl = $('sheet-facts');
    dl.textContent = '';
    facts.forEach(([label, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      if (value === '확인 필요') dd.className = 'unknown';
      dl.append(dt, dd);
    });

    const directions = knownText(store.indoorDirections);
    $('sheet-directions').textContent = directions ? `매장 안내: ${directions}` : '';
    $('sheet-directions').style.display = directions ? 'block' : 'none';

    $('store-sheet').style.display = 'flex';
    $('sheet-title').focus();
    app().announce(`${storeSummary(store)}. 아래로 내리면 자세한 정보와 주문 버튼이 있어요.`);
  }

  function closeSheet() {
    if ($('store-sheet').style.display === 'none') return;
    $('store-sheet').style.display = 'none';
    if (state.sheetReturnFocus) state.sheetReturnFocus.focus();
    state.sheetReturnFocus = null;
  }

  // ---------- 카카오맵 ----------

  function loadKakaoSdk(key) {
    return new Promise((resolve, reject) => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(resolve);
        return;
      }
      const script = document.createElement('script');
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
      script.onload = () => {
        if (window.kakao && window.kakao.maps) window.kakao.maps.load(resolve);
        else reject(new Error('카카오맵 SDK 가 로드되지 않았어요'));
      };
      script.onerror = () => reject(new Error('카카오맵 SDK 를 받지 못했어요'));
      document.head.appendChild(script);
    });
  }

  function showMapFallback(text) {
    $('kakao-map').style.display = 'none';
    $('btn-my-location').style.display = 'none';
    $('map-fallback').textContent = text;
    $('map-fallback').style.display = 'flex';
  }

  function initMap() {
    if (state.mapReady) return state.mapReady;
    const key = ((window.GALJIDO_CONFIG || {}).kakaoMapKey || '').trim();
    if (!key) {
      showMapFallback('카카오맵 키가 없어서 지도 대신 매장 목록만 보여 드려요. (config.js 의 kakaoMapKey)');
      state.mapReady = Promise.resolve(null);
      return state.mapReady;
    }
    state.mapReady = loadKakaoSdk(key)
      .then(() => {
        const center = state.position || GIST;
        state.kakaoMap = new kakao.maps.Map($('kakao-map'), {
          center: new kakao.maps.LatLng(center.lat, center.lng),
          level: 4,
        });
        render();
        drawMyLocation();
        return state.kakaoMap;
      })
      .catch(err => {
        console.warn('카카오맵 오류:', err);
        showMapFallback('카카오맵을 불러오지 못했어요. 앱 키와 등록된 도메인을 확인해 주세요. 매장 목록은 아래에 있어요.');
        return null;
      });
    return state.mapReady;
  }

  function renderMarkers() {
    const map = state.kakaoMap;
    if (!map) return;
    state.overlays.forEach(overlay => overlay.setMap(null));
    state.overlays = [];

    state.stores.forEach(store => {
      if (!store.location) return;
      const position = new kakao.maps.LatLng(store.location.lat, store.location.lng);
      if (store.geofenceRadiusM) {
        state.overlays.push(new kakao.maps.Circle({
          map,
          center: position,
          radius: store.geofenceRadiusM,
          strokeWeight: 2,
          strokeColor: '#2563EB',
          strokeOpacity: 0.7,
          fillColor: '#2563EB',
          fillOpacity: 0.12,
        }));
      }
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.tabIndex = -1; // 키보드·스크린 리더는 목록을 사용
      marker.className = 'gj-marker' + (store.insideGeofence ? ' arrived' : '');
      marker.textContent = store.name;
      marker.addEventListener('click', () => openSheet(store));
      state.overlays.push(new kakao.maps.CustomOverlay({
        map,
        position,
        content: marker,
        yAnchor: 1.3,
        clickable: true,
      }));
    });
  }

  function drawMyLocation() {
    const map = state.kakaoMap;
    const p = state.position;
    if (!map || !p) return;
    const position = new kakao.maps.LatLng(p.lat, p.lng);
    if (!state.myLocationOverlay) {
      const dot = document.createElement('div');
      dot.className = 'gj-my-location';
      state.myLocationOverlay = new kakao.maps.CustomOverlay({ map, position, content: dot, zIndex: 10 });
    } else {
      state.myLocationOverlay.setPosition(position);
    }
    if (!state.centeredOnUser) {
      state.centeredOnUser = true;
      map.setCenter(position);
    }
  }

  function centerMap() {
    const map = state.kakaoMap;
    if (!map) return;
    const center = state.position || (state.stores[0] && state.stores[0].location) || GIST;
    map.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
  }

  // ---------- 데모 ----------

  // 가장 가까운 매장 바로 앞(약 10m)으로 위치를 옮겨 도착 흐름을 보여 줌
  function moveToStoreForDemo() {
    const store = state.stores.find(s => s.location);
    if (!store) {
      app().showToast('위치가 등록된 매장이 없어요.', 'info');
      return;
    }
    setPosition({ lat: store.location.lat - 0.00009, lng: store.location.lng, accuracy: 0, simulated: true });
    centerMap();
  }

  // ---------- 시작 ----------

  function bindEvents() {
    document.querySelectorAll('.gj-type-btn').forEach(btn => {
      btn.addEventListener('click', () => chooseType(btn.dataset.type));
    });

    $('btn-onboarding-voice').addEventListener('click', () => {
      const status = $('onboarding-voice-status');
      if (!window.speechService || !window.speechService.sttSupported) {
        status.textContent = '이 브라우저는 음성 인식을 지원하지 않아요. 버튼으로 골라 주세요.';
        app().announce(status.textContent);
        return;
      }
      status.textContent = '듣고 있어요… "시각", "지체", "휠체어"처럼 말씀해 주세요.';
      window.speechService.listenOnce(text => {
        const type = typeFromSpeech(text);
        if (type) {
          status.textContent = `"${text}" → ${TYPES[type].name}`;
          chooseType(type);
        } else {
          status.textContent = text
            ? `"${text}"는 잘 모르겠어요. 다시 말씀하시거나 버튼을 눌러 주세요.`
            : '말씀을 듣지 못했어요. 다시 눌러 주세요.';
          app().announce(status.textContent);
        }
      });
    });

    $('btn-change-type').addEventListener('click', () => {
      clearType();
      state.type = null;
      showOnboarding();
    });

    $('btn-my-location').addEventListener('click', () => {
      if (!state.position) startLocation();
      state.centeredOnUser = false;
      drawMyLocation();
      centerMap();
    });

    $('btn-arrival-order').addEventListener('click', goOrder);
    $('btn-sheet-order').addEventListener('click', goOrder);
    $('btn-sheet-close').addEventListener('click', closeSheet);
    $('store-sheet').addEventListener('click', e => {
      if (e.target === $('store-sheet')) closeSheet(); // 바깥(배경) 누르면 닫기
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSheet();
    });
    $('btn-demo-location').addEventListener('click', moveToStoreForDemo);

    $('btn-back-to-map').addEventListener('click', () => {
      if (state.type) showMap();
      else showOnboarding();
    });
  }

  function init() {
    bindEvents();
    state.type = readType();
    if (state.type) showMap();
    else showOnboarding();
  }

  window.addEventListener('DOMContentLoaded', init);
})();
