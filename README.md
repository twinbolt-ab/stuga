<p align="center">
  <img src="public/giraff.png" alt="Giraff" width="120" height="120">
</p>

<h1 align="center">Giraff</h1>

<p align="center">
  <strong>A mobile-first Home Assistant dashboard</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Home%20Assistant-2024.1+-41BDF5?logo=home-assistant&logoColor=white" alt="Home Assistant">
  <img src="https://img.shields.io/badge/license-ELv2-blue" alt="License">
  <img src="https://img.shields.io/badge/status-beta-orange" alt="Status">
</p>

---

## Why Giraff?

Home Assistant is incredibly powerful—but its companion app and dashboards weren't designed for simplicity. Giraff is a fast, beautiful alternative that works out of the box. No YAML, no card configurations, no learning curve. Just open it and control your home.

Inspired by the polish of Google Home, Hue, and Apple Home.

- **Zero config** — No YAML, no card configurations
- **In-place editing** — Edit rooms, devices, and floors directly from the dashboard
- **HA-native persistence** — All changes save directly to Home Assistant
- **Drag & drop** — Reorder rooms with gestures
- **Mobile-first** — Built for phones, scales up gracefully

https://github.com/twinbolt-ab/giraff/raw/main/public/giraff-demo.mp4

---

## Installation

### Home Assistant Add-on (Recommended)

1. Go to **Settings → Add-ons → Add-on Store**
2. Click ⋮ → **Repositories** → Add: `https://github.com/twinbolt-ab/giraff`
3. Find "Giraff Dashboard" and click **Install**
4. After installation, open **http://homeassistant.local:3001** (or your HA IP with port 3001)

> **Note:** The sidebar link is currently not functional due to ingress limitations. Access Giraff directly via the URL above.

### Docker

```bash
docker run -d --name giraff -p 3000:3000 ghcr.io/twinbolt-ab/giraff:latest
```

Open `http://localhost:3000` and follow the setup wizard.

<details>
<summary>Docker Compose</summary>

```yaml
services:
  giraff:
    image: ghcr.io/twinbolt-ab/giraff:latest
    ports:
      - "3000:3000"
    restart: unless-stopped
```

</details>

---

## Features

| Device | Controls |
|--------|----------|
| Lights | On/off, swipe brightness adjustment |
| Climate | Temperature, HVAC modes, power toggle |
| Covers | Open/close/stop |
| Fans | On/off, speed |
| Scenes | One-tap activation |
| Switches | On/off toggle |

**Organization:** Edit mode for renaming/reordering, floor management, room management, domain filtering.

---

## Issues

Found a bug? [Open an issue](https://github.com/twinbolt-ab/giraff/issues).

---

## License

[Elastic License 2.0 (ELv2)](LICENSE) — Free for personal and internal business use. Cannot be provided as a hosted service.

---

<p align="center">
  Made by <a href="https://twinbolt.se">Twinbolt</a>
</p>
