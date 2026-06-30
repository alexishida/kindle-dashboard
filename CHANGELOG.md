# Changelog

All notable changes to this project are documented here.

## [v1.0.5](https://github.com/alexishida/kindle-dashboard/releases/latest) - 2026-06-30

Kindle Dashboard v1.0.5

### Fixed

- Fixed Codex local usage parsing so newer `token_count` events win over older archived rollout files whose filesystem timestamp changed later.
- Fixed Claude usage caching so expired `5h`/`7d` windows are removed instead of being shown as current data.
- Claude now marks fully expired cached limits as stale with a localized dashboard note.

### Tests

- Added collector coverage for Codex archive timestamp drift.
- Added collector coverage for Claude cached and stale expired-window cases.

### Version

- App version bumped to `1.0.5`.

## [v1.0.4](https://github.com/alexishida/kindle-dashboard/releases/latest) - 2026-06-29

Kindle Dashboard v1.0.4

### Fixed

- Kindle loop script now exits gracefully after `MAX_FAILURES` consecutive download failures (default: 6), returning normal Kindle behavior instead of looping forever when the PC is off.
- `preventScreenSaver` is now released on script exit (any cause), fixing the white screen when opening KUAL while the loop was running.
- Uninstall now removes all files from the Kindle (`dash-loop.sh`, `dash-autostart.env`, logs, pidfile, and `dash.png`).
- Dashboard panel tab is no longer locked when the Kindle script is not installed — the local preview works independently of the Kindle setup.

### Version

- App version bumped to `1.0.4`.

## [v1.0.3](https://github.com/alexishida/kindle-dashboard/releases/latest) - 2026-06-23

Kindle Dashboard v1.0.3

### Fixed

- Fixed Codex local usage parsing so the dashboard keeps showing the live `7d` window even when `5h` data expires first or arrives in a different rollout event.

### Tests

- Added collector coverage for mixed Codex rollout cases, including weekly window recovery and `window_minutes`-based naming.

### Version

- App version bumped to `1.0.3`.

## [v1.0.2](https://github.com/alexishida/kindle-dashboard/releases/latest) - 2026-06-22

Kindle Dashboard v1.0.2

### Added

- Desktop `Picture-in-Picture` floating window to follow the dashboard outside the main app window.
- Toggle to enable or disable `Picture-in-Picture` from **Settings**.
- Floating window scale option (`1x` to `2x`) saved in local preferences.
- Multilingual support for the interface, rendered dashboard text, and authentication messages.
- Initial languages: `pt-BR`, `en`, and `es`.

### Improved

- Automatic `Picture-in-Picture` refresh after each dashboard render.
- Floating window close action now syncs with the saved preference, keeping main process and UI state consistent.
- `Picture-in-Picture` settings text added in `pt-BR`, `en`, and `es`.
- Language preference can follow the system language and falls back to `en` for missing keys.

### Technical

- Preload bundle adjusted to generate a dedicated preload for the `Picture-in-Picture` window.
- Persisted app configuration expanded with `pictureInPicture` and `pictureInPictureScale`.

### Version

- App version bumped to `1.0.2`.

## [v1.0.1](https://github.com/alexishida/kindle-dashboard/releases/latest) - 2026-06-18

Kindle Dashboard v1.0.1

### Fixed

- Fixed Codex collector fallback so it prioritizes still-valid `rate_limits` before marking data as stale.
- Fixed a case where the dashboard showed `local limits outdated (Codex used outside the CLI)` even when newer rollout data had live `5h` and `7d` windows.

### Tests

- Added automated test coverage to ensure the Codex collector prefers live limits over stale fallback data.

### Version

- App version bumped to `1.0.1`.

## [v1.0.0](https://github.com/alexishida/kindle-dashboard/releases/tag/v1.0.0) - 2026-06-18

Kindle Dashboard v1.0.0

Desktop dashboard for monitoring AI tool usage (Claude Code, Codex) and displaying it in real time on a jailbroken Kindle Paperwhite.

### Features

- Live panel with generated PNG preview and manual refresh button.
- Automatic collection from local Claude Code and Codex logs.
- Atomic render that generates an e-ink-optimized PNG and serves it over the local network.
- Kindle setup over SSH: IP, port, user, password, autostart script installation and removal.
- Windows tray: starts in the background, with tray icon and quick menu.
- Integrated diagnostics for jailbreak, SSH, FBInk, and remote script status.
- Optional Windows autostart registration.
