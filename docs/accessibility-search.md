# Accessible place search

Search uses the backend on both Expo and web; the map only displays the same
results. Submitting a query opens the text list. Categories include stations,
audible traffic signals, station voice guides, tactile paving and crossings.
Infrastructure search uses the current position or a matched station name as
its reference point, without inventing a user position.

To try it without provider credentials: search **Seoul** or **성수역**, choose a
station, then open **Nearby accessibility**. That screen lists recorded features
within 300 m, source dates, attribution and coverage. Station voice-guide points
are approximate station locations, not precise device/entrance coordinates.

Station and infrastructure data work without a commercial API key. General venue
search requires server-only `KAKAO_REST_API_KEY` in the backend environment.
Never use an `EXPO_PUBLIC_*` variable for that credential. Configure the phone's
API address to reach the backend running these endpoints:

- `GET /places/search?q=&kind=&lat=&lng=`
- `GET /accessibility/nearby?lat=&lng=&radiusM=300`

Missing credentials, request failure, no matches, no recorded facilities and
outside dataset coverage have different messages. Empty records do not prove a
facility is absent. Historical infrastructure records do not certify a safe,
step-free or accessible route, or current operation of a signal or voice guide.

Public source files, snapshot manifest and redistribution notices live in the
backend under `app/data/accessibility`. OSM-derived data remain separate from
the public-agency files and retain ODbL attribution. Dataset sources include
Seoul Open Data, Seoul Metro, Korea National Railway, Korean local authorities,
and © OpenStreetMap contributors. The pinned snapshot is distributed via
https://github.com/Engccer/gildongmu; its source/terms inventory is
https://github.com/Engccer/gildongmu/blob/c4a0be3250d9bb7c1df34f3e8c42c8652f9404b9/NOTICE.md.

Tests cover station search without keys, source data integrity, coverage/radius
bounds, tactile flags, provider failures, late search responses, source dates and
English state messages. Real screen readers, map interaction and walking-route
safety require separate device/field evaluation.
