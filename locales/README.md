# Translations / Traduções

Every translatable string in Kindle Dashboard lives here. One file per language.
Adding a language needs **no code changes** — drop a JSON file and it shows up in
the app automatically.

Cada string traduzível do Kindle Dashboard fica aqui. Um arquivo por idioma.
Adicionar um idioma **não exige mexer no código** — basta criar um JSON e ele
aparece sozinho no app.

## Add a language / Adicionar um idioma

1. Copy `en.json` to `<code>.json` using a BCP-47 code (e.g. `fr.json`,
   `de.json`, `pt-PT.json`). / Copie `en.json` para `<código>.json` com um código
   BCP-47 (ex.: `fr.json`, `de.json`, `pt-PT.json`).
2. Translate the **values**, never the keys. / Traduza os **valores**, nunca as
   chaves.
3. Fill `meta`: `name` is the native label shown in the language picker, `locale`
   is the BCP-47 tag used for number/date/currency formatting, `currency` is the
   default ISO-4217 currency for the dashboard. / Preencha `meta`: `name` é o nome
   nativo exibido no seletor, `locale` é a tag BCP-47 para formatar
   número/data/moeda, `currency` é a moeda ISO-4217 padrão do dashboard.
4. Keep placeholders like `{value}`, `{field}`, `{expiresAt}` intact — they are
   replaced at runtime. / Mantenha os marcadores como `{value}`, `{field}`,
   `{expiresAt}` — eles são substituídos em tempo de execução.
5. Save the file as **UTF-8 (no BOM)**. / Salve o arquivo como **UTF-8 (sem BOM)**.

That's it. The picker, the rendered PNG and the login checks all pick the new
file up. / Pronto. O seletor, o PNG gerado e as checagens de login passam a usar
o novo arquivo.

## Namespaces

| Key         | Where it shows / Onde aparece                                  |
|-------------|----------------------------------------------------------------|
| `meta`      | Language metadata (name, locale, currency)                     |
| `ui`        | Electron app interface / Interface do app Electron             |
| `main`      | Tray, notifications, validation errors / Tray, avisos, erros   |
| `auth`      | Claude/Codex login check / Checagem de login Claude/Codex      |
| `dashboard` | Text rendered onto the Kindle PNG / Texto do PNG do Kindle     |

Missing keys fall back to `en.json`, so a partial translation still works. /
Chaves faltando caem para `en.json`, então uma tradução parcial já funciona.
