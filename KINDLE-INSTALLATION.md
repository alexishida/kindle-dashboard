# Kindle Installation

Kindle-side guide for Kindle Dashboard. Use it after the device already has a
working jailbreak, SSH, and FBInk.

This project does not jailbreak the Kindle, install FBInk, or remove jailbreak
components. It only validates a prepared device, uploads dashboard scripts, and
registers a reversible startup job.

## Overview

The PC renders `dash.png` and serves it at:

```text
http://<IP_PC>:8787/dash.png
```

The Kindle runs a local loop that:

1. downloads that PNG on the local network;
2. saves the image to `/mnt/us/dash.png`;
3. draws the image on screen with FBInk;
4. repeats on the configured interval.

## Prerequisites

On the Kindle:

- jailbreak already completed;
- SSH enabled and reachable on the local network;
- FBInk installed;
- `/mnt/us` available;
- `initctl` available;
- `mntroot` available;
- expected hotfix/Upstart present at `/etc/upstart/kmc.conf`.

On the PC:

- Kindle Dashboard installed or running in development;
- PC and Kindle on the same Wi-Fi network;
- port `8787` reachable from the Kindle;
- setup completed in the Electron UI.

## UI Configuration

Open **Kindle > Configuration** in the app and fill in:

| Field | Value |
| --- | --- |
| Kindle IP | `<IP_KINDLE>` |
| SSH Port | usually `22` |
| SSH User | `<SSH_USER>` |
| SSH Password | `<SSH_PASSWORD>` |
| PC IP | `<IP_PC>` |
| Kindle Download | seconds between PNG downloads |
| Full Refresh | cycles between full anti-ghosting refreshes |
| Wi-Fi Retry | consecutive failures before Wi-Fi recovery |

The UI builds the final PNG URL as:

```text
http://<IP_PC>:8787/dash.png
```

The SSH password is saved locally in Electron `userData` and uses `safeStorage`
when available. The renderer does not receive the password as plain text.

## Recommended Flow

Use the Electron UI for the normal flow:

1. **Save** Kindle configuration.
2. **Check Kindle** to validate SSH, jailbreak, FBInk, hotfix, and required commands.
3. **Install scripts** to copy files and register autostart.
4. **Start script** or **Stop script** to control the loop without removing autostart.
5. **Uninstall** to remove dashboard autostart and launcher files.

The `npm run kindle` and `npm run kindle:autostart` commands exist for support
and local diagnostics. For normal use, prefer the UI so state and configuration
stay in one place.

## Installed Files

During **Install scripts**, the app uploads or creates:

| Kindle path | Purpose |
| --- | --- |
| `/mnt/us/dash-loop.sh` | Downloads the PNG from the PC and displays it with FBInk in a loop. |
| `/mnt/us/dash-autostart.sh` | Waits for Wi-Fi and starts the loop. |
| `/mnt/us/dash-autostart.env` | Stores the PNG URL and dashboard intervals. |
| `/mnt/us/kindle-dashboard.conf` | Removable copy of the Upstart job. |
| `/etc/upstart/kindle-dashboard.conf` | Upstart job that calls the launcher on boot. |

The installer only replaces `/etc/upstart/kindle-dashboard.conf` when the
existing file belongs to Kindle Dashboard. If an unknown job already exists at
the same path, installation fails instead of overwriting it.

To write into `/etc/upstart`, the installer remounts the root filesystem as
`rw`, copies the job, reloads Upstart, and tries to return the root filesystem
to `ro`.

## Dashboard Environment

`/mnt/us/dash-autostart.env` contains the configuration used by the launcher:

```sh
PC='http://<IP_PC>:8787/dash.png'
INTERVAL='45'
FULL_EVERY='20'
WIFI_RETRY_EVERY='3'
```

Fields:

- `PC`: required URL for the PNG served by the PC.
- `INTERVAL`: seconds between downloads.
- `FULL_EVERY`: how many cycles between full refreshes.
- `WIFI_RETRY_EVERY`: consecutive failures before Wi-Fi reconnect attempt.

