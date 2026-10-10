# Frontend verification

Checked in the T3 Code collaborative browser on October 10, 2026, using the production build on port 5174. The reference was inspected in the same browser, including a resident, its conversation and transaction views, the MEMPOOL shop, a shopkeeper, an indoor display, place controls and the exit.

## Build and regression checks

- Frontend production build and repository typechecks pass.
- The five walking tests pass with 19 assertions. They cover furniture and wall collision, sliding, three-floor stairs in both directions, stairwell boundaries, frame-rate-independent movement, diagonal speed, pitch limits and the ground-floor exit.
- Frozen dependency installation and whitespace checks pass.
- The latest upstream dashboard and attack globe are preserved at /dashboard. The dashboard source matches origin/main at 31b61d8. Its stylesheet and fonts load only on that route.
- The city route makes no API or SSE requests. The globe module is a separate lazy chunk. Vite still warns about large chunks.

## City checks

The outdoor city renders locally authored buildings, road markings, signs, trees, pixel residents, traffic and a tram. Resident selection, follow, shop entrances, day/night, camera controls, district navigation, pause, activity filtering, sound and filtered photo export were checked across the development passes.

Shop entrances now enter the building directly. Apartment picks open an information card. The shop directory and Places menu provide keyboard access. Street regulars and named residents use the same pixel artwork as their profile portraits.

## First-person rooms

- All nine buildings and 17 floors render with a perspective camera. Every floor produced a different canvas image.
- All 61 room resident entries opened the expected profile.
- Actual held keyboard input walked across the café and climbed and descended its stairs. The floor label updated on the landing. The recorded walkthrough uses held walking inputs too.
- All 16 ascending and descending stair routes passed against the actual building collision plans, including Honey Tower's third floor. This route sweep drove the navigation controller directly in the browser.
- E opened Mika's profile from the crosshair. Conversation choices returned the authored replies. Movement remained blocked while the inspector was open.
- Residents moved in their aisles. The selected resident held position during a conversation. Pause stopped their movement and sprite animation.
- The touch movement callbacks moved the player and released on pointer-up. Blur released held walking input. Pointer cancellation also clears input.
- Walking through the ground-floor doorway exited the room. Return to the street and Escape restored the outdoor camera. Floor-menu shortcuts were checked throughout the room sweep.
- Coffee, lift and shop actions were checked during the earlier exploration pass. The final version replaces the lift with physical stairs. The turntable, coffee and watering actions remain local demos.
- Final browser checks recorded no application errors.

## Responsive and motion checks

The city layout was checked at phone, tablet and desktop sizes during the first pass. The first-person phone layout was checked at 390 by 844, including the movement pad, room header and resident shortcuts, with no horizontal overflow. The floor menu hides the roster while expanded to keep its destinations clear.

Reduced-motion behavior and context-loss handling were inspected in code. Reduced motion disables automatic movement and events while preserving manual walking and looking. Mouse-look pitch is bounded, movement has no head bob, and open panels release held input. The context-loss screen offers Reload.

The collaborative browser briefly throttled background frames and failed some captures. Focusing the preview restored a 120 Hz animation callback cadence. This is a local observation, not a cross-device performance guarantee. Screenshots and the short walkthrough were saved after the preview recovered.
