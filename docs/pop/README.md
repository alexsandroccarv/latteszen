# Documentação de operação — POPs (Procedimentos Operacionais Padrão)

Coleção de POPs modulares para a **implantação e operação** do lattesZen,
escrita para **técnicos de infraestrutura e analistas de suporte** — não
exige consultar a equipe de desenvolvimento para realizar as tarefas
descritas. Gerada a pedido da issue
[#138](https://github.com/alexsandroccarv/latteszen/issues/138).

> **Contexto da aplicação:** o lattesZen é um **site estático** (HTML +
> CSS + JavaScript puro), **sem backend e sem banco de dados** — todo dado
> de currículo fica no navegador de cada usuário (localStorage, pasta
> local via File System Access API, ou Google Drive do próprio usuário),
> nunca no servidor. Isso simplifica bastante a operação em relação a um
> app tradicional; leia o **POP-001** primeiro para entender por quê.

| POP | Tema |
|---|---|
| [POP-001](POP-001-visao-geral-e-ambiente.md) | Visão geral da arquitetura, requisitos de hardware e rede |
| [POP-002](POP-002-variaveis-e-chaves-de-api.md) | Configuração (`config.js`) e secrets do deploy — como gerar cada credencial |
| [POP-003](POP-003-instalacao-nativa-debian.md) | Instalação nativa em Linux Debian (Nginx + systemd) |
| [POP-004](POP-004-instalacao-docker.md) | Instalação via Docker e Docker Compose |
| [POP-005](POP-005-hospedagem-compartilhada.md) | Deploy em hospedagem compartilhada (cPanel/Plesk) |
| [POP-006](POP-006-procedimento-de-atualizacao.md) | Procedimento de atualização (deploy de novas versões) e rollback |
| [POP-007](POP-007-troubleshooting-e-logs.md) | Resolução de problemas comuns e onde encontrar logs |
| [POP-008](POP-008-boas-praticas.md) | Boas práticas de manutenção e segurança |

Arquivos de exemplo citados pelo POP-004 (Docker) ficam em
[`exemplos/docker/`](exemplos/docker/).

Para o guia de referência do pipeline de CI/CD em si (o que cada passo do
`.github/workflows/deploy.yml` faz), veja também o
[`DEPLOY.md`](../../DEPLOY.md) na raiz do repositório — os POPs acima
citam e se apoiam nele, sem duplicar o conteúdo.
