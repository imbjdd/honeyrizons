# Honeyrizons, city 2086

The revised brief calls for a futuristic modern city, an original interior in every building, moving 2D characters in first-person 3D rooms, and a changing day. ZStreet provides the interaction reference. Its architecture is not the target for this revision.

## Design plan

- Porcelain `#eaf3ff` for architectural shells and daytime controls.
- Midnight blue `#102444` for glass, roads and nighttime sky.
- Electric cyan `#00d9ff` for transit, water and glazing.
- Solar yellow `#ffce24` for Honey Tower and wayfinding.
- Hot pink `#ff398e` for music, fashion and entertainment.
- Spring green `#80f428` for planted terraces and growing spaces.

DM Sans stays on controls, DotGothic16 on the city wordmark. IBM Plex Mono stays on addresses. The canvas gets the personality: curved glass volumes, offset tower slabs, rooftop rings, planted terraces and an elevated maglev. The controls stay compact and left aligned.

```
city / location                         time / day cycle / photo

      glass skyline and elevated transit
        distinct public buildings, clickable residents
              avenues and waterfront

places / districts             local activity               camera
```

There are 24 buildings across four connected blocks. Every architectural volume belongs to the places catalog and opens its own interior. No apartment block routes to a neighboring shop. Large venues have connected floors and stairs. Interior layouts are authored by venue and floor: a robotics assembly line, a cylindrical aquarium, a cinema with tiered seating, an arcade, a fashion runway, a hydroponic lab, a maglev concourse and others. Shared furniture helpers provide construction, not shared room plans.

A six-minute city day moves through noon, sunset and night. Windows and street lamps turn on as daylight fades. Manual day/night and real-clock controls remain available. Pause and reduced motion stop the automatic cycle. Pixel clothing uses fully saturated yellow, pink, cyan, orange, violet and green, with colored sneakers and accessories.

## Review before building

Adding neon trim to the earlier timber city would leave the rejected architecture intact. Replace the exterior generator and every room layout. Glass towers need different silhouettes, not repeated boxes with different signs. Preserve useful controls and working navigation. Give each venue a recognizable object visible from the door so entering two buildings cannot feel like entering the same room.

Use original geometry and sprites. Keep the frontend independent of the honeypot, preserve `/dashboard`, and update PR #1 after browser checks and new day, night and interior captures.
