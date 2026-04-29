# lib/ha-websocket — Home Assistant WebSocket

Long-lived WebSocket connection to Home Assistant. Module-private singleton state. Public API is the `index.ts` barrel — **always import from `@/lib/ha-websocket`, never from a sub-file**.

## Files

| File | Role |
|------|------|
| `index.ts` | The public API. The only file outside this folder should import from. |
| `connection.ts` | Open/close the socket, auth, reconnect logic. |
| `message-router.ts` | Dispatches incoming messages, manages pending request callbacks and subscription handlers. |
| `registry-manager.ts` | Subscribes to state changes; fetches entity / area / floor / label registries on auth. |
| `entity-service.ts` | Entity reads/writes: state, registry, hidden flags, ordering, `callService`. Owns the `stuga-hidden` label. |
| `area-service.ts` | Area (room) CRUD + ordering. Owns `stuga-room-order-XX` and `stuga-temp-sensor.<entity_id>` labels. |
| `floor-service.ts` | Floor CRUD + ordering. |
| `favorites-service.ts` | Favorited rooms/scenes/entities. Owns `stuga-favorite-{A,B,C}-XX` labels. |
| `label-service.ts` | Generic label registry operations (delete, etc.) used during cleanup. |
| `types.ts` | Internal types (state, handler signatures, `OptimisticOverride`). |

## Architecture in one paragraph

`index.ts` holds a single `state` (created by `createInitialState()`). It wires `connection.ts` (raw socket) to `message-router.ts` (callback dispatch) to `registry-manager.ts` (state-change events + registry refresh). All `*-service.ts` files take `state` as their first argument — they're functional, not class-based. The barrel re-exports thin wrappers that pre-bind `state`. There is no React in this folder; consumers use `useHAConnection` and friends.

## How requests work

1. Caller invokes a barrel function, e.g. `setAreaOrder(areaId, order)`.
2. The service composes a WebSocket command, calls `getNextMessageId(state)`, and `send(state, message)`.
3. `registerCallback(state, id, handler)` stores a promise resolver.
4. When HA replies, `message-router.ts` matches on `message.id` and resolves the promise.
5. If the response affects registries (areas/entities/floors/labels), `registry-manager.handleRegistryResult` updates state and notifies `RegistryHandler` subscribers.

## Subscriptions

These are exported from `index.ts`:

- `onConnection(handler)` — connection up/down events
- `onMessage(handler)` — raw messages (debug)
- `onRegistryUpdate(handler)` — registry refreshed (areas/entities/floors changed)
- `onConnectionError(handler)` — connection error with diagnostic info

All return an unsubscribe function.

## HA-state contracts (CRITICAL)

User data lives **inside Home Assistant** as labels. **Never invent a new `stuga-*` label prefix without updating root CLAUDE.md → HA-State Contracts.**

| Label prefix | Owner | Constants |
|--------------|-------|-----------|
| `stuga-room-order-XX` | `area-service.ts` | `ROOM_ORDER_LABEL_PREFIX` (in `lib/constants.ts`) |
| `stuga-temp-sensor.<entity_id>` | `area-service.ts` | `TEMPERATURE_SENSOR_LABEL_PREFIX` |
| `stuga-favorite-A-XX` (scenes) | `favorites-service.ts` | — |
| `stuga-favorite-B-XX` (rooms) | `favorites-service.ts` | — |
| `stuga-favorite-C-XX` (entities) | `favorites-service.ts` | — |
| `stuga-hidden` (single label, applied to entities) | `entity-service.ts` | `STUGA_HIDDEN_LABEL` |
| `stuga-XXX` (per-domain entity order) | `entity-service.ts` | `DEVICE_ORDER_LABEL_PREFIX` |

## Adding a new command

1. Decide which service file owns the data (areas → `area-service.ts`, etc.). If it's a new domain, create `<thing>-service.ts`.
2. Write a function taking `state: HAWebSocketState` first.
3. Use `send(state, { id, type, ... })` and `registerCallback(state, id, ...)` for request/response. Return a Promise.
4. Re-export from `index.ts` (pre-bind `state`).
5. If it changes registries, call `notifyRegistryHandlers(state, ...)` after the local cache update.

## Don'ts

- **Don't import from a sub-file** (e.g. `@/lib/ha-websocket/area-service`). Always go through the barrel.
- **Don't bypass the message-router** by writing to the socket directly. Use `send()` + `registerCallback()`.
- **Don't bulk-delete labels** in cleanup code without checking the owner table above. Years of user state lives in those labels.
- **Don't add React/hooks here.** This folder is framework-agnostic.
- **Don't store user data in app storage** when it could live in HA labels — labels follow the user across devices.

## Testing

Service functions are unit-testable by passing a fake `state`. There are no tests today; if you add one, mock the socket via `state.ws` (a `WebSocket | null`).
