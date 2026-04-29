# src/ — Directory Map

Stuga is organized by **type** (components, lib, types, providers, routes), with components further split by domain. Read the root `/CLAUDE.md` first for project conventions.

## Directory Map

```
src/
├── components/
│   ├── ui/          Pure UI primitives (BottomSheet, Card, Toggle, …) — leaf-only
│   ├── shared/      Reusable feature components (ReorderableList, LightSlider) — used across features
│   ├── layout/      App shell (Header, SettingsMenu, ThemeToggle)
│   ├── dashboard/   The main HA dashboard surface (rooms, floors, favorites, edit mode) — see CLAUDE.md
│   ├── devices/     Domain sections rendered inside expanded rooms (Lights, Switches, Fans, Scenes, Sensors, Inputs)
│   ├── settings/    Settings modals (connection, domains, dev menu, news, rate-app)
│   └── setup/       Onboarding wizard (URL select, OAuth, token, diagnostics)
├── lib/
│   ├── ha-websocket/   HA WebSocket client + commands — see CLAUDE.md. Always import from the index barrel.
│   ├── hooks/          33 hooks. See CLAUDE.md for groupings + entry points.
│   ├── contexts/       EditModeContext, SettingsContext (React contexts)
│   ├── services/       layout-cache (entity → room mapping), order-storage (custom order)
│   ├── storage/        Async storage API (web/native/secure) — never use localStorage directly
│   ├── i18n/           UI text — single source: en.json
│   ├── metadata/       Entity metadata caching
│   ├── mock-data/      Demo/preview data
│   ├── utils/          entity-sort
│   ├── ha-oauth.ts     OAuth flow (web PKCE + native deep links)
│   ├── constants.ts    STORAGE_KEYS + timing constants
│   ├── analytics.ts, crashlytics.ts, performance.ts   Firebase integrations
│   ├── connection-diagnostics.ts   Pre-connect diagnostics for setup wizard
│   ├── changelog.ts, changelog-data.json   In-app changelog
│   ├── icons.ts, haptics.ts, browser.ts, logger.ts, temperature.ts   Misc utilities
│   └── gms-checker.ts, oauth-browser.ts   Platform-specific helpers
├── routes/         Home, Setup, AuthCallback (3 top-level routes)
├── providers/      ThemeProvider, ToastProvider
├── pages/          DragTest (debug-only page)
├── types/          ha.ts (HA shapes), ordering.ts, capacitor.d.ts
└── test/           Test utilities
```

## Import Direction Rules

These are enforced by ESLint (`no-restricted-imports`):

- **`components/ui/` → leaf-only for feature code.** UI primitives must not import from any other `components/*` folder. (`lib/hooks` is allowed today as a pragmatic exception — see *Known coupling* below.)
- **`components/devices/` ↛ `components/dashboard/`.** Devices must not import dashboard components. Reusable cross-feature components live in `components/shared/`.

These are not enforced but should be respected:

- `components/shared/` is for components used by 2+ features. Don't add a component here just because it's "nice"; only when at least two feature folders import it.
- `components/layout/` is for app-shell UI (header, navigation chrome). Feature folders import from layout, not the other way around.
- `components/setup/` is the onboarding wizard. Once setup completes the user never sees this code path again — keep dependencies on the rest of the app minimal.
- `lib/` should not import from `components/`. Hooks, services, and utilities are framework-agnostic to features.

## Where Things Live (cheatsheet)

| You want to… | Look in |
|--------------|---------|
| Toggle a light or call a HA service | `lib/ha-websocket/index.ts` (`callService`) |
| Read entity state | `useAllEntities` hook (`lib/hooks/`) |
| Add a new HA WebSocket command | `lib/ha-websocket/` — see its CLAUDE.md |
| Add UI text | `lib/i18n/en.json` — never hardcode strings |
| Persist app preferences | `getStorage()` from `lib/storage` |
| Persist OAuth tokens | `getSecureStorage()` from `lib/storage` |
| Persist user data that should follow them across devices | HA labels — see HA-State Contracts in root CLAUDE.md |
| Add a new room/floor/favorites operation | `lib/ha-websocket/area-service.ts` / `floor-service.ts` / `favorites-service.ts` |
| Add a new device domain | New `<Domain>Section.tsx` in `components/devices/`, exported via `components/devices/index.ts` |

## Known coupling (aspirational fixes, not blockers)

These exist today but are not worth refactoring right now. Document and move on:

- `components/ui/BottomSheet.tsx`, `DeviceToggleButton.tsx`, `EditModeContainer.tsx` import from `lib/hooks/`. The hooks they pull (modal state, long-press, etc.) are arguably UI-adjacent. If we ever split UI primitives more strictly, move those hooks into `components/ui/_hooks/` rather than refactor the components.
- `components/dashboard/Dashboard.tsx` imports from `components/settings/` (`ConnectionSettingsModal`). Dashboard is the orchestrator and legitimately renders the modal; not worth inverting today.
