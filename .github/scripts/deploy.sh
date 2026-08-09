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

echo "Publicando em ${SSH_USER}@${SSH_HOST}:${DEPLOY_PATH} (porta ${PORT})"

# --delete mantém o destino idêntico ao dist/ (remove arquivos órfãos).
rsync -avz --delete \
  -e "ssh -i ~/.ssh/id_deploy -p ${PORT} -o StrictHostKeyChecking=accept-new" \
  ./dist/ "${SSH_USER}@${SSH_HOST}:${DEPLOY_PATH}/"

echo "Deploy concluído."
