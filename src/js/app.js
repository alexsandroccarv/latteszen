/* ==========================================================================
   lattesZen — Orquestrador principal (SPA)
   ========================================================================== */
(function () {
    'use strict';

    /* ----------------------------- Estado ------------------------------- */
    const state = {
        items: [],          // catálogo
        editingId: null,    // item em edição
        evEditing: [],      // evidências do item em edição (array de trabalho)
        lattesParsed: null, // resultado do parse do XML
        currentPdfUrl: null,// URL (blob) do PDF exibido no painel lateral
        sortOrder: 'desc',  // ordenação por ano na Conformidade
        viewFilter: 'todos',// recorte da lista (todos/comprovados/semPdf/foraLattes/naoLattes)
        vocab: {},          // listas curadas de autocomplete (por chave de campo)
        idPrefix: 'lz',     // prefixo do ID dos arquivos (configurável, até 3 chars)
    };

    /* --------------------------- Utilidades ----------------------------- */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ID do item/arquivo: <prefixo>-<3 alfanuméricos minúsculos>. Prefixo
    // configurável (até 3 chars). Garante unicidade dentro do catálogo.
    function randCode(n) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let r = '';
        if (crypto && crypto.getRandomValues) {
            const a = new Uint8Array(n); crypto.getRandomValues(a);
            for (let i = 0; i < n; i++) r += chars[a[i] % 36];
        } else {
            for (let i = 0; i < n; i++) r += chars[Math.floor(Math.random() * 36)];
        }
        return r;
    }
    function uid() {
        const pref = state.idPrefix || 'lz';
        for (let tentativa = 0; tentativa < 800; tentativa++) {
            const id = `${pref}-${randCode(3)}`;
            if (!state.items.some(i => i.id === id)) return id;
        }
        // Espaço de 3 caracteres praticamente esgotado — estende para 4.
        let id; do { id = `${pref}-${randCode(4)}`; } while (state.items.some(i => i.id === id));
        return id;
    }
    function sanitizePrefix(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 3) || 'lz';
    }
    function nowISO() { return new Date().toISOString(); }

    // Extensão do anexo a partir do tipo MIME / nome do arquivo
    function fileExt(file) {
        const t = (file.type || '').toLowerCase();
        if (t === 'application/pdf') return 'pdf';
        if (t === 'image/png') return 'png';
        if (t === 'image/jpeg') return 'jpg';
        const m = (file.name || '').match(/\.(\w+)$/);
        return m ? m[1].toLowerCase() : 'pdf';
    }
    function isImageExt(ext) { return /^(jpe?g|png|gif|webp)$/i.test(ext || ''); }

    // Validação do arquivo de evidência: vazio, tamanho e tipo permitido.
    // Retorna null se OK ou uma mensagem de erro.
    const MAX_EVID_MB = 20;
    function checkEvidenceFile(file, allowedExts) {
        if (!file) return 'Arquivo inválido.';
        if (file.size === 0) return `"${file.name}" está vazio.`;
        if (file.size > MAX_EVID_MB * 1024 * 1024) {
            return `"${file.name}" tem ${(file.size / 1048576).toFixed(1)} MB — o limite é ${MAX_EVID_MB} MB.`;
        }
        const ext = fileExt(file);
        if (allowedExts && allowedExts.length && !allowedExts.includes(ext)) {
            return `"${file.name}": tipo não permitido (aceitos: ${allowedExts.join(', ')}).`;
        }
        return null;
    }

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

    /* --------------------------- Persistência --------------------------- */
    function saveCatalog() { Storage.saveCatalog(state.items); }
    function saveVocab() {
        const s = Storage.loadSettings();
        s.vocab = state.vocab;
        Storage.saveSettings(s);
    }

    // Grava o item no índice (localStorage) e o JSON no diretório. Os anexos
    // (evidências) são gravados/removidos separadamente em onSubmitForm.
    async function persistItem(item) {
        const idx = state.items.findIndex(i => i.id === item.id);
        if (idx >= 0) state.items[idx] = item; else state.items.push(item);
        saveCatalog();
        if (Storage.hasDirectory()) {
            try { await Storage.writeJson(item.id, item, LattesTypes.categoryFolder(item.categoryKey)); }
            catch (e) { toast('Item salvo no índice, mas falhou ao gravar o JSON: ' + e.message, 'aviso'); }
        }
    }

    // Normaliza a lista de evidências de um item (converte formato legado).
    function evListFromItem(item) {
        if (item && Array.isArray(item.evidencias) && item.evidencias.length) {
            return item.evidencias.map(e => ({
                basename: e.basename, ext: e.ext,
                name: e.name || `${e.basename}.${e.ext}`, publica: !!e.publica, file: null,
            }));
        }
        if (item && item.hasPdf) { // legado: uma única evidência com id do item
            const ext = item.fileExt || 'pdf';
            return [{ basename: item.id, ext, name: item.pdfName || `${item.id}.${ext}`, publica: true, file: null }];
        }
        return [];
    }

    async function deleteItem(id) {
        const item = state.items.find(i => i.id === id);
        state.items = state.items.filter(i => i.id !== id);
        saveCatalog();
        try { await Storage.deleteItemFiles(id, item ? LattesTypes.categoryFolder(item.categoryKey) : null); } catch (_) {}
    }

    /* =====================================================================
       ABA: CATALOGAR
       ===================================================================== */
    function renderCatalogar() {
        const panel = $('#tab-catalogar');
        panel.innerHTML = `
            <div class="grid lg:grid-cols-5 gap-6 items-start">
                <section class="lg:col-span-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-3 flex items-center gap-2">
                        <i aria-hidden="true" class="fa-solid fa-file-circle-plus text-govbr-600 dark:text-unifesp-400"></i>
                        <span id="formTitulo">Novo item</span>
                    </h2>
                    <form id="itemForm" class="space-y-3" novalidate></form>
                </section>
                <section class="lg:col-span-3 lg:sticky lg:top-4">
                    <div class="flex items-center justify-between mb-3">
                        <h2 class="text-lg font-bold flex items-center gap-2">
                            <i aria-hidden="true" class="fa-solid fa-file-lines text-red-600"></i>
                            Visualização do arquivo
                        </h2>
                        <div class="flex gap-1">
                            <button type="button" id="pdfNewTab" title="Abrir em nova aba" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hidden"><i class="fa-solid fa-up-right-from-square"></i></button>
                            <button type="button" id="pdfClose" title="Fechar" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hidden"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    </div>
                    <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 flex items-center justify-center" style="height: 85vh; min-height: 560px">
                        <div id="pdfEmpty" class="h-full flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 p-6">
                            <i class="fa-regular fa-file-lines text-5xl mb-3"></i>
                            <p class="text-sm">O arquivo (PDF ou imagem) aparece aqui ao anexá-lo no formulário<br>ou ao abrir um item com evidência (aba <strong>Conformidade</strong>).</p>
                        </div>
                        <iframe id="pdfFrame" class="w-full h-full hidden" title="Pré-visualização do arquivo"></iframe>
                        <img id="pdfImg" class="max-w-full max-h-full object-contain hidden" alt="Pré-visualização da imagem">
                    </div>
                    <p id="pdfPanelName" class="text-xs text-gray-500 mt-1 truncate"></p>
                </section>
            </div>`;

        buildForm();
        $('#pdfClose').addEventListener('click', clearPdf);
        $('#pdfNewTab').addEventListener('click', () => { if (state.currentPdfUrl) window.open(state.currentPdfUrl, '_blank'); });
    }

    /* =====================================================================
       ABA: CATÁLOGO (lista de itens)
       ===================================================================== */
    // Recortes da lista (cartões de conformidade + filtro da lista)
    const VIEW_META = {
        comprovados:  { cor: 'green', icone: 'fa-circle-check', titulo: 'Comprovados', desc: 'No Lattes e com evidência' },
        semPdf:       { cor: 'red',   icone: 'fa-file-circle-xmark', titulo: 'Sem evidência', desc: 'No Lattes, sem evidência' },
        foraLattes:   { cor: 'blue',  icone: 'fa-clock', titulo: 'Fora do Lattes', desc: 'Cadastrados, ainda não no Lattes' },
        naoLattes:    { cor: 'purple', icone: 'fa-heart', titulo: 'Não-Lattes', desc: 'Itens pessoais' },
        descObrig:    { cor: 'red', icone: 'fa-align-left', titulo: 'Obrigatórios pendentes', desc: 'Falta campo obrigatório' },
    };
    // Tipos que exigem evidência (ex.: Identificação, Texto inicial, Outras
    // informações e Conexões não exigem) — usado nas métricas de conformidade.
    function needsEvidence(item) {
        const def = LattesTypes.get(item.typeKey);
        return !(def && def.noEvidence);
    }
    const VIEW_PREDICATE = {
        todos:          () => true,
        comprovados:    i => i.lattesItem && i.inLattes && needsEvidence(i) && i.hasPdf,
        semPdf:         i => i.lattesItem && i.inLattes && needsEvidence(i) && !i.hasPdf,
        foraLattes:     i => i.lattesItem && !i.inLattes,
        naoLattes:      i => !i.lattesItem,
        descObrig:      i => descState(i) === 'red',
    };

    // Aba única (antigos "Catálogo" + "Relatório/Conformidade"): painel de
    // conformidade (cartões + barra) + lista de itens com filtro/ordenação.
    function renderConformidade() {
        const panel = $('#tab-conformidade');
        const count = k => state.items.filter(VIEW_PREDICATE[k]).length;
        const comprovados = count('comprovados');
        // Denominador da conformidade documental: só itens que EXIGEM evidência
        const total = state.items.filter(i => i.lattesItem && i.inLattes && needsEvidence(i)).length;
        const pct = total ? Math.round(comprovados / total * 100) : 0;
        // Descrição: verde (completo) / amarelo (falta opcional) / vermelho (falta obrigatório)
        const totalDesc = state.items.length;
        const descG = state.items.filter(i => descState(i) === 'green').length;
        const descA = state.items.filter(i => descState(i) === 'amber').length;
        const descR = state.items.filter(i => descState(i) === 'red').length;
        const wDesc = n => totalDesc ? Math.round(n / totalDesc * 100) : 0;
        const pctDesc = wDesc(descG);

        const card = (key) => {
            const m = VIEW_META[key];
            const active = state.viewFilter === key;
            return `<button type="button" data-view="${key}" title="Filtrar: ${m.titulo}"
                class="text-left bg-white dark:bg-gray-800 border rounded-lg p-4 hover:shadow transition ${active ? `border-${m.cor}-500 ring-2 ring-${m.cor}-500/40` : 'border-gray-200 dark:border-gray-700'}">
                <div class="flex items-center gap-2 text-${m.cor}-600 dark:text-${m.cor}-400">
                    <i class="fa-solid ${m.icone} text-xl"></i><span class="text-2xl font-bold">${count(key)}</span>
                </div>
                <p class="text-sm font-semibold mt-1">${m.titulo}</p>
                <p class="text-xs text-gray-500">${m.desc}</p>
            </button>`;
        };

        panel.innerHTML = `
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                ${card('comprovados')}${card('semPdf')}${card('foraLattes')}${card('naoLattes')}${card('descObrig')}
            </div>

            <div class="grid sm:grid-cols-2 gap-x-6 gap-y-3 mb-5">
                <div>
                    <div class="flex justify-between text-sm mb-1"><span class="font-semibold"><i class="fa-solid fa-file-pdf text-gray-400 mr-1"></i>Conformidade documental (evidência)</span><span>${pct}% (${comprovados}/${total})</span></div>
                    <div class="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div class="h-full ${pct === 100 ? 'bg-green-500' : 'bg-red-500'}" style="width:${pct}%"></div>
                    </div>
                </div>
                <div>
                    <div class="flex justify-between text-sm mb-1"><span class="font-semibold"><i class="fa-solid fa-align-left text-gray-400 mr-1"></i>Descrição completa (campos)</span><span>${pctDesc}% (${descG}/${totalDesc})</span></div>
                    <div class="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex" title="Verde: completo · Amarelo: falta opcional · Vermelho: falta obrigatório">
                        <div class="h-full bg-green-500" style="width:${wDesc(descG)}%"></div>
                        <div class="h-full bg-amber-500" style="width:${wDesc(descA)}%"></div>
                        <div class="h-full bg-red-500" style="width:${wDesc(descR)}%"></div>
                    </div>
                    <p class="text-xs text-gray-500 mt-0.5">${descG} completos · ${descA} falta opcional · ${descR} falta obrigatório</p>
                </div>
            </div>

            <div class="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h2 class="text-lg font-bold flex items-center gap-2">
                    <i aria-hidden="true" class="fa-solid fa-list text-govbr-600 dark:text-unifesp-400"></i>
                    Itens <span id="itemCount" class="text-sm font-normal text-gray-500"></span>
                    <span id="viewChip" class="hidden text-xs font-normal"></span>
                </h2>
                <div class="flex items-center gap-2 flex-wrap">
                    <label class="text-xs text-gray-500 flex items-center gap-1">
                        <i aria-hidden="true" class="fa-solid fa-arrow-down-wide-short"></i> Ordenar por ano
                        <select id="sortOrder" class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                            <option value="desc">Decrescente (recente → antigo)</option>
                            <option value="asc">Crescente (antigo → recente)</option>
                        </select>
                    </label>
                    <input id="filterBox" type="search" placeholder="Filtrar..."
                           class="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 w-full sm:w-56">
                </div>
            </div>
            <div class="flex gap-2 mb-3 flex-wrap">
                <button id="btnExpandAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Expandir todas</button>
                <button id="btnCollapseAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Recolher todas</button>
                <button id="btnImprimir" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 ml-auto"><i class="fa-solid fa-print mr-1"></i> Imprimir / PDF</button>
            </div>
            <div id="itemList" class="space-y-3"></div>`;

        $('#sortOrder').value = state.sortOrder || 'desc';
        renderItemList();
        $('#filterBox').addEventListener('input', renderItemList);
        $('#sortOrder').addEventListener('change', (e) => { state.sortOrder = e.target.value; renderItemList(); });
        $('#btnExpandAll').addEventListener('click', () => $$('#itemList details').forEach(d => d.open = true));
        $('#btnCollapseAll').addEventListener('click', () => $$('#itemList details').forEach(d => d.open = false));
        $('#btnImprimir').addEventListener('click', () => window.print());
        $$('[data-view]', panel).forEach(b => b.addEventListener('click', () => {
            const k = b.dataset.view;
            state.viewFilter = (state.viewFilter === k) ? 'todos' : k; // clicar de novo limpa
            renderConformidade();
        }));
    }

    /* =====================================================================
       Painel de visualização do PDF (dentro de "Catalogar")
       ===================================================================== */
    function setPdf(url, name, ext) {
        const frame = $('#pdfFrame'), img = $('#pdfImg');
        if (!frame) return; // painel não montado (outra aba ativa)
        if (state.currentPdfUrl && state.currentPdfUrl !== url) {
            try { URL.revokeObjectURL(state.currentPdfUrl); } catch (_) {}
        }
        state.currentPdfUrl = url;
        if (isImageExt(ext)) {
            img.src = url; img.classList.remove('hidden');
            frame.src = 'about:blank'; frame.classList.add('hidden');
        } else {
            frame.src = url; frame.classList.remove('hidden');
            img.removeAttribute('src'); img.classList.add('hidden');
        }
        $('#pdfEmpty').classList.add('hidden');
        $('#pdfClose').classList.remove('hidden');
        $('#pdfNewTab').classList.remove('hidden');
        $('#pdfPanelName').textContent = name || '';
    }
    function clearPdf() {
        const frame = $('#pdfFrame'), img = $('#pdfImg');
        if (state.currentPdfUrl) { try { URL.revokeObjectURL(state.currentPdfUrl); } catch (_) {} state.currentPdfUrl = null; }
        if (!frame) return;
        frame.src = 'about:blank'; frame.classList.add('hidden');
        if (img) { img.removeAttribute('src'); img.classList.add('hidden'); }
        $('#pdfEmpty').classList.remove('hidden');
        $('#pdfClose').classList.add('hidden');
        $('#pdfNewTab').classList.add('hidden');
        $('#pdfPanelName').textContent = '';
    }
    function previewPdfFile(file) {
        if (!file) return;
        setPdf(URL.createObjectURL(file), file.name, fileExt(file));
    }
    async function showPdfForItem(item) {
        if (!$('#pdfFrame')) return;
        const list = evListFromItem(item);
        if (!list.length) { clearPdf(); return; }
        const ev = list.find(e => e.publica) || list[0];
        try {
            const url = await Storage.readAttachmentUrl(ev.basename, LattesTypes.categoryFolder(item.categoryKey), ev.ext);
            if (url) setPdf(url, ev.name, ev.ext);
            else { clearPdf(); toast('Arquivo não encontrado no diretório (sincronize a pasta).', 'aviso'); }
        } catch (e) { clearPdf(); }
    }

    // Pré-visualiza uma evidência (nova ou já gravada) no painel lateral.
    async function previewEvidence(ev) {
        if (ev.file) { setPdf(URL.createObjectURL(ev.file), ev.name, ev.ext); return; }
        try {
            // Arquivo já gravado: usar a categoria SALVA do item em edição
            // (não o seletor, que pode ter sido alterado sem salvar).
            const it = state.editingId ? state.items.find(i => i.id === state.editingId) : null;
            const catKey = it ? it.categoryKey : ($('#selCategoria') ? $('#selCategoria').value : null);
            const subdir = LattesTypes.categoryFolder(catKey);
            const url = await Storage.readAttachmentUrl(ev.basename, subdir, ev.ext);
            if (url) setPdf(url, ev.name, ev.ext);
            else toast('Arquivo não encontrado no diretório (sincronize a pasta).', 'aviso');
        } catch (e) { toast('Não foi possível abrir a evidência: ' + e.message, 'aviso'); }
    }

    // Renderiza a lista de evidências no formulário (com reordenar / pública / ver / remover).
    function renderEvList() {
        const ul = $('#evList');
        if (!ul) return;
        if (!state.evEditing.length) {
            ul.innerHTML = `<li class="text-xs text-gray-400 dark:text-gray-500 italic">Nenhuma evidência anexada.</li>`;
            return;
        }
        ul.innerHTML = state.evEditing.map((ev, idx) => `
            <li class="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm">
                <i aria-hidden="true" class="fa-solid ${isImageExt(ev.ext) ? 'fa-image' : 'fa-file-pdf'} text-red-600 shrink-0"></i>
                <span class="min-w-0 flex-1 truncate" title="${esc(ev.name)}">${esc(ev.name)}${ev.file ? ' <span class="text-xs text-green-600">(novo)</span>' : ''}</span>
                <label class="flex items-center gap-1 text-xs shrink-0" title="Será exibida no futuro módulo de publicação (apenas uma por item)">
                    <input type="checkbox" data-evpub="${idx}" ${ev.publica ? 'checked' : ''}> pública
                </label>
                <button type="button" data-evup="${idx}" title="Subir" class="w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 shrink-0 disabled:opacity-30" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" data-evdown="${idx}" title="Descer" class="w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 shrink-0 disabled:opacity-30" ${idx === state.evEditing.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <button type="button" data-evsee="${idx}" title="Ver no painel" class="w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-govbr-600 dark:text-unifesp-400 shrink-0"><i class="fa-solid fa-eye"></i></button>
                <button type="button" data-evdel="${idx}" title="Remover" class="w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 shrink-0"><i class="fa-solid fa-xmark"></i></button>
            </li>`).join('');

        $$('[data-evpub]', ul).forEach(c => c.addEventListener('change', (e) => {
            const i = +e.target.dataset.evpub;
            if (e.target.checked) state.evEditing.forEach((ev, j) => ev.publica = (j === i)); // exclusão mútua
            else state.evEditing[i].publica = false;
            renderEvList();
        }));
        const swap = (i, j) => { const t = state.evEditing[i]; state.evEditing[i] = state.evEditing[j]; state.evEditing[j] = t; renderEvList(); };
        $$('[data-evup]', ul).forEach(b => b.addEventListener('click', (e) => { const i = +e.currentTarget.dataset.evup; if (i > 0) swap(i, i - 1); }));
        $$('[data-evdown]', ul).forEach(b => b.addEventListener('click', (e) => { const i = +e.currentTarget.dataset.evdown; if (i < state.evEditing.length - 1) swap(i, i + 1); }));
        $$('[data-evsee]', ul).forEach(b => b.addEventListener('click', (e) => previewEvidence(state.evEditing[+e.currentTarget.dataset.evsee])));
        $$('[data-evdel]', ul).forEach(b => b.addEventListener('click', (e) => { state.evEditing.splice(+e.currentTarget.dataset.evdel, 1); renderEvList(); }));
    }

    function buildForm(item) {
        const form = $('#itemForm');
        const editing = !!item;
        $('#formTitulo').textContent = editing ? 'Editar item' : 'Novo item';

        let currentType = item ? LattesTypes.normalizeType(item.typeKey) : '';
        let currentCat = item ? (item.categoryKey || LattesTypes.primaryCategory(currentType)) : '';
        if (currentCat === 'NAO_LATTES') currentCat = 'ATIVIDADES_LIVRES'; // legado

        form.innerHTML = `
            <div id="evidenceBlock" class="bg-govbr-50 dark:bg-gray-900 border border-govbr-100 dark:border-gray-700 rounded px-3 py-2">
                <label class="block text-xs font-semibold mb-1"><i aria-hidden="true" class="fa-solid fa-file-arrow-up text-govbr-600 dark:text-unifesp-400 mr-1"></i> <span id="pdfInputLabel">Evidências (PDF ou imagem)</span></label>
                <input type="file" id="pdfInput" multiple accept="application/pdf,image/jpeg,image/png"
                       class="w-full text-sm text-gray-600 dark:text-gray-300 file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-govbr-600 dark:file:bg-unifesp-700 file:text-white">
                <p class="text-xs text-gray-500 mt-1">Pode anexar várias evidências. Marque <strong>“pública”</strong> em <em>uma</em> delas (exibida no futuro módulo de publicação). Use ↑ ↓ para reordenar.</p>
                <ul id="evList" class="mt-2 space-y-1"></ul>
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs font-semibold mb-1">Categoria</label>
                    <select id="selCategoria" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></select>
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1">Tipo do item</label>
                    <select id="selTipo" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></select>
                </div>
            </div>

            <div id="dynFields" class="space-y-3"></div>

            <label id="inLattesWrap" class="flex items-center gap-2 text-sm">
                <input type="checkbox" id="chkInLattes" ${item ? (item.inLattes ? 'checked' : '') : ''}>
                <span>Este item <strong>já consta no Currículo Lattes</strong></span>
            </label>

            <div class="flex gap-2 pt-2">
                <button type="submit" class="px-4 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold hover:opacity-90">
                    <i aria-hidden="true" class="fa-solid fa-floppy-disk mr-1"></i> ${editing ? 'Salvar alterações' : 'Adicionar item'}
                </button>
                <button type="button" id="btnCancelar" class="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm ${editing ? '' : 'hidden'}">Cancelar</button>
            </div>
            ${datalistsHtml()}`;

        // Preencher selects de categoria/tipo
        const selCat = $('#selCategoria');
        selCat.innerHTML = LattesTypes.categories.map(c => `<option value="${c.key}">${esc(c.num + '. ' + c.label)}</option>`).join('');
        if (currentCat) selCat.value = currentCat;

        const optFor = (tk) => `<option value="${tk}">${esc(LattesTypes.label(tk))}</option>`;
        function fillTipos() {
            const cat = LattesTypes.categories.find(c => c.key === selCat.value);
            let html;
            if (cat.groups) {
                html = cat.groups.map(g =>
                    `<optgroup label="${esc(g.label)}">${g.types.map(optFor).join('')}</optgroup>`).join('');
            } else {
                html = cat.types.map(optFor).join('');
            }
            $('#selTipo').innerHTML = html;
            const allTypes = cat.groups ? cat.groups.flatMap(g => g.types) : cat.types;
            if (currentType && allTypes.includes(currentType)) $('#selTipo').value = currentType;
            // "Já consta no Lattes" não se aplica a Atividades livres (categoria 99)
            $('#inLattesWrap').style.display = LattesTypes.isNaoLattesCategory(selCat.value) ? 'none' : '';
            renderDynFields();
        }
        function renderDynFields() {
            const def = LattesTypes.get($('#selTipo').value);
            const vals = item ? (item.fields || {}) : {};
            $('#dynFields').innerHTML = (def ? def.fields : []).map(f => fieldHtml(f, vals[f.key])).join('');
            // Widgets especiais que precisam de JS após render (cascata de áreas)
            if (def && def.fields.some(f => f.type === 'areatree')) wireAreaTree($('#dynFields'), vals);
            // Validação em tempo real (ISSN/ISBN/DOI/URL) e contadores de textarea
            wireValidators($('#dynFields'));
            wireCounters($('#dynFields'));
            // Alguns tipos não têm comprovação (ex.: Conexões — apenas o link)
            const semEvidencia = !!(def && def.noEvidence);
            $('#evidenceBlock').style.display = semEvidencia ? 'none' : '';
            if (semEvidencia) { state.evEditing = []; renderEvList(); clearPdf(); }
            // Tipos de arquivo aceitos e rótulo conforme o tipo do item
            const accept = (def && def.accept) || 'application/pdf,image/jpeg,image/png';
            const inp = $('#pdfInput'); if (inp) inp.accept = accept;
            const lbl = $('#pdfInputLabel');
            if (lbl) lbl.textContent = accept === 'image/jpeg,image/png' ? 'Foto (JPEG ou PNG)'
                : (def && def.key === 'DOCUMENTO_PESSOAL' ? 'Documento (PDF ou imagem)' : 'Evidência (PDF ou imagem)');
        }

        selCat.addEventListener('change', () => { currentType = ''; fillTipos(); });
        $('#selTipo').addEventListener('change', () => { renderDynFields(); });
        // Limpa o destaque de erro assim que o usuário corrige o campo
        $('#dynFields').addEventListener('input', (e) => { if (e.target.matches('input,select,textarea')) setFieldError(e.target, ''); });
        $('#dynFields').addEventListener('change', (e) => { if (e.target.matches('input,select,textarea')) setFieldError(e.target, ''); });
        // Evidências: carrega as do item em edição (ou lista vazia p/ novo item)
        state.evEditing = editing ? evListFromItem(item) : [];
        fillTipos();
        renderEvList();

        $('#pdfInput').addEventListener('change', (e) => {
            const acc = e.target.accept || '';
            const allowed = (acc.includes('application/pdf') || acc === '') ? ['pdf', 'jpg', 'jpeg', 'png'] : ['jpg', 'jpeg', 'png'];
            const files = Array.from(e.target.files || []);
            let added = null;
            files.forEach(f => {
                const err = checkEvidenceFile(f, allowed);
                if (err) { toast(err, 'aviso'); return; }
                state.evEditing.push({
                    basename: null, ext: fileExt(f), name: f.name,
                    publica: state.evEditing.length === 0, file: f, // 1ª evidência já vira "pública"
                });
                added = f;
            });
            e.target.value = '';
            renderEvList();
            if (added) previewPdfFile(added); // exibe a última válida no painel
        });

        // Submit
        form.addEventListener('submit', onSubmitForm);
        $('#btnCancelar').addEventListener('click', () => { state.editingId = null; state.evEditing = []; buildForm(); });

        state.editingId = editing ? item.id : null;

        // Painel lateral do PDF: mostra evidência do item em edição, ou limpa
        if (editing && state.evEditing.length) showPdfForItem(item);
        else clearPdf();
    }

    // Opções de ano para os seletores (decrescente). Inclui uma folga futura
    // (conclusões previstas) e garante que o valor já salvo apareça, mesmo
    // fora da faixa padrão.
    function yearOptions(val) {
        const atual = new Date().getFullYear();
        const inicio = atual + 5, fim = 1900;
        const anos = [];
        for (let y = inicio; y >= fim; y--) anos.push(y);
        const v = String(val || '').trim();
        if (v && !anos.includes(Number(v)) && /^\d{3,4}$/.test(v)) anos.unshift(Number(v));
        return anos.map(y => `<option value="${y}" ${String(y) === v ? 'selected' : ''}>${y}</option>`).join('');
    }

    // Campos que ganham autocomplete (combobox): escolha da lista OU digitação
    // de um valor novo. Sugestões = lista curada (editável em Configurações) +
    // valores já usados no catálogo.
    const AUTOCOMPLETE_KEYS = ['instituicao', 'financiador', 'entidade', 'orgao', 'editora', 'periodico', 'evento'];
    const VOCAB_LABELS = {
        instituicao: 'Instituições', financiador: 'Financiadores / Agências', entidade: 'Entidades',
        orgao: 'Órgãos', editora: 'Editoras', periodico: 'Periódicos / Revistas', evento: 'Eventos',
    };
    function collectSuggestions(key) {
        const set = new Set(state.vocab[key] || []);
        state.items.forEach(i => { const v = i.fields && i.fields[key]; if (v && String(v).trim()) set.add(String(v).trim()); });
        return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }
    function datalistsHtml() {
        return AUTOCOMPLETE_KEYS.map(k =>
            `<datalist id="dl-${k}">${collectSuggestions(k).map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`
        ).join('');
    }

    function fieldHtml(f, val) {
        val = val == null ? '' : val;
        const req = f.required ? 'required' : '';
        const reqMark = f.required ? ' <span class="text-red-500">*</span>' : '';
        const base = 'w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900';
        let input;
        if (f.type === 'textarea') {
            const max = f.maxlength || 4000;
            input = `<textarea name="${f.key}" ${req} rows="2" maxlength="${max}" data-maxcount="${max}" placeholder="${esc(f.placeholder || '')}" class="${base}">${esc(val)}</textarea>
                <p class="text-[11px] text-gray-400 dark:text-gray-500 text-right mt-0.5" data-counter-for="${f.key}"></p>`;
        } else if (f.type === 'select') {
            input = `<select name="${f.key}" ${req} class="${base}">
                <option value="">—</option>
                ${f.options.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}
            </select>`;
        } else if (f.type === 'year') {
            // Campo de ano "fechado": seletor de anos, evita digitação incorreta
            input = `<select name="${f.key}" ${req} class="${base}">
                <option value="">—</option>
                ${yearOptions(val)}
            </select>`;
        } else if (f.type === 'checkboxes') {
            const selected = String(val || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
            input = `<div class="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                ${f.options.map(o => `<label class="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" data-cbgroup="${f.key}" value="${esc(o)}" ${selected.includes(o) ? 'checked' : ''}> ${esc(o)}
                </label>`).join('')}
            </div>`;
        } else if (f.type === 'skilllevels') {
            const levels = f.levels || ['Bom', 'Razoável', 'Pouco'];
            const map = {};
            String(val || '').split(';').forEach(pair => {
                const idx = pair.indexOf(':');
                if (idx > -1) { const s = pair.slice(0, idx).trim(), l = pair.slice(idx + 1).trim(); if (s && l) map[s] = l; }
            });
            input = `<div class="space-y-1 pt-1">
                ${f.options.map(sk => `<div class="flex items-center gap-2 text-sm">
                    <span class="w-32 shrink-0">${esc(sk)}</span>
                    <select data-slgroup="${f.key}" data-skill="${esc(sk)}" class="${base}">
                        <option value="">—</option>
                        ${levels.map(l => `<option value="${esc(l)}" ${map[sk] === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}
                    </select>
                </div>`).join('')}
            </div>`;
        } else if (f.type === 'areatree') {
            // Cascata CNPq/CAPES: 4 selects dependentes (preenchidos por wireAreaTree)
            const sel = (lvl, lbl) => `<select data-areatree="${lvl}" class="${base}"><option value="">${lbl}</option></select>`;
            input = `<div data-areatree-group class="space-y-1.5">
                ${sel('g', '— Grande área —')}
                ${sel('a', '— Área —')}
                ${sel('s', '— Subárea —')}
                ${sel('e', '— Especialidade —')}
            </div>`;
        } else {
            const t = (f.type === 'url' ? 'url' : (f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text')));
            const listAttr = (t === 'text' && AUTOCOMPLETE_KEYS.includes(f.key)) ? `list="dl-${f.key}"` : '';
            let vkind = '';
            if (f.key === 'issn' || f.key === 'isbn' || f.key === 'doi') vkind = f.key;
            else if (t === 'url') vkind = 'url';
            const vAttr = vkind ? `data-validate="${vkind}"` : '';
            const ph = f.placeholder || (f.key === 'issn' ? '0000-0000'
                : f.key === 'isbn' ? 'ISBN-10 ou ISBN-13'
                : t === 'url' ? 'https://…' : '');
            const extra = t === 'number' ? 'min="0" step="any"'
                : `maxlength="${f.maxlength || (t === 'url' ? 300 : 500)}"`;
            input = `<input type="${t}" name="${f.key}" value="${esc(val)}" ${req} ${listAttr} ${vAttr} ${extra} placeholder="${esc(ph)}" class="${base}">`;
        }
        return `<div>
            <label class="block text-xs font-semibold mb-1">${esc(f.label)}${reqMark}</label>
            ${input}
            ${f.help ? `<p class="text-xs text-gray-500 mt-0.5">${esc(f.help)}</p>` : ''}
        </div>`;
    }

    // Normaliza um nome para comparação (sem acentos, maiúsculas, espaços)
    function normNome(s) {
        return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
    }

    /* --------- Validação de ISSN / ISBN (com dígito verificador) --------- */
    // Retorna { ok, value?, msg? }. Vazio é considerado válido (campos opcionais).
    function validateISSN(v) {
        const s = String(v || '').trim();
        if (!s) return { ok: true, value: '' };
        const d = s.toUpperCase().replace(/[\s-]/g, '');
        if (!/^\d{7}[\dX]$/.test(d)) return { ok: false, msg: 'ISSN inválido — use 8 dígitos no formato NNNN-NNNC (ex.: 0378-5955).' };
        let sum = 0; for (let i = 0; i < 7; i++) sum += (8 - i) * Number(d[i]);
        const chk = d[7] === 'X' ? 10 : Number(d[7]);
        if (((11 - (sum % 11)) % 11) !== chk) return { ok: false, msg: 'ISSN inválido — dígito verificador não confere.' };
        return { ok: true, value: d.slice(0, 4) + '-' + d.slice(4) };
    }
    function validateISBN(v) {
        const s = String(v || '').trim();
        if (!s) return { ok: true, value: '' };
        const d = s.toUpperCase().replace(/[\s-]/g, '');
        if (/^\d{9}[\dX]$/.test(d)) { // ISBN-10
            let sum = 0; for (let i = 0; i < 10; i++) sum += (d[i] === 'X' ? 10 : Number(d[i])) * (10 - i);
            if (sum % 11 !== 0) return { ok: false, msg: 'ISBN-10 inválido — dígito verificador não confere.' };
            return { ok: true, value: s }; // preserva a hifenização do usuário
        }
        if (/^\d{13}$/.test(d)) { // ISBN-13 (EAN)
            let sum = 0; for (let i = 0; i < 13; i++) sum += Number(d[i]) * (i % 2 ? 3 : 1);
            if (sum % 10 !== 0) return { ok: false, msg: 'ISBN-13 inválido — dígito verificador não confere.' };
            return { ok: true, value: s }; // preserva a hifenização do usuário
        }
        return { ok: false, msg: 'ISBN inválido — informe 10 ou 13 dígitos.' };
    }
    // DOI: aceita o identificador puro ou colado como URL do resolver; normaliza p/ puro.
    function validateDOI(v) {
        const s = String(v || '').trim();
        if (!s) return { ok: true, value: '' };
        const d = s.replace(/^\s*(https?:\/\/)?(dx\.)?doi\.org\//i, '').trim();
        if (/^10\.\d{4,9}\/\S+$/.test(d)) return { ok: true, value: d };
        return { ok: false, msg: 'DOI inválido — formato esperado 10.xxxx/sufixo (ex.: 10.1000/xyz123).' };
    }
    // URL: adiciona esquema https:// quando ausente e valida http(s).
    function validateURL(v) {
        const s = String(v || '').trim();
        if (!s) return { ok: true, value: '' };
        const u = /^[a-z][a-z0-9+.\-]*:\/\//i.test(s) ? s : 'https://' + s;
        try {
            const parsed = new URL(u);
            if (!/^https?:$/.test(parsed.protocol)) return { ok: false, msg: 'URL inválida — use http:// ou https://.' };
            return { ok: true, value: u };
        } catch (_) { return { ok: false, msg: 'URL inválida.' }; }
    }
    function validateField(kind, value) {
        if (kind === 'issn') return validateISSN(value);
        if (kind === 'isbn') return validateISBN(value);
        if (kind === 'doi') return validateDOI(value);
        if (kind === 'url') return validateURL(value);
        return { ok: true, value: value };
    }
    // Feedback visual (borda vermelha + mensagem) para campos com data-validate
    function setFieldError(el, msg) {
        el.classList.toggle('border-red-500', !!msg);
        el.classList.toggle('ring-1', !!msg);
        el.classList.toggle('ring-red-500', !!msg);
        let p = el.parentElement.querySelector('.validate-msg');
        if (msg) {
            if (!p) { p = document.createElement('p'); p.className = 'validate-msg text-xs text-red-600 dark:text-red-400 mt-0.5'; el.parentElement.appendChild(p); }
            p.textContent = msg;
        } else if (p) p.remove();
    }
    function wireValidators(container) {
        $$('[data-validate]', container).forEach(el => {
            el.addEventListener('blur', () => {
                const v = el.value.trim();
                const res = validateField(el.dataset.validate, v);
                if (v && !res.ok) setFieldError(el, res.msg);
                else { setFieldError(el, ''); if (v && res.value) el.value = res.value; } // normaliza (hífen)
            });
            el.addEventListener('input', () => setFieldError(el, '')); // limpa erro ao digitar
        });
    }
    // Contador de caracteres para textareas com data-maxcount
    function wireCounters(container) {
        $$('textarea[data-maxcount]', container).forEach(ta => {
            const max = +ta.dataset.maxcount;
            const out = container.querySelector(`[data-counter-for="${ta.name}"]`);
            if (!out) return;
            const upd = () => { out.textContent = `${ta.value.length}/${max}`; };
            upd();
            ta.addEventListener('input', upd);
        });
    }

    // Preenche e conecta a cascata Grande área › Área › Subárea › Especialidade
    function wireAreaTree(container, vals) {
        const DATA = window.AreasConhecimento || [];
        const g = container.querySelector('[data-areatree="g"]');
        const a = container.querySelector('[data-areatree="a"]');
        const s = container.querySelector('[data-areatree="s"]');
        const e = container.querySelector('[data-areatree="e"]');
        if (!g || !a || !s || !e) return;

        const fill = (sel, placeholder, names, current) => {
            sel.innerHTML = `<option value="">${esc(placeholder)}</option>` +
                names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
            if (current) {
                const want = normNome(current);
                const opt = Array.from(sel.options).find(o => o.value && normNome(o.value) === want);
                sel.value = opt ? opt.value : '';
            } else sel.value = '';
        };
        const findG = () => DATA.find(x => x.n === g.value);
        const findA = () => { const G = findG(); return G ? G.a.find(x => x.n === a.value) : null; };
        const findS = () => { const A = findA(); return A ? A.s.find(x => x.n === s.value) : null; };
        const refillA = cur => { const G = findG(); fill(a, '— Área —', G ? G.a.map(x => x.n) : [], cur); a.disabled = !G; };
        const refillS = cur => { const A = findA(); fill(s, '— Subárea —', A ? A.s.map(x => x.n) : [], cur); s.disabled = !A; };
        const refillE = cur => { const S = findS(); fill(e, '— Especialidade —', S ? S.e : [], cur); e.disabled = !S; };

        fill(g, '— Grande área —', DATA.map(x => x.n), vals.grandeArea);
        refillA(vals.area); refillS(vals.subarea); refillE(vals.especialidade);

        g.addEventListener('change', () => { refillA(''); refillS(''); refillE(''); });
        a.addEventListener('change', () => { refillS(''); refillE(''); });
        s.addEventListener('change', () => { refillE(''); });
    }

    // Coleta os valores dos campos de um formulário conforme a definição do tipo
    function collectFields(form, def) {
        const fields = {};
        def.fields.forEach(f => {
            if (f.type === 'checkboxes') {
                fields[f.key] = $$(`[data-cbgroup="${f.key}"]`, form).filter(c => c.checked).map(c => c.value).join('; ');
            } else if (f.type === 'skilllevels') {
                fields[f.key] = $$(`[data-slgroup="${f.key}"]`, form).filter(s => s.value).map(s => `${s.dataset.skill}: ${s.value}`).join('; ');
            } else if (f.type === 'areatree') {
                const gv = q => { const el = form.querySelector(`[data-areatree="${q}"]`); return el ? el.value.trim() : ''; };
                const G = gv('g'), A = gv('a'), S = gv('s'), E = gv('e');
                fields.grandeArea = G; fields.area = A; fields.subarea = S; fields.especialidade = E;
                fields[f.key] = (G && A) ? [G, A, S, E].filter(Boolean).join(' › ') : '';
            } else {
                const el = form.elements[f.key];
                if (el) fields[f.key] = el.value.trim();
            }
        });
        return fields;
    }
    // Normaliza pontuação tipográfica dos campos-texto p/ compatibilidade
    // ISO-8859-1 (futura exportação ao Lattes). Retorna nº de caracteres que
    // ainda ficaram fora do Latin-1 (ex.: emoji) — que viram entidades no XML.
    function normalizeEncoding(fields) {
        if (!window.LzEncoding) return 0;
        let residual = 0;
        Object.keys(fields).forEach(k => {
            if (typeof fields[k] !== 'string' || !fields[k]) return;
            try { fields[k] = LzEncoding.normalizePunctuation(fields[k]); } catch (_) {}
            try { residual += (LzEncoding.findNonLatin1(fields[k]) || []).length; } catch (_) {}
        });
        return residual;
    }

    // Chave lógica p/ detectar duplicatas (tipo + título normalizado + ano).
    // Retorna null quando não há título — aí não arriscamos falso positivo.
    function dupKey(typeKey, fields) {
        fields = fields || {};
        const title = normNome(fields.titulo || fields.curso || fields.orientando || fields.candidato || fields.grandeArea || '');
        if (!title) return null;
        const ano = String(fields.ano || fields.anoFim || fields.anoInicio || '').replace(/\D/g, '');
        return typeKey + '|' + title + '|' + ano;
    }

    // Resolve o elemento visual de um campo (p/ marcar erro inline)
    function fieldControl(form, f) {
        if (!form) return null;
        if (f.type === 'areatree') return form.querySelector('[data-areatree="g"]');
        if (f.type === 'checkboxes') return form.querySelector(`[data-cbgroup="${f.key}"]`);
        if (f.type === 'skilllevels') return form.querySelector(`[data-slgroup="${f.key}"]`);
        return (form.elements && form.elements[f.key]) || form.querySelector(`[name="${f.key}"]`);
    }
    // Valida obrigatórios + coerência de anos + ISSN/ISBN. Marca erros inline
    // (única via de validação — o form usa novalidate, sem "balão" nativo).
    function validateItemFields(def, fields, form) {
        // limpa erros anteriores dos campos deste tipo
        def.fields.forEach(f => { const el = fieldControl(form, f); if (el) setFieldError(el, ''); });

        // 1) Obrigatórios — destaca todos e foca o primeiro
        const faltando = def.fields.filter(f => f.required && !fields[f.key]);
        if (faltando.length) {
            let first = null;
            faltando.forEach(f => { const el = fieldControl(form, f); if (el) { setFieldError(el, 'Campo obrigatório.'); if (!first) first = el; } });
            if (first) { first.focus(); first.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            toast('Preencha os campos obrigatórios destacados: ' + faltando.map(f => f.label).join(', '), 'aviso');
            return false;
        }

        // 2) Coerência de anos: fim não pode ser anterior ao início
        const ini = String(fields.anoInicio || '').replace(/\D/g, ''), fim = String(fields.anoFim || '').replace(/\D/g, '');
        if (ini && fim && Number(fim) < Number(ini)) {
            const el = fieldControl(form, { key: 'anoFim' });
            if (el) { setFieldError(el, 'O ano de fim não pode ser anterior ao de início.'); el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            toast('O ano de fim não pode ser anterior ao de início.', 'aviso');
            return false;
        }

        // 3) Formatos específicos (ISSN/ISBN/DOI/URL) e números ≥ 0
        for (const f of def.fields) {
            const raw = fields[f.key];
            const kind = (f.key === 'issn' || f.key === 'isbn' || f.key === 'doi') ? f.key : (f.type === 'url' ? 'url' : null);
            if (kind) {
                if (raw == null || raw === '') continue;
                const res = validateField(kind, raw);
                if (!res.ok) {
                    toast(res.msg, 'aviso');
                    const el = fieldControl(form, f);
                    if (el) { setFieldError(el, res.msg); el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                    return false;
                }
                fields[f.key] = res.value; // valor normalizado
            } else if (f.type === 'number' && raw !== '' && raw != null) {
                if (isNaN(Number(raw)) || Number(raw) < 0) {
                    const el = fieldControl(form, f);
                    if (el) { setFieldError(el, 'Informe um número ≥ 0.'); el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                    toast(`${f.label}: informe um número válido (≥ 0).`, 'aviso');
                    return false;
                }
            }
        }
        return true;
    }

    async function onSubmitForm(e) {
        e.preventDefault();
        const form = e.target;
        const categoryKey = $('#selCategoria').value;
        const typeKey = $('#selTipo').value;
        const naoLattes = LattesTypes.isNaoLattesCategory(categoryKey);
        const def = LattesTypes.get(typeKey);

        const fields = collectFields(form, def);
        const encResid = normalizeEncoding(fields); // compatibilidade ISO-8859-1
        if (!validateItemFields(def, fields, form)) return;

        let editing = state.editingId ? state.items.find(i => i.id === state.editingId) : null;
        // Tipo único (singleton): se já existir outro item desse tipo, atualiza-o
        // em vez de criar/duplicar.
        if (LattesTypes.isSingleton(typeKey)) {
            const ex = state.items.find(i => i.typeKey === typeKey && (!editing || i.id !== editing.id));
            if (ex) editing = ex;
        }
        // Detecção de duplicata (só ao criar item novo, não-singleton)
        if (!editing && !LattesTypes.isSingleton(typeKey)) {
            const key = dupKey(typeKey, fields);
            if (key) {
                const dup = state.items.find(i => i.typeKey === typeKey && dupKey(i.typeKey, i.fields) === key);
                if (dup && !confirm(`Já existe um item parecido:\n"${LattesTypes.itemTitle(dup)}".\n\nDeseja cadastrar mesmo assim?`)) return;
            }
        }
        const item = editing || {
            id: uid(), createdAt: nowISO(),
            source: 'local', hasPdf: false, pdfName: null, lattesRef: null,
        };
        const prevCat = item.categoryKey || null;              // categoria ANTES da edição
        const prevEvid = evListFromItem(item); // estado anterior (p/ apagar removidas)
        item.lattesItem = !naoLattes;
        item.typeKey = typeKey;
        item.categoryKey = categoryKey;
        item.fields = fields;
        const inLattesEl = $('#chkInLattes');
        item.inLattes = naoLattes ? false : (inLattesEl ? inLattesEl.checked : false);
        item.updatedAt = nowISO();

        // ---- Evidências: grava novas, remove excluídas, aplica ordem/pública ----
        const subdir = LattesTypes.categoryFolder(item.categoryKey);
        const semDir = !Storage.hasDirectory();
        // Se a CATEGORIA mudou, move os arquivos já gravados (json + anexos) da
        // pasta antiga para a nova — evita órfãos e evidências inacessíveis.
        if (!semDir && editing && prevCat && prevCat !== item.categoryKey) {
            try { await Storage.moveItemFiles(item.id, LattesTypes.categoryFolder(prevCat), subdir); } catch (_) {}
        }
        const usedBases = new Set(state.evEditing.filter(ev => ev.basename).map(ev => ev.basename));
        const newBase = () => { let b; do { b = `${item.id}-${randCode(2)}`; } while (usedBases.has(b)); usedBases.add(b); return b; };
        let naoGravadas = 0;
        const evOut = [];
        for (const ev of state.evEditing) {
            if (ev.file) {
                // Sem diretório configurado NÃO registramos a evidência (o arquivo
                // não seria gravado — evita metadado apontando p/ arquivo inexistente).
                if (semDir) { naoGravadas++; continue; }
                const basename = ev.basename || newBase();
                try { await Storage.writeAttachment(basename, ev.file, subdir, ev.ext); }
                catch (e) { toast('Falha ao gravar evidência "' + ev.name + '": ' + e.message, 'aviso'); continue; }
                evOut.push({ basename, ext: ev.ext, name: ev.name, publica: !!ev.publica });
            } else {
                evOut.push({ basename: ev.basename, ext: ev.ext, name: ev.name, publica: !!ev.publica });
            }
        }
        // apaga arquivos de evidências que foram removidas
        if (!semDir) {
            const keep = new Set(evOut.map(e => e.basename));
            for (const old of prevEvid) {
                if (old.basename && old.basename !== item.id && !keep.has(old.basename)) {
                    try { await Storage.deleteEntry(old.basename, subdir); } catch (_) {}
                }
            }
        }
        // exclusão mútua da marca "pública": no máximo uma
        let temPub = false;
        evOut.forEach(e => { if (e.publica && !temPub) temPub = true; else e.publica = false; });
        item.evidencias = evOut;
        item.hasPdf = evOut.length > 0;
        const pub = evOut.find(e => e.publica) || evOut[0] || null;
        item.pdfName = pub ? pub.name : null;
        item.fileExt = pub ? pub.ext : null;
        if (naoGravadas) {
            toast(`${naoGravadas} evidência(s) não registrada(s): configure um diretório em Configurações e anexe novamente.`, 'aviso');
        }

        await persistItem(item);
        toast(editing ? 'Item atualizado.' : 'Item adicionado.', 'ok');
        if (encResid) toast(`Atenção: ${encResid} caractere(s) fora do ISO-8859-1 permanecem (ex.: emoji) — na exportação ao Lattes virarão entidades XML.`, 'aviso');

        state.editingId = null; state.evEditing = [];
        buildForm();
        renderItemList();
    }

    // Número de evidências do item (considera formato legado hasPdf)
    function evCount(item) {
        return Array.isArray(item.evidencias) ? item.evidencias.length : (item.hasPdf ? 1 : 0);
    }
    // Estado de preenchimento da descrição de um item:
    //   'red'   — falta ao menos um campo OBRIGATÓRIO
    //   'amber' — obrigatórios ok, mas falta algum campo OPCIONAL
    //   'green' — todos os campos preenchidos
    function descState(item) {
        const def = LattesTypes.get(item.typeKey);
        if (!def || !def.fields || !def.fields.length) return 'green'; // tipo sem campos
        const vals = item.fields || {};
        const filled = f => { const v = vals[f.key]; return v != null && String(v).trim() !== ''; };
        if (def.fields.some(f => f.required && !filled(f))) return 'red';
        if (def.fields.some(f => !filled(f))) return 'amber';
        return 'green';
    }
    // Marcador de 2 estados: verde (ok) / vermelho (pendente)
    function marker(ok, label, icon) {
        return marker3(ok ? 'green' : 'red', label, icon);
    }
    // Marcador de até 3 estados: verde / amarelo / vermelho
    function marker3(estado, label, icon) {
        const cls = estado === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
            : estado === 'amber' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
            : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
        return `<span class="badge ${cls}"><i class="fa-solid ${icon}"></i> ${label}</span>`;
    }

    function statusBadges(item) {
        const b = [];
        const def = LattesTypes.get(item.typeKey);
        // Lattes: verde quando já consta, vermelho quando falta (só itens do Lattes)
        if (item.lattesItem) {
            b.push(marker(item.inLattes, 'Lattes', 'fa-graduation-cap'));
        } else {
            b.push('<span class="badge bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"><i class="fa-solid fa-heart"></i> Não-Lattes</span>');
        }
        // Evidência: verde quando há anexo(s), vermelho quando falta (tipos que exigem)
        if (!(def && def.noEvidence)) {
            const n = evCount(item);
            b.push(marker(n > 0, `evidência${n > 1 ? ` (${n})` : ''}`, 'fa-file-pdf'));
        }
        // Descrição: verde (tudo), amarelo (falta opcional), vermelho (falta obrigatório)
        b.push(marker3(descState(item), 'descrição', 'fa-align-left'));
        return b.join(' ');
    }

    function itemYear(i) {
        const y = (i.fields && (i.fields.ano || i.fields.anoFim || i.fields.anoInicio)) || '';
        const n = parseInt(String(y).replace(/\D/g, '').slice(0, 4), 10);
        return isNaN(n) ? null : n;
    }

    function itemCardHtml(i) {
        const anoNum = itemYear(i);
        const ano = anoNum != null ? String(anoNum) : '—';
        const titulo = esc(LattesTypes.itemTitle(i));
        const tipo = esc(LattesTypes.label(i.typeKey));
        return `
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5">
                <div class="flex items-center gap-x-2 gap-y-1 flex-wrap">
                    <span class="text-xs font-mono text-gray-500 shrink-0 w-9 text-right tabular-nums">${ano}</span>
                    <span class="text-sm font-medium truncate flex-1 min-w-[8rem]" title="${tipo} · ${titulo}">${titulo}</span>
                    <div class="flex flex-wrap gap-1 items-center">${statusBadges(i)}</div>
                    <div class="flex gap-0.5 shrink-0 ml-auto">
                        ${i.hasPdf ? `<button data-act="pdf" data-id="${i.id}" title="Ver arquivo no painel (Catalogar)" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"><i class="fa-solid ${isImageExt(i.fileExt) ? 'fa-image' : 'fa-file-pdf'}"></i></button>` : ''}
                        <button data-act="edit" data-id="${i.id}" title="Abrir / Editar" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-govbr-600 dark:text-unifesp-400"><i class="fa-solid fa-pen"></i></button>
                        <button data-act="del" data-id="${i.id}" title="Excluir" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
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

    // Monta o HTML segmentado em 2 níveis: categoria (01..11, 99) → tipo de item.
    // Só categorias/tipos com itens são exibidos. Reutilizado em Catálogo e Relatório.
    function buildGroupedHtml(items) {
        const order = LattesTypes.categories.map(c => c.key).concat('NAO_LATTES');
        const groups = {};
        items.forEach(i => { (groups[i.categoryKey] = groups[i.categoryKey] || []).push(i); });
        const typeOrderOf = (catKey) => {
            const c = LattesTypes.categoryByKey(catKey);
            if (!c) return [];
            return c.groups ? c.groups.flatMap(g => g.types) : (c.types || []);
        };
        return order.filter(k => groups[k] && groups[k].length).map(k => {
            const g = groups[k];
            const byType = {};
            g.forEach(i => { (byType[i.typeKey] = byType[i.typeKey] || []).push(i); });
            const seq = typeOrderOf(k);
            const typeKeys = Object.keys(byType).sort((a, b) => {
                const ia = seq.indexOf(a), ib = seq.indexOf(b);
                return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
            });
            const typesHtml = typeKeys.map(tk => `
                <details open class="border border-gray-100 dark:border-gray-700/60 rounded">
                    <summary class="cursor-pointer select-none px-2 py-1.5 bg-gray-50 dark:bg-gray-800/60 text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <i aria-hidden="true" class="fa-solid fa-angle-right text-xs text-gray-400"></i>
                        ${esc(LattesTypes.label(tk))}
                        <span class="text-xs font-normal text-gray-500">(${byType[tk].length})</span>
                    </summary>
                    <div class="p-1.5 space-y-1">${byType[tk].map(itemCardHtml).join('')}</div>
                </details>`).join('');
            return `
            <details open class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <summary class="cursor-pointer select-none px-3 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-sm flex items-center gap-2">
                    <i aria-hidden="true" class="fa-solid ${esc((LattesTypes.categoryByKey(k) || {}).icon || 'fa-folder')} text-govbr-600 dark:text-unifesp-400"></i>
                    ${esc(LattesTypes.categoryNumLabel(k))}
                    <span class="text-xs font-normal text-gray-500">(${g.length})</span>
                </summary>
                <div class="p-2 space-y-2">${typesHtml}</div>
            </details>`;
        }).join('');
    }
    function bindItemActions(container) {
        $$('[data-act]', container).forEach(btn => btn.addEventListener('click', onItemAction));
    }

    function renderItemList() {
        const list = $('#itemList');
        if (!list) return; // aba Conformidade não está montada
        const q = ($('#filterBox') && $('#filterBox').value || '').toLowerCase();
        const asc = (state.sortOrder || 'desc') === 'asc';
        const view = state.viewFilter && VIEW_PREDICATE[state.viewFilter] ? state.viewFilter : 'todos';

        // Recorte (cartão) atualmente selecionado
        const chip = $('#viewChip');
        if (chip) {
            if (view === 'todos') { chip.classList.add('hidden'); chip.textContent = ''; }
            else {
                const m = VIEW_META[view];
                chip.className = `text-xs font-normal badge bg-${m.cor}-100 text-${m.cor}-800 dark:bg-${m.cor}-900/40 dark:text-${m.cor}-300`;
                chip.innerHTML = `<i class="fa-solid ${m.icone}"></i> ${m.titulo} · <button type="button" id="viewClear" class="underline">ver todos</button>`;
                const clr = $('#viewClear'); if (clr) clr.addEventListener('click', () => { state.viewFilter = 'todos'; renderConformidade(); });
            }
        }

        let items = state.items.filter(VIEW_PREDICATE[view]);
        if (q) items = items.filter(i => (LattesTypes.itemTitle(i) + ' ' + LattesTypes.label(i.typeKey) + ' ' + LattesTypes.categoryLabel(i.categoryKey)).toLowerCase().includes(q));

        const cnt = $('#itemCount');
        if (cnt) cnt.textContent = (view === 'todos' && !q) ? `(${state.items.length})` : `(${items.length} de ${state.items.length})`;

        if (!items.length) {
            const vazio = !state.items.length
                ? 'Nenhum item ainda. Adicione pelo formulário ou importe o XML do Lattes.'
                : (view === 'todos' ? 'Nenhum item corresponde ao filtro.' : 'Nenhum item neste recorte.');
            list.innerHTML = `<p class="text-sm text-gray-500 italic py-6 text-center">${vazio}</p>`;
            return;
        }
        list.innerHTML = buildGroupedHtml(sortByYear(items, asc));
        bindItemActions(list);
    }

    async function onItemAction(e) {
        const btn = e.currentTarget;
        const id = btn.dataset.id;
        const item = state.items.find(i => i.id === id);
        if (!item) return;
        if (btn.dataset.act === 'edit' || btn.dataset.act === 'pdf') {
            // Itens de perfil (Identificação, Foto, Endereço, etc.) são editados em Configurações
            if (LattesTypes.isPerfilType(item.typeKey)) {
                switchTab('config');
                const sec = $('#perfilSection');
                if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
            // Abre o item na aba Catalogar; o PDF (se houver) aparece no painel lateral
            switchTab('catalogar');
            buildForm(item);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (btn.dataset.act === 'del') {
            if (!confirm(`Excluir "${LattesTypes.itemTitle(item)}"? Os arquivos ${id}.pdf/.json também serão removidos.`)) return;
            await deleteItem(id);
            toast('Item excluído.', 'ok');
            renderItemList();
        }
    }

    /* =====================================================================
       IMPORTAR LATTES (XML) — seção dentro de Configurações
       ===================================================================== */
    function importLattesSectionHtml() {
        return `
            <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-2 flex items-center gap-2">
                    <i aria-hidden="true" class="fa-solid fa-file-import text-govbr-600 dark:text-unifesp-400"></i> Importar Currículo Lattes (XML)
                </h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Exporte seu currículo em XML na Plataforma Lattes (Menu <em>&rarr; Exportar &rarr; XML</em>) e selecione o arquivo abaixo.
                    Os itens serão listados para você escolher quais importar; cada um poderá receber um PDF depois.
                </p>
                <input type="file" id="xmlInput" accept=".xml,application/xml,text/xml"
                       class="text-sm file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-govbr-600 dark:file:bg-unifesp-700 file:text-white">
                <div id="xmlResult" class="mt-3"></div>
            </section>`;
    }

    async function onXmlSelected(e) {
        const file = e.target.files[0];
        if (!file) return;
        // Conversor de ENTRADA: decodifica respeitando o encoding do XML (Lattes = ISO-8859-1)
        const text = await LzEncoding.decodeXmlFile(file);
        const res = LattesXML.parse(text);
        state.lattesParsed = res;

        if (res.errors && res.errors.length) { toast(res.errors[0], 'erro'); }
        renderXmlResult(res);
    }

    function renderXmlResult(res) {
        const box = $('#xmlResult');
        if (!res.items.length) {
            box.innerHTML = `<p class="text-sm text-gray-500 italic">Nenhum item reconhecido no XML.</p>`;
            return;
        }
        const existingRefs = new Set(state.items.map(i => i.lattesRef).filter(Boolean));
        const novos = res.items.filter(it => !existingRefs.has(it.lattesRef)).length;
        const jaCat = res.items.length - novos;
        const resumo = Object.entries(res.summary)
            .map(([k, n]) => `<span class="badge bg-govbr-50 text-govbr-700 dark:bg-gray-700 dark:text-gray-200">${esc(LattesTypes.label(k))}: ${n}</span>`).join(' ');

        box.innerHTML = `
            <div class="mb-3">
                ${res.titular ? `<p class="text-sm mb-1">Titular: <strong>${esc(res.titular)}</strong></p>` : ''}
                <p class="text-sm mb-1">${res.items.length} itens reconhecidos — <strong class="text-green-700 dark:text-green-400">${novos} novos</strong>, ${jaCat} já catalogado(s).</p>
                <div class="flex flex-wrap gap-1">${resumo}</div>
            </div>
            <div class="flex items-center gap-2 mb-2 flex-wrap">
                <button id="btnSelNovos" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Selecionar novos</button>
                <button id="btnSelAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Todos</button>
                <button id="btnSelNone" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Nenhum</button>
                <button id="btnImport" class="ml-auto px-4 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold">
                    <i class="fa-solid fa-download mr-1"></i> Importar selecionados
                </button>
            </div>
            <div class="space-y-1 scroll-area max-h-[60vh] overflow-y-auto pr-1">
                ${res.items.map((it, idx) => {
                    const dup = existingRefs.has(it.lattesRef);
                    return `<label class="flex items-start gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm ${dup ? 'opacity-60' : ''}">
                        <input type="checkbox" class="xmlchk mt-1" data-idx="${idx}" ${dup ? '' : 'checked'}>
                        <span class="min-w-0">
                            <span class="font-medium">${esc(it.fields.titulo || it.fields.curso || '(sem título)')}</span>
                            <span class="block text-xs text-gray-500">${esc(LattesTypes.label(it.typeKey))} ${it.fields.ano ? '· ' + esc(it.fields.ano) : ''} ${dup ? '· <em>já catalogado</em>' : ''}</span>
                        </span>
                    </label>`;
                }).join('')}
            </div>`;

        $('#btnSelNovos').addEventListener('click', () => $$('.xmlchk').forEach(c => {
            c.checked = !existingRefs.has(res.items[+c.dataset.idx].lattesRef);
        }));
        $('#btnSelAll').addEventListener('click', () => $$('.xmlchk').forEach(c => c.checked = true));
        $('#btnSelNone').addEventListener('click', () => $$('.xmlchk').forEach(c => c.checked = false));
        $('#btnImport').addEventListener('click', importSelected);
    }

    async function importSelected() {
        const chosen = $$('.xmlchk').filter(c => c.checked).map(c => parseInt(c.dataset.idx, 10));
        if (!chosen.length) { toast('Nenhum item selecionado.', 'aviso'); return; }
        const existingRefs = new Set(state.items.map(i => i.lattesRef).filter(Boolean));
        let n = 0, atualizados = 0;
        for (const idx of chosen) {
            const src = state.lattesParsed.items[idx];
            // Tipos únicos (Identificação, Endereço, Resumo, Outras info): se já
            // existir um item desse tipo, ATUALIZA em vez de criar um novo.
            if (LattesTypes.isSingleton(src.typeKey)) {
                const ex = state.items.find(i => i.typeKey === src.typeKey);
                if (ex) {
                    ex.fields = src.fields; ex.categoryKey = src.categoryKey || ex.categoryKey;
                    ex.inLattes = true; ex.lattesRef = src.lattesRef; ex.updatedAt = nowISO();
                    await persistItem(ex);
                    atualizados++; continue;
                }
            }
            if (existingRefs.has(src.lattesRef)) continue;
            const item = {
                id: uid(), createdAt: nowISO(), updatedAt: nowISO(),
                lattesItem: true, typeKey: src.typeKey,
                categoryKey: src.categoryKey || LattesTypes.primaryCategory(src.typeKey),
                fields: src.fields,
                source: 'lattes', inLattes: true, lattesRef: src.lattesRef,
                hasPdf: false, pdfName: null, evidencias: [],
            };
            await persistItem(item);
            existingRefs.add(src.lattesRef);
            n++;
        }
        toast(`${n} item(ns) importado(s)${atualizados ? `, ${atualizados} atualizado(s)` : ''}.`, 'ok');
        renderXmlResult(state.lattesParsed);
        renderItemList();
    }

    /* =====================================================================
       ABA: CONFIGURAÇÕES
       ===================================================================== */
    /* =====================================================================
       Dados gerais (perfil) — editados em Configurações
       ===================================================================== */
    function perfilCardHtml(tk) {
        const def = LattesTypes.get(tk);
        const item = state.items.find(i => i.typeKey === tk);
        const vals = item ? (item.fields || {}) : {};
        const resumo = item ? esc(LattesTypes.itemTitle(item)) : 'vazio';
        const isFoto = tk === 'FOTO_PERFIL';
        const fotoBlock = isFoto ? `
            <div>
                <label class="block text-xs font-semibold mb-1">Imagem (JPEG ou PNG)</label>
                <input type="file" data-perfil-foto accept="image/jpeg,image/png"
                       class="w-full text-sm text-gray-600 dark:text-gray-300 file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-govbr-600 dark:file:bg-unifesp-700 file:text-white">
                <img data-perfil-foto-preview class="mt-2 max-h-40 rounded border border-gray-200 dark:border-gray-700 hidden" alt="Foto de perfil">
            </div>` : '';
        return `<details class="border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900">
            <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center gap-2">
                <i aria-hidden="true" class="fa-solid fa-angle-right text-xs text-gray-400"></i>
                ${esc(def.label)}
                <span class="text-xs font-normal ${item ? 'text-green-600 dark:text-green-400' : 'text-gray-400'} truncate min-w-0">· ${resumo}</span>
            </summary>
            <form data-perfil-form="${tk}" class="p-3 space-y-3 border-t border-gray-100 dark:border-gray-700">
                ${fotoBlock}
                ${def.fields.map(f => fieldHtml(f, vals[f.key])).join('')}
                <div class="flex gap-2">
                    <button type="submit" class="px-3 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-floppy-disk mr-1"></i> Salvar</button>
                </div>
            </form>
        </details>`;
    }
    function perfilSectionHtml() {
        return `<section id="perfilSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-id-card text-govbr-600 dark:text-unifesp-400"></i> Dados gerais (perfil)</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Informações autodeclaradas do Currículo Lattes (Identificação, Foto, Endereço, Texto inicial e Outras informações). São itens <strong>do Lattes</strong> e <strong>não exigem evidência</strong>.</p>
            <div class="space-y-2">${LattesTypes.perfilTypes().map(perfilCardHtml).join('')}</div>
        </section>`;
    }
    function wirePerfilSection() {
        const sec = $('#perfilSection');
        if (!sec) return;
        wireValidators(sec);
        wireCounters(sec);
        $$('[data-perfil-foto]', sec).forEach(inp => inp.addEventListener('change', (e) => {
            const f = e.target.files[0];
            if (!f) return;
            const err = checkEvidenceFile(f, ['jpg', 'jpeg', 'png']);
            if (err) { toast(err, 'aviso'); e.target.value = ''; return; }
            const prev = inp.parentElement.querySelector('[data-perfil-foto-preview]');
            if (prev) { prev.src = URL.createObjectURL(f); prev.classList.remove('hidden'); }
        }));
        // Carrega a foto atual (se houver) no preview
        (async () => {
            const foto = state.items.find(i => i.typeKey === 'FOTO_PERFIL' && evCount(i));
            const prev = sec.querySelector('[data-perfil-foto-preview]');
            if (!foto || !prev) return;
            const ev = evListFromItem(foto)[0];
            try {
                const url = await Storage.readAttachmentUrl(ev.basename, LattesTypes.categoryFolder('DADOS_GERAIS'), ev.ext);
                if (url) { prev.src = url; prev.classList.remove('hidden'); }
            } catch (_) {}
        })();
        $$('[data-perfil-form]', sec).forEach(form => form.addEventListener('submit', onPerfilSubmit));
    }
    async function onPerfilSubmit(e) {
        e.preventDefault();
        const form = e.currentTarget;
        const tk = form.dataset.perfilForm;
        const def = LattesTypes.get(tk);
        const fields = collectFields(form, def);
        const encResid = normalizeEncoding(fields); // compatibilidade ISO-8859-1
        if (!validateItemFields(def, fields, form)) return;

        let item = state.items.find(i => i.typeKey === tk) || {
            id: uid(), createdAt: nowISO(), source: 'local', hasPdf: false, evidencias: [], pdfName: null, lattesRef: null,
        };
        item.lattesItem = true;              // mantém relacionado ao Lattes
        item.typeKey = tk;
        item.categoryKey = 'DADOS_GERAIS';
        item.fields = fields;
        item.inLattes = true;
        item.updatedAt = nowISO();

        // Foto de perfil: a imagem é o conteúdo do item (não uma comprovação)
        if (tk === 'FOTO_PERFIL') {
            const inp = form.querySelector('[data-perfil-foto]');
            const file = inp && inp.files[0];
            if (file) {
                const ext = fileExt(file);
                item.evidencias = [{ basename: item.id, ext, name: file.name, publica: true }];
                item.hasPdf = true; item.fileExt = ext; item.pdfName = file.name;
                if (Storage.hasDirectory()) {
                    try { await Storage.writeAttachment(item.id, file, LattesTypes.categoryFolder('DADOS_GERAIS'), ext); }
                    catch (err) { toast('Falha ao gravar a imagem: ' + err.message, 'aviso'); }
                } else {
                    toast('Imagem não gravada: configure um diretório em Configurações.', 'aviso');
                }
            }
        }

        await persistItem(item);
        toast(`${def.label} salvo.`, 'ok');
        if (encResid) toast(`Atenção: ${encResid} caractere(s) fora do ISO-8859-1 permanecem (ex.: emoji).`, 'aviso');
        renderConfig();
        renderItemList();
    }

    async function renderConfig() {
        const panel = $('#tab-config');
        const dirName = Storage.hasDirectory() ? await Storage.directoryName() : null;

        panel.innerHTML = `
            <div class="space-y-6 max-w-2xl">
                ${perfilSectionHtml()}
                ${importLattesSectionHtml()}
                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-folder-open text-govbr-600 dark:text-unifesp-400"></i> Diretório de arquivos</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Cada item catalogado é salvo aqui como <code class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">ID.pdf</code> +
                        <code class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">ID.json</code>.
                        ${Storage.supportsFS ? '' : '<span class="text-red-600 font-semibold">Seu navegador não suporta esta função — use Chrome ou Edge.</span>'}
                    </p>
                    <p class="text-sm mb-3">Pasta atual: <strong id="dirNameLbl">${dirName ? esc(dirName) : '<em>nenhuma</em>'}</strong></p>
                    <div class="flex flex-wrap gap-2">
                        <button id="btnChooseDir" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm" ${Storage.supportsFS ? '' : 'disabled'}><i class="fa-solid fa-folder mr-1"></i> Escolher pasta</button>
                        <button id="btnSync" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-rotate mr-1"></i> Sincronizar do diretório</button>
                        <button id="btnForget" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-link-slash mr-1"></i> Esquecer pasta</button>
                    </div>
                    <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <h3 class="text-sm font-bold mb-1">Prefixo do identificador dos arquivos</h3>
                        <p class="text-xs text-gray-500 mb-2">Os arquivos são nomeados como <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">prefixo-XXX.pdf</code> (3 alfanuméricos). Prefixo de até 3 caracteres (letras minúsculas/números).</p>
                        <div class="flex items-center gap-2">
                            <input id="idPrefix" type="text" maxlength="3" value="${esc(state.idPrefix)}" class="w-20 text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 font-mono">
                            <span class="text-xs text-gray-500">Exemplo: <code id="idPrefixEx" class="bg-gray-200 dark:bg-gray-700 px-1 rounded">${esc(state.idPrefix)}-k7p</code></span>
                            <button id="btnSavePrefix" class="ml-auto px-3 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-floppy-disk mr-1"></i> Salvar prefixo</button>
                        </div>
                    </div>
                </section>

                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-file-export text-govbr-600 dark:text-unifesp-400"></i> Backup (JSON)</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Exporte ou importe todo o catálogo (metadados) num único arquivo JSON. Com um diretório configurado, o backup é salvo automaticamente na subpasta <code class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">00 - Backup</code>.</p>
                    <div class="flex flex-wrap gap-2">
                        <button id="btnExport" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-download mr-1"></i> Exportar catálogo</button>
                        <label class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm cursor-pointer"><i class="fa-solid fa-upload mr-1"></i> Importar catálogo
                            <input type="file" id="importJson" accept="application/json" class="hidden">
                        </label>
                    </div>
                </section>

                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-language text-govbr-600 dark:text-unifesp-400"></i> Compatibilidade com o Lattes (ISO-8859-1)</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        O Currículo Lattes usa a codificação <code class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">ISO-8859-1</code>.
                        A verificação abaixo aponta caracteres fora dessa tabela (ex.: aspas “curvas”, travessão —, emoji) que,
                        na futura exportação, virariam entidades numéricas. Você pode normalizá-los automaticamente.
                    </p>
                    <div class="flex flex-wrap gap-2">
                        <button id="btnCheckEnc" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-spell-check mr-1"></i> Verificar codificação</button>
                        <button id="btnNormalize" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Normalizar pontuação</button>
                    </div>
                    <div id="encResult" class="text-sm mt-3"></div>
                </section>

                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-list-check text-govbr-600 dark:text-unifesp-400"></i> Listas de autocomplete</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Edite as listas de sugestões dos campos (Instituições, Financiadores/Agências, etc.). Um item por linha —
                        você pode <strong>corrigir</strong>, <strong>remover</strong> ou <strong>inserir</strong>. Valores já usados no
                        catálogo também aparecem automaticamente como sugestão (para corrigir um valor que veio de um item, edite o item).
                    </p>
                    <div class="space-y-2">
                        ${AUTOCOMPLETE_KEYS.map(k => `
                            <details class="border border-gray-200 dark:border-gray-700 rounded">
                                <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center gap-2">
                                    ${esc(VOCAB_LABELS[k] || k)}
                                    <span class="text-xs font-normal text-gray-500">(${collectSuggestions(k).length})</span>
                                </summary>
                                <div class="p-2">
                                    <textarea id="vocab-${k}" rows="6" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 font-mono" placeholder="Um item por linha">${esc(collectSuggestions(k).join('\n'))}</textarea>
                                </div>
                            </details>`).join('')}
                    </div>
                    <div class="flex gap-2 mt-3">
                        <button id="btnSaveVocab" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-floppy-disk mr-1"></i> Salvar listas</button>
                    </div>
                </section>

                <section class="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2 text-red-700 dark:text-red-400"><i class="fa-solid fa-triangle-exclamation"></i> Zona de risco</h2>
                    <button id="btnClear" class="px-3 py-2 rounded bg-red-600 text-white text-sm"><i class="fa-solid fa-trash mr-1"></i> Limpar catálogo (índice local)</button>
                </section>
            </div>`;

        wirePerfilSection();
        $('#xmlInput').addEventListener('change', onXmlSelected);
        $('#idPrefix').addEventListener('input', (e) => {
            $('#idPrefixEx').textContent = `${sanitizePrefix(e.target.value)}-k7p`;
        });
        $('#btnSavePrefix').addEventListener('click', () => {
            state.idPrefix = sanitizePrefix($('#idPrefix').value);
            const s = Storage.loadSettings(); s.idPrefix = state.idPrefix; Storage.saveSettings(s);
            toast(`Prefixo definido: "${state.idPrefix}". Novos arquivos: ${state.idPrefix}-XXX.`, 'ok');
            renderConfig();
        });
        $('#btnChooseDir').addEventListener('click', async () => {
            try {
                await Storage.chooseDirectory();
                await Storage.ensureSubdirs(LattesTypes.allFolders()); // cria as 11 subpastas
                toast('Diretório configurado (subpastas por categoria criadas).', 'ok');
                renderConfig();
            } catch (e) { if (e.name !== 'AbortError') toast(e.message, 'erro'); }
        });
        $('#btnSync').addEventListener('click', async () => {
            try {
                const found = await Storage.scanDirectory();
                const byId = new Map(state.items.map(i => [i.id, i]));
                found.forEach(f => byId.set(f.id, f));
                state.items = Array.from(byId.values());
                saveCatalog();
                toast(`${found.length} arquivo(s) .json lido(s) do diretório.`, 'ok');
                renderItemList();
            } catch (e) { toast(e.message, 'erro'); }
        });
        $('#btnForget').addEventListener('click', async () => { await Storage.forgetDirectory(); toast('Pasta esquecida.', 'ok'); renderConfig(); });

        $('#btnExport').addEventListener('click', exportCatalog);
        $('#importJson').addEventListener('change', importCatalog);
        $('#btnClear').addEventListener('click', () => {
            if (!confirm('Isto apaga o índice local (localStorage). Os arquivos no diretório NÃO são removidos. Continuar?')) return;
            state.items = []; saveCatalog(); toast('Índice local limpo.', 'ok'); renderItemList();
        });
        $('#btnSaveVocab').addEventListener('click', () => {
            AUTOCOMPLETE_KEYS.forEach(k => {
                const ta = $(`#vocab-${k}`);
                if (!ta) return;
                const linhas = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
                state.vocab[k] = Array.from(new Set(linhas)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
            });
            saveVocab();
            toast('Listas de autocomplete salvas.', 'ok');
            renderConfig();
        });
        $('#btnCheckEnc').addEventListener('click', () => verificarCodificacao());
        $('#btnNormalize').addEventListener('click', () => normalizarPontuacao());
    }

    // Varre o catálogo procurando caracteres fora do ISO-8859-1
    function scanEncoding() {
        const problemas = [];
        state.items.forEach(i => {
            const chars = new Set();
            Object.values(i.fields || {}).forEach(v => {
                LzEncoding.findNonLatin1(v).forEach(x => chars.add(x.ch));
            });
            if (chars.size) problemas.push({ item: i, chars: Array.from(chars) });
        });
        return problemas;
    }

    function verificarCodificacao() {
        const box = $('#encResult');
        const probs = scanEncoding();
        if (!probs.length) {
            box.innerHTML = `<p class="text-green-700 dark:text-green-400"><i class="fa-solid fa-circle-check"></i> Todos os ${state.items.length} itens são 100% compatíveis com ISO-8859-1. Prontos para exportar ao Lattes.</p>`;
            return;
        }
        box.innerHTML = `
            <p class="text-amber-700 dark:text-amber-400 mb-2"><i class="fa-solid fa-triangle-exclamation"></i> ${probs.length} item(ns) com caracteres fora do ISO-8859-1:</p>
            <div class="space-y-1 max-h-60 overflow-y-auto">
                ${probs.map(p => `<div class="text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1">
                    <span class="font-medium">${esc(LattesTypes.itemTitle(p.item))}</span>
                    <span class="text-gray-500">— caracteres: ${p.chars.map(c => `<code>${esc(c)}</code>(U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')})`).join(' ')}</span>
                </div>`).join('')}
            </div>
            <p class="text-xs text-gray-500 mt-2">Use “Normalizar pontuação” para converter os casos comuns. Os que restarem serão exportados como entidades numéricas XML (válidas no Lattes).</p>`;
    }

    async function normalizarPontuacao() {
        let alterados = 0;
        state.items.forEach(i => {
            let changed = false;
            Object.keys(i.fields || {}).forEach(k => {
                const orig = i.fields[k];
                if (typeof orig === 'string') {
                    const norm = LzEncoding.normalizePunctuation(orig);
                    if (norm !== orig) { i.fields[k] = norm; changed = true; }
                }
            });
            if (changed) { i.updatedAt = nowISO(); alterados++; }
        });
        if (!alterados) { toast('Nada a normalizar — pontuação já compatível.', 'ok'); verificarCodificacao(); return; }
        saveCatalog();
        // regrava os JSON no diretório, se configurado
        if (Storage.hasDirectory()) {
            for (const i of state.items) {
                try { await Storage.writeJson(i.id, i, LattesTypes.categoryFolder(i.categoryKey)); } catch (_) {}
            }
        }
        toast(`Pontuação normalizada em ${alterados} item(ns).`, 'ok');
        renderItemList();
        verificarCodificacao();
    }

    // Carimbo de data/hora para nomes de arquivo: AAAA-MM-DD_HHMMSS (hora local)
    function fileStamp() {
        const d = new Date(); const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    }
    // Nome-base do backup: latteszen-<Nome completo>-<timestamp>
    // O nome vem do item de Identificação (Dados gerais); se não houver, omite.
    function catalogBaseName() {
        const id = state.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo);
        const nome = id ? String(id.fields.titulo) : '';
        const safe = nome.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
        return safe ? `latteszen-${safe}-${fileStamp()}` : `latteszen-${fileStamp()}`;
    }

    async function exportCatalog() {
        const data = {
            app: 'lattesZen', version: APP_CONFIG.version, exportedAt: nowISO(),
            items: state.items,
        };
        const nome = catalogBaseName();
        // Local padrão: subpasta "00 - Backup" dentro do diretório configurado
        if (Storage.hasDirectory()) {
            try {
                await Storage.writeJson(nome, data, LattesTypes.backupFolder());
                toast(`Backup salvo em "${LattesTypes.backupFolder()}/${nome}.json".`, 'ok');
                return;
            } catch (e) {
                toast('Falha ao salvar no diretório: ' + e.message + ' — baixando arquivo.', 'aviso');
            }
        }
        // Sem diretório (ou falha): baixa o arquivo
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${nome}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    async function importCatalog(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const data = JSON.parse(await file.text());
            const items = Array.isArray(data) ? data : data.items;
            if (!Array.isArray(items)) throw new Error('Formato inválido.');
            const byId = new Map(state.items.map(i => [i.id, i]));
            items.forEach(i => { if (i && i.id) byId.set(i.id, i); });
            state.items = Array.from(byId.values());
            saveCatalog();
            toast(`${items.length} item(ns) importado(s) do JSON.`, 'ok');
            renderItemList();
        } catch (err) { toast('Falha ao importar: ' + err.message, 'erro'); }
        e.target.value = '';
    }

    /* =====================================================================
       Navegação por abas
       ===================================================================== */
    const RENDERERS = {
        catalogar: renderCatalogar, conformidade: renderConformidade,
        config: renderConfig,
    };
    function switchTab(name) {
        $$('.tab-btn').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === name ? 'true' : 'false'));
        $$('.tab-panel').forEach(p => p.hidden = (p.id !== 'tab-' + name));
        RENDERERS[name] && RENDERERS[name]();
    }

    /* =====================================================================
       Rodapé: tema e alto contraste
       ===================================================================== */
    function wireFooterToggles() {
        const htmlEl = document.documentElement;
        const tt = $('#themeToggle');
        const syncTheme = () => {
            const dark = htmlEl.classList.contains('dark');
            tt.setAttribute('aria-pressed', dark ? 'true' : 'false');
            tt.querySelector('i').className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            $('#themeToggleLabel').textContent = dark ? 'Tema claro' : 'Tema escuro';
        };
        syncTheme();
        tt.addEventListener('click', () => {
            htmlEl.classList.toggle('dark');
            localStorage.setItem(APP_CONFIG.storageKeys.theme, htmlEl.classList.contains('dark') ? 'dark' : 'light');
            syncTheme();
        });

        const hc = $('#highContrastToggle');
        const syncHC = () => hc.setAttribute('aria-pressed', htmlEl.classList.contains('high-contrast') ? 'true' : 'false');
        syncHC();
        hc.addEventListener('click', () => {
            htmlEl.classList.toggle('high-contrast');
            localStorage.setItem(APP_CONFIG.storageKeys.highContrast, htmlEl.classList.contains('high-contrast') ? '1' : '0');
            syncHC();
        });
    }

    /* =====================================================================
       Inicialização
       ===================================================================== */
    // Compatibiliza itens salvos antes da reestruturação de categorias
    function migrarItens() {
        let changed = false;
        state.items.forEach(i => {
            if (i.categoryKey === 'NAO_LATTES') { i.categoryKey = 'ATIVIDADES_LIVRES'; changed = true; }
            if (i.lattesItem === false && !i.categoryKey) { i.categoryKey = 'ATIVIDADES_LIVRES'; changed = true; }
            if (i.typeKey) {
                const norm = LattesTypes.normalizeType(i.typeKey);
                if (norm !== i.typeKey) { i.typeKey = norm; changed = true; }
            }
            if (!i.categoryKey && i.typeKey) { i.categoryKey = LattesTypes.primaryCategory(i.typeKey); changed = true; }
            // Migra evidência única (legado) para o novo array de evidências
            if (!Array.isArray(i.evidencias)) {
                if (i.hasPdf) {
                    const ext = i.fileExt || 'pdf';
                    i.evidencias = [{ basename: i.id, ext, name: i.pdfName || `${i.id}.${ext}`, publica: true }];
                } else {
                    i.evidencias = [];
                }
                changed = true;
            }
        });
        if (changed) saveCatalog();
    }

    async function init() {
        // Cabeçalho / rodapé dinâmicos
        const sigla = APP_CONFIG.institution.sigla || '';
        $('#headerSigla').textContent = sigla;
        document.title = `${APP_CONFIG.name} - ${sigla}`;
        $('#appVersion').textContent = APP_CONFIG.version;
        $('#lastModDate').textContent = APP_CONFIG.lastModified;

        wireFooterToggles();

        // Carrega catálogo, vocabulários e restaura diretório
        state.items = Storage.loadCatalog();
        const cfg = Storage.loadSettings();
        state.vocab = cfg.vocab || {};
        state.idPrefix = sanitizePrefix(cfg.idPrefix || 'lz');
        migrarItens();
        try { await Storage.restoreDirectory(); } catch (_) {}

        // Abas
        $$('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
        switchTab('catalogar');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
