# App flow

## Customer

1. **Discover first.** Search by name/address or optionally use location. Filter
   for confirmed access features and switch between list and map without losing
   the search. A map pin previews the store before opening its details.
   Accessibility preferences are available through settings and onboarding.
2. **Find a store.** With location allowed, the map shows nearby stores and arrival
   announcements. Without it, the full accessible list still works. Unknown access info reads 확인 필요.
3. **Choose.** Order Now opens the selected store's menu. Adding the first item
   creates a store-scoped cart with prices from the server. QR or kiosk code
   pairing remains available as another entry point.
4. **Order.** Pick options and quantity, edit the cart, and review the current
   quote. Payment happens at the counter or kiosk. Directions are available
   before and after ordering.
5. **Track.** Follow the live status and cancel before staff accepts.

The [Block 1 release reference](design-direction.md#block-1-release-reference)
covers checkout, guidance, staff help, language and their acceptance checks.

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

The four primary destinations are Home, Orders, Favorites and Settings. On the
map, the search button expands into a focused field; map/list controls stay
compact. Place previews offer Directions, Save and store-specific menu access.
Saved items persist per API origin. Orders shows the current cart and the
device's recent server-confirmed orders. Ordering-service errors appear
as dismissible notices with a separate retry action, without a bottom error bar.

| Route                  | Screen                               |
| ---------------------- | ------------------------------------ |
| `_layout.tsx`          | providers, theme, stack, portal host |
| `index.tsx`            | nearby-store map and accessible list |
| `accessibility.tsx`    | nearby public accessibility records  |
| `saved.tsx`            | saved places and place actions       |
| `orders/index.tsx`     | current cart and latest order        |
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

## Usage Settings and device permissions

First-time setup offers language, contrast, text size and map view. Location at
startup is opt-in. Customers can browse and search after denying location.
Voice commands and automatic spoken guidance are independent accessibility
preferences. Customers can also request an individual reading.

The app announces changes to the tracked order while it is open. Pickup
vibration has its own setting and fires when that order changes to ready.
Reading an already-ready order at startup is silent. The permissions page checks
available status without requesting access. Voice input and nearby search request
their respective permissions when used.

Venue registration and accessibility news are optional links to public HTTPS
forms. Set the GitHub Actions variables `STORE_REGISTRATION_URL` and
`ACCESSIBILITY_NEWS_URL` when those forms exist. For a local build, prefix each
name with `EXPO_PUBLIC_`. The form handles signup and consent.
