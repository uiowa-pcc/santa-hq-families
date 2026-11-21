# Photo labels for your Mega Hunt

Upload pictures directly into this `hunt-images/` folder via GitHub.

**New behavior:** A file like `rapunzel.jpg`, `hello-kitty.jpg`, or `bluey.png` automatically becomes an option in **Mega Hunt → Characters from your uploaded photos** after the next Cloudflare deployment. You still choose five character finds; the hunt remains 30 clues long.

Photo examples:
- `rapunzel.jpg` → Rapunzel (automatically added even when not in the preset library)
- `mickey-mouse.jpg` → Mickey Mouse
- `winnie-the-pooh.jpg` → Winnie-the-Pooh
- `bluey.png` → Bluey
- `stitch.webp` → Stitch
- `hello-kitty.jpg` → Hello Kitty
- `jack-skellington.jpg` → Jack Skellington

The following filenames **do not add a character**; they replace a fixed Mega clue's example picture: `holiday-projector.jpg`, `light-tunnel-or-arch.jpg`, `santa-claus.jpg`, `glowing-star.jpg`, `music-synced-lights.jpg`, etc.

Use only one version per filename (do not keep both .jpg and .png). Supported: JPG/JPEG, PNG, WebP. Prefer photos under 1MB. Public GitHub images are publicly viewable. Use photos you own or have rights to use.

The Cloudflare `prepare-assets.mjs` file builds `public/hunt-images/manifest.json` from the image files. Do not hand-edit that generated JSON. This feature requires the included updated `index.html`, `hunt.js`, and `prepare-assets.mjs` to be deployed.
