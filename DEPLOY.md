# Publicação automática (CI/CD) no seu servidor

Este projeto publica sozinho no seu servidor Linux/VPS via **GitHub Actions**.
A cada envio de código para o GitHub, ele monta a pasta `dist/` e a copia para
o servidor por **SSH (rsync)**. Você configura isto **uma vez**.

> Suas senhas/chaves ficam guardadas nos **Secrets** do GitHub. Elas não entram
> no código e não são visíveis para ninguém depois de salvas.

---

## Visão geral (o que vai acontecer)

```
você faz "push" no GitHub
        │
        ▼
GitHub Actions:  valida JS  ->  node build.mjs (monta dist/)  ->  rsync dist/ -> seu servidor
```

O deploy só acontece quando os 5 secrets abaixo estiverem configurados. Antes
disso, o robô apenas valida e monta o site (fica "verde"), sem publicar.

---

## Passo 1 — Ter um lugar no servidor para o site

No seu servidor (via SSH), crie a pasta onde o site vai morar e dê permissão ao
seu usuário. Exemplo (ajuste o caminho ao seu servidor web — Apache/Nginx):

```bash
sudo mkdir -p /var/www/latteszen
sudo chown -R $USER:$USER /var/www/latteszen
```

⚠️ **Importante:** essa pasta será **espelhada** pelo deploy (o rsync usa
`--delete`). Use uma pasta **dedicada só ao site** — tudo que estiver nela e não
estiver no `dist/` será removido. Não aponte para a raiz do seu usuário nem para
uma pasta com outros arquivos.

Depois, configure o seu servidor web (Nginx/Apache) para servir essa pasta no
domínio desejado (isso é a configuração normal do seu servidor, feita uma vez).

---

## Passo 2 — Criar uma chave SSH dedicada ao deploy

No **seu computador** (ou em qualquer terminal Linux/Mac; no Windows use o Git
Bash), gere um par de chaves **só para o deploy** (não use sua chave pessoal):

```bash
ssh-keygen -t ed25519 -C "deploy-latteszen" -f ~/.ssh/latteszen_deploy -N ""
```

Isso cria dois arquivos:
- `~/.ssh/latteszen_deploy`      → chave **PRIVADA** (vai para o GitHub, secret `SSH_KEY`)
- `~/.ssh/latteszen_deploy.pub`  → chave **PÚBLICA** (vai para o servidor)

Autorize a chave **pública** no servidor (troque `usuario` e `servidor`):

```bash
ssh-copy-id -i ~/.ssh/latteszen_deploy.pub usuario@servidor
```

> Sem `ssh-copy-id`? Copie manualmente o conteúdo de `latteszen_deploy.pub`
> para o arquivo `~/.ssh/authorized_keys` do usuário no servidor.

Teste que a chave funciona (deve entrar sem pedir senha):

```bash
ssh -i ~/.ssh/latteszen_deploy usuario@servidor
```

---

## Passo 3 — Cadastrar os Secrets no GitHub

No GitHub, abra o repositório e vá em:
**Settings → Secrets and variables → Actions → New repository secret**

Crie estes **5 secrets** (nome exatamente como abaixo):

| Nome          | Valor                                                                 |
|---------------|-----------------------------------------------------------------------|
| `SSH_HOST`    | IP ou domínio do servidor (ex.: `200.100.50.10` ou `meuservidor.br`)  |
| `SSH_USER`    | usuário SSH (ex.: `deploy` ou o seu usuário)                          |
| `SSH_PORT`    | porta SSH (geralmente `22`)                                           |
| `DEPLOY_PATH` | pasta do site no servidor (ex.: `/var/www/latteszen`)                 |
| `SSH_KEY`     | **conteúdo** do arquivo `~/.ssh/latteszen_deploy` (a chave PRIVADA)   |

Para o `SSH_KEY`, cole o arquivo **inteiro**, incluindo as linhas
`-----BEGIN OPENSSH PRIVATE KEY-----` e `-----END OPENSSH PRIVATE KEY-----`.
No terminal, veja o conteúdo com:

```bash
cat ~/.ssh/latteszen_deploy
```

---

## Passo 4 — Publicar

Duas formas de disparar:

1. **Automático:** faça qualquer `push` na branch do projeto — o deploy roda.
2. **Manual:** no GitHub, aba **Actions → "Publicar lattesZen" → Run workflow**.

Acompanhe em **Actions**. Se tudo estiver certo, ao final o passo "Publicar no
servidor" mostra `Deploy (rsync) concluído.` e o site aparece no seu domínio.

---

## Resolução de problemas

- **"Secrets do ambiente não configurados"** → falta cadastrar os 5 secrets
  (Passo 3). O CI fica verde, mas não publica até você cadastrá-los.
- **Permissão negada (publickey)** → a chave pública não está no
  `authorized_keys` do servidor, ou o `SSH_USER`/`SSH_HOST`/`SSH_PORT` estão
  errados. Refaça o teste do Passo 2.
- **Conexão expira (timeout)** → o servidor bloqueia a porta SSH para a internet
  ou o IP/porta estão errados. Confirme com sua hospedagem.
- **O site publica, mas com arquivos a mais/velhos** → confirme que o
  `DEPLOY_PATH` aponta **só** para a pasta do site (o `--delete` espelha).
