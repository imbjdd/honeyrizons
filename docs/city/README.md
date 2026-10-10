# Honeyrizons city frontend

An explorable Three.js city inspired by [ZStreet](https://zstreet.cash/). The revised city has 24 public buildings, 46 original floor plans, glass towers, planted terraces, skybridges, electric shuttles and a waterfront maglev. Every building opens a first-person interior with moving pixel residents. A six-minute city day changes the sunlight, sky, windows and street lamps.

## Run

From the repository root:

    bun install
    bun run dev:web

Open http://localhost:5173. The city uses local demo data and needs no API or honeypot processes. The existing analytics dashboard remains at `/dashboard`.

    bun run build:web
    bun run typecheck
    bun test tests/room-walking.test.ts

## Explore

Outside, drag to pan, scroll or pinch to zoom, and right-drag or use two fingers to rotate. Click a building to enter. Explore buildings and Places provide the same destinations through buttons. Click a resident to talk or follow.

Inside, use WASD or ZQSD to walk, Shift to walk faster, and drag to look. Arrow keys walk and turn. E or Enter interacts with the object under the crosshair. Free look locks the mouse; Escape releases it. Phones have four movement buttons and drag-to-look controls.

Stairs connect the floors without scene cuts. The floor menu offers shortcuts. Walking through the ground-floor door, Return to the street, or Escape restores the outdoor camera. Resident shortcuts find a clear spot nearby and face the character. Talking pauses player input. Coffee, watering and record actions run locally.

The automatic day cycle starts at 10:00. Day and Night fix the time; Follow my clock uses local time. Pause, reduced motion and hidden tabs stop the automatic cycle. Reduced motion also stops traffic and residents while allowing manual walking. Sound starts after a click. Photo mode exports PNGs.

## Buildings and floors

| Building | Ground floor | Upstairs |
| --- | --- | --- |
| Honey Tower | Arrival hall | City command, sky deck |
| Honey Café | Circular espresso lab | Drawing atelier |
| Web Hotel | Check-in lounge | Infinity pool lounge |
| Side A Records | Vinyl exchange | DJ sound stage |
| The Archive | Memory hall | Server vaults |
| Cloud Tea | Tea pavilion | Reflecting rain garden |
| Cache Gardens | Hydroponic lab | Citrus terrace |
| Midnight Ramen | U-shaped noodle counter | |
| Corner Books | Book maze | |
| Pixel Palace | Racing and rhythm arcade | Tournament arena |
| Bot Works | Robot assembly conveyor | Bot nursery and test track |
| Blue Current | Cylindrical aquarium | Marine lab |
| Maglev Central | Ticket concourse | Dispatch gallery |
| Afterglow Cinema | Screening room | Projection booth |
| Prism House | Fashion runway | Wardrobe lab |
| Maker Station | Fabrication hall | Print room |
| Pulse Clinic | Scan pods | Recovery garden |
| Orbit Observatory | Domed planetarium | Telescope deck |
| Skyport 8 | Courier hangar | Flight lounge |
| Vector Club | Movement studio | Running circuit |
| Circuit Market | Four food stalls | Test kitchen |
| Chromatic Lofts | Open apartment | Residents' commons |
| Solar Exchange | Power core gallery | Battery library |
| Light Museum | Light tunnel and sculptures | |

## Code and integration

Frontend code lives in [apps/web/src/city](../../apps/web/src/city/). `explore.ts` is the shared building catalog for exterior geometry, entrances, floor menus and residents. `roomLayouts.ts` authors each floor plan. `interiors.ts` assembles connected floors; `RoomController.ts` handles walking, collision and stairs. `world.ts` constructs the skyline and traffic. Sprites and portraits share original canvas pixel art, including service bots.

`useDemoCity.ts` is the future event adapter boundary. The city makes no API or SSE requests. Its totals and conversations remain local fixtures. The upstream dashboard and attack globe are preserved at `/dashboard` and load separately.

## Captures

The [walkthrough](preview/pov-walkthrough.mp4) visits the planetarium, climbs Honey Tower's stairs, meets the clinic bot and returns to the city at night. Screenshots below show the revised city. Older outdoor clips in this directory document earlier design passes.

![Daytime city](preview/day.png)

![Nighttime city](preview/night.png)

![Domed planetarium](preview/room.png)

![Honey Tower stairs](preview/stairs.png)

![Conversation with Pulse](preview/conversation.png)

![Phone aquarium and walking controls](preview/mobile-room.png)

[Design notes](design.md), [verification](verification.md) and [reference captures](reference/) provide context.
