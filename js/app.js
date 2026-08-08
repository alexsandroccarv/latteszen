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

        // grava arquivos no diretório, se configurado
        if (Storage.hasDirectory()) {
            try {
                await Storage.writeJson(item.id, item);
                if (pdfFile) {
                    await Storage.writePdf(item.id, pdfFile);
                    item.hasPdf = true;
                    item.pdfName = pdfFile.name;
                    saveCatalog();
                    await Storage.writeJson(item.id, item); // regrava com hasPdf
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
        state.items = state.items.filter(i => i.id !== id);
        saveCatalog();
        try { await Storage.deleteFiles(id); } catch (_) {}
    }

    /* =====================================================================
       ABA: CATALOGAR
       ===================================================================== */
    function renderCatalogar() {
        const panel = $('#tab-catalogar');
        panel.innerHTML = `
            <div class="grid lg:grid-cols-2 gap-6">
                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-3 flex items-center gap-2">
                        <i aria-hidden="true" class="fa-solid fa-file-circle-plus text-govbr-600 dark:text-unifesp-400"></i>
                        <span id="formTitulo">Novo item</span>
                    </h2>
                    <form id="itemForm" class="space-y-3"></form>
                </section>
                <section>
                    <div class="flex items-center justify-between mb-3">
                        <h2 class="text-lg font-bold flex items-center gap-2">
                            <i aria-hidden="true" class="fa-solid fa-list text-govbr-600 dark:text-unifesp-400"></i>
                            Itens catalogados <span id="itemCount" class="text-sm font-normal text-gray-500"></span>
                        </h2>
                        <input id="filterBox" type="search" placeholder="Filtrar..."
                               class="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                    </div>
                    <div id="itemList" class="space-y-2 scroll-area max-h-[70vh] overflow-y-auto pr-1"></div>
                </section>
            </div>`;

        buildForm();
        renderItemList();
        $('#filterBox').addEventListener('input', renderItemList);
    }

    function buildForm(item) {
        const form = $('#itemForm');
        const editing = !!item;
        $('#formTitulo').textContent = editing ? 'Editar item' : 'Novo item';

        const isNaoLattes = item ? !item.lattesItem : false;
        const currentType = item ? item.typeKey : '';
        const currentCat = item ? (LattesTypes.get(item.typeKey) || {}).categoryKey : '';

        form.innerHTML = `
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

            <div>
                <label class="block text-xs font-semibold mb-1">Evidência (PDF)</label>
                <input type="file" id="pdfInput" accept="application/pdf"
                       class="w-full text-sm text-gray-600 dark:text-gray-300 file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-govbr-600 dark:file:bg-unifesp-700 file:text-white">
                <p id="pdfStatus" class="text-xs text-gray-500 mt-1"></p>
            </div>

            <div class="flex gap-2 pt-2">
                <button type="submit" class="px-4 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold hover:opacity-90">
                    <i aria-hidden="true" class="fa-solid fa-floppy-disk mr-1"></i> ${editing ? 'Salvar alterações' : 'Adicionar item'}
                </button>
                <button type="button" id="btnCancelar" class="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm ${editing ? '' : 'hidden'}">Cancelar</button>
            </div>`;

        // Preencher selects de categoria/tipo
        const selCat = $('#selCategoria');
        selCat.innerHTML = LattesTypes.categories.map(c => `<option value="${c.key}">${esc(c.label)}</option>`).join('');
        if (currentCat) selCat.value = currentCat;

        function fillTipos() {
            const cat = LattesTypes.categories.find(c => c.key === selCat.value);
            $('#selTipo').innerHTML = cat.types.map(t => `<option value="${t.key}">${esc(t.label)}</option>`).join('');
            if (currentType && cat.types.some(t => t.key === currentType)) $('#selTipo').value = currentType;
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
        });

        // Submit
        form.addEventListener('submit', onSubmitForm);
        $('#btnCancelar').addEventListener('click', () => { state.editingId = null; state.pendingPdf = null; buildForm(); });

        state.editingId = editing ? item.id : null;
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
        } else {
            const t = f.type === 'year' ? 'text' : (f.type === 'url' ? 'url' : (f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text')));
            const extra = f.type === 'year' ? 'inputmode="numeric" maxlength="4" pattern="[0-9]{4}"' : '';
            input = `<input type="${t}" name="${f.key}" value="${esc(val)}" ${req} ${extra} placeholder="${esc(f.placeholder || '')}" class="${base}">`;
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
        const def = LattesTypes.get(typeKey);

        const fields = {};
        def.fields.forEach(f => {
            const el = form.elements[f.key];
            if (el) fields[f.key] = el.value.trim();
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

    function renderItemList() {
        const list = $('#itemList');
        const q = ($('#filterBox') && $('#filterBox').value || '').toLowerCase();
        $('#itemCount').textContent = `(${state.items.length})`;

        let items = state.items.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        if (q) items = items.filter(i => (LattesTypes.itemTitle(i) + ' ' + LattesTypes.label(i.typeKey)).toLowerCase().includes(q));

        if (!items.length) {
            list.innerHTML = `<p class="text-sm text-gray-500 italic py-6 text-center">Nenhum item ainda. Adicione pelo formulário ou importe o XML do Lattes.</p>`;
            return;
        }
        list.innerHTML = items.map(i => `
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <p class="font-semibold text-sm truncate">${esc(LattesTypes.itemTitle(i))}</p>
                        <p class="text-xs text-gray-500">${esc(LattesTypes.label(i.typeKey))} ${i.fields.ano ? '· ' + esc(i.fields.ano) : ''}</p>
                        <div class="mt-1.5 flex flex-wrap gap-1">${statusBadges(i)}</div>
                    </div>
                    <div class="flex gap-1 shrink-0">
                        ${i.hasPdf ? `<button data-act="pdf" data-id="${i.id}" title="Abrir PDF" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"><i class="fa-solid fa-file-pdf"></i></button>` : ''}
                        <button data-act="edit" data-id="${i.id}" title="Editar" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-govbr-600 dark:text-unifesp-400"><i class="fa-solid fa-pen"></i></button>
                        <button data-act="del" data-id="${i.id}" title="Excluir" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>`).join('');

        $$('#itemList [data-act]').forEach(btn => btn.addEventListener('click', onItemAction));
    }

    async function onItemAction(e) {
        const btn = e.currentTarget;
        const id = btn.dataset.id;
        const item = state.items.find(i => i.id === id);
        if (!item) return;
        if (btn.dataset.act === 'edit') {
            state.pendingPdf = null;
            buildForm(item);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (btn.dataset.act === 'del') {
            if (!confirm(`Excluir "${LattesTypes.itemTitle(item)}"? Os arquivos ${id}.pdf/.json também serão removidos.`)) return;
            await deleteItem(id);
            toast('Item excluído.', 'ok');
            renderItemList();
        } else if (btn.dataset.act === 'pdf') {
            try {
                const url = await Storage.readPdfUrl(id);
                if (url) window.open(url, '_blank');
                else toast('PDF não encontrado no diretório.', 'aviso');
            } catch (err) { toast(err.message, 'erro'); }
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
        const text = await file.text();
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
                lattesItem: true, typeKey: src.typeKey, fields: src.fields,
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

                <section class="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2 text-red-700 dark:text-red-400"><i class="fa-solid fa-triangle-exclamation"></i> Zona de risco</h2>
                    <button id="btnClear" class="px-3 py-2 rounded bg-red-600 text-white text-sm"><i class="fa-solid fa-trash mr-1"></i> Limpar catálogo (índice local)</button>
                </section>
            </div>`;

        $('#btnChooseDir').addEventListener('click', async () => {
            try { await Storage.chooseDirectory(); toast('Diretório configurado.', 'ok'); renderConfig(); }
            catch (e) { if (e.name !== 'AbortError') toast(e.message, 'erro'); }
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
        catalogar: renderCatalogar, lattes: renderLattes,
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
        try { await Storage.restoreDirectory(); } catch (_) {}

        // Abas
        $$('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
        switchTab('catalogar');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
