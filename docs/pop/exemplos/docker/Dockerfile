# lattesZen — imagem de exemplo (Docker), citada no POP-004.
#
# O lattesZen não tem backend: esta imagem só empacota um servidor web
# estático (Nginx) servindo a pasta dist/ já montada por `node build.mjs`.
# Não é o pipeline oficial do projeto (que publica via rsync/SSH — ver
# POP-003/006) — é um caminho alternativo para quem prefere operar por
# container.
#
# Build (a partir da raiz do repositório):
#   node build.mjs
#   docker build -t latteszen -f docs/pop/exemplos/docker/Dockerfile .

FROM nginx:1.27-alpine

# Configuração de MIME types / cache do Service Worker — ver comentários
# no próprio arquivo.
COPY docs/pop/exemplos/docker/nginx.conf /etc/nginx/conf.d/default.conf

# Conteúdo publicável (gerado por `node build.mjs` antes do build da imagem)
COPY dist/ /usr/share/nginx/html/

EXPOSE 80
