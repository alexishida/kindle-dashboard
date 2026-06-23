# Changelog

Todas as mudancas relevantes deste projeto ficam registradas aqui.

## [v1.0.2](https://github.com/alexishida/kindle-dashboard/releases/latest) - 2026-06-22

Kindle Dashboard v1.0.2

### Melhorado

- Interface ajustada para usar acentuacao correta nos textos visiveis do app.
- Padrao visual de botoes atualizado para exibir icone junto do rotulo em toda a UI.
- Fluxo de diagnostico do Kindle refinado com acoes mais claras e melhor leitura operacional.

### Documentacao

- Regra do projeto atualizada para exigir icones em todos os botoes visiveis.
- Guia de instalacao em ingles adicionado e documentacao principal revisada.

### Versao

- Bump de versao do app para `1.0.2`.

## [v1.0.1](https://github.com/alexishida/kindle-dashboard/releases/latest) - 2026-06-18

Kindle Dashboard v1.0.1

### Corrigido

- Corrigido fallback do coletor do Codex para priorizar `rate_limits` ainda validos antes de marcar dado como desatualizado.
- Corrigido caso em que o dashboard mostrava `limites locais desatualizados (Codex usado fora do CLI)` mesmo existindo rollout mais novo com janelas `5h` e `7d` vivas.

### Testes

- Adicionado teste automatizado para garantir que o coletor do Codex prefere limites vivos em vez de fallback stale.

### Versao

- Bump de versao do app para `1.0.1`.

## [v1.0.0](https://github.com/alexishida/kindle-dashboard/releases/tag/v1.0.0) - 2026-06-18

Kindle Dashboard v1.0.0

Dashboard desktop para monitorar o uso de ferramentas de IA (Claude Code, Codex) e exibir em tempo real num Kindle Paperwhite com jailbreak.

### Funcionalidades

- Painel ao vivo - preview do PNG gerado com botao para forcar atualizacao
- Coleta automatica - escaneia logs do Claude Code e Codex localmente
- Render atomico - gera PNG otimizado para tela e-ink e serve via HTTP na rede local
- Configuracao do Kindle via SSH - IP, porta, usuario, senha; instala/remove scripts de autostart no Kindle
- Tray do Windows - inicia em segundo plano, icone na bandeja com menu rapido
- Diagnostico integrado - verifica jailbreak, SSH, FBInk e status dos scripts remotamente
- Autostart opcional - registro para iniciar com o Windows
