# POP-004 — Instalação via Docker e Docker Compose

**Objetivo:** publicar o lattesZen usando containers, como alternativa ao
pipeline oficial do projeto (que é rsync/SSH direto no servidor — ver
POP-003/006).

> **Importante:** o repositório do lattesZen **não inclui** Dockerfile
> nativamente — o projeto foi desenhado para publicação direta em servidor
> via SSH. Este POP fornece arquivos de exemplo, prontos para uso, em
> `docs/pop/exemplos/docker/`. Como o app não tem backend nem banco de
> dados, "containerizar o lattesZen" é só **empacotar um servidor web
> estático** (Nginx) servindo a pasta `dist/` — não há processo de
> aplicação, worker, fila, nem qualquer outro serviço a orquestrar.

---

## 1. Arquivos de exemplo (já incluídos neste repositório)

```
docs/pop/exemplos/docker/
├── Dockerfile          # Nginx alpine + dist/ embutido na imagem
├── docker-compose.yml  # sobe o serviço "web" na porta 8080
└── nginx.conf          # MIME types + cache do Service Worker (ver POP-003)
```

**`Dockerfile`** — constrói uma imagem `nginx:1.27-alpine` com o conteúdo
de `dist/` copiado para dentro da imagem, e a configuração de Nginx do
`nginx.conf` (mesmas correções de `robots.txt`/`sitemap.xml`/`sw.js` do
POP-003).

**`docker-compose.yml`** — sobe um único serviço (`web`), mapeando a porta
`8080` do host para a `80` do container. Vem com duas opções documentadas
no próprio arquivo: (A) build da imagem com `dist/` embutido, ou (B) bind
mount do `dist/` direto do host (mais prático para atualizar sem rebuild —
ver seção 3).

---

## 2. Build e execução

A partir da **raiz do repositório**:

```bash
# 1. Monta a pasta publicável (mesmo passo de sempre)
node build.mjs

# 2. Build da imagem + subida do container
docker compose -f docs/pop/exemplos/docker/docker-compose.yml up -d --build
```

Verifique que subiu:

```bash
docker compose -f docs/pop/exemplos/docker/docker-compose.yml ps
curl -I http://localhost:8080/index.html   # espera "HTTP/1.1 200 OK"
```

O site fica acessível em `http://SEU_HOST:8080` (ajuste a porta/proxy
reverso — Traefik, Nginx externo, etc. — conforme sua infraestrutura).

---

## 3. Gerenciamento dos containers

```bash
# Ver logs do Nginx (access/error) em tempo real
docker compose -f docs/pop/exemplos/docker/docker-compose.yml logs -f web

# Reiniciar (ex.: depois de trocar a config do Nginx)
docker compose -f docs/pop/exemplos/docker/docker-compose.yml restart web

# Parar
docker compose -f docs/pop/exemplos/docker/docker-compose.yml down
```

### Atualizando o conteúdo publicado

**Opção A (imagem com `dist/` embutido — a que vem ativa por padrão):**
exige rebuild a cada atualização:

```bash
git pull
node build.mjs
docker compose -f docs/pop/exemplos/docker/docker-compose.yml up -d --build
```

**Opção B (bind mount, comentada no `docker-compose.yml`):** ative
descomentando os campos `volumes:`/`image:` e comentando `build:` no
arquivo. Depois, atualizar é só:

```bash
git pull
node build.mjs
# Nada para reiniciar — o Nginx já lê os arquivos atualizados na próxima
# requisição (o bind mount aponta direto para dist/ no host).
```

---

## 4. Persistência de dados (volumes)

**Não há dado de aplicação para persistir.** O lattesZen não escreve nada
no servidor em tempo de execução — nenhum upload de usuário chega até o
container, nenhum banco de dados, nenhuma sessão. O único "volume" que faz
sentido é o **bind mount opcional do próprio site estático** (opção B
acima), que existe só por conveniência operacional (evitar rebuild da
imagem a cada deploy), não por necessidade de persistência de dados.

Se quiser persistir os **logs do Nginx** entre reinícios do container
(útil para o POP-007), adicione ao `docker-compose.yml`:

```yaml
    volumes:
      - ./nginx-logs:/var/log/nginx
```

---

## 5. Publicação automática (CI/CD) apontando para um host com Docker

O pipeline oficial do projeto (`.github/workflows/deploy.yml`) publica via
rsync/SSH para uma **pasta** no servidor (ver POP-006) — ele não sabe nada
sobre Docker. Duas formas de conciliar isso com este ambiente:

1. **Recomendada:** use a opção B (bind mount) e aponte o `DEPLOY_PATH`
   (secret do GitHub, ver POP-002) para a pasta do host montada no
   container — o deploy via rsync continua funcionando exatamente como no
   POP-003, e o container só "enxerga" o resultado.
2. Configure um passo adicional (fora do escopo deste projeto, exige editar
   o workflow) para, depois do rsync, rodar `docker compose restart` no
   servidor via SSH — só necessário se optar pela opção A (imagem com
   `dist/` embutido).
