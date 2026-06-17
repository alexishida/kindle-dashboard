# Kindle Dashboard

Dashboard desktop para acompanhar uso de ferramentas de IA e exibir a imagem em
um Kindle Paperwhite com jailbreak.

O aplicativo roda no PC via Electron, coleta dados locais, renderiza um PNG e
serve esse PNG na rede local. O Kindle apenas baixa a imagem periodicamente e a
desenha na tela com FBInk.

## Estado Atual

- Aplicativo Electron + React + TypeScript integrado com `electron-vite`.
- Backend Node embutido no processo principal do Electron.
- Render atomico do PNG em `out/dash.png` no modo dev.
- Tray do Windows com acoes para abrir painel, abrir configuracoes, atualizar e
  encerrar.
- Fluxo de primeira execucao com configuracao do Kindle por SSH.
- Verificacao local de login para Claude Code e Codex.
- Instalador de scripts no Kindle via SSH, sem SFTP.

O projeto nao executa jailbreak. Ele assume que o Kindle ja esta desbloqueado,
com SSH e FBInk disponiveis.

## Requisitos

- Windows.
- Node.js 24 ou superior.
- Kindle Paperwhite com jailbreak.
- Acesso SSH ao Kindle pela rede.
- FBInk instalado no Kindle.
- Claude Code e Codex instalados no PC, se voce quiser mostrar esses dados.

## Primeira Execucao

```powershell
npm install
npm run dev
```

Na primeira abertura, o app mostra a tela de configuracao:

| Campo | Valor esperado |
| --- | --- |
| IP do Kindle | `<IP_DO_KINDLE>` |
| Porta SSH | `<PORTA_SSH>` normalmente `22` |
| Usuario SSH | `<USUARIO_SSH>` |
| Senha SSH | `<SENHA_SSH>` |
| URL do PNG | `http://<IP_DO_PC>:8787/dash.png` |

Depois de salvar:

1. Clique em `Verificar Kindle`.
2. Confirme que SSH, jailbreak, FBInk e hotfix aparecem como OK.
3. Clique em `Injetar scripts`.
4. Corrija logins de Claude/Codex se o diagnostico pedir.

Nas proximas execucoes, se a configuracao ja estiver completa, o app inicia em
segundo plano e fica disponivel no tray.

## Scripts NPM

```powershell
npm run dev              # abre o app Electron em desenvolvimento
npm run build            # typecheck + build Electron
npm run build:win        # gera instalador Windows
npm run typecheck        # valida TypeScript
npm test                 # roda testes Node
npm run backend          # backend legado independente
npm run supervisor       # fallback legado com Chrome instalado
npm run kindle -- ...    # helper SSH manual
npm run kindle:autostart -- ... # instala/opera scripts no Kindle
```

## Variaveis de Ambiente

Copie `.env.example` para `.env` se precisar rodar helpers manuais. Nunca
commite `.env`.

| Variavel | Uso |
| --- | --- |
| `PORT` | Porta HTTP local. Padrao: `8787`. |
| `RENDER_INTERVAL` | Intervalo de render no PC, em segundos. |
| `DASHBOARD_URL` | URL completa do PNG para o Kindle. |
| `KINDLE_IP` | Endereco do Kindle. |
| `KINDLE_PORT` | Porta SSH do Kindle. |
| `KINDLE_USER` | Usuario SSH do Kindle. |
| `KINDLE_PW` | Senha SSH do Kindle. |
| `KINDLE_REFRESH_INTERVAL` | Intervalo de download no Kindle. |
| `KINDLE_FULL_REFRESH_EVERY` | Full refresh a cada N ciclos. |
| `KINDLE_WIFI_RETRY_EVERY` | Tentativa de recuperar Wi-Fi apos N falhas. |

## Comandos Kindle

Teste SSH:

```powershell
$env:KINDLE_IP = "<IP_DO_KINDLE>"
$env:KINDLE_PORT = "<PORTA_SSH>"
$env:KINDLE_USER = "<USUARIO_SSH>"
$env:KINDLE_PW = "<SENHA_SSH>"
npm run kindle -- run "uname -a"
```

Instalar autostart manualmente:

```powershell
$env:DASHBOARD_URL = "http://<IP_DO_PC>:8787/dash.png"
npm run kindle:autostart -- install
```

Outras acoes:

```powershell
npm run kindle:autostart -- status
npm run kindle:autostart -- stop
npm run kindle:autostart -- start
npm run kindle:autostart -- uninstall
```

Mais detalhes: [KINDLE-INSTALACAO.md](KINDLE-INSTALACAO.md).

## Privacidade

Nao commitar:

- Serial do Kindle.
- IP real do PC ou Kindle.
- Senha SSH.
- Tokens, cookies, bancos locais ou arquivos de sessao.
- `out/dash.png`, logs, builds, instaladores e configs locais.
- Arquivos `.env` ou `config.json` do Electron.

Dados sensiveis ficam fora do renderer. A senha SSH salva pelo app fica no
diretorio `userData` do Electron e usa `safeStorage` quando disponivel.

## Estrutura

```text
backend/       API local, coletores e preflight de auth
build/         icones do app
kindle/        scripts que rodam no Kindle
render/        HTML usado para gerar o PNG
scripts/       helpers Node/PowerShell
src/main/      processo principal Electron
src/preload/   ponte segura via contextBridge
src/renderer/  UI React
src/shared/    tipos compartilhados
test/          testes Node
```

## Validacao Recomendada

```powershell
npm test
npm run typecheck
```

Use `npm run build` antes de gerar instalador ou publicar uma versao.
