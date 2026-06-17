# Instalacao no Kindle

Este guia descreve o fluxo do Kindle depois que o aparelho ja tem jailbreak,
SSH e FBInk funcionais.

Nao coloque neste arquivo serial, IP real, usuario real, senha, token ou logs do
seu aparelho. Use sempre placeholders.

## O Que o App Instala

Durante `Injetar scripts` ou `npm run kindle:autostart -- install`, o PC envia:

| Arquivo remoto | Funcao |
| --- | --- |
| `/mnt/us/dash-loop.sh` | Baixa o PNG do PC e exibe com FBInk em loop. |
| `/mnt/us/dash-autostart.sh` | Aguarda Wi-Fi e inicia o loop. |
| `/mnt/us/dash-autostart.env` | Configuracao local do dashboard no Kindle. |
| `/mnt/us/kindle-dashboard.conf` | Copia removivel do job Upstart. |
| `/etc/upstart/kindle-dashboard.conf` | Job de boot que chama o launcher. |

O job Upstart so deve ser instalado quando o Kindle passar no preflight:

- SSH conectado.
- `/mnt/us` disponivel.
- `fbink` disponivel.
- `initctl` disponivel.
- `mntroot` disponivel.
- Hotfix/Upstart esperado disponivel.

## Configuracao Pelo App

Na tela de configuracao do Electron, informe:

| Campo | Exemplo seguro |
| --- | --- |
| IP do Kindle | `<IP_DO_KINDLE>` |
| Porta SSH | `<PORTA_SSH>` |
| Usuario SSH | `<USUARIO_SSH>` |
| Senha SSH | `<SENHA_SSH>` |
| URL do PNG | `http://<IP_DO_PC>:8787/dash.png` |

O app salva a configuracao localmente no `userData` do Electron. A senha nao
passa para o renderer como texto.

## Configuracao Manual

Para usar o helper SSH:

```powershell
$env:KINDLE_IP = "<IP_DO_KINDLE>"
$env:KINDLE_PORT = "<PORTA_SSH>"
$env:KINDLE_USER = "<USUARIO_SSH>"
$env:KINDLE_PW = "<SENHA_SSH>"
npm run kindle -- run "uname -a"
```

Para instalar o autostart:

```powershell
$env:DASHBOARD_URL = "http://<IP_DO_PC>:8787/dash.png"
$env:KINDLE_REFRESH_INTERVAL = "45"
$env:KINDLE_FULL_REFRESH_EVERY = "20"
$env:KINDLE_WIFI_RETRY_EVERY = "3"
npm run kindle:autostart -- install
```

Para verificar:

```powershell
npm run kindle:autostart -- status
```

Para parar temporariamente:

```powershell
npm run kindle:autostart -- stop
```

Para religar:

```powershell
npm run kindle:autostart -- start
```

Para remover o autostart:

```powershell
npm run kindle:autostart -- uninstall
```

## Comportamento no Kindle

`dash-autostart.sh` carrega `/mnt/us/dash-autostart.env`. Esse arquivo deve
conter pelo menos:

```sh
PC='http://<IP_DO_PC>:8787/dash.png'
INTERVAL='45'
FULL_EVERY='20'
WIFI_RETRY_EVERY='3'
```

`dash-loop.sh` exige `PC` configurado. Sem essa URL, o loop encerra com erro em
vez de tentar usar um endereco antigo.

O loop:

- baixa o PNG para arquivo temporario;
- move para `/mnt/us/dash.png` apenas se o download tiver conteudo;
- usa FBInk para desenhar a imagem;
- faz full refresh periodico;
- tenta recuperar Wi-Fi apos falhas repetidas;
- usa pidfile para evitar multiplas instancias.

## Rollback

```powershell
npm run kindle:autostart -- uninstall
```

Opcionalmente, depois de confirmar que o autostart foi removido, limpe arquivos
runtime pelo proprio Kindle:

```sh
rm -f /mnt/us/dash-loop.sh \
      /mnt/us/dash-loop.pid \
      /mnt/us/dash-loop.log \
      /mnt/us/dash-loop.stop \
      /mnt/us/dash-autostart.log \
      /mnt/us/dash-autostart.env \
      /mnt/us/dash.png
```

Nao remova componentes do jailbreak por este projeto. Essa limpeza e somente do
dashboard.