If `PC` is empty, the loop exits with an error. It does not fall back to an old
IP address.

## Boot Behavior

The `/etc/upstart/kindle-dashboard.conf` job runs when the Kindle framework is
ready. It calls:

```sh
/mnt/us/dash-autostart.sh
```

The launcher:

- does not start if `/mnt/us/dash-autostart.disabled` exists;
- loads `/mnt/us/dash-autostart.env`;
- validates that `PC` is configured;
- waits up to 60 seconds for `/mnt/us/dash-loop.sh`;
- waits up to 90 seconds for Wi-Fi to become `CONNECTED`;
- removes `/mnt/us/dash-loop.stop`;
- starts `dash-loop.sh` in the background;
- writes logs to `/mnt/us/dash-autostart.log`.

## Loop Behavior

`dash-loop.sh`:

- keeps the screen awake through `lipc-set-prop com.lab126.powerd preventScreenSaver 1`;
- downloads the PNG to `/mnt/us/dash.png.tmp`;
- moves it to `/mnt/us/dash.png` only when the download has content;
- uses `fbink -g file=/mnt/us/dash.png -W GC16`;
- performs periodic full refreshes with `fbink -f -c`;
- logs download failures to `/mnt/us/dash-loop.log`;
- tries to recover Wi-Fi after repeated failures;
- uses `/mnt/us/dash-loop.pid` to avoid duplicate instances;
- stops when `/mnt/us/dash-loop.stop` exists.

## Expected Status

After installation, the UI shows the script's public state:

| Field | Meaning |
| --- | --- |
| Autostart | Upstart job installed or missing |
| Enabled | autostart enabled or disabled by `.disabled` file |
| Upstart | state reported by `initctl` |
| Loop | process running or stopped |
| Backend | PC reachable through `/api/ping` |

If `Backend` is unavailable, check:

- PC and Kindle are on the same network;
- app is open or running in the background;
- port `8787` is allowed by the firewall;
- URL `http://<IP_PC>:8787/dash.png` is reachable from the Kindle;
- PC IP is up to date in configuration.

## Start and Stop Without Uninstalling

**Stop script**:

- creates `/mnt/us/dash-autostart.disabled`;
- creates `/mnt/us/dash-loop.stop`;
- terminates the pidfile process if it is running;
- keeps installed files available for later reactivation.

**Start script**:

- removes `/mnt/us/dash-autostart.disabled`;
- calls `/mnt/us/dash-autostart.sh`;
- restarts the loop if configuration and Wi-Fi are OK.

## Uninstall

In the UI, use **Uninstall** under **Kindle > Diagnostics and Installation**.

This:

- stops the loop;
- removes `/etc/upstart/kindle-dashboard.conf` if it is the Kindle Dashboard job;
- reloads Upstart configuration;
- removes `/mnt/us/dash-autostart.sh`;
- removes `/mnt/us/kindle-dashboard.conf`;
- removes `/mnt/us/dash-autostart.disabled`.

Runtime files may remain for auditing or manual cleanup.

## Optional Manual Cleanup

After uninstalling and confirming the job was removed, you can clean runtime
files directly on the Kindle:

```sh
rm -f /mnt/us/dash-loop.sh \
      /mnt/us/dash-loop.pid \
      /mnt/us/dash-loop.log \
      /mnt/us/dash-loop.stop \
      /mnt/us/dash-autostart.log \
      /mnt/us/dash-autostart.env \
      /mnt/us/dash.png
```

This cleanup removes only Kindle Dashboard files. Do not remove jailbreak,
FBInk, KUAL, USBNetwork, or hotfix files through this project.

## Privacy

Do not put these in this file:

- Kindle serial number;
- real PC or Kindle IP;
- real username;
- SSH password;
- tokens, cookies, local databases, or session files;
- private logs.

Always use placeholders:

- `<IP_PC>`
- `<IP_KINDLE>`
- `<SSH_USER>`
- `<SSH_PASSWORD>`
