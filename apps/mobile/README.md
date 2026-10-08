# Smarts — mobile

React Native app on Expo SDK 57 (RN 0.86, React 19, expo-router with typed routes, React Compiler, Reanimated 4). iOS + Android. Auth, profiles, media uploads and chat go to the backend; feed, search and stories still use mock data.

## Running

All commands from `apps/mobile` with the system Node (run `npm ci` once after cloning).

| Task | Command |
| --- | --- |
| Dev server | `npx expo start --port 8081` |
| Typecheck | `npx tsc --noEmit` |
| Add a dependency | `npx expo install <pkg>` (keeps versions in line with the SDK) |
| Android dev build (EAS cloud, APK) | `npx eas-cli build -p android --profile development` |

- **Dev build (preferred on Android).** The APK from the `development` profile replaces Expo Go: it draws edge-to-edge under the status bar, has full photo-library access and supports native sign-in. Open it and connect to the VPS Metro (`exp://31.220.92.154:8081`, picks up pushes to `main`) or to a local one at `http://<PC LAN IP>:8081` (same Wi‑Fi; IP from `ip -4 addr`). Rebuild only when native dependencies or `app.json` plugins change; JS changes arrive over Metro.
- **Expo Go** still works for quick checks, but on Android it paints an opaque status bar and has no full media-library access (the cover picker falls back to the system photo picker).
- **Web** (`npx expo start --web`) is only a smoke test; visual checks happen on a phone.

## Design source

Figma file `Pmz1oSWfWGmewyNAWMmn8e` ("AutoLayouts finals"), section `3193:1049`. Every screen is built from its frame: positions, sizes, colors and assets come from Figma, not from guesses. The file's auto-layouts are unreliable, so numbers are taken from the frames and the layout is rebuilt with flex/absolute positioning.

- Frames are 390×844 with a 47px status bar: design `y` → `insets.top + (y - 47)`.
- Icons are exported from Figma into `assets/icons` (viewBoxes cropped with `scripts/crop-svg.cjs`). Never hand-draw icons; recoloring an exported SVG for a state is fine.
- Fallback when frames can't be exported: `docs/design/figma-section-3193-1049.png` is a 1:1 screenshot of the section; `magick docs/design/figma-section-3193-1049.png -crop 390x844+$((X-100))+0 +repage frame.png` crops one frame (`X` = frame x from the map below) to measure from pixels.
- Fonts: Figma uses SF Pro (iOS system font). Android uses **Inter** instead (SF Pro's license is Apple-only) — see `src/components/text.tsx`. Logo: Caveat; post/article titles: Sen ExtraBold; article body: Iowan Old Style on iOS, serif on Android.

Newest exports live in `assets/icons/_inbox/` (git-ignored, 70–85 MB each, layer names kept as ids): `Frame 1081.svg` is the current whole-app canvas (33 frames: onboarding, Home, stories, Explore with topic tabs, search, reader, create, profiles), `Frame 1049.svg` the previous one. To measure, strip the embedded images and read `getBBox()` of the layers in headless Chrome; cut icons with `scripts/svg-extract.cjs`.

### Frame map (left → right on the canvas; `x` is section-relative)

| Screen | Frames | Status |
| --- | --- | --- |
| Signup | welcome `3086:387`, name `3060:949`/`3086:488`, username `3060:2175`/`3086:580`, username taken `3060:2061`, password `3060:1057`/`3086:675`, repeat password `3086:770`, avatar `3086:862`/`3086:952`, interests `3086:1045`/`3060:2570`, splash `3060:1851` | built |
| Home | feed `3138:570`, scrolled `3101:643` | built |
| Article reader | page 1 `3110:157`, page 2+ `3110:311` | built |
| Create article | editor empty `3114:465` (x 9325), cover picker `3120:1438` (x 9807) / selected `3123:1812` (x 10289), editor with cover `3116:1136` (x 10771), "New article" `3128:459` (x 11269) / typing `3128:560` (x 11794), Home "Posting..." `3129:743` (x 12290) | built |
| Explore / search | feed `3163:1520` (x 12791), empty `3154:579` (x 13291), suggestions `3158:793` (x 13802), profile results `3159:1041` (x 14313), suggestions `3160:1291` (x 14788), article results `3170:2017` (x 15344) | built |
| Profiles | other user `3167:1542` (x 15904), own empty `3169:1832` (x 16444), Followers `3184:982` (x 17024), Following `3184:1274` (x 17560) | built |
| Chats tab | own username + compose, search, people list `3185:1524` (x 18178) | built (purpose to confirm) |

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
- **Explore & search** — topic chips, explore feed, search mode with Articles/Profiles switch, query suggestions, profile and article results, animated field/back/Exit transitions, Android back handling.
- **Profiles** — other user's profile (follow toggle, article list, liked tab), own empty profile with empty-state cards, Followers / Following lists with search and follow buttons.
- **Chats tab** — list screen from the last frame: centred username, compose button, search, people with Following buttons.
- **Tab bar & motion** — active/inactive tab icons with crossfade, new like animation (filled heart grows out of the outline, counter rolls), navigation lock against double taps and back presses mid-transition.
- **Android polish** — EAS development build (edge-to-edge status bar, full media access), Inter in place of SF Pro, cover-picker Next button kept above the navigation bar, `bookgram` brand avatar from Figma.
- **Story page turn** — swipe or tap turns stories with a page curl (Skia shader over snapshots of the stacked previous/current/next pages); the viewer uses the core `Image` so Android snapshots can draw it. Needs a dev build with Skia.
- **Frame 1081 update** — Explore: topic tabs (For You / Books / Following / News) with a search button instead of the always-visible field, lighter title chip, ⋮ on cards, quick-return bar; story viewer: black status area, filled message pill, inline "...more" caption. Follower counts update on Follow.
- **Motion pass** — stories open out of their photo on Home and swipe down back into it; article covers grow out of the tapped picture (feed, Explore, profile) and shrink back on close; double-tap heart in the reader; watched rings turn grey with a sweep; Follow labels roll; Explore search opens from the magnifier; story caption "more" lifts the text; pulsing skeletons while profiles and follower lists load. None of this motion is in the design.
- **Long feeds** — endless mock feed (the mock posts repeat under new ids) to test long scrolling. FlashList was tried and dropped: on Android its cells overlapped with the pull-to-refresh gesture and entering animations.
- **Tooling** — ESLint (Expo config + React Compiler rules; shared values use `.get()`/`.set()`), Jest unit tests (API client, pagination, mock data), API response types shared with the backend (`@api/api` → `apps/backend/src/contracts/api.ts`, type-only), CI on GitHub Actions.
- **Frame 1198** — new Home card (title and excerpt under the photo, Source Serif 4 in place of the licensed Sentinel), Instagram-gradient story rings, Explore as article rows with an always-visible search field, search results with Related / Detailed / Quick, own "Choose a cover" screen over the photo library (expo-media-library: needs a dev build rebuild; falls back to the system picker without library access), new mocks from the frame.
- **Account & safety** — the profile gear opens a sheet with Log out, Download my data (`GET /users/me/export` through the share sheet) and Delete account (`DELETE /users/me`, confirmed twice); signup asks "I'm 13 or older" on the name step; JS errors are reported to the backend log (`POST /client-logs`). None of this is in the design.
