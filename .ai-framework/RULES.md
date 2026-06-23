# Regras do Projeto

Este arquivo e a fonte oficial de regras para o Kindle Dashboard.

## Objetivo

- Construir um app desktop Electron que renderiza um dashboard de uso de IA no
  PC e disponibiliza um PNG para um Kindle Paperwhite com jailbreak.
- O PC coleta dados, renderiza e serve `/dash.png`.
- O Kindle baixa o PNG por HTTP e exibe com FBInk.
- O app nao executa jailbreak; ele apenas verifica e instala scripts quando o
  aparelho ja esta preparado.

## Privacidade e Seguranca

- Nunca commitar serial do Kindle, IP real do PC, IP real do Kindle, usuario
  real, senha, token, cookie, banco local, arquivo de sessao ou log privado.
- Usar placeholders em docs, testes e exemplos: `<IP_DO_PC>`,
  `<IP_DO_KINDLE>`, `<USUARIO_SSH>`, `<SENHA_SSH>`.
- Nao adicionar defaults sensiveis em codigo. Kindle SSH deve vir de config
  salva, env local ou input do usuario.
- `.env`, `.env.*`, logs, PNG runtime, builds e instaladores ficam ignorados.
- Dados sensiveis devem ficar fora do renderer. O renderer recebe apenas estado
  publico e flags como `kindlePasswordSaved`.
- Nao exibir tokens de Claude, Codex ou OpenCode em UI, docs ou logs.
- Nao registrar credenciais completas em erros. Mensagens devem indicar campo
  faltante, nao valor recebido.

Privacy
Do not commit:

Kindle serial number.
Real PC or Kindle IP.
SSH password.
Tokens, cookies, local databases, or session files.
out/dash.png, logs, builds, installers, and local configs.
Electron .env or config.json files.
Sensitive data stays out of the renderer. The SSH password saved by the app lives in the Electron userData directory and uses safeStorage when available.

## Arquitetura

- Manter Electron + React + TypeScript com `electron-vite`.
- O processo main controla janelas, tray, backend, captura PNG, timers, SSH e
  ciclo de vida do app.
- O renderer React e apenas UI operacional.
- O preload e a unica ponte entre renderer e main.
- Nao expor `ipcRenderer`, `require`, `fs` nem ponte generica para o renderer.
- IPC novo deve atualizar juntos:
  - `src/main/index.ts`
  - `src/preload/index.ts`
  - `src/shared/types.ts` ou `src/preload/index.d.ts`
- Manter `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`
  e `sandbox: true` nas janelas.
- Bloquear navegacao externa e `window.open`.
- Manter `requestSingleInstanceLock()` para evitar multiplas instancias.

## Backend e Render

- Porta padrao: `8787`, configuravel por `PORT`.
- No app Electron, o intervalo de render no PC acompanha sempre `kindleRefreshInterval`
  (campo "Download Kindle" da UI / `KINDLE_REFRESH_INTERVAL`) — nao ha intervalo
  independente, para nunca renderizar mais rapido do que o Kindle baixa.
- `scripts/supervisor.js` (modo standalone, sem Electron) usa intervalo proprio
  via `RENDER_INTERVAL`, padrao `60s`.
- `GET /api/ping` deve continuar barato e confiavel.
- `GET /api/auth` verifica credenciais locais sem expor tokens.
- `GET /api/usage` entrega dados normalizados.
- `GET /render` entrega a tela usada para captura.
- `GET /dash.png` entrega o PNG final.
- `GET /kindle/*` serve apenas arquivos dentro de `kindle/`.
- Preservar render atomico: escrever temporario e substituir o PNG final apenas
  depois da captura completa.
- Em dev, runtime pode usar `out/dash.png`; em app empacotado, usar `userData`.

## Kindle

- O Kindle deve ser configurado pelo usuario no primeiro uso.
- Nao assumir IP, usuario ou senha padrao.
- A instalacao deve falhar cedo se `DASHBOARD_URL` ou credenciais SSH faltarem.
- Nao confiar em SFTP. Para uploads, usar o helper Node atual ou download pelo
  Kindle via HTTP.
- Scripts do Kindle devem exigir `PC` configurado e nunca cair em IP antigo.
- Preservar:
  - pidfile;
  - instancia unica;
  - full refresh periodico;
  - recuperacao de Wi-Fi;
  - rollback do job Upstart;
  - retorno da raiz para `ro` apos mexer em `/etc`.
- Nao declarar "funciona no Kindle" sem teste real no aparelho. Quando nao
  houver aparelho conectado, informar que a validacao foi local.

## Codigo

- Seguir a estrutura existente antes de criar novos caminhos.
- Manter CommonJS em `backend/*.js` e `scripts/*.js`.
- Manter TypeScript em `src/main`, `src/preload`, `src/renderer` e
  `src/shared`.
- Reutilizar `backend/server.js` via `createServer(...)`; nao duplicar API no
  Electron.
- Validar entradas do renderer, rede, env e Kindle.
- Nao bloquear o processo main com trabalho pesado ou loops sincronos longos.
- Preferir mudancas pequenas, testaveis e reversiveis.
- Evitar dependencias novas sem necessidade clara.
- Nao usar Python como dependencia operacional.

## Encoding e i18n

- Todo arquivo de texto do projeto deve ser UTF-8 sem BOM.
- Scripts `.sh` do Kindle devem usar fim de linha LF (rodam no Linux do aparelho).
- `.editorconfig` e `.gitattributes` mantem esse padrao; nao commitar arquivo com
  BOM, mojibake ou `.sh` em CRLF.
- Strings traduziveis (UI, tray, notificacoes, checagem de login, texto do PNG)
  ficam em `locales/<idioma>.json`, nunca hardcoded no codigo.
- Adicionar idioma = adicionar um arquivo em `locales/`; nao editar TypeScript
  para isso. Chave faltando cai para `en.json`.
- Codigo (main, backend, renderer) referencia chaves de i18n, nao texto final.

## UI

- A UI Electron deve ser operacional, nao landing page.
- Primeira tela deve permitir configurar, verificar, instalar, revisar auth e
  ver erros.
- Toda mensagem global de sucesso, aviso ou erro da UI deve aparecer no topo da
  area de conteudo, logo abaixo do header/topbar, e nunca como ultimo item da
  tela.
- Todo botao visivel na UI deve ter icone junto do rotulo, inclusive acoes
  primarias, secundarias e abas clicaveis.
- Tray do Windows deve oferecer abrir painel, abrir configuracoes, atualizar e
  encerrar.
- Para e-ink, priorizar alto contraste, poucos tons, texto grande e hierarquia
  clara.
- Nao depender de cor fina para transmitir estado no dashboard do Kindle.

## Validacao

- Mudancas em backend, scripts ou coletores: rodar `npm test`.
- Mudancas em Electron/TypeScript/React: rodar `npm run typecheck`.
- Mudancas de build/empacotamento: rodar `npm run build`.
- Antes de concluir limpeza de privacidade, rodar varredura por:
  - serial real;
  - IPs reais;
  - senhas;
  - tokens;
  - arquivos runtime gerados.

## Guard Rails

- Nao usar `git reset --hard`, `git checkout --` ou equivalente para descartar
  mudancas sem pedido explicito.
- Nao executar comandos destrutivos fora do workspace.
- Antes de deletar diretorios recursivamente, resolver caminho absoluto e
  confirmar que esta dentro do projeto.
- Nao remover componentes de jailbreak do Kindle por este projeto.
- Nao transformar dado expirado em metrica atual. Mostrar `stale`, `null` ou
  erro honesto.
