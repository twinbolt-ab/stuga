# components/dashboard — The Main Surface

This is the largest and most coupled folder in the app. It owns the room grid, floor tabs, favorites, edit mode, and most modal flows. **Read this file before changing anything in here.**

## Mental model

- **`Dashboard.tsx` is the orchestrator.** It composes everything and is allowed to import from any feature folder. Keep it as a thin shell that wires hooks → views.
- **Views are read-mostly.** `RoomsGrid`, `AllDevicesView`, `FavoritesView` render data from hooks. They don't own state; Dashboard owns it.
- **`*Modal` components own their form state**, but persistence calls `lib/ha-websocket` directly (no intermediate "controller").
- **Reorderable surfaces** — `RoomsGrid` uses `ReorderableGrid` (local), `FavoritesView` uses `ReorderableList` from `components/shared/`.

## Files (by role)

### Orchestration
- `Dashboard.tsx` — the entry point. Owns `EditModeProvider`, wires hooks to views.
- `EditModeHeader.tsx` — top bar shown when in edit mode.

### Views (rendered inside `FloorSwipeContainer`)
- `RoomsGrid.tsx` — the default per-floor view. Uses `ReorderableGrid`.
- `FavoritesView.tsx` — the favorites tab. Uses `ReorderableList` (from `components/shared/`).
- `AllDevicesView.tsx` — flat per-domain device listing.
- `FloorSwipeContainer.tsx` — horizontal swipe between floors.
- `FloorHeading.tsx`, `FloorToast.tsx` — chrome.

### Room cards
- `RoomCard.tsx` — collapsed room tile with brightness, scene, status sub-views.
- `RoomCardBrightness.tsx`, `RoomCardScenes.tsx`, `RoomCardStatus.tsx` — sub-views.
- `RoomExpanded.tsx` — full-screen expanded room.

### Reorderable primitive (dashboard-only)
- `ReorderableGrid.tsx` — 2D grid drag/drop. Used by `RoomsGrid` and dashboard internals only. (For 1D lists, use `components/shared/ReorderableList`.)

### Modals & dialogs
- `RoomEditModal`, `RoomDeleteDialog` — single room edit/delete.
- `DeviceEditModal` — single entity edit (rename, hide, area).
- `FloorEditModal`, `FloorCreateModal`, `FloorDeleteDialog` — floor CRUD.
- `BulkEditModal.tsx` — exports `BulkEditRoomsModal` + `BulkEditDevicesModal` for multi-select editing.

### Connection chrome
- `ConnectionBanner.tsx` — top banner when offline / using cached data.
- `ConnectionErrorModal.tsx` — error details + retry.
- `StructureHint.tsx` — first-run hint about HA areas/floors.

## Edit mode lifecycle

1. User long-presses a room → `useLongPress` triggers → `useEditMode().enterEditMode('room')` (from `EditModeContext`).
2. `EditModeProvider` (set up in `Dashboard.tsx`) holds: `isEditMode`, `isRoomEditMode`, `isDeviceEditMode`, `selectedKeys`.
3. While in edit mode:
   - `EditModeHeader` shows action bar (delete, edit, cancel).
   - Reorderable surfaces enable drag (subject to `customOrderEnabled` setting).
   - Tapping items toggles selection, not navigation.
4. Exit on: cancel button, click-outside (`useExitEditModeOnClickOutside`), or completing a bulk action.

**Don't add edit-mode state outside `EditModeContext`.** If you need a new selection mode, extend the context.

## Drag/drop ownership rules

This is the most footgun-heavy part of the app. The root CLAUDE.md *Touch/Drag* gotchas apply universally; on top of those:

- **Pointer ownership**: a drag-active component **must** call `setPointerCapture()` to claim the gesture. Children must not stop propagation while drag is active.
- **`touchAction: 'none'`** on the dragged element so iOS doesn't scroll-hijack.
- **`pointerEvents: 'none'`** on inner content (so the wrapper receives all pointer events).
- **Cross-floor drag** is its own beast (`useCrossFloorDrag`) — long-press on a room near a screen edge auto-swipes the floor container. The hold delay is `HOLD_DURATION = 500ms`. Do not change this without manual testing on a real device.
- **Multi-select drag** stacks selected items behind the primary; see `ReorderableList` source.

## Persistence flow (room order example)

User drags Room A above Room B → `RoomsGrid` calls `onReorder(newRooms)` → `Dashboard` calls `setAreaOrder(area_id, newOrder)` (from `useRoomOrder`) → service writes a `stuga-room-order-XX` label on the area in HA → next registry update reflects it.

**The order is stored in HA, not in app storage.** See HA-State Contracts in root CLAUDE.md.

## When NOT to add code here

- Pure UI primitives → `components/ui/`
- Components used by both dashboard AND devices/settings/setup → `components/shared/`
- HA service calls → `lib/ha-websocket/` (the barrel)
- Cross-cutting state → a hook in `lib/hooks/` + this folder consumes it

## Pre-merge checklist for changes here

- Did you change a drag/gesture path? **Test on a physical iOS or Android device** (web alone is not enough).
- Did you add a modal? Wire `useModalKeyboard` (Escape) and `useBodyScrollLock`.
- Did you add a new label prefix? Update HA-State Contracts in root CLAUDE.md.
- Did you reach into `components/devices/` or `components/settings/`? Reconsider — flow data through Dashboard or via a shared hook.
