# POP-003 — Instalação Nativa em Linux Debian

**Objetivo:** instalar e publicar o lattesZen num servidor Debian (ou
derivado, ex.: Ubuntu) "pelado", do zero, sem Docker e sem painel de
hospedagem.

> **Antes de começar:** como o lattesZen não tem backend, o "serviço" que
> este POP instala e ativa via `systemd` é o **servidor web** (Nginx) — não
> um processo da aplicação. Não existe unit file de app para criar aqui.

---

## 1. Atualizar o SO e instalar dependências

```bash
sudo apt update && sudo apt upgrade -y

# Servidor web (escolha um — este POP usa Nginx nos exemplos seguintes)
sudo apt install -y nginx

# Opcional: rsync (melhora o deploy incremental; sem ele, o pipeline usa
# um fallback via tar automaticamente — ver POP-006)
sudo apt install -y rsync

# Opcional: certbot, para TLS/HTTPS automático via Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
```

> **Node.js não é necessário no servidor de produção.** Ele só roda nos
> runners do GitHub Actions durante o CI/CD (ver POP-001, seção 1).

---

## 2. Criar o diretório de publicação

```bash
sudo mkdir -p /var/www/latteszen
sudo chown -R deploy:deploy /var/www/latteszen   # veja criação do usuário "deploy" no passo 3
```

> ⚠️ **Importante:** esta pasta será **espelhada** pelo deploy automático
> (`rsync --delete`). Use uma pasta **dedicada só a este site** — qualquer
> arquivo que estiver nela e não vier do build será apagado no próximo
> deploy. Nunca aponte para `/home/usuario` ou outra pasta compartilhada.

---

## 3. Criar o usuário de deploy e a chave SSH dedicada

### 3.1 Criar um usuário dedicado no servidor (recomendado)

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo chown -R deploy:deploy /var/www/latteszen
```

### 3.2 Gerar o par de chaves SSH (na sua máquina local, não no servidor)

```bash
ssh-keygen -t ed25519 -C "deploy-latteszen" -f ~/.ssh/latteszen_deploy -N ""
```

Isso cria:
- `~/.ssh/latteszen_deploy` — chave **PRIVADA** → vai para o secret `SSH_KEY` do GitHub (ver POP-002).
- `~/.ssh/latteszen_deploy.pub` — chave **PÚBLICA** → vai para o servidor.

### 3.3 Autorizar a chave pública no servidor

```bash
ssh-copy-id -i ~/.ssh/latteszen_deploy.pub deploy@SEU_SERVIDOR
```

Sem `ssh-copy-id` disponível, copie manualmente:

```bash
# no servidor, como o usuário "deploy"
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "CONTEUDO_DA_CHAVE_PUBLICA_AQUI" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 3.4 Testar a chave (deve entrar sem pedir senha)

```bash
ssh -i ~/.ssh/latteszen_deploy deploy@SEU_SERVIDOR
```

Se funcionou, cadastre o conteúdo de `~/.ssh/latteszen_deploy` (a chave
**privada**, arquivo inteiro, incluindo as linhas `-----BEGIN...-----` e
`-----END...-----`) no secret `SSH_KEY` do GitHub (POP-002, seção 2).

---

## 4. Configurar o Nginx

Crie o arquivo de configuração do site:

```bash
sudo tee /etc/nginx/sites-available/latteszen > /dev/null <<'EOF'
server {
    listen 80;
    server_name seusite.com;
    root /var/www/latteszen;
    index index.html;

    # robots.txt e sitemap.xml precisam do Content-Type correto — sem
    # isso, alguns navegadores/rastreadores tratam a resposta como
    # download em vez de renderizar/interpretar o conteúdo (mesmo
    # cuidado que o próprio harness de testes do projeto já toma).
    location = /robots.txt { default_type text/plain; }
    location = /sitemap.xml { default_type application/xml; }

    # O Service Worker (sw.js) NÃO pode ser cacheado agressivamente — ele
    # é o mecanismo que detecta uma versão nova do app e atualiza a aba do
    # usuário automaticamente (ver js/pwa.js). Um cache antigo aqui atrasa
    # todo mundo recebendo correções.
    location = /sw.js {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/latteszen /etc/nginx/sites-enabled/
sudo nginx -t   # valida a sintaxe antes de recarregar
sudo systemctl reload nginx
```

---

## 5. Ativar o serviço no `systemd`

O Nginx instalado via `apt` já vem com unit file pronto — só é preciso
habilitá-lo para iniciar no boot (geralmente já vem habilitado, mas
confirme):

```bash
sudo systemctl enable --now nginx
sudo systemctl status nginx   # deve mostrar "active (running)"
```

> Repetindo: **não há um segundo serviço para criar.** Se, no futuro,
> alguém pedir para você criar uma unit `latteszen.service`, pare — isso
> indicaria uma mudança de arquitetura (a aplicação ganhando um backend)
> que não existe na versão atual do projeto.

---

## 6. (Opcional) Ativar HTTPS com Let's Encrypt

```bash
sudo certbot --nginx -d seusite.com
```

O certbot já registra automaticamente um timer do `systemd` para renovação
— confirme com:

```bash
systemctl list-timers | grep certbot
```

---

## 7. Primeira publicação

Com os secrets do GitHub cadastrados (POP-002, seção 2) e o servidor
pronto, dispare o primeiro deploy de uma das formas:

1. **Automático:** faça um `push` na branch `principal` do repositório.
2. **Manual:** na aba **Actions** do GitHub → workflow **"Publicar
   lattesZen"** → **Run workflow**.

Acompanhe em **Actions**. Ao final, o passo "Publicar no servidor
(rsync/SSH)" deve mostrar `Deploy (rsync) concluído.` — e o site deve
responder em `http://seusite.com` (ou `https://`, se o passo 6 foi feito).

Confirme abrindo o site e conferindo, no rodapé, que a versão exibida bate
com a mais recente do `src/js/config.js` (`APP_CONFIG.version`).
