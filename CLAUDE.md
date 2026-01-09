# Home Assistant Dashboard

A mobile-first, Scandinavian-minimal Home Assistant dashboard built with Next.js 14 and Tailwind CSS.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS v4
- **State**: TanStack Query for server state
- **Icons**: Lucide React
- **Motion**: Framer Motion
- **Theme**: next-themes

## Design System

### Typography

Use **Satoshi** as the primary font (via Fontshare or local). Fallback to system-ui.

```
Headings: font-satoshi font-bold tracking-tight
Body: font-satoshi leading-relaxed
```

### Color Palette

CSS variables defined in `app/globals.css`:

**Light Theme**
```css
--bg-primary: #FAFAF9;     /* warm white */
--bg-card: #FFFFFF;
--text-primary: #1A1A1A;
--text-secondary: #6B6B6B;
--accent: #C4A77D;          /* brass/gold */
--accent-hover: #B8956A;
--border: #E8E8E6;
--success: #4A7C59;         /* forest green */
--warning: #D4A574;         /* warm amber */
```

**Dark Theme**
```css
--bg-primary: #0D0D0C;      /* warm black */
--bg-card: #1A1A18;
--text-primary: #F5F5F4;
--text-secondary: #A3A3A0;
--accent: #D4B896;
--border: #2D2D2A;
```

### Spacing

- Card padding: `p-4` (16px)
- Card gap: `gap-3` (12px)
- Section gap: `gap-6` (24px)
- Border radius: `rounded-xl` (12px) for cards

### Shadows

Use warm-tinted shadows, not pure black:
```css
shadow-warm: 0 4px 12px rgba(26, 26, 24, 0.08)
shadow-warm-lg: 0 8px 24px rgba(26, 26, 24, 0.12)
```

## File Structure

```
app/
  layout.tsx          # Root layout, fonts, providers
  page.tsx            # Home dashboard
  rooms/[slug]/       # Room detail pages
  api/ha/[...path]/   # HA API proxy

components/
  ui/                 # Reusable primitives
  dashboard/          # Dashboard-specific
  layout/             # Header, nav, etc.

lib/
  ha-client.ts        # REST API client
  ha-websocket.ts     # WebSocket manager
  hooks/              # Custom React hooks

types/
  ha.ts               # Home Assistant types
```

## Component Patterns

### Naming
- Files: PascalCase (`RoomCard.tsx`)
- Components: PascalCase (`export function RoomCard`)
- Hooks: camelCase with `use` prefix (`useDevices`)

### Imports
```tsx
// External
import { motion } from 'framer-motion'

// Internal - absolute paths
import { Card } from '@/components/ui/Card'
import { useDevices } from '@/lib/hooks/useDevices'
```

### Component Structure
```tsx
interface Props {
  // typed props
}

export function ComponentName({ prop }: Props) {
  // hooks first
  // derived state
  // handlers
  // render
}
```

## Home Assistant API

### Environment Variables
```env
HOME_ASSISTANT_URL=http://homeassistant.local:8123
HOME_ASSISTANT_TOKEN=your_long_lived_token
```

### WebSocket Connection
Connect to `ws://{HA_URL}/api/websocket` for real-time state updates.

```typescript
// Authentication
{ type: "auth", access_token: TOKEN }

// Subscribe to state changes
{ id: 1, type: "subscribe_events", event_type: "state_changed" }
```

### REST Endpoints (via proxy)
```
GET  /api/ha/states              # All entities
GET  /api/ha/states/{entity_id}  # Single entity
POST /api/ha/services/{domain}/{service}
```

## Key Rooms

Your HA setup includes these areas:
- Hall, Kök, Matbord och vardagsrum
- Sovrum vuxna, Cleos rum, Noras rum
- Stora badrummet, Lilla badrummet
- Kontor, Garage, Pool, Trädgård

## Design Principles

1. **Mobile-first**: Design for phone, scale up
2. **Touch-friendly**: Large tap targets (min 44px)
3. **Real-time**: WebSocket for instant updates
4. **Scandinavian minimal**: Generous whitespace, warm tones
5. **Performance**: Optimistic updates, skeleton loading

## Aesthetics Guidelines

Avoid generic "AI slop" patterns:
- No Inter, Roboto, or system fonts
- No purple gradients on white
- No predictable layouts

Instead:
- Use Satoshi for distinctive typography
- Warm brass accents instead of generic blue
- Layered backgrounds with subtle texture
- Staggered animations for delight

## Internationalization

All UI text is stored in `lib/i18n/en.json`. Use translations via:

```tsx
import { t, interpolate } from '@/lib/i18n'

// Simple text
<span>{t.settings.title}</span>

// With interpolation
<span>{interpolate(t.devices.lightsOn, { count: 3 })}</span>
```

## Room Reordering

Room order is stored in Home Assistant using labels with `giraff-` prefix:
- Labels like `giraff-room-order-05` on areas
- Managed via WebSocket commands to label/area registry
- Reorder UI: Settings menu → "Reorder rooms" → drag to reorder → tap outside to save

## Tailwind v4 Notes

- Avoid `ring-{color}/{opacity}` syntax - doesn't work reliably
- Use plain CSS for complex focus states in `globals.css`
- Custom colors use CSS variables: `var(--accent)`, `var(--border)`, etc.

## UI Patterns

### Settings Menu
- Bottom sheet style (slides up from bottom)
- Use for infrequent actions (theme toggle, reorder mode)
- Tap outside or X button to close

### Reorderable Grid
- Uses absolute positioning + Framer Motion for smooth animations
- iOS-style wiggle animation when active (angle scales with cell size)
- Click outside to save and exit

### Connection Status
- Only show "Connecting..." when disconnected
- Don't show status when connected (clean UI)

### Focus States
- Remove default browser outlines
- Use `focus-visible` for keyboard navigation only
- Accent color outline, not blue
