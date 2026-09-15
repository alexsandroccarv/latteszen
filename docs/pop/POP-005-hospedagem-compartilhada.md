# POP-005 — Deploy em Hospedagem Compartilhada (cPanel/Plesk)

**Objetivo:** publicar o lattesZen numa hospedagem compartilhada comum
(cPanel, Plesk ou similar), sem acesso root ao servidor.

> **Não há banco de dados para configurar neste POP.** O lattesZen não usa
> banco de dados em nenhuma hipótese (ver POP-001) — se o painel do seu
> provedor pedir para você criar um banco MySQL/PostgreSQL "para o site",
> **não é necessário**; ignore essa etapa.

---

## 1. Preparar o pacote para envio

Numa máquina com Node.js (a sua, ou peça a um desenvolvedor), monte a
pasta publicável a partir do código-fonte:

```bash
git clone https://github.com/alexsandroccarv/latteszen.git
cd latteszen
node build.mjs
```

Isso cria a pasta `dist/`, com esta estrutura (a que precisa ir para o
servidor — **o conteúdo de dentro dela**, não a pasta `dist` em si):

```
dist/
├── index.html
├── ajuda.html, ajuda-lattes.html, ajuda-rsc.html, sobre.html, ...
├── manifest.json
├── favicon.svg
├── robots.txt
├── sitemap.xml
├── sw.js
├── css/
│   └── styles.css
└── js/
    ├── app.js, config.js, storage.js, ...
```

Compacte o **conteúdo** de `dist/` (não a pasta em si) para facilitar o
upload:

```bash
cd dist && zip -r ../latteszen-dist.zip . && cd ..
```

---

## 2. Enviar para o servidor

### Opção A — Gerenciador de Arquivos do painel

1. No cPanel/Plesk, abra **Gerenciador de Arquivos** (File Manager).
2. Navegue até a pasta de destino:
   - Domínio principal → geralmente `public_html/`.
   - Subdomínio ou pasta específica (ex.: `seusite.com/labs/latteszen`) →
     a pasta correspondente dentro de `public_html/` (crie-a se não
     existir: `public_html/labs/latteszen`).
3. Faça upload do `latteszen-dist.zip` para essa pasta.
4. Clique com o botão direito no zip enviado → **Extrair** → confirme que
   os arquivos ficaram **diretamente** dentro da pasta de destino (não
   dentro de uma subpasta `dist/` criada pela extração — se isso
   acontecer, mova o conteúdo um nível acima e apague a subpasta vazia).
5. Apague o `.zip` depois de extrair (não precisa ficar publicado).

### Opção B — FTP/SFTP

1. No painel, crie (ou reaproveite) uma conta FTP com acesso à pasta de
   destino (**cPanel → Contas FTP**).
2. Com um cliente como o FileZilla, conecte usando host/usuário/senha
   fornecidos pelo painel.
3. Arraste o **conteúdo** da pasta `dist/` local (não a pasta em si) para
   a pasta de destino remota.

---

## 3. Apontar o domínio/subdomínio (document root)

Se o lattesZen vai ficar na **raiz do domínio principal**, nenhum ajuste é
necessário além de já ter colocado os arquivos em `public_html/`.

Se vai ficar num **subdomínio** ou **domínio adicional**:

1. cPanel → **Domínios** (ou **Subdomínios**, em painéis mais antigos).
2. Crie o subdomínio/domínio adicional apontando o **Document Root** para
   a pasta onde os arquivos foram extraídos (ex.:
   `public_html/labs/latteszen`).

> A aplicação funciona em qualquer subpasta sem ajuste de código — todas
> as referências internas (CSS/JS/imagens) são **relativas**, não
> absolutas a partir da raiz do domínio.

---

## 4. (Alternativa) Publicação via SSH, se o provedor oferecer

Alguns planos de hospedagem compartilhada oferecem SSH (às vezes só um
"jailed shell"), mesmo sem `rsync` instalado no servidor. O pipeline
oficial do projeto (`.github/scripts/deploy.sh`) já foi feito para esse
cenário: ele **tenta `rsync` primeiro e cai automaticamente para um
fallback via `tar` por SSH** se o `rsync` não estiver disponível no
destino — sem exigir nenhuma configuração extra sua.

Se o seu provedor oferece SSH, é preferível usar o deploy automático do
projeto (ver POP-002, seção 2, e POP-006) em vez de repetir os passos 1-3
manualmente a cada atualização.

---

## 5. Checklist final

- [ ] Arquivos extraídos **diretamente** na pasta de destino (sem uma
      subpasta `dist/` a mais no meio do caminho).
- [ ] `index.html` acessível na URL esperada (ex.:
      `https://seusite.com/index.html` responde 200).
- [ ] `robots.txt` e `sitemap.xml` acessíveis e servidos como
      texto/XML (não como download) — a maioria dos servidores Apache de
      hospedagem compartilhada já acerta isso sozinha; se não acertar,
      adicione ao `.htaccess` da pasta:
      ```apache
      AddType text/plain .txt
      AddType application/xml .xml
      ```
- [ ] Nenhum banco de dados foi criado/configurado para este site (não é
      necessário).
