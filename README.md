# Kindle Dashboard

Desktop dashboard to track AI tool usage and display the image on a
jailbroken Kindle Paperwhite.

The app runs on the PC via Electron, collects local data, renders a PNG, and
serves that image on the local network. The Kindle just periodically
downloads the PNG and draws it on screen with FBInk.

This project **does not perform the jailbreak**. It assumes the Kindle is
already unlocked, with SSH and FBInk available.

---

## Screenshots

| Panel | Kindle Configuration |
|---|---|
| ![painel](screenshot/painel.jpg) | ![kindle-config](screenshot/kindle-config.jpg) |
| **Diagnostics and Installation** | **Logins** |
| ![kindle-install](screenshot/kindle-install.jpg) | ![logins](screenshot/logins.jpg) |
| **Example** |
| ![exemplo](screenshot/exemplo.jpg) |

---

## Usage Guide

### 1. Requirements

On the Kindle:

- Kindle Paperwhite with jailbreak done (e.g.: WinterBreak).
- SSH enabled and reachable on the local network.
- FBInk installed.
- Kindle and PC on the same Wi-Fi network.

On the PC (Windows):

- Windows 10/11.
- Optional: Claude Code and/or Codex installed, if you want the dashboard to
  show usage of those tools.

### 2. Install the app on the PC

Download the `.exe` installer (generated via `npm run build:win`, see
[Development Information](#development-information)) and run it normally,
like any other Windows program.

After installing, open "Kindle Dashboard" from the Start Menu. On subsequent
launches, if the configuration is already complete, the app starts directly
in the background and stays available in the Windows tray (icon near the
clock).

### 3. Configure the Kindle through the app

On first launch, the app shows the **Kindle > Configuration** tab. Fill in:

| Field | What to enter |
| --- | --- |
| Kindle IP | The Kindle's IP address on the local network |
| SSH Port | Usually `22` |
| SSH User | Usually `root` |
| SSH Password | The Kindle's SSH access password |
| PC IP | Your PC's IP on the same network; the app builds the PNG URL automatically (`http://<PC_IP>:8787/dash.png`) |
| Kindle Download (seconds) | Interval between PNG downloads on the Kindle |
| Full Refresh (cycles) | Every how many downloads the Kindle does a full screen refresh |
| Wi-Fi Retry (consecutive failures) | After how many consecutive failures the Kindle tries to reconnect Wi-Fi |

After clicking **Save**:

1. Open the **Kindle > Script Diagnostics and Installation** tab.
2. Click **Check Kindle** and confirm that SSH, jailbreak, FBInk and other
   checks show up as OK.
3. Click **Install scripts**. This copies the autostart scripts to the
   Kindle and registers the boot job.
4. Go to **Logins** and resolve any pending Claude Code/Codex login issues,
   if the diagnostics ask for it.

With the scripts installed, the Kindle starts downloading and displaying the
PNG on its own, even after rebooting.

### 4. Day-to-day usage

- The main panel (**Panel**) shows a preview of the current image and a
  **Refresh now** button to force a new render.
- In **Kindle > Diagnostics**, use **Start script** and **Stop script** to
  control the loop on the device without removing the autostart.
- The app stays in the Windows tray. Click the icon to reopen the window;
  the tray menu has **Open settings** and **Quit**.
- For the app to start automatically with Windows, use the Windows autostart
  scripts (see [NPM Scripts](#npm-scripts) below).

### 5. Uninstall / remove

To remove the Kindle autostart, use the **Uninstall Script** button in the
**Kindle > Script Diagnostics and Installation** tab, or see the manual
step-by-step in [KINDLE-INSTALLATION.md](KINDLE-INSTALLATION.md).

### Privacy

Do not commit:

- Kindle serial number.
- Real PC or Kindle IP.
- SSH password.
- Tokens, cookies, local databases, or session files.
- `out/dash.png`, logs, builds, installers, and local configs.
- Electron `.env` or `config.json` files.

Sensitive data stays out of the renderer. The SSH password saved by the app
lives in the Electron `userData` directory and uses `safeStorage` when
available.

---

## Development Information

### Current State

- Electron + React + TypeScript application integrated with `electron-vite`.
- Node backend embedded in the Electron main process.
- Atomic PNG render to `out/dash.png` in dev mode.
- Windows tray with actions to open settings and quit.
- First-run flow with Kindle configuration via SSH.
- Local login check for Claude Code and Codex.
- Kindle script installer over SSH, without SFTP.

### Configuration

All operational configuration for the product lives in the Electron UI,
notably:

- Dashboard URL
- Kindle SSH IP, port, user, and password
- download interval
- full refresh
- Wi-Fi recovery retry

The app saves this data in local `userData`. Don't use `.env` for the
normal product flow configuration.

### NPM Scripts

```powershell
npm run dev               # opens the Electron app in development
npm run build              # typecheck + Electron build
npm run build:win          # generates the Windows installer
npm run typecheck          # validates TypeScript
npm test                   # runs Node tests
npm run backend            # legacy standalone backend
npm run supervisor         # legacy fallback with Chrome installed
npm run autostart:install  # registers the app to start with Windows
npm run autostart:status   # checks Windows autostart status
npm run autostart:stop     # stops Windows autostart
npm run autostart:uninstall # removes Windows autostart
```

Kindle-related commands (install/remove scripts, check status) should be
done through the Electron UI. Details on what each remote script does:
[KINDLE-INSTALLATION.md](KINDLE-INSTALLATION.md).

### Structure

```text
backend/       local API, collectors, and auth preflight
build/         app icons
kindle/        scripts that run on the Kindle
render/        HTML used to generate the PNG
scripts/       Node/PowerShell helpers
src/main/      Electron main process
src/preload/   secure bridge via contextBridge
src/renderer/  React UI
src/shared/    shared types
test/          Node tests
```

### Generating the Windows Installer (.exe)

The installer is generated with `electron-builder` in NSIS format.

```powershell
npm run build:win
```

What happens:

1. **`npm run typecheck`** — validates TypeScript.
2. **`electron-vite build`** — compiles main, preload, and renderer into `dist/`.
3. **`electron-builder --win`** — packages the app + dependencies into a `.exe` installer in the `release/` folder.

**Prerequisites:**

- Node.js >= 24 and dependencies installed (`npm install`).
- App icon at `build/icon.png` (already included in the repository).
- Windows 10/11 (cross-building from Linux/Mac is not supported by this project).

The generated installer will be at `release/Kindle-Dashboard-<version>-setup.exe`.

### Recommended Validation

```powershell
npm test
npm run typecheck
```

Run `npm run build` before generating the installer or publishing a release.

### Changelog

- Change history: [CHANGELOG.md](CHANGELOG.md)
- Public releases: [GitHub Releases](https://github.com/alexishida/kindle-dashboard/releases)
