# App flow

## Customer

1. **Profile.** Pick 시각 / 지체 / 휠체어 by voice or touch. It is remembered; 유형 변경 changes it.
2. **Find a store.** With location allowed, the map shows nearby stores and arrival
   announcements. Without it, the full accessible list still works. Unknown access info reads 확인 필요.
3. **Connect.** Enter the kiosk ID and the rotating 8-character code, or scan its QR link.
   The phone and kiosk must use the same API server.
4. **Order.** Pick options and quantity, edit the cart, call staff if needed.
   Totals come from the server; payment happens at the counter or kiosk.
5. **Track.** Follow the live status and cancel before staff accepts.

## Kiosk

Shows the live cart and help requests, moves orders forward and marks items sold out.
Open it on `/kiosk` in a second window or device.

## Voice commands

Menu names with quantities (아메리카노 아이스 두 잔), options, 담기, 장바구니, 직원 호출,
메뉴 읽어줘, 다시 듣기, 연결 종료.

Ordering always opens a review dialog first. When speech is unavailable or denied,
touch and the OS screen reader still work. High contrast, larger text and spoken
guidance are in settings.

## Screens

| Route                  | Screen                               |
| ---------------------- | ------------------------------------ |
| `_layout.tsx`          | providers, theme, stack, portal host |
| `index.tsx`            | nearby-store map and accessible list |
| `onboarding.tsx`       | accessibility profile                |
| `store.tsx`            | store details                        |
| `connect.tsx`          | pairing code, QR, demo proximity     |
| `guide.tsx`            | indoor and accessibility guidance    |
| `menu/index.tsx`       | categories, menu, availability       |
| `menu/[itemId].tsx`    | options and quantity                 |
| `cart.tsx`             | server-priced cart and confirmation  |
| `orders/[orderId].tsx` | order tracking and cancellation      |
| `kiosk.tsx`            | staff console                        |
| `settings.tsx`         | accessibility and API address        |
