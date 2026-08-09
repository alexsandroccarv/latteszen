# CI/CD do lattesZen

Integração e entrega contínuas via **GitHub Actions**, publicando por **rsync/SSH**
em três ambientes (promoção em 3 estágios):

| Gatilho (push/tag)                         | Ambiente        | GitHub Environment |
|--------------------------------------------|-----------------|--------------------|
| push em `develop` ou `claude/latteszen-project-emre8x` | **Dev**         | `dev`              |
| push em `main`                             | **Homologação** | `homolog`          |
| criação de tag `v*` (ex.: `v0.1.0`)        | **Produção**    | `producao`         |

Toda execução roda antes o job **CI** (valida a sintaxe dos módulos e gera o
`index.html`). Pull requests rodam só o CI (não fazem deploy).

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

## 2. Preparar os diretórios no servidor

```bash
sudo mkdir -p /var/www/latteszen-dev /var/www/latteszen-homolog /var/www/latteszen
sudo chown -R deploy:deploy /var/www/latteszen-dev /var/www/latteszen-homolog /var/www/latteszen
```

Aponte o servidor web (Nginx/Apache) para cada pasta. Exemplo Nginx:

```nginx
server {
    server_name latteszen-dev.suainstituicao.br;
    root /var/www/latteszen-dev;
    index index.html;
}
```

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
- `.github/scripts/make-dist.sh` — monta a pasta `dist/` publicável
- `.github/scripts/deploy.sh` — rsync/SSH para o servidor

## Segurança

- A chave privada fica **apenas** nos secrets do GitHub (nunca no código).
- `rsync --delete` deixa o destino idêntico ao build — **não** guarde uploads
  de usuários dentro do `DEPLOY_PATH` (a app grava PDFs na máquina do usuário,
  não no servidor, então não há conflito).
- Para maior rigor, troque `accept-new` por um `known_hosts` fixo (pinado).
