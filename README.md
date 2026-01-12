<p align="center">
  <img src="public/giraff.png" alt="Giraff" width="120" height="120">
</p>

<h1 align="center">Giraff</h1>

<p align="center">
  <strong>A mobile-first, Scandinavian-minimal Home Assistant dashboard</strong>
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#features">Features</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Home%20Assistant-2024.1+-41BDF5?logo=home-assistant&logoColor=white" alt="Home Assistant">
  <img src="https://img.shields.io/badge/license-ELv2-blue" alt="License">
  <img src="https://img.shields.io/badge/status-beta-orange" alt="Status">
</p>

---

<!-- TODO: Add hero screenshot or GIF showing the dashboard in action -->
<p align="center">
  <em>Screenshot coming soon</em>
</p>

---

## Why Giraff?

Home Assistant is powerful, but its default dashboard can feel overwhelming on mobile. Giraff is an opinionated alternative that prioritizes:

- **Mobile-first design** — Built for phones, scales up gracefully
- **In-place editing** — Edit rooms, devices, and floors directly from the dashboard
- **Real-time updates** — WebSocket connection for instant state changes
- **Gesture controls** — Swipe horizontally on lights to adjust brightness
- **HA-native persistence** — All changes save directly to Home Assistant

No YAML. No card configurations. Just a clean, fast way to control your home.

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Installation](#installation)
- [Configuration](#configuration)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Community](#community)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Features

### Dashboard
- **Floor-based navigation** — Bottom tabs organize rooms by floor
- **Room cards** — See lights on/off count, temperature at a glance
- **Expandable rooms** — Tap to reveal all devices in a room
- **Uncategorized view** — Dedicated page for devices without rooms

### Device Controls
| Device | Controls |
|--------|----------|
| **Lights** | On/off toggle, swipe-to-adjust brightness with visual feedback |
| **Climate** | Temperature display, HVAC mode badges, power toggle |
| **Covers** | Open/close/stop controls for blinds and shades |
| **Fans** | On/off toggle with speed percentage |
| **Scenes** | One-tap activation |
| **Switches** | Simple on/off toggle |

### Organization
- **Edit mode** — Rename, reorder, and reassign devices to rooms
- **Bulk editing** — Select multiple items to move or hide at once
- **Floor management** — Create, rename, reorder floors with custom icons
- **Room management** — Delete rooms with smart device relocation

### Settings
- **Theme toggle** — Light and dark modes with warm color palettes
- **Domain filtering** — Show/hide device types (lights, climate, fans, etc.)
- **Hidden items** — Toggle visibility of HA hidden entities
- **Setup wizard** — Guided connection to your Home Assistant instance

---

## Screenshots

<!-- TODO: Add screenshots -->

<table>
  <tr>
    <td align="center">
      <strong>Dashboard</strong><br>
      <em>Coming soon</em>
    </td>
    <td align="center">
      <strong>Room Expanded</strong><br>
      <em>Coming soon</em>
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Edit Mode</strong><br>
      <em>Coming soon</em>
    </td>
    <td align="center">
      <strong>Settings</strong><br>
      <em>Coming soon</em>
    </td>
  </tr>
</table>

---

## Installation

### Quick Start (Docker)

```bash
docker run -d \
  --name giraff \
  -p 3000:3000 \
  --restart unless-stopped \
  ghcr.io/twinbolt-ab/giraff:latest
```

Open `http://localhost:3000` and follow the setup wizard to connect to Home Assistant.

<details>
<summary><strong>Docker Compose</strong></summary>

```yaml
services:
  giraff:
    image: ghcr.io/twinbolt-ab/giraff:latest
    container_name: giraff
    ports:
      - "3000:3000"
    restart: unless-stopped
```

</details>

<details>
<summary><strong>Development Setup (npm)</strong></summary>

```bash
# Clone the repository
git clone https://github.com/twinbolt-ab/giraff.git
cd giraff

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:3000` and follow the setup wizard.

</details>

<details>
<summary><strong>Home Assistant Add-on (Recommended)</strong></summary>

The easiest way to run Giraff — auto-connects to Home Assistant, no setup required!

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**
2. Click the menu (⋮) → **Repositories**
3. Add: `https://github.com/twinbolt-ab/giraff`
4. Find "Giraff Dashboard" and click **Install**
5. Start the add-on and click **Open Web UI**

The add-on appears in your sidebar and connects automatically using your HA credentials.

</details>

---

## Configuration

### Home Assistant Add-on

**No configuration needed!** The add-on automatically connects using your Home Assistant credentials.

### Docker / Standalone

Giraff uses an **in-app setup wizard** — no environment variables needed!

1. Open Giraff in your browser
2. The setup wizard will guide you through connecting to Home Assistant
3. Your credentials are stored securely in the browser

### Getting a Long-Lived Access Token

For Docker/standalone installations, you'll need a token:

1. In Home Assistant, click your profile (bottom left)
2. Scroll to **Long-Lived Access Tokens**
3. Click **Create Token**
4. Name it "Giraff" and copy the token

---

## Roadmap

Giraff is currently in **beta**. Core functionality is working, but expect some rough edges.

### What's Working
- Floor and room organization
- Light, switch, scene, climate, cover, and fan controls
- Brightness gesture controls
- Edit mode for renaming and reorganizing
- Light and dark themes
- Setup wizard

### What's Planned
- [ ] Media player controls
- [ ] Vacuum controls
- [ ] Lock controls
- [ ] Push notifications
- [ ] Multiple dashboard layouts
- [ ] Localization (i18n)

### Known Issues
See [open issues](https://github.com/twinbolt-ab/giraff/issues) for current bugs and feature requests.

---

## Contributing

Contributions are welcome! Whether it's bug reports, feature requests, or pull requests — all help is appreciated.

### Quick Start

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run linting (`npm run lint`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## Community

- **Issues** — [Report bugs or request features](https://github.com/twinbolt-ab/giraff/issues)
- **Discussions** — [Ask questions and share ideas](https://github.com/twinbolt-ab/giraff/discussions)
<!-- - **Discord** — [Join our community](https://discord.gg/your-invite) -->

If you find Giraff useful, consider giving it a star! It helps others discover the project.

---

## Tech Stack

- [Next.js 14](https://nextjs.org/) — React framework with App Router
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first styling
- [TanStack Query](https://tanstack.com/query) — Server state management
- [Framer Motion](https://www.framer.com/motion/) — Animations
- [Lucide](https://lucide.dev/) — Icons

---

## License

This project is licensed under the [Elastic License 2.0 (ELv2)](LICENSE).

**You can:**
- Use Giraff for personal and internal business purposes
- View, modify, and contribute to the source code
- Self-host for your own use

**You cannot:**
- Provide Giraff as a managed/hosted service to others
- Remove or obscure license notices

---

## Acknowledgments

- [Home Assistant](https://www.home-assistant.io/) for the incredible smart home platform
- The Home Assistant community for inspiration and feedback
- [ha-fusion](https://github.com/matt8707/ha-fusion) and [Dwains Dashboard](https://github.com/dwainscheeren/dwains-lovelace-dashboard) for README inspiration

---

<p align="center">
  Made with care by <a href="https://twinbolt.se">Twinbolt</a>
</p>
