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
   lattesZen — Painel de PDF e bandeja de evidências (Catalogar)
   --------------------------------------------------------------------------
   Extraído de tab-catalogar.js (issue de refatoração) — bloco autocontido:
   só usa state/$/$$/esc/toast/isImageExt/isVideoExt/isArchiveExt (AppCore)
   e Storage/LattesTypes (globais), sem nenhuma outra dependência do resto
   do arquivo. Nenhuma mudança de conteúdo, só saiu do arquivo único
   original.
   ========================================================================== */
const { state, $, $$, esc, toast, isImageExt, isVideoExt, isArchiveExt } = window.AppCore;

    /* =====================================================================
       Painel de visualização do PDF (dentro de "Catalogar")
       ===================================================================== */
    function setPdf(url, name, ext) {
        const frame = $('#pdfFrame'), img = $('#pdfImg'), noPreview = $('#pdfNoPreview');
        if (!frame) return; // painel não montado (outra aba ativa)
        if (state.ui.currentPdfUrl && state.ui.currentPdfUrl !== url) {
            try { URL.revokeObjectURL(state.ui.currentPdfUrl); } catch (_) {}
        }
        state.ui.currentPdfUrl = url;
        if (isImageExt(ext)) {
            img.src = url; img.classList.remove('hidden');
            frame.src = 'about:blank'; frame.classList.add('hidden');
            if (noPreview) noPreview.classList.add('hidden');
        } else if (isArchiveExt(ext)) {
            // Arquivo compactado (.zip/.tar/.gz): o navegador não tem visualizador
            // nativo, então navegar o iframe para a blob URL apenas dispara o
            // diálogo de download do sistema — mostra um aviso em vez disso.
            // "Abrir em nova aba" continua funcionando (baixar é o esperado ali).
            frame.src = 'about:blank'; frame.classList.add('hidden');
            img.removeAttribute('src'); img.classList.add('hidden');
            if (noPreview) noPreview.classList.remove('hidden');
        } else {
            // PDF: pede ao visualizador nativo do navegador para ajustar a
            // página inteira à janela (não afeta outros tipos de arquivo).
            frame.src = /^pdf$/i.test(ext || '') ? (url + '#view=Fit') : url;
            frame.classList.remove('hidden');
            img.removeAttribute('src'); img.classList.add('hidden');
            if (noPreview) noPreview.classList.add('hidden');
        }
        $('#pdfEmpty').classList.add('hidden');
        $('#pdfClose').classList.remove('hidden');
        $('#pdfNewTab').classList.remove('hidden');
        $('#pdfPanelName').textContent = name || '';
        const sec = $('#pdfSection'); if (sec) sec.classList.remove('hidden'); // só aparece após uma evidência ser selecionada
    }
    export function clearPdf() {
        const frame = $('#pdfFrame'), img = $('#pdfImg'), noPreview = $('#pdfNoPreview');
        if (state.ui.currentPdfUrl) { try { URL.revokeObjectURL(state.ui.currentPdfUrl); } catch (_) {} state.ui.currentPdfUrl = null; }
        const sec = $('#pdfSection'); if (sec) sec.classList.add('hidden');
        if (!frame) return;
        frame.src = 'about:blank'; frame.classList.add('hidden');
        if (img) { img.removeAttribute('src'); img.classList.add('hidden'); }
        if (noPreview) noPreview.classList.add('hidden');
        $('#pdfEmpty').classList.remove('hidden');
        $('#pdfClose').classList.add('hidden');
        $('#pdfNewTab').classList.add('hidden');
        $('#pdfPanelName').textContent = '';
    }
    function previewPdfFile(file) {
        if (!file) return;
        setPdf(URL.createObjectURL(file), file.name, window.AppCore.fileExt(file));
    }
    export async function showPdfForItem(item) {
        if (!$('#pdfFrame')) return;
        const list = window.AppCore.evListFromItem(item);
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
            const it = state.catalogo.editingId ? state.catalogo.items.find(i => i.id === state.catalogo.editingId) : null;
            const catKey = it ? it.categoryKey : ($('#selCategoria') ? $('#selCategoria').value : null);
            const subdir = LattesTypes.categoryFolder(catKey);
            const url = await Storage.readAttachmentUrl(ev.basename, subdir, ev.ext);
            if (url) setPdf(url, ev.name, ev.ext);
            else toast('Arquivo não encontrado no diretório (sincronize a pasta).', 'aviso');
        } catch (e) { toast('Não foi possível abrir a evidência: ' + e.message, 'aviso'); }
    }

    // Renderiza a lista de evidências no formulário (com reordenar / pública / ver / remover).
    export function renderEvList() {
        const ul = $('#evList');
        if (!ul) return;
        const hint = $('#evHint');
        if (hint) hint.classList.toggle('hidden', !state.catalogo.evEditing.length); // só aparece com evidência carregada
        if (!state.catalogo.evEditing.length) {
            ul.innerHTML = `<li class="text-xs text-gray-500 dark:text-gray-400 italic">Nenhuma evidência anexada.</li>`;
            return;
        }
        ul.innerHTML = state.catalogo.evEditing.map((ev, idx) => {
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
                <button type="button" data-evup="${idx}" title="Subir" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 shrink-0 disabled:opacity-30" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" data-evdown="${idx}" title="Descer" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 shrink-0 disabled:opacity-30" ${idx === state.catalogo.evEditing.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <button type="button" data-evsee="${idx}" title="Ver no painel" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-govbr-600 dark:text-unifesp-400 shrink-0"><i class="fa-solid fa-eye"></i></button>
                <button type="button" data-evdel="${idx}" title="Remover" class="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 shrink-0"><i class="fa-solid fa-xmark"></i></button>
            </li>`;
        }).join('');

        // Miniaturas de imagens já gravadas (carrega do diretório, se houver)
        state.catalogo.evEditing.forEach(async (ev, idx) => {
            if (!isImageExt(ev.ext) || ev.file) return;
            const el = ul.querySelector(`[data-evthumb="${idx}"]`);
            if (!el) return;
            try {
                const it = state.catalogo.editingId ? state.catalogo.items.find(i => i.id === state.catalogo.editingId) : null;
                const catKey = it ? it.categoryKey : ($('#selCategoria') ? $('#selCategoria').value : null);
                const url = await Storage.readAttachmentUrl(ev.basename, LattesTypes.categoryFolder(catKey), ev.ext);
                if (url) el.src = url;
            } catch (_) {}
        });

        $$('[data-evpub]', ul).forEach(c => c.addEventListener('change', (e) => {
            const i = +e.target.dataset.evpub;
            state.catalogo.evEditing[i].publica = e.target.checked; // 0..N públicas (independentes)
            state.ui.formDirty = true;
        }));
        $$('[data-evtag]', ul).forEach(inp => inp.addEventListener('input', (e) => {
            const i = +e.target.dataset.evtag;
            state.catalogo.evEditing[i].tag = e.target.value;
            state.ui.formDirty = true;
        }));
        const swap = (i, j) => { const t = state.catalogo.evEditing[i]; state.catalogo.evEditing[i] = state.catalogo.evEditing[j]; state.catalogo.evEditing[j] = t; state.ui.formDirty = true; renderEvList(); };
        $$('[data-evup]', ul).forEach(b => b.addEventListener('click', (e) => { const i = +e.currentTarget.dataset.evup; if (i > 0) swap(i, i - 1); }));
        $$('[data-evdown]', ul).forEach(b => b.addEventListener('click', (e) => { const i = +e.currentTarget.dataset.evdown; if (i < state.catalogo.evEditing.length - 1) swap(i, i + 1); }));
        $$('[data-evsee]', ul).forEach(b => b.addEventListener('click', (e) => previewEvidence(state.catalogo.evEditing[+e.currentTarget.dataset.evsee])));
        $$('[data-evdel]', ul).forEach(b => b.addEventListener('click', (e) => {
            const i = +e.currentTarget.dataset.evdel;
            const ev = state.catalogo.evEditing[i];
            if (!confirm(`Remover a evidência "${ev.name}"?`)) return;
            state.catalogo.evEditing.splice(i, 1); state.ui.formDirty = true; renderEvList();
        }));
    }

    // Adiciona arquivos à lista de evidências (usado por input, arrastar-soltar
    // e colar). Valida cada arquivo e respeita os tipos aceitos pelo tipo atual.
    export function addEvidenceFiles(files) {
        const inp = $('#pdfInput');
        const allowed = window.AppCore.allowedExtsForAccept(inp ? inp.accept : '');
        // Casa o arquivo anexado com um da bandeja (por nome + tamanho) — assim,
        // mesmo anexando pelo seletor/arrastar, o original é movido p/ Processado.
        const inboxByKey = new Map((state._inbox || []).map(e => [`${e.name}|${e.size}`, e.name]));
        let added = null;
        Array.from(files || []).forEach(f => {
            const err = window.AppCore.checkEvidenceFile(f, allowed);
            if (err) { toast(err, 'aviso'); return; }
            const inboxName = inboxByKey.get(`${f.name}|${f.size}`) || null;
            state.catalogo.evEditing.push({
                basename: null, ext: window.AppCore.fileExt(f), name: f.name || `colado.${window.AppCore.fileExt(f)}`,
                publica: state.catalogo.evEditing.length === 0, tag: '', file: f, inboxName,
            });
            added = f;
            state.ui.formDirty = true;
        });
        renderEvList();
        if (added) previewPdfFile(added);
    }

    // Usa um arquivo da bandeja de entrada como evidência (marcando a origem,
    // para mover o original a "Processados" ao salvar o item).
    async function useInboxFile(entry) {
        const inp = $('#pdfInput');
        const allowed = window.AppCore.allowedExtsForAccept(inp ? inp.accept : '');
        let file;
        try { file = await Storage.readInboxFile(entry.name); }
        catch (e) { toast('Não foi possível ler o arquivo da bandeja: ' + e.message, 'aviso'); return; }
        const err = window.AppCore.checkEvidenceFile(file, allowed);
        if (err) { toast(err, 'aviso'); return; }
        state.catalogo.evEditing.push({
            basename: null, ext: window.AppCore.fileExt(file), name: file.name || entry.name,
            publica: state.catalogo.evEditing.length === 0, tag: '', file, inboxName: entry.name,
        });
        state.ui.formDirty = true;
        renderEvList();
        previewPdfFile(file);
    }

    // Anexa, como evidência, um arquivo já existente no Google Drive do
    // usuário (selecionado no Picker) — em vez de enviar do computador. Se o
    // arquivo escolhido estiver diretamente na Caixa de Entrada, é tratado
    // como se tivesse vindo da bandeja de entrada (mesmo campo `inboxName`
    // usado por useInboxFile): MOVIDO pra Processados ao salvar, depois que
    // a cópia certa já foi gravada na seção da evidência. Em qualquer outro
    // caso (dentro de outra pasta do app, ou fora dele), é só COPIADO — o
    // original no Drive fica intocado.
    export async function addDriveEvidence() {
        const inp = $('#pdfInput');
        const allowed = window.AppCore.allowedExtsForAccept(inp ? inp.accept : '');
        let picked;
        try { picked = await Storage.pickDriveEvidenceFile(); }
        catch (e) { toast('Falha ao selecionar arquivo do Google Drive: ' + e.message, 'erro'); return; }
        if (!picked) return; // cancelado no seletor
        const err = window.AppCore.checkEvidenceFile(picked.file, allowed);
        if (err) { toast(err, 'aviso'); return; }
        state.catalogo.evEditing.push({
            basename: null, ext: window.AppCore.fileExt(picked.file), name: picked.file.name,
            publica: state.catalogo.evEditing.length === 0, tag: '', file: picked.file,
            inboxName: picked.driveSourceInbox ? picked.file.name : null,
        });
        state.ui.formDirty = true;
        renderEvList();
        previewPdfFile(picked.file);
    }

    // Bandeja de entrada: botão com um badge de contagem (sem listar os
    // arquivos). Clicar no botão anexa o próximo arquivo pendente ainda não
    // usado neste item.
    export async function renderInbox() {
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
    export async function useNextInbox() {
        const itens = state._inbox || [];
        const staged = new Set(state.catalogo.evEditing.filter(e => e.inboxName).map(e => e.inboxName));
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
    export function addUrlEvidence() {
        const inp = $('#evUrlInput');
        const url = normalizeUrl(inp.value);
        if (!url) { toast('Informe um link (URL) válido.', 'aviso'); return; }
        state.catalogo.evEditing.push({
            kind: 'link', basename: null, ext: 'url', file: null,
            name: url, url, publica: state.catalogo.evEditing.length === 0, tag: '',
        });
        state.ui.formDirty = true;
        inp.value = '';
        $('#evUrlRow').classList.add('hidden');
        renderEvList();
    }
