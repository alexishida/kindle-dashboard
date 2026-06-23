# Kindle Dashboard

Desktop dashboard for tracking AI tool usage and displaying an always-fresh
image on a jailbroken Kindle Paperwhite.

The app runs on the PC via Electron, collects local data, renders a high
contrast PNG, and serves it at `http://<IP_DO_PC>:8787/dash.png`. The Kindle
downloads that image on the local network and draws it on screen with FBInk.

This project does not jailbreak the Kindle. It assumes the device is already
prepared, with SSH and FBInk working.

## Key Features

- AI usage dashboard for Claude Code and OpenAI Codex.
- Atomic PNG render optimized for e-ink screens.
- Local server with `/dash.png`, `/render`, `/api/ping`, `/api/auth`, and `/api/usage`.
- Kindle setup through the UI: IP, SSH port, SSH user, password, PNG URL, and intervals.
- Remote diagnostics for SSH, jailbreak, FBInk, hotfix, and installed scripts.
- Install, remove, start, and stop Kindle scripts from the UI.
- Windows tray actions to open the panel, open settings, refresh, and quit.
- Always-on-top desktop `Picture-in-Picture` window with configurable scale.
- Multilingual desktop UI and rendered PNG.
- Current languages: `pt-BR`, `en`, and `es`, with fallback to `en`.

## Screenshots

| Panel | Kindle Configuration |
| --- | --- |
| ![Panel](screenshot/painel.jpg) | ![Kindle Configuration](screenshot/kindle-config.jpg) |

| Diagnostics and Installation | Logins |
| --- | --- |
| ![Diagnostics and Installation](screenshot/kindle-install.jpg) | ![Logins](screenshot/logins.jpg) |

![Kindle example](screenshot/exemplo.jpg)

## How It Works

1. The PC opens the Electron app and starts the local backend.
2. The backend collects local AI tool data.
3. The main process renders the `/render` page as a PNG.
4. The app publishes the image at `/dash.png`.
5. The Kindle downloads the PNG over HTTP on the configured interval.
6. The Kindle script uses FBInk to update the screen.

In the Electron app, the PC render interval follows the Kindle download
interval. This keeps the PC from rendering faster than the Kindle downloads.

## Requirements

### PC

- Windows 10 or Windows 11.
- Node.js `>=24` for development.
- Claude Code and/or OpenAI Codex installed if you want usage from those tools.

### Kindle

- Kindle Paperwhite with jailbreak already completed.
- SSH enabled and reachable on the local network.
- FBInk installed.
- Kindle and PC on the same Wi-Fi network.

## User Installation

Download the `.exe` installer from a release, or build it locally:

```powershell
npm run build:win
```

Then run the installer on Windows and open **Kindle Dashboard** from the Start
Menu.

If setup is already complete, the app can start directly in the background and
stay available in the Windows tray.

## First Run

Open **Kindle > Configuration** and fill in:

| Field | Expected value |
| --- | --- |
| Kindle IP | `<IP_DO_KINDLE>` |
| SSH Port | Usually `22` |
| SSH User | `<USUARIO_SSH>` |
| SSH Password | `<SENHA_SSH>` |
| PC IP | `<IP_DO_PC>` |
| Kindle Download | Interval, in seconds, between PNG downloads |
| Full Refresh | How many cycles between full Kindle refreshes |
| Wi-Fi Retry | How many consecutive failures before Wi-Fi recovery |

Then:

1. Click **Save**.
2. Open **Kindle > Diagnostics and Installation**.
3. Click **Check Kindle**.
4. Confirm that SSH, jailbreak, FBInk, and other checks are OK.
5. Click **Install scripts**.
6. Open **Logins** and resolve Claude Code or Codex login issues if they appear.

Once scripts are installed, the Kindle downloads and displays the PNG on its
own, including after reboot.

## Daily Use

- **Panel** shows the current PNG preview and can force a new render.
- **Kindle > Diagnostics** starts or stops the Kindle loop without removing autostart.
- **Logins** shows local authentication state.
- **Settings** changes language and toggles `Picture-in-Picture`.
- `Picture-in-Picture` shows the dashboard in a small always-on-top window.
- The Windows tray can reopen the panel, open settings, refresh, and quit.

To remove Kindle automation, use **Uninstall** in
**Kindle > Diagnostics and Installation**. Manual guide:
[KINDLE-INSTALLATION.md](KINDLE-INSTALLATION.md).

## Multilingual Support

Translatable text lives in `locales/<language>.json`.

The app discovers languages automatically from files in `locales/`. Adding a
new language does not require TypeScript changes: create a BCP-47 JSON file,
translate values, and keep the keys. Missing keys fall back to `locales/en.json`.

Details: [locales/README.md](locales/README.md).

## Privacy

Docs and examples must use placeholders:

- `<IP_DO_PC>`
- `<IP_DO_KINDLE>`
- `<USUARIO_SSH>`
- `<SENHA_SSH>`

Do not commit:

- Kindle serial number;
- real PC or Kindle IP;
- real username;
- SSH password;
- tokens, cookies, local databases, or session files;
- logs, builds, installers, or runtime PNGs.

The SSH password saved by the app lives in Electron `userData` and uses
`safeStorage` when available. The renderer receives only public state, such as
`kindlePasswordSaved`.

## Development

Install dependencies:

```powershell
npm install
```

Run the app in development:

```powershell
npm run dev
```

Main commands:

```powershell
npm run dev                # opens Electron in development
npm run build              # typecheck + Electron build
npm run build:win          # generates Windows installer
npm run typecheck          # validates TypeScript
npm test                   # runs Node tests
npm run backend            # legacy standalone backend
npm run supervisor         # legacy standalone supervisor
npm run autostart:install  # registers Windows autostart
npm run autostart:status   # shows Windows autostart status
npm run autostart:stop     # stops Windows autostart
npm run autostart:uninstall # removes Windows autostart
```

Kindle commands should be run through the Electron UI. The `npm run kindle` and
`npm run kindle:autostart` scripts exist for support and local diagnostics.

## Structure

```text
backend/       local API, collectors, and authentication preflight
build/         app icons
kindle/        scripts executed on the Kindle
locales/       UI, main, auth, and dashboard translations
render/        HTML used to render the PNG
scripts/       Node and PowerShell helpers
src/main/      Electron main process
src/preload/   secure bridges via contextBridge
src/renderer/  React UI
src/shared/    shared types
test/          Node tests
```

## Windows Installer Build

```powershell
npm run build:win
```

This command runs:

1. `npm run typecheck`
2. `electron-vite build`
3. `electron-builder --win`

Expected output:

```text
release/Kindle-Dashboard-<version>-setup.exe
```

## Recommended Validation

```powershell
npm test
npm run typecheck
npm run build
```

Before publishing a release, also check that examples still use placeholders:

```powershell
rg -n "<IP_DO_PC>|<IP_DO_KINDLE>|<USUARIO_SSH>|<SENHA_SSH>" README.md KINDLE-INSTALLATION.md
```

## Links

- Change history: [CHANGELOG.md](CHANGELOG.md)
- Kindle installation: [KINDLE-INSTALLATION.md](KINDLE-INSTALLATION.md)
- Translations: [locales/README.md](locales/README.md)
- Releases: [GitHub Releases](https://github.com/alexishida/kindle-dashboard/releases)
