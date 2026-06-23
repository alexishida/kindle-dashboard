# Kindle Installation

This guide describes the Kindle-side flow once the device already has a
working jailbreak, SSH, and FBInk.

Do not put the serial number, real IP, real user, password, token, or logs
of your device in this file. Always use placeholders.

## What the App Installs

During `Inject scripts` or `npm run kindle:autostart -- install`, the PC sends:

| Remote file | Function |
| --- | --- |
| `/mnt/us/dash-loop.sh` | Downloads the PNG from the PC and displays it with FBInk in a loop. |
| `/mnt/us/dash-autostart.sh` | Waits for Wi-Fi and starts the loop. |
| `/mnt/us/dash-autostart.env` | Local dashboard configuration on the Kindle. |
| `/mnt/us/kindle-dashboard.conf` | Removable copy of the Upstart job. |
| `/etc/upstart/kindle-dashboard.conf` | Boot job that calls the launcher. |

The Upstart job should only be installed once the Kindle passes the
preflight checks:

- SSH connected.
- `/mnt/us` available.
- `fbink` available.
- `initctl` available.
- `mntroot` available.
- Expected Hotfix/Upstart available.

## Configuration via the App

In the Electron configuration screen, provide:

| Field | Safe example |
| --- | --- |
| Kindle IP | `<KINDLE_IP>` |
| SSH Port | `<SSH_PORT>` |
| SSH User | `<SSH_USER>` |
| SSH Password | `<SSH_PASSWORD>` |
| PNG URL | `http://<PC_IP>:8787/dash.png` |

The app saves the configuration locally in Electron's `userData`. The
password is not passed to the renderer as plain text.

## Recommended Flow

Use only the Electron UI to:

- save connection data
- validate SSH access
- install scripts on the Kindle
- check status
- remove autostart

This avoids parallel configuration via environment variables and keeps the
product state in one place.

## Behavior on the Kindle

`dash-autostart.sh` loads `/mnt/us/dash-autostart.env`. This file must
contain at least:

```sh
PC='http://<PC_IP>:8787/dash.png'
INTERVAL='45'
FULL_EVERY='20'
WIFI_RETRY_EVERY='3'
```

`dash-loop.sh` requires `PC` to be configured. Without this URL, the loop
exits with an error instead of trying to use an old address.

The loop:

- downloads the PNG to a temporary file;
- moves it to `/mnt/us/dash.png` only if the download has content;
- uses FBInk to draw the image;
- performs a periodic full refresh;
- tries to recover Wi-Fi after repeated failures;
- uses a pidfile to avoid multiple instances.

## Rollback

```powershell
npm run kindle:autostart -- uninstall
```

Optionally, after confirming the autostart was removed, clean up runtime
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

Do not remove jailbreak components with this project. This cleanup is only
for the dashboard.
