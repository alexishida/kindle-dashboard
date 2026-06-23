# Translations

Every translatable string in Kindle Dashboard lives here. Use one JSON file per
language.

Adding a language needs no code changes. Drop a locale JSON file into this
directory and the app picks it up automatically.

## Add a Language

1. Copy `en.json` to `<code>.json` using a BCP-47 code, such as `fr.json`,
   `de.json`, or `pt-PT.json`.
2. Translate the values, never the keys.
3. Fill `meta`:
   - `name`: native label shown in the language picker.
   - `locale`: BCP-47 tag used for number, date, and currency formatting.
   - `currency`: default ISO-4217 currency for the dashboard.
4. Keep placeholders like `{value}`, `{field}`, and `{expiresAt}` intact. They
   are replaced at runtime.
5. Save the file as UTF-8 without BOM.

After that, the language picker, rendered PNG, and login checks all use the new
file automatically.

## Namespaces

| Key | Where it shows |
| --- | --- |
| `meta` | Language metadata: name, locale, currency |
| `ui` | Electron app interface |
| `main` | Tray, notifications, and validation errors |
| `auth` | Claude/Codex login checks |
| `dashboard` | Text rendered onto the Kindle PNG |

Missing keys fall back to `en.json`, so partial translations still work.
