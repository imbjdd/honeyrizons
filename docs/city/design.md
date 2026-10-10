# Honeyrizons city

The reference is [ZStreet](https://zstreet.cash/), inspected on October 10, 2026. Its defining element is an explorable, densely detailed voxel city. The page is the city, with small translucent controls at the edges and a compact data strip at the bottom. Day and night change the world as well as the interface.

## Design plan

- Chalk `#f4f3ef`: daytime interface and sidewalks.
- Asphalt `#687078`: roads and muted text.
- Honey `#edb84b`: brand, SSH district, active controls.
- Jade `#6eab93`: HTTP district and vegetation.
- Coral `#dc8976`: Telnet district and small storefronts.
- Ink `#161d30`: nighttime sky and interface.

DM Sans is the interface face. DotGothic16 gives the wordmark and district names the pixel character of the world. IBM Plex Mono is used for addresses and values.

The city fills the viewport. Its main avenue runs across the middle of the camera view, with an identifiable honey tower behind it, shopfronts at street level, a planted square, and a railway in the foreground. The top corners hold the brand and environmental controls. A right-side toolbar controls the camera. District navigation stays in the lower-left corner; network totals sit at the bottom center. Detail panels open only when requested.

```
 brand / demo                         photo / day / night / sound

                 voxel buildings                     camera
       shops, trees, moving cars and people           controls
                central honey square

 district / explore      network totals                  activity
```

## Review against the brief

The source is a 3D world, so a conventional dashboard or landing page would miss the brief. The scene receives most of the detail. There are no decorative charts or cards over the default city view. Honeyrizons replaces the blockchain content with five honeypot protocol districts and clearly labeled demo events. Geometry and textures are authored locally; reference screenshots are research material, not the render layer.

The frontend runs independently of the honeypot. Camera movement, selection, activity search, filters, day/night, sound, photo export, and pause are real interactions. A local demo source is the future integration boundary. The existing dashboard remains available at `/dashboard`.

## Street and interior pass

The second inspection covered a resident's profile, traits and conversation, a carrier's transaction, a storefront entrance, the MEMPOOL pickup hall and its shopkeeper, an indoor display, the place menu and the exit control. ZStreet uses pixel portraits as camera-facing characters in a 3D world. Entering a shop changes the scene; its furniture and people remain clickable.

The first Honeyrizons skyline repeated too many rectangular blocks. This pass uses painted plaster, teal glazing, brass trim, coral roofs and shop-specific signs. The tower gets an Art Deco crown, the hotel a curved corner sign, the record shop a rooftop disc and the café a yellow tiled roof. The street stays the main view.

The paint palette now uses marigold #f7c64f, turquoise #32aaa8, sky blue #67bddd, coral #f49375, rose #ee709b and lilac #ac81dc. Gray roofs and pale stone keep the streets readable. Neutral tone mapping preserves the painted colors. The room palette uses turquoise walls, yellow stairs and pendant lamps, cream tiles and honey-colored wood.

## First-person interiors

Entering a storefront switches from the outdoor orthographic camera to a perspective camera at eye level. Each building contains all of its floors in one 3D scene. Open stairwells and alternating stair flights connect the levels, so walking upstairs has no scene cut. Honey Tower has reception, a control room and a roof terrace. The other multistory shops have upstairs studios, listening rooms or gardens.

The player walks with WASD or ZQSD, looks with a drag or the arrow keys, and interacts with E or a click. Free look can lock the mouse. A four-button pad handles walking on touchscreens. The camera has no head bob. Furniture footprints, walls and reachable stair surfaces constrain movement. The front doorway leads back to the street. A floor menu offers a keyboard shortcut between levels.

Pixel residents move through clear aisles and face the camera. Talking to a resident opens a profile and a choice-based conversation. The resident stops walking during the conversation, and player movement stops while a panel is open. Coffee counters, record players, reading tables and potting benches have local actions or information.

The room HUD is small. A location card and resident shortcuts sit at the left edge, a crosshair marks the center, and a nearby prompt appears near the bottom. The street statistics and camera toolbar disappear indoors. Photo mode hides the room controls too.

    brand / room / floor                          environment

              furnished first-person room
       moving pixel residents, objects and stairs
                        crosshair

    walk / look controls            nearby interaction

The city and conversations use local demo data. The existing analytics dashboard, including its attack globe, remains at /dashboard. The city does not make honeypot API requests.
