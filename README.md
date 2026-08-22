# lattesZen

Organizador do **Currículo Lattes** que roda inteiramente no navegador, com
importação fiel ao XML oficial do CNPq e anexação de evidências
(comprovações) diretamente numa pasta local do seu computador.

> Versão 0.2.0 · UNIFESP

---

## Objetivo e escopo

O lattesZen ajuda pesquisadores(as) e servidores(as) a **catalogar, comprovar e
publicar** a produção do Currículo Lattes, sem depender de servidores: todos os
dados ficam **no seu navegador e numa pasta que você escolhe**.

**O que faz:**

- **Catalogar** itens em todas as categorias do Lattes (Dados gerais, Formação,
  Atuação, Projetos, Produções, Patentes/Registros, Inovação, Educação e
  Popularização de C&T, Eventos, Orientações, Bancas) com **máxima
  correspondência de campos** com a Plataforma Lattes.
- **Importar o XML do Lattes** no formato oficial (schema `CurriculoLattes.xsd`
  e gramática de importação `LMPL`, em ISO-8859-1), com **deduplicação por
  assinatura de conteúdo** (reimportar o XML não cria itens duplicados).
- **Anexar evidências** (PDFs/imagens) a cada item, gravadas por categoria numa
  pasta local via *File System Access API*.
- **Conformidade**: painel que mostra o que está comprovado, o que falta de
  evidência e o que falta de campos obrigatórios.
- **Publicar na Web**: gera uma **página HTML pública do currículo** (arquivo
  único, autossuficiente), com as evidências marcadas como públicas embutidas.
- **Módulo RSC-PCCTAE** (opcional, Decreto nº 13.048/2026): simulação de
  pontuação e nível a partir dos itens catalogados.

**Fora do escopo (por ora):**

- Não é um serviço online — **não há backend**; nada é enviado para a nuvem.
- Alguns tipos **não existem no formato de importação do Lattes** e por isso
  ficam apenas locais/na página pública (não vão para o XML): *Licença*,
  *Membro de corpo editorial*, *Comitê de assessoramento* e *Revisor
  (periódico/fomento)*. As categorias **RSC (97)** e **Registros pessoais
  (20)** também não são exportadas ao Lattes por design, assim como os itens
  de **Conexões** (rede social/acadêmica/profissional — agrupados dentro de
  Dados gerais).

---

## Requisitos técnicos

**Para usar a aplicação:**

- Navegador **baseado em Chromium** — Google Chrome ou Microsoft Edge
  (desktop). A gravação de arquivos/evidências usa a *File System Access API*,
  disponível nesses navegadores. Em navegadores sem suporte, a catalogação e o
  índice local (localStorage) funcionam, mas a gravação na pasta fica indisponível.
- Conexão à internet é **opcional**: recursos externos (Tailwind, ícones,
  fontes) são carregados de CDN de forma tolerante a falha — offline, a
  aplicação continua funcional com estilos locais.
- Os dados ficam no navegador (localStorage) e na **pasta escolhida** por você;
  faça backups (a própria aplicação lembra periodicamente).

**Para desenvolver / validar (opcional):**

- **Node.js 18+** para o build e os harnesses de validação.
- **`xmllint`** (libxml2) para validar o XML gerado contra o schema e o DTD.

```bash
# Montar a pasta publicável (dist/) copiando src/
node build.mjs

# Validar a exportação XML contra o schema XSD e o DTD LMPL (importação)
node tools/xml-export-harness.mjs      # amostra com todos os tipos
node tools/xml-export-branches.mjs     # todos os subtipos/ramos

# Suíte de testes de regressão de UI (Playwright) — cobre bugs já corrigidos
# no passado, pra não voltarem a acontecer numa mudança futura
npm install        # instala o Playwright (só para desenvolvimento/testes)
npm test           # roda a suíte inteira
```

Para rodar localmente, sirva a pasta `src/` (ou `dist/`) por um servidor
estático — ex.: `npx serve src` — e abra no navegador. Abrir o `index.html`
"solto" (via `file://`) não é suportado, pois a aplicação é multi-arquivo.

---

## Estrutura do repositório

```
src/            aplicação (index.html, css/, js/, imagens, páginas de ajuda)
  js/
    app.js               UI, catalogação, conformidade, configurações
    lattes-types.js      taxonomia de categorias/tipos e campos
    lattes-xml.js        importador do XML do Lattes
    lattes-xml-export.js exportador do XML do Lattes
    publish.js           gerador da página pública do currículo
    rsc.js               módulo RSC-PCCTAE
    storage.js           persistência (localStorage + File System Access API)
    encoding.js          codificação ISO-8859-1
docs/           schema CurriculoLattes.xsd e DTD LMPL de referência
tools/          harnesses de validação (XSD + DTD) do XML exportado
build.mjs       monta a pasta dist/
```

---

## Privacidade

Aplicação **100% local**: os dados do currículo, as evidências e as
configurações não saem do seu navegador/computador. Nada é enviado a servidores
do projeto.

---

## Licença

Distribuído sob a **GNU Affero General Public License v3.0 (AGPLv3)**.
Consulte <https://www.gnu.org/licenses/agpl-3.0.html>.

## Autoria

**Alexsandro Cardoso Carvalho** — UNIFESP
GitHub: <https://github.com/alexsandroccarv> ·
Repositório: <https://github.com/alexsandroccarv/lattesZen>
