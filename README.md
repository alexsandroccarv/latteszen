# lattesZen

Organizador do **Currículo Lattes** que roda inteiramente no navegador, com
importação fiel ao XML oficial do CNPq e anexação de evidências
(comprovações) diretamente numa pasta local do seu computador.

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
- **Módulo Súmula Curricular FAPESP** (opcional): roteiro nas seções oficiais,
  com o texto de cada uma montado a partir dos itens catalogados, exportável
  em `.docx`.
- **Relatório completo (PDF)**: um único arquivo pronto para impressão/
  encadernação — capa, sumário paginado, Memorial descritivo, o currículo
  completo e as evidências públicas mescladas de verdade dentro do PDF. Além
  do download, com um diretório configurado uma cópia também é salva na
  pasta "Relatórios".

**Fora do escopo (por ora):**

- Não é um serviço online — **não há backend**; nada é enviado para a nuvem.
- Alguns tipos **não existem no formato de importação do Lattes** e por isso
  ficam apenas locais/na página pública (não vão para o XML): *Licença*,
  *Membro de corpo editorial*, *Comitê de assessoramento* e *Revisor
  (periódico/fomento)*. As categorias **RSC** e **Registros pessoais**
  também não são vinculadas ao Lattes por design, assim como os itens
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
  aplicação continua funcional com estilos locais. Exceção: gerar o
  "Relatório completo (PDF)" (Configurações → Trazer e levar dados) carrega
  a biblioteca pdf-lib sob demanda via CDN — sem conexão, só essa função
  específica fica indisponível (com um aviso claro), o resto do app segue
  funcionando normalmente.
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
  pop/          POPs de implantação/operação para infraestrutura e suporte
tools/          harnesses de validação (XSD + DTD) do XML exportado
build.mjs       monta a pasta dist/
```

---

## Documentação de operação

Para quem instala/mantém o site em produção (infraestrutura, suporte), a
pasta [`docs/pop/`](docs/pop/) reúne POPs (Procedimentos Operacionais
Padrão) modulares: visão geral e requisitos, configuração de credenciais,
instalação nativa em Debian, Docker, hospedagem compartilhada, atualização,
troubleshooting e boas práticas. Veja também o [`DEPLOY.md`](DEPLOY.md)
para o passo a passo específico do pipeline de CI/CD.

---

## Privacidade

Aplicação **100% local**: os dados do currículo, as evidências e as
configurações não saem do seu navegador/computador. Nada é enviado a servidores
do projeto.

---

## Acessibilidade

Auditoria de teclado/leitor de tela feita e corrigida (issue #17):

- **Modais com armadilha de foco de verdade** — o aviso de 1ª execução e o
  aviso de cookies (`src/js/a11y.js`, `trapFocus()`) movem o foco pra dentro
  ao abrir, prendem Tab/Shift+Tab só entre os elementos focáveis de dentro
  (nada de escapar pra página por trás) e devolvem o foco a quem estava
  focado antes ao fechar. O aviso de 1ª execução também fecha com Esc.
- **Régua de abas navegável por setas** (padrão WAI-ARIA Authoring
  Practices para `tablist`): ←/→ movem o foco entre as abas visíveis e
  habilitadas, Home/End vão pra 1ª/última — com ativação automática.
- **Estado de alternância exposto via `aria-pressed`** nos chips de filtro
  (Conformidade), ícones de status, e nos botões do assistente de
  diretório (Configurações) — antes só visual (cor/borda).
- **Controles antes mudos ganharam nome acessível**: o ícone de ajuda "(?)"
  das seções de importar/exportar virou um `<button>` de verdade (focável,
  com `aria-label`, e clicável — o clique mostra a explicação num toast,
  cobrindo também quem usa tela de toque sem hover); cada coluna de um
  campo "repeater" (ex.: lista de Autores) e cada seletor de nível de
  habilidade (Idiomas) ganhou `aria-label` próprio.
- **Buscador de critério do RSC-PCCTAE** virou um combobox ARIA completo
  (`role="combobox"`/`"listbox"`/`"option"`, `aria-expanded`,
  `aria-activedescendant`), navegável por ↓/↑/Enter, não só clique.
- **Alvos de toque maiores** nos ícones de ação mais usados (editar/
  duplicar/excluir, evidências, reordenar) — de 24-28px para 32-36px.
- **Contraste** nas paletas clara/escura e no alto contraste existente
  auditado contra WCAG AA (todas as combinações principais já passavam;
  um par de cores inconsistente — texto auxiliar `gray-400`/`gray-500`
  trocados entre os dois temas — foi corrigido).

Suíte de regressão dedicada em `tools/tests/specs/a11y.mjs`.

---

## SEO

Cada uma das 10 páginas públicas (`src/index.html` e as páginas estáticas de
ajuda/institucionais) tem `<title>` e `<meta name="description">` próprios,
`<link rel="canonical">`, tags Open Graph (`og:title`, `og:description`,
`og:image` etc.) e Twitter Card (`summary_large_image`), todas apontando para
o domínio publicado, `https://ccarvalho.net/labs/latteszen/`. A imagem de
compartilhamento fica em `src/images/og-image.png` (1200×630px).

Também há `src/robots.txt` (libera todos os agentes e aponta pro sitemap) e
`src/sitemap.xml` (lista as 10 páginas públicas). Como o app é publicado num
subcaminho (`/labs/latteszen/`) de um host compartilhado, esses dois arquivos
só ficam acessíveis em `.../labs/latteszen/robots.txt` e
`.../labs/latteszen/sitemap.xml` — não na raiz do domínio
(`https://ccarvalho.net/robots.txt`), que está fora do controle deste
repositório.

`build.mjs` copia `src/` para `dist/` sem transformação, então esses arquivos
(e a pasta `images/`) são publicados como estão.

---

## Licença

Distribuído sob a **GNU Affero General Public License v3.0 (AGPLv3)**, ou,
a critério de quem redistribui, qualquer versão posterior. Consulte
<https://www.gnu.org/licenses/agpl-3.0.html>.

Documentação em conformidade com as recomendações da FSF em
["Como usar as licenças GNU para o seu próprio software"](https://www.gnu.org/licenses/gpl-howto.html):

- O texto completo da licença está no arquivo [`LICENSE`](LICENSE) (mesmo
  conteúdo que o arquivo `COPYING` das recomendações da FSF, sob o nome
  reconhecido pelo GitHub).
- Cada arquivo-fonte (`src/js/*.js`, `src/css/styles.css`, `src/*.html`) traz
  a nota de copyright e a declaração de licença no topo.
- Como aplicação web (interage com pessoas usuárias pela rede), o rodapé de
  cada página traz um link **"Código-fonte"** para o repositório, conforme o
  art. 13 da AGPLv3.

## Autoria

**Alexsandro Cardoso Carvalho** — UNIFESP
GitHub: <https://github.com/alexsandroccarv> ·
Repositório: <https://github.com/alexsandroccarv/lattesZen>
