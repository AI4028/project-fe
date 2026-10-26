# Galjido Web Frontend (갈지도)

Accessible web prototype for kiosk ordering. It has two views in one page:

- **Phone view** (스마트폰): for blind and low-vision customers. It detects the
  store, connects to the kiosk, and lets the customer order by voice or touch,
  with screen-reader announcements and sound feedback.
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
config.js         # Backend address (apiBase)
app.js            # App logic: API calls, WebSockets, phone and kiosk views
speech.js         # Speech recognition and TTS (Korean)
audio.js          # Sound feedback
vendor/qrcode.js  # QR code generator
assets/menu/      # Menu photos
```
