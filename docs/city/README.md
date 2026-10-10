# Honeyrizons city frontend

A Three.js city inspired by [ZStreet](https://zstreet.cash/), with clickable pixel residents, nine public shops and 17 explorable floors. Outdoors, the camera looks over painted buildings, a garden square, traffic and a tram. Shops switch to first-person rooms with walking, stairs, moving 2D residents and conversations.

## Run

From the repository root:

    bun install
    bun run dev:web

Open http://localhost:5173. This starts the frontend alone. The city uses local demo events and makes no API or SSE requests.

    bun run build:web
    bun run typecheck
    bun test tests/room-walking.test.ts

The analytics dashboard remains at /dashboard and uses the existing API when it is running.

## Explore

Outside, drag to pan, scroll or pinch to zoom, and right-drag or use two fingers to rotate. Click a person for their profile, a conversation or follow controls. Click a storefront to enter. Open shops and Places provide keyboard access to the same destinations.

Inside, use WASD or ZQSD to walk. Drag to look around, or use the arrow keys to walk forward, backward and turn. E or Enter interacts with the object under the crosshair. Clicking a nearby resident or object also works. Shift walks faster. Free look locks the mouse, and Escape releases it. Touchscreens have a movement pad and drag-to-look controls.

Walk up the stairs to reach the next floor. Use the floor name menu as a shortcut. Walk through the ground-floor doorway, select Return to the street, or press Escape to leave. The street camera returns to its previous position.

Talk opens local conversation choices. The coffee counters serve an order, potting benches water plants, and turntables play a short synthesized record when Sound is enabled. These are frontend demo interactions.

Day/night, clock mode, quiet city ambience, pause and photo export work in both scenes. Photos save as PNGs with Original, Noir or Golden filters. Sound starts after a click. H returns to the square, N changes day/night, and Space pauses when the canvas has focus. Reduced motion stops automatic traffic, residents and demo events while manual walking remains available.

## Code and future integration

All city code lives in [apps/web/src/city](../../apps/web/src/city/):

- CityApp and ExploreOverlay manage the HUD, profiles and conversations.
- CityCanvas loads the scene and handles React cleanup.
- CityScene switches cameras, picks objects, renders, exports photos and releases resources.
- RoomController maps keyboard and touch actions to walking, collision and stair surfaces.
- RoomHud contains the crosshair, interaction prompt and touch controls.
- Interiors builds the complete furnished building with its connected floors.
- World and Geometry build the outdoor city and batch static meshes.
- Characters and Portraits create original pixel sprites and portraits locally.
- Model and useDemoCity define protocol districts and the local event source.

To connect the honeypot later, replace the event producer in useDemoCity with an adapter that maps incoming events to CityEvent. The illustrative headline totals will also need real aggregation. Conversations currently use authored replies.

Fonts and assets are local. Static geometry uses instancing, pixel ratio is capped at 1.5, and hidden tabs stop rendering. The city does not load the dashboard's globe code. A large Three.js shared chunk still produces Vite's size warning.

## Captures

Reference screenshots are in [reference](reference/). The second inspection includes a resident conversation, a first-person shop and an indoor display. The implementation captures are in [preview](preview/).

Watch the [first-person walkthrough](preview/pov-walkthrough.mp4). It enters the café, walks up its stairs, looks into the studio and returns to the street at night. The earlier [city walkthrough](preview/walkthrough.mp4) covers outdoor controls.

![Honeyrizons by day](preview/day.png)

![The first-person café](preview/room.png)

![Walkable stairs](preview/stairs.png)

![Resident conversation](preview/conversation.png)

![Phone controls](preview/mobile-room.png)

![Honeyrizons at night](preview/night.png)

[Design notes](design.md) and [verification](verification.md) describe the implementation and checks.
