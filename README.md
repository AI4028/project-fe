# Galjido Web Frontend (갈지도)

Accessible web prototype for kiosk ordering. It has two views in one page:

- **Phone view** (스마트폰): for blind, low-vision and physically disabled
  customers. The user picks their disability type and gets a map of nearby
  stores with accessibility info. Arriving at a store leads into connecting to
  the kiosk and ordering by voice or touch, with screen-reader announcements
  and sound feedback.
- **Kiosk view** (키오스크): the store's screen. It shows the pairing token, the
  phone's live cart, incoming orders and help requests, and lets staff mark
  items sold out.

Plain HTML, CSS and JavaScript. There is no build step. The backend is
[project-be](https://github.com/AI4028/project-be).

## Run it for a demo

The backend serves this folder at `/app/`. Clone both repos side by side:

```text
ai4028/
  project-be/
  project-fe/
```

Then, in `project-be` (PowerShell, first time only: seed and make a kiosk key):

```powershell
.\.venv\Scripts\python.exe -m scripts.seed seed\gist-cafe.json
.\.venv\Scripts\python.exe -m scripts.create_kiosk GK01   # prints the kiosk key once; save it

$env:DEMO_MODE = "1"; $env:FRONTEND_DIR = "..\project-fe"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0
```

Open `http://127.0.0.1:8000/app/` on the laptop.

`DEMO_MODE=1` is required. Browsers can't read the kiosk's Bluetooth
broadcast, so the page asks the backend for the pairing token instead. See
"Demo mode" in the project-be README.

### Phones

Phones need **HTTPS** for the microphone and Bluetooth. Put the laptop behind
an HTTPS tunnel, for example
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/):

```powershell
cloudflared tunnel --url http://localhost:8000
```

Open `https://<the-printed-address>/app/`, then press **📷 모바일 QR** to show a QR code
for phones to scan. The QR code is generated from the address you opened, so
it is always current.

### Kiosk view

The kiosk view needs the kiosk key (`ksk_...`). **Never commit it: this repo is
public.** The first time you open the 매장 키오스크 or 분할 시연 tab, the page asks for the
key and saves it in that browser only. You can also open
`/app/?kioskKey=ksk_...` once; the page saves the key and removes it from the
address bar. If the backend rejects the key (for example after
`create_kiosk` was run again), the page forgets it and asks again.

The phone view never needs the key.

## Map (지도)

Flow (project-be `docs/map-flow.md`):

1. **First visit:** the user picks 시각 / 지체 / 휠체어 by button or by voice
   (말로 선택하기). The choice is kept in the `galjido_disability` cookie, so
   later visits open the map directly. 유형 변경 on the map lets them pick again.
2. **Map:** a Kakao map with the user's location and nearby stores
   (`GET /stores/nearby`). The list below the map shows the same stores with
   distance, accessibility and ordering methods, and screen readers read the
   list. Tap a store for details.
3. **Arrival:** inside a store's geofence (`geofenceRadiusM`), the app announces
   arrival. 주문하러 가기 opens the Bluetooth screen, and from there ordering
   works as before. The ← button returns to the map.

The three map types share one screen for now (`data-map-type` on `#map-view`).
How they should differ is still being decided by the team.

### Kakao Maps key (카카오맵 키)

One person on the team does this once and shares the key. Kakao's free map
quota only covers the first app an account turns Kakao Map on for.

1. Sign in at [developers.kakao.com](https://developers.kakao.com) with a
   Kakao account. The first time, it asks you to register as a developer.
2. Open the [app console](https://developers.kakao.com/console/app) →
   **[앱 생성]**. Fill in 앱 이름 (e.g. 갈지도), 회사명, 카테고리 and
   앱 대표 도메인 → **[저장]**. 앱 대표 도메인 must be a real website and rejects
   `localhost`; use e.g. `https://github.com/AI4028/project-fe`. It is only
   informational; the map checks the domains from step 5.
3. In the new app: **[카카오맵] → [사용 설정] → 상태 ON**. Without this, the
   map does not load.
4. **[앱] → [플랫폼 키] → [JavaScript 키]**: copy the key.
5. In the same place, **[JavaScript SDK 도메인]**: add every address you open
   the app from, exactly including the port, e.g. `http://localhost:8000`,
   `http://127.0.0.1:8000` and your HTTPS tunnel address (up to 10).
6. Put the key in [config.js](config.js) → `kakaoMapKey: '...'`.

The JavaScript key is visible to anyone who opens the page; Kakao only accepts
it from the registered domains. A free `trycloudflare.com` tunnel gets a new
address every run, which would have to be registered each time. Use a tunnel
with a fixed address for demos (a named Cloudflare tunnel, or ngrok's free
static domain).

Without a key, the map area shows a notice and the store list still works.

### Testing the map away from the store

- Open `/app/?lat=35.2290&lng=126.8436` to pretend to be at that position.
- On the map, **📍 데모: 매장 앞으로 이동** moves you next to the nearest store,
  which triggers the arrival flow.

### Simulating the beacon

Without the Arduino beacon you can trigger "store detected" by:

- pressing **D** on the keyboard, or
- double-clicking the radar circle on the phone view.

With the beacon, run `hardware/bt_bridge.py` from project-be. Its distance
readings arrive over `/ws/proximity`.

## Backend address

By default the page calls the server it was loaded from. To host the frontend
somewhere else, point it at the backend in one of two ways:

- set `apiBase` in [config.js](config.js), e.g. `'https://api.example.com'`, or
- add `?api=https://...` to the page address (the QR code keeps it).

The backend allows cross-origin calls (`CORS_ORIGINS` in project-be).

## Good to know

- **One phone per kiosk.** If another phone connected in the last 10 minutes,
  a second phone gets "kiosk busy" and falls back to an offline session that
  doesn't reach the backend. To free the kiosk, end the session from the kiosk
  view or wait 10 minutes.
- Menu photos are 640×640 JPEGs in `assets/menu/`.
- `vendor/qrcode.js` is [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
  1.4.4 (MIT). It is bundled so QR codes work offline.

## Structure

```text
index.html        # Both views, modals
styles.css
map.css           # Disability-type choice and map screens
config.js         # Backend address (apiBase), Kakao Maps key
app.js            # App logic: API calls, WebSockets, phone and kiosk views
map.js            # Disability-type choice, map, nearby stores, arrival
speech.js         # Speech recognition and TTS (Korean)
audio.js          # Sound feedback
vendor/qrcode.js  # QR code generator
assets/menu/      # Menu photos
```
