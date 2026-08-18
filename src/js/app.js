/* ==========================================================================
   lattesZen — Orquestrador principal (SPA)
   ========================================================================== */
(function () {
    'use strict';

    // Versão do esquema dos itens (carimbada em cada item para migrações futuras)
    const SCHEMA_VERSION = 2;
    // Valor sentinela "Não se aplica" (campos URL): conta como preenchido na
    // conformidade, mas na futura exportação XML do Lattes deve ir EM BRANCO.
    const NA_VALUE = 'Não se aplica';
    // Converte um valor para exportação XML (N/A vira branco). Uso futuro.
    function xmlExportValue(v) { return v === NA_VALUE ? '' : v; }

    /* ----------------------------- Estado ------------------------------- */
    const state = {
        items: [],          // catálogo
        editingId: null,    // item em edição
        evEditing: [],      // evidências do item em edição (array de trabalho)
        lattesParsed: null, // resultado do parse do XML
        currentPdfUrl: null,// URL (blob) do PDF exibido no painel lateral
        sortOrder: 'desc',  // ordenação por ano na Conformidade
        viewFilter: 'todos',// recorte da lista (todos/comprovados/semPdf/naoLattes/descObrig)
        formDirty: false,   // há edições não salvas no formulário de Catalogar?
        saveAndNew: false,  // flag do botão "Salvar e novo"
        activeTab: 'catalogar',
        lastCat: '', lastType: '', // última categoria/tipo usados (agiliza cadastro em série)
        vocab: {},          // listas curadas de autocomplete (por chave de campo)
        idPrefix: 'lz',     // prefixo do ID dos arquivos (configurável, até 3 chars)
        rscEnabled: false,  // módulo RSC-PCCTAE habilitado?
        rscCfg: {},         // dados funcionais do servidor (cargo, escolaridade, etc.)
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

    // Extrai o ANO de um campo de data completa (dd/mm/aaaa, mm/aaaa ou aaaa).
    // Usado em toda parte que precisa só do ano (dedup, ordenação, RSC) — o
    // valor guardado pode ter dia/mês, mas eles nunca vão para o XML Lattes.
    function anoDe(v) { const m = String(v == null ? '' : v).match(/\d{4}/); return m ? m[0] : ''; }

    // Extensão do anexo a partir do tipo MIME / nome do arquivo
    const MIME_EXT = {
        'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
        'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-msvideo': 'avi', 'video/x-matroska': 'mkv',
        'application/zip': 'zip', 'application/x-zip-compressed': 'zip', 'application/gzip': 'gz', 'application/x-gzip': 'gz', 'application/x-tar': 'tar',
    };
    function fileExt(file) {
        const t = (file.type || '').toLowerCase();
        if (MIME_EXT[t]) return MIME_EXT[t];
        const m = (file.name || '').match(/\.(\w+)$/);
        return m ? m[1].toLowerCase() : 'pdf';
    }
    function isImageExt(ext) { return /^(jpe?g|png|gif|webp)$/i.test(ext || ''); }
    function isVideoExt(ext) { return /^(mp4|webm|mov|avi|mkv)$/i.test(ext || ''); }
    function isArchiveExt(ext) { return /^(zip|tar|gz|tgz)$/i.test(ext || ''); }

    // Extensões de evidência aceitas por tipo de item (accept do <input file>).
    // Os dois tipos restritos a documento/foto continuam só PDF/imagem; os
    // demais aceitam o conjunto amplo (PDF, imagem, vídeo, zip/tar.gz).
    const EVID_EXTS_DEFAULT = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'avi', 'mkv', 'zip', 'tar', 'gz'];
    const EVID_ACCEPT_DEFAULT = 'application/pdf,image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,application/zip,application/x-zip-compressed,application/gzip,application/x-gzip,application/x-tar';
    function allowedExtsForAccept(acc) {
        if (acc === 'image/jpeg,image/png') return ['jpg', 'jpeg', 'png'];
        if (acc === 'application/pdf,image/jpeg,image/png') return ['pdf', 'jpg', 'jpeg', 'png'];
        return EVID_EXTS_DEFAULT;
    }

    // Validação do arquivo de evidência: vazio, tamanho e tipo permitido.
    // Retorna null se OK ou uma mensagem de erro.
    const MAX_EVID_MB = 40;
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
    // Grava o índice no localStorage protegendo contra estouro de cota.
    function saveCatalog() {
        try { Storage.saveCatalog(state.items); return true; }
        catch (e) {
            toast('Não foi possível salvar no navegador (armazenamento cheio). Exporte um backup em Configurações e/ou remova itens.', 'erro');
            return false;
        }
    }
    function saveVocab() {
        const s = Storage.loadSettings();
        s.vocab = state.vocab;
        Storage.saveSettings(s);
    }

    // Lembrete de backup: conta gravações desde o último export e avisa a cada 20.
    function bumpBackupReminder() {
        const s = Storage.loadSettings();
        s.sinceBackup = (s.sinceBackup || 0) + 1;
        Storage.saveSettings(s);
        if (s.sinceBackup % 20 === 0) {
            toast(`Você fez ${s.sinceBackup} alterações desde o último backup. Exporte o catálogo em Configurações › Backup.`, 'aviso');
        }
    }
    function resetBackupReminder() {
        const s = Storage.loadSettings(); s.sinceBackup = 0; Storage.saveSettings(s);
    }

    /* --------- Rascunho automático do formulário (apenas item NOVO) --------- */
    const DRAFT_KEY = 'lz_draft';
    let draftTimer = null;
    function saveDraftDebounced() {
        if (state.editingId) return;                 // não rascunha edição de item existente
        clearTimeout(draftTimer);
        draftTimer = setTimeout(() => {
            const form = $('#itemForm'); if (!form) return;
            const def = LattesTypes.get($('#selTipo').value); if (!def) return;
            const fields = collectFields(form, def);
            const temConteudo = Object.values(fields).some(v => String(v || '').trim());
            if (!temConteudo) { try { localStorage.removeItem(DRAFT_KEY); } catch (_) {} return; }
            try {
                localStorage.setItem(DRAFT_KEY, JSON.stringify({
                    cat: $('#selCategoria').value, type: $('#selTipo').value, fields,
                }));
            } catch (_) {}
        }, 500);
    }
    function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (_) {} const b = $('#draftBanner'); if (b) b.innerHTML = ''; }
    function loadDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) { return null; } }
    function maybeShowDraftBanner() {
        const bn = $('#draftBanner'); if (!bn) return;
        const d = state.editingId ? null : loadDraft();
        if (!d || !d.fields) { bn.innerHTML = ''; return; }
        const label = LattesTypes.label(d.type) || '';
        bn.innerHTML = `<div class="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-3 py-2 mb-3">
            <i aria-hidden="true" class="fa-solid fa-clock-rotate-left text-amber-600 shrink-0"></i>
            <span class="flex-1">Rascunho não salvo encontrado${label ? ` (${esc(label)})` : ''}. As evidências não ficam no rascunho.</span>
            <button type="button" id="btnDraftRestore" class="px-2 py-1 rounded bg-amber-600 text-white shrink-0">Restaurar</button>
            <button type="button" id="btnDraftDiscard" class="px-2 py-1 rounded border border-amber-300 dark:border-amber-700 shrink-0">Descartar</button>
        </div>`;
        $('#btnDraftRestore').addEventListener('click', () => restoreDraft(d));
        $('#btnDraftDiscard').addEventListener('click', clearDraft);
    }
    function restoreDraft(d) {
        clearDraft();
        buildForm(undefined, { focus: false });
        const selCat = $('#selCategoria');
        if (d.cat) { selCat.value = d.cat; selCat.dispatchEvent(new Event('change')); }
        if (d.type && state._selectTipo) state._selectTipo(d.type);   // seleciona o tipo do rascunho
        const form = $('#itemForm');
        Object.entries(d.fields || {}).forEach(([k, v]) => {
            // Campo URL marcado "Não se aplica": restaura o checkbox N/A
            const naCb = form.querySelector(`[data-na="${k}"]`);
            if (naCb && v === NA_VALUE) { naCb.checked = true; naCb.dispatchEvent(new Event('change')); return; }
            const el = form.elements[k];
            if (el && el.tagName && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.type !== 'file') el.value = v;
        });
        state.formDirty = true;
        toast('Rascunho restaurado.', 'ok');
    }

    // Grava o item no índice (localStorage) e o JSON no diretório. Os anexos
    // (evidências) são gravados/removidos separadamente em onSubmitForm.
    async function persistItem(item) {
        item.schemaVersion = SCHEMA_VERSION;       // carimba a versão do esquema
        const idx = state.items.findIndex(i => i.id === item.id);
        if (idx >= 0) state.items[idx] = item; else state.items.push(item);
        saveCatalog();
        bumpBackupReminder();
        if (Storage.hasDirectory()) {
            try { await Storage.writeJson(item.id, item, LattesTypes.categoryFolder(item.categoryKey)); }
            catch (e) { toast('Item salvo no índice, mas falhou ao gravar o JSON: ' + e.message, 'aviso'); }
        }
    }

    // Normaliza a lista de evidências de um item (converte formato legado).
    function evListFromItem(item) {
        if (item && Array.isArray(item.evidencias) && item.evidencias.length) {
            return item.evidencias.map(e => e.kind === 'link'
                ? { kind: 'link', basename: null, ext: 'url', url: e.url, name: e.name || e.url, publica: !!e.publica, tag: e.tag || '', file: null }
                : {
                    basename: e.basename, ext: e.ext,
                    name: e.name || `${e.basename}.${e.ext}`, publica: !!e.publica, tag: e.tag || '', file: null,
                });
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
                    <div id="draftBanner"></div>
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
        maybeShowDraftBanner();
        $('#pdfClose').addEventListener('click', clearPdf);
        $('#pdfNewTab').addEventListener('click', () => { if (state.currentPdfUrl) window.open(state.currentPdfUrl, '_blank'); });
    }

    /* =====================================================================
       ABA: CATÁLOGO (lista de itens)
       ===================================================================== */
    // Recortes da lista (cartões de conformidade + filtro da lista)
    const VIEW_META = {
        comprovados:  { cor: 'green', icone: 'fa-circle-check', titulo: 'Comprovados', desc: 'Com evidência anexada' },
        semPdf:       { cor: 'red',   icone: 'fa-file-circle-xmark', titulo: 'Sem evidência', desc: 'Falta anexar comprovação' },
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
        comprovados:    i => i.lattesItem && needsEvidence(i) && i.hasPdf,
        semPdf:         i => i.lattesItem && needsEvidence(i) && !i.hasPdf,
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
        const total = state.items.filter(i => i.lattesItem && needsEvidence(i)).length;
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
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                ${card('comprovados')}${card('semPdf')}${card('naoLattes')}${card('descObrig')}
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
                <div class="print:hidden flex items-center gap-2 flex-wrap">
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
            <div class="print:hidden flex gap-2 mb-3 flex-wrap">
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
        if (ev.kind === 'link') { clearPdf(); return; } // links abrem em nova aba, não pré-visualizam sozinhos
        try {
            const url = await Storage.readAttachmentUrl(ev.basename, LattesTypes.categoryFolder(item.categoryKey), ev.ext);
            if (url) setPdf(url, ev.name, ev.ext);
            else { clearPdf(); toast('Arquivo não encontrado no diretório (sincronize a pasta).', 'aviso'); }
        } catch (e) { clearPdf(); }
    }

    // Pré-visualiza uma evidência (nova ou já gravada) no painel lateral.
    // Evidências do tipo "link" não têm arquivo — abrem direto numa nova aba.
    async function previewEvidence(ev) {
        if (ev.kind === 'link') { window.open(ev.url, '_blank', 'noopener'); return; }
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
        ul.innerHTML = state.evEditing.map((ev, idx) => {
            const thumb = ev.kind === 'link'
                ? `<i aria-hidden="true" class="fa-solid fa-link text-govbr-600 dark:text-unifesp-400 shrink-0 w-8 text-center"></i>`
                : isImageExt(ev.ext)
                    ? (ev.file
                        ? `<img src="${URL.createObjectURL(ev.file)}" class="w-8 h-8 object-cover rounded shrink-0" alt="">`
                        : `<img data-evthumb="${idx}" class="w-8 h-8 object-cover rounded shrink-0 bg-gray-100 dark:bg-gray-700" alt="">`)
                    : isVideoExt(ev.ext)
                        ? `<i aria-hidden="true" class="fa-solid fa-file-video text-purple-600 shrink-0 w-8 text-center"></i>`
                        : isArchiveExt(ev.ext)
                            ? `<i aria-hidden="true" class="fa-solid fa-file-zipper text-amber-600 shrink-0 w-8 text-center"></i>`
                            : `<i aria-hidden="true" class="fa-solid fa-file-pdf text-red-600 shrink-0 w-8 text-center"></i>`;
            return `
            <li class="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm">
                ${thumb}
                <span class="min-w-0 flex-1 truncate" title="${esc(ev.name)}">${esc(ev.name)}${ev.file ? ' <span class="text-xs text-green-600">(novo)</span>' : ''}</span>
                <input type="text" data-evtag="${idx}" list="dl-evidenciaTag" value="${esc(ev.tag || '')}" placeholder="Tag" title="Tag da evidência (ex.: Certificado, Declaração…)" class="w-24 shrink-0 text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                <label class="flex items-center gap-1 text-xs shrink-0" title="Será exibida no futuro módulo de publicação (pode marcar quantas quiser)">
                    <input type="checkbox" data-evpub="${idx}" ${ev.publica ? 'checked' : ''}> pública
                </label>
                <button type="button" data-evup="${idx}" title="Subir" class="w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 shrink-0 disabled:opacity-30" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" data-evdown="${idx}" title="Descer" class="w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 shrink-0 disabled:opacity-30" ${idx === state.evEditing.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <button type="button" data-evsee="${idx}" title="Ver no painel" class="w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-govbr-600 dark:text-unifesp-400 shrink-0"><i class="fa-solid fa-eye"></i></button>
                <button type="button" data-evdel="${idx}" title="Remover" class="w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 shrink-0"><i class="fa-solid fa-xmark"></i></button>
            </li>`;
        }).join('');

        // Miniaturas de imagens já gravadas (carrega do diretório, se houver)
        state.evEditing.forEach(async (ev, idx) => {
            if (!isImageExt(ev.ext) || ev.file) return;
            const el = ul.querySelector(`[data-evthumb="${idx}"]`);
            if (!el) return;
            try {
                const it = state.editingId ? state.items.find(i => i.id === state.editingId) : null;
                const catKey = it ? it.categoryKey : ($('#selCategoria') ? $('#selCategoria').value : null);
                const url = await Storage.readAttachmentUrl(ev.basename, LattesTypes.categoryFolder(catKey), ev.ext);
                if (url) el.src = url;
            } catch (_) {}
        });

        $$('[data-evpub]', ul).forEach(c => c.addEventListener('change', (e) => {
            const i = +e.target.dataset.evpub;
            state.evEditing[i].publica = e.target.checked; // 0..N públicas (independentes)
            state.formDirty = true;
        }));
        $$('[data-evtag]', ul).forEach(inp => inp.addEventListener('input', (e) => {
            const i = +e.target.dataset.evtag;
            state.evEditing[i].tag = e.target.value;
            state.formDirty = true;
        }));
        const swap = (i, j) => { const t = state.evEditing[i]; state.evEditing[i] = state.evEditing[j]; state.evEditing[j] = t; state.formDirty = true; renderEvList(); };
        $$('[data-evup]', ul).forEach(b => b.addEventListener('click', (e) => { const i = +e.currentTarget.dataset.evup; if (i > 0) swap(i, i - 1); }));
        $$('[data-evdown]', ul).forEach(b => b.addEventListener('click', (e) => { const i = +e.currentTarget.dataset.evdown; if (i < state.evEditing.length - 1) swap(i, i + 1); }));
        $$('[data-evsee]', ul).forEach(b => b.addEventListener('click', (e) => previewEvidence(state.evEditing[+e.currentTarget.dataset.evsee])));
        $$('[data-evdel]', ul).forEach(b => b.addEventListener('click', (e) => {
            const i = +e.currentTarget.dataset.evdel;
            const ev = state.evEditing[i];
            if (!confirm(`Remover a evidência "${ev.name}"?`)) return;
            state.evEditing.splice(i, 1); state.formDirty = true; renderEvList();
        }));
    }

    // Adiciona arquivos à lista de evidências (usado por input, arrastar-soltar
    // e colar). Valida cada arquivo e respeita os tipos aceitos pelo tipo atual.
    function addEvidenceFiles(files) {
        const inp = $('#pdfInput');
        const allowed = allowedExtsForAccept(inp ? inp.accept : '');
        // Casa o arquivo anexado com um da bandeja (por nome + tamanho) — assim,
        // mesmo anexando pelo seletor/arrastar, o original é movido p/ Processado.
        const inboxByKey = new Map((state._inbox || []).map(e => [`${e.name}|${e.size}`, e.name]));
        let added = null;
        Array.from(files || []).forEach(f => {
            const err = checkEvidenceFile(f, allowed);
            if (err) { toast(err, 'aviso'); return; }
            const inboxName = inboxByKey.get(`${f.name}|${f.size}`) || null;
            state.evEditing.push({
                basename: null, ext: fileExt(f), name: f.name || `colado.${fileExt(f)}`,
                publica: state.evEditing.length === 0, tag: '', file: f, inboxName,
            });
            added = f;
            state.formDirty = true;
        });
        renderEvList();
        if (added) previewPdfFile(added);
    }

    // Usa um arquivo da bandeja de entrada como evidência (marcando a origem,
    // para mover o original a "Processados" ao salvar o item).
    async function useInboxFile(entry) {
        const inp = $('#pdfInput');
        const allowed = allowedExtsForAccept(inp ? inp.accept : '');
        let file;
        try { file = await Storage.readInboxFile(entry.name); }
        catch (e) { toast('Não foi possível ler o arquivo da bandeja: ' + e.message, 'aviso'); return; }
        const err = checkEvidenceFile(file, allowed);
        if (err) { toast(err, 'aviso'); return; }
        state.evEditing.push({
            basename: null, ext: fileExt(file), name: file.name || entry.name,
            publica: state.evEditing.length === 0, tag: '', file, inboxName: entry.name,
        });
        state.formDirty = true;
        renderEvList();
        previewPdfFile(file);
    }

    // Bandeja de entrada: botão com um badge de contagem (sem listar os
    // arquivos). Clicar no botão anexa o próximo arquivo pendente ainda não
    // usado neste item.
    async function renderInbox() {
        const btn = $('#btnEvInbox'), badge = $('#inboxBadge');
        if (!btn) return;
        if (!Storage.hasDirectory()) {
            btn.disabled = true; btn.classList.add('opacity-40');
            if (badge) badge.classList.add('hidden');
            return;
        }
        let itens = [];
        try { itens = await Storage.listInbox(); } catch (_) { itens = []; }
        state._inbox = itens;
        btn.disabled = !itens.length;
        btn.classList.toggle('opacity-40', !itens.length);
        if (badge) {
            badge.textContent = itens.length ? String(itens.length) : '';
            badge.classList.toggle('hidden', !itens.length);
        }
    }
    // Anexa o próximo arquivo da bandeja que ainda não foi anexado a este item
    async function useNextInbox() {
        const itens = state._inbox || [];
        const staged = new Set(state.evEditing.filter(e => e.inboxName).map(e => e.inboxName));
        const prox = itens.find(it => !staged.has(it.name));
        if (!prox) { toast('Bandeja vazia ou já anexada a este item.', 'info'); return; }
        await useInboxFile(prox);
        await renderInbox();
    }

    // Evidência do tipo "link": não tem arquivo, só uma URL. Aceita o texto
    // sem esquema (adiciona "https://") e valida com o construtor URL.
    function normalizeUrl(raw) {
        let s = String(raw || '').trim();
        if (!s) return null;
        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
        try { new URL(s); return s; } catch (_) { return null; }
    }
    function addUrlEvidence() {
        const inp = $('#evUrlInput');
        const url = normalizeUrl(inp.value);
        if (!url) { toast('Informe um link (URL) válido.', 'aviso'); return; }
        state.evEditing.push({
            kind: 'link', basename: null, ext: 'url', file: null,
            name: url, url, publica: state.evEditing.length === 0, tag: '',
        });
        state.formDirty = true;
        inp.value = '';
        $('#evUrlRow').classList.add('hidden');
        renderEvList();
    }

    // Camada RSC no formulário (abaixo dos campos do item), quando habilitado
    function renderRscBlock(item) {
        const box = $('#rscBlock'); if (!box) return;
        const typeKey = $('#selTipo') ? $('#selTipo').value : '';
        const eligivel = state.rscEnabled && typeKey && !LattesTypes.isPerfilType(typeKey) && !LattesTypes.isNaoLattesType(typeKey);
        if (!eligivel) { box.innerHTML = ''; return; }
        const rsc = (item && item.rsc) || {};
        // Lista única com TODOS os critérios do decreto, agrupados por Requisito
        // (optgroup). Cada opção mostra Item · descrição · unidade · pontuação.
        const critOptgroups = Object.keys(LzRSC.REQUISITOS).map(r => {
            const opts = LzRSC.criteriosDoRequisito(r).map(c =>
                `<option value="${c.id}">${c.item}. ${esc(c.desc)} — ${esc(c.unidade)} · ${String(c.pontos).replace('.', ',')} pts</option>`).join('');
            return `<optgroup label="Requisito ${esc(LzRSC.REQUISITOS[r])}">${opts}</optgroup>`;
        }).join('');
        box.innerHTML = `
        <div class="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded px-3 py-2 space-y-2">
            <label class="flex items-center gap-2 text-sm font-semibold"><i aria-hidden="true" class="fa-solid fa-award text-amber-600"></i>
                <input type="checkbox" id="rscConta" ${rsc.conta ? 'checked' : ''}> Contabilizar este item no RSC-PCCTAE</label>
            <div id="rscFields" class="${rsc.conta ? '' : 'hidden'} space-y-2">
                <div><label class="block text-xs font-semibold mb-1" for="rscCrit">Critério específico (Anexos I–VI do Decreto)</label>
                    <select id="rscCrit" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"><option value="">— selecione o critério —</option>${critOptgroups}</select>
                    <p class="text-[11px] text-gray-500 mt-0.5">Todos os critérios do decreto estão listados, agrupados por Requisito (I a VI).</p></div>
                <p class="text-[11px] text-gray-500"><i aria-hidden="true" class="fa-solid fa-calendar-days mr-1"></i>Para critérios por tempo (ano/mês), o período é calculado a partir dos campos de <strong>data</strong> do item acima (início/fim).</p>
                <div class="grid sm:grid-cols-2 gap-2">
                    <div id="rscPapelWrap" class="hidden"><label class="block text-xs font-semibold mb-1" for="rscPapel">Papel</label>
                        <select id="rscPapel" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                            <option value="titular" ${rsc.papel !== 'substituto' ? 'selected' : ''}>Titular</option>
                            <option value="substituto" ${rsc.papel === 'substituto' ? 'selected' : ''}>Substituto</option></select></div>
                    <div id="rscQtdWrap" class="hidden"><label class="block text-xs font-semibold mb-1" for="rscQtd">Quantidade</label>
                        <input id="rscQtd" type="number" min="0" step="1" value="${esc(rsc.quantidade != null ? rsc.quantidade : 1)}" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></div>
                </div>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="rscInteresse" ${rsc.interesse ? 'checked' : ''}> De interesse institucional</label>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="rscAlem" ${rsc.alemOrdinario ? 'checked' : ''}> Além das atribuições ordinárias do cargo</label>
                <div><label class="block text-xs font-semibold mb-1" for="rscJust">Justificativa (para o memorial)</label>
                    <textarea id="rscJust" rows="2" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">${esc(rsc.justificativa || '')}</textarea></div>
                <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="rscUsado" ${rsc.jaUsado ? 'checked' : ''}> Já utilizado em concessão anterior (não conta no saldo)</label>
                <p id="rscPontos" class="text-sm font-semibold text-amber-700 dark:text-amber-400"></p>
            </div>
        </div>`;

        const conta = $('#rscConta'), fields = $('#rscFields'), critSel = $('#rscCrit');
        function recompute() {
            const crit = LzRSC.criterio(critSel.value);
            $('#rscPapelWrap').classList.toggle('hidden', !(crit && crit.pontosSub != null));
            $('#rscQtdWrap').classList.toggle('hidden', !(crit && crit.calc === 'unidade'));
            const data = collectRsc($('#itemForm'));
            const pi = LzRSC.pontosItem(data);
            const el = $('#rscPontos');
            if (!crit) { el.textContent = 'Selecione o critério para calcular os pontos.'; return; }
            el.textContent = `Pontos: ${String(pi.pontos).replace('.', ',')}  (${pi.quantidade} × ${String(pi.unitario).replace('.', ',')} · ${crit.unidade})`;
        }
        // prefill: seleciona diretamente o critério salvo (lista única com optgroups)
        if (rsc.criterio) critSel.value = rsc.criterio;
        conta.addEventListener('change', () => { fields.classList.toggle('hidden', !conta.checked); state.formDirty = true; recompute(); });
        ['change', 'input'].forEach(ev => $('#rscFields').addEventListener(ev, () => { state.formDirty = true; recompute(); }));
        // O período do RSC vem dos campos de data do item: recalcula ao editá-los.
        const itemForm = $('#itemForm');
        ['anoInicio', 'anoFim', 'ano'].forEach(name => {
            const el = itemForm && itemForm.elements ? itemForm.elements[name] : null;
            if (el && el.addEventListener) el.addEventListener('input', recompute);
        });
        recompute();
    }
    // Normaliza ano/data-completa para dd/mm/aaaa (usado no período do RSC).
    // 'aaaa' vira 01/01/aaaa (início) ou 31/12/aaaa (fim). ISO aaaa-mm-dd também.
    function _rscToBR(v, endOfYear) {
        const s = String(v == null ? '' : v).trim();
        if (!s) return '';
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
        let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        m = s.match(/^(\d{2})\/(\d{4})$/); // mm/aaaa
        if (m) {
            if (!endOfYear) return `01/${m[1]}/${m[2]}`;
            const ultimoDia = new Date(Number(m[2]), Number(m[1]), 0).getDate();
            return `${String(ultimoDia).padStart(2, '0')}/${m[1]}/${m[2]}`;
        }
        m = s.match(/^(\d{4})$/); if (m) return endOfYear ? `31/12/${s}` : `01/01/${s}`;
        return '';
    }
    // Lê a camada RSC do formulário → objeto rsc (ou {conta:false}). O período
    // (início/fim) é derivado dos campos de data do próprio item, não mais de
    // campos de data no bloco RSC (evita redundância).
    function collectRsc(form) {
        const conta = form.querySelector('#rscConta');
        if (!conta) return null;
        const val = id => { const el = form.querySelector('#' + id); return el ? el.value.trim() : ''; };
        const chk = id => { const el = form.querySelector('#' + id); return !!(el && el.checked); };
        const fld = name => { const el = form.elements ? form.elements[name] : null; return (el && typeof el.value === 'string') ? el.value.trim() : ''; };
        return {
            conta: conta.checked,
            criterio: val('rscCrit'),
            dataInicio: _rscToBR(fld('anoInicio'), false),
            dataFim: _rscToBR(fld('anoFim') || fld('ano'), true),
            papel: val('rscPapel') || 'titular',
            quantidade: val('rscQtd') || '',
            interesse: chk('rscInteresse'), alemOrdinario: chk('rscAlem'),
            justificativa: val('rscJust'), jaUsado: chk('rscUsado'),
        };
    }

    function buildForm(item, opts) {
        opts = opts || {};
        const form = $('#itemForm');
        const editing = !!item;
        $('#formTitulo').textContent = editing ? 'Editar item' : 'Novo item';

        let currentType = item ? LattesTypes.normalizeType(item.typeKey) : (state.lastType || '');
        let currentCat = item ? (item.categoryKey || LattesTypes.primaryCategory(currentType))
            : (state.lastCat || (LattesTypes.categories[0] && LattesTypes.categories[0].key));
        if (currentCat === 'NAO_LATTES' || currentCat === 'ATIVIDADES_LIVRES') currentCat = 'AL_DESENVOLVIMENTO'; // legado

        form.innerHTML = `
            <div id="evidenceBlock" class="bg-govbr-50 dark:bg-gray-900 border border-govbr-100 dark:border-gray-700 rounded px-3 py-2 transition-shadow">
                <label class="block text-xs font-semibold mb-2" for="pdfInput"><i aria-hidden="true" class="fa-solid fa-file-arrow-up text-govbr-600 dark:text-unifesp-400 mr-1"></i> <span id="pdfInputLabel">Evidências</span></label>
                <div class="flex items-center gap-2">
                    <button type="button" id="btnEvInbox" title="Bandeja de entrada: anexar próximo arquivo pendente" class="relative w-12 h-12 shrink-0 rounded border border-govbr-200 dark:border-gray-600 text-govbr-700 dark:text-unifesp-300 hover:bg-govbr-100 dark:hover:bg-gray-700 flex items-center justify-center disabled:opacity-40">
                        <i aria-hidden="true" class="fa-solid fa-inbox text-[2em]"></i>
                        <span id="inboxBadge" class="hidden absolute -bottom-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-govbr-600 dark:bg-unifesp-600 text-white text-[10px] leading-4 rounded-full text-center"></span>
                    </button>
                    <button type="button" id="btnEvFiles" title="Escolher arquivos (PDF, imagem, vídeo ou zip/tar.gz)" class="relative w-12 h-12 shrink-0 rounded border border-govbr-200 dark:border-gray-600 text-govbr-700 dark:text-unifesp-300 hover:bg-govbr-100 dark:hover:bg-gray-700 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-magnifying-glass text-[2em]"></i>
                        <i aria-hidden="true" class="fa-solid fa-plus absolute -bottom-1 -right-1 w-3.5 h-3.5 text-[9px] leading-[14px] bg-govbr-600 dark:bg-unifesp-600 text-white rounded-full text-center"></i>
                    </button>
                    <button type="button" id="btnEvUrl" title="Inserir evidência por link (URL)" class="relative w-12 h-12 shrink-0 rounded border border-govbr-200 dark:border-gray-600 text-govbr-700 dark:text-unifesp-300 hover:bg-govbr-100 dark:hover:bg-gray-700 flex items-center justify-center">
                        <i aria-hidden="true" class="fa-solid fa-pen text-[2em]"></i>
                        <span aria-hidden="true" class="absolute -bottom-1.5 -right-1.5 px-1 bg-govbr-600 dark:bg-unifesp-600 text-white text-[8px] leading-[13px] rounded">URL</span>
                    </button>
                </div>
                <input type="file" id="pdfInput" multiple accept="application/pdf,image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,application/zip,application/x-zip-compressed,application/gzip,application/x-gzip,application/x-tar" class="hidden">
                <div id="evUrlRow" class="hidden mt-2 flex gap-1.5">
                    <input type="url" id="evUrlInput" placeholder="https://…" class="flex-1 text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                    <button type="button" id="evUrlAdd" class="text-xs px-2 py-1 rounded bg-govbr-600 dark:bg-unifesp-700 text-white">Adicionar</button>
                    <button type="button" id="evUrlCancel" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Cancelar</button>
                </div>
                <p class="text-xs text-gray-500 mt-2">Arraste e solte, cole (Ctrl+V) ou use os botões acima — PDF, imagem, vídeo, link ou zip/tar.gz. Marque <strong>“pública”</strong> em <em>quantas</em> evidências quiser (0 ou mais). Use ↑ ↓ para reordenar. A <strong>tag</strong> categoriza o documento (ex.: Certificado, Declaração…).</p>
                <ul id="evList" class="mt-2 space-y-1"></ul>
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs font-semibold mb-1" for="selCategoria">Categoria</label>
                    <select id="selCategoria" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></select>
                </div>
                <div>
                    <label class="block text-xs font-semibold mb-1" for="selTipoSearch">Tipo do item</label>
                    <div class="relative">
                        <input type="text" id="selTipoSearch" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="selTipoList" autocomplete="off" placeholder="Buscar tipo…" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                        <input type="hidden" id="selTipo">
                        <ul id="selTipoList" role="listbox" class="hidden absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-lg"></ul>
                    </div>
                </div>
            </div>
            <p id="catNote" class="hidden text-xs text-govbr-700 dark:text-unifesp-300 bg-govbr-50 dark:bg-gray-800 border border-govbr-100 dark:border-gray-700 rounded px-2 py-1.5"></p>

            <div id="dynFields" class="space-y-3"></div>
            <div id="rscBlock" class="space-y-3"></div>

            <div class="space-y-1">
                <label class="block text-xs font-semibold" for="notasGerais">Anotações gerais</label>
                <textarea id="notasGerais" name="notasGerais" rows="3" maxlength="4000" placeholder="Escreva aqui suas conquistas, aprendizados ou impacto da atividade. Este é um campo livre e não será exportado para o Lattes ou publicado." class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">${esc(item && item.notasGerais || '')}</textarea>
            </div>

            <p id="idInfo" class="text-xs text-gray-500"></p>

            <div class="flex gap-2 pt-1 flex-wrap">
                <button type="submit" class="px-4 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold hover:opacity-90">
                    <i aria-hidden="true" class="fa-solid fa-floppy-disk mr-1"></i> ${editing ? 'Salvar alterações' : 'Salvar'}
                </button>
                <button type="button" id="btnSalvarNovo" class="px-4 py-2 rounded border border-govbr-600 dark:border-unifesp-500 text-govbr-700 dark:text-unifesp-300 text-sm font-semibold hover:bg-govbr-50 dark:hover:bg-gray-800" title="Salva e abre um novo item na mesma categoria/tipo">
                    <i aria-hidden="true" class="fa-solid fa-plus mr-1"></i> Salvar e novo
                </button>
                <button type="button" id="btnCancelar" class="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm ${editing ? '' : 'hidden'}">Cancelar</button>
            </div>
            ${datalistsHtml()}`;

        // Categoria (select nativo)
        const selCat = $('#selCategoria');
        selCat.innerHTML = LattesTypes.categories
            .filter(c => !c.rscOnly || state.rscEnabled)   // categoria RSC só com o módulo ligado
            .filter(c => !c.perfilOnly)                     // Fotos de Perfil/Documentos pessoais: só via Configurações
            .map(c => `<option value="${c.key}">${esc(c.num + '. ' + c.label)}</option>`).join('');
        if (currentCat) selCat.value = currentCat;

        // ---- Tipo do item: combobox pesquisável (input + lista + hidden #selTipo) ----
        let tipoOptions = [];
        const tipoOptionsFor = (catKey) => {
            const cat = LattesTypes.categories.find(c => c.key === catKey);
            if (!cat) return [];
            if (cat.groups) return cat.groups.flatMap(g => g.types.map(tk => ({ key: tk, label: LattesTypes.label(tk), group: g.label })));
            return (cat.types || []).map(tk => ({ key: tk, label: LattesTypes.label(tk), group: null }));
        };
        const closeTipoList = () => { const ul = $('#selTipoList'); if (ul) ul.classList.add('hidden'); const s = $('#selTipoSearch'); if (s) s.setAttribute('aria-expanded', 'false'); };
        const openTipoList = () => { $('#selTipoList').classList.remove('hidden'); $('#selTipoSearch').setAttribute('aria-expanded', 'true'); };
        function renderTipoList(q) {
            const ul = $('#selTipoList'); if (!ul) return;
            const nq = normNome(q || '');
            const items = tipoOptions.filter(o => !nq || normNome(o.label).includes(nq));
            if (!items.length) { ul.innerHTML = `<li class="px-2 py-1 text-xs text-gray-400 italic">Nenhum tipo encontrado</li>`; return; }
            let html = '', last = null;
            items.forEach(o => {
                if (o.group && o.group !== last) { html += `<li class="px-2 pt-2 pb-0.5 text-[11px] uppercase tracking-wide text-gray-400">${esc(o.group)}</li>`; last = o.group; }
                const cur = o.key === $('#selTipo').value ? 'bg-govbr-50 dark:bg-gray-700 font-medium' : '';
                html += `<li role="option" data-key="${o.key}" class="px-2 py-1 text-sm cursor-pointer hover:bg-govbr-50 dark:hover:bg-gray-700 ${cur}">${esc(o.label)}</li>`;
            });
            ul.innerHTML = html;
            ul.querySelectorAll('[data-key]').forEach(li => li.addEventListener('mousedown', (ev) => { ev.preventDefault(); selectTipo(li.dataset.key); }));
        }
        function selectTipo(key, silent) {
            $('#selTipo').value = key || '';
            const s = $('#selTipoSearch'); if (s) s.value = key ? LattesTypes.label(key) : '';
            closeTipoList();
            if (!silent) { currentType = key; renderDynFields(); saveDraftDebounced(); }
        }
        state._selectTipo = selectTipo;                  // ponte p/ restaurar rascunho
        function fillTipos() {
            tipoOptions = tipoOptionsFor(selCat.value);
            const valid = currentType && tipoOptions.some(o => o.key === currentType);
            currentType = valid ? currentType : ((tipoOptions[0] && tipoOptions[0].key) || '');
            selectTipo(currentType, true);
            renderDynFields();
            const catNote = $('#catNote');
            if (catNote) {
                const cat = LattesTypes.categoryByKey(selCat.value);
                catNote.textContent = (cat && cat.note) || '';
                catNote.classList.toggle('hidden', !(cat && cat.note));
            }
        }
        function renderDynFields() {
            const def = LattesTypes.get($('#selTipo').value);
            const vals = item ? (item.fields || {}) : {};
            $('#dynFields').innerHTML = (def ? def.fields : []).map(f => fieldHtml(f, vals[f.key])).join('');
            associateLabels($('#dynFields'));           // a11y: label for/id + aria-required
            if (def && def.fields.some(f => f.type === 'areatree')) wireAreaTree($('#dynFields'), vals);
            wireValidators($('#dynFields'));             // ISSN/ISBN/DOI/URL
            wireCounters($('#dynFields'));               // contador de textareas
            wireNA($('#dynFields'));                     // checkbox "N/A" dos campos URL
            wireDateBr($('#dynFields'));                 // máscara dd/mm/aaaa (campos datebr)
            wireConditional($('#dynFields'), def);       // campos bloqueados por condição
            wireDynamicLabels($('#dynFields'), def);     // rótulos que mudam conforme outro campo
            renderRscBlock(item);                        // camada RSC (se habilitado)
            const semEvidencia = !!(def && def.noEvidence);
            $('#evidenceBlock').style.display = semEvidencia ? 'none' : '';
            if (semEvidencia) { state.evEditing = []; renderEvList(); clearPdf(); }
            const accept = (def && def.accept) || EVID_ACCEPT_DEFAULT;
            const inp = $('#pdfInput'); if (inp) inp.accept = accept;
            const lbl = $('#pdfInputLabel');
            if (lbl) lbl.textContent = accept === 'image/jpeg,image/png' ? 'Foto (JPEG ou PNG)'
                : (def && def.key === 'DOCUMENTO_PESSOAL' ? 'Documento (PDF ou imagem)' : 'Evidências (PDF, imagem, vídeo, link ou zip/tar.gz)');
        }

        // Combobox: eventos
        const search = $('#selTipoSearch');
        search.addEventListener('focus', () => { search.value = ''; renderTipoList(''); openTipoList(); });
        search.addEventListener('input', () => { renderTipoList(search.value); openTipoList(); });
        search.addEventListener('blur', () => { setTimeout(() => { closeTipoList(); search.value = LattesTypes.label($('#selTipo').value); }, 150); });
        search.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { closeTipoList(); search.value = LattesTypes.label($('#selTipo').value); search.blur(); }
            else if (e.key === 'Enter') { e.preventDefault(); const first = $('#selTipoList').querySelector('[data-key]'); if (first) { selectTipo(first.dataset.key); search.blur(); } }
        });

        selCat.addEventListener('change', () => { currentType = ''; fillTipos(); saveDraftDebounced(); });
        // Limpa o destaque de erro assim que o usuário corrige o campo
        $('#dynFields').addEventListener('input', (e) => { if (e.target.matches('input,select,textarea')) setFieldError(e.target, ''); });
        $('#dynFields').addEventListener('change', (e) => { if (e.target.matches('input,select,textarea')) setFieldError(e.target, ''); });

        // Evidências: carrega as do item em edição (ou lista vazia p/ novo item)
        state.evEditing = editing ? evListFromItem(item) : [];
        fillTipos();
        renderEvList();

        // Anexo por seletor de arquivos
        $('#pdfInput').addEventListener('change', (e) => { addEvidenceFiles(e.target.files); e.target.value = ''; });
        // Anexo por arrastar-e-soltar
        const drop = $('#evidenceBlock');
        ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => {
            if (drop.style.display === 'none') return;
            e.preventDefault(); drop.classList.add('ring-2', 'ring-govbr-400');
        }));
        ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('ring-2', 'ring-govbr-400'); }));
        drop.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) addEvidenceFiles(e.dataTransfer.files); });
        // Anexo por colar (Ctrl+V) uma imagem/arquivo
        form.addEventListener('paste', (e) => {
            if (drop.style.display === 'none') return;
            const items = e.clipboardData && e.clipboardData.items; if (!items) return;
            const files = [];
            for (const it of items) { if (it.kind === 'file') { const f = it.getAsFile(); if (f) files.push(f); } }
            if (files.length) { e.preventDefault(); addEvidenceFiles(files); }
        });

        // Bandeja de entrada (Caixa de Entrada) — botão com badge: clique anexa o próximo
        $('#btnEvInbox').addEventListener('click', useNextInbox);
        renderInbox();
        // Escolher arquivos: abre o seletor nativo (input file oculto)
        $('#btnEvFiles').addEventListener('click', () => $('#pdfInput').click());
        // Inserir link (URL): abre/fecha a linha de entrada da URL
        $('#btnEvUrl').addEventListener('click', () => {
            const row = $('#evUrlRow');
            row.classList.toggle('hidden');
            if (!row.classList.contains('hidden')) $('#evUrlInput').focus();
        });
        $('#evUrlCancel').addEventListener('click', () => { $('#evUrlRow').classList.add('hidden'); $('#evUrlInput').value = ''; });
        $('#evUrlAdd').addEventListener('click', addUrlEvidence);
        $('#evUrlInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addUrlEvidence(); } });

        // Marca "não salvo" a cada digitação e atualiza o rascunho automático
        form.addEventListener('input', () => { state.formDirty = true; saveDraftDebounced(); });

        // Submit / Salvar e novo / Cancelar
        form.addEventListener('submit', onSubmitForm);
        $('#btnSalvarNovo').addEventListener('click', () => { state.saveAndNew = true; form.requestSubmit(); });
        $('#btnCancelar').addEventListener('click', () => { state.editingId = null; state.evEditing = []; state.formDirty = false; buildForm(undefined, { focus: true }); });

        state.editingId = editing ? item.id : null;
        $('#idInfo').textContent = editing ? `ID: ${item.id}` : `O ID será gerado ao salvar (prefixo “${state.idPrefix}”).`;

        // Painel lateral do PDF: mostra evidência do item em edição, ou limpa
        if (editing && state.evEditing.length) showPdfForItem(item);
        else clearPdf();

        state.formDirty = false;                         // form recém-montado = limpo
        if (opts.focus) { const first = $('#dynFields').querySelector('input, select, textarea'); if (first) first.focus(); }
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
    const AUTOCOMPLETE_KEYS = ['instituicao', 'financiador', 'entidade', 'orgao', 'editora', 'periodico', 'evento', 'evidenciaTag'];
    const VOCAB_LABELS = {
        instituicao: 'Instituições', financiador: 'Financiadores / Agências', entidade: 'Entidades',
        orgao: 'Órgãos', editora: 'Editoras', periodico: 'Periódicos / Revistas', evento: 'Eventos',
        evidenciaTag: 'Tags de evidências',
    };
    // Tags sugeridas por padrão para categorizar evidências (documentos anexados).
    // Qualquer outro valor digitado pelo usuário também é aprendido (collectSuggestions).
    const DEFAULT_EVIDENCE_TAGS = ['Anais', 'Ata', 'Atestado', 'Capa', 'Certidão', 'Certificado', 'Comprovante',
        'Contrato', 'Convite', 'Crachá', 'Declaração', 'Diploma', 'Folder', 'Foto', 'Portaria', 'Programação',
        'Recibo', 'Relatório', 'Vídeo', 'Outros'];
    // evidenciaTag não é um campo de item.fields — vive em cada evidência
    // (item.evidencias[].tag) — por isso tem coleta/busca/renomeio à parte.
    function collectSuggestions(key) {
        const set = new Set(state.vocab[key] || []);
        if (key === 'evidenciaTag') {
            state.items.forEach(i => (i.evidencias || []).forEach(e => { if (e.tag && String(e.tag).trim()) set.add(String(e.tag).trim()); }));
        } else {
            state.items.forEach(i => { const v = i.fields && i.fields[key]; if (v && String(v).trim()) set.add(String(v).trim()); });
        }
        return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }
    function datalistsHtml() {
        return AUTOCOMPLETE_KEYS.map(k =>
            `<datalist id="dl-${k}">${collectSuggestions(k).map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`
        ).join('');
    }

    // Itens do catálogo que usam exatamente `value` no campo `key`.
    function itemsUsingValue(key, value) {
        const v = String(value == null ? '' : value).trim();
        if (!v) return [];
        if (key === 'evidenciaTag') return state.items.filter(i => (i.evidencias || []).some(e => String(e.tag == null ? '' : e.tag).trim() === v));
        return state.items.filter(i => i.fields && String(i.fields[key] == null ? '' : i.fields[key]).trim() === v);
    }

    // Renomeia/normaliza um valor de autocomplete em TODOS os itens que o usam
    // (e na lista curada). Regrava os JSONs no diretório. É a forma de "mudar
    // em um lugar só" um valor já presente em itens lançados.
    async function renameFieldValue(key, from, to) {
        const f = String(from == null ? '' : from).trim();
        const t = String(to == null ? '' : to).trim();
        if (!f) { toast('Selecione o valor a renomear.', 'aviso'); return; }
        if (!t) { toast('Informe o novo valor.', 'aviso'); return; }
        if (f === t) { toast('O novo valor é igual ao atual.', 'aviso'); return; }
        const alvo = itemsUsingValue(key, f);
        const label = VOCAB_LABELS[key] || key;
        if (!confirm(`Renomear em ${label}:\n\n"${f}"\n→ "${t}"\n\nSerá aplicado a ${alvo.length} item(ns) e a lista de sugestões. Os JSONs no diretório serão regravados. Continuar?`)) return;

        if (key === 'evidenciaTag') {
            alvo.forEach(it => (it.evidencias || []).forEach(e => { if (String(e.tag == null ? '' : e.tag).trim() === f) e.tag = t; }));
        } else {
            alvo.forEach(it => { it.fields[key] = t; });
        }
        saveCatalog();

        let falhas = 0;
        if (Storage.hasDirectory()) {
            for (const it of alvo) {
                try { await Storage.writeJson(it.id, it, LattesTypes.categoryFolder(it.categoryKey)); }
                catch (_) { falhas++; }
            }
        }

        // Atualiza a lista curada: remove o antigo, garante o novo.
        const set = new Set((state.vocab[key] || []).map(s => String(s).trim()).filter(Boolean));
        set.delete(f); set.add(t);
        state.vocab[key] = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        saveVocab();

        renderItemList();
        renderConfig();
        if (falhas) toast(`Renomeado em ${alvo.length} item(ns), mas ${falhas} JSON(s) não puderam ser regravados (verifique o diretório).`, 'aviso');
        else toast(`"${f}" → "${t}" aplicado a ${alvo.length} item(ns).`, 'ok');
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
        } else if (f.type === 'datebr') {
            // Data aaaa, mm/aaaa OU dd/mm/aaaa (texto com máscara). Guardada por
            // extenso para controle interno; na exportação XML Lattes só o ano
            // é mantido (o schema só aceita ANO). Valor ISO (aaaa-mm-dd), herdado
            // de importação/legado, vira dd/mm/aaaa.
            let dv = val == null ? '' : String(val);
            const iso = dv.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (iso) dv = `${iso[3]}/${iso[2]}/${iso[1]}`;
            input = `<input type="text" name="${f.key}" value="${esc(dv)}" ${req} inputmode="numeric" maxlength="10" placeholder="aaaa, mm/aaaa ou dd/mm/aaaa" data-datebr class="${base}">`;
        } else if (f.type === 'checkboxes') {
            const selected = String(val || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
            input = `<div class="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                ${f.options.map(o => {
                    const desc = f.descriptions && f.descriptions[o];
                    const cb = `<input type="checkbox" data-cbgroup="${f.key}" value="${esc(o)}" ${selected.includes(o) ? 'checked' : ''} class="mt-0.5">`;
                    if (!desc) return `<label class="flex items-center gap-1.5 text-sm">${cb} ${esc(o)}</label>`;
                    return `<label class="flex items-start gap-1.5 text-sm w-full">${cb}
                        <span>${esc(o)}
                            <details class="mt-0.5"><summary class="text-xs text-govbr-700 dark:text-unifesp-400 cursor-pointer select-none">Ver definição legal</summary>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">${esc(desc)}</p></details>
                        </span></label>`;
                }).join('')}
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
        } else if (f.type === 'cnaeSetores') {
            // Até 3 setores (lista CNAE fixa) — schema Lattes tem 3 atributos
            // nomeados (SETOR-DE-ATIVIDADE-1..3), por isso 3 selects fixos.
            const chosen = String(val || '').split(';').map(s => s.trim()).filter(Boolean);
            const opts = window.CNAE_SETORES || [];
            const sel = (i) => `<select data-setor="${i}" class="${base}">
                <option value="">— Setor ${i} —</option>
                ${opts.map(o => `<option value="${esc(o)}" ${chosen[i - 1] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
            </select>`;
            input = `<div class="space-y-1.5">${[1, 2, 3].map(sel).join('')}</div>`;
        } else if (f.type === 'url') {
            // URL + "N/A" (Não se aplica): conta como preenchido; vai em branco no XML
            const na = String(val) === NA_VALUE;
            input = `<div class="flex items-center gap-2">
                <input type="url" name="${f.key}" value="${na ? '' : esc(val)}" ${req} data-validate="url" maxlength="300" placeholder="https://…" class="${base} flex-1 ${na ? 'opacity-50' : ''}" ${na ? 'disabled' : ''}>
                <label class="flex items-center gap-1 text-xs shrink-0 whitespace-nowrap" title="Marque quando não há URL. Conta como preenchido; na exportação XML vai em branco.">
                    <input type="checkbox" data-na="${f.key}" ${na ? 'checked' : ''}> N/A
                </label>
            </div>`;
        } else {
            const t = (f.type === 'url' ? 'url' : (f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text')));
            const listAttr = (t === 'text' && AUTOCOMPLETE_KEYS.includes(f.key)) ? `list="dl-${f.key}"` : '';
            let vkind = '';
            if (f.validate) vkind = f.validate;
            else if (f.key === 'issn' || f.key === 'isbn' || f.key === 'doi') vkind = f.key;
            else if (t === 'url') vkind = 'url';
            const vAttr = vkind ? `data-validate="${vkind}"` : '';
            const ph = f.placeholder || (f.key === 'issn' ? '0000-0000'
                : f.key === 'isbn' ? 'ISBN-10 ou ISBN-13'
                : t === 'url' ? 'https://…' : '');
            const extra = t === 'number' ? 'min="0" step="any"'
                : `maxlength="${f.maxlength || (t === 'url' ? 300 : 500)}"`;
            input = `<input type="${t}" name="${f.key}" value="${esc(val)}" ${req} ${listAttr} ${vAttr} ${extra} placeholder="${esc(ph)}" class="${base}">`;
        }
        return `<div data-field="${f.key}">
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
    // Anais de eventos: aceita ISBN (10/13 dígitos) OU ISSN (8 dígitos) no mesmo campo.
    function validateISBNorISSN(v) {
        const s = String(v || '').trim();
        if (!s) return { ok: true, value: '' };
        const d = s.toUpperCase().replace(/[\s-]/g, '');
        if (/^\d{7}[\dX]$/.test(d)) return validateISSN(v);
        return validateISBN(v);
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
        if (kind === 'isbnIssn') return validateISBNorISSN(value);
        if (kind === 'doi') return validateDOI(value);
        if (kind === 'url') return validateURL(value);
        return { ok: true, value: value };
    }
    // Feedback visual (borda vermelha + mensagem + aria-invalid)
    function setFieldError(el, msg) {
        el.classList.toggle('border-red-500', !!msg);
        el.classList.toggle('ring-1', !!msg);
        el.classList.toggle('ring-red-500', !!msg);
        el.setAttribute('aria-invalid', msg ? 'true' : 'false');
        let p = el.parentElement.querySelector('.validate-msg');
        if (msg) {
            if (!p) { p = document.createElement('p'); p.className = 'validate-msg text-xs text-red-600 dark:text-red-400 mt-0.5'; el.parentElement.appendChild(p); }
            p.textContent = msg;
        } else if (p) p.remove();
    }
    // Associa <label> aos controles (for/id) e marca aria-required — a11y
    function associateLabels(container) {
        let n = 0;
        container.querySelectorAll(':scope > div').forEach(wrap => {
            const label = wrap.querySelector(':scope > label');
            const ctrl = wrap.querySelector('input, select, textarea');
            if (!label || !ctrl) return;
            if (!ctrl.id) ctrl.id = `fld-${++n}-${ctrl.name || 'x'}`;
            label.setAttribute('for', ctrl.id);
            if (ctrl.required) ctrl.setAttribute('aria-required', 'true');
        });
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
    // Máscara para campos 'datebr': aceita aaaa, mm/aaaa OU dd/mm/aaaa. Até 4
    // dígitos fica só o ano (sem barra); a 1ª barra só entra a partir do 5º
    // dígito (aí é mm/aaaa) e a 2ª a partir do 7º (dd/mm/aaaa) — assim dá para
    // digitar um ano puro sem ele virar "mm/aaaa" pela metade.
    function wireDateBr(container) {
        $$('[data-datebr]', container).forEach(el => {
            el.addEventListener('input', () => {
                const d = el.value.replace(/\D/g, '').slice(0, 8);
                let out = d;
                if (d.length > 6) out = d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4); // dd/mm/aaaa
                else if (d.length > 4) out = d.slice(0, 2) + '/' + d.slice(2);                   // mm/aaaa (ou dd/mm em progresso)
                el.value = out;
            });
        });
    }
    // Campos com `disabledWhen`: esconde o campo inteiro (bloco data-field) e
    // limpa o valor quando o campo controlador atinge o valor da condição
    // (e reaparece quando sai dela) — em vez de só desabilitar/acinzentar,
    // para telas com muitos campos condicionais (ex.: Formação acadêmica,
    // onde cada Nível usa um subconjunto bem diferente de campos).
    function wireConditional(container, def) {
        (def && def.fields || []).filter(f => f.disabledWhen).forEach(f => {
            const conds = Array.isArray(f.disabledWhen) ? f.disabledWhen : [f.disabledWhen];
            const ctrls = conds.map(c => container.querySelector(`[name="${c.field}"]`)).filter(Boolean);
            const wrap = container.querySelector(`[data-field="${f.key}"]`);
            if (!ctrls.length || !wrap) return;
            const input = container.querySelector(`[name="${f.key}"]`);
            const apply = () => {
                const vals = {}; conds.forEach(c => { const el = container.querySelector(`[name="${c.field}"]`); if (el) vals[c.field] = el.value; });
                const off = isFieldDisabled(f, vals);
                wrap.classList.toggle('hidden', off);
                if (off) {
                    if (input) { input.value = ''; input.removeAttribute('required'); input.dispatchEvent(new Event('change')); } // propaga p/ campos encadeados (ex.: comBolsa → bolsa)
                    $$(`[data-cbgroup="${f.key}"]`, wrap).forEach(cb => { cb.checked = false; });
                    $$(`[data-areatree]`, wrap).forEach(sel => { sel.value = ''; });
                    $$(`[data-setor]`, wrap).forEach(sel => { sel.value = ''; });
                } else if (input && f.required) {
                    input.required = true;
                }
            };
            ctrls.forEach(ctrl => ctrl.addEventListener('change', apply));
            apply(); // estado inicial
        });
    }
    // Campos com `labelWhen`: troca o texto do <label> conforme o valor do
    // campo controlador (ex.: "Título da dissertação/tese" vira "Título
    // monografia" quando o Nível é Graduação) — o campo em si (chave/valor)
    // continua único; só o rótulo muda.
    function wireDynamicLabels(container, def) {
        (def && def.fields || []).filter(f => f.labelWhen).forEach(f => {
            const ctrl = container.querySelector(`[name="${f.labelWhen.field}"]`);
            const wrap = container.querySelector(`[data-field="${f.key}"]`);
            const label = wrap && wrap.querySelector(':scope > label');
            if (!ctrl || !label) return;
            const apply = () => {
                const text = f.labelWhen.map[ctrl.value] || f.label;
                label.innerHTML = esc(text) + (f.required ? ' <span class="text-red-500">*</span>' : '');
            };
            ctrl.addEventListener('change', apply);
            apply();
        });
    }
    // Checkbox "N/A" (Não se aplica) dos campos URL: bloqueia/limpa o input
    function wireNA(container) {
        $$('[data-na]', container).forEach(cb => cb.addEventListener('change', () => {
            const input = container.querySelector(`[name="${cb.dataset.na}"]`);
            if (!input) return;
            if (cb.checked) { input.value = ''; input.disabled = true; input.classList.add('opacity-50'); setFieldError(input, ''); }
            else { input.disabled = false; input.classList.remove('opacity-50'); input.focus(); }
            state.formDirty = true;
            saveDraftDebounced();
        }));
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
    // Um campo com `disabledWhen: { field, equals|in }` fica bloqueado quando o
    // campo controlador tem o valor indicado (ex.: Título da apresentação some
    // quando a Forma de participação é "Ouvinte"). Nesse estado não é preenchido
    // nem contado na completude da descrição.
    // `disabledWhen` aceita uma condição única ou uma lista — desabilitado se
    // QUALQUER uma bater (ex.: Obtenção do título de Formação acadêmica some
    // se o Nível não for de pós-graduação OU se o Status do curso não for
    // "Concluído").
    function isFieldDisabled(f, fields) {
        const c = f && f.disabledWhen;
        if (!c) return false;
        const conds = Array.isArray(c) ? c : [c];
        return conds.some(cond => {
            const v = (fields || {})[cond.field];
            if (cond.equals != null) return v === cond.equals;
            if (Array.isArray(cond.in)) return cond.in.indexOf(v) >= 0;
            return false;
        });
    }
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
            } else if (f.type === 'cnaeSetores') {
                fields[f.key] = [1, 2, 3].map(i => { const el = form.querySelector(`[data-setor="${i}"]`); return el ? el.value.trim() : ''; }).filter(Boolean).join('; ');
            } else if (f.type === 'url') {
                const na = form.querySelector(`[data-na="${f.key}"]`);
                if (na && na.checked) fields[f.key] = NA_VALUE;
                else { const el = form.elements[f.key]; fields[f.key] = el ? el.value.trim() : ''; }
            } else {
                const el = form.elements[f.key];
                if (el) fields[f.key] = el.value.trim();
            }
        });
        // Zera campos bloqueados por condição (não devem ser gravados)
        def.fields.forEach(f => { if (isFieldDisabled(f, fields)) fields[f.key] = ''; });
        return fields;
    }
    // Normaliza pontuação tipográfica dos campos-texto p/ compatibilidade
    // ISO-8859-1 (futura exportação ao Lattes). Retorna nº de caracteres que
    // ainda ficaram fora do Latin-1 (ex.: emoji) — que viram entidades no XML.
    function normalizeEncoding(fields) {
        let residual = 0;
        Object.keys(fields).forEach(k => {
            if (typeof fields[k] !== 'string' || !fields[k]) return;
            // Remove caracteres de controle (preserva \t e \n) — integridade
            fields[k] = fields[k].replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
            if (window.LzEncoding) {
                try { fields[k] = LzEncoding.normalizePunctuation(fields[k]); } catch (_) {}
                try { residual += (LzEncoding.findNonLatin1(fields[k]) || []).length; } catch (_) {}
            }
        });
        return residual;
    }

    // Chave lógica p/ detectar duplicatas (tipo + título normalizado + ano).
    // Retorna null quando não há título — aí não arriscamos falso positivo.
    function dupKey(typeKey, fields) {
        fields = fields || {};
        const title = normNome(fields.titulo || fields.curso || fields.orientando || fields.candidato || fields.grandeArea || '');
        if (!title) return null;
        const ano = anoDe(fields.ano || fields.anoFim || fields.anoInicio || '');
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

        // 2) Coerência de anos: fim não pode ser anterior ao início. Extrai o
        //    ANO de qualquer formato (aaaa, aaaa-mm-dd ou dd/mm/aaaa — datebr).
        //    O campo de início chama 'anoInicio' nos tipos com período completo
        //    (Atuação, Projetos…) e só 'ano' nos demais (Ano de início/fim).
        const _yr = s => { const y = anoDe(s); return y ? +y : null; };
        const inicioKey = def.fields.some(f => f.key === 'anoInicio') ? 'anoInicio' : 'ano';
        const ini = _yr(fields[inicioKey]), fim = _yr(fields.anoFim);
        if (ini && fim && fim < ini) {
            const el = fieldControl(form, { key: 'anoFim' });
            if (el) { setFieldError(el, 'O ano de fim não pode ser anterior ao de início.'); el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            toast('O ano de fim não pode ser anterior ao de início.', 'aviso');
            return false;
        }

        // 3) Formatos específicos (ISSN/ISBN/DOI/URL) e números ≥ 0
        for (const f of def.fields) {
            const raw = fields[f.key];
            const kind = f.validate ? f.validate : (f.key === 'issn' || f.key === 'isbn' || f.key === 'doi') ? f.key : (f.type === 'url' ? 'url' : null);
            if (kind) {
                if (raw == null || raw === '') continue;
                if (kind === 'url' && raw === NA_VALUE) continue; // "Não se aplica" não valida
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
        const naoLattes = LattesTypes.isNaoLattesCategory(categoryKey) || LattesTypes.isNaoLattesType(typeKey);
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
        item.updatedAt = nowISO();
        // Anotações gerais: campo livre, fora de `fields` — não entra na
        // exportação Lattes (XML) nem na página pública (Publicar na Web).
        item.notasGerais = (form.elements['notasGerais'] ? form.elements['notasGerais'].value.trim() : '');

        // Camada RSC (se habilitado e o item é elegível)
        if (state.rscEnabled) { const rscData = collectRsc(form); if (rscData) item.rsc = rscData; }

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
        const fromInbox = new Set();                 // originais da Inbox a mover p/ Processado
        for (const ev of state.evEditing) {
            if (ev.kind === 'link') {
                // Evidência por link: sem arquivo, guarda a URL direto no item.
                evOut.push({ kind: 'link', url: ev.url, ext: 'url', name: ev.name || ev.url, publica: !!ev.publica, tag: ev.tag || '' });
                continue;
            }
            if (ev.file) {
                // Sem diretório configurado NÃO registramos a evidência (o arquivo
                // não seria gravado — evita metadado apontando p/ arquivo inexistente).
                if (semDir) { naoGravadas++; continue; }
                const basename = ev.basename || newBase();
                try { await Storage.writeAttachment(basename, ev.file, subdir, ev.ext); }
                catch (e) { toast('Falha ao gravar evidência "' + ev.name + '": ' + e.message, 'aviso'); continue; }
                evOut.push({ basename, ext: ev.ext, name: ev.name, publica: !!ev.publica, tag: ev.tag || '' });
                if (ev.inboxName) fromInbox.add(ev.inboxName);   // veio da bandeja de entrada
            } else {
                evOut.push({ basename: ev.basename, ext: ev.ext, name: ev.name, publica: !!ev.publica, tag: ev.tag || '' });
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
        // Move para "Caixa de Entrada/00 Processado" os originais que vieram da bandeja
        let movidos = 0, falhasMove = 0;
        for (const nm of fromInbox) {
            try { await Storage.moveInboxToProcessed(nm); movidos++; }
            catch (_) { falhasMove++; }
        }
        if (movidos) toast(`${movidos} arquivo(s) da bandeja movido(s) para “00 Processado”.`, 'ok');
        if (falhasMove) toast(`${falhasMove} arquivo(s) da bandeja não puderam ser movidos.`, 'aviso');
        // "pública" é livre: 0..N evidências podem estar marcadas
        item.evidencias = evOut;
        item.hasPdf = evOut.length > 0;
        const pub = evOut.find(e => e.publica) || evOut[0] || null; // 1ª pública (ou 1ª) p/ preview/rótulo
        item.pdfName = pub ? pub.name : null;
        item.fileExt = pub ? pub.ext : null;
        if (naoGravadas) {
            toast(`${naoGravadas} evidência(s) não registrada(s): configure um diretório em Configurações e anexe novamente.`, 'aviso');
        }

        await persistItem(item);
        // Feedback com o local de gravação (subpasta da categoria)
        const local = Storage.hasDirectory() ? ` em “${subdir}/”` : '';
        toast((editing ? 'Item atualizado' : 'Item adicionado') + local + '.', 'ok');
        if (encResid) toast(`Atenção: ${encResid} caractere(s) fora do ISO-8859-1 permanecem (ex.: emoji) — na exportação ao Lattes virarão entidades XML.`, 'aviso');

        // Lembra a última categoria/tipo (agiliza cadastro em série) e persiste
        state.lastCat = item.categoryKey; state.lastType = item.typeKey;
        const st = Storage.loadSettings(); st.lastCat = state.lastCat; st.lastType = state.lastType; Storage.saveSettings(st);

        clearDraft(); // item salvo → descarta o rascunho automático
        const saveNew = state.saveAndNew;
        state.saveAndNew = false; state.editingId = null; state.evEditing = []; state.formDirty = false;
        // "Salvar" / "Salvar alterações": reabre o item recém-salvo (novo ou editado),
        // para revisar/anexar evidência. "Salvar e novo": abre um item em branco (mesma cat/tipo).
        if (!saveNew) buildForm(state.items.find(i => i.id === item.id), { focus: false });
        else buildForm(undefined, { focus: true });
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
        // Campos bloqueados por condição (ex.: Título da apresentação p/ "Ouvinte")
        // não contam na completude.
        const campos = def.fields.filter(f => !isFieldDisabled(f, vals));
        const filled = f => { const v = vals[f.key]; return v != null && String(v).trim() !== ''; };
        if (campos.some(f => f.required && !filled(f))) return 'red';
        if (campos.some(f => !filled(f))) return 'amber';
        return 'green';
    }
    function itemYear(i) {
        const y = (i.fields && (i.fields.ano || i.fields.anoFim || i.fields.anoInicio)) || '';
        const n = parseInt(anoDe(y), 10);
        return isNaN(n) ? null : n;
    }

    // Ícone de arquivo conforme o tipo de evidência (pdf/imagem/vídeo/zip-tar.gz/link)
    function evidenceExtIcon(ext) {
        if (ext === 'url') return 'fa-link';
        if (isImageExt(ext)) return 'fa-image';
        if (isVideoExt(ext)) return 'fa-file-video';
        if (isArchiveExt(ext)) return 'fa-file-zipper';
        return 'fa-file-pdf';
    }
    // Ícones de evidência do cartão: um por evidência anexada (cor única no
    // conjunto — verde se há alguma pública, âmbar se há evidência mas nenhuma
    // pública); sem evidência, mostra um único indicador vermelho.
    function evidenceIconsHtml(item) {
        const def = LattesTypes.get(item.typeKey);
        if (def && def.noEvidence) return '';
        const evid = Array.isArray(item.evidencias) ? item.evidencias : [];
        if (!evid.length) {
            return `<span title="Sem evidência anexada" class="inline-flex items-center justify-center w-6 h-6 text-red-600 dark:text-red-500"><i class="fa-solid fa-file-circle-xmark"></i></span>`;
        }
        const cor = evid.some(e => e.publica) ? 'text-green-600 dark:text-green-500' : 'text-amber-600 dark:text-amber-500';
        // Agrupa por tipo de ícone (pdf/imagem/vídeo/zip-tar.gz/link): mesmo
        // tipo não repete o ícone, só soma no badge de contagem.
        const groups = new Map();
        evid.forEach(e => {
            const icon = evidenceExtIcon(e.ext);
            if (!groups.has(icon)) groups.set(icon, { count: 0, names: [], publica: false });
            const g = groups.get(icon);
            g.count++; g.names.push(e.name || ''); if (e.publica) g.publica = true;
        });
        return Array.from(groups.entries()).map(([icon, g]) => {
            const title = g.names.join(', ') + (g.publica ? ' (pública)' : '');
            const badge = g.count > 1 ? `<span class="absolute -bottom-1 -right-1 min-w-[14px] h-3.5 px-0.5 bg-gray-700 dark:bg-gray-300 text-white dark:text-gray-900 text-[9px] leading-[14px] rounded-full text-center">${g.count}</span>` : '';
            return `<button type="button" data-act="pdf" data-id="${item.id}" title="${esc(title)}" class="relative inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${cor}"><i class="fa-solid ${icon}"></i>${badge}</button>`;
        }).join('');
    }
    // Ícone do RSC: verde (marcado), âmbar (elegível, dentro do período de uso,
    // ainda não marcado) ou cinza (fora do período de uso). Some quando o
    // módulo está desligado ou o tipo não é elegível ao RSC.
    function rscIconHtml(item) {
        if (!state.rscEnabled) return '';
        const eligivel = item.typeKey && !LattesTypes.isPerfilType(item.typeKey) && !LattesTypes.isNaoLattesType(item.typeKey);
        if (!eligivel) return '';
        let estado, title;
        if (item.rsc && item.rsc.conta) {
            estado = 'green'; title = 'Marcado para uso no RSC';
        } else {
            const inicioAno = parseInt(anoDe((state.rscCfg && state.rscCfg.dataInicioContagem) || ''), 10);
            const itemAno = itemYear(item);
            const foraDoPeriodo = !isNaN(inicioAno) && itemAno != null && itemAno < inicioAno;
            estado = foraDoPeriodo ? 'gray' : 'amber';
            title = foraDoPeriodo ? 'Fora do período de uso do RSC' : 'Dentro do período de uso do RSC — ainda não marcado';
        }
        const cls = estado === 'green' ? 'text-green-600 dark:text-green-500' : estado === 'amber' ? 'text-amber-600 dark:text-amber-500' : 'text-gray-400 dark:text-gray-500';
        return `<span title="${esc(title)}" class="inline-flex items-center justify-center w-6 h-6 ${cls}"><i class="fa-solid fa-award"></i></span>`;
    }
    // Ícone Lattes: vermelho (ainda não está no Lattes), âmbar (está no Lattes
    // mas foi modificado localmente) ou verde (já está no Lattes, sem edições
    // desde a importação/adoção). Some para itens Não-Lattes (nunca exportados).
    function lattesIconHtml(item) {
        if (!item.lattesItem) return '';
        let estado, title;
        if (!item.lattesRef) {
            estado = 'red'; title = 'Ainda não está no Lattes';
        } else if (item.updatedAt && item.createdAt && item.updatedAt !== item.createdAt) {
            estado = 'amber'; title = 'Está no Lattes, mas sofreu modificação local';
        } else {
            estado = 'green'; title = 'Já está no Lattes';
        }
        const cls = estado === 'green' ? 'text-green-600 dark:text-green-500' : estado === 'amber' ? 'text-amber-600 dark:text-amber-500' : 'text-red-600 dark:text-red-500';
        return `<span title="${esc(title)}" class="inline-flex items-center justify-center w-6 h-6 ${cls}"><i class="fa-solid fa-graduation-cap"></i></span>`;
    }
    // Ícone de descrição: reaproveita o estado de completude (descState).
    function descIconHtml(item) {
        const estado = descState(item);
        const title = estado === 'green' ? 'Descrição completa' : estado === 'amber' ? 'Descrição incompleta (falta campo opcional)' : 'Sem descrição (falta campo obrigatório)';
        const cls = estado === 'green' ? 'text-green-600 dark:text-green-500' : estado === 'amber' ? 'text-amber-600 dark:text-amber-500' : 'text-red-600 dark:text-red-500';
        return `<span title="${esc(title)}" class="inline-flex items-center justify-center w-6 h-6 ${cls}"><i class="fa-solid fa-align-left"></i></span>`;
    }

    function itemCardHtml(i) {
        const anoNum = itemYear(i);
        const ano = anoNum != null ? String(anoNum) : '—';
        const titulo = esc(LattesTypes.itemTitle(i));
        const tipo = esc(LattesTypes.label(i.typeKey));
        const sep = `<span class="w-px h-5 bg-gray-200 dark:bg-gray-600 shrink-0 mx-0.5"></span>`;
        return `
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5">
                <div class="flex items-center gap-x-2 gap-y-1 flex-wrap">
                    <span class="text-xs font-mono text-gray-500 shrink-0 w-9 text-right tabular-nums">${ano}</span>
                    <span class="text-sm font-medium truncate flex-1 min-w-[8rem]" title="${tipo} · ${titulo}">${titulo}</span>
                    <div class="flex items-center gap-0.5 shrink-0 ml-auto">
                        ${evidenceIconsHtml(i)}
                        ${sep}
                        ${rscIconHtml(i)}${lattesIconHtml(i)}${descIconHtml(i)}
                        <span class="print:hidden contents">
                            ${sep}
                            <button data-act="edit" data-id="${i.id}" title="Abrir / Editar" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-govbr-600 dark:text-unifesp-400"><i class="fa-solid fa-pen"></i></button>
                            ${LattesTypes.isSingleton(i.typeKey) ? '' : `<button data-act="dup" data-id="${i.id}" title="Duplicar" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"><i class="fa-solid fa-clone"></i></button>`}
                            <button data-act="del" data-id="${i.id}" title="Excluir" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"><i class="fa-solid fa-trash"></i></button>
                        </span>
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
        // Monta as subdivisões por tipo de item (nível interno reutilizável)
        const typesHtmlFor = (arr, catKey) => {
            const byType = {};
            arr.forEach(i => { (byType[i.typeKey] = byType[i.typeKey] || []).push(i); });
            const seq = typeOrderOf(catKey);
            const typeKeys = Object.keys(byType).sort((a, b) => {
                const ia = seq.indexOf(a), ib = seq.indexOf(b);
                return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
            });
            return typeKeys.map(tk => `
                <details open class="border border-gray-100 dark:border-gray-700/60 rounded">
                    <summary class="cursor-pointer select-none px-2 py-1.5 bg-gray-50 dark:bg-gray-800/60 text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <i aria-hidden="true" class="fa-solid fa-angle-right text-xs text-gray-400"></i>
                        ${esc(LattesTypes.label(tk))}
                        <span class="text-xs font-normal text-gray-500">(${byType[tk].length})</span>
                    </summary>
                    <div class="p-1.5 space-y-1">${byType[tk].map(itemCardHtml).join('')}</div>
                </details>`).join('');
        };

        // Em "03 Atuação", agrupa por Instituição e, dentro dela, mantém as
        // subdivisões por tipo de item (Atuação profissional, atividades, etc.).
        const SEM_INST = ' ';
        const instHtmlFor = (arr, catKey) => {
            const byInst = {};
            const labelOf = {};
            arr.forEach(i => {
                const raw = ((i.fields && i.fields.instituicao) || '').trim();
                const ik = raw ? normNome(raw) : SEM_INST;
                if (!byInst[ik]) { byInst[ik] = []; labelOf[ik] = raw; }
                byInst[ik].push(i);
            });
            const instKeys = Object.keys(byInst).sort((a, b) => {
                if (a === SEM_INST) return 1;
                if (b === SEM_INST) return -1;
                return labelOf[a].localeCompare(labelOf[b], 'pt-BR', { sensitivity: 'base' });
            });
            return instKeys.map(ik => `
                <details open class="border border-gray-200 dark:border-gray-700/70 rounded-md">
                    <summary class="cursor-pointer select-none px-2.5 py-1.5 bg-gray-100/70 dark:bg-gray-800/80 text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <i aria-hidden="true" class="fa-solid fa-building text-govbr-600 dark:text-unifesp-400 text-xs"></i>
                        ${esc(ik === SEM_INST ? '(Sem instituição informada)' : labelOf[ik])}
                        <span class="text-xs font-normal text-gray-500">(${byInst[ik].length})</span>
                    </summary>
                    <div class="p-1.5 space-y-1.5">${typesHtmlFor(byInst[ik], catKey)}</div>
                </details>`).join('');
        };

        return order.filter(k => groups[k] && groups[k].length).map(k => {
            const g = groups[k];
            const bodyHtml = (k === 'ATUACAO') ? instHtmlFor(g, k) : typesHtmlFor(g, k);
            return `
            <details open class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <summary class="cursor-pointer select-none px-3 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-sm flex items-center gap-2">
                    <i aria-hidden="true" class="fa-solid ${esc((LattesTypes.categoryByKey(k) || {}).icon || 'fa-folder')} text-govbr-600 dark:text-unifesp-400"></i>
                    ${esc(LattesTypes.categoryNumLabel(k))}
                    <span class="text-xs font-normal text-gray-500">(${g.length})</span>
                </summary>
                <div class="p-2 space-y-2">${bodyHtml}</div>
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

        // Tipos de perfil (Identificação, Foto, Endereço, Texto inicial,
        // Outras informações, Áreas de atuação, Documentos pessoais) são
        // editados em Configurações e não aparecem na lista de Conformidade.
        let items = state.items.filter(VIEW_PREDICATE[view])
            .filter(i => !LattesTypes.isPerfilType(i.typeKey));
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
            // Abre o item na aba Catalogar
            switchTab('catalogar');
            buildForm(item);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (btn.dataset.act === 'dup') {
            await duplicateItem(id);
        } else if (btn.dataset.act === 'del') {
            if (!confirm(`Excluir "${LattesTypes.itemTitle(item)}"? Os arquivos ${id}.pdf/.json também serão removidos.`)) return;
            await deleteItem(id);
            toast('Item excluído.', 'ok');
            renderItemList();
        }
    }

    // Duplica um item: mesma categoria/tipo/campos, mas sem evidências (cada
    // uma comprova um documento real específico, não faz sentido copiá-las)
    // e sem lattesRef (evita colidir com a deduplicação de reimportação do
    // XML). O campo-título do tipo ganha o sufixo " (cópia)".
    async function duplicateItem(id) {
        const orig = state.items.find(i => i.id === id);
        if (!orig || LattesTypes.isSingleton(orig.typeKey)) return;
        const fields = Object.assign({}, orig.fields);
        const labelKey = ['titulo', 'orientando', 'candidato', 'especialidade', 'subarea', 'area', 'instituicao']
            .find(k => fields[k] && String(fields[k]).trim());
        if (labelKey) fields[labelKey] = `${fields[labelKey]} (cópia)`;
        const copy = {
            id: uid(), createdAt: nowISO(), updatedAt: nowISO(), source: 'local',
            lattesItem: orig.lattesItem, typeKey: orig.typeKey, categoryKey: orig.categoryKey,
            fields, evidencias: [], hasPdf: false, pdfName: null, fileExt: null, lattesRef: null,
        };
        await persistItem(copy);
        toast('Item duplicado — revise os dados e anexe a evidência.', 'ok');
        renderItemList();
    }

    /* =====================================================================
       IMPORTAR LATTES (XML) — seção dentro de Configurações
       ===================================================================== */
    // Aviso de consistência exibido nas operações de XML (importar/exportar):
    // depois de adotar o lattesZen, as edições devem ocorrer AQUI e não mais
    // diretamente na Plataforma Lattes (senão a assinatura do item muda e pode
    // duplicar na próxima importação).
    function xmlConsistencyNoticeHtml() {
        return `
            <div class="text-sm rounded-md border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 px-3 py-2 mb-3 flex gap-2">
                <i class="fa-solid fa-triangle-exclamation mt-0.5"></i>
                <span>Para manter a <strong>consistência</strong>: depois de adotar o lattesZen, faça as <strong>edições aqui no lattesZen</strong> e não mais diretamente na Plataforma Lattes. O lattesZen vira a sua fonte de referência e você exporta o XML para atualizar o Lattes. Alterar um item direto na Plataforma Lattes muda o identificador dele e pode gerar <strong>duplicação</strong> ao reimportar.</span>
            </div>`;
    }
    function xmlConsistencyToast() {
        toast('Lembrete: edite no lattesZen (não direto na Plataforma Lattes) para manter a consistência dos dados.', 'aviso');
    }

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
                ${xmlConsistencyNoticeHtml()}
                <input type="file" id="xmlInput" accept=".xml,application/xml,text/xml"
                       class="text-sm file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-govbr-600 dark:file:bg-unifesp-700 file:text-white">
                <div id="xmlResult" class="mt-3"></div>
            </section>`;
    }

    function exportLattesSectionHtml() {
        return `
            <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-file-code text-govbr-600 dark:text-unifesp-400"></i> Exportar para a Plataforma Lattes (XML)</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Gera o arquivo <strong>curriculo.xml</strong> no formato oficial do CNPq (schema <em>CurriculoLattes</em>, codificação ISO-8859-1). Inclui apenas os itens das categorias do Lattes — <strong>RSC, Conexões e Registros pessoais não são exportados</strong>. As evidências (PDFs) não fazem parte do XML.</p>
                ${xmlConsistencyNoticeHtml()}
                <div class="flex gap-2 flex-wrap">
                    <button id="btnXmlDownload" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-download mr-1"></i> Baixar XML (.xml)</button>
                    <button id="btnXmlSave" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-folder-open mr-1"></i> Salvar na pasta (Publicação/curriculo.xml)</button>
                </div>
                <p id="xmlStatus" class="text-xs text-gray-500 mt-2"></p>
            </section>`;
    }

    // Ata os botões da exportação XML (usado dentro de renderConfig).
    function wireExportLattes() {
        const xmlStatus = (t) => { const el = $('#xmlStatus'); if (el) el.textContent = t; };
        function generateLattesXml() {
            const cfg = Storage.loadSettings() || {};
            const xml = LattesXMLExport.build(state.items, { numeroIdentificador: cfg.lattesId || '' });
            // Serializa em ISO-8859-1 (entidades numéricas para fora do Latin-1).
            return { xml, bytes: LzEncoding.encodeLatin1Xml(xml) };
        }
        const xmlExportaveis = () => state.items.filter(i => {
            const def = LattesTypes.getType(i.typeKey);
            if (def && def.noExport) return false;
            return !LattesTypes.isNaoLattesCategory(i.categoryKey);
        }).length;
        const dl = $('#btnXmlDownload');
        if (dl) dl.addEventListener('click', () => {
            xmlStatus('Gerando XML…');
            try {
                const { bytes } = generateLattesXml();
                const nome = (state.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo) || {}).fields;
                const safe = (nome && nome.titulo ? nome.titulo : 'curriculo').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-').toLowerCase();
                const blob = new Blob([bytes], { type: 'application/xml' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `curriculo-${safe}.xml`; a.click(); URL.revokeObjectURL(a.href);
                xmlStatus(`XML gerado (${xmlExportaveis()} item(ns) exportado(s)).`);
                xmlConsistencyToast();
            } catch (e) { xmlStatus(''); toast('Falha ao gerar XML: ' + e.message, 'erro'); }
        });
        const sv = $('#btnXmlSave');
        if (sv) sv.addEventListener('click', async () => {
            if (!Storage.hasDirectory()) { toast('Configure um diretório abaixo para salvar na pasta.', 'aviso'); return; }
            xmlStatus('Gerando e salvando XML…');
            try {
                const { bytes } = generateLattesXml();
                await Storage.writeFile('curriculo.xml', bytes, 'Publicação');
                xmlStatus(`Salvo em “Publicação/curriculo.xml” (${xmlExportaveis()} item(ns)).`);
                toast('XML salvo em “Publicação/curriculo.xml”.', 'ok');
                xmlConsistencyToast();
            } catch (e) { xmlStatus(''); toast('Falha ao salvar XML: ' + e.message, 'erro'); }
        });
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

    /* ----------------------- Deduplicação de importação -----------------------
       Uma "assinatura de conteúdo" identifica o MESMO item entre importações,
       independente da categoria e resistente a edições locais. Casa três casos:
       (1) re-importar um item já importado (mesma assinatura viva);
       (2) item importado e depois EDITADO localmente — a assinatura ORIGINAL do
           Lattes fica gravada em `lattesRef` (imutável) e continua casando;
       (3) item criado MANUALMENTE no lattesZen que depois passa a existir no
           Lattes — casa pela assinatura viva e é "adotado" (recebe lattesRef).
       Assim NUNCA se cria duplicata a cada nova importação do XML.           */
    function _canonTitle(f) {
        // Cadeia de campos-título por prioridade. Inclui os campos preservados no
        // round-trip de tipos sem "titulo" próprio (ex.: Áreas de atuação usam a
        // hierarquia especialidade/subárea/área), para que também deduplicem.
        return String((f && (f.titulo || f.curso || f.orientando || f.candidato
            || f.especialidade || f.subarea || f.area || f.instituicao)) || '')
            .toLowerCase().replace(/\s+/g, ' ').trim();
    }
    // Reduz qualquer data (aaaa, aaaa-mm-dd ou dd/mm/aaaa) ao ano de 4 dígitos.
    // Assim a assinatura de um item com data completa (ex.: ATIV_CONSELHO) casa
    // com o mesmo item reimportado do Lattes, que traz só o ano — sem duplicar.
    function _sigYear(v) { const m = String(v == null ? '' : v).match(/\d{4}/); return m ? m[0] : ''; }
    function itemSignature(typeKey, fields) {
        const c = _canonTitle(fields);
        return c ? `${typeKey}|${c}|${_sigYear(fields && fields.ano)}|${_sigYear(fields && fields.anoInicio)}|${_sigYear(fields && fields.anoFim)}` : '';
    }
    // Assinatura(s) derivada(s) de um item existente: a viva (campos atuais) e a
    // original gravada em lattesRef (formato cat|type|canon|ano|ini|fim → tira a categoria).
    function itemSignatures(it) {
        const out = [];
        const live = itemSignature(it.typeKey, it.fields || {});
        if (live) out.push(live);
        if (it.lattesRef) {
            const parts = String(it.lattesRef).split('|');
            if (parts.length >= 2) { const s = parts.slice(1).join('|'); if (s) out.push(s); }
        }
        return out;
    }
    // Mapa assinatura -> item existente (primeira ocorrência vence).
    function existingSignatureMap() {
        const map = new Map();
        for (const it of state.items) for (const s of itemSignatures(it)) if (!map.has(s)) map.set(s, it);
        return map;
    }

    function renderXmlResult(res) {
        const box = $('#xmlResult');
        if (!res.items.length) {
            box.innerHTML = `<p class="text-sm text-gray-500 italic">Nenhum item reconhecido no XML.</p>`;
            return;
        }
        const sigMap = existingSignatureMap();
        const isDup = (it) => (LattesTypes.isSingleton(it.typeKey) && state.items.some(x => x.typeKey === it.typeKey)) || sigMap.has(itemSignature(it.typeKey, it.fields || {}));
        const novos = res.items.filter(it => !isDup(it)).length;
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
                    const dup = isDup(it);
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
            c.checked = !isDup(res.items[+c.dataset.idx]);
        }));
        $('#btnSelAll').addEventListener('click', () => $$('.xmlchk').forEach(c => c.checked = true));
        $('#btnSelNone').addEventListener('click', () => $$('.xmlchk').forEach(c => c.checked = false));
        $('#btnImport').addEventListener('click', importSelected);
    }

    async function importSelected() {
        const chosen = $$('.xmlchk').filter(c => c.checked).map(c => parseInt(c.dataset.idx, 10));
        if (!chosen.length) { toast('Nenhum item selecionado.', 'aviso'); return; }
        // Deduplicação por assinatura de conteúdo — impede duplicar itens já
        // existentes a cada nova importação, mesmo que tenham sido editados ou
        // criados manualmente antes de constarem no Lattes.
        const sigMap = existingSignatureMap();
        const registrar = (it) => itemSignatures(it).forEach(s => { if (!sigMap.has(s)) sigMap.set(s, it); });
        let n = 0, atualizados = 0, ignorados = 0;
        for (const idx of chosen) {
            const src = state.lattesParsed.items[idx];
            // Tipos únicos (Identificação, Endereço, Resumo, Outras info): se já
            // existir um item desse tipo, ATUALIZA em vez de criar um novo.
            if (LattesTypes.isSingleton(src.typeKey)) {
                const ex = state.items.find(i => i.typeKey === src.typeKey);
                if (ex) {
                    ex.fields = src.fields; ex.categoryKey = src.categoryKey || ex.categoryKey;
                    ex.lattesRef = src.lattesRef; ex.updatedAt = nowISO();
                    await persistItem(ex);
                    atualizados++; continue;
                }
            }
            const sig = itemSignature(src.typeKey, src.fields || {});
            const match = sig ? sigMap.get(sig) : null;
            if (match) {
                // Item já existe: NÃO duplica. Preserva os dados e as evidências
                // do usuário; apenas "adota" como item do Lattes (grava o
                // lattesRef original) para casar nas próximas importações.
                let changed = false;
                if (!match.lattesRef && src.lattesRef) { match.lattesRef = src.lattesRef; changed = true; }
                if (changed) { match.updatedAt = nowISO(); await persistItem(match); atualizados++; }
                else ignorados++;
                registrar(match);
                continue;
            }
            const item = {
                id: uid(), createdAt: nowISO(), updatedAt: nowISO(),
                lattesItem: true, typeKey: src.typeKey,
                categoryKey: src.categoryKey || LattesTypes.primaryCategory(src.typeKey),
                fields: src.fields,
                source: 'lattes', lattesRef: src.lattesRef,
                hasPdf: false, pdfName: null, evidencias: [],
            };
            await persistItem(item);
            registrar(item);
            n++;
        }
        const extras = [atualizados ? `${atualizados} atualizado(s)` : '', ignorados ? `${ignorados} já existente(s) ignorado(s)` : ''].filter(Boolean).join(', ');
        toast(`${n} item(ns) importado(s)${extras ? ' — ' + extras : ''}.`, 'ok');
        xmlConsistencyToast();
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
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Informações autodeclaradas do Currículo Lattes (Identificação, Foto, Endereço, Texto inicial, Outras informações, Áreas de atuação, Identidade, Passaporte e Documentos pessoais). São itens <strong>do Lattes</strong> — a maioria não exige evidência, exceto Identidade, Passaporte e Documentos pessoais.</p>
            <div class="space-y-2">
                ${LattesTypes.perfilTypes().filter(k => k !== 'AREA_ATUACAO' && k !== 'DOCUMENTO_PESSOAL' && k !== 'DOC_IDENTIDADE' && k !== 'DOC_PASSAPORTE').map(perfilCardHtml).join('')}
                ${areaAtuacaoSectionHtml()}
                ${fixedDocCardHtml('DOC_IDENTIDADE')}
                ${fixedDocCardHtml('DOC_PASSAPORTE')}
                ${documentoPessoalSectionHtml()}
            </div>
        </section>`;
    }

    // Identidade (RG) / Passaporte: itens fixos (sempre presentes, não são
    // removíveis) dentro de Documentos pessoais — diferente da lista livre de
    // Documentos pessoais, cada um tem campos próprios e alimenta a
    // exportação Lattes (NUMERO-IDENTIDADE/ORGAO-EMISSOR/... e
    // NUMERO-DO-PASSAPORTE em DADOS-GERAIS). "Preencher"/"Editar" abrem o
    // formulário completo do Catalogar (com upload de evidência) e voltam
    // para Configurações ao salvar.
    function fixedDocCardHtml(tk) {
        const def = LattesTypes.get(tk);
        const item = state.items.find(i => i.typeKey === tk);
        const preenchido = !!item;
        const resumo = item ? esc(LattesTypes.itemTitle(item)) : 'vazio';
        return `<div class="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm">
            <i aria-hidden="true" title="${item && evCount(item) ? 'Com evidência anexada' : 'Sem evidência anexada'}" class="fa-solid ${item && evCount(item) ? 'fa-paperclip text-green-600 dark:text-green-500' : 'fa-file-circle-xmark text-gray-400'} shrink-0"></i>
            <span class="flex-1 min-w-0 truncate">${esc(def.label)} <span class="text-xs font-normal ${preenchido ? 'text-green-600 dark:text-green-400' : 'text-gray-400'} truncate">· ${resumo}</span></span>
            <button type="button" data-fixed-doc="${tk}" class="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-govbr-600 dark:text-unifesp-400 text-xs font-semibold shrink-0"><i class="fa-solid fa-pen mr-1"></i> ${preenchido ? 'Editar' : 'Preencher'}</button>
        </div>`;
    }

    // Documentos pessoais: outro tipo de perfil com VÁRIAS instâncias, mas que
    // (diferente de Áreas de atuação) usa evidência (o próprio anexo). Em vez
    // de reconstruir a interface de anexo, a mini-lista aqui só lista/edita/
    // remove; "Adicionar"/"Editar" abrem o formulário completo do Catalogar
    // (com upload de arquivo) e voltam para Configurações ao salvar.
    function documentoPessoalListHtml() {
        const itens = state.items.filter(i => i.typeKey === 'DOCUMENTO_PESSOAL');
        if (!itens.length) return `<p class="text-xs text-gray-400 dark:text-gray-500 italic">Nenhum documento cadastrado.</p>`;
        return `<ul class="space-y-1 mb-2">${itens.map(i => `
            <li class="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-sm">
                <i aria-hidden="true" title="${evCount(i) ? 'Com evidência anexada' : 'Sem evidência anexada'}" class="fa-solid ${evCount(i) ? 'fa-paperclip text-green-600 dark:text-green-500' : 'fa-file-circle-xmark text-red-600 dark:text-red-500'} shrink-0"></i>
                <span class="flex-1 min-w-0 truncate">${esc(LattesTypes.itemTitle(i))}</span>
                <button type="button" data-doc-edit="${i.id}" title="Editar" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-govbr-600 dark:text-unifesp-400"><i class="fa-solid fa-pen"></i></button>
                <button type="button" data-doc-del="${i.id}" title="Remover" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"><i class="fa-solid fa-trash"></i></button>
            </li>`).join('')}</ul>`;
    }
    function documentoPessoalSectionHtml() {
        const def = LattesTypes.get('DOCUMENTO_PESSOAL');
        const n = state.items.filter(i => i.typeKey === 'DOCUMENTO_PESSOAL').length;
        return `<details class="border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900">
            <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center gap-2">
                <i aria-hidden="true" class="fa-solid fa-angle-right text-xs text-gray-400"></i>
                ${esc(def.label)}
                <span id="documentoPessoalCount" class="text-xs font-normal text-gray-400 truncate min-w-0">· ${n} cadastrado${n === 1 ? '' : 's'}</span>
            </summary>
            <div class="p-3 space-y-2 border-t border-gray-100 dark:border-gray-700">
                <div id="documentoPessoalList">${documentoPessoalListHtml()}</div>
                <button type="button" id="btnAddDocumentoPessoal" class="px-3 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-plus mr-1"></i> Adicionar documento</button>
            </div>
        </details>`;
    }
    // Seleciona uma categoria no <select> do Catalogar mesmo quando ela foi
    // filtrada da lista visível (ex.: perfilOnly) — injeta a <option> que
    // falta antes de atribuir o valor (senão a atribuição é ignorada).
    function forceSelectCategoria(catKey) {
        const selCat = $('#selCategoria');
        if (!selCat) return;
        if (!selCat.querySelector(`option[value="${catKey}"]`)) {
            const opt = document.createElement('option');
            opt.value = catKey;
            opt.textContent = LattesTypes.categoryNumLabel(catKey);
            selCat.appendChild(opt);
        }
        selCat.value = catKey;
    }
    // Abre o item (novo ou existente) no formulário do Catalogar, forçando a
    // categoria/tipo indicado mesmo fora da lista de tipos visível (Documentos
    // pessoais/Identidade/Passaporte foram retirados de lá — só alcançáveis
    // por aqui). Ao salvar, volta a Configurações.
    function openPerfilDocForm(typeKey, item) {
        switchTab('catalogar');
        buildForm(item, { focus: false });
        forceSelectCategoria(LattesTypes.primaryCategory(typeKey));
        if (state._selectTipo) state._selectTipo(typeKey);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function wireDocumentoPessoalListActions(sec) {
        const list = sec.querySelector('#documentoPessoalList');
        if (!list) return;
        $$('[data-doc-edit]', list).forEach(b => b.addEventListener('click', () => {
            const item = state.items.find(i => i.id === b.dataset.docEdit);
            if (item) openPerfilDocForm('DOCUMENTO_PESSOAL', item);
        }));
        $$('[data-doc-del]', list).forEach(b => b.addEventListener('click', async () => {
            const item = state.items.find(i => i.id === b.dataset.docDel);
            if (!item) return;
            if (!confirm(`Excluir "${LattesTypes.itemTitle(item)}"? Os arquivos também serão removidos.`)) return;
            await deleteItem(item.id);
            toast('Documento excluído.', 'ok');
            refreshDocumentoPessoalList(sec);
            renderItemList();
        }));
    }
    function refreshDocumentoPessoalList(sec) {
        const list = sec.querySelector('#documentoPessoalList');
        if (list) list.innerHTML = documentoPessoalListHtml();
        const n = state.items.filter(i => i.typeKey === 'DOCUMENTO_PESSOAL').length;
        const count = sec.querySelector('#documentoPessoalCount');
        if (count) count.textContent = `· ${n} cadastrado${n === 1 ? '' : 's'}`;
        wireDocumentoPessoalListActions(sec);
    }
    function wireDocumentoPessoalSection(sec) {
        const addBtn = sec.querySelector('#btnAddDocumentoPessoal');
        if (addBtn) addBtn.addEventListener('click', () => openPerfilDocForm('DOCUMENTO_PESSOAL', undefined));
        wireDocumentoPessoalListActions(sec);
    }
    // Botões "Preencher"/"Editar" dos itens fixos (Identidade/Passaporte)
    function wireFixedDocButtons(sec) {
        $$('[data-fixed-doc]', sec).forEach(b => b.addEventListener('click', () => {
            const tk = b.dataset.fixedDoc;
            openPerfilDocForm(tk, state.items.find(i => i.typeKey === tk));
        }));
    }

    // Áreas de atuação: único tipo de perfil com VÁRIAS instâncias — em vez do
    // cartão único (perfilCardHtml), mostra uma mini-lista com adicionar/
    // editar/remover, dentro de Configurações > Dados gerais.
    function areaAtuacaoListHtml() {
        const itens = state.items.filter(i => i.typeKey === 'AREA_ATUACAO');
        if (!itens.length) return `<p class="text-xs text-gray-400 dark:text-gray-500 italic">Nenhuma área cadastrada.</p>`;
        return `<ul class="space-y-1 mb-2">${itens.map(i => `
            <li class="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-sm">
                <span class="flex-1 min-w-0 truncate">${esc(LattesTypes.itemTitle(i))}</span>
                <button type="button" data-area-edit="${i.id}" title="Editar" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-govbr-600 dark:text-unifesp-400"><i class="fa-solid fa-pen"></i></button>
                <button type="button" data-area-del="${i.id}" title="Remover" class="w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"><i class="fa-solid fa-trash"></i></button>
            </li>`).join('')}</ul>`;
    }
    function areaAtuacaoSectionHtml() {
        const def = LattesTypes.get('AREA_ATUACAO');
        const n = state.items.filter(i => i.typeKey === 'AREA_ATUACAO').length;
        return `<details class="border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900">
            <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center gap-2">
                <i aria-hidden="true" class="fa-solid fa-angle-right text-xs text-gray-400"></i>
                ${esc(def.label)}
                <span id="areaAtuacaoCount" class="text-xs font-normal text-gray-400 truncate min-w-0">· ${n} cadastrada${n === 1 ? '' : 's'}</span>
            </summary>
            <div class="p-3 space-y-2 border-t border-gray-100 dark:border-gray-700">
                <div id="areaAtuacaoList">${areaAtuacaoListHtml()}</div>
                <form id="areaAtuacaoForm" class="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700" data-editing-id="">
                    ${def.fields.map(f => fieldHtml(f, '')).join('')}
                    <div class="flex items-center gap-2">
                        <button type="submit" class="px-3 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-plus mr-1"></i> <span id="areaAtuacaoSubmitLabel">Adicionar área</span></button>
                        <button type="button" id="areaAtuacaoCancel" class="hidden px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm">Cancelar edição</button>
                    </div>
                </form>
            </div>
        </details>`;
    }
    function areaAtuacaoResetForm(form) {
        form.dataset.editingId = '';
        wireAreaTree(form, {});
        const lbl = $('#areaAtuacaoSubmitLabel'); if (lbl) lbl.textContent = 'Adicionar área';
        const cancel = $('#areaAtuacaoCancel'); if (cancel) cancel.classList.add('hidden');
    }
    function refreshAreaAtuacaoList(sec) {
        const list = sec.querySelector('#areaAtuacaoList');
        if (list) list.innerHTML = areaAtuacaoListHtml();
        const n = state.items.filter(i => i.typeKey === 'AREA_ATUACAO').length;
        const count = sec.querySelector('#areaAtuacaoCount');
        if (count) count.textContent = `· ${n} cadastrada${n === 1 ? '' : 's'}`;
        wireAreaAtuacaoListActions(sec);
    }
    function wireAreaAtuacaoListActions(sec) {
        const list = sec.querySelector('#areaAtuacaoList');
        if (!list) return;
        $$('[data-area-edit]', list).forEach(b => b.addEventListener('click', () => {
            const item = state.items.find(i => i.id === b.dataset.areaEdit);
            if (!item) return;
            const form = sec.querySelector('#areaAtuacaoForm');
            form.dataset.editingId = item.id;
            wireAreaTree(form, item.fields || {});
            $('#areaAtuacaoSubmitLabel').textContent = 'Salvar alterações';
            $('#areaAtuacaoCancel').classList.remove('hidden');
            form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }));
        $$('[data-area-del]', list).forEach(b => b.addEventListener('click', async () => {
            const item = state.items.find(i => i.id === b.dataset.areaDel);
            if (!item) return;
            if (!confirm(`Remover "${LattesTypes.itemTitle(item)}"?`)) return;
            await deleteItem(item.id);
            const form = sec.querySelector('#areaAtuacaoForm');
            if (form.dataset.editingId === item.id) areaAtuacaoResetForm(form);
            refreshAreaAtuacaoList(sec);
            renderItemList();
        }));
    }
    function wireAreaAtuacaoSection(sec) {
        const form = sec.querySelector('#areaAtuacaoForm');
        if (!form) return;
        wireAreaTree(form, {});
        wireAreaAtuacaoListActions(sec);
        const cancelBtn = sec.querySelector('#areaAtuacaoCancel');
        if (cancelBtn) cancelBtn.addEventListener('click', () => areaAtuacaoResetForm(form));

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const def = LattesTypes.get('AREA_ATUACAO');
            const fields = collectFields(form, def);
            const encResid = normalizeEncoding(fields); // compatibilidade ISO-8859-1
            if (!validateItemFields(def, fields, form)) return;

            const editingId = form.dataset.editingId;
            let item = editingId ? state.items.find(i => i.id === editingId) : null;
            if (!item) item = { id: uid(), createdAt: nowISO(), source: 'local', hasPdf: false, evidencias: [], pdfName: null, lattesRef: null };
            item.lattesItem = true;
            item.typeKey = 'AREA_ATUACAO';
            item.categoryKey = LattesTypes.primaryCategory('AREA_ATUACAO');
            item.fields = fields;
            item.updatedAt = nowISO();

            await persistItem(item);
            toast(editingId ? 'Área de atuação atualizada.' : 'Área de atuação adicionada.', 'ok');
            if (encResid) toast(`Atenção: ${encResid} caractere(s) fora do ISO-8859-1 permanecem (ex.: emoji).`, 'aviso');
            areaAtuacaoResetForm(form);
            refreshAreaAtuacaoList(sec);
            renderItemList();
        });
    }

    /* ------------------------- Configuração do RSC ------------------------ */
    function rscSectionHtml() {
        const c = state.rscCfg || {};
        const inp = (k, lbl, ph) => `<div><label class="block text-xs font-semibold mb-1" for="rsc-${k}">${esc(lbl)}</label>
            <input id="rsc-${k}" type="text" value="${esc(c[k] || '')}" placeholder="${esc(ph || '')}" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></div>`;
        const escOpts = LzRSC.ESCOLARIDADE.map(e => `<option value="${e.key}" ${c.escolaridade === e.key ? 'selected' : ''}>${esc(e.label)} (nível ${e.maxN}, IQ ${e.iq}%)</option>`).join('');
        return `<section id="rscSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-award text-govbr-600 dark:text-unifesp-400"></i> RSC-PCCTAE (opcional)</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Reconhecimento de Saberes e Competências (Decreto nº 13.048/2026). Quando habilitado, cada item elegível ganha, abaixo dos campos, uma camada com os dados do RSC, e surge a aba <strong>RSC</strong> (simulador). Uso individual.</p>
            <label class="flex items-center gap-2 text-sm mb-3">
                <input type="checkbox" id="rscEnable" ${state.rscEnabled ? 'checked' : ''}>
                <span>Habilitar módulo <strong>RSC-PCCTAE</strong></span>
            </label>
            <div id="rscCfgFields" class="${state.rscEnabled ? '' : 'hidden'} space-y-3">
                <div class="grid grid-cols-2 gap-2">
                    ${inp('cargo', 'Cargo', 'ex.: Assistente em Administração')}
                    ${inp('classe', 'Classe / nível', 'ex.: Classe D, Nível IV')}
                    ${inp('siape', 'SIAPE', '(opcional)')}
                    ${inp('lotacao', 'Lotação / unidade', '')}
                    ${inp('ingresso', 'Data de ingresso no cargo', '25/12/2026')}
                    ${inp('dataInicioContagem', 'Início da contagem (RSC)', '25/12/2026')}
                    <div class="col-span-2">
                        <label class="block text-xs font-semibold mb-1" for="rsc-escolaridade">Escolaridade (limita o nível máximo)</label>
                        <select id="rsc-escolaridade" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"><option value="">—</option>${escOpts}</select>
                    </div>
                </div>
            </div>
            <div class="flex gap-2 mt-3">
                <button id="btnSaveRsc" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-floppy-disk mr-1"></i> Salvar RSC</button>
            </div>
        </section>`;
    }
    function wireRscConfig() {
        const en = $('#rscEnable'); if (!en) return;
        en.addEventListener('change', () => { $('#rscCfgFields').classList.toggle('hidden', !en.checked); });
        $('#btnSaveRsc').addEventListener('click', () => {
            state.rscEnabled = $('#rscEnable').checked;
            const keys = ['cargo', 'classe', 'siape', 'lotacao', 'ingresso', 'dataInicioContagem'];
            const cfg = {};
            keys.forEach(k => { const el = $('#rsc-' + k); if (el) cfg[k] = el.value.trim(); });
            cfg.escolaridade = $('#rsc-escolaridade').value;
            state.rscCfg = cfg;
            const s = Storage.loadSettings(); s.rscEnabled = state.rscEnabled; s.rsc = cfg; Storage.saveSettings(s);
            applyRscVisibility();
            toast(state.rscEnabled ? 'Módulo RSC habilitado.' : 'Módulo RSC desabilitado.', 'ok');
            renderConfig();
        });
    }
    function wirePerfilSection() {
        const sec = $('#perfilSection');
        if (!sec) return;
        // Vários cartões de perfil ficam abertos na mesma seção e vários tipos
        // reaproveitam as mesmas chaves de campo (ex.: "descricao" em Texto
        // inicial E em Outras informações) — por isso cada wiring roda
        // isolado POR FORMULÁRIO, nunca na seção inteira (senão o contador/
        // validador de um campo "vaza" para o campo de mesmo nome no outro
        // cartão, já que querySelector pega só o primeiro do documento).
        $$('[data-perfil-form]', sec).forEach(form => {
            wireValidators(form);
            wireCounters(form);
            wireDateBr(form);
            wireNA(form);
            wireConditional(form, LattesTypes.get(form.dataset.perfilForm));
        });
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
                const url = await Storage.readAttachmentUrl(ev.basename, LattesTypes.categoryFolder('PERFIL_FOTOS'), ev.ext);
                if (url) { prev.src = url; prev.classList.remove('hidden'); }
            } catch (_) {}
        })();
        $$('[data-perfil-form]', sec).forEach(form => form.addEventListener('submit', onPerfilSubmit));
        wireAreaAtuacaoSection(sec);
        wireFixedDocButtons(sec);
        wireDocumentoPessoalSection(sec);
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
        item.categoryKey = LattesTypes.primaryCategory(tk);
        item.fields = fields;
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
                    try { await Storage.writeAttachment(item.id, file, LattesTypes.categoryFolder(item.categoryKey), ext); }
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

    // Cabeçalho de grupo das Configurações (divisor de seções)
    function cfgGroup(icon, title) {
        return `<h2 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2 pt-3 pb-1 border-b border-gray-200 dark:border-gray-700"><i class="fa-solid ${icon}"></i> ${esc(title)}</h2>`;
    }

    async function renderConfig() {
        updateHeaderIdentity(); // reflete edições no nome (Identificação, import, limpar catálogo…)
        const panel = $('#tab-config');
        const dirName = Storage.hasDirectory() ? await Storage.directoryName() : null;

        panel.innerHTML = `
            <div class="space-y-6 max-w-2xl">
                ${cfgGroup('fa-folder-tree', 'Diretório e dados')}
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
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Exporte ou importe todo o catálogo (metadados) e as configurações do sistema (prefixo do identificador, listas de autocomplete, RSC-PCCTAE) num único arquivo JSON — é o que permite restaurar tudo num navegador novo. Com um diretório configurado, o backup é salvo automaticamente na subpasta <code class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">Cópia de segurança</code>.</p>
                    <div class="flex flex-wrap gap-2">
                        <button id="btnExport" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-download mr-1"></i> Exportar catálogo</button>
                        <label class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm cursor-pointer"><i class="fa-solid fa-upload mr-1"></i> Importar catálogo
                            <input type="file" id="importJson" accept="application/json" class="hidden">
                        </label>
                    </div>
                </section>

                ${cfgGroup('fa-id-card', 'Perfil')}
                ${perfilSectionHtml()}

                ${cfgGroup('fa-arrow-right-arrow-left', 'Plataforma Lattes')}
                ${importLattesSectionHtml()}
                ${exportLattesSectionHtml()}
                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-language text-govbr-600 dark:text-unifesp-400"></i> Compatibilidade com o Lattes (ISO-8859-1)</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        O Currículo Lattes usa a codificação <code class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">ISO-8859-1</code>.
                        A verificação abaixo aponta caracteres fora dessa tabela (ex.: aspas “curvas”, travessão —, emoji) que,
                        na exportação, viram entidades numéricas. Você pode normalizá-los automaticamente.
                    </p>
                    <div class="flex flex-wrap gap-2">
                        <button id="btnCheckEnc" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-spell-check mr-1"></i> Verificar codificação</button>
                        <button id="btnNormalize" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Normalizar pontuação</button>
                    </div>
                    <div id="encResult" class="text-sm mt-3"></div>
                </section>

                ${cfgGroup('fa-award', 'RSC-PCCTAE')}
                ${rscSectionHtml()}

                ${cfgGroup('fa-sliders', 'Avançado')}
                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-list-check text-govbr-600 dark:text-unifesp-400"></i> Listas de autocomplete</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Listas de sugestões dos campos (Instituições, Financiadores/Agências, etc.). Valores já usados no catálogo
                        aparecem automaticamente. Estas listas são <strong>apenas para visualização</strong> — a única forma de
                        alterá-las é a função <strong>Renomear em todos os itens</strong>, garantindo consistência com os itens já lançados.
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-start gap-2">
                        <i aria-hidden="true" class="fa-solid fa-wand-magic-sparkles text-govbr-600 dark:text-unifesp-400 mt-0.5"></i>
                        <span>Para <strong>corrigir/normalizar</strong> um valor (ex.: padronizar o nome de uma instituição), use
                        <strong>Renomear em todos os itens</strong> dentro de cada lista: o novo valor é aplicado a todos os itens que
                        usam o antigo, e os arquivos JSON no diretório são regravados.</span>
                    </p>
                    <div class="space-y-2">
                        ${AUTOCOMPLETE_KEYS.map(k => `
                            <details class="border border-gray-200 dark:border-gray-700 rounded">
                                <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center gap-2">
                                    ${esc(VOCAB_LABELS[k] || k)}
                                    <span class="text-xs font-normal text-gray-500">(${collectSuggestions(k).length})</span>
                                </summary>
                                <div class="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-900/40">
                                    <p class="text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                                        <i aria-hidden="true" class="fa-solid fa-arrows-turn-right mr-1"></i> Renomear em todos os itens
                                    </p>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <select data-renfrom="${k}" class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 flex-1 min-w-[10rem]">
                                            <option value="">— valor atual —</option>
                                            ${collectSuggestions(k).map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}
                                        </select>
                                        <span class="text-gray-400" aria-hidden="true">→</span>
                                        <input type="text" data-rento="${k}" placeholder="Novo valor (normalizado)" class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 flex-1 min-w-[10rem]">
                                        <button type="button" data-rename="${k}" class="px-3 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm whitespace-nowrap disabled:opacity-40" disabled>Aplicar</button>
                                    </div>
                                    <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1" data-rencount="${k}"></p>
                                </div>
                                <div class="p-2">
                                    <p class="text-[11px] text-gray-400 dark:text-gray-500 mb-1"><i aria-hidden="true" class="fa-solid fa-eye mr-1"></i> Somente leitura — use “Renomear” acima para alterar.</p>
                                    <textarea id="vocab-${k}" rows="6" readonly tabindex="-1" aria-label="Sugestões de ${esc(VOCAB_LABELS[k] || k)} (somente leitura)" class="w-full text-sm px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-mono cursor-default resize-none focus:outline-none">${esc(collectSuggestions(k).join('\n'))}</textarea>
                                </div>
                            </details>`).join('')}
                    </div>
                </section>

                ${cfgGroup('fa-triangle-exclamation', 'Zona de risco')}
                <section class="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
                    <button id="btnClear" class="px-3 py-2 rounded bg-red-600 text-white text-sm"><i class="fa-solid fa-trash mr-1"></i> Limpar catálogo (índice local)</button>
                </section>
            </div>`;

        wirePerfilSection();
        wireRscConfig();
        wireExportLattes();
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
                await Storage.ensureSubdirs(LattesTypes.allFolders()); // cria a estrutura de pastas
                try { await Storage.ensureInbox(); } catch (_) {}      // cria "Caixa de Entrada" / "00 Processado"
                toast('Diretório configurado (estrutura de pastas criada).', 'ok');
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
            if (!confirm('Isto apaga TODO o índice local no navegador — itens catalogados, rascunho, prévia de importação, listas de autocomplete e a configuração do RSC-PCCTAE. Os arquivos no diretório NÃO são removidos. Continuar?')) return;
            state.items = [];
            saveCatalog();
            clearDraft();                 // rascunho não salvo (lz_draft)
            state.lattesParsed = null;    // prévia de importação do XML
            state.editingId = null;       // sai de qualquer edição em curso
            state.evEditing = [];         // evidências em edição
            state.vocab = {};             // listas de autocomplete (curadas)
            state.rscCfg = {};            // configuração do RSC-PCCTAE
            // Persiste a limpeza das listas e do RSC nas configurações.
            const s = Storage.loadSettings(); s.vocab = {}; s.rsc = {}; Storage.saveSettings(s);
            resetBackupReminder();        // zera o contador de backup
            toast('Índice local limpo (itens, listas e RSC).', 'ok');
            renderItemList();
            renderConfig();               // re-renderiza a aba (Perfil, listas, RSC, contadores)
        });
        // Renomear/normalizar valores de autocomplete em todos os itens
        $$('[data-renfrom]').forEach(sel => {
            const k = sel.getAttribute('data-renfrom');
            const toEl = document.querySelector(`[data-rento="${k}"]`);
            const btn = document.querySelector(`[data-rename="${k}"]`);
            const cnt = document.querySelector(`[data-rencount="${k}"]`);
            const refresh = () => {
                const f = sel.value.trim();
                if (btn) btn.disabled = !f;
                if (cnt) cnt.textContent = f ? `${itemsUsingValue(k, f).length} item(ns) usam este valor.` : '';
            };
            sel.addEventListener('change', () => {
                if (toEl && sel.value.trim()) toEl.value = sel.value.trim(); // pré-preenche p/ editar
                refresh();
            });
            if (toEl) toEl.addEventListener('input', refresh);
            if (btn) btn.addEventListener('click', () => renameFieldValue(k, sel.value, toEl ? toEl.value : ''));
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
            app: 'lattesZen', version: APP_CONFIG.version, schemaVersion: SCHEMA_VERSION, exportedAt: nowISO(),
            items: state.items,
            // Configurações do sistema (prefixo do identificador, listas de
            // autocomplete, RSC etc.) — sem isto, restaurar o backup num
            // navegador novo perde tudo que está em Configurações.
            settings: Storage.loadSettings(),
        };
        const nome = catalogBaseName();
        // Local padrão: subpasta "00 - Backup" dentro do diretório configurado
        if (Storage.hasDirectory()) {
            try {
                await Storage.writeJson(nome, data, LattesTypes.backupFolder());
                resetBackupReminder();
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
        resetBackupReminder();
    }

    // Higieniza um item vindo de JSON externo (integridade)
    function sanitizeImportedItem(i) {
        if (!Array.isArray(i.evidencias)) {
            i.evidencias = i.hasPdf ? [{ basename: i.id, ext: i.fileExt || 'pdf', name: i.pdfName || `${i.id}.pdf`, publica: true }] : [];
        }
        i.hasPdf = i.evidencias.length > 0;
        if (!i.categoryKey && i.typeKey) i.categoryKey = LattesTypes.primaryCategory(i.typeKey);
        i.schemaVersion = SCHEMA_VERSION;
    }

    async function importCatalog(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const data = JSON.parse(await file.text());
            const items = Array.isArray(data) ? data : data.items;
            if (!Array.isArray(items)) throw new Error('Formato inválido.');
            const byId = new Map(state.items.map(i => [i.id, i]));
            items.forEach(i => { if (i && i.id) { sanitizeImportedItem(i); byId.set(i.id, i); } });
            state.items = Array.from(byId.values());
            saveCatalog();
            // Restaura as configurações do sistema, se presentes no backup (prefixo
            // do identificador, listas de autocomplete, RSC etc.) — essencial ao
            // restaurar num navegador novo, onde essas configurações não existem.
            let restaurouConfig = false;
            if (data.settings && typeof data.settings === 'object') {
                const merged = Object.assign(Storage.loadSettings(), data.settings);
                Storage.saveSettings(merged);
                state.vocab = merged.vocab || {};
                state.idPrefix = sanitizePrefix(merged.idPrefix || 'lz');
                state.lastCat = merged.lastCat || '';
                state.lastType = merged.lastType || '';
                state.rscEnabled = !!merged.rscEnabled;
                state.rscCfg = merged.rsc || {};
                applyRscVisibility();
                restaurouConfig = true;
            }
            toast(`${items.length} item(ns) importado(s) do JSON.${restaurouConfig ? ' Configurações do sistema restauradas.' : ''}`, 'ok');
            renderItemList();
            renderConfig();
        } catch (err) { toast('Falha ao importar: ' + err.message, 'erro'); }
        e.target.value = '';
    }

    /* =====================================================================
       ABA: PUBLICAR (página pública do currículo — 1 arquivo HTML)
       ===================================================================== */
    function fileToDataUrl(file) {
        return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(file); });
    }
    // Linha-resumo (subtítulo) de um item, a partir de campos-chave
    function itemLinha(it) {
        const f = it.fields || {}, title = LattesTypes.itemTitle(it), parts = [];
        const add = v => { v = String(v || '').trim(); if (v && v !== title && !parts.includes(v)) parts.push(v); };
        ['periodico', 'evento', 'instituicao', 'orgao', 'entidade', 'editora', 'cargo', 'tipo', 'financiador', 'autores'].forEach(k => add(f[k]));
        return parts.slice(0, 4).join(' · ');
    }
    const PUB_ICON = { DADOS_GERAIS: '🪪', FORMACAO: '🎓', ATUACAO: '💼', PROJETOS: '🧩', PRODUCOES: '📚', PATENTES_REGISTROS: '📜', INOVACAO: '💡', EDUCACAO_CT: '📢', EVENTOS: '📅', ORIENTACOES: '👥', BANCAS: '⚖️',
        AL_DESENVOLVIMENTO: '🌱', AL_ENGAJAMENTO: '🤝', AL_SAUDE_ESPORTE: '🏃', AL_INTERESSES: '🎨', AL_CERTIFICACAO_CAT: '📜', AL_FILIACAO_CAT: '🪪', AL_CONCURSO_CAT: '📋', AL_IMPRENSA_CAT: '📰' };
    const PUB_EXCLUDE_TYPES = new Set(['IDENTIFICACAO', 'FOTO_PERFIL', 'ENDERECO', 'RESUMO_CV', 'OUTRAS_INFO', 'DOCUMENTO_PESSOAL']);

    async function buildPublicModel() {
        const items = state.items;
        const first = tk => items.find(i => i.typeKey === tk);
        const byType = tk => items.filter(i => i.typeKey === tk);
        const ident = first('IDENTIFICACAO'), resumo = first('RESUMO_CV'), endereco = first('ENDERECO'), outrasI = first('OUTRAS_INFO'), fotoItem = first('FOTO_PERFIL');
        const nome = (ident && ident.fields.titulo) ? ident.fields.titulo : 'Currículo';
        const iniciais = nome.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
        const orcid = (ident && ident.fields.orcid || '').trim();
        const lattesUrl = (ident && ident.fields.url || '').trim();
        const local = endereco ? [endereco.fields.cidade, endereco.fields.uf].filter(Boolean).join(' / ') : '';
        // Áreas de atuação: editadas em Configurações (perfil), não passam
        // mais pelo laço de categorias abaixo — entram direto no cabeçalho.
        const areasAtuacao = byType('AREA_ATUACAO').map(it => LattesTypes.itemTitle(it)).filter(Boolean);

        let foto = null;
        if (fotoItem && Storage.hasDirectory()) {
            const ev = (Array.isArray(fotoItem.evidencias) && fotoItem.evidencias[0]) || (fotoItem.hasPdf ? { basename: fotoItem.id, ext: fotoItem.fileExt || 'jpg' } : null);
            if (ev) { try { const f = await Storage.readAttachmentFile(ev.basename, LattesTypes.categoryFolder('PERFIL_FOTOS'), ev.ext); if (f) foto = await fileToDataUrl(f); } catch (_) {} }
        }

        const contatos = [];
        if (orcid) contatos.push({ grupo: 'Acadêmicas', plataforma: 'ORCID', url: /^https?:/i.test(orcid) ? orcid : 'https://orcid.org/' + orcid, usuario: orcid });
        if (lattesUrl) contatos.push({ grupo: 'Acadêmicas', plataforma: 'Lattes', url: lattesUrl, usuario: '' });
        ['CONEXAO_ACADEMICA', 'CONEXAO_PROFISSIONAL', 'CONEXAO_SOCIAL'].forEach(tk => byType(tk).forEach(i => {
            const u = (i.fields.url || '').trim(); if (!u) return;
            const url = (/@/.test(u) && !/^https?:|^mailto:/i.test(u)) ? 'mailto:' + u : u;
            contatos.push({ grupo: LattesTypes.label(tk), plataforma: i.fields.titulo || LattesTypes.label(tk), url, usuario: i.fields.usuario || '' });
        }));

        const secoes = [];
        for (const cat of LattesTypes.categories) {
            if (cat.key === 'CONEXOES') continue;
            const typeKeys = cat.groups ? cat.groups.flatMap(g => g.types) : (cat.types || []);
            const tipos = [];
            for (const tk of typeKeys) {
                if (PUB_EXCLUDE_TYPES.has(tk)) continue;
                // Casa tipo E categoria do item (um tipo pode figurar em mais de
                // uma categoria; o item pertence só à sua categoria de origem)
                const its = sortByYear(items.filter(i => i.typeKey === tk && i.categoryKey === cat.key), false);
                if (!its.length) continue;
                const itens = [];
                for (const it of its) {
                    const anexos = [];
                    if (Array.isArray(it.evidencias)) {
                        for (const ev of it.evidencias) {
                            if (!ev.publica) continue;
                            if (ev.kind === 'link') { anexos.push({ name: ev.name || ev.url, ext: 'url', url: ev.url }); continue; }
                            if (!Storage.hasDirectory()) continue;
                            try { const f = await Storage.readAttachmentFile(ev.basename, LattesTypes.categoryFolder(it.categoryKey), ev.ext); if (f) { const du = await fileToDataUrl(f); if (du) anexos.push({ name: ev.name || `${ev.basename}.${ev.ext}`, ext: ev.ext, dataUri: du }); } } catch (_) {}
                        }
                    }
                    const y = itemYear(it);
                    itens.push({ titulo: LattesTypes.itemTitle(it), ano: y != null ? String(y) : '', linha: itemLinha(it), anexos });
                }
                tipos.push({ label: LattesTypes.label(tk), itens });
            }
            if (tipos.length) secoes.push({ id: 'sec-' + cat.key.toLowerCase(), num: cat.num, label: cat.label, icon: PUB_ICON[cat.key] || '▣', tipos });
        }
        return {
            nome, iniciais, tagline: (ident && ident.fields.citacoes) || '', bio: (resumo && resumo.fields.descricao) || '',
            foto, local, areasAtuacao, orcid, lattesUrl, contatos, outras: (outrasI && outrasI.fields.descricao) || '',
            secoes, geradoEm: new Date().toLocaleString('pt-BR'), totalItens: items.length,
        };
    }
    async function generatePublicHtml() { return LzPublish.renderHtml(await buildPublicModel(), 'elegante'); }

    function renderPublicar() {
        const panel = $('#tab-publicar');
        panel.innerHTML = `
            <div class="space-y-4 max-w-4xl">
                <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-globe text-govbr-600 dark:text-unifesp-400"></i> Página pública do currículo</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Gera <strong>um único arquivo HTML</strong> (autossuficiente) com todo o currículo. Foto e contatos vêm do perfil e das Conexões. Apenas as evidências marcadas como <strong>“pública”</strong> são embutidas (em base64) e ficam acessíveis na página.</p>
                    <div class="flex gap-2 flex-wrap">
                        <button id="btnPubPreview" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-eye mr-1"></i> Gerar prévia</button>
                        <button id="btnPubSave" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-folder-open mr-1"></i> Salvar na pasta (Publicação/index.html)</button>
                        <button id="btnPubDownload" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-download mr-1"></i> Baixar HTML</button>
                    </div>
                    <p id="pubStatus" class="text-xs text-gray-500 mt-2"></p>
                </section>
                <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white" style="height:75vh">
                    <iframe id="pubPreview" class="w-full h-full" title="Prévia da página pública"></iframe>
                </div>
            </div>`;
        const status = (t) => { const el = $('#pubStatus'); if (el) el.textContent = t; };
        $('#btnPubPreview').addEventListener('click', async () => {
            status('Gerando prévia…');
            try { $('#pubPreview').srcdoc = await generatePublicHtml(); status('Prévia atualizada.'); }
            catch (e) { status(''); toast('Falha ao gerar: ' + e.message, 'erro'); }
        });
        $('#btnPubSave').addEventListener('click', async () => {
            if (!Storage.hasDirectory()) { toast('Configure um diretório em Configurações para salvar na pasta.', 'aviso'); return; }
            status('Gerando e salvando…');
            try {
                const html = await generatePublicHtml();
                await Storage.writeFile('index.html', html, 'Publicação');
                $('#pubPreview').srcdoc = html;
                status('Salvo em “Publicação/index.html”.');
                toast('Página salva em “Publicação/index.html”.', 'ok');
            } catch (e) { status(''); toast('Falha ao salvar: ' + e.message, 'erro'); }
        });
        $('#btnPubDownload').addEventListener('click', async () => {
            status('Gerando arquivo…');
            try {
                const html = await generatePublicHtml();
                $('#pubPreview').srcdoc = html;
                const nome = (state.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo) || {}).fields;
                const safe = (nome && nome.titulo ? nome.titulo : 'curriculo').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-').toLowerCase();
                const blob = new Blob([html], { type: 'text/html' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `curriculo-${safe}.html`; a.click(); URL.revokeObjectURL(a.href);
                status('Arquivo baixado.');
            } catch (e) { status(''); toast('Falha ao gerar: ' + e.message, 'erro'); }
        });
    }

    /* =====================================================================
       ABA: RSC-PCCTAE (simulador + memorial/formulário)
       ===================================================================== */
    // Itens que contam para o RSC (elegíveis, marcados, com critério e não usados)
    function rscItensContados() {
        return state.items.filter(i => i.rsc && i.rsc.conta && i.rsc.criterio && !i.rsc.jaUsado);
    }
    function renderRsc() {
        const panel = $('#tab-rsc');
        if (!state.rscEnabled) {
            panel.innerHTML = `<p class="text-sm text-gray-500 italic py-8 text-center">Módulo RSC desabilitado. Habilite em <strong>Configurações › RSC-PCCTAE</strong>.</p>`;
            return;
        }
        const cfg = state.rscCfg || {};
        const itens = rscItensContados();
        const rscList = itens.map(i => i.rsc);
        const sim = LzRSC.simular(rscList, cfg.escolaridade);

        const reqLinha = (r) => {
            const pr = sim.porRequisito[r];
            return `<tr class="border-b border-gray-100 dark:border-gray-700/60">
                <td class="py-1 pr-2 text-xs">${esc(LzRSC.REQUISITOS[r])}</td>
                <td class="py-1 px-2 text-right tabular-nums">${pr.itens}</td>
                <td class="py-1 px-2 text-right tabular-nums">${pr.criterios.size}</td>
                <td class="py-1 pl-2 text-right tabular-nums font-semibold">${String(pr.pontos).replace('.', ',')}</td></tr>`;
        };
        const niveisLinha = sim.niveis.map(n => {
            const cls = n.atingido ? 'text-green-700 dark:text-green-400' : 'text-gray-500';
            const ic = n.atingido ? 'fa-circle-check' : 'fa-circle';
            const falta = [];
            if (!n.okPontos) falta.push(`+${String(n.faltaPontos).replace('.', ',')} pts`);
            if (!n.okCrit) falta.push(`+${n.faltaCriterios} critério(s)`);
            if (!n.okReq) falta.push('requisito específico');
            if (!n.okEsc) falta.push('escolaridade insuficiente');
            return `<li class="flex items-center gap-2 text-sm ${cls}"><i class="fa-solid ${ic}"></i> ${esc(n.nome)} <span class="text-xs text-gray-400">(${n.min.pontos} pts${n.min.criterios ? ', ' + n.min.criterios + ' crit.' : ''})</span> ${falta.length ? `<span class="text-xs text-amber-600">— falta ${falta.join(', ')}</span>` : ''}</li>`;
        }).join('');

        // Lista de itens contados (conformidade RSC), agrupada por requisito
        const grupos = {};
        itens.forEach(i => { const c = LzRSC.criterio(i.rsc.criterio); const r = c ? c.req : 0; (grupos[r] = grupos[r] || []).push(i); });
        const listaHtml = Object.keys(grupos).sort().map(r => `
            <details open class="border border-gray-200 dark:border-gray-700 rounded mb-2">
                <summary class="cursor-pointer px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-sm font-medium">${esc(LzRSC.REQUISITOS[r] || 'Sem requisito')} <span class="text-xs text-gray-500">(${grupos[r].length})</span></summary>
                <div class="p-2 space-y-1">${grupos[r].map(i => {
                    const pi = LzRSC.pontosItem(i.rsc), c = pi.crit;
                    return `<div class="flex items-center justify-between gap-2 text-sm border border-gray-100 dark:border-gray-700/60 rounded px-2 py-1">
                        <span class="min-w-0"><span class="font-medium">${esc(LattesTypes.itemTitle(i))}</span>
                        <span class="block text-xs text-gray-500">${c ? c.item + '. ' + esc(c.desc) : ''}</span></span>
                        <span class="shrink-0 font-semibold text-amber-700 dark:text-amber-400 tabular-nums">${String(pi.pontos).replace('.', ',')}</span></div>`;
                }).join('')}</div>
            </details>`).join('') || `<p class="text-sm text-gray-500 italic">Nenhum item marcado para o RSC ainda. Em Catalogar, marque “Contabilizar este item no RSC”.</p>`;

        panel.innerHTML = `
            <div class="grid lg:grid-cols-3 gap-4 mb-4">
                <div class="lg:col-span-1 bg-gradient-to-br from-govbr-600 to-govbr-800 dark:from-unifesp-700 dark:to-unifesp-900 text-white rounded-lg p-4">
                    <p class="text-sm opacity-90">Nível alcançável</p>
                    <p class="text-3xl font-bold">${esc(sim.nivelNome)}</p>
                    <p class="text-sm mt-1">Incentivo à Qualificação: <strong>${sim.iq}%</strong></p>
                    <p class="text-xs opacity-80 mt-2">${sim.total.toString().replace('.', ',')} pontos · ${sim.criteriosDistintos} critérios distintos</p>
                    ${cfg.escolaridade ? `<p class="text-xs opacity-80">Escolaridade limita a nível ${sim.capNivel}.</p>` : `<p class="text-xs opacity-90">⚠ Informe a escolaridade em Configurações.</p>`}
                </div>
                <div class="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 class="font-bold text-sm mb-2">Progresso por nível</h3>
                    <ul class="space-y-1">${niveisLinha}</ul>
                </div>
            </div>

            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
                <h3 class="font-bold text-sm mb-2">Pontos por requisito</h3>
                <table class="w-full text-sm"><thead><tr class="text-xs text-gray-500 text-right"><th class="text-left">Requisito</th><th>Itens</th><th>Critérios</th><th>Pontos</th></tr></thead>
                <tbody>${[1, 2, 3, 4, 5, 6].map(reqLinha).join('')}</tbody></table>
            </div>

            <div class="flex gap-2 flex-wrap mb-4">
                <button id="btnRscCsv" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-file-csv mr-1"></i> Exportar planilha (CSV)</button>
                <button id="btnRscMemorial" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-file-lines mr-1"></i> Gerar memorial</button>
                <button id="btnRscForm" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-file-signature mr-1"></i> Gerar formulário</button>
            </div>

            <h3 class="font-bold mb-2">Itens contabilizados</h3>
            ${listaHtml}`;

        $('#btnRscCsv').addEventListener('click', () => downloadText(rscCsv(itens), 'rsc-comprovacao.csv', 'text/csv'));
        $('#btnRscMemorial').addEventListener('click', () => downloadText(rscMemorial(itens, sim, cfg), 'rsc-memorial.txt', 'text/plain'));
        $('#btnRscForm').addEventListener('click', () => downloadText(rscFormulario(sim, cfg), 'rsc-formulario.txt', 'text/plain'));
    }
    function downloadText(txt, nome, mime) {
        const blob = new Blob([txt], { type: (mime || 'text/plain') + ';charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; a.click(); URL.revokeObjectURL(a.href);
    }
    function csvCell(s) { s = String(s == null ? '' : s); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
    function rscCsv(itens) {
        const head = ['Requisito', 'Critério', 'Descrição do critério', 'Item (título)', 'Início', 'Fim', 'Papel', 'Qtd', 'Unitário', 'Pontos', 'Evidências'];
        const rows = itens.map(i => {
            const pi = LzRSC.pontosItem(i.rsc), c = pi.crit || {};
            const nEv = Array.isArray(i.evidencias) ? i.evidencias.length : 0;
            return [c.req || '', c.id || '', c.desc || '', LattesTypes.itemTitle(i), i.rsc.dataInicio || '', i.rsc.dataFim || '',
                (c.pontosSub != null ? i.rsc.papel : ''), pi.quantidade, pi.unitario, pi.pontos, nEv].map(csvCell).join(';');
        });
        return head.map(csvCell).join(';') + '\n' + rows.join('\n');
    }
    function rscMemorial(itens, sim, cfg) {
        const L = [];
        L.push('MEMORIAL — RSC-PCCTAE'); L.push('='.repeat(40));
        L.push(`Cargo: ${cfg.cargo || '—'}   Classe/nível: ${cfg.classe || '—'}`);
        L.push(`Lotação: ${cfg.lotacao || '—'}   SIAPE: ${cfg.siape || '—'}`);
        L.push(`Ingresso no cargo: ${cfg.ingresso || '—'}   Escolaridade: ${(LzRSC.escInfo(cfg.escolaridade) || {}).label || '—'}`);
        L.push(`Nível pleiteável (simulado): ${sim.nivelNome} — ${sim.total.toString().replace('.', ',')} pontos, ${sim.criteriosDistintos} critérios.`);
        L.push('');
        for (let r = 1; r <= 6; r++) {
            const grp = itens.filter(i => { const c = LzRSC.criterio(i.rsc.criterio); return c && c.req === r; });
            if (!grp.length) continue;
            L.push(`REQUISITO ${LzRSC.REQUISITOS[r]}`); L.push('-'.repeat(40));
            grp.forEach(i => {
                const pi = LzRSC.pontosItem(i.rsc), c = pi.crit;
                L.push(`• ${LattesTypes.itemTitle(i)}`);
                L.push(`  Critério ${c.id}: ${c.desc}`);
                const per = (i.rsc.dataInicio || i.rsc.dataFim) ? `  Período: ${i.rsc.dataInicio || '?'} a ${i.rsc.dataFim || '?'}.` : '';
                L.push(`  ${per}  Pontos: ${String(pi.pontos).replace('.', ',')} (${pi.quantidade} × ${String(pi.unitario).replace('.', ',')}).`);
                if (i.rsc.justificativa) L.push(`  Justificativa: ${i.rsc.justificativa}`);
                L.push('');
            });
        }
        return L.join('\n');
    }
    function rscFormulario(sim, cfg) {
        const L = [];
        L.push('FORMULÁRIO — REQUERIMENTO DE RSC-PCCTAE'); L.push('='.repeat(40));
        L.push('1) DADOS FUNCIONAIS');
        L.push(`   Cargo: ${cfg.cargo || '—'}`); L.push(`   Classe/nível: ${cfg.classe || '—'}`);
        L.push(`   SIAPE: ${cfg.siape || '—'}`); L.push(`   Lotação: ${cfg.lotacao || '—'}`);
        L.push(`   Data de ingresso no cargo: ${cfg.ingresso || '—'}`);
        L.push(`   Escolaridade: ${(LzRSC.escInfo(cfg.escolaridade) || {}).label || '—'}`);
        L.push('');
        L.push('2) NÍVEL PLEITEADO');
        L.push(`   Nível RSC-PCCTAE pleiteado: ${sim.nivelNome}`);
        L.push(`   Pontuação apurada: ${sim.total.toString().replace('.', ',')}  |  Critérios distintos: ${sim.criteriosDistintos}`);
        L.push(`   Incentivo à Qualificação correspondente: ${sim.iq}%`);
        L.push('   Saldo de pontos de concessão anterior: ____');
        L.push('');
        L.push('3) DECLARAÇÃO DE CONFORMIDADE');
        L.push('   Declaro que as atividades e experiências relacionadas ocorreram no exercício');
        L.push('   do cargo e que os pontos não foram utilizados em concessões anteriores.');
        L.push('');
        L.push('   Local/Data: ______________________    Assinatura: ______________________');
        return L.join('\n');
    }

    /* =====================================================================
       Navegação por abas
       ===================================================================== */
    const RENDERERS = {
        catalogar: renderCatalogar, conformidade: renderConformidade,
        publicar: renderPublicar, rsc: renderRsc, config: renderConfig,
    };
    // Mostra/oculta a aba RSC conforme o módulo esteja habilitado
    function applyRscVisibility() {
        const btn = $('.tab-btn[data-tab="rsc"]');
        if (btn) btn.classList.toggle('hidden', !state.rscEnabled);
    }
    function switchTab(name) {
        // Guarda de alterações não salvas ao sair de "Catalogar"
        if (state.activeTab === 'catalogar' && name !== 'catalogar' && state.formDirty) {
            if (!confirm('Há alterações não salvas no formulário. Sair mesmo assim?')) return;
            state.formDirty = false;
        }
        state.activeTab = name;
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

        // Escala de fonte (acessibilidade): 80%–150%, passo de 10%.
        const FS_MIN = 80, FS_MAX = 150, FS_STEP = 10;
        const getFS = () => { const n = parseInt(localStorage.getItem('fontScale') || '100', 10); return isNaN(n) ? 100 : n; };
        const applyFS = (n) => {
            n = Math.max(FS_MIN, Math.min(FS_MAX, n));
            htmlEl.style.fontSize = n === 100 ? '' : n + '%';
            localStorage.setItem('fontScale', String(n));
            const dec = $('#fontDec'), inc = $('#fontInc');
            if (dec) dec.disabled = n <= FS_MIN;
            if (inc) inc.disabled = n >= FS_MAX;
        };
        applyFS(getFS());
        const dec = $('#fontDec'), inc = $('#fontInc');
        if (dec) dec.addEventListener('click', () => applyFS(getFS() - FS_STEP));
        if (inc) inc.addEventListener('click', () => applyFS(getFS() + FS_STEP));
    }

    /* =====================================================================
       Inicialização
       ===================================================================== */
    // Compatibiliza itens salvos antes da reestruturação de categorias
    // Pasta antiga da categoria Conexões (98), incorporada a Dados gerais (01).
    const PASTA_CONEXOES_ANTIGA = '98 Conexões';
    // Pasta antiga de Atividades livres (99), renumerada para Registros pessoais (20).
    const PASTA_ATIVIDADES_LIVRES_ANTIGA = '99 Atividades livres';
    // Estrutura de pastas ANTERIOR à reorganização (tudo solto na raiz, sem
    // "Evidências", com Registros pessoais numa única categoria). Usada só
    // para calcular de onde mover os arquivos de cada item já catalogado.
    const OLD_CAT_FOLDER = {
        DADOS_GERAIS: '01 Dados gerais', FORMACAO: '02 Formação', ATUACAO: '03 Atuação',
        PROJETOS: '04 Projetos', PRODUCOES: '05 Produções', PATENTES_REGISTROS: '06 Patentes e Registros',
        INOVACAO: '07 Inovação', EDUCACAO_CT: '08 Educação e Popularização de C&T', EVENTOS: '09 Eventos',
        ORIENTACOES: '10 Orientações', BANCAS: '11 Bancas', RSC_ADMIN: '97 RSC — Atividades administrativas',
        ATIVIDADES_LIVRES: '20 Registros pessoais',
    };
    // Tipos cuja categoria muda nesta reorganização (ganham pasta própria):
    // Foto de perfil e Documentos pessoais saem de Dados gerais; os 15 tipos
    // de Registros pessoais se separam em 8 categorias (12–19).
    const RECATEGORIZADOS = {
        FOTO_PERFIL: 'PERFIL_FOTOS', DOCUMENTO_PESSOAL: 'PERFIL_DOCS',
        AL_CURSO_LIVRE: 'AL_DESENVOLVIMENTO', AL_IDIOMAS: 'AL_DESENVOLVIMENTO', AL_TREINAMENTO: 'AL_DESENVOLVIMENTO', AL_PROJETO_PESSOAL: 'AL_DESENVOLVIMENTO',
        AL_VOLUNTARIADO: 'AL_ENGAJAMENTO', AL_LIDERANCA: 'AL_ENGAJAMENTO', AL_ORG_EVENTO_COM: 'AL_ENGAJAMENTO',
        AL_ESPORTE: 'AL_SAUDE_ESPORTE', AL_COMPETICAO: 'AL_SAUDE_ESPORTE', AL_EXPEDICAO: 'AL_SAUDE_ESPORTE', AL_BEMESTAR: 'AL_SAUDE_ESPORTE',
        AL_HOBBY: 'AL_INTERESSES', AL_COLECIONISMO: 'AL_INTERESSES', AL_CULTURAL: 'AL_INTERESSES', AL_GASTRONOMIA: 'AL_INTERESSES',
        AL_CERTIFICACAO: 'AL_CERTIFICACAO_CAT', AL_FILIACAO: 'AL_FILIACAO_CAT', AL_CONCURSO: 'AL_CONCURSO_CAT', AL_IMPRENSA: 'AL_IMPRENSA_CAT',
    };
    function migrarItens() {
        let changed = false;
        const conexoesMigradas = [];
        const pastasParaMover = []; // { id, oldFolder, newFolder } — nova estrutura ("Evidências" + recategorização)
        state.items.forEach(i => {
            if (i.categoryKey === 'NAO_LATTES') { i.categoryKey = 'ATIVIDADES_LIVRES'; changed = true; }
            if (i.lattesItem === false && !i.categoryKey) { i.categoryKey = 'ATIVIDADES_LIVRES'; changed = true; }
            if (i.typeKey) {
                const norm = LattesTypes.normalizeType(i.typeKey);
                if (norm !== i.typeKey) { i.typeKey = norm; changed = true; }
            }
            if (!i.categoryKey && i.typeKey) { i.categoryKey = LattesTypes.primaryCategory(i.typeKey); changed = true; }
            // Conexões (98) foi incorporada a Dados gerais (01)
            if (i.categoryKey === 'CONEXOES') { i.categoryKey = 'DADOS_GERAIS'; changed = true; conexoesMigradas.push(i.id); }
            // Pasta ANTIGA (antes de qualquer recategorização abaixo) — usada
            // para calcular a origem do arquivo, se ele já existia.
            const oldFolder = OLD_CAT_FOLDER[i.categoryKey] || null;
            // Recategoriza (Foto/Documentos pessoais e os 15 tipos de Registros
            // pessoais, que agora têm categoria/pasta própria).
            if (i.typeKey && RECATEGORIZADOS[i.typeKey] && i.categoryKey !== RECATEGORIZADOS[i.typeKey]) {
                i.categoryKey = RECATEGORIZADOS[i.typeKey];
                changed = true;
            }
            if (oldFolder) {
                const newFolder = LattesTypes.categoryFolder(i.categoryKey);
                if (newFolder !== oldFolder) pastasParaMover.push({ id: i.id, oldFolder, newFolder });
            }
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
            // Carimba a versão do esquema (para migrações futuras)
            if (i.schemaVersion !== SCHEMA_VERSION) { i.schemaVersion = SCHEMA_VERSION; changed = true; }
        });
        if (changed) saveCatalog();
        return { conexoesMigradas, pastasParaMover };
    }

    // Nome no cabeçalho e título da aba: "lattesZen | Nome completo" (vem do
    // item de Identificação). Sem nome preenchido, mostra só "lattesZen".
    function updateHeaderIdentity() {
        const ident = state.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo);
        const nome = ident ? String(ident.fields.titulo).trim() : '';
        const wrap = $('#headerNomeWrap');
        if (wrap) wrap.classList.toggle('hidden', !nome);
        const nomeEl = $('#headerNome');
        if (nomeEl) nomeEl.textContent = nome;
        document.title = nome ? `${APP_CONFIG.name} | ${nome}` : APP_CONFIG.name;
    }

    // Aviso de 1ª execução: mostra uma vez (fica marcado em Configurações/settings)
    // que o app está em desenvolvimento e sem garantias — reforça o backup.
    function wireFirstRunNotice() {
        const modal = $('#firstRunModal');
        const btn = $('#btnFirstRunOk');
        if (!modal || !btn) return;
        const cfg = Storage.loadSettings();
        if (cfg.avisoDevVisto) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        btn.addEventListener('click', () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            const s = Storage.loadSettings(); s.avisoDevVisto = true; Storage.saveSettings(s);
        });
    }

    async function init() {
        // Cabeçalho / rodapé dinâmicos
        document.title = APP_CONFIG.name;
        $('#appVersion').textContent = APP_CONFIG.version;
        $('#lastModDate').textContent = APP_CONFIG.lastModified;

        wireFooterToggles();

        // Carrega catálogo, vocabulários e restaura diretório
        state.items = Storage.loadCatalog();
        const cfg = Storage.loadSettings();
        state.vocab = cfg.vocab || {};
        // Semeia a lista curada de tags de evidências uma única vez (1ª execução);
        // depois disso, o que estiver salvo prevalece (o usuário pode editar/remover).
        if (state.vocab.evidenciaTag === undefined) { state.vocab.evidenciaTag = DEFAULT_EVIDENCE_TAGS.slice(); saveVocab(); }
        state.idPrefix = sanitizePrefix(cfg.idPrefix || 'lz');
        state.lastCat = cfg.lastCat || '';
        state.lastType = cfg.lastType || '';
        state.rscEnabled = !!cfg.rscEnabled;
        state.rscCfg = cfg.rsc || {};
        const { conexoesMigradas, pastasParaMover } = migrarItens();
        updateHeaderIdentity();
        applyRscVisibility();
        try { await Storage.restoreDirectory(); } catch (_) {}
        // Move os arquivos das Conexões migradas da pasta antiga (98) p/ Dados gerais (01)
        if (conexoesMigradas.length && Storage.hasDirectory()) {
            const destino = LattesTypes.categoryFolder('DADOS_GERAIS');
            for (const id of conexoesMigradas) {
                try { await Storage.moveItemFiles(id, PASTA_CONEXOES_ANTIGA, destino); } catch (_) {}
            }
        }
        // Remove a pasta "98 Conexões" da estrutura de diretório: categoria
        // extinta (itens migrados para Dados gerais); só apaga se já vazia.
        if (!cfg.pastaConexoesAntigaRemovida && Storage.hasDirectory()) {
            try { await Storage.removeSubdirIfEmpty(PASTA_CONEXOES_ANTIGA); } catch (_) {}
            cfg.pastaConexoesAntigaRemovida = true;
            Storage.saveSettings(cfg);
        }
        // Move os arquivos de Atividades livres da pasta antiga (99) p/ Registros pessoais (20)
        if (!cfg.pastaRegistrosPessoaisMigrada && Storage.hasDirectory()) {
            const destino = LattesTypes.categoryFolder('ATIVIDADES_LIVRES');
            const idsRegistrosPessoais = state.items.filter(i => i.categoryKey === 'ATIVIDADES_LIVRES').map(i => i.id);
            for (const id of idsRegistrosPessoais) {
                try { await Storage.moveItemFiles(id, PASTA_ATIVIDADES_LIVRES_ANTIGA, destino); } catch (_) {}
            }
            cfg.pastaRegistrosPessoaisMigrada = true;
            Storage.saveSettings(cfg);
        }
        // Reorganização geral da estrutura de pastas: tudo passa a ficar
        // dentro de "Evidências", Registros pessoais se separa em 8
        // categorias, Foto de perfil/Documentos pessoais ganham pasta
        // própria, e "00 Inbox"/"00 Backup" são renomeadas. Roda uma vez.
        if (!cfg.estruturaV2Migrada && Storage.hasDirectory()) {
            try { await Storage.renameRootFolder('00 Inbox', 'Caixa de Entrada'); } catch (_) {}
            try { await Storage.renameRootFolder('00 Backup', 'Cópia de segurança'); } catch (_) {}
            for (const { id, oldFolder, newFolder } of pastasParaMover) {
                try { await Storage.moveItemFiles(id, oldFolder, newFolder); } catch (_) {}
            }
            for (const oldFolder of Object.values(OLD_CAT_FOLDER)) {
                try { await Storage.removeSubdirIfEmpty(oldFolder); } catch (_) {}
            }
            cfg.estruturaV2Migrada = true;
            Storage.saveSettings(cfg);
        }
        // Correção: "Exportar Lattes" (pasta solta na raiz) passa a ficar
        // dentro de "Exportação" (Lattes XML), junto com as demais.
        if (!cfg.exportarLattesMigrada && Storage.hasDirectory()) {
            try { await Storage.renameRootFolder('Exportar Lattes', 'Exportação/Lattes XML'); } catch (_) {}
            cfg.exportarLattesMigrada = true;
            Storage.saveSettings(cfg);
        }

        // Correção: subpasta "00 Processado" (dentro da Caixa de Entrada)
        // passa a se chamar apenas "Processados".
        if (!cfg.pastaProcessadosRenomeada && Storage.hasDirectory()) {
            try { await Storage.renameNestedFolder('Caixa de Entrada', '00 Processado', 'Processados'); } catch (_) {}
            cfg.pastaProcessadosRenomeada = true;
            Storage.saveSettings(cfg);
        }

        // Aviso ao fechar/recarregar com edições não salvas
        window.addEventListener('beforeunload', (e) => { if (state.formDirty) { e.preventDefault(); e.returnValue = ''; } });

        // Abas
        $$('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
        switchTab('catalogar');

        wireFirstRunNotice();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
