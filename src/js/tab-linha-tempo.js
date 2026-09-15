// lattesZen — Copyright (C) 2026 Alexsandro Cardoso Carvalho
//
// This file is part of lattesZen.
//
// lattesZen is free software: you can redistribute it and/or modify it
// under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or (at
// your option) any later version.
//
// lattesZen is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public
// License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with lattesZen. If not, see <https://www.gnu.org/licenses/>.

/* ==========================================================================
   lattesZen — Aba Linha do tempo (nuvem de palavras + mapa de calor)
   --------------------------------------------------------------------------
   Duas visões rápidas sobre o catálogo, sem precisar abrir Conformidade e
   vasculhar item a item:

   1. Nuvem de palavras: termos mais frequentes nos títulos, palavras-chave
      e área de conhecimento dos itens — quanto maior a palavra, mais vezes
      ela aparece.
   2. Linha do tempo: painel estilo "gráfico de contribuições" (GitHub) —
      cada linha uma categoria do Lattes, cada coluna um ano, e a
      intensidade da cor do quadradinho reflete a quantidade de itens
      daquela categoria naquele ano.

   O "ano" de cada item reaproveita AppCore.itemYear() — o mesmo critério já
   usado para ordenar por ano em Conformidade/Publicar (fields.ano, senão
   anoFim, senão anoInicio) — um único ano por item, mesmo para itens com
   período (ex.: Formação, Atuação), em vez de espalhar o mesmo item por
   todos os anos do intervalo.

   As duas seções ignoram as mesmas categorias "não-produção" (identificação,
   endereço, foto de perfil etc.) — ver CATEGORIAS_EXCLUIDAS.
   ========================================================================== */
