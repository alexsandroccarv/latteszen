# CI/CD do lattesZen

Integração e entrega contínuas via **GitHub Actions**, publicando por **rsync/SSH**
em três ambientes (promoção em 3 estágios):

| Gatilho (push/tag)                         | Ambiente        | GitHub Environment | URL |
|--------------------------------------------|-----------------|--------------------|-----|
| push em `develop` ou `claude/latteszen-project-emre8x` | **Dev**         | `dev`              | https://ccarvalho.net/labs/dev/latteszen |
| push em `main`                             | **Homologação** | `homolog`          | https://ccarvalho.net/labs/latteszen |
| criação de tag `v*` (ex.: `v0.1.0`)        | **Produção**    | `producao`         | *(a definir)* |

> A aplicação é um **site multi-arquivo** (`index.html` + `css/` + `js/` +
> imagens). Ela **não funciona** abrindo só o `index.html` solto — é preciso o
> diretório inteiro (todos os arquivos juntos). Funciona servida em subpasta
> (`/labs/latteszen`) sem ajuste de base, pois todas as referências são relativas.

Toda execução roda antes o job **CI** (valida a sintaxe dos módulos e monta a
pasta `dist/` com o site multi-arquivo). Pull requests rodam só o CI (não fazem deploy).

---

## 1. Gerar uma chave SSH dedicada ao deploy

No seu computador (ou no servidor):

```bash
ssh-keygen -t ed25519 -C "github-actions-latteszen" -f latteszen_deploy -N ""
```

Isso gera `latteszen_deploy` (privada) e `latteszen_deploy.pub` (pública).

No **servidor**, autorize a chave pública para o usuário de deploy:

```bash
# no servidor, como o usuário de deploy (ex.: "deploy")
mkdir -p ~/.ssh && chmod 700 ~/.ssh
cat latteszen_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

> Boa prática: use um usuário com permissão **apenas** nos diretórios de publicação.

## 2. Preparar os diretórios no servidor (ccarvalho.net)

As URLs são subpastas do site `ccarvalho.net`:

- Homologação → `https://ccarvalho.net/labs/latteszen`
- Dev         → `https://ccarvalho.net/labs/dev/latteszen`

Descubra o **document root** do `ccarvalho.net` (ex.: `~/public_html`,
`/var/www/ccarvalho.net` ou similar — depende da sua hospedagem) e crie:

```bash
# Substitua DOCROOT pelo document root real de ccarvalho.net
DOCROOT=~/public_html
mkdir -p "$DOCROOT/labs/latteszen" "$DOCROOT/labs/dev/latteszen"
```

Os valores de `DEPLOY_PATH` (secrets) serão, por exemplo:

| Ambiente    | `DEPLOY_PATH` (ajuste o DOCROOT) |
|-------------|----------------------------------|
| `dev`       | `DOCROOT/labs/dev/latteszen`     |
| `homolog`   | `DOCROOT/labs/latteszen`         |
| `producao`  | *(definir quando o ambiente existir)* |

> **Hospedagem compartilhada + SSH:** o `deploy.sh` cria o diretório remoto
> automaticamente (`mkdir -p`) e, se o servidor não tiver `rsync`, usa um
> **fallback via `tar` por SSH** (que também limpa o destino, emulando o
> `--delete`). Se o SSH usar porta diferente de 22, defina o secret `SSH_PORT`.

## 3. Criar os Environments e Secrets no GitHub

No repositório: **Settings → Environments** → crie **`dev`**, **`homolog`** e **`producao`**.

Em cada Environment, adicione os **secrets**:

| Secret        | Exemplo                          | Observação                         |
|---------------|----------------------------------|------------------------------------|
| `SSH_HOST`    | `servidor.unifesp.br`            | host do servidor                   |
| `SSH_USER`    | `deploy`                         | usuário SSH                        |
| `SSH_KEY`     | *(conteúdo de `latteszen_deploy`)* | chave **privada** (multilinha)   |
| `DEPLOY_PATH` | `/var/www/latteszen-dev`         | diretório de publicação do ambiente |
| `SSH_PORT`    | `22`                             | opcional (padrão 22)               |

> Cada ambiente aponta o `DEPLOY_PATH` para a sua pasta (dev/homolog/produção).

### Proteção da Produção (recomendado)
No Environment **`producao`** → **Required reviewers**: adicione você mesmo.
Assim, o deploy de produção **espera aprovação manual** antes de publicar.

## 4. Branches

- Crie a branch **`main`** (homologação) e, opcionalmente, **`develop`** (dev).
- Enquanto estiver desenvolvendo nesta branch, o push nela já publica em **dev**.
  Quando migrar para o fluxo padrão, use `develop` para dev e remova a branch
  temporária da lista `on.push.branches` em `.github/workflows/deploy.yml`.

## 5. Fluxo de uso

```bash
# Dev: trabaha na branch e envia
git push                     # -> publica em DEV

# Homologação: promova para main
git checkout main && git merge --ff-only sua-branch && git push   # -> HOMOLOGAÇÃO

# Produção: crie uma tag de versão
git tag v0.1.0 && git push origin v0.1.0                          # -> PRODUÇÃO (com aprovação)
```

## Arquivos

- `.github/workflows/deploy.yml` — pipeline (CI + 3 deploys)
- `build.mjs` — monta a pasta `dist/` (site multi-arquivo) copiando `src/`
- `.github/scripts/deploy.sh` — rsync/SSH da pasta `dist/` para o servidor

## Segurança

- A chave privada fica **apenas** nos secrets do GitHub (nunca no código).
- `rsync --delete` deixa o destino idêntico ao build — **não** guarde uploads
  de usuários dentro do `DEPLOY_PATH` (a app grava PDFs na máquina do usuário,
  não no servidor, então não há conflito).
- Para maior rigor, troque `accept-new` por um `known_hosts` fixo (pinado).
