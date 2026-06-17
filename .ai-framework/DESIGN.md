# Design System

Este arquivo descreve o design real do sistema hoje.
Use como referencia ao alterar UI do app Electron e dashboard renderizado para o Kindle.

## Visao Geral

Projeto tem duas superficies visuais diferentes:

1. Painel desktop Electron
   - UI operacional, escura, foco em configuracao, diagnostico e acoes.
   - Layout em shell com sidebar fixa e area principal.

2. Dashboard do Kindle
   - Render monocromatico, alto contraste, orientado para e-ink.
   - Conteudo em paisagem dentro de framebuffer retrato, com rotacao de 90 graus.

Nao misturar linguagens visuais.
Painel desktop pode usar tons, profundidade e estados coloridos.
Dashboard Kindle deve permanecer preto no branco, sem depender de cor para leitura.

## Painel Desktop

### Estrutura

- Shell principal em 2 colunas.
- Sidebar fixa a esquerda com 248px.
- Conteudo principal ocupa restante da largura.
- Em telas menores, sidebar reduz para 200px.
- App trabalha com largura minima de 980px e altura minima de 720px.
- Corpo nao rola; rolagem fica apenas na area de conteudo.

### Sidebar

- Fundo secundario escuro.
- Borda divisoria a direita.
- Blocos:
  - marca do produto no topo;
  - navegacao vertical no meio;
  - status de backend, intervalo de render e credito no rodape.
- Marca usa bloco com letra `K` em gradiente azul/roxo e titulo "Kindle Dashboard".
- Navegacao tem tres entradas:
  - `Painel`
  - `Kindle`
  - `Logins`
- Item ativo usa fundo de destaque azul suave e icone azul.
- Item bloqueado fica com opacidade reduzida e sem interacao.

### Topbar

- Faixa horizontal com fundo escuro secundario e borda inferior.
- Tres zonas:
  - titulo da secao ativa;
  - metadados (`Ultima imagem`, `Setup`);
  - acoes (`Atualizar agora`, `Encerrar`).
- Em larguras menores, metadados podem sumir antes de comprometer a leitura.

### Areas e Navegacao

#### Painel

- Exibe apenas preview do dashboard Kindle.
- Preview ocupa painel branco centralizado, com proporcao fixa `1448 / 1072`.
- Erros ficam logo abaixo do preview.

#### Kindle

- Usa subtabs:
  - `Configuracao`
  - `Diagnostico e Instalacao de Scripts`
- Largura util maxima da coluna: 760px.

#### Logins

- Lista status das fontes de autenticacao.
- Cada linha pode mostrar acao secundaria de login.

## Componentes do Painel Desktop

### Paineis

- Cards/paineis usam fundo `panel` escuro, borda fina e raio de 12px.
- Conteudo interno com padding de 20px.
- Cabecalho de painel usa:
  - eyebrow em uppercase;
  - titulo curto;
  - badge ou botao de apoio na direita.

### Botoes

- Botao primario:
  - fundo azul;
  - texto escuro;
  - peso alto;
  - canto arredondado de 9px;
  - altura minima de 40px.
- Botao `ghost`:
  - transparente;
  - borda cinza;
  - hover com fundo de painel.
- Botao de risco:
  - variante ghost com texto avermelhado;
  - hover com fundo vermelho suave.

### Inputs

- Campo escuro com borda discreta.
- Foco com borda azul e halo azul suave.
- Labels sempre acima do campo.
- Labels pequenas, em tom secundario, peso alto.

### Badges, Checks e Notices

- Badge de estado usa caps, peso forte e formato pilula.
- Estados:
  - `ok`: verde suave
  - `warn`: amarelo suave
  - `error`: vermelho suave para notices
- Grid de checks no diagnostico Kindle usa 4 colunas iguais.
- Notices aparecem como barras compactas abaixo das acoes.

### Linhas de Status

- Cartoes internos com fundo `panel-2`.
- Estrutura em 3 colunas:
  - badge;
  - texto principal + detalhe;
  - acao opcional.

### Log de Saida

- `pre` escuro quase preto.
- Borda fina.
- Rolagem propria.
- Fonte pequena.

## Grid e Espacamento do Painel Desktop

- Escala geral compacta, operacional.
- Gaps mais comuns:
  - 4px em navegacao compacta;
  - 8-12px em grupos pequenos;
  - 16-22px em secoes e paineis.
