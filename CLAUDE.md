# lattesZen — instruções do projeto

## Versionamento (`src/js/config.js` → `APP_CONFIG.version`)

Formato: `v<versão>.<marco>.<contador>` (ex.: `v0.6.01`).

- **1º número (versão)**: atualizado manualmente pelo Alexsandro. Ainda em `0`.
- **2º número (marco do projeto)**: atualizado manualmente pelo Alexsandro
  quando o projeto atingir um novo marco. Valor atual: `7`.
- **3º número (contador de issues, sempre 2 dígitos — `01`, `02`, ... `10`, ...)**:
  **incrementado automaticamente a cada issue fechada no GitHub.** Sempre que
  uma issue for fechada (documentando um bug corrigido ou uma funcionalidade
  entregue), no mesmo commit/sessão que fecha a issue:
  1. Incremente esse contador em 1 (zero-padded a 2 dígitos) em `APP_CONFIG.version`.
  2. Atualize `APP_CONFIG.lastModified` para a data do dia.
  3. Adicione uma entrada nova no topo de `src/notas-de-versao.html`, descrevendo
     em 1-3 linhas o que mudou, com link para a issue fechada.
  4. Faça tudo isso no mesmo commit que fecha a issue (ou no commit da correção,
     se a issue for fechada logo em seguida).

Reiniciar o contador (voltar a `01`) só acontece se o Alexsandro pedir
explicitamente ao incrementar o 1º ou o 2º número.

## Notas de versão

Página pública em `src/notas-de-versao.html` (mesmo padrão visual das demais
páginas estáticas do site — `doe-um-cafe.html`, `ajuda-rsc.html`, etc.),
linkada no rodapé de todas elas. Lista as versões mais recentes primeiro.
