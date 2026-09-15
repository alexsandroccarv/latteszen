# CI/CD do lattesZen

> Este arquivo existia como uma versão mais longa do guia de deploy, mas
> tinha ficado desatualizado (descrevia 3 ambientes com promoção por branch/tag
> e GitHub Environments — uma arquitetura que o projeto **não usa mais**).
> O guia completo e atualizado agora vive só em **[`DEPLOY.md`](../DEPLOY.md)**,
> na raiz do repositório. Este arquivo ficou como um resumo da arquitetura
> real, para quem cai aqui a partir de um link antigo.

## Como funciona hoje (um único ambiente)

Integração e entrega contínuas via **GitHub Actions**
(`.github/workflows/deploy.yml`), publicando por **rsync/SSH** (com
fallback automático via `tar`/SSH em hospedagem sem `rsync`) em um único
destino:

| Gatilho                                    | Publica em |
|---------------------------------------------|------------|
| push na branch `principal`                  | https://ccarvalho.net/labs/latteszen |
| disparo manual (aba **Actions** → *Run workflow*) | mesmo destino acima |

Não há branches `develop`/`main` de promoção, tags `v*` de release, nem
**GitHub Environments** (`dev`/`homolog`/`producao`) — tudo isso foi a
arquitetura originalmente planejada, mas o pipeline em produção hoje é
**um único job**, com os 5 secrets cadastrados diretamente em
**Settings → Secrets and variables → Actions** (nível de repositório, não
de Environment).

Antes de publicar, o job roda a suíte de testes de regressão (Playwright)
e valida a exportação XML contra o schema oficial do Lattes; se algo
falhar, o deploy não acontece.

## Onde encontrar cada coisa

- **[`DEPLOY.md`](../DEPLOY.md)** (raiz do repositório) — passo a passo
  completo: criar a pasta no servidor, gerar a chave SSH, cadastrar os 5
  secrets, disparar o deploy e resolver problemas comuns.
- **[`docs/pop/`](pop/)** — POPs (Procedimentos Operacionais Padrão) mais
  detalhados: visão geral da arquitetura, geração de credenciais,
  instalação nativa/Docker/hospedagem compartilhada, procedimento de
  atualização e rollback (POP-006) e troubleshooting (POP-007).
- **`.github/workflows/deploy.yml`** — definição real do pipeline (fonte
  da verdade sobre gatilhos e passos).
- **`.github/scripts/deploy.sh`** — script de publicação (rsync com
  fallback para tar por SSH).
