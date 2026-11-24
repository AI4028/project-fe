# Backend integration

Use a backend with migration `0004` and code-free store ordering.
For an existing unversioned database, follow its `docs/migrations.md` adoption steps.

- Checkout sends the latest server quote after comparing the reviewed prices.
- Before POST, the exact items, note, payment choice and quote are saved locally.
- Each session uses a stable `Idempotency-Key`. Recovery checks for an order,
  then replays the saved request when necessary. It never creates a fresh request
  while the previous result is unknown.
- Old pending records without a saved body remain blocked for staff verification.
- Staff refreshes use `/kiosk/state`, including current stock. Events received
  during a refresh trigger another refresh. Phone refreshes also reload stock.
- Adding the first cart item opens a store-scoped session. The store must have a
  configured staff kiosk to receive orders. That kiosk's paired session slot
  remains available. QR and kiosk codes offer a separate pairing path. Live BLE
  navigation is outside the current release.
- Phone order history is scoped to the device. Staff receives and acknowledges
  post-order help through the store's staff queue.

Still requires real-world acceptance: VoiceOver/TalkBack, microphone/location
permissions, cafe data verification, and Bluetooth hardware. Payment choices
record where the customer will pay in person. Online payment and push
notifications are separate integrations.
