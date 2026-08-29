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

    // Categorias que existem só para edição em Configurações/Perfil (não são
    // "produção" — identificação, endereço, foto de perfil etc.) e por isso
    // não entram nem na nuvem de palavras, nem na grade.
    const CATEGORIAS_EXCLUIDAS = new Set(['PERFIL_FOTOS', 'DADOS_GERAIS']);

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

    // Conta a frequência de cada palavra nos títulos, palavras-chave (campo
    // "palavrasChave", separado por ";") e área de conhecimento dos itens —
    // devolve os N mais frequentes, do maior para o menor.
    function contarPalavras(limite) {
        const freq = {};
        state.items.forEach(it => {
            if (!it.categoryKey || CATEGORIAS_EXCLUIDAS.has(it.categoryKey)) return;
            const f = it.fields || {};
            const textos = [f.titulo, f.areaConhecimento, ...String(f.palavrasChave || '').split(';')];
            textos.forEach(t => extrairPalavras(t).forEach(w => { freq[w] = (freq[w] || 0) + 1; }));
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
                return `<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">${palavras.map(([w, n]) => `<span class="text-govbr-700 dark:text-unifesp-400 font-semibold leading-none" style="font-size:${tamanho(n)}rem" data-palavra="${esc(w)}" data-freq="${n}" title="${esc(w)}: ${n} ocorrência${n === 1 ? '' : 's'}">${esc(w)}</span>`).join('')}</div>`;
            })()
            : `<p class="text-sm text-gray-500 italic">Nenhuma palavra encontrada ainda — preencha título, palavras-chave ou área de conhecimento nos itens.</p>`;

        return `
            <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-1 flex items-center gap-2"><i class="fa-solid fa-cloud text-govbr-600 dark:text-unifesp-400"></i> Nuvem de palavras</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Termos mais frequentes nos títulos, palavras-chave e área de conhecimento dos seus itens — quanto maior a palavra, mais vezes ela aparece. Passe o mouse para ver o total exato.</p>
                ${corpo}
            </section>`;
    }

    /* ------------------------------ Linha do tempo (grade) ------------------------------ */

    // Níveis de intensidade (0-4, estilo GitHub) proporcionais ao maior valor
    // encontrado em toda a grade — a mesma escala vale para todas as linhas,
    // então dá pra comparar visualmente duas categorias diferentes.
    const NIVEL_CLASSES = [
        'bg-gray-100 dark:bg-gray-800',
        'bg-govbr-100 dark:bg-unifesp-950',
        'bg-govbr-300 dark:bg-unifesp-800',
        'bg-govbr-500 dark:bg-unifesp-700',
        'bg-govbr-700 dark:bg-unifesp-400',
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
    function contarPorCategoriaEAno() {
        const porCategoria = {};
        let anoMin = null;
        const anoAtual = new Date().getFullYear();
        let anoMax = anoAtual;
        state.items.forEach(it => {
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

                const headCells = anos.map(y => `<th class="px-0.5 pb-1 text-[10px] font-normal text-gray-500 dark:text-gray-400 text-center whitespace-nowrap">${y}</th>`).join('');
                const linhas = catKeys.map(k => {
                    const label = LattesTypes.categoryLabel(k);
                    const cells = anos.map(y => {
                        const n = porCategoria[k][y] || 0;
                        const cls = NIVEL_CLASSES[nivel(n, max)];
                        const titulo = `${label} — ${y}: ${n} ite${n === 1 ? 'm' : 'ns'}`;
                        return `<td class="p-0.5"><div class="w-[11px] h-[11px] rounded-sm ${cls}" data-ano="${y}" data-qtd="${n}" title="${esc(titulo)}"></div></td>`;
                    }).join('');
                    return `<tr><th class="pr-3 py-0.5 text-xs font-medium text-left whitespace-nowrap sticky left-0 bg-white dark:bg-gray-900">${esc(label)}</th>${cells}</tr>`;
                }).join('');

                return `
                    <div class="overflow-x-auto">
                        <table class="border-separate" style="border-spacing:2px">
                            <thead><tr><th></th>${headCells}</tr></thead>
                            <tbody>${linhas}</tbody>
                        </table>
                    </div>
                    <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-3">
                        <span>Menos</span>
                        ${NIVEL_CLASSES.map(cls => `<div class="w-2 h-2 rounded-sm ${cls}"></div>`).join('')}
                        <span>Mais</span>
                    </div>`;
            })()
            : `<p class="text-sm text-gray-500 italic py-8 text-center">Nenhum item com ano identificável ainda. Cadastre itens em <strong>Catalogar</strong> (ou importe o XML do Lattes) para ver a linha do tempo.</p>`;

        return `
            <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-1 flex items-center gap-2"><i class="fa-solid fa-table-cells text-govbr-600 dark:text-unifesp-400"></i> Linha do tempo</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Quantidade de itens por categoria e ano — quanto mais escuro o quadradinho, mais itens naquele ano. Passe o mouse sobre um quadradinho para ver o total exato.</p>
                ${corpo}
            </section>`;
    }

    function render() {
        const panel = $('#tab-linhatempo');
        panel.innerHTML = `<div class="space-y-4 max-w-full">${renderNuvemPalavras()}${renderGradeLinhaTempo()}</div>`;
    }

    return { render };
})();
