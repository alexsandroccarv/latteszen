#!/usr/bin/env bash
# Deploy da pasta dist/ para o servidor via rsync sobre SSH.
# Variáveis vêm dos secrets do GitHub Environment correspondente:
#   SSH_HOST     (obrigatório)  ex.: servidor.unifesp.br
#   SSH_USER     (obrigatório)  ex.: deploy
#   SSH_KEY      (obrigatório)  chave PRIVADA SSH dedicada ao deploy
#   DEPLOY_PATH  (obrigatório)  ex.: /var/www/latteszen-dev
#   SSH_PORT     (opcional, padrão 22)
set -euo pipefail

if [ -z "${SSH_HOST:-}" ] || [ -z "${SSH_USER:-}" ] || [ -z "${SSH_KEY:-}" ] || [ -z "${DEPLOY_PATH:-}" ]; then
  echo "::warning::Secrets do ambiente não configurados (SSH_HOST/SSH_USER/SSH_KEY/DEPLOY_PATH)."
  echo "Pulei o deploy. Configure os secrets do Environment para ativar a publicação."
  exit 0
fi

PORT="${SSH_PORT:-22}"

# Prepara a chave e o known_hosts
mkdir -p ~/.ssh
chmod 700 ~/.ssh
printf '%s\n' "$SSH_KEY" > ~/.ssh/id_deploy
chmod 600 ~/.ssh/id_deploy
ssh-keyscan -p "$PORT" -H "$SSH_HOST" >> ~/.ssh/known_hosts 2>/dev/null || true
chmod 600 ~/.ssh/known_hosts

SSH_OPTS="-i $HOME/.ssh/id_deploy -p ${PORT} -o StrictHostKeyChecking=accept-new -o ConnectTimeout=30"
REMOTE="${SSH_USER}@${SSH_HOST}"

echo "Publicando em ${REMOTE}:${DEPLOY_PATH} (porta ${PORT})"

# Garante que o diretório de destino exista (rsync antigo não cria subpastas).
ssh $SSH_OPTS "$REMOTE" "mkdir -p '${DEPLOY_PATH}'"

# Tenta rsync (ideal: incremental + --delete). Em hospedagem compartilhada sem
# rsync no servidor, cai no fallback via tar por SSH (emula o --delete).
if command -v rsync >/dev/null 2>&1 && \
   rsync -avz --delete -e "ssh ${SSH_OPTS}" ./dist/ "${REMOTE}:${DEPLOY_PATH}/"; then
  echo "Deploy (rsync) concluído."
else
  echo "::warning::rsync indisponível/falhou — usando fallback via tar por SSH."
  tar -C dist -czf - . | ssh $SSH_OPTS "$REMOTE" \
    "mkdir -p '${DEPLOY_PATH}' && find '${DEPLOY_PATH}' -mindepth 1 -delete 2>/dev/null; tar -C '${DEPLOY_PATH}' -xzf -"
  echo "Deploy (tar) concluído."
fi
