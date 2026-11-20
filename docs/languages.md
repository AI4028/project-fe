# Languages

Select **English** during first-time setup or under **Language / 언어** in Usage Settings. The
preference is saved on this device with the existing settings. Korean remains
the default for existing installations and invalid saved language values.

`src/lib/i18n.ts` defines the language context and pure message translator.
`src/lib/locales/en.json` holds English equivalents of Korean source messages.
The shared Text, Button, Input and Dialog primitives translate presentation text,
placeholders and accessibility metadata. Exact message lookup normalizes JSX
whitespace. Explicit anchored patterns handle totals, counts and order numbers.
Unknown strings fall back unchanged; partial word replacement is never used.

Use `translate={false}` on Text containing store/menu names, backend descriptions,
or customer content, including content that happens to match a UI message.
Input values are never translated. Outside shared controls, use `useTranslation`
for native labels or `translate(message, language)` for spoken announcements.
Keep API values, IDs, routes, prices and stored order data independent of language.

Menu names use the backend's `nameEn` when supplied; Korean names remain the
fallback. Addresses, store names, categories, options, indoor directions and
customer notes remain as supplied by the backend. Map-provider labels follow the
provider's available languages. Amounts remain Korean won.

Spoken guidance and ordering recognition use `en-US` for English and `ko-KR`
for Korean. Customers can speak catalog names, quantities and options, say
“add to cart” after reviewing the selection, or use the touch controls.

Tests cover messages, dynamic totals, untouched content/input, switching language,
saved preferences and older settings without a language. Native speech, screen
readers and visual layout still require device review.
