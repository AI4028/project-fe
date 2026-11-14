# Backend integration

Use backend branch `feature/backend-readiness`, with migration `0002` applied.
For an existing unversioned database, follow its `docs/migrations.md` adoption steps.

- Checkout sends the latest server quote after comparing the reviewed prices.
- Before POST, the exact items, note, payment choice and quote are saved locally.
- Each session uses a stable `Idempotency-Key`. Recovery checks for an order,
  then replays the saved request when necessary. It never creates a fresh request
  while the previous result is unknown.
- Old pending records without a saved body remain blocked for staff verification.
- Staff refreshes use `/kiosk/state`, including current stock. Events received
  during a refresh trigger another refresh. Phone refreshes also reload stock.

Still requires real-world acceptance: VoiceOver/TalkBack, microphone/location
permissions, cafe data verification, and Bluetooth hardware. Online payments,
push notifications and post-order help are separate product extensions; the
current app uses counter/kiosk payment and direct staff guidance after ordering.
