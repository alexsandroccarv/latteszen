/* ==========================================================================
   lattesZen — Orquestrador principal (SPA)
   ========================================================================== */
(function () {
    'use strict';

    /* ----------------------------- Estado ------------------------------- */
    const state = {
        items: [],          // catálogo
        editingId: null,    // item em edição
        pendingPdf: null,   // File aguardando gravação
        lattesParsed: null, // resultado do parse do XML
        currentPdfUrl: null,// URL (blob) do PDF exibido no painel lateral
        sortOrder: 'desc',  // ordenação por ano no Catálogo
    };

    /* --------------------------- Utilidades ----------------------------- */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function uid() {
        if (crypto && crypto.randomUUID) return 'lz-' + crypto.randomUUID().slice(0, 8);
        return 'lz-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }
    function nowISO() { return new Date().toISOString(); }

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

    async function persistItem(item, pdfFile) {
        // grava em memória + localStorage
        const idx = state.items.findIndex(i => i.id === item.id);
        if (idx >= 0) state.items[idx] = item; else state.items.push(item);
        saveCatalog();

        // grava arquivos no subdiretório da categoria, se um diretório está configurado
        if (Storage.hasDirectory()) {
            const subdir = LattesTypes.categoryFolder(item.categoryKey);
            try {
                await Storage.writeJson(item.id, item, subdir);
                if (pdfFile) {
                    await Storage.writePdf(item.id, pdfFile, subdir);
                    item.hasPdf = true;
                    item.pdfName = pdfFile.name;
                    saveCatalog();
                    await Storage.writeJson(item.id, item, subdir); // regrava com hasPdf
                }
            } catch (e) {
                toast('Item salvo no índice, mas falhou ao gravar arquivos: ' + e.message, 'aviso');
                return;
            }
        } else if (pdfFile) {
            toast('PDF não gravado: configure um diretório em Configurações.', 'aviso');
        }
    }

    async function deleteItem(id) {
        const item = state.items.find(i => i.id === id);
        state.items = state.items.filter(i => i.id !== id);
        saveCatalog();
        try { await Storage.deleteFiles(id, item ? LattesTypes.categoryFolder(item.categoryKey) : null); } catch (_) {}
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
                    <form id="itemForm" class="space-y-3"></form>
                </section>
                <section class="lg:col-span-3 lg:sticky lg:top-4">
                    <div class="flex items-center justify-between mb-3">
                        <h2 class="text-lg font-bold flex items-center gap-2">
                            <i aria-hidden="true" class="fa-solid fa-file-pdf text-red-600"></i>
                            Visualização do PDF
                        </h2>
                        <div class="flex gap-1">
                            <button type="button" id="pdfNewTab" title="Abrir em nova aba" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hidden"><i class="fa-solid fa-up-right-from-square"></i></button>
                            <button type="button" id="pdfClose" title="Fechar" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hidden"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    </div>
                    <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900" style="height: 85vh; min-height: 560px">
                        <div id="pdfEmpty" class="h-full flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 p-6">
                            <i class="fa-regular fa-file-pdf text-5xl mb-3"></i>
                            <p class="text-sm">O PDF aparece aqui ao anexar um arquivo no formulário<br>ou ao abrir um item com evidência (aba <strong>Catálogo</strong>).</p>
                        </div>
                        <iframe id="pdfFrame" class="w-full h-full hidden" title="Pré-visualização do PDF"></iframe>
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
    function renderCatalogo() {
        const panel = $('#tab-catalogo');
        panel.innerHTML = `
            <div class="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h2 class="text-lg font-bold flex items-center gap-2">
                    <i aria-hidden="true" class="fa-solid fa-list text-govbr-600 dark:text-unifesp-400"></i>
                    Itens catalogados <span id="itemCount" class="text-sm font-normal text-gray-500"></span>
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
            <div class="flex gap-2 mb-3">
                <button id="btnExpandAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Expandir todas</button>
                <button id="btnCollapseAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Recolher todas</button>
            </div>
            <div id="itemList" class="space-y-3"></div>`;
        $('#sortOrder').value = state.sortOrder || 'desc';
        renderItemList();
        $('#filterBox').addEventListener('input', renderItemList);
        $('#sortOrder').addEventListener('change', (e) => { state.sortOrder = e.target.value; renderItemList(); });
        $('#btnExpandAll').addEventListener('click', () => $$('#itemList details').forEach(d => d.open = true));
        $('#btnCollapseAll').addEventListener('click', () => $$('#itemList details').forEach(d => d.open = false));
    }

    /* =====================================================================
       Painel de visualização do PDF (dentro de "Catalogar")
       ===================================================================== */
    function setPdf(url, name) {
        const frame = $('#pdfFrame');
        if (!frame) return; // painel não montado (outra aba ativa)
        if (state.currentPdfUrl && state.currentPdfUrl !== url) {
            try { URL.revokeObjectURL(state.currentPdfUrl); } catch (_) {}
        }
        state.currentPdfUrl = url;
        frame.src = url;
        frame.classList.remove('hidden');
        $('#pdfEmpty').classList.add('hidden');
        $('#pdfClose').classList.remove('hidden');
        $('#pdfNewTab').classList.remove('hidden');
        $('#pdfPanelName').textContent = name || '';
    }
    function clearPdf() {
        const frame = $('#pdfFrame');
        if (state.currentPdfUrl) { try { URL.revokeObjectURL(state.currentPdfUrl); } catch (_) {} state.currentPdfUrl = null; }
        if (!frame) return;
        frame.src = 'about:blank';
        frame.classList.add('hidden');
        $('#pdfEmpty').classList.remove('hidden');
        $('#pdfClose').classList.add('hidden');
        $('#pdfNewTab').classList.add('hidden');
        $('#pdfPanelName').textContent = '';
    }
    function previewPdfFile(file) {
        if (!file) return;
        setPdf(URL.createObjectURL(file), file.name);
    }
    async function showPdfForItem(item) {
        if (!$('#pdfFrame')) return;
        if (!item.hasPdf) { clearPdf(); return; }
        try {
            const url = await Storage.readPdfUrl(item.id, LattesTypes.categoryFolder(item.categoryKey));
            if (url) setPdf(url, item.pdfName || item.id + '.pdf');
            else { clearPdf(); toast('PDF não encontrado no diretório (sincronize a pasta).', 'aviso'); }
        } catch (e) { clearPdf(); }
    }

    function buildForm(item) {
        const form = $('#itemForm');
        const editing = !!item;
        $('#formTitulo').textContent = editing ? 'Editar item' : 'Novo item';

        const isNaoLattes = item ? !item.lattesItem : false;
        const currentType = item ? LattesTypes.normalizeType(item.typeKey) : '';
        const currentCat = item ? (item.categoryKey || LattesTypes.primaryCategory(currentType)) : '';

        form.innerHTML = `
            <div class="bg-govbr-50 dark:bg-gray-900 border border-govbr-100 dark:border-gray-700 rounded px-3 py-2">
                <label class="block text-xs font-semibold mb-1"><i aria-hidden="true" class="fa-solid fa-file-arrow-up text-govbr-600 dark:text-unifesp-400 mr-1"></i> Evidência (PDF)</label>
                <input type="file" id="pdfInput" accept="application/pdf"
                       class="w-full text-sm text-gray-600 dark:text-gray-300 file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-govbr-600 dark:file:bg-unifesp-700 file:text-white">
                <p id="pdfStatus" class="text-xs text-gray-500 mt-1"></p>
            </div>

            <label class="flex items-center gap-2 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
                <input type="checkbox" id="chkNaoLattes" ${isNaoLattes ? 'checked' : ''}>
                <span><i aria-hidden="true" class="fa-solid fa-heart text-amber-600"></i> Item <strong>não-Lattes</strong> (hobby, atividade pessoal, etc.)</span>
            </label>

            <div id="lattesSelectors" class="${isNaoLattes ? 'hidden' : ''} grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs font-semibold mb-1">Categoria</label>
                    <select id="selCategoria" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></select>
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1">Tipo do item (Lattes)</label>
                    <select id="selTipo" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></select>
                </div>
            </div>

            <div id="dynFields" class="space-y-3"></div>

            <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" id="chkInLattes" ${item ? (item.inLattes ? 'checked' : '') : ''}>
                <span>Este item <strong>já consta no Currículo Lattes</strong></span>
            </label>

            <div class="flex gap-2 pt-2">
                <button type="submit" class="px-4 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold hover:opacity-90">
                    <i aria-hidden="true" class="fa-solid fa-floppy-disk mr-1"></i> ${editing ? 'Salvar alterações' : 'Adicionar item'}
                </button>
                <button type="button" id="btnCancelar" class="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm ${editing ? '' : 'hidden'}">Cancelar</button>
            </div>`;

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
            renderDynFields();
        }
        function renderDynFields() {
            const naoLattes = $('#chkNaoLattes').checked;
            const typeKey = naoLattes ? NAO_LATTES_TYPE.key : $('#selTipo').value;
            const def = LattesTypes.get(typeKey);
            const vals = item ? (item.fields || {}) : {};
            $('#dynFields').innerHTML = def.fields.map(f => fieldHtml(f, vals[f.key])).join('');
        }

        selCat.addEventListener('change', fillTipos);
        $('#selTipo') && $('#selTipo').addEventListener('change', renderDynFields);
        fillTipos();

        // Alternar não-Lattes
        $('#chkNaoLattes').addEventListener('change', (e) => {
            $('#lattesSelectors').classList.toggle('hidden', e.target.checked);
            $('#chkInLattes').closest('label').style.display = e.target.checked ? 'none' : '';
            renderDynFields();
        });
        if (isNaoLattes) $('#chkInLattes').closest('label').style.display = 'none';

        // PDF
        const pdfStatus = $('#pdfStatus');
        if (item && item.hasPdf) pdfStatus.textContent = `PDF atual: ${item.pdfName || item.id + '.pdf'}`;
        $('#pdfInput').addEventListener('change', (e) => {
            state.pendingPdf = e.target.files[0] || null;
            pdfStatus.textContent = state.pendingPdf ? `Selecionado: ${state.pendingPdf.name}` : '';
            if (state.pendingPdf) previewPdfFile(state.pendingPdf); // exibe no painel lateral
        });

        // Submit
        form.addEventListener('submit', onSubmitForm);
        $('#btnCancelar').addEventListener('click', () => { state.editingId = null; state.pendingPdf = null; buildForm(); });

        state.editingId = editing ? item.id : null;

        // Painel lateral do PDF: mostra evidência do item em edição, ou limpa
        if (editing && item.hasPdf) showPdfForItem(item);
        else clearPdf();
    }

    // Opções de ano para os seletores (decrescente). Inclui uma folga futura
    // (conclusões previstas) e garante que o valor já salvo apareça, mesmo
    // fora da faixa padrão.
    function yearOptions(val) {
        const atual = new Date().getFullYear();
        const inicio = atual + 5, fim = 1940;
        const anos = [];
        for (let y = inicio; y >= fim; y--) anos.push(y);
        const v = String(val || '').trim();
        if (v && !anos.includes(Number(v)) && /^\d{3,4}$/.test(v)) anos.unshift(Number(v));
        return anos.map(y => `<option value="${y}" ${String(y) === v ? 'selected' : ''}>${y}</option>`).join('');
    }

    function fieldHtml(f, val) {
        val = val == null ? '' : val;
        const req = f.required ? 'required' : '';
        const reqMark = f.required ? ' <span class="text-red-500">*</span>' : '';
        const base = 'w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900';
        let input;
        if (f.type === 'textarea') {
            input = `<textarea name="${f.key}" ${req} rows="2" placeholder="${esc(f.placeholder || '')}" class="${base}">${esc(val)}</textarea>`;
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
        } else {
            const t = (f.type === 'url' ? 'url' : (f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text')));
            input = `<input type="${t}" name="${f.key}" value="${esc(val)}" ${req} placeholder="${esc(f.placeholder || '')}" class="${base}">`;
        }
        return `<div>
            <label class="block text-xs font-semibold mb-1">${esc(f.label)}${reqMark}</label>
            ${input}
            ${f.help ? `<p class="text-xs text-gray-500 mt-0.5">${esc(f.help)}</p>` : ''}
        </div>`;
    }

    async function onSubmitForm(e) {
        e.preventDefault();
        const form = e.target;
        const naoLattes = $('#chkNaoLattes').checked;
        const typeKey = naoLattes ? NAO_LATTES_TYPE.key : $('#selTipo').value;
        const categoryKey = naoLattes ? 'NAO_LATTES' : $('#selCategoria').value;
        const def = LattesTypes.get(typeKey);

        const fields = {};
        def.fields.forEach(f => {
            if (f.type === 'checkboxes') {
                fields[f.key] = $$(`[data-cbgroup="${f.key}"]`, form).filter(c => c.checked).map(c => c.value).join('; ');
            } else if (f.type === 'skilllevels') {
                fields[f.key] = $$(`[data-slgroup="${f.key}"]`, form).filter(s => s.value).map(s => `${s.dataset.skill}: ${s.value}`).join('; ');
            } else {
                const el = form.elements[f.key];
                if (el) fields[f.key] = el.value.trim();
            }
        });

        // validação simples
        const faltando = def.fields.filter(f => f.required && !fields[f.key]);
        if (faltando.length) { toast('Preencha: ' + faltando.map(f => f.label).join(', '), 'aviso'); return; }

        const editing = state.editingId ? state.items.find(i => i.id === state.editingId) : null;
        const item = editing || {
            id: uid(), createdAt: nowISO(),
            source: 'local', hasPdf: false, pdfName: null, lattesRef: null,
        };
        item.lattesItem = !naoLattes;
        item.typeKey = typeKey;
        item.categoryKey = categoryKey;
        item.fields = fields;
        item.inLattes = naoLattes ? false : $('#chkInLattes').checked;
        item.updatedAt = nowISO();

        await persistItem(item, state.pendingPdf);
        toast(editing ? 'Item atualizado.' : 'Item adicionado.', 'ok');

        state.editingId = null; state.pendingPdf = null;
        buildForm();
        renderItemList();
    }

    function statusBadges(item) {
        const b = [];
        if (item.lattesItem) {
            b.push(item.inLattes
                ? '<span class="badge bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"><i class="fa-solid fa-check"></i> No Lattes</span>'
                : '<span class="badge bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"><i class="fa-solid fa-triangle-exclamation"></i> Falta no Lattes</span>');
        } else {
            b.push('<span class="badge bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"><i class="fa-solid fa-heart"></i> Não-Lattes</span>');
        }
        b.push(item.hasPdf
            ? '<span class="badge bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"><i class="fa-solid fa-file-pdf"></i> Comprovado</span>'
            : '<span class="badge bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"><i class="fa-solid fa-file-circle-xmark"></i> Sem PDF</span>');
        return b.join(' ');
    }

    function itemYear(i) {
        const y = (i.fields && (i.fields.ano || i.fields.anoFim || i.fields.anoInicio)) || '';
        const n = parseInt(String(y).replace(/\D/g, '').slice(0, 4), 10);
        return isNaN(n) ? null : n;
    }

    function itemCardHtml(i) {
        return `
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <p class="font-semibold text-sm truncate">${esc(LattesTypes.itemTitle(i))}</p>
                        <p class="text-xs text-gray-500">${esc(LattesTypes.label(i.typeKey))} ${i.fields.ano ? '· ' + esc(i.fields.ano) : ''}</p>
                        <div class="mt-1.5 flex flex-wrap gap-1">${statusBadges(i)}</div>
                    </div>
                    <div class="flex gap-1 shrink-0">
                        ${i.hasPdf ? `<button data-act="pdf" data-id="${i.id}" title="Ver PDF no painel (Catalogar)" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"><i class="fa-solid fa-file-pdf"></i></button>` : ''}
                        <button data-act="edit" data-id="${i.id}" title="Abrir / Editar" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-govbr-600 dark:text-unifesp-400"><i class="fa-solid fa-pen"></i></button>
                        <button data-act="del" data-id="${i.id}" title="Excluir" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
    }

    function renderItemList() {
        const list = $('#itemList');
        if (!list) return; // aba Catálogo não está montada
        const q = ($('#filterBox') && $('#filterBox').value || '').toLowerCase();
        const asc = (state.sortOrder || 'desc') === 'asc';
        $('#itemCount').textContent = `(${state.items.length})`;

        let items = state.items.slice();
        if (q) items = items.filter(i => (LattesTypes.itemTitle(i) + ' ' + LattesTypes.label(i.typeKey) + ' ' + LattesTypes.categoryLabel(i.categoryKey)).toLowerCase().includes(q));

        if (!items.length) {
            list.innerHTML = `<p class="text-sm text-gray-500 italic py-6 text-center">${state.items.length ? 'Nenhum item corresponde ao filtro.' : 'Nenhum item ainda. Adicione pelo formulário ou importe o XML do Lattes.'}</p>`;
            return;
        }

        // Ordenação por ano (com/sem ano); desempate por data de atualização
        items.sort((a, b) => {
            const ya = itemYear(a), yb = itemYear(b);
            if (ya !== yb) {
                if (ya == null) return 1;              // sem ano vai para o fim
                if (yb == null) return -1;
                return asc ? ya - yb : yb - ya;
            }
            return (b.updatedAt || '').localeCompare(a.updatedAt || '');
        });

        // Agrupa por categoria, na ordem oficial (01..11) + Não-Lattes
        const order = LattesTypes.categories.map(c => c.key).concat('NAO_LATTES');
        const groups = {};
        items.forEach(i => { (groups[i.categoryKey] = groups[i.categoryKey] || []).push(i); });

        list.innerHTML = order.filter(k => groups[k] && groups[k].length).map(k => {
            const g = groups[k];
            return `
            <details open class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <summary class="cursor-pointer select-none px-3 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-sm flex items-center gap-2">
                    <i aria-hidden="true" class="fa-solid ${esc((LattesTypes.categoryByKey(k) || {}).icon || 'fa-folder')} text-govbr-600 dark:text-unifesp-400"></i>
                    ${esc(LattesTypes.categoryNumLabel(k))}
                    <span class="text-xs font-normal text-gray-500">(${g.length})</span>
                </summary>
                <div class="p-2 space-y-2">${g.map(itemCardHtml).join('')}</div>
            </details>`;
        }).join('');

        $$('#itemList [data-act]').forEach(btn => btn.addEventListener('click', onItemAction));
    }

    async function onItemAction(e) {
        const btn = e.currentTarget;
        const id = btn.dataset.id;
        const item = state.items.find(i => i.id === id);
        if (!item) return;
        if (btn.dataset.act === 'edit' || btn.dataset.act === 'pdf') {
            // Abre o item na aba Catalogar; o PDF (se houver) aparece no painel lateral
            state.pendingPdf = null;
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
       ABA: IMPORTAR LATTES (XML)
       ===================================================================== */
    function renderLattes() {
        const panel = $('#tab-lattes');
        panel.innerHTML = `
            <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
                <h2 class="text-lg font-bold mb-2 flex items-center gap-2">
                    <i aria-hidden="true" class="fa-solid fa-file-import text-govbr-600 dark:text-unifesp-400"></i> Importar Currículo Lattes (XML)
                </h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Exporte seu currículo em XML na Plataforma Lattes (Menu <em>&rarr; Exportar &rarr; XML</em>) e selecione o arquivo abaixo.
                    Os itens serão listados para você escolher quais importar; cada um poderá receber um PDF depois.
                </p>
                <input type="file" id="xmlInput" accept=".xml,application/xml,text/xml"
                       class="text-sm file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-govbr-600 dark:file:bg-unifesp-700 file:text-white">
            </section>
            <div id="xmlResult"></div>`;
        $('#xmlInput').addEventListener('change', onXmlSelected);
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
        const resumo = Object.entries(res.summary)
            .map(([k, n]) => `<span class="badge bg-govbr-50 text-govbr-700 dark:bg-gray-700 dark:text-gray-200">${esc(LattesTypes.label(k))}: ${n}</span>`).join(' ');

        box.innerHTML = `
            <div class="mb-3">
                ${res.titular ? `<p class="text-sm mb-1">Titular: <strong>${esc(res.titular)}</strong></p>` : ''}
                <div class="flex flex-wrap gap-1">${resumo}</div>
            </div>
            <div class="flex items-center gap-2 mb-2">
                <button id="btnSelAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Selecionar todos</button>
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

        $('#btnSelAll').addEventListener('click', () => $$('.xmlchk').forEach(c => c.checked = true));
        $('#btnSelNone').addEventListener('click', () => $$('.xmlchk').forEach(c => c.checked = false));
        $('#btnImport').addEventListener('click', importSelected);
    }

    async function importSelected() {
        const chosen = $$('.xmlchk').filter(c => c.checked).map(c => parseInt(c.dataset.idx, 10));
        if (!chosen.length) { toast('Nenhum item selecionado.', 'aviso'); return; }
        const existingRefs = new Set(state.items.map(i => i.lattesRef).filter(Boolean));
        let n = 0;
        for (const idx of chosen) {
            const src = state.lattesParsed.items[idx];
            if (existingRefs.has(src.lattesRef)) continue;
            const item = {
                id: uid(), createdAt: nowISO(), updatedAt: nowISO(),
                lattesItem: true, typeKey: src.typeKey,
                categoryKey: src.categoryKey || LattesTypes.primaryCategory(src.typeKey),
                fields: src.fields,
                source: 'lattes', inLattes: true, lattesRef: src.lattesRef,
                hasPdf: false, pdfName: null,
            };
            await persistItem(item, null);
            existingRefs.add(src.lattesRef);
            n++;
        }
        toast(`${n} item(ns) importado(s) do Lattes.`, 'ok');
        renderXmlResult(state.lattesParsed);
        renderItemList();
    }

    /* =====================================================================
       ABA: RELATÓRIO / CONFORMIDADE
       ===================================================================== */
    function renderRelatorio() {
        const panel = $('#tab-relatorio');
        const lattesSemPdf = state.items.filter(i => i.lattesItem && i.inLattes && !i.hasPdf);
        const localForaLattes = state.items.filter(i => i.lattesItem && !i.inLattes);
        const comprovados = state.items.filter(i => i.lattesItem && i.inLattes && i.hasPdf);
        const naoLattes = state.items.filter(i => !i.lattesItem);

        const total = state.items.filter(i => i.lattesItem && i.inLattes).length;
        const pct = total ? Math.round(comprovados.length / total * 100) : 0;

        const card = (cor, icone, titulo, valor, desc) => `
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div class="flex items-center gap-2 text-${cor}-600 dark:text-${cor}-400">
                    <i class="fa-solid ${icone} text-xl"></i><span class="text-2xl font-bold">${valor}</span>
                </div>
                <p class="text-sm font-semibold mt-1">${titulo}</p>
                <p class="text-xs text-gray-500">${desc}</p>
            </div>`;

        const lista = (arr, vazio) => arr.length ? `
            <div class="space-y-1">${arr.map(i => `
                <div class="flex items-center justify-between gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm">
                    <span class="min-w-0"><span class="font-medium">${esc(LattesTypes.itemTitle(i))}</span>
                        <span class="block text-xs text-gray-500">${esc(LattesTypes.label(i.typeKey))} ${i.fields.ano ? '· ' + esc(i.fields.ano) : ''}</span></span>
                    <button data-goto="${i.id}" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 shrink-0">Abrir</button>
                </div>`).join('')}</div>`
            : `<p class="text-sm text-gray-500 italic">${vazio}</p>`;

        panel.innerHTML = `
            <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                ${card('green', 'fa-circle-check', 'Comprovados', comprovados.length, 'No Lattes e com PDF')}
                ${card('amber', 'fa-triangle-exclamation', 'Sem comprovação', lattesSemPdf.length, 'No Lattes, sem PDF')}
                ${card('blue', 'fa-clock', 'Fora do Lattes', localForaLattes.length, 'Cadastrados, ainda não no Lattes')}
                ${card('purple', 'fa-heart', 'Não-Lattes', naoLattes.length, 'Itens pessoais')}
            </div>

            <div class="mb-6">
                <div class="flex justify-between text-sm mb-1"><span class="font-semibold">Conformidade documental</span><span>${pct}%</span></div>
                <div class="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full bg-green-500" style="width:${pct}%"></div>
                </div>
            </div>

            <div class="grid lg:grid-cols-2 gap-6">
                <section>
                    <h3 class="font-bold mb-2 flex items-center gap-2 text-amber-600"><i class="fa-solid fa-triangle-exclamation"></i> Itens do Lattes SEM evidência (PDF)</h3>
                    ${lista(lattesSemPdf, 'Tudo comprovado! 🎉')}
                </section>
                <section>
                    <h3 class="font-bold mb-2 flex items-center gap-2 text-blue-600"><i class="fa-solid fa-clock"></i> Cadastrados que ainda NÃO estão no Lattes</h3>
                    ${lista(localForaLattes, 'Nenhum item pendente de inclusão no Lattes.')}
                </section>
            </div>

            <div class="mt-6 flex gap-2">
                <button id="btnImprimir" class="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-print mr-1"></i> Imprimir / PDF</button>
            </div>`;

        $$('#tab-relatorio [data-goto]').forEach(b => b.addEventListener('click', () => {
            const item = state.items.find(i => i.id === b.dataset.goto);
            switchTab('catalogar');
            buildForm(item);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }));
        $('#btnImprimir').addEventListener('click', () => window.print());
    }

    /* =====================================================================
       ABA: CONFIGURAÇÕES
       ===================================================================== */
    async function renderConfig() {
        const panel = $('#tab-config');
        const dirName = Storage.hasDirectory() ? await Storage.directoryName() : null;

        panel.innerHTML = `
            <div class="space-y-6 max-w-2xl">
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
                </section>

                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-file-export text-govbr-600 dark:text-unifesp-400"></i> Backup (JSON)</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Exporte ou importe todo o catálogo (metadados) num único arquivo JSON.</p>
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

                <section class="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2 text-red-700 dark:text-red-400"><i class="fa-solid fa-triangle-exclamation"></i> Zona de risco</h2>
                    <button id="btnClear" class="px-3 py-2 rounded bg-red-600 text-white text-sm"><i class="fa-solid fa-trash mr-1"></i> Limpar catálogo (índice local)</button>
                </section>
            </div>`;

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

    function exportCatalog() {
        const data = {
            app: 'lattesZen', version: APP_CONFIG.version, exportedAt: nowISO(),
            items: state.items,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `latteszen-catalogo-${new Date().toISOString().slice(0, 10)}.json`;
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
        catalogar: renderCatalogar, catalogo: renderCatalogo, lattes: renderLattes,
        relatorio: renderRelatorio, config: renderConfig,
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
            if (i.lattesItem === false && !i.categoryKey) { i.categoryKey = 'NAO_LATTES'; changed = true; }
            if (i.typeKey) {
                const norm = LattesTypes.normalizeType(i.typeKey);
                if (norm !== i.typeKey) { i.typeKey = norm; changed = true; }
            }
            if (!i.categoryKey && i.typeKey) { i.categoryKey = LattesTypes.primaryCategory(i.typeKey); changed = true; }
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

        // Carrega catálogo e restaura diretório
        state.items = Storage.loadCatalog();
        migrarItens();
        try { await Storage.restoreDirectory(); } catch (_) {}

        // Abas
        $$('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
        switchTab('catalogar');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