window.TabLinhaTempo = (function () {
    const { state, $, esc, itemYear } = window.AppCore;

    // Categoria "não-produção" (identificação, endereço, foto de perfil,
    // documentos pessoais etc.) — não entra nem na nuvem de palavras, nem na
    // grade.
    const CATEGORIAS_EXCLUIDAS = new Set(['DADOS_GERAIS']);

    /* ------------------------------ Nuvem de palavras ------------------------------ */

    // Palavras sem valor temático (artigos, preposições, conjunções etc.) —
    // mantém a nuvem focada em termos que realmente descrevem o conteúdo.
    const STOPWORDS = new Set([
        'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
        'um', 'uma', 'uns', 'umas', 'e', 'ou', 'com', 'sem', 'sob', 'sobre', 'entre', 'para',
        'por', 'pra', 'pelo', 'pela', 'pelos', 'pelas', 'que', 'se', 'ao', 'aos', 'à', 'às',
        'é', 'foi', 'ser', 'são', 'tem', 'têm', 'como', 'mais', 'menos', 'muito', 'muitos',
        'este', 'esta', 'esse', 'essa', 'isso', 'isto', 'aquele', 'aquela', 'seu', 'sua',
        'seus', 'suas', 'nosso', 'nossa', 'the', 'of', 'and', 'in', 'to', 'for', 'on', 'with',
    ]);

    // Quebra um texto livre em palavras "significativas": minúsculas, sem
    // pontuação, com pelo menos 3 letras/números e fora da lista de stopwords.
    function extrairPalavras(texto) {
        return String(texto == null ? '' : texto)
            .toLowerCase()
            .split(/[^\p{L}\p{N}]+/u)
            .filter(w => w.length >= 3 && !STOPWORDS.has(w));
    }

    function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    // Localiza, num texto já em minúsculas, as ocorrências dos termos
    // compostos configurados (ex.: "tech talks") ANTES da separação normal
    // em palavras — assim eles são contados como um único termo, e não como
    // "tech" e "talks" isolados. Devolve os termos encontrados e o texto
    // restante, com essas ocorrências removidas (para não contar de novo
    // suas palavras isoladas na tokenização seguinte). Termos mais longos
    // são buscados primeiro, para o caso de um ser substring de outro.
    function extrairCompostas(texto, compostas) {
        let restante = texto;
        const achadas = [];
        compostas.slice().sort((a, b) => b.length - a.length).forEach(frase => {
            if (!frase) return;
            const re = new RegExp(`\\b${escapeRegExp(frase)}\\b`, 'gi');
            const n = (restante.match(re) || []).length;
            for (let i = 0; i < n; i++) achadas.push(frase);
            restante = restante.replace(re, ' ');
        });
        return { achadas, restante };
    }

    // Conta a frequência de cada palavra/termo nos títulos, palavras-chave
    // (campo "palavrasChave", separado por ";") e área de conhecimento dos
    // itens — devolve os N mais frequentes, do maior para o menor. Aplica as
    // duas listas configuráveis em Configurações → Nuvem de palavras: termos
    // compostos (contados como uma só unidade) e palavras excluídas.
    // `itensLista` opcional: por padrão usa state.items (todo o catálogo, aba
    // Linha do tempo do app); a geração da página pública passa só os itens
    // que também entram no currículo público (mesmo filtro de privacidade).
    function contarPalavras(limite, itensLista) {
        const compostas = (state.nuvemCompostas || []).map(s => String(s || '').trim().toLowerCase()).filter(Boolean);
        const exclusao = new Set((state.nuvemExclusao || []).map(s => String(s || '').trim().toLowerCase()).filter(Boolean));
        const freq = {};
        const conta = (w) => { if (w && !exclusao.has(w)) freq[w] = (freq[w] || 0) + 1; };

        (itensLista || state.items).forEach(it => {
            if (!it.categoryKey || CATEGORIAS_EXCLUIDAS.has(it.categoryKey)) return;
            const f = it.fields || {};
            const textos = [f.titulo, f.areaConhecimento, ...String(f.palavrasChave || '').split(';')];
            textos.forEach(t => {
                const bruto = String(t == null ? '' : t).toLowerCase();
                const { achadas, restante } = compostas.length ? extrairCompostas(bruto, compostas) : { achadas: [], restante: bruto };
                achadas.forEach(conta);
                extrairPalavras(restante).forEach(conta);
            });
        });
        return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, limite || 50);
    }

    function renderNuvemPalavras() {
        const palavras = contarPalavras(50);
        const corpo = palavras.length
            ? (() => {
                const max = palavras[0][1];
                const min = palavras[palavras.length - 1][1];
                const tamanho = (n) => (max === min ? 1.15 : 0.8 + ((n - min) / (max - min)) * 1.3).toFixed(2);
                const spans = palavras.map(([w, n]) => `<span class="text-govbr-700 dark:text-unifesp-400 font-semibold leading-none whitespace-nowrap" style="font-size:${tamanho(n)}rem" data-palavra="${esc(w)}" data-freq="${n}" title="${esc(w)}: ${n} ocorrência${n === 1 ? '' : 's'}">${esc(w)}</span>`).join('');
                return `<div id="nuvemPalavrasArea" class="w-full">${spans}</div>`;
            })()
            : `<p class="text-sm text-gray-500 italic">Nenhuma palavra encontrada ainda — preencha título, palavras-chave ou área de conhecimento nos itens.</p>`;

        return `
            <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-1 flex items-center gap-2"><i class="fa-solid fa-cloud text-govbr-600 dark:text-unifesp-400"></i> Nuvem de palavras</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Termos mais frequentes nos títulos, palavras-chave e área de conhecimento dos seus itens — quanto maior a palavra, mais vezes ela aparece. Passe o mouse para ver o total exato.</p>
                ${corpo}
            </section>`;
    }

    // Espalha as palavras (já inseridas em fluxo normal dentro de `area`) em
    // formato de nuvem: espiral a partir do centro, testando colisão de
    // retângulos com as palavras já posicionadas, em vez de simplesmente
    // empilhar em linhas. Mede cada <span> real já renderizado (offsetWidth/
    // Height) — nada de canvas ou biblioteca externa. Determinístico (sem
    // Math.random()): o ângulo inicial de cada palavra usa o ângulo áureo
    // (~137,5°) para espalhar os pontos de partida de forma orgânica.
    function posicionarNuvem(area) {
        const spans = Array.from(area.children);
        if (!spans.length) return;
        const larguraArea = area.clientWidth || 600;
        const alturaBase = Math.max(160, larguraArea * 0.5);
        const cx = larguraArea / 2, cy = alturaBase / 2;
        const PAD = 5;
        const caixas = [];

        spans.forEach((span, i) => {
            const largura = span.offsetWidth + PAD * 2;
            const altura = span.offsetHeight + PAD * 2;
            let angulo = (i * 2.4) % (Math.PI * 2);
            let raio = 0;
            let caixa = null;
            for (let passo = 0; passo < 2000; passo++) {
                const x = cx + raio * Math.cos(angulo) - largura / 2;
                const y = cy + raio * Math.sin(angulo) * 0.7 - altura / 2; // elipse: nuvem mais larga que alta
                const candidata = { x, y, w: largura, h: altura };
                const colide = caixas.some(c => candidata.x < c.x + c.w && c.x < candidata.x + candidata.w && candidata.y < c.y + c.h && c.y < candidata.y + candidata.h);
                if (!colide) { caixa = candidata; break; }
                angulo += 0.3;
                raio += 1.4;
            }
            caixas.push(caixa || { x: cx - largura / 2, y: cy - altura / 2, w: largura, h: altura });
        });

        const minX = Math.min(0, ...caixas.map(c => c.x));
        const maxX = Math.max(larguraArea, ...caixas.map(c => c.x + c.w));
        const minY = Math.min(0, ...caixas.map(c => c.y));
        const maxY = Math.max(...caixas.map(c => c.y + c.h));
        const larguraFinal = maxX - minX;
        const deslocX = larguraArea > larguraFinal ? (larguraArea - larguraFinal) / 2 - minX : -minX;
        const deslocY = -minY;

        spans.forEach((span, i) => {
            const c = caixas[i];
            span.style.position = 'absolute';
            span.style.left = `${c.x + PAD + deslocX}px`;
            span.style.top = `${c.y + PAD + deslocY}px`;
        });
        area.style.position = 'relative';
        area.style.height = `${(maxY - minY) + 10}px`;
    }

    /* ------------------------------ Linha do tempo (grade) ------------------------------ */

    // Níveis de intensidade (0-4, estilo GitHub) proporcionais ao maior valor
    // encontrado em toda a grade — a mesma escala vale para todas as linhas,
    // então dá pra comparar visualmente duas categorias diferentes.
    const NIVEL_CLASSES = [
        'bg-gray-100 dark:bg-gray-800',
        'viz-heat-1',
        'viz-heat-2',
        'viz-heat-3',
        'viz-heat-4',
    ];
    function nivel(n, max) {
        if (!n) return 0;
        if (!max) return 1;
        const r = n / max;
        if (r > 0.75) return 4;
        if (r > 0.5) return 3;
        if (r > 0.25) return 2;
        return 1;
    }

    // Agrupa os itens do catálogo em { categoryKey: { ano: quantidade } },
    // ignorando itens sem um ano identificável (itemYear() devolve null).
    // `itensLista` opcional: ver comentário de contarPalavras() acima.
    function contarPorCategoriaEAno(itensLista) {
        const porCategoria = {};
        let anoMin = null;
        const anoAtual = new Date().getFullYear();
        let anoMax = anoAtual;
        (itensLista || state.items).forEach(it => {
            const ano = itemYear(it);
            if (ano == null || !it.categoryKey) return;
            const porAno = (porCategoria[it.categoryKey] = porCategoria[it.categoryKey] || {});
            porAno[ano] = (porAno[ano] || 0) + 1;
            if (anoMin == null || ano < anoMin) anoMin = ano;
            if (ano > anoMax) anoMax = ano;
        });
        return { porCategoria, anoMin, anoMax };
    }

    function renderGradeLinhaTempo() {
        const { porCategoria, anoMin, anoMax } = contarPorCategoriaEAno();
        const catKeys = Object.keys(porCategoria)
            .filter(k => !CATEGORIAS_EXCLUIDAS.has(k))
            .sort((a, b) => {
                const ca = LattesTypes.categoryByKey(a), cb = LattesTypes.categoryByKey(b);
                return String(ca ? ca.num : '99').localeCompare(String(cb ? cb.num : '99'));
            });

        const corpo = catKeys.length
            ? (() => {
                // Anos do mais recente para o mais antigo.
                const anos = [];
                for (let y = anoMax; y >= anoMin; y--) anos.push(y);

                let max = 0;
                catKeys.forEach(k => Object.values(porCategoria[k]).forEach(n => { if (n > max) max = n; }));

                const labelByKey = {};
                catKeys.forEach(k => { labelByKey[k] = LattesTypes.categoryLabel(k); });

                // Coluna de rótulos (categorias) fica numa tabela separada, FORA
                // do <div class="overflow-x-auto">, para que a barra de rolagem
                // horizontal abranja só a área dos anos, não o quadro inteiro —
                // as duas tabelas usam a mesma altura de linha (h-[18px]/h-[22px])
                // e o mesmo border-spacing, então as linhas ficam alinhadas.
                const headCells = anos.map(y => `<th scope="col" class="px-0.5 pb-1 text-[10px] font-normal text-gray-500 dark:text-gray-400 text-center whitespace-nowrap">${y}</th>`).join('');
                const labelRows = catKeys.map(k => `<tr class="h-[22px]"><th scope="row" class="pr-3 text-xs font-medium text-left whitespace-nowrap">${esc(labelByKey[k])}</th></tr>`).join('');
                // aria-label no <td> (não só no title do <div>) — issue de
                // acessibilidade #17: por estar dividida em 2 <table>
                // (rótulos fora do <div> com scroll horizontal, dados
                // dentro), um leitor de tela não relaciona coluna/linha
                // entre elas; sem isto, cada célula da tabela de dados era
                // lida como uma div vazia (o `title` sozinho não é anunciado
                // ao navegar célula a célula) — o aria-label repete o
                // rótulo completo (categoria + ano + contagem) por célula
                // pra compensar essa falta de associação entre as 2 tabelas.
                const dataRows = catKeys.map(k => {
                    const cells = anos.map(y => {
                        const n = porCategoria[k][y] || 0;
                        const cls = NIVEL_CLASSES[nivel(n, max)];
                        const titulo = `${labelByKey[k]} — ${y}: ${n} ite${n === 1 ? 'm' : 'ns'}`;
                        return `<td class="p-0.5" aria-label="${esc(titulo)}"><div class="w-[11px] h-[11px] rounded-sm ${cls}" data-ano="${y}" data-qtd="${n}" title="${esc(titulo)}"></div></td>`;
                    }).join('');
                    return `<tr class="h-[22px]">${cells}</tr>`;
                }).join('');

                return `
                    <div class="flex items-start">
                        <table class="border-separate shrink-0" style="border-spacing:2px">
                            <caption class="sr-only">Categorias da linha do tempo</caption>
                            <thead><tr class="h-[18px]"><th class="pr-3">&nbsp;</th></tr></thead>
                            <tbody>${labelRows}</tbody>
                        </table>
                        <div class="overflow-x-auto min-w-0 flex-1 scroll-area">
                            <table class="border-separate" style="border-spacing:2px">
                                <caption class="sr-only">Quantidade de itens por categoria e ano — cada célula traz a categoria, o ano e a contagem</caption>
                                <thead><tr class="h-[18px]">${headCells}</tr></thead>
                                <tbody>${dataRows}</tbody>
                            </table>
                        </div>
                    </div>
                    <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-3">
                        <span>Menos</span>
                        ${NIVEL_CLASSES.map(cls => `<div class="w-2 h-2 rounded-sm ${cls}"></div>`).join('')}
                        <span>Mais</span>
                    </div>`;
            })()
            : `<p class="text-sm text-gray-500 italic py-8 text-center">Nenhum item com ano identificável ainda. Cadastre itens em <strong>Catalogar</strong> (ou importe o XML do Lattes) para ver a linha do tempo.</p>`;

        return `
            <section id="gradeLinhaTempo" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-1 flex items-center gap-2"><i class="fa-solid fa-table-cells text-govbr-600 dark:text-unifesp-400"></i> Linha do tempo</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Quantidade de itens por categoria e ano — quanto mais escuro o quadradinho, mais itens naquele ano. Passe o mouse sobre um quadradinho para ver o total exato.</p>
                ${corpo}
            </section>`;
    }

    /* ------------------------------ Gráfico: produção por tipo × ano ------------------------------ */
    // issue #10 — visão de "evolução da produção ao longo do tempo", agora por
    // TIPO de item (mais granular que a grade acima, que agrupa por categoria).
    // "Tipos de produção" = os tipos das 3 subdivisões da categoria "05
    // Produções" (Bibliográfica/Técnica/Outra artística-cultural), pega direto
    // da definição em LattesTypes — não do categoryKey gravado no item: um
    // tipo como "Artigo em periódico" continua sendo produção bibliográfica
    // mesmo se o usuário arquivou o item em outra categoria (ex.: "Educação e
    // Popularização de C&T", que reaproveita os mesmos tipos).
    // Usa LattesTypes.primaryCategory (não a lista de tipos dos "groups" da
    // categoria "05 Produções") de propósito: o primeiro só cobre os tipos
    // OFERECIDOS hoje no seletor de Catalogar, mas tipos legados ainda
    // reconhecidos pelo app (ex.: "LIVRO_CAPITULO", de antes da categoria
    // dividir em Livros/Capítulos) continuam existindo em catálogos
    // importados — primaryCategory() cobre esses também (getType() descarta
    // qualquer typeKey desconhecido, evitando contar lixo pela categoria
    // padrão de primaryCategory pra tipos não mapeados).
    function ehTipoDeProducao(item) {
        return !!LattesTypes.getType(item.typeKey) && LattesTypes.primaryCategory(item.typeKey) === 'PRODUCOES';
    }

    // Agrupa os itens de produção em { typeKey: { ano: quantidade } }, com o
    // total por tipo (decide quais tipos entram no gráfico e quais caem em
    // "Outros" — ver serieDeProducao). Mesmo critério de ano de
    // contarPorCategoriaEAno (itemYear — ignora itens sem ano identificável).
    function contarProducaoPorTipoEAno() {
        const porTipo = {}, totalPorTipo = {};
        let anoMin = null, anoMax = null;
        state.items.forEach(it => {
            if (!ehTipoDeProducao(it)) return;
            const ano = itemYear(it);
            if (ano == null) return;
            const porAno = (porTipo[it.typeKey] = porTipo[it.typeKey] || {});
            porAno[ano] = (porAno[ano] || 0) + 1;
            totalPorTipo[it.typeKey] = (totalPorTipo[it.typeKey] || 0) + 1;
            if (anoMin == null || ano < anoMin) anoMin = ano;
            if (anoMax == null || ano > anoMax) anoMax = ano;
        });
        return { porTipo, totalPorTipo, anoMin, anoMax };
    }

    // Paleta categórica validada (skill de dataviz): ordem fixa, testada pra
    // pares ADJACENTES seguros (empilhados) em claro e escuro — nunca gerar
    // mais cores ciclando. Classes de CSS puro (css/styles.css), não do
    // Tailwind: aqui a cor É o dado, não decoração — não pode depender da CDN
    // do Tailwind carregar pra existir. Além de 7 tipos, o resto entra em
    // "Outros" (cinza neutro — não compete com as cores de identidade reais).
    const CLASSES_COR_TIPO = ['viz-cat-1', 'viz-cat-2', 'viz-cat-3', 'viz-cat-4', 'viz-cat-5', 'viz-cat-6', 'viz-cat-7'];
    const CLASSE_COR_OUTROS = 'viz-cat-outros';
    const TOP_N_TIPOS = CLASSES_COR_TIPO.length;

    // Monta as séries do gráfico: os TOP_N_TIPOS tipos com mais itens, cada um
    // com sua própria cor, e o restante somado numa série "Outros" — evita um
    // gráfico com dezenas de cores quase indistinguíveis (ver dataviz skill:
    // acima de ~7-8 séries categóricas, dobrar a cauda em "Outros").
    function serieDeProducao() {
        const { porTipo, totalPorTipo, anoMin, anoMax } = contarProducaoPorTipoEAno();
        const tipoKeys = Object.keys(totalPorTipo).sort((a, b) => totalPorTipo[b] - totalPorTipo[a]);
        const principais = tipoKeys.slice(0, TOP_N_TIPOS);
        const demais = tipoKeys.slice(TOP_N_TIPOS);
        const series = principais.map((tk, i) => ({
            label: LattesTypes.label(tk), corClasse: CLASSES_COR_TIPO[i], porAno: porTipo[tk], total: totalPorTipo[tk],
        }));
        if (demais.length) {
            const porAnoOutros = {};
            let totalOutros = 0;
            demais.forEach(tk => {
                Object.entries(porTipo[tk]).forEach(([ano, n]) => { porAnoOutros[ano] = (porAnoOutros[ano] || 0) + n; });
                totalOutros += totalPorTipo[tk];
            });
            series.push({ label: 'Outros', corClasse: CLASSE_COR_OUTROS, porAno: porAnoOutros, total: totalOutros });
        }
        return { series, anoMin, anoMax };
    }

    // Intervalo "bonito" entre marcas do eixo Y (~4 marcas), arredondado pra
    // 1/2/5/10 × uma potência de 10 — evita marcas tipo "0, 3, 6, 9, 12, 15".
    function passoBonito(max) {
        const bruto = Math.max(1, max) / 4;
        const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
        const norm = bruto / mag;
        const passo = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
        return Math.max(1, passo * mag);
    }

    function renderGraficoProducao() {
        const { series, anoMin, anoMax } = serieDeProducao();
        if (!series.length) {
            return `
                <section id="graficoProducaoTipo" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-1 flex items-center gap-2"><i class="fa-solid fa-chart-column text-govbr-600 dark:text-unifesp-400"></i> Produção por tipo</h2>
                    <p class="text-sm text-gray-500 italic py-8 text-center">Nenhum item de produção (bibliográfica, técnica ou artística/cultural) com ano identificável ainda.</p>
                </section>`;
        }
        const anos = [];
        for (let y = anoMin; y <= anoMax; y++) anos.push(y);

        const totalPorAno = anos.map(y => series.reduce((s, sr) => s + (sr.porAno[y] || 0), 0));
        const maxTotal = Math.max(1, ...totalPorAno);
        const passo = passoBonito(maxTotal);
        const yMax = Math.ceil(maxTotal / passo) * passo;
        const ticks = [];
        for (let v = 0; v <= yMax; v += passo) ticks.push(v);

        // Layout: banda fixa por ano (cresce com o nº de anos, com rolagem
        // horizontal — mesmo padrão da grade acima) e barra fina (≤24px, ver
        // dataviz skill), sempre a partir de uma única linha de base.
        const PLOT_H = 200, MARGIN_L = 34, MARGIN_B = 22, MARGIN_T = 6;
        const BAND_W = 42, BAR_W = 22, GAP = 2;
        const svgW = MARGIN_L + anos.length * BAND_W + 8;
        const svgH = MARGIN_T + PLOT_H + MARGIN_B;
        const yFor = (v) => MARGIN_T + PLOT_H - (v / yMax) * PLOT_H;

        const gridHtml = ticks.map(v => {
            const y = yFor(v).toFixed(1);
            return `<line x1="${MARGIN_L}" y1="${y}" x2="${svgW - 4}" y2="${y}" class="stroke-gray-200 dark:stroke-gray-700" stroke-width="1"/>
                    <text x="${MARGIN_L - 6}" y="${y}" text-anchor="end" dominant-baseline="middle" class="fill-gray-500 dark:fill-gray-400" font-size="9">${v}</text>`;
        }).join('');

        // Cada segmento tem uma folga de 2px (o "surface gap" da dataviz
        // skill: separa visualmente as camadas empilhadas sem precisar de
        // contorno) — só o segmento mais ao topo de cada barra (o único com
        // uma ponta livre) ganha o canto arredondado, via 2 retângulos
        // sobrepostos (um arredondado embaixo, um quadrado por cima cobrindo
        // tudo menos os 4px do topo) — o resto fica quadrado, na base.
        const barsHtml = anos.map((y, i) => {
            const x = MARGIN_L + i * BAND_W + (BAND_W - BAR_W) / 2;
            const ativos = series.map(sr => ({ sr, n: sr.porAno[y] || 0 })).filter(d => d.n > 0);
            let acumulado = 0;
            return ativos.map((d, idx) => {
                const baseY = yFor(acumulado);
                const topY = yFor(acumulado + d.n);
                acumulado += d.n;
                const rectY = topY + GAP / 2;
                const h = Math.max(0.5, (baseY - topY) - GAP);
                const titulo = `<title>${esc(d.sr.label)} — ${y}: ${d.n} ite${d.n === 1 ? 'm' : 'ns'}</title>`;
                const isTopo = idx === ativos.length - 1;
                if (isTopo && h > 4) {
                    return `<g>${titulo}
                        <rect x="${x}" y="${rectY.toFixed(1)}" width="${BAR_W}" height="${h.toFixed(1)}" rx="4" ry="4" class="${d.sr.corClasse}"/>
                        <rect x="${x}" y="${(rectY + 4).toFixed(1)}" width="${BAR_W}" height="${(h - 4).toFixed(1)}" class="${d.sr.corClasse}"/>
                    </g>`;
                }
                return `<rect x="${x}" y="${rectY.toFixed(1)}" width="${BAR_W}" height="${h.toFixed(1)}" class="${d.sr.corClasse}">${titulo}</rect>`;
            }).join('');
        }).join('');

        const xLabelsHtml = anos.map((y, i) => {
            const cx = MARGIN_L + i * BAND_W + BAND_W / 2;
            return `<text x="${cx}" y="${MARGIN_T + PLOT_H + 14}" text-anchor="middle" class="fill-gray-500 dark:fill-gray-400" font-size="9">${y}</text>`;
        }).join('');

        const legendHtml = series.map(sr => `
            <span class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <span class="w-2.5 h-2.5 rounded-sm shrink-0 ${sr.corClasse}"></span>
                ${esc(sr.label)} <span class="text-gray-500 dark:text-gray-400">(${sr.total})</span>
            </span>`).join('');

        // Alternativa acessível/tabular aos dados do gráfico — tipo × ano,
        // recolhida por padrão (mesmo padrão de <details> usado em Itens).
        const tabelaHtml = `
            <details class="mt-3 text-xs">
                <summary class="cursor-pointer select-none text-gray-500 dark:text-gray-400 hover:text-govbr-600 dark:hover:text-unifesp-400">Ver como tabela</summary>
                <div class="overflow-x-auto mt-2">
                    <table class="border-collapse text-xs">
                        <thead><tr>
                            <th class="text-left pr-3 pb-1 font-semibold">Tipo</th>
                            ${anos.map(y => `<th class="px-2 pb-1 font-normal text-gray-500 dark:text-gray-400 text-right">${y}</th>`).join('')}
                            <th class="px-2 pb-1 font-semibold text-right">Total</th>
                        </tr></thead>
                        <tbody>${series.map(sr => `
                            <tr class="border-t border-gray-200 dark:border-gray-700">
                                <td class="pr-3 py-1 whitespace-nowrap"><span class="inline-block w-2 h-2 rounded-sm mr-1 ${sr.corClasse}"></span>${esc(sr.label)}</td>
                                ${anos.map(y => `<td class="px-2 py-1 text-right tabular-nums">${sr.porAno[y] || '—'}</td>`).join('')}
                                <td class="px-2 py-1 text-right font-semibold tabular-nums">${sr.total}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </details>`;

        return `
            <section id="graficoProducaoTipo" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-1 flex items-center gap-2"><i class="fa-solid fa-chart-column text-govbr-600 dark:text-unifesp-400"></i> Produção por tipo</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Quantidade de produção bibliográfica, técnica e artística/cultural por ano, separada por tipo — passe o mouse sobre um bloco para ver o total exato.</p>
                <div class="overflow-x-auto">
                    <svg viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" role="img" aria-label="Produção por tipo e ano">
                        ${gridHtml}
                        ${barsHtml}
                        ${xLabelsHtml}
                    </svg>
                </div>
                <div class="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">${legendHtml}</div>
                ${tabelaHtml}
            </section>`;
    }

    /* ------------------------------ Rede de colaboração (rede egocêntrica) ------------------------------ */
    // issue #135 — o "Ego" é quem usa o lattesZen (Identificação); os
    // "Alteri" são os nomes distintos no campo de autores EM LISTA
    // (autoresLista: nomeCompleto/nomeCitacao) — presente em Produção
    // bibliográfica/técnica/artística, Eventos e Patentes/Registros/Cultivar
    // (mesmo campo por baixo, só o rótulo muda: "Autores"/"Inventores"/
    // "Melhoristas"). Como todo item do catálogo já é do próprio Ego, um
    // nome não precisa aparecer JUNTO com o do Ego na lista pra contar como
    // colaborador — só precisa não SER o Ego (evita o Ego virar seu próprio nó).
    //
    // 3 layouts alternativos (ver comentário original da issue), escolhidos
    // por <select> — o cálculo do grafo (nós + peso das arestas) é o mesmo
    // pros 3, só a POSIÇÃO de cada nó muda:
    //   - "concentrico": Ego no centro; Alteri em anéis concêntricos — quanto
    //     mais itens em comum, mais perto do centro.
    //   - "forcas": simulação de forças (Fruchterman-Reingold) com o Ego
    //     ancorado no centro — colaboradores que também colaboraram ENTRE si
    //     se agrupam naturalmente (arestas Alter–Alter).
    //   - "arvore": adapta a ideia de hierarquia do comentário original da
    //     issue (orientador → orientados → colegas) ao que o catálogo
    //     realmente tem: não existe dado de coautoria de 2º grau (só
    //     sabemos quem colaborou com o Ego, não a rede de cada colaborador
    //     fora daqui) — então agrupa cada colaborador pelo TIPO de produção
    //     em que vocês mais colaboraram juntos.
    const MAX_ALTERI_EXIBIDOS = 40;
    // Mesmo ângulo áureo (~137,5°) já usado em posicionarNuvem() acima, pra
    // espalhar pontos ao redor de um centro sem sobreposição sistemática.
    const ANGULO_AUREO = 2.4;
    const REDE_SVG = 420;
    const REDE_CX = REDE_SVG / 2, REDE_CY = REDE_SVG / 2;
    const REDE_R_MAX = 175, REDE_R_MIN = 45;
    const REDE_NODE_R_EGO = 11, REDE_NODE_R_ALTER = 6;

    function normalizarNomeAutor(s) {
        return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    // Nomes conhecidos do Ego (nome civil + variações de citação
    // bibliográfica, ver Configurações → Identificação) — qualquer entrada
    // da lista de autores que bater com um desses (normalizado) é excluída
    // (não vira um Alter, nem conta como colaborador de si mesmo).
    function nomesConhecidosDoEgo() {
        const ident = state.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo);
        if (!ident) return new Set();
        const variacoes = (ident.fields.citacoes || []).map(c => c && c.nome);
        return new Set([ident.fields.titulo, ...variacoes].filter(Boolean).map(normalizarNomeAutor));
    }

    // Monta o grafo bruto a partir do catálogo inteiro (antes do corte de
    // MAX_ALTERI_EXIBIDOS): alteri = Map(chave normalizada -> { nome de
    // exibição, itens em comum com o Ego, porTipo: Map(typeKey -> qtd) });
    // paresAlterAlter = Map("chaveA|chaveB" ordenadas -> qtd de itens em que
    // os dois aparecem juntos, sem o Ego).
    function montarRedeColaboracao() {
        const egoNomes = nomesConhecidosDoEgo();
        const alteri = new Map();
        const paresAlterAlter = new Map();

        state.items.forEach(it => {
            const lista = it.fields && it.fields.autoresLista;
            if (!Array.isArray(lista) || !lista.length) return;
            const vistos = new Map(); // chave normalizada -> nome de exibição, só deste item
            lista.forEach(a => {
                const nome = a && a.nomeCompleto ? String(a.nomeCompleto).trim() : '';
                if (!nome) return;
                const chave = normalizarNomeAutor(nome);
                if (!chave || egoNomes.has(chave)) return;
                if (!vistos.has(chave)) vistos.set(chave, nome);
            });
            const chaves = Array.from(vistos.keys());
            chaves.forEach(chave => {
                let no = alteri.get(chave);
                if (!no) { no = { nome: vistos.get(chave), itens: 0, porTipo: new Map() }; alteri.set(chave, no); }
                no.itens += 1;
                no.porTipo.set(it.typeKey, (no.porTipo.get(it.typeKey) || 0) + 1);
            });
            for (let i = 0; i < chaves.length; i++) {
                for (let j = i + 1; j < chaves.length; j++) {
                    const par = [chaves[i], chaves[j]].sort().join('|');
                    paresAlterAlter.set(par, (paresAlterAlter.get(par) || 0) + 1);
                }
            }
        });
        return { alteri, paresAlterAlter };
    }

    // Densidade da vizinhança (métrica-chave citada na issue #135): das
    // conexões POSSÍVEIS entre os Alteri (pares distintos), quantas de fato
    // existem (compartilham ao menos 1 item com o Ego)? Densidade alta =
    // grupo de pesquisa coeso (quase todos trabalham com todos); densidade
    // baixa = colaborações isoladas entre si.
    function densidadeVizinhanca(numAlteri, paresAlterAlter) {
        if (numAlteri < 2) return null;
        const maxPares = numAlteri * (numAlteri - 1) / 2;
        return paresAlterAlter.size / maxPares;
    }

    // Layout 1: Ego no centro; Alteri em anéis concêntricos — quanto mais
    // itens em comum, mais perto do centro (ângulo áureo evita sobreposição).
    function posicoesConcentrico(alteriOrd) {
        const pesos = alteriOrd.map(a => a.itens);
        const min = Math.min(...pesos), max = Math.max(...pesos);
        const pos = new Map();
        alteriOrd.forEach((a, i) => {
            const norm = max === min ? 1 : (a.itens - min) / (max - min);
            const r = REDE_R_MAX - norm * (REDE_R_MAX - REDE_R_MIN);
            const ang = i * ANGULO_AUREO;
            pos.set(a.chave, { x: REDE_CX + r * Math.cos(ang), y: REDE_CY + r * Math.sin(ang) });
        });
        return pos;
    }

    // Layout 2: Fruchterman-Reingold clássico (repulsão entre todos os nós +
    // atração ao longo das arestas, com "resfriamento" gradual pra
    // convergir) — o Ego fica ANCORADO no centro (nunca entra no cálculo de
    // atração/repulsão como nó móvel, só como ponto fixo de referência).
    // Determinístico (posição inicial e nº de iterações fixos, sem
    // Math.random() — mesmo princípio de posicionarNuvem() acima):
    // colaboradores que também colaboraram ENTRE si (arestas Alter–Alter)
    // se agrupam naturalmente.
    function posicoesForcaAncorada(alteriOrd, paresAlterAlter) {
        const n = alteriOrd.length;
        const pos = new Map();
        if (!n) return pos;
        const idx = new Map(alteriOrd.map((a, i) => [a.chave, i]));
        const px = alteriOrd.map((_, i) => REDE_CX + (REDE_R_MAX * 0.55) * Math.cos(i * ANGULO_AUREO));
        const py = alteriOrd.map((_, i) => REDE_CY + (REDE_R_MAX * 0.55) * Math.sin(i * ANGULO_AUREO));
        const pesoMax = Math.max(1, ...alteriOrd.map(a => a.itens));
        const K = Math.sqrt((REDE_R_MAX * REDE_R_MAX) / n);
        const ITERACOES = 120;
        const DESLOC_MAX = REDE_R_MAX / 10;

        for (let iter = 0; iter < ITERACOES; iter++) {
            const temperatura = DESLOC_MAX * (1 - iter / ITERACOES);
            const fx = new Array(n).fill(0), fy = new Array(n).fill(0);

            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    let dx = px[i] - px[j], dy = py[i] - py[j];
                    const dist = Math.hypot(dx, dy) || 0.01;
                    const rep = (K * K) / dist;
                    dx /= dist; dy /= dist;
                    fx[i] += dx * rep; fy[i] += dy * rep;
                    fx[j] -= dx * rep; fy[j] -= dy * rep;
                }
                // Repulsão do Ego (fixo no centro) — evita nós colados nele.
                const dxE = px[i] - REDE_CX, dyE = py[i] - REDE_CY;
                const distE = Math.hypot(dxE, dyE) || 0.01;
                const repE = (K * K) / distE;
                fx[i] += (dxE / distE) * repE; fy[i] += (dyE / distE) * repE;
            }
            // Mola Alter–Alter: aproxima quem colaborou entre si.
            paresAlterAlter.forEach((peso, par) => {
                const [ca, cb] = par.split('|');
                const i = idx.get(ca), j = idx.get(cb);
                if (i == null || j == null) return;
                let dx = px[i] - px[j], dy = py[i] - py[j];
                const dist = Math.hypot(dx, dy) || 0.01;
                const atr = ((dist * dist) / K) * Math.min(2, peso);
                dx /= dist; dy /= dist;
                fx[i] -= dx * atr; fy[i] -= dy * atr;
                fx[j] += dx * atr; fy[j] += dy * atr;
            });
            // Mola Ego–Alter: mais itens em comum = distância de repouso menor.
            alteriOrd.forEach((a, i) => {
                const dx = px[i] - REDE_CX, dy = py[i] - REDE_CY;
                const dist = Math.hypot(dx, dy) || 0.01;
                const repouso = K * (1.6 - Math.min(1, a.itens / pesoMax));
                const atr = ((dist - repouso) / K) * 3;
                fx[i] -= (dx / dist) * atr; fy[i] -= (dy / dist) * atr;
            });

            for (let i = 0; i < n; i++) {
                const flen = Math.hypot(fx[i], fy[i]) || 0.01;
                const desloc = Math.min(flen, temperatura);
                px[i] += (fx[i] / flen) * desloc;
                py[i] += (fy[i] / flen) * desloc;
                const dxC = px[i] - REDE_CX, dyC = py[i] - REDE_CY;
                const distC = Math.hypot(dxC, dyC);
                if (distC > REDE_R_MAX) { px[i] = REDE_CX + (dxC / distC) * REDE_R_MAX; py[i] = REDE_CY + (dyC / distC) * REDE_R_MAX; }
            }
        }
        alteriOrd.forEach((a, i) => pos.set(a.chave, { x: px[i], y: py[i] }));
        return pos;
    }

    // Layout 3: árvore radial — Ego no centro, um "ramo" por tipo de
    // produção (largura angular proporcional ao nº de colaboradores daquele
    // ramo), cada colaborador como folha do ramo em que MAIS colaborou com
    // o Ego (aparece numa só folha, mesmo colaborando em mais de um tipo).
    function posicoesArvoreRadial(alteriOrd) {
        const grupos = new Map(); // typeKey -> [alter,...]
        alteriOrd.forEach(a => {
            let melhorTipo = null, melhorQtd = -1;
            a.porTipo.forEach((qtd, tk) => { if (qtd > melhorQtd) { melhorQtd = qtd; melhorTipo = tk; } });
            if (!grupos.has(melhorTipo)) grupos.set(melhorTipo, []);
            grupos.get(melhorTipo).push(a);
        });
        const tipos = Array.from(grupos.keys()).sort((a, b) => grupos.get(b).length - grupos.get(a).length);
        const total = alteriOrd.length;
        const R_RAMO = REDE_R_MAX * 0.42, R_FOLHA = REDE_R_MAX;
        const posAlteri = new Map();
        const ramos = [];
        let anguloAcumulado = 0;
        tipos.forEach(tk => {
            const membros = grupos.get(tk);
            const larguraAngular = (membros.length / total) * Math.PI * 2;
            const anguloRamo = anguloAcumulado + larguraAngular / 2;
            ramos.push({
                tipo: tk, label: LattesTypes.label(tk) || tk,
                x: REDE_CX + R_RAMO * Math.cos(anguloRamo), y: REDE_CY + R_RAMO * Math.sin(anguloRamo),
            });
            membros.forEach((a, i) => {
                const anguloFolha = anguloAcumulado + ((i + 0.5) / membros.length) * larguraAngular;
                posAlteri.set(a.chave, { x: REDE_CX + R_FOLHA * Math.cos(anguloFolha), y: REDE_CY + R_FOLHA * Math.sin(anguloFolha), ramoTipo: tk });
            });
            anguloAcumulado += larguraAngular;
        });
        return { posAlteri, ramos };
    }

    // Layout ativo (preferência de exibição, não persiste entre sessões —
    // mesmo padrão de dirWizardModo/dirWizardTipo em tab-config.js).
    let redeColabLayout = 'concentrico';

    function renderRedeColaboracao() {
        const { alteri, paresAlterAlter } = montarRedeColaboracao();
        const seletorHtml = `
            <label for="redeColabLayoutSelect" class="text-xs font-semibold text-gray-600 dark:text-gray-300 mr-2">Layout</label>
            <select id="redeColabLayoutSelect" class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                <option value="concentrico" ${redeColabLayout === 'concentrico' ? 'selected' : ''}>Radial concêntrico</option>
                <option value="forcas" ${redeColabLayout === 'forcas' ? 'selected' : ''}>Forças (ancorado no Ego)</option>
                <option value="arvore" ${redeColabLayout === 'arvore' ? 'selected' : ''}>Árvore radial (por tipo de produção)</option>
            </select>`;

        if (!alteri.size) {
            return `
                <section id="redeColaboracao" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-1 flex items-center gap-2"><i class="fa-solid fa-diagram-project text-govbr-600 dark:text-unifesp-400"></i> Rede de colaboração</h2>
                    <p class="text-sm text-gray-500 italic py-8 text-center">Nenhuma coautoria encontrada ainda — preencha o campo "Autores" (lista) nos itens de produção, eventos ou patentes/registros com mais de uma pessoa.</p>
                </section>`;
        }

        const todosOrdenados = Array.from(alteri.entries()).map(([chave, a]) => ({ chave, ...a })).sort((a, b) => b.itens - a.itens);
        const alteriOrd = todosOrdenados.slice(0, MAX_ALTERI_EXIBIDOS);
        const ocultos = todosOrdenados.length - alteriOrd.length;
        const chavesExibidas = new Set(alteriOrd.map(a => a.chave));
        const paresExibidos = new Map(Array.from(paresAlterAlter.entries()).filter(([par]) => {
            const [ca, cb] = par.split('|');
            return chavesExibidas.has(ca) && chavesExibidas.has(cb);
        }));

        let posAlteri, ramos = [];
        if (redeColabLayout === 'forcas') posAlteri = posicoesForcaAncorada(alteriOrd, paresExibidos);
        else if (redeColabLayout === 'arvore') { const r = posicoesArvoreRadial(alteriOrd); posAlteri = r.posAlteri; ramos = r.ramos; }
        else posAlteri = posicoesConcentrico(alteriOrd);

        const pesoMax = Math.max(1, ...alteriOrd.map(a => a.itens));
        // Arestas Alter–Alter primeiro (mais discretas, ficam "atrás").
        const arestasAlterAlterHtml = Array.from(paresExibidos.entries()).map(([par, peso]) => {
            const [ca, cb] = par.split('|');
            const pa = posAlteri.get(ca), pb = posAlteri.get(cb);
            if (!pa || !pb) return '';
            return `<line x1="${pa.x.toFixed(1)}" y1="${pa.y.toFixed(1)}" x2="${pb.x.toFixed(1)}" y2="${pb.y.toFixed(1)}" class="viz-net-edge-alt" stroke-width="${Math.min(2, 0.6 + peso * 0.3).toFixed(1)}" stroke-opacity="0.45"/>`;
        }).join('');
        // Árvore radial: Ego→ramo e ramo→cada folha, em vez de Ego→folha direto.
        const arestasEgoHtml = redeColabLayout === 'arvore'
            ? ramos.map(r => `<line x1="${REDE_CX}" y1="${REDE_CY}" x2="${r.x.toFixed(1)}" y2="${r.y.toFixed(1)}" class="viz-net-edge" stroke-width="1.5" stroke-opacity="0.5"/>`).join('')
            + alteriOrd.map(a => {
                const p = posAlteri.get(a.chave);
                const ramo = ramos.find(r => r.tipo === p.ramoTipo);
                if (!ramo) return '';
                return `<line x1="${ramo.x.toFixed(1)}" y1="${ramo.y.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" class="viz-net-edge" stroke-width="${Math.min(2.5, 0.8 + (a.itens / pesoMax) * 2).toFixed(1)}" stroke-opacity="0.55"/>`;
            }).join('')
            : alteriOrd.map(a => {
                const p = posAlteri.get(a.chave);
                return `<line x1="${REDE_CX}" y1="${REDE_CY}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" class="viz-net-edge" stroke-width="${Math.min(2.5, 0.8 + (a.itens / pesoMax) * 2).toFixed(1)}" stroke-opacity="0.55"/>`;
            }).join('');

        const ramosHtml = ramos.map(r => `
            <circle cx="${r.x.toFixed(1)}" cy="${r.y.toFixed(1)}" r="3.5" class="viz-net-edge" fill-opacity="0.7"><title>${esc(r.label)}</title></circle>`).join('');

        // Rótulo de texto só nos top 10 (mais colaborações) — os demais têm
        // tooltip (title) + a linha correspondente na tabela acessível.
        const TOP_ROTULADOS = 10;
        const chavesComRotulo = new Set(alteriOrd.slice(0, TOP_ROTULADOS).map(a => a.chave));
        const nosHtml = alteriOrd.map(a => {
            const p = posAlteri.get(a.chave);
            const raio = REDE_NODE_R_ALTER + Math.min(4, a.itens - 1);
            const rotulo = chavesComRotulo.has(a.chave)
                ? `<text x="${p.x.toFixed(1)}" y="${(p.y - raio - 3).toFixed(1)}" text-anchor="middle" class="fill-gray-600 dark:fill-gray-300" font-size="9">${esc(a.nome.length > 22 ? a.nome.slice(0, 21) + '…' : a.nome)}</text>`
                : '';
            return `<g>
                <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${raio}" class="viz-net-alter"><title>${esc(a.nome)} — ${a.itens} ite${a.itens === 1 ? 'm' : 'ns'} em comum</title></circle>
                ${rotulo}
            </g>`;
        }).join('');

        const egoNome = (() => {
            const ident = state.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo);
            return ident ? String(ident.fields.titulo).trim() : 'Você (Ego)';
        })();

        const densidade = densidadeVizinhanca(todosOrdenados.length, paresAlterAlter);
        const densidadeHtml = densidade == null
            ? ''
            : `<p class="text-xs text-gray-500 dark:text-gray-400 mt-2"><i class="fa-solid fa-circle-nodes mr-1"></i> Densidade da vizinhança: <strong class="tabular-nums">${(densidade * 100).toFixed(0)}%</strong> das conexões possíveis entre seus colaboradores — quanto maior, mais coeso o grupo (colaboradores que também colaboram entre si).</p>`;

        const tabelaHtml = `
            <details class="mt-3 text-xs">
                <summary class="cursor-pointer select-none text-gray-500 dark:text-gray-400 hover:text-govbr-600 dark:hover:text-unifesp-400">Ver como tabela</summary>
                <div class="overflow-x-auto mt-2">
                    <table class="border-collapse text-xs">
                        <thead><tr><th class="text-left pr-3 pb-1 font-semibold">Colaborador</th><th class="px-2 pb-1 font-semibold text-right">Itens em comum</th></tr></thead>
                        <tbody>${todosOrdenados.map(a => `
                            <tr class="border-t border-gray-200 dark:border-gray-700">
                                <td class="pr-3 py-1 whitespace-nowrap">${esc(a.nome)}</td>
                                <td class="px-2 py-1 text-right tabular-nums">${a.itens}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </details>`;

        return `
            <section id="redeColaboracao" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <h2 class="text-lg font-bold flex items-center gap-2"><i class="fa-solid fa-diagram-project text-govbr-600 dark:text-unifesp-400"></i> Rede de colaboração</h2>
                    <div>${seletorHtml}</div>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Rede egocêntrica de coautoria: você (Ego) no centro e seus colaboradores (Alteri) ao redor, a partir do campo "Autores" (lista) dos itens do catálogo.${ocultos > 0 ? ` Mostrando os ${MAX_ALTERI_EXIBIDOS} colaboradores com mais itens em comum — ${ocultos} com menos colaborações não exibido${ocultos === 1 ? '' : 's'} no desenho (continuam na tabela abaixo).` : ''}</p>
                <div class="overflow-x-auto flex justify-center">
                    <svg viewBox="0 0 ${REDE_SVG} ${REDE_SVG}" width="${REDE_SVG}" height="${REDE_SVG}" role="img" aria-label="Rede de colaboração e coautoria">
                        ${arestasAlterAlterHtml}
                        ${arestasEgoHtml}
                        ${ramosHtml}
                        <circle cx="${REDE_CX}" cy="${REDE_CY}" r="${REDE_NODE_R_EGO}" class="viz-net-ego"><title>${esc(egoNome)} (Ego)</title></circle>
                        ${nosHtml}
                    </svg>
                </div>
                ${densidadeHtml}
                ${tabelaHtml}
            </section>`;
    }

    function wireRedeColaboracao() {
        const sel = $('#redeColabLayoutSelect');
        if (!sel) return;
        sel.addEventListener('change', () => { redeColabLayout = sel.value; render(); });
    }

    function render() {
        const panel = $('#tab-linhatempo');
        panel.innerHTML = `<div class="space-y-4 max-w-full">${renderNuvemPalavras()}${renderGradeLinhaTempo()}${renderGraficoProducao()}${renderRedeColaboracao()}</div>`;
        const area = $('#nuvemPalavrasArea');
        if (area) posicionarNuvem(area);
        wireRedeColaboracao();
    }

    // contarPalavras/contarPorCategoriaEAno também são usadas pela geração da
    // página pública (tab-publicar.js), com a lista de itens já filtrada por
    // privacidade — ver publicarWebOk() em app-core.js.
    return {
        render, contarPalavras, contarPorCategoriaEAno, nivel, NIVEL_CLASSES, contarProducaoPorTipoEAno, serieDeProducao,
        montarRedeColaboracao, densidadeVizinhanca,
    };
})();
