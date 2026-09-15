# POP-008 — Melhores Práticas e Procedimentos Indicados

**Objetivo:** rotinas de manutenção periódica e recomendações de segurança
para manter a operação do lattesZen saudável a longo prazo.

---

## 1. Proteção de credenciais

- **Nunca** cole um segredo real dentro de `src/js/config.js` — esse
  arquivo é público (servido para qualquer visitante). As únicas
  credenciais que pertencem a ele são as do tipo "público restrito por
  domínio" (Client ID OAuth, chave de API do Picker) — ver POP-002.
- Restrinja `googlePickerApiKey` por domínio/referenciador no Google
  Cloud Console (POP-002, seção 1.2) — sem essa restrição, qualquer site
  poderia usar sua chave e consumir sua cota.
- Use uma chave SSH **dedicada** só para o deploy (`SSH_KEY`), nunca a
  chave pessoal de um desenvolvedor. Se alguém que tinha acesso à chave
  sair do time, gere uma nova chave e atualize o secret — chaves
  compartilhadas não são revogáveis individualmente.
- Restrinja o usuário `SSH_USER` do deploy ao mínimo necessário: acesso de
  escrita só à pasta de publicação (`DEPLOY_PATH`), sem privilégios de
  root e, se possível, com shell restrito (`rssh`, `scponly` ou
  equivalente).
- Revise periodicamente quem tem acesso de leitura aos **Secrets** do
  repositório GitHub (**Settings → Collaborators and teams**) — secrets
  não são visíveis depois de salvos, mas quem tem permissão de admin no
  repositório pode recriá-los/sobrescrevê-los.

---

## 2. Rotação e renovação

| Item | Frequência recomendada |
|---|---|
| Chave SSH de deploy (`SSH_KEY`) | A cada troca de responsável pelo deploy, ou anualmente |
| Certificado TLS (Let's Encrypt via certbot) | Automático (renovação a cada ~60 dias, timer do systemd — só confirme que o timer está ativo, ver POP-003 seção 6) |
| Revisão das origens autorizadas do Google (Client ID / Picker API Key) | Sempre que o domínio de publicação mudar |
| Versões pinadas de bibliotecas externas (Tailwind, Font Awesome, `pdf-lib`, carregadas via CDN em `src/*.html`/`src/js/pdf-report.js`) | Revisão semestral — são carregadas por versão fixa (não "latest"), então não atualizam sozinhas; isso é intencional (estabilidade), mas exige uma checagem manual ocasional por atualizações de segurança |

---

## 3. Rotação e limpeza de logs

Em instalação nativa (POP-003), o Nginx do Debian já vem com rotação
automática via `logrotate` (`/etc/logrotate.d/nginx`), sem ação necessária
na maioria dos casos. Confirme que está ativo:

```bash
cat /etc/logrotate.d/nginx
sudo logrotate -d /etc/logrotate.d/nginx   # simula, sem executar de verdade
```

Em Docker (POP-004), configure rotação no próprio driver de log do
container (evita disco cheio em produções de longa duração):

```yaml
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Em hospedagem compartilhada (POP-005), a rotação é responsabilidade do
provedor — normalmente já configurada por padrão no painel.

---

## 4. Backups

- **Não é necessário (nem possível) fazer backup de dados de usuário no
  servidor** — eles nunca chegam até lá (ver POP-001). Não configure
  rotinas de backup de "banco de dados do lattesZen"; ela não existe.
- O único backup que faz sentido no lado do servidor é o dos **arquivos
  publicados** (útil para rollback rápido — ver POP-006, seção 2), e ele é
  dispensável na prática: o código-fonte completo já vive no repositório
  Git, que é a fonte de verdade e já está, por definição, versionado e
  fora do servidor de produção.
- Se quiser reforçar, mantenha só uma cópia do último `tar.gz` gerado no
  POP-006 fora do `DEPLOY_PATH`, com retenção curta (ex.: últimas 3
  versões) — não é crítico.

---

## 5. Monitoramento recomendado

Como não há processo de aplicação para monitorar (sem PID, sem porta de
app, sem fila), o monitoramento se resume ao que qualquer site estático
precisa:

- **Disponibilidade HTTP:** um checador externo simples (uptime
  monitor/healthcheck) fazendo `GET /index.html` a cada poucos minutos e
  esperando `200 OK`.
- **Validade do certificado TLS:** a maioria dos monitores de
  disponibilidade já alerta sobre expiração próxima; reforce com
  `certbot certificates` periodicamente se preferir checar manualmente.
- **Status do pipeline de CI/CD:** ative as notificações do GitHub Actions
  (e-mail ou integração com o canal de comunicação da equipe) para saber
  imediatamente quando um deploy falhar — é o sinal de alerta mais cedo
  disponível, antes mesmo de um usuário notar.

---

## 6. Concorrência de deploys

O workflow já vem configurado para nunca rodar dois deploys em paralelo
(`concurrency: group: publicar, cancel-in-progress: true`, em
`.github/workflows/deploy.yml`) — um push novo cancela automaticamente um
deploy anterior ainda em andamento para a mesma branch, evitando dois
`rsync`/`tar` concorrentes escrevendo na mesma pasta. Não é preciso (nem
recomendado) implementar um lock manual por fora disso.

---

## 7. Checklist de manutenção trimestral

- [ ] Confirmar que o timer de renovação do certbot está ativo (POP-003).
- [ ] Revisar quem tem acesso aos Secrets do repositório GitHub.
- [ ] Conferir se há atualização disponível para as bibliotecas externas
      pinadas por versão (seção 2).
- [ ] Verificar espaço em disco e tamanho dos logs acumulados.
- [ ] Testar o procedimento de rollback (POP-006, seção 5) num ambiente
      que não seja produção, para garantir que o backup mais recente é
      restaurável.
