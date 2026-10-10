# Frontend verification

Checked in the T3 Code collaborative browser on October 10, 2026. The revised production build ran on port 5174. Earlier reference research covered ZStreet's residents, conversations, first-person shops, indoor objects and exits.

## Build and scope

- Production frontend build and repository typechecks pass.
- Five walking tests pass with 19 assertions, covering collision, sliding, alternating stairs, stairwell boundaries, movement timing, diagonal speed, pitch and exits.
- Whitespace checks pass.
- The city makes zero fetch, XHR or EventSource requests. Geometry, sprites, fonts and demo data are local.
- The upstream dashboard and attack globe load their offline view at `/dashboard`, with one dashboard stylesheet. Vite still reports the existing large Three.js and globe chunks.

## City and rooms

- All 24 exterior building picks have unique catalog IDs. An actual canvas click on Pulse Clinic opened its matching room.
- All 46 floors rendered with perspective cameras, clear player spawn points and different canvas hashes. Each floor has its own authored layout.
- Resident placement checks found no characters inside furniture. Floors have three or four clickable residents.
- All 22 stair flights passed in both directions against the actual room collision plans, totaling 44 routes.
- Held W and Shift input climbed Honey Tower's first flight, reached height 4.8 and changed the room floor to 1. The recorded walkthrough also uses held walking actions.
- Floor shortcuts retain the same interior instance, so changing floor does not rebuild the entire building.
- All 183 room resident shortcuts faced the expected character after the camera positioning fix.
- Pulse's profile and conversation opened through the UI. The care bot has a matching pixel portrait and scene sprite. Conversation replies use authored local data; player movement blocks while the panel is open.
- Moving planets, fish, sculptures, traffic and residents render in the revised world. Day and night produce different sky, lighting and emissive-window states.
- The automatic city clock advances. Pause freezes its phase. Reduced motion and hidden-tab handling also stop the automatic clock in code.

## Responsive and captures

At 390 by 844, the aquarium room has no horizontal overflow, and all four walking buttons fit on screen. Desktop captures use 1280 by 800. The new walkthrough was recorded at 960 by 600 and compressed for the repository.

Saved captures cover the daytime and nighttime city, the domed planetarium, Honey Tower's stairs, Pulse's conversation and the phone aquarium. Browser snapshots reported no application errors during the final checks.

Earlier passes also checked doorway exits, Escape, touch release, blur, pointer cancellation, coffee, watering, records, activity filtering and photo export. Those controls remain in this revision. Cross-device frame rates have not been benchmarked.
