# POP-006 — Procedimento de Atualização (Deploy de Novas Versões)

**Objetivo:** atualizar uma instalação existente do lattesZen com
segurança, incluindo o que fazer quando algo dá errado.

> **Não existem migrations de banco de dados neste projeto** — o lattesZen
> não tem banco (ver POP-001). "Atualizar" aqui significa, na prática,
> **substituir os arquivos estáticos publicados**. Os passos deste POP
> refletem isso e são mais curtos do que num app tradicional.

---

## 1. Como a atualização normalmente acontece (caminho automático)

O jeito **padrão e recomendado** de atualizar é deixar o pipeline de CI/CD
fazer tudo: um `push` (ou merge) na branch `principal` do repositório
dispara automaticamente, via GitHub Actions:

```
push em "principal"
   │
   ▼
1. Verifica sintaxe de todos os módulos JS
2. Roda a suíte de testes de regressão (Playwright, ~400+ testes de UI)
3. Valida a exportação XML contra o schema oficial (XSD/DTD do Lattes)
4. Monta a pasta dist/ (node build.mjs)
5. Confere a estrutura do dist/ (index.html, js/, css/ presentes)
6. Publica no servidor via rsync/SSH (ou tar/SSH como fallback)
```

**Na prática, o trabalho do técnico de infraestrutura é só confirmar que
esse pipeline rodou com sucesso** (aba **Actions** do GitHub → o workflow
"Publicar lattesZen" deve terminar **verde**). Se terminou vermelho, veja o
**POP-007** (troubleshooting).

O restante deste POP cobre o **caminho manual** (necessário só se o CI
estiver indisponível, ou se você precisar publicar de uma máquina local
diretamente).

---

## 2. Backup pré-atualização

Como não há banco de dados, o backup relevante é só o **estado atual dos
arquivos já publicados no servidor** — útil para um rollback rápido (seção
5) se a nova versão tiver algum problema visual/funcional grave.

```bash
# No servidor (ou via SSH a partir da sua máquina)
ssh deploy@SEU_SERVIDOR "tar -czf /var/backups/latteszen-$(date +%Y%m%d-%H%M).tar.gz -C /var/www/latteszen ."
```

Guarde esse arquivo fora do próprio `/var/www/latteszen` (ele seria
sobrescrito no próximo deploy).

> **Dados de currículo dos usuários NÃO precisam (e não podem) ser
> incluídos neste backup** — eles nunca chegam ao seu servidor (ficam no
> navegador/pasta local/Google Drive de cada pessoa, ver POP-001). Isso
> está fora do escopo e da responsabilidade da equipe de infraestrutura.

---

## 3. Aplicar a nova versão manualmente

Use este caminho só se o deploy automático (seção 1) não for uma opção no
momento.

```bash
# 1. Numa máquina com Node.js 20+ e as credenciais SSH configuradas
git clone https://github.com/alexsandroccarv/latteszen.git   # ou: git pull, se já clonado
cd latteszen
git checkout principal
git pull

# 2. (Opcional, mas recomendado) rode a suíte de testes antes de publicar
npm ci
npx playwright install --with-deps chromium
npm test

# 3. Monte a pasta publicável
node build.mjs

# 4. Publique manualmente, reaproveitando o mesmo script do CI
export SSH_HOST=seu_servidor
export SSH_USER=deploy
export SSH_PORT=22
export SSH_KEY="$(cat ~/.ssh/latteszen_deploy)"
export DEPLOY_PATH=/var/www/latteszen
bash .github/scripts/deploy.sh
```

O script `deploy.sh` é **o mesmo** usado pelo CI — ele tenta `rsync`
primeiro e cai para `tar` por SSH automaticamente se necessário (ver
POP-005, seção 4).

---

## 4. Rotina pós-atualização

1. **Confirme a versão publicada:** abra o site e confira, no rodapé, se
   o número de versão bate com o esperado (`APP_CONFIG.version`, em
   `src/js/config.js`) — ou acesse diretamente
   `https://seusite.com/js/config.js` e procure por `version:`.
2. **Sem cache de servidor para limpar** — o lattesZen não tem cache
   server-side (Redis, OPcache, etc.) porque não tem backend.
3. **Cache do navegador dos usuários (Service Worker):** o app usa um
   Service Worker (`sw.js`) para funcionar offline. Ele detecta sozinho
   quando os arquivos mudaram e recarrega a aba do usuário automaticamente
   (mecanismo já implementado em `js/pwa.js` — não exige nenhuma ação do
   time de infraestrutura). Se um usuário reportar "ainda estou vendo a
   versão antiga" logo após um deploy:
   - Peça para recarregar a página **uma segunda vez** (a primeira
     recarga baixa a versão nova em segundo plano; a segunda a ativa).
   - Se persistir, peça um "hard refresh" (`Ctrl+Shift+R` / `Cmd+Shift+R`)
     ou para limpar o Service Worker em
     `chrome://serviceworker-internals` (Chrome/Edge).
4. **Reinício de serviço:** não é necessário reiniciar o Nginx/Apache após
   uma atualização — arquivos estáticos são servidos direto do disco a
   cada requisição.

---

## 5. Rollback

Como o deploy espelha `dist/` no servidor (`rsync --delete`), reverter uma
versão problemática é **publicar novamente uma versão anterior**, não
"desfazer" nada no servidor:

```bash
git checkout <tag-ou-commit-anterior>
node build.mjs
bash .github/scripts/deploy.sh   # com as mesmas variáveis de ambiente da seção 3
```

Alternativa mais rápida, se você fez o backup da seção 2:

```bash
ssh deploy@SEU_SERVIDOR "rm -rf /var/www/latteszen/* && tar -xzf /var/backups/latteszen-AAAAMMDD-HHMM.tar.gz -C /var/www/latteszen"
```

Depois de qualquer rollback, repita o passo 4 (confirmar a versão
publicada) e comunique a equipe de desenvolvimento.
