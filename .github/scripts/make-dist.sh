#!/usr/bin/env bash
# Monta a pasta dist/ com os arquivos que vão para o servidor.
# O lattesZen é uma aplicação de arquivo único (index.html autossuficiente),
# mas copiamos também assets e páginas de apoio, se existirem.
set -euo pipefail

rm -rf dist
mkdir -p dist
cp index.html dist/

# Assets opcionais (ex.: images/geral/gov_br.svg)
[ -d images ] && cp -r images dist/ || true

# Páginas de apoio opcionais
for f in termodeuso.html politicadeprivacidade.html ajuda.html favicon.ico; do
  [ -f "$f" ] && cp "$f" dist/ || true
done

echo "Conteúdo de dist/:"
ls -la dist/
