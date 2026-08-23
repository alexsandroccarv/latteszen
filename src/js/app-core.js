/* ==========================================================================
   lattesZen — núcleo compartilhado entre app.js e os módulos de aba
   --------------------------------------------------------------------------
   Ainda embrionário (ver issue de refatoração de app.js): por enquanto só
   expõe o que o primeiro módulo de aba extraído (tab-publicar.js) precisa —
   o `state` (mutável, compartilhado por referência: qualquer alteração feita
   de um lado aparece do outro) e um punhado de utilidades sem estado próprio.
   Conforme mais abas forem extraídas de app.js, mais deve entrar aqui.
   ========================================================================== */
window.AppCore = (function () {
    /* ----------------------------- Estado ------------------------------- */
    const state = {
        items: [],          // catálogo
        trash: [],          // itens excluídos (lixeira), aguardando restauração ou purga
        editingId: null,    // item em edição
        evEditing: [],      // evidências do item em edição (array de trabalho)
        lattesParsed: null, // resultado do parse do XML
        orcidParsed: null,  // resultado da busca de publicações no ORCID
        bibParsed: null,    // resultado do parse de um arquivo BibTeX/RIS
        currentPdfUrl: null,// URL (blob) do PDF exibido no painel lateral
        sortOrder: 'desc',  // ordenação por ano na Conformidade
        viewFilter: 'todos',// recorte da lista (todos/comprovados/semPdf/naoLattes/descObrig)
        formDirty: false,   // há edições não salvas no formulário de Catalogar?
        saveAndNew: false,  // flag do botão "Salvar e novo"
        saveAndNext: false, // flag do botão "Salvar e próximo"
        activeTab: 'inicio',
        lastCat: '', lastType: '', // última categoria/tipo usados (agiliza cadastro em série)
        vocab: {},          // listas curadas de autocomplete (por chave de campo)
        idPrefix: 'lz',     // prefixo do ID dos arquivos (configurável, até 3 chars)
        rscEnabled: false,  // módulo RSC-PCCTAE habilitado?
        rscCfg: {},         // dados funcionais do servidor (cargo, escolaridade, etc.)
        dirHealth: null,    // último resultado de Storage.checkHealth() (null = sem pasta/não verificado)
    };

    /* --------------------------- Utilidades ----------------------------- */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function toast(msg, type = 'info') {
        const colors = {
            info: 'bg-govbr-600 dark:bg-unifesp-700',
            ok: 'bg-green-600', erro: 'bg-red-600', aviso: 'bg-amber-600',
        };
        const el = document.createElement('div');
        el.className = `${colors[type] || colors.info} text-white text-sm px-4 py-2 rounded shadow-lg max-w-xs`;
        el.textContent = msg;
        $('#toasts').appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 3200);
        setTimeout(() => el.remove(), 3700);
    }

    // Extrai o ANO de um campo de data completa (dd/mm/aaaa, mm/aaaa ou aaaa).
    // Usado em toda parte que precisa só do ano (dedup, ordenação, RSC) — o
    // valor guardado pode ter dia/mês, mas eles nunca vão para o XML Lattes.
    function anoDe(v) { const m = String(v == null ? '' : v).match(/\d{4}/); return m ? m[0] : ''; }
    function isImageExt(ext) { return /^(jpe?g|png|gif|webp)$/i.test(ext || ''); }
    function itemYear(i) {
        const y = (i.fields && (i.fields.ano || i.fields.anoFim || i.fields.anoInicio)) || '';
        const n = parseInt(anoDe(y), 10);
        return isNaN(n) ? null : n;
    }
    function sortByYear(items, asc) {
        return items.slice().sort((a, b) => {
            const ya = itemYear(a), yb = itemYear(b);
            if (ya !== yb) {
                if (ya == null) return 1;              // sem ano vai para o fim
                if (yb == null) return -1;
                return asc ? ya - yb : yb - ya;
            }
            return (b.updatedAt || '').localeCompare(a.updatedAt || '');
        });
    }
    // "Publicar na Web" desmarcado no item: item some da página pública,
    // independente das opções de Lattes (Exportar/Visibilidade) — usado tanto
    // pelos filtros da Conformidade quanto pela geração da página pública.
    const publicarWebOk = (it) => !(it.visibilidade && it.visibilidade.publicarWeb === false);

    return { state, $, $$, esc, toast, anoDe, isImageExt, itemYear, sortByYear, publicarWebOk };
})();
