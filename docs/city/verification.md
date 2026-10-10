# Frontend verification

Checked in the T3 Code collaborative browser on October 10, 2026.

## Build

- `bun run build:web`: TypeScript and Vite production build pass.
- `bun run typecheck`: web, API and shared package typechecks pass.
- `git diff --check`: pass.
- `bun install --frozen-lockfile`: pass.
- The concurrent ObsidianUI dashboard update from `main` is preserved at `/dashboard`, including its components, dependencies, aliases and styles. The dashboard entry and stylesheet match that upstream revision byte for byte. Its fonts load locally only on that route.

## Browser checks

- City renders with local fonts, authored geometry, road markings, shops, foliage, pedestrians, moving cars, buses and tram.
- Day/night changes both the scene and interface. Night adds lit windows, streetlamp glows and light cones.
- Theme persists after reload. Local-clock mode is available.
- Camera zoom, rotation, home, automatic tour and district navigation work.
- Clicking a landmark opens its district. Choosing a place moves the camera; the district action closes its panel.
- Activity updates from local fixtures. Search returns matching entries; an unmatched query shows an empty state; clearing filters restores the feed.
- Selecting SSH leaves only SSH entries. Expanded events show the source address, location, severity and simulated-event label. The district action navigates to the event's neighborhood.
- Escape closes panels. Panels receive focus on opening and restore the trigger's focus on closing. Icon controls have accessible labels; the skip link and visible focus styles are present.
- Pause keeps both the connection count and canvas pixel output identical over a five-second interval. Resume restarts local activity and motion.
- Photo mode hides the HUD. Noir export was inspected as a valid 1920 × 1200 PNG; the sampled output pixel had identical R, G and B values, confirming the filter applies to the saved image.
- Ambient sound requires a user click and can be muted.
- No `/api` requests or SSE connections occur on the city route.
- Console entries in the final production smoke check contain no application errors.

Responsive checks cover 320 × 568, 390 × 844, 844 × 390, 768 × 1024, 1024 × 768, 1280 × 800 and 1440 × 900. The small landscape and portrait layouts use a compact camera toolbar. No horizontal overflow or overlap between the brand/environment controls, district/statistics controls, and toolbar/activity button remains.

Reduced-motion behavior and resource disposal were inspected in code. Reduced motion stops simulated events and automatic motion; manual camera actions remain available. Context loss has a reload action. These two browser preferences/failure cases were not emulated in this browser session.

The browser's animation callback cadence was approximately 120 Hz by day and 116 Hz at night at 1280 × 800 in this environment. This is a local observation, not a cross-device performance guarantee.
