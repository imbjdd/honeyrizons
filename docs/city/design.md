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
