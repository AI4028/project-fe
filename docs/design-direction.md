# Design direction

2026-11-15 · discovery and ordering redesign

## References and decisions

This is an original Galjido interface; reference brands supply principles, not
logos, proprietary fonts, or copied screens.

| Reference                                                                                     | Principle applied                                                                                   |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [Apple: layout](https://developer.apple.com/design/human-interface-guidelines/layout)         | Put the main task first; reveal supporting detail when needed; adapt to window and text sizes.      |
| [Apple: typography](https://developer.apple.com/design/human-interface-guidelines/typography) | A restrained type hierarchy, readable body text, and scalable labels.                               |
| [OpenAI: brand](https://openai.com/brand/)                                                    | Typographic clarity and a balance of precision and warmth.                                          |
| [Linear: UI redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)                 | Reduce competing chrome; align navigation and surfaces consistently.                                |
| [Pretendard](https://github.com/orioncactus/pretendard)                                       | A locally bundled cross-platform Korean/Latin family with real regular, semibold, and bold weights. |

## Visual language

- Keep the walnut identity, warm paper background, and white content surfaces.
- Reserve the solid primary fill for the main action or active filter.
- Use quiet separators, 16–24 point corners, and deliberate space between groups.
- Use 32/24/20 point headings and 16 point body text, with 14 point supporting text.
- Keep system font scaling and the app's 1.3× large-text setting. Never truncate
  essential store names, prices, or action labels to make a layout fit.
- Keep high contrast token-driven, Korean accessibility labels, keyboard focus
  indicators, and a minimum 48 point touch target.

## Customer flow

1. **Discover.** Search by store name/address immediately. Filter for a confirmed
   step-free entrance or accessible restroom. Unknown information never qualifies.
   Location is optional and only requested after choosing the nearby action.
2. **Compare.** List and map share the query and filters. A map pin selects a
   preview; opening details is a separate action. List mode works without maps.
3. **Inspect.** Store details lead with address and accessibility. Menu preview is
   the persistent next step; customers already on site can connect immediately.
4. **Connect.** Enter codes, then show store verification as a separate stage.
   Retain explicit confirmation, mismatched-store rejection, and busy recovery.
5. **Choose.** Compact menu cards show name, price, availability and real menu
   imagery where available. Categories scroll horizontally. No invented ratings,
   opening hours, store photography, or availability.
6. **Review.** Item selection, cart, and checkout keep their main action below the
   scroll area. Server pricing, retry protection, and final submission remain intact.

Settings also exposes onboarding and staff tools on mobile. Routes remain in
`src/app`; shared controls and content live in `src/components`.

## Validation and remaining device review

Automated coverage includes filter truthfulness, query/filter persistence across
views, map-preview navigation, and request-error recovery, alongside the existing
ordering/session tests. Export checks validate bundling, not native hardware.

Visual browser inspection was blocked by unavailable browser access and Windows
Computer Use URL detection. Before calling this design production-ready, review
320/390 point phones and a desktop viewport, large text, high contrast, keyboard
focus, map SDK rendering, keyboard-open checkout, and real VoiceOver/TalkBack.
Speech recognition and native maps require device/development-build testing.
