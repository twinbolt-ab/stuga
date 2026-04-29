# lib/hooks — Hooks Index

33 hooks. Most cross-cutting code in Stuga lives here. Group hooks by **concern**, not alphabetically — that's how to find the right entry point.

## How to use this index

When asked to do something, find the row that matches your task and start there. **Don't grep blindly** — many hook names overlap conceptually (e.g. several drag hooks).

## Connection & data

| Hook | Use when… |
|------|-----------|
| `useHAConnection` | You need to know connection state, trigger connect/disconnect, or react to auth events. **The single source for connection lifecycle.** |
| `useAllEntities` | You need the full entity list with metadata (icon, friendly name, hidden flags). Filters out hidden/auxiliary entities. |
| `useRooms` | You need rooms (areas) joined with their entities, ordered, and grouped by floor. The hook most components actually want. |
| `useFavorites` | You need the user's favorited rooms / scenes / entities. |
| `useDeviceHandlers` | You're rendering a device control (light, switch, fan) and need toggle/dim handlers with optimistic updates. |
| `useLightControl` | Light-specific: turn on/off, set brightness, with optimistic state. Used by `LightSlider`. |
| `useEntityOrder` | Read or write per-room, per-domain entity order. |
| `useRoomOrder` | Read or write room order across floors. |

## Settings & dev mode

| Hook | Use when… |
|------|-----------|
| `useSettings` | Read or write user settings (theme, customOrderEnabled, etc.). Backed by `SettingsContext`. |
| `useEnabledDomains` | Read or toggle which entity domains are visible. |
| `useDevMode` | Read or toggle dev mode (mock data, debug overlays). Mock scenarios live here. |
| `useDevModeActivation` | The "tap N times to enable dev mode" gesture. |

## Edit mode & modals

| Hook | Use when… |
|------|-----------|
| `useExitEditModeOnClickOutside` | Auto-exit edit mode when the user taps outside the editable region. |
| `useModalState` | Manage which room/entity is being edited in a modal. |
| `useSettingsMenuState` | Track which settings modal is open (single-modal-at-a-time pattern). |
| `useModalKeyboard` | Wire up Escape-to-close for modals. |
| `useBodyScrollLock` | Prevent the page scrolling under an open modal/sheet. |

## Gestures, drag & reorder

These hooks are the most tangled. Pick by **what you are dragging**, not by name:

| You are dragging… | Hook |
|-------------------|------|
| Items in a 2D grid (rooms on a floor) | `useGridDrag` + `useGridMeasurement` (+ `useGridGeometry` for pure math) |
| Items in a 1D list or flex-wrap (entities inside a room, devices in a section) | `useListDrag` + `useListMeasurement` |
| A room across floors (long-press to swipe between floors) | `useCrossFloorDrag` |
| A brightness slider on a light | `useBrightnessGesture` |
| A modal/sheet to dismiss it | `useSwipeRightToClose` |
| Just detecting a long press (not a drag) | `useLongPress` |

`ReorderableGrid` (in `components/dashboard/`) and `ReorderableList` (in `components/shared/`) wrap these hooks. **Prefer the components over calling the hooks directly** unless you're building a new reorderable surface.

## Optimistic UI & utility

| Hook | Use when… |
|------|-----------|
| `useOptimisticState` | You want to show a value immediately while the server confirms. The pattern used everywhere for HA service calls. |
| `useFloorNavigation` | The bottom-tab floor navigation state (current floor, swipe transitions). |
| `useCopyToClipboard` | Copy a string and show "Copied" feedback. |
| `useDeepLinks` | Listen for deep links (OAuth callbacks, etc.) on native. |
| `useIsClient` | Only render on the client (avoids SSR mismatch in Vite preview). Rare. |
| `useWindowWidth` | Reactive window width via `useSyncExternalStore`. |

## Conventions

- **Hooks call services, not the other way around.** A hook may import from `lib/ha-websocket`, `lib/services/`, `lib/contexts/`. Do not import a hook from a non-hook module — call the underlying service directly instead.
- **Optimistic state**: prefer `useOptimisticState` over rolling your own `setTimeout` reset.
- **Drag/gesture rules**: see root CLAUDE.md → *Touch/Drag Events* gotchas. Use PointerEvent, not TouchEvent.
- **Avoid creating new hooks** for one-off logic. If only one component will ever use it, inline the logic in the component.

## Adding a new hook

1. Decide which group above it belongs to and add it to the table.
2. Co-locate the test in `__tests__/` (Vitest).
3. If it touches HA, depend on `lib/ha-websocket` via the index barrel — never reach into a sub-module like `lib/ha-websocket/entity-service.ts`.
4. Export named, not default.
