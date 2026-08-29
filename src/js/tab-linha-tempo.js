/* ==========================================================================
   lattesZen — Aba Linha do tempo (mapa de calor categoria × ano)
   --------------------------------------------------------------------------
   Painel estilo "gráfico de contribuições" (GitHub): cada linha é uma
   categoria do Lattes, cada coluna um ano, e a intensidade da cor do
   quadradinho reflete a quantidade de itens daquela categoria naquele ano —
   uma visão rápida de "quando" a produção aconteceu, sem precisar abrir
   Conformidade e ordenar por ano categoria a categoria.

   O "ano" de cada item reaproveita AppCore.itemYear() — o mesmo critério já
   usado para ordenar por ano em Conformidade/Publicar (fields.ano, senão
   anoFim, senão anoInicio) — um único ano por item, mesmo para itens com
   período (ex.: Formação, Atuação), em vez de espalhar o mesmo item por
   todos os anos do intervalo.
   ========================================================================== */
window.TabLinhaTempo = (function () {
    const { state, $, esc, itemYear } = window.AppCore;

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

    function render() {
        const panel = $('#tab-linhatempo');
        const { porCategoria, anoMin, anoMax } = contarPorCategoriaEAno();
        const catKeys = Object.keys(porCategoria).sort((a, b) => {
            const ca = LattesTypes.categoryByKey(a), cb = LattesTypes.categoryByKey(b);
            return String(ca ? ca.num : '99').localeCompare(String(cb ? cb.num : '99'));
        });

        if (!catKeys.length) {
            panel.innerHTML = `<p class="text-sm text-gray-500 italic py-8 text-center">Nenhum item com ano identificável ainda. Cadastre itens em <strong>Catalogar</strong> (ou importe o XML do Lattes) para ver a linha do tempo.</p>`;
            return;
        }

        const anos = [];
        for (let y = anoMin; y <= anoMax; y++) anos.push(y);

        let max = 0;
        catKeys.forEach(k => Object.values(porCategoria[k]).forEach(n => { if (n > max) max = n; }));

        const headCells = anos.map(y => `<th class="px-0.5 pb-1 text-[10px] font-normal text-gray-500 dark:text-gray-400 text-center whitespace-nowrap">${y}</th>`).join('');
        const linhas = catKeys.map(k => {
            const label = LattesTypes.categoryNumLabel(k);
            const cells = anos.map(y => {
                const n = porCategoria[k][y] || 0;
                const cls = NIVEL_CLASSES[nivel(n, max)];
                const titulo = `${label} — ${y}: ${n} ite${n === 1 ? 'm' : 'ns'}`;
                return `<td class="p-0.5"><div class="w-4 h-4 rounded-sm ${cls}" data-ano="${y}" data-qtd="${n}" title="${esc(titulo)}"></div></td>`;
            }).join('');
            return `<tr><th class="pr-3 py-0.5 text-xs font-medium text-left whitespace-nowrap sticky left-0 bg-white dark:bg-gray-900">${esc(label)}</th>${cells}</tr>`;
        }).join('');

        panel.innerHTML = `
            <div class="space-y-4 max-w-full">
                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-1 flex items-center gap-2"><i class="fa-solid fa-table-cells text-govbr-600 dark:text-unifesp-400"></i> Linha do tempo</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Quantidade de itens por categoria e ano — quanto mais escuro o quadradinho, mais itens naquele ano. Passe o mouse sobre um quadradinho para ver o total exato.</p>
                    <div class="overflow-x-auto">
                        <table class="border-separate" style="border-spacing:2px">
                            <thead><tr><th></th>${headCells}</tr></thead>
                            <tbody>${linhas}</tbody>
                        </table>
                    </div>
                    <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-3">
                        <span>Menos</span>
                        ${NIVEL_CLASSES.map(cls => `<div class="w-3 h-3 rounded-sm ${cls}"></div>`).join('')}
                        <span>Mais</span>
                    </div>
                </section>
            </div>`;
    }

    return { render };
})();
