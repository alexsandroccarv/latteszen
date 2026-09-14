/* ==========================================================================
   lattesZen — Importar/Exportar BibTeX/RIS — seção dentro de Configurações
   --------------------------------------------------------------------------
   Extraído de tab-config.js (issue de refatoração). Nenhuma mudança de
   conteúdo, só saiu do arquivo único original.
   ========================================================================== */
import { dadosItemHtml, fileStamp } from './tab-config-shared.js';
import { itemSignature, existingSignatureMap } from './tab-config-dedup.js';

const { state, $, $$, esc, toast } = window.AppCore;


    /* =====================================================================
       IMPORTAR PUBLICAÇÕES DE BIBTEX/RIS — seção dentro de Configurações
       (issue #6)
       ---------------------------------------------------------------------
       Faz o parse local do arquivo (window.LzBibRis, sem rede) e reaproveita
       a mesma tela de revisão/seleção e a mesma deduplicação por assinatura
       de conteúdo já usadas no import de XML/ORCID.
       ===================================================================== */
    export function bibImportItemHtml() {
        return dadosItemHtml('fa-solid fa-file-lines', 'BibTeX/RIS (.bib)',
            'Traga referências exportadas de outra ferramenta (Zotero, Mendeley, EndNote, Google Scholar) — selecione um arquivo .bib (BibTeX) ou .ris (RIS).', `
                <input type="file" id="bibInput" accept=".bib,.ris,text/plain,application/x-bibtex"
                       class="text-sm file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-govbr-600 dark:file:bg-unifesp-700 file:text-white">
                <div id="bibResult" class="mt-3"></div>`);
    }
    export function bibExportItemHtml() {
        return dadosItemHtml('fa-solid fa-file-lines', 'BibTeX/RIS',
            'Gera um arquivo com as publicações já catalogadas (artigos, livros, capítulos, trabalhos em anais de evento e relatórios de pesquisa) — para usar em outra ferramenta de referências.', `
                <div class="flex flex-wrap gap-2">
                    <button id="btnBibExportBib" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-download mr-1"></i> Baixar .bib (BibTeX)</button>
                    <button id="btnBibExportRis" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-download mr-1"></i> Baixar .ris (RIS)</button>
                </div>
                <p id="bibExportStatus" class="text-xs text-gray-500 mt-2"></p>`);
    }


    // Tipo de entrada BibTeX (minúsculo, ex.: 'article') ou código RIS
    // (maiúsculo, ex.: 'JOUR') → tipo do lattesZen. Sem entrada aqui = fica na
    // lista de "ignorados" (issue #6 pede para NÃO adivinhar a categoria).
    const BIB_RIS_TYPE_MAP = {
        article: 'ARTIGO_PERIODICO',
        inproceedings: 'TRABALHO_EVENTO', conference: 'TRABALHO_EVENTO',
        incollection: 'CAPITULOS_LIVRO', inbook: 'CAPITULOS_LIVRO',
        book: 'LIVROS',
        techreport: 'RELATORIO_PESQUISA', unpublished: 'RELATORIO_PESQUISA',
        JOUR: 'ARTIGO_PERIODICO',
        CONF: 'TRABALHO_EVENTO', CPAPER: 'TRABALHO_EVENTO',
        CHAP: 'CAPITULOS_LIVRO',
        BOOK: 'LIVROS',
        RPRT: 'RELATORIO_PESQUISA',
    };
    // Converte uma entrada normalizada (window.LzBibRis) num item do lattesZen,
    // preenchendo só os campos que o tipo mapeado realmente tem. Retorna null
    // quando o tipo original não tem mapeamento — a entrada vai para a lista
    // de ignorados em vez de cair num "catch-all" adivinhado.
    function bibEntryToItem(entrada) {
        const typeKey = BIB_RIS_TYPE_MAP[entrada.tipoOriginal];
        if (!typeKey) return null;
        const def = LattesTypes.getType(typeKey);
        const temCampo = (k) => def && def.fields.some((f) => f.key === k);
        const fields = {};
        if (entrada.titulo && temCampo('titulo')) fields.titulo = entrada.titulo;
        if (entrada.ano && temCampo('ano')) fields.ano = entrada.ano;
        if (entrada.doi && temCampo('doi')) fields.doi = entrada.doi;
        if (entrada.url && temCampo('url')) fields.url = entrada.url;
        if (entrada.periodico && temCampo('periodico')) fields.periodico = entrada.periodico;
        if (entrada.issn && temCampo('issn')) fields.issn = entrada.issn;
        if (entrada.isbn && temCampo('isbn')) fields.isbn = entrada.isbn;
        if (entrada.editora && temCampo('editora')) fields.editora = entrada.editora;
        if (entrada.volume) {
            if (temCampo('volume')) fields.volume = entrada.volume;
            else if (temCampo('numeroVolumes')) fields.numeroVolumes = entrada.volume;
        }
        if (entrada.fasciculo && temCampo('fasciculo')) fields.fasciculo = entrada.fasciculo;
        if (entrada.paginaInicial && temCampo('paginaInicial')) fields.paginaInicial = entrada.paginaInicial;
        if (entrada.paginaFinal && temCampo('paginaFinal')) fields.paginaFinal = entrada.paginaFinal;
        if (entrada.autores && entrada.autores.length) {
            if (temCampo('autoresLista')) fields.autoresLista = entrada.autores.map((nome) => ({ nomeCompleto: nome, nomeCitacao: '' }));
            else if (temCampo('autores')) fields.autores = entrada.autores.join('; ');
        }
        return { typeKey, categoryKey: LattesTypes.primaryCategory(typeKey), fields };
    }
    export async function onBibFileSelected(e) {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const { formato, entradas } = window.LzBibRis.parse(text);
        if (formato === 'desconhecido') {
            $('#bibResult').innerHTML = `<p class="text-sm text-red-600 dark:text-red-400">Não foi possível reconhecer o formato do arquivo — confira se é um .bib (BibTeX) ou .ris (RIS) válido.</p>`;
            return;
        }
        const items = [], ignorados = [];
        entradas.forEach((entrada) => {
            const item = bibEntryToItem(entrada);
            if (item) items.push(item); else ignorados.push(entrada);
        });
        state.bibParsed = { items, ignorados, formato };
        renderBibResult(state.bibParsed);
    }
    function renderBibResult(parsed) {
        const { items, ignorados, formato } = parsed;
        const box = $('#bibResult');
        const avisoIgnorados = ignorados.length ? `
            <div class="text-sm rounded-md border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 px-3 py-2 mb-3">
                <strong>${ignorados.length} entrada(s) sem tipo correspondente</strong> não entraram na lista abaixo (ex.: teses, dissertações, entradas "misc") — cadastre-as manualmente se quiser incluí-las:
                <ul class="list-disc list-inside mt-1">
                    ${ignorados.slice(0, 20).map((en) => `<li>${esc(en.titulo || '(sem título)')} <span class="text-xs opacity-75">(${esc(en.tipoOriginal)})</span></li>`).join('')}
                    ${ignorados.length > 20 ? `<li>… e mais ${ignorados.length - 20}.</li>` : ''}
                </ul>
            </div>` : '';
        if (!items.length) {
            box.innerHTML = avisoIgnorados || `<p class="text-sm text-gray-500 italic">Nenhuma entrada reconhecida nesse arquivo.</p>`;
            return;
        }
        const sigMap = existingSignatureMap();
        const isDup = (it) => (LattesTypes.isSingleton(it.typeKey) && state.items.some((x) => x.typeKey === it.typeKey)) || sigMap.has(itemSignature(it.typeKey, it.fields || {}));
        const novos = items.filter((it) => !isDup(it)).length;

        box.innerHTML = `
            ${avisoIgnorados}
            <div class="mb-3">
                <p class="text-sm mb-1">${items.length} obra(s) reconhecida(s) (${formato.toUpperCase()}) — <strong class="text-green-700 dark:text-green-400">${novos} novas</strong>, ${items.length - novos} já catalogada(s).</p>
            </div>
            <div class="flex items-center gap-2 mb-2 flex-wrap">
                <button id="btnBibSelNovos" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Selecionar novos</button>
                <button id="btnBibSelAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Todos</button>
                <button id="btnBibSelNone" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Nenhum</button>
                <button id="btnBibImport" class="ml-auto px-4 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold">
                    <i class="fa-solid fa-download mr-1"></i> Importar selecionados
                </button>
            </div>
            <div class="space-y-1 scroll-area max-h-[60vh] overflow-y-auto pr-1">
                ${items.map((it, idx) => {
                    const dup = isDup(it);
                    return `<label class="flex items-start gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm ${dup ? 'opacity-60' : ''}">
                        <input type="checkbox" class="bibchk mt-1" data-idx="${idx}" ${dup ? '' : 'checked'}>
                        <span class="min-w-0">
                            <span class="font-medium">${esc(it.fields.titulo || '(sem título)')}</span>
                            <span class="block text-xs text-gray-500">${esc(LattesTypes.label(it.typeKey))} ${it.fields.ano ? '· ' + esc(it.fields.ano) : ''} ${dup ? '· <em>já catalogado</em>' : ''}</span>
                        </span>
                    </label>`;
                }).join('')}
            </div>`;

        $('#btnBibSelNovos').addEventListener('click', () => $$('.bibchk').forEach((c) => { c.checked = !isDup(items[+c.dataset.idx]); }));
        $('#btnBibSelAll').addEventListener('click', () => $$('.bibchk').forEach((c) => c.checked = true));
        $('#btnBibSelNone').addEventListener('click', () => $$('.bibchk').forEach((c) => c.checked = false));
        $('#btnBibImport').addEventListener('click', importBibSelected);
    }
    async function importBibSelected() {
        const chosen = $$('.bibchk').filter((c) => c.checked).map((c) => parseInt(c.dataset.idx, 10));
        if (!chosen.length) { toast('Nenhum item selecionado.', 'aviso'); return; }
        // Feedback de progresso + botão desabilitado — ver comentário em
        // importSelected() (importação do XML), mesmo padrão.
        const btn = $('#btnBibImport');
        const original = btn ? btn.innerHTML : '';
        if (btn) btn.disabled = true;
        try {
            const { items, formato } = state.bibParsed;
            const sigMap = existingSignatureMap();
            let n = 0, ignorados = 0, feito = 0;
            for (const idx of chosen) {
                const src = items[idx];
                const sig = itemSignature(src.typeKey, src.fields || {});
                if (sig && sigMap.has(sig)) { ignorados++; feito++; if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Importando… (${feito}/${chosen.length})`; continue; } // já existe (mesma assinatura) — não duplica
                const item = {
                    id: window.AppCore.uid(), createdAt: window.AppCore.nowISO(), updatedAt: window.AppCore.nowISO(),
                    lattesItem: true, typeKey: src.typeKey, categoryKey: src.categoryKey,
                    fields: src.fields, source: formato === 'ris' ? 'ris' : 'bibtex', lattesRef: null,
                    hasPdf: false, pdfName: null, evidencias: [],
                };
                await window.AppCore.persistItem(item);
                if (sig) sigMap.set(sig, item);
                n++; feito++;
                if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Importando… (${feito}/${chosen.length})`;
            }
            toast(`${n} item(ns) importado(s)${ignorados ? ` — ${ignorados} já existente(s) ignorado(s)` : ''}.`, 'ok');
            renderBibResult(state.bibParsed);
            window.AppCore.renderItemList();
        } finally {
            if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = original; }
        }
    }

    // Sentido inverso de BIB_RIS_TYPE_MAP — só os tipos que também são
    // reconhecidos na importação entram na exportação (round-trip simétrico).
    const TYPE_TO_BIB_RIS = {
        ARTIGO_PERIODICO: { bibtex: 'article', ris: 'JOUR' },
        TRABALHO_EVENTO: { bibtex: 'inproceedings', ris: 'CONF' },
        CAPITULOS_LIVRO: { bibtex: 'incollection', ris: 'CHAP' },
        LIVROS: { bibtex: 'book', ris: 'BOOK' },
        RELATORIO_PESQUISA: { bibtex: 'techreport', ris: 'RPRT' },
    };
    // Converte um item do lattesZen no registro normalizado que
    // window.LzBibRis.toBibTeX()/toRIS() sabem serializar. Retorna null para
    // tipos fora do mapeamento (não entram na exportação).
    function itemToBibRecord(item) {
        const map = TYPE_TO_BIB_RIS[item.typeKey];
        if (!map) return null;
        const f = item.fields || {};
        let autores = [];
        if (Array.isArray(f.autoresLista)) autores = f.autoresLista.map((a) => a.nomeCompleto).filter(Boolean);
        else if (f.autores) autores = String(f.autores).split(';').map((s) => s.trim()).filter(Boolean);
        return {
            tipoBibtex: map.bibtex, tipoRis: map.ris,
            titulo: f.titulo || '', autores, ano: f.ano || '',
            periodico: f.periodico || (item.typeKey === 'TRABALHO_EVENTO' ? f.anais : '') || '',
            issn: f.issn || '', isbn: f.isbn || '',
            volume: f.volume || f.numeroVolumes || '', fasciculo: f.fasciculo || '',
            paginaInicial: f.paginaInicial || '', paginaFinal: f.paginaFinal || '',
            editora: f.editora || '', doi: f.doi || '', url: f.url || '',
        };
    }
    function bibExportRecords() {
        return state.items.map(itemToBibRecord).filter(Boolean);
    }
    function baixarArquivoTexto(nome, texto) {
        const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; a.click();
        URL.revokeObjectURL(a.href);
    }
    export function wireBibExport() {
        const status = (t) => { const el = $('#bibExportStatus'); if (el) el.textContent = t; };
        const btnBib = $('#btnBibExportBib');
        if (btnBib) btnBib.addEventListener('click', () => {
            const registros = bibExportRecords();
            if (!registros.length) { status('Nenhuma publicação (artigo, livro, capítulo, trabalho em evento ou relatório) catalogada ainda.'); return; }
            baixarArquivoTexto(`publicacoes-${fileStamp()}.bib`, window.LzBibRis.toBibTeX(registros));
            status(`${registros.length} publicação(ões) exportada(s) em BibTeX.`);
        });
        const btnRis = $('#btnBibExportRis');
        if (btnRis) btnRis.addEventListener('click', () => {
            const registros = bibExportRecords();
            if (!registros.length) { status('Nenhuma publicação (artigo, livro, capítulo, trabalho em evento ou relatório) catalogada ainda.'); return; }
            baixarArquivoTexto(`publicacoes-${fileStamp()}.ris`, window.LzBibRis.toRIS(registros));
            status(`${registros.length} publicação(ões) exportada(s) em RIS.`);
        });
    }
