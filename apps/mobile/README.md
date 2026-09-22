# Bookgram — mobile

React Native app on Expo SDK 57 (RN 0.86, React 19, expo-router with typed routes, React Compiler, Reanimated 4). iOS + Android. Mock data only — no backend calls yet.

## Running

All commands from `apps/mobile`, with the repo's portable Node on PATH:

```bash
export PATH="/c/Users/begot/Documents/ProjectRed/.tools/node:$PATH"
```

| Task | Command |
| --- | --- |
| Dev server | `npx expo start --port 8081` |
| Typecheck | `npx tsc --noEmit` |
| Add a dependency | `npx expo install <pkg>` (keeps versions in line with the SDK) |
| Android dev build (EAS cloud, APK) | `npx eas-cli build -p android --profile development` |

- **Dev build (preferred on Android).** The APK from the `development` profile replaces Expo Go: it draws edge-to-edge under the status bar, has full photo-library access and supports native sign-in. Open it and connect to `http://<PC LAN IP>:8081` (same Wi‑Fi). Rebuild only when native dependencies or `app.json` plugins change; JS changes arrive over Metro.
- **Expo Go** still works for quick checks, but on Android it paints an opaque status bar and has no full media-library access (the cover picker falls back to the system photo picker).
- **Web** (`npx expo start --web`) is only a smoke test; visual checks happen on a phone.

## Design source

Figma file `Pmz1oSWfWGmewyNAWMmn8e` ("AutoLayouts finals"), section `3193:1049`. Every screen is built from its frame: positions, sizes, colors and assets come from Figma, not from guesses. The file's auto-layouts are unreliable, so numbers are taken from the frames and the layout is rebuilt with flex/absolute positioning.

- Frames are 390×844 with a 47px status bar: design `y` → `insets.top + (y - 47)`.
- Icons are exported from Figma into `assets/icons` (viewBoxes cropped with `scripts/crop-svg.cjs`). Never hand-draw icons; recoloring an exported SVG for a state is fine.
- Fallback when frames can't be exported: `docs/design/figma-section-3193-1049.png` is a 1:1 screenshot of the section; `docs/design/crop-frame.ps1 -FrameX <x> -Out <png>` crops one frame to measure from pixels.
- Fonts: Figma uses SF Pro (iOS system font). Android uses **Inter** instead (SF Pro's license is Apple-only) — see `src/components/text.tsx`. Logo: Caveat; post/article titles: Sen ExtraBold; article body: Iowan Old Style on iOS, serif on Android.

### Frame map (left → right on the canvas; `x` is section-relative)

| Screen | Frames | Status |
| --- | --- | --- |
| Signup | welcome `3086:387`, name `3060:949`/`3086:488`, username `3060:2175`/`3086:580`, username taken `3060:2061`, password `3060:1057`/`3086:675`, repeat password `3086:770`, avatar `3086:862`/`3086:952`, interests `3086:1045`/`3060:2570`, splash `3060:1851` | built |
| Home | feed `3138:570`, scrolled `3101:643` | built |
| Article reader | page 1 `3110:157`, page 2+ `3110:311` | built |
| Create article | editor empty `3114:465` (x 9325), cover picker `3120:1438` (x 9807) / selected `3123:1812` (x 10289), editor with cover `3116:1136` (x 10771), "New article" `3128:459` (x 11269) / typing `3128:560` (x 11794), Home "Posting..." `3129:743` (x 12290) | built |
| Explore / search | feed `3163:1520` (x 12791), empty `3154:579` (x 13291), suggestions `3158:793` (x 13802), profile results `3159:1041` (x 14313), suggestions `3160:1291` (x 14788), article results `3170:2017` (x 15344) | todo |
| Profiles | other user `3167:1542` (x 15904) + scrolled `3169:1832` (x 16444), own empty `3184:982` (x 17024), Followers `3184:1274` (x 17560), Following `3185:1524` (x 18178) | todo |

## Structure

```
src/
  app/                 expo-router routes
    (auth)/            welcome → name → username → password → password-confirm → avatar → interests → ready; login
    (tabs)/            home (index), create, chat, search, profile
    article/[id].tsx   paged article reader
    cover-picker.tsx   "Choose a cover" photo grid
    new-article.tsx    label + publish
  components/          UI kit (text, icon, glass, step-screen, post-card, stories-card, posting-row, …)
  lib/                 paginate (reader pages), pick-cover
  state/               session (user + signup draft), feed (posts, articles, draft, publishing)
  mock/                mock data and fake API — replace with the real backend later
  theme.ts             colors, fonts, motion tokens
```

## Implementation notes

- **Keyboard.** `react-native-keyboard-controller`: primary buttons sit in a `KeyboardStickyView` and rise with the keyboard; long forms use `KeyboardAwareScrollView`.
- **Reader.** Pages are split from measured text lines (`lib/paginate.ts`). The page-1 → page-2 transition is driven by the horizontal scroll offset: each element interpolates between its page-1 and page-2 frame values (glass card top/width/height, title opacity, text rise, page dots). The cover image never changes height (expo-image would re-decode and flicker); a white sheet slides up over it instead.
- **Glass.** `expo-blur` `BlurView` over a `BlurTargetView`, with a white tint and border, matching the design's frosted cards.
- **Publishing flow.** Editor → cover picker (own grid via `expo-media-library`, system picker as fallback) → "New article" → Home shows "Posting..." with progress, then the new article appears first in the feed.

## Changelog

- **Signup flow** — all steps from Figma, keyboard-following Continue button, username availability states, avatar picker, interests (max 5), splash.
- **Home** — scrolling header, stories card with next/prev, post cards with like pop and filled-heart state, pull to refresh.
- **Article reader** — paginated body, scroll-driven page-1 → page-2 transition, glass author card with follow toggle, page dots, bottom action bar.
- **Create article** — editor with cover placeholder, cover grid picker, "New article" screen, publish with "Posting..." progress row and feed insert.
- **Android polish** — EAS development build (edge-to-edge status bar, full media access), Inter in place of SF Pro, cover-picker Next button kept above the navigation bar, `bookgram` brand avatar from Figma.