- Formularios:
  - grid padrao com 2 colunas;
  - grid compacto com 3 colunas para intervalos;
  - campo de URL em linha unica.

## Tipografia do Painel Desktop

- Fonte base: `Inter, "Segoe UI", Arial, sans-serif`.
- Hierarquia atual:
  - `h1`: 24px
  - `h2`: 18px
  - `h3`: 14px
  - eyebrow/meta labels: 10px a 12px, uppercase
  - texto de apoio: 11px a 13px
- Titulos curtos. Texto deve privilegiar clareza operacional.

## Paleta do Painel Desktop

Tokens visuais atuais:

- `--bg`: `#0e1014`
- `--bg-2`: `#14171d`
- `--panel`: `#181c24`
- `--panel-2`: `#1e232c`
- `--line`: `#2a2f3a`
- `--line-2`: `#353b48`
- `--text`: `#e7e9ee`
- `--text-dim`: `#9aa1ad`
- `--text-soft`: `#6c7480`
- `--accent`: `#5b9dff`
- `--ok`: `#46d29a`
- `--warn`: `#f0b35a`
- `--danger`: `#ff6b5e`

Uso:

- Azul = acao primaria e foco.
- Verde = sucesso/status saudavel.
- Amarelo = pendencia/atencao.
- Vermelho = erro/remocao.

## Preview do Kindle no Desktop

- Preview usa `iframe` com mesmo caminho de captura do PNG real.
- Area visivel sempre em paisagem.
- Escala calculada por `ResizeObserver`.
- Sem transform visual no `iframe`; tamanho final deriva de `captureScale`.
- Fundo do preview sempre branco para refletir Kindle real.

## Dashboard Kindle

### Principios

- Alto contraste absoluto.
- Sem degrades, sombras, transparencias decorativas ou cinzas sutis como unico sinal.
- Tipografia grande.
- Hierarquia por tamanho, peso e borda.
- Layout pensado para leitura rapida com aparelho de lado.

### Canvas e Orientacao

- Framebuffer base: `1072 x 1448` em retrato.
- Conteudo util: `1448 x 1072` em paisagem.
- Stage central gira `90deg`.
- Modo de preview/captura em desktop remove rotacao e escala conteudo para encaixe.

### Estrutura do Dashboard Kindle

- Header superior com:
  - titulo `Token Dashboard`;
  - timestamp a direita.
- Linha inferior forte no header.
- Corpo em colunas lado a lado.
- Cada ferramenta vira um card com:
  - logo monocromatico;
  - nome;
  - barras de uso;
  - informacoes extras;
  - gasto/tokens quando existir.

### Cards do Kindle

- Cards ocupam largura igual.
- Borda preta grossa de 4px.
- Padding generoso.
- Titulo do card com borda inferior e icone grande.
- Barras de progresso:
  - label e percentual na mesma linha;
  - trilha com borda preta grossa;
  - preenchimento preto solido.

### Tipografia do Kindle

- Fonte: `Helvetica, Arial, sans-serif`.
- Escala alta para e-ink:
  - `h1`: 52px
  - timestamp: 28px
  - titulo de card: 40px
  - labels de barra: 30px
  - reset: 34px
  - texto secundario: 28px
  - destaque grande: 46px

### Estados no Kindle

- Estado indisponivel deve ser textual.
- Mensagens como token expirado, limite atingido ou cooldown aparecem em texto.
- Opacidade reduzida pode ser usada apenas como apoio secundario, nunca como unico indicador.

## Comportamento Responsivo

- App desktop nao tenta virar layout mobile.
- Reducao atual:
  - sidebar menor;
  - hints da navegacao ocultos;
  - metadados da topbar ocultos.
- Nao introduzir breakpoints que desmontem shell operacional.

## Diretrizes Para Mudancas Futuras

- Preservar shell escuro operacional no Electron.
- Preservar preview branco grande como foco do `Painel`.
- Nao transformar area de configuracao em landing page ou wizard visual pesado.
- Qualquer novo estado visual precisa existir em:
  - botao;
  - badge/check, se aplicavel;
  - mensagem textual.
- No Kindle, sempre validar legibilidade em preto e branco e em tamanhos grandes.
- Se nova informacao entrar no dashboard Kindle, preferir:
  - bloco/card existente;
  - barra simples;
  - texto curto;
  - destaque numerico grande.
