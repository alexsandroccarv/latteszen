# POP-007 — Resolução de Problemas (Troubleshooting) e Logs

**Objetivo:** dar ao técnico de suporte um roteiro de diagnóstico rápido
para os problemas mais comuns, e mostrar onde encontrar logs em cada um
dos três ambientes de instalação (POP-003, POP-004, POP-005).

---

## 1. Os 5 erros mais comuns

### 1.1 "O CI passou (verde), mas o site não foi atualizado"

**Causa provável:** os 5 secrets de deploy (`SSH_HOST`, `SSH_USER`,
`SSH_KEY`, `DEPLOY_PATH`, `SSH_PORT`) não estão cadastrados no GitHub — o
script pula a publicação **sem falhar**, de propósito, para não deixar o
CI vermelho por causa de configuração pendente.

**Como confirmar:** abra o log do passo "Publicar no servidor (rsync/SSH)"
na aba **Actions**. Ele mostra:

```
::warning::Secrets do ambiente não configurados (SSH_HOST/SSH_USER/SSH_KEY/DEPLOY_PATH).
Pulei o deploy. Configure os secrets do Environment para ativar a publicação.
```

**Solução:** cadastre os secrets — POP-002, seção 2.

---

### 1.2 "Permission denied (publickey)" no passo de deploy

**Causa provável:** a chave pública correspondente ao `SSH_KEY` cadastrado
não está (ou não está mais) em `~/.ssh/authorized_keys` do usuário
`SSH_USER` no servidor — ou o `SSH_USER`/`SSH_HOST`/`SSH_PORT` estão
incorretos.

**Solução:**
1. Refaça o teste manual de conexão (POP-003, seção 3.4):
   `ssh -i ~/.ssh/latteszen_deploy SSH_USER@SSH_HOST -p SSH_PORT`.
2. Se falhar, reautorize a chave pública no servidor
   (`~/.ssh/authorized_keys` do usuário de deploy).
3. Confirme que o valor colado no secret `SSH_KEY` é o arquivo **privado**
   inteiro (não o `.pub`), sem linhas cortadas no início/fim.

---

### 1.3 Conexão SSH cai no meio da transferência (rsync/tar)

**Sintoma real, tal como aparece no log do CI:**

```
Publicando em ***@***:*** (porta ***)
Connection closed by SEU_IP port ***
rsync: connection unexpectedly closed (0 bytes received so far) [sender]
rsync error: unexplained error (code 255) at io.c(232) [sender=3.2.7]
##[warning]rsync indisponível/falhou — usando fallback via tar por SSH.
Connection closed by SEU_IP port ***
tar: -: Wrote only 4096 of 10240 bytes
tar: Child returned status 141
```

**Causa provável:** instabilidade momentânea de rede/servidor — o host
remoto fechou a conexão SSH antes da transferência terminar (não é erro de
configuração; o `rsync` e o fallback `tar` funcionam normalmente quando a
conexão se mantém estável). Causas comuns: pico de carga no servidor,
firewall/fail2ban derrubando conexões por engano, limite de conexões
simultâneas do provedor, ou uma janela de manutenção do host.

**Solução:**
1. Reexecute o job falho: **Actions → o run em questão → "Re-run failed
   jobs"**. Na grande maioria dos casos, isso resolve — foi exatamente o
   que aconteceu no incidente que gerou o log acima (o reexecute passou de
   primeira, sem nenhuma mudança de código ou configuração).
2. Se falhar **repetidamente** (não só uma vez), aí sim investigue o
   servidor: `journalctl -u sshd` no horário da falha, uso de CPU/memória
   no momento, e regras de firewall/fail2ban que possam estar encerrando
   sessões SSH prematuramente.

---

### 1.4 CI falha na suíte de testes (Playwright), não no deploy

**Causa provável mais comum historicamente neste projeto:** uma CDN
externa (usada só para estilo/ícones nos testes) ficando lenta ou
inacessível a partir do runner do GitHub Actions, multiplicando o tempo de
cada teste. A suíte já bloqueia essas CDNs de propósito durante os testes
(não deveriam mais causar isso), mas se voltar a acontecer:

**Como confirmar:** no log do passo "Rodar a suíte de testes de
regressão", procure por testes muito mais lentos que o normal (a suíte
inteira historicamente roda em 3-8 minutos; se estiver perto do timeout de
50 minutos, é sinal de lentidão externa, não de um teste quebrado de
verdade).

**Solução:** reexecute o job (`Re-run failed jobs`). Se falhar de novo
**com o mesmo teste específico falhando** (não um timeout genérico), é uma
regressão real de código — encaminhe para o time de desenvolvimento com o
nome exato do teste que falhou.

---

### 1.5 Usuário reporta que um recurso do Google Drive aparece "desabilitado"

**Causa provável:** `googleDriveClientId` e/ou `googlePickerApiKey` estão
vazios ou com o valor de exemplo em `src/js/config.js` publicado — **não é
um bug**, é o comportamento esperado enquanto essas credenciais não forem
configuradas (ver POP-002).

**Solução:** gere e configure as credenciais (POP-002, seções 1.1/1.2), e
confirme que o `js/config.js` publicado no servidor reflete a mudança
(`curl https://seusite.com/js/config.js | grep googleDriveClientId`).

---

## 2. Onde encontrar logs, por ambiente

### 2.1 Comum aos três ambientes — logs de build/deploy (CI/CD)

**A fonte de verdade nº 1 para qualquer problema de publicação.** GitHub →
repositório → aba **Actions** → clique no run mais recente do workflow
**"Publicar lattesZen"** → cada passo é expansível e mostra o log
completo, inclusive dos comandos de teste, build e deploy.

### 2.2 Debian nativo (POP-003) — Nginx

```bash
# Log de acesso
tail -f /var/log/nginx/access.log

# Log de erros
tail -f /var/log/nginx/error.log

# Status do serviço e logs do systemd/journal
sudo systemctl status nginx
sudo journalctl -u nginx -f
```

### 2.3 Docker (POP-004)

```bash
docker compose -f docs/pop/exemplos/docker/docker-compose.yml logs -f web

# Ou, direto pelo nome do container:
docker logs -f <nome-ou-id-do-container>
```

### 2.4 Hospedagem compartilhada (POP-005)

Depende do provedor — normalmente **não há acesso a um caminho de arquivo
direto** (muitos planos compartilhados não dão shell). No cPanel:

- **Métricas → Erros** (Error Log) — mostra os últimos erros do Apache
  para o domínio.
- **Métricas → Estatísticas de acesso bruto** (Raw Access Logs) — permite
  baixar os logs de acesso.

Se o plano oferecer SSH com caminho de arquivo (menos comum em
compartilhada), costuma ser algo como
`~/logs/seusite.com-error_log` — confirme o caminho exato com o suporte do
seu provedor, pois varia bastante entre hospedagens.

### 2.5 Erros da aplicação em si (JavaScript, no navegador do usuário)

**Isto nunca aparece em nenhum log de servidor** — como o lattesZen roda
inteiramente no navegador, qualquer erro de JavaScript só é visível no
**DevTools do navegador de quem está usando o app** (F12 → aba Console).
Se um usuário reportar um comportamento estranho, peça um print da aba
Console (ou, melhor, peça para ele exportar a mensagem de erro — os
toasts de erro do app agora ficam na tela até serem fechados manualmente,
dando tempo de copiar o texto).
