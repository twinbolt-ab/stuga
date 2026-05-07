# Stuga - Home Assistant Dashboard

See @README.md for project overview and @package.json for available npm commands.

## Terminology

| Stuga | Home Assistant |
|-------|----------------|
| Room | Area |
| Tab (bottom nav) | Floor |
| Device | Entity |

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # TypeScript + Vite build
npm run lint         # ESLint
npm run test         # Vitest watch mode
npm run test:run     # Single test run
npm run ios:dev      # Build + run on iOS device
npm run android:dev  # Build + run on Android device
```

## Platform Rules

**This app runs on Web, iOS, and Android.** Always consider all platforms.

### Storage (CRITICAL)

- **NEVER** use `localStorage` directly
- **ALWAYS** use async APIs from `lib/storage`:
  - `getStorage()` for regular data
  - `getSecureStorage()` for OAuth tokens
- Sync functions like `getStoredCredentialsSync()` only work on web

### OAuth Differences

| Platform | Flow | Client ID |
|----------|------|-----------|
| Web | Redirect + PKCE → `/auth/callback` | `window.location.origin` |
| Native | OAuth2Client plugin + deep links | `https://twinbolt.se/stuga` |

Native apps need manual token exchange for HTTP (local HA instances).

## Gotchas

### Touch/Drag Events
- Use PointerEvent API consistently (not TouchEvent)
- `stopPropagation()` in parents blocks document listeners in children
- Set `touchAction: 'none'` and `pointerEvents: 'none'` on drag children
- Use `setPointerCapture()` for gesture ownership

### Room Reordering
- Order stored in HA using `stuga-room-order-XX` labels on areas
- Managed via WebSocket commands to label/area registry

### HA-State Contracts (CRITICAL)

Stuga stores user data **inside Home Assistant**, not in app storage, using labels with prefixes:

| Prefix | Purpose | Owner file |
|--------|---------|------------|
| `stuga-room-order-XX` | Room (area) order | `lib/ha-websocket/area-service.ts` |
| `stuga-favorite-A-XX` | Favorited scenes | `lib/ha-websocket/favorites-service.ts` |
| `stuga-favorite-B-XX` | Favorited rooms | `lib/ha-websocket/favorites-service.ts` |
| `stuga-favorite-C-XX` | Favorited entities | `lib/ha-websocket/favorites-service.ts` |
| `stuga-hidden` | Entities hidden in Stuga only | `lib/ha-websocket/entity-service.ts` |
| `stuga-temp-sensor.<entity_id>` | Per-area temperature sensor | `lib/ha-websocket/area-service.ts` |
| `stuga-cover-inverted` | Cover entities the user wants Stuga to invert | `lib/ha-websocket/cover-service.ts` |
| `stuga-cover-closed-prc-NN` | Per-cover "fully closed" position (0-100, after inversion) | `lib/ha-websocket/cover-service.ts` |

Rules:
- **Never invent a new `stuga-*` label prefix without updating this table.**
- **Never bulk-delete labels** without checking owner file first — users have years of state encoded in them.
- Changes to label schemas need a migration path (read old, write new) — there is no version field to fall back on.
- All label mutation goes through WebSocket commands to HA's label/area/entity registry, not app storage.

## Sources of Truth

When in doubt, trust the code over prose docs. These are the authoritative locations:

| Topic | Source of truth |
|-------|-----------------|
| Directory map of `src/` | `src/CLAUDE.md` |
| HA entity / area / floor types | `src/types/ha.ts` |
| HA WebSocket public API | `src/lib/ha-websocket/index.ts` (the barrel — only export from here) |
| HA WebSocket internals | `src/lib/ha-websocket/CLAUDE.md` |
| Hooks index + groupings | `src/lib/hooks/CLAUDE.md` |
| Dashboard orchestration | `src/components/dashboard/CLAUDE.md` |
| Storage keys | `src/lib/constants.ts` (`STORAGE_KEYS`) |
| HA-side data contracts (labels) | `src/lib/ha-websocket/area-service.ts`, `favorites-service.ts`, `entity-service.ts` |
| UI text | `src/lib/i18n/en.json` (use `t.key` or `interpolate()`) |
| Routes | `src/routes/` |
| OAuth client IDs | `src/lib/ha-oauth.ts` (`getClientId`) |
| Theme tokens | `tailwind.config.ts` |
| Module boundaries | `eslint.config.js` (`no-restricted-imports`) |

## Doc Loading Guide

Read the relevant CLAUDE.md before touching that area — don't grep blindly.

| Task | Read first |
|------|-----------|
| Anything in `src/` | `src/CLAUDE.md` |
| Add or modify a hook | `src/lib/hooks/CLAUDE.md` |
| HA WebSocket / commands / labels | `src/lib/ha-websocket/CLAUDE.md` |
| Dashboard layout, grid, drag, edit mode | `src/components/dashboard/CLAUDE.md` |
| OAuth or auth flow | `src/lib/ha-oauth.ts` + Platform Rules section above |
| Release / version bump | `docs/RELEASE_SETUP.md` |
| Add or change UI text | `src/lib/i18n/en.json` |

## Code Style

- Prefer strict TypeScript; avoid `any` except in tests
- All UI text in `lib/i18n/en.json`—use `t.key` or `interpolate()`
- Satoshi font, warm brass accents (#C4A77D), no generic AI aesthetics

## Git Commits

- Concise, action-oriented messages (e.g., "Add dark mode toggle")
- Run `npm run lint && npm run test:run` before committing
- No "Co-Authored-By: Claude" or "Generated with Claude Code" footers

## Agent Notes

- **Verify first:** Check source code for facts; don't guess
- **Platform awareness:** Test changes on Web, iOS, and Android
- **Follow existing patterns:** Don't invent new approaches
- **Never edit:** `node_modules`, `ios/Pods/`, `android/.gradle/`
