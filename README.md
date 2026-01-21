<p align="center">
  <img src="public/icon.png" alt="Stuga" width="120" height="120">
</p>

<h1 align="center">Stuga</h1>

<p align="center">
  <strong>A beautiful, opinionated Home Assistant dashboard</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Home%20Assistant-2024.1+-41BDF5?logo=home-assistant&logoColor=white" alt="Home Assistant">
  <img src="https://img.shields.io/badge/iOS-17+-000000?logo=apple&logoColor=white" alt="iOS">
  <img src="https://img.shields.io/badge/Android-14+-3DDC84?logo=android&logoColor=white" alt="Android">
  <img src="https://img.shields.io/badge/license-PolyForm%20NC-blue" alt="License">
</p>

---

I love Home Assistant. I don't love configuring dashboards.

Stuga is what I wanted: a fast, polished app that just works. Open it, log in, done. Your rooms, devices, and floors are already there. No YAML. No cards. No templates.

Built for my family to actually use.

<p align="center">
  <img src="public/screenshots/room-grid.jpg" alt="Room overview" width="200">
  <img src="public/screenshots/kitchen-expanded.jpg" alt="Room expanded" width="200">
  <img src="public/screenshots/device-editor.jpg" alt="Device editor" width="200">
</p>

---

## What it does

- **Zero config** — Reads your HA setup automatically
- **In-place editing** — Rename rooms, change icons, reorder things. All saved back to HA.
- **Mobile-first** — Designed for phones. Works on tablets and web too.
- **Fast** — WebSocket connection, instant updates

---

## Get Started

### iOS & Android (Recommended)

Native apps work with any Home Assistant setup, including local-only installs.

- **iOS** — Coming soon to the App Store. Free.
- **Android** — Coming soon to Google Play. Free.

### Web

Try the web app at [stuga.app/run](https://stuga.app/run).

**Requirements:**
- A public HTTPS URL for your Home Assistant (Nabu Casa, DuckDNS, etc.)
- Add Stuga to your `configuration.yaml`:

```yaml
http:
  cors_allowed_origins:
    - https://stuga.app
```

Local addresses like `homeassistant.local` won't work from the web due to browser security. Use the native apps for local-only setups.

### Self-hosted

Run Stuga on your own server or local network:

```bash
npm install
npm run build
# Serve the dist/ folder
```

Self-hosting on HTTP allows connecting to local Home Assistant without a public URL.

---

## Supports

Lights, switches, scenes, climate, covers, fans. More coming.

---

## Development

```bash
npm install
npm run dev
```

Built with Vite, React, Tailwind, Framer Motion, and Capacitor.

---

## Roadmap

**Now:**
- Polish based on community feedback

**Soon:**
- Light temperature support
- Custom tabs (favorite rooms and devices)

**Later:**
- Edit scenes
- Add new devices through the app
- Automations workflow / custom scripts
- Languages
- Widgets
- More themes
- Multi-instance support
- Apple Watch / Wear OS

---

## Feedback

Have ideas or questions? Join the [Discussions](https://github.com/twinbolt-ab/stuga/discussions).

Found a bug? Open an [Issue](https://github.com/twinbolt-ab/stuga/issues).

---

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — Free for personal use. No commercial use allowed.

---

<p align="center">
  Made by <a href="https://twinbolt.se">Twinbolt</a> in Sweden
</p>
