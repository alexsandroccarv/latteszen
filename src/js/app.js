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
   lattesZen — Orquestrador principal (SPA)
   ========================================================================== */
(function () {
    'use strict';

    // Título estático da página (vem do <title> do index.html — ver issue de
    // SEO #37) — usado como "padrão" em updateHeaderIdentity() abaixo, em vez
    // de sempre reescrever pra "lattesZen" quando não há nome de perfil salvo
    // (o que jogaria fora o título descritivo original).
    const TITULO_PAGINA_BASE = document.title;

    // Versão do esquema dos itens (carimbada em cada item para migrações futuras)
    const SCHEMA_VERSION = 2;
    // Publicado em AppCore para tab-config.js — mesmo motivo de uid/nowISO.
    window.AppCore.SCHEMA_VERSION = SCHEMA_VERSION;
    // Converte um valor para exportação XML (N/A vira branco). Uso futuro.
    function xmlExportValue(v) { return v === NA_VALUE ? '' : v; }

    /* -------- Estado e utilidades compartilhadas (ver src/js/app-core.js) --
       Extraídas para app-core.js conforme as abas vão sendo divididas em
       módulos próprios (tab-publicar.js foi a primeira) — desestruturado
       aqui por referência, então o restante deste arquivo continua usando
       os mesmos identificadores de sempre, sem precisar reescrever nada. */
    const {
        state, $, $$, esc, toast, anoDe, isImageExt, isVideoExt, isArchiveExt, NA_VALUE, itemYear, sortByYear, publicarWebOk,
        elegivelAoLattes, itemsUsingValue, normNome,
        validateISSN, validateISBN, validateISBNorISSN, validateDOI, validateURL, validateField,
        setFieldError, associateLabels, isFieldDisabled, evCount, descState,
    } = window.AppCore;

    /* -------- Primitivas de tab-catalogar.js usadas pelo restante deste ----
       arquivo (rascunho automático e atalhos de teclado) — tab-catalogar.js
       carrega ANTES deste arquivo, então é seguro desestruturar direto no
       topo: quando esta linha roda, o módulo já publicou tudo. */
    const { buildForm, collectFields, wireKeyboardShortcuts, DEFAULT_EVIDENCE_TAGS } = window.AppCore;

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
    // Publicado em AppCore para tab-catalogar.js — mesmo motivo de uid/nowISO.
    window.AppCore.randCode = randCode;
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
    // Publicado em AppCore para tab-config.js — mesmo motivo de uid/nowISO.
    window.AppCore.sanitizePrefix = sanitizePrefix;
    function nowISO() { return new Date().toISOString(); }
    // uid/nowISO publicados em AppCore para os módulos de aba já extraídos
    // (ex.: tab-conformidade.js, ao duplicar um item) — carregam ANTES deste
    // arquivo, então só podem ler isto em tempo de clique, nunca no topo.
    window.AppCore.uid = uid;
    window.AppCore.nowISO = nowISO;

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
    // Publicado em AppCore para tab-catalogar.js — mesmo motivo de uid/nowISO.
    window.AppCore.fileExt = fileExt;

    // Extensões de evidência aceitas por tipo de item (accept do <input file>).
    // Os dois tipos restritos a documento/foto continuam só PDF/imagem; os
    // demais aceitam o conjunto amplo (PDF, imagem, vídeo, zip/tar.gz).
    const EVID_EXTS_DEFAULT = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'avi', 'mkv', 'zip', 'tar', 'gz'];
    const EVID_ACCEPT_DEFAULT = 'application/pdf,image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,application/zip,application/x-zip-compressed,application/gzip,application/x-gzip,application/x-tar';
    // Publicado em AppCore para tab-catalogar.js (padrão "accept" default do
    // input de evidências) — mesmo motivo de uid/nowISO.
    window.AppCore.EVID_ACCEPT_DEFAULT = EVID_ACCEPT_DEFAULT;
    function allowedExtsForAccept(acc) {
        if (acc === 'image/jpeg,image/png') return ['jpg', 'jpeg', 'png'];
        if (acc === 'application/pdf,image/jpeg,image/png') return ['pdf', 'jpg', 'jpeg', 'png'];
        return EVID_EXTS_DEFAULT;
    }
    // Publicado em AppCore para tab-catalogar.js — mesmo motivo de uid/nowISO.
    window.AppCore.allowedExtsForAccept = allowedExtsForAccept;

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
    // Publicado em AppCore para tab-catalogar.js — mesmo motivo de uid/nowISO.
    window.AppCore.checkEvidenceFile = checkEvidenceFile;

    /* --------------------------- Persistência --------------------------- */
    // Grava o índice no localStorage protegendo contra estouro de cota.
    function saveCatalog() {
        try { Storage.saveCatalog(state.items); return true; }
        catch (e) {
            toast('Não foi possível salvar no navegador (armazenamento cheio). Exporte um backup em Configurações e/ou remova itens.', 'erro');
            return false;
        }
    }
    // Publicado em AppCore para tab-catalogar.js — mesmo motivo de uid/nowISO.
    window.AppCore.saveCatalog = saveCatalog;
    function saveTrash() {
        try { Storage.saveTrash(state.trash); return true; }
        catch (e) {
            toast('Não foi possível salvar a lixeira (armazenamento cheio).', 'erro');
            return false;
        }
    }

    // Verifica se a pasta configurada continua acessível (permissão + a pasta
    // ainda existir de fato) e atualiza o aviso persistente no topo da página.
    // { requestIfNeeded: true } só a partir de um clique do usuário (gesto) —
    // é o que reabre o prompt nativo do navegador para reconceder permissão.
    async function checkDirHealth(opts) {
        if (!Storage.hasDirectory()) { state.dirHealth = null; renderDirBanner(); return; }
        state.dirHealth = await Storage.checkHealth(opts);
        renderDirBanner();
    }
    // Publicado em AppCore para tab-config.js — mesmo motivo de uid/nowISO.
    window.AppCore.checkDirHealth = checkDirHealth;
    function renderDirBanner() {
        const banner = $('#dirHealthBanner');
        if (!banner) return;
        const problema = state.dirHealth && state.dirHealth.ok === false;
        banner.classList.toggle('hidden', !problema);
        if (problema) {
            const gdrive = Storage.storageMode() === 'gdrive';
            const msg = state.dirHealth.reason === 'permission'
                ? (gdrive ? 'Sessão do Google Drive expirada ou acesso revogado — reconecte em Configurações.' : 'Sem permissão de acesso à pasta configurada — os arquivos não estão sendo salvos nela. Verifique em Configurações.')
                : state.dirHealth.reason === 'network'
                ? 'Não foi possível conectar ao armazenamento remoto — verifique sua conexão com a internet.'
                : (gdrive ? 'A pasta do lattesZen não foi encontrada no Google Drive (pode ter sido movida ou excluída).' : 'A pasta configurada não foi encontrada (pode ter sido movida, renomeada ou apagada) — os arquivos não estão sendo salvos nela.');
            const el = $('#dirHealthMsg'); if (el) el.textContent = msg;
        }
    }
    // Publicado em AppCore para tab-config.js — mesmo motivo de uid/nowISO.
    window.AppCore.renderDirBanner = renderDirBanner;
    // Texto de status usado na seção "Diretório de armazenamento" em Configurações.
    function dirHealthStatusHtml() {
        if (!state.dirHealth) return `<span class="text-gray-500"><i aria-hidden="true" class="fa-solid fa-circle-question mr-1"></i> Ainda não verificado.</span>`;
        if (state.dirHealth.ok) return `<span class="text-green-700 dark:text-green-400"><i aria-hidden="true" class="fa-solid fa-circle-check mr-1"></i> Acessível.</span>`;
        const gdrive = Storage.storageMode() === 'gdrive';
        const msg = state.dirHealth.reason === 'permission'
            ? (gdrive ? 'Sessão expirada ou acesso revogado — clique em "Conectar ao Google Drive" novamente.' : 'Sem permissão de acesso — clique em "Verificar pasta" para conceder novamente.')
            : state.dirHealth.reason === 'network'
            ? 'Falha de conexão com o armazenamento remoto — verifique sua internet.'
            : (gdrive ? 'Pasta não encontrada no Google Drive — pode ter sido movida ou excluída.' : 'Pasta não encontrada — pode ter sido movida, renomeada ou apagada.');
        return `<span class="text-red-700 dark:text-red-400"><i aria-hidden="true" class="fa-solid fa-triangle-exclamation mr-1"></i> ${esc(msg)}</span>`;
    }
    // Publicado em AppCore para tab-config.js — mesmo motivo de uid/nowISO.
    window.AppCore.dirHealthStatusHtml = dirHealthStatusHtml;
    function saveVocab() {
        const s = Storage.loadSettings();
        s.vocab = state.vocab;
        Storage.saveSettings(s);
    }
    // Publicado em AppCore para tab-catalogar.js — mesmo motivo de uid/nowISO.
    window.AppCore.saveVocab = saveVocab;

    // Sincroniza o catálogo local a partir dos arquivos *.json do diretório:
    // mescla por id (nunca remove itens que só existem no índice local —
    // sincronizar só pode ACRESCENTAR/atualizar, não apagar nada). Usada tanto
    // pelo botão manual "Sincronizar do diretório" quanto pela sincronização
    // automática (ao escolher a pasta, e quando o índice local está vazio mas
    // já existe um diretório configurado — ver init()).
    async function syncFromDirectory() {
        const found = await Storage.scanDirectory();
        const byId = new Map(state.items.map(i => [i.id, i]));
        found.forEach(f => byId.set(f.id, f));
        state.items = Array.from(byId.values());
        saveCatalog();

        // Restaura as configurações do sistema (prefixo do identificador,
        // listas de autocomplete, RSC/Súmula etc.) a partir de
        // configuracoes.json, se o diretório tiver uma — mesmo mecanismo já
        // usado pra restaurar um backup completo importado, só que automático
        // a cada sincronização. É o que permite recuperar tudo (itens +
        // configurações) num navegador/perfil novo só reescaneando o
        // diretório, sem depender de lembrar de exportar/importar um backup.
        let configRestaurada = false;
        try {
            const dirSettings = await Storage.readSettingsFromDirectory();
            if (dirSettings && typeof dirSettings === 'object') {
                const merged = Object.assign(Storage.loadSettings(), dirSettings);
                Storage.saveSettings(merged);
                state.vocab = merged.vocab || {};
                state.idPrefix = sanitizePrefix(merged.idPrefix || 'lz');
                state.lastCat = merged.lastCat || '';
                state.lastType = merged.lastType || '';
                state.rsc.enabled = !!merged.rscEnabled;
                state.rsc.cfg = merged.rsc || {};
                state.rsc.memorialTexto = merged.rscMemorialTexto || '';
                applyRscVisibility();
                state.sumula.enabled = !!merged.sumulaEnabled;
                state.sumula.cfg = merged.sumula || {};
                state.sumula.texto = merged.sumulaTexto || '';
                applySumulaVisibility();
                state.pubWebEnabled = merged.pubWebEnabled !== undefined ? !!merged.pubWebEnabled : state.items.length > 0;
                applyPublicarVisibility();
                state.linhaTempo.nuvemExclusao = Array.isArray(merged.nuvemExclusao) ? merged.nuvemExclusao : [];
                state.linhaTempo.nuvemCompostas = Array.isArray(merged.nuvemCompostas) ? merged.nuvemCompostas : [];
                configRestaurada = true;
            }
        } catch (_) {}

        return { encontrados: found.length, configRestaurada };
    }
    // Publicado em AppCore para tab-config.js — mesmo motivo de uid/nowISO.
    window.AppCore.syncFromDirectory = syncFromDirectory;

    // Lembrete de backup: conta gravações desde o último export e avisa a cada 20.
    function bumpBackupReminder() {
        // Com um diretório configurado, cada item já grava seu próprio JSON e
        // as configurações do sistema também se auto-salvam (configuracoes.json
        // — ver Storage.saveSettings/scheduleSettingsWrite): reescanear o
        // diretório já traz tudo de volta, então o lembrete de backup manual
        // só faz sentido pra quem ainda não tem diretório (só localStorage).
        if (Storage.hasDirectory()) return;
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
    // Publicado em AppCore para tab-config.js — mesmo motivo de uid/nowISO.
    window.AppCore.resetBackupReminder = resetBackupReminder;

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
    // Publicado em AppCore para tab-catalogar.js — mesmo motivo de uid/nowISO.
    window.AppCore.saveDraftDebounced = saveDraftDebounced;
    function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (_) {} const b = $('#draftBanner'); if (b) b.innerHTML = ''; }
    // Publicado em AppCore para tab-catalogar.js — mesmo motivo de uid/nowISO.
    window.AppCore.clearDraft = clearDraft;
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
    // Publicado em AppCore para tab-catalogar.js — mesmo motivo de uid/nowISO.
    window.AppCore.maybeShowDraftBanner = maybeShowDraftBanner;
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
        state.ui.formDirty = true;
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
    // Publicado em AppCore para os módulos de aba já extraídos (ex.:
    // tab-conformidade.js, ao duplicar um item) — mesmo motivo de uid/nowISO.
    window.AppCore.persistItem = persistItem;

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
    // Publicado em AppCore para tab-catalogar.js — mesmo motivo de uid/nowISO.
    window.AppCore.evListFromItem = evListFromItem;

    // Lixeira: itens excluídos ficam aqui por TRASH_RETENTION_DIAS antes da
    // purga automática (ver purgeOldTrash(), rodado uma vez a cada início).
    const TRASH_RETENTION_DIAS = 30;
    // Publicado em AppCore para tab-config.js — mesmo motivo de uid/nowISO.
    window.AppCore.TRASH_RETENTION_DIAS = TRASH_RETENTION_DIAS;

    // "Exclusão" move o item para a lixeira (state.trash) em vez de apagar de
    // vez — os arquivos, se houver diretório configurado, vão para a pasta
    // "Lixeira" (não são removidos). Restaurar (restoreItem) desfaz os dois.
    async function deleteItem(id) {
        const idx = state.items.findIndex(i => i.id === id);
        if (idx === -1) return;
        const item = state.items[idx];
        state.items.splice(idx, 1);
        saveCatalog();
        const fromFolder = LattesTypes.categoryFolder(item.categoryKey);
        item.deletedAt = nowISO();
        item.trashFromFolder = fromFolder; // pra saber de onde restaurar depois
        state.trash.unshift(item);
        saveTrash();
        if (Storage.hasDirectory()) {
            try { await Storage.moveItemFiles(id, fromFolder, LattesTypes.lixeiraFolder()); } catch (_) {}
        }
    }
    // Publicado em AppCore para os módulos de aba já extraídos (ex.:
    // tab-conformidade.js, ao excluir um item) — mesmo motivo de uid/nowISO.
    window.AppCore.deleteItem = deleteItem;

    // Restaura um item da lixeira de volta ao catálogo (e move os arquivos de
    // volta para a pasta original da categoria, se houver diretório).
    async function restoreItem(id) {
        const idx = state.trash.findIndex(i => i.id === id);
        if (idx === -1) return;
        const item = state.trash[idx];
        state.trash.splice(idx, 1);
        saveTrash();
        const toFolder = item.trashFromFolder || LattesTypes.categoryFolder(item.categoryKey);
        delete item.deletedAt; delete item.trashFromFolder;
        state.items.push(item);
        saveCatalog();
        if (Storage.hasDirectory()) {
            try { await Storage.moveItemFiles(id, LattesTypes.lixeiraFolder(), toFolder); } catch (_) {}
        }
    }
    // Publicado em AppCore para tab-config.js — mesmo motivo de uid/nowISO.
    window.AppCore.restoreItem = restoreItem;

    // Exclui definitivamente um item já na lixeira (não pode mais ser desfeito).
    async function purgeTrashItem(id) {
        const idx = state.trash.findIndex(i => i.id === id);
        if (idx === -1) return;
        state.trash.splice(idx, 1);
        saveTrash();
        try { await Storage.deleteItemFiles(id, LattesTypes.lixeiraFolder()); } catch (_) {}
    }
    // Publicado em AppCore para tab-config.js — mesmo motivo de uid/nowISO.
    window.AppCore.purgeTrashItem = purgeTrashItem;

    // Esvazia a lixeira inteira (usado pelo botão "Esvaziar lixeira" e pela
    // purga automática de itens antigos no início do app).
    async function emptyTrash(ids) {
        const alvo = ids || state.trash.map(i => i.id);
        for (const id of alvo) { try { await Storage.deleteItemFiles(id, LattesTypes.lixeiraFolder()); } catch (_) {} }
        state.trash = state.trash.filter(i => !alvo.includes(i.id));
        saveTrash();
    }
    // Publicado em AppCore para tab-config.js — mesmo motivo de uid/nowISO.
    window.AppCore.emptyTrash = emptyTrash;

    // Purga automática: itens na lixeira há mais de TRASH_RETENTION_DIAS.
    // Roda uma vez no início do app (init()).
    async function purgeOldTrash() {
        const limite = Date.now() - TRASH_RETENTION_DIAS * 24 * 60 * 60 * 1000;
        const vencidos = state.trash.filter(i => new Date(i.deletedAt).getTime() < limite).map(i => i.id);
        if (vencidos.length) await emptyTrash(vencidos);
    }

    /* =====================================================================
       Navegação por abas
       ===================================================================== */
    const RENDERERS = {
        inicio: TabInicio.render, catalogar: TabCatalogar.render, conformidade: TabConformidade.render,
        linhatempo: TabLinhaTempo.render, publicar: TabPublicar.render, rsc: TabRsc.render, sumula: TabSumula.render, config: TabConfig.render,
    };
    // Abas que dependem de haver um diretório de armazenamento configurado
    // (local ou Google Drive) — ficam travadas até a pessoa escolher um em
    // Configurações › Armazenamento. "Início" e "Configurações" continuam
    // sempre livres: é lá que mora o assistente de escolha do diretório (e
    // Início já linka pra lá em "Primeiros passos").
    const DIR_GATED_TABS = ['catalogar', 'conformidade', 'linhatempo', 'publicar', 'rsc', 'sumula'];
    // Mesma trava, agora também para 3 das 4 páginas do menu lateral de
    // Configurações — só "Armazenamento" (onde mora o assistente de escolha
    // do diretório) fica sempre livre; "Trazer e levar dados", "Outros
    // recursos" e "Zona de risco" dependem de já haver um diretório.
    const DIR_GATED_CFG_GROUPS = ['grp-fontes', 'grp-opcionais', 'grp-risco'];
    // Trava real desligável só em teste (window.__LZ_TEST_SKIP_DIR_GATE) —
    // mesmo padrão de window.__LZ_TEST_ANALYTICS_ID em config.js: sem isto,
    // toda a suíte de regressão (que semeia o catálogo direto no
    // localStorage, sem configurar diretório) ficaria travada fora de
    // Início/Configurações. tools/tests/harness.mjs liga o bypass por
    // padrão em todo teste; tools/tests/specs/dir-gate.mjs desliga pra
    // testar a trava de verdade.
    function dirGateBypass() { return typeof window !== 'undefined' && !!window.__LZ_TEST_SKIP_DIR_GATE; }
    // Usado tanto pelo menu lateral (wireCfgSidebar) quanto pelo cálculo
    // defensivo de cfgAtiva em tab-config.js's render() — mesma trava real
    // (não só visual) que switchTab() já aplica às abas de nível superior.
    function cfgGroupGated(groupId) {
        return DIR_GATED_CFG_GROUPS.includes(groupId) && !dirGateBypass() && !Storage.hasDirectory();
    }
    window.AppCore.cfgGroupGated = cfgGroupGated;
    // Acinzenta/desabilita os botões das abas travadas (com dica explicando
    // o motivo) enquanto Storage.hasDirectory() for falso. Chamada no boot
    // (init, após Storage.restoreDirectory) e sempre que TabConfig re-
    // renderiza (escolher pasta, "Esquecer diretório de armazenamento",
    // conectar/migrar Google Drive — todas essas ações já chamam render()
    // em seguida). Também trava os mesmos 3 links do menu lateral de
    // Configurações (ver DIR_GATED_CFG_GROUPS acima).
    function applyDirGate() {
        const travado = !dirGateBypass() && !Storage.hasDirectory();
        $$('.tab-btn').forEach(b => {
            if (!DIR_GATED_TABS.includes(b.dataset.tab)) return;
            b.disabled = travado;
            b.classList.toggle('opacity-40', travado);
            b.classList.toggle('cursor-not-allowed', travado);
            b.classList.toggle('pointer-events-none', travado);
            b.title = travado ? 'Configure um diretório de armazenamento em Configurações › Armazenamento antes de usar esta seção' : '';
        });
        $$('[data-cfg-page-link]').forEach(b => {
            if (!DIR_GATED_CFG_GROUPS.includes(b.dataset.cfgPageLink)) return;
            b.disabled = travado;
            b.classList.toggle('opacity-40', travado);
            b.classList.toggle('cursor-not-allowed', travado);
            b.classList.toggle('pointer-events-none', travado);
            b.title = travado ? 'Configure um diretório de armazenamento em Configurações › Armazenamento antes de usar esta seção' : '';
        });
    }
    // Publicado em AppCore para tab-config.js (chamado a cada render() da
    // aba Configurações) — mesmo motivo de uid/nowISO.
    window.AppCore.applyDirGate = applyDirGate;
    // Mostra/oculta a aba RSC conforme o módulo esteja habilitado
    function applyRscVisibility() {
        const btn = $('.tab-btn[data-tab="rsc"]');
        if (btn) btn.classList.toggle('hidden', !state.rsc.enabled);
    }
    // Publicado em AppCore para tab-config.js — mesmo motivo de uid/nowISO.
    window.AppCore.applyRscVisibility = applyRscVisibility;
    // Mostra/oculta a aba Súmula FAPESP conforme o módulo esteja habilitado
    // (mesmo mecanismo do RSC acima).
    function applySumulaVisibility() {
        const btn = $('.tab-btn[data-tab="sumula"]');
        if (btn) btn.classList.toggle('hidden', !state.sumula.enabled);
    }
    window.AppCore.applySumulaVisibility = applySumulaVisibility;
    // Mostra/oculta a aba Publicar na Web conforme o toggle em Configurações
    // (mesmo mecanismo do RSC acima).
    function applyPublicarVisibility() {
        const btn = $('.tab-btn[data-tab="publicar"]');
        if (btn) btn.classList.toggle('hidden', !state.pubWebEnabled);
    }
    window.AppCore.applyPublicarVisibility = applyPublicarVisibility;
    function switchTab(name) {
        // Trava de verdade (não só visual): mesmo que alguém chame
        // switchTab() direto (ex.: botão "Ir para Catalogar" em Início),
        // sem diretório configurado a troca não acontece.
        if (DIR_GATED_TABS.includes(name) && !dirGateBypass() && !Storage.hasDirectory()) {
            toast('Configure um diretório de armazenamento em Configurações › Armazenamento antes de usar esta seção.', 'aviso');
            return;
        }
        // Guarda de alterações não salvas ao sair de "Catalogar"
        if (state.ui.activeTab === 'catalogar' && name !== 'catalogar' && state.ui.formDirty) {
            if (!confirm('Há alterações não salvas no formulário. Sair mesmo assim?')) return;
            state.ui.formDirty = false;
        }
        state.ui.activeTab = name;
        // headerConfigBtn não é um role="tab" de verdade (fica fora do
        // role="tablist" da régua de abas — issue de acessibilidade #17),
        // então usa aria-pressed (padrão "toggle button") em vez de
        // aria-selected, que só é válido em elementos com role tab/option/row.
        $$('.tab-btn').forEach(b => {
            const ativo = b.dataset.tab === name ? 'true' : 'false';
            b.setAttribute(b.id === 'headerConfigBtn' ? 'aria-pressed' : 'aria-selected', ativo);
        });
        $$('.tab-panel').forEach(p => p.hidden = (p.id !== 'tab-' + name));
        RENDERERS[name] && RENDERERS[name]();
    }
    // Publicado em AppCore para os módulos de aba já extraídos (ex.:
    // tab-inicio.js) poderem trocar de aba — eles carregam ANTES deste
    // arquivo, então só podem ler isto em tempo de clique, nunca no topo.
    window.AppCore.switchTab = switchTab;

    /* =====================================================================
       Rodapé: alto contraste e escala de fonte
       ===================================================================== */
    function wireFooterToggles() {
        const htmlEl = document.documentElement;
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
    // Pastas antigas (subpasta própria, 01.1/01.2) de Foto de perfil/
    // Documentos pessoais/Identidade/Passaporte — mescladas de volta direto
    // em "01 Dados gerais" (a pedido do usuário), junto dos demais itens da
    // categoria, em vez de ficarem soltas em Configurações.
    const PASTA_FOTOS_PERFIL_ANTIGA = 'Evidências/01 Dados gerais/01.1 Fotos de Perfil';
    const PASTA_DOCUMENTOS_PESSOAIS_ANTIGA = 'Evidências/01 Dados gerais/01.2 Documentos pessoais';
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
    // Tipos cuja categoria muda nesta reorganização: os 15 tipos de
    // Registros pessoais se separam em 8 categorias (12–19). Foto de
    // perfil/Documentos pessoais voltam para Dados gerais (mesclados de
    // volta, junto de Identidade/Passaporte — ver migração de pastas mais
    // abaixo, que move os arquivos da subpasta própria pra "01 Dados gerais").
    const RECATEGORIZADOS = {
        FOTO_PERFIL: 'DADOS_GERAIS', DOCUMENTO_PESSOAL: 'DADOS_GERAIS', DOC_IDENTIDADE: 'DADOS_GERAIS', DOC_PASSAPORTE: 'DADOS_GERAIS',
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
    // item de Identificação). Sem nome preenchido, mantém o título estático
    // da página (TITULO_PAGINA_BASE, acima).
    function updateHeaderIdentity() {
        const ident = state.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo);
        const nome = ident ? String(ident.fields.titulo).trim() : '';
        const wrap = $('#headerNomeWrap');
        if (wrap) wrap.classList.toggle('hidden', !nome);
        const nomeEl = $('#headerNome');
        if (nomeEl) nomeEl.textContent = nome;
        document.title = nome ? `${APP_CONFIG.name} | ${nome}` : TITULO_PAGINA_BASE;
    }
    // Publicado em AppCore para tab-config.js — mesmo motivo de uid/nowISO.
    window.AppCore.updateHeaderIdentity = updateHeaderIdentity;

    // Navegação por setas na régua de abas (issue #17 — auditoria de
    // acessibilidade): role="tablist"/"tab" já existiam, mas só davam pra
    // trocar de aba com Tab (uma a uma) + Enter/Espaço — o padrão do WAI-ARIA
    // Authoring Practices para tablist espera ←/→ (e Home/End) movendo o
    // foco ENTRE as abas, com ativação automática (mais simples aqui, já
    // que trocar de aba é barato). Só considera abas visíveis e habilitadas
    // (RSC/Súmula/Publicar podem estar ocultas; as travadas por
    // "sem diretório" ficam desabilitadas) — e não inclui o botão de
    // Configurações do cabeçalho, que não tem role="tab" (não faz parte
    // deste tablist visualmente nem estruturalmente).
    function wireTabListKeyboardNav() {
        const tablist = document.querySelector('[role="tablist"]');
        if (!tablist) return;
        tablist.addEventListener('keydown', (e) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
            const abas = $$('[role="tab"]', tablist).filter(b => !b.disabled && !b.classList.contains('hidden'));
            const atual = abas.indexOf(document.activeElement);
            if (atual === -1) return;
            e.preventDefault();
            let alvo;
            if (e.key === 'Home') alvo = 0;
            else if (e.key === 'End') alvo = abas.length - 1;
            else if (e.key === 'ArrowRight') alvo = (atual + 1) % abas.length;
            else alvo = (atual - 1 + abas.length) % abas.length;
            abas[alvo].focus();
            switchTab(abas[alvo].dataset.tab);
        });
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
        // Armadilha de foco (issue #17): sem isto, Tab escapava do modal e
        // chegava em botões/campos da página por trás — role="alertdialog"
        // ficava só decorativo pra quem navega por teclado/leitor de tela.
        const liberarFoco = window.LzA11y && window.LzA11y.trapFocus(modal, { onEscape: fechar, initialFocus: btn });
        function fechar() {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            if (liberarFoco) liberarFoco();
            const s = Storage.loadSettings(); s.avisoDevVisto = true; Storage.saveSettings(s);
        }
        btn.addEventListener('click', fechar);
    }

    async function init() {
        // Cabeçalho / rodapé dinâmicos
        document.title = APP_CONFIG.name;
        $('#appVersion').textContent = APP_CONFIG.version;

        wireFooterToggles();
        wireKeyboardShortcuts();
        const dirHealthGoto = $('#dirHealthGoto');
        if (dirHealthGoto) dirHealthGoto.addEventListener('click', () => {
            switchTab('config');
            const sec = $('#dirSection');
            if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        // Carrega catálogo, vocabulários e restaura diretório
        state.items = Storage.loadCatalog();
        state.trash = Storage.loadTrash();
        const cfg = Storage.loadSettings();
        state.vocab = cfg.vocab || {};
        // Semeia a lista curada de tags de evidências uma única vez (1ª execução);
        // depois disso, o que estiver salvo prevalece (o usuário pode editar/remover).
        if (state.vocab.evidenciaTag === undefined) { state.vocab.evidenciaTag = DEFAULT_EVIDENCE_TAGS.slice(); saveVocab(); }
        state.idPrefix = sanitizePrefix(cfg.idPrefix || 'lz');
        state.lastCat = cfg.lastCat || '';
        state.lastType = cfg.lastType || '';
        state.rsc.enabled = !!cfg.rscEnabled;
        state.rsc.cfg = cfg.rsc || {};
        state.rsc.memorialTexto = cfg.rscMemorialTexto || '';
        state.sumula.enabled = !!cfg.sumulaEnabled;
        state.sumula.cfg = cfg.sumula || {};
        state.sumula.texto = cfg.sumulaTexto || '';
        state.linhaTempo.nuvemExclusao = Array.isArray(cfg.nuvemExclusao) ? cfg.nuvemExclusao : [];
        state.linhaTempo.nuvemCompostas = Array.isArray(cfg.nuvemCompostas) ? cfg.nuvemCompostas : [];
        // Mesmo padrão do RSC/Súmula agora (opt-in, começa desabilitada) —
        // exceto pra quem já tinha itens cadastrados ANTES dessa mudança:
        // a chave nunca foi salva (toggle não existia ainda), mas já
        // publicava de fato, então tratamos como habilitada pra não sumir
        // com a aba de quem já usa. Só se aplica enquanto a chave nunca foi
        // salva — uma vez que a pessoa mexe no checkbox (ligado OU
        // desligado), o valor explícito sempre prevalece.
        state.pubWebEnabled = cfg.pubWebEnabled !== undefined ? !!cfg.pubWebEnabled : state.items.length > 0;
        const { conexoesMigradas, pastasParaMover } = migrarItens();
        updateHeaderIdentity();
        applyRscVisibility();
        applySumulaVisibility();
        applyPublicarVisibility();
        try { await Storage.restoreDirectory(); } catch (_) {}
        applyDirGate();
        try { await checkDirHealth(); } catch (_) {} // silencioso: sem pedir permissão de novo sem um clique do usuário
        // Catálogo local vazio mas já há um diretório configurado e acessível:
        // pode ser um navegador/perfil novo, ou dados locais limpos, apontando
        // pra uma pasta que já tinha itens — sincroniza automaticamente em vez
        // de deixar a lista vazia até o usuário lembrar de clicar em
        // "Sincronizar do diretório".
        if (state.items.length === 0 && Storage.hasDirectory() && state.dirHealth && state.dirHealth.ok) {
            try {
                const { encontrados } = await syncFromDirectory();
                if (encontrados) toast(`${encontrados} item(ns) encontrado(s) na pasta configurada e sincronizados automaticamente.`, 'ok');
            } catch (_) {}
        }
        try { await purgeOldTrash(); } catch (_) {}
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

        // Fotos de Perfil, Documentos pessoais e Outros passam a ficar como
        // subpasta de "Evidências/01 Dados Gerais" (01.1/01.2/01.3), em vez
        // de soltas em "Evidências".
        if (!cfg.evidenciasDadosGeraisMigrada && Storage.hasDirectory()) {
            // PERFIL_FOTOS/PERFIL_DOCS não existem mais como categorias (ver
            // migração "perfilMescladoDadosGerais" logo abaixo, que já leva
            // tudo de volta pra "01 Dados gerais") — strings literais no
            // lugar de LattesTypes.categoryFolder(...) só pra esta migração
            // antiga continuar funcionando, num install muito antigo que
            // nunca tenha rodado nenhuma migração desde então.
            try { await Storage.renameRootFolder('Evidências/20 Fotos de Perfil', PASTA_FOTOS_PERFIL_ANTIGA); } catch (_) {}
            try { await Storage.renameRootFolder('Evidências/21 Documentos pessoais', PASTA_DOCUMENTOS_PESSOAIS_ANTIGA); } catch (_) {}
            try { await Storage.renameRootFolder('Evidências/00 Outros', LattesTypes.outrosFolder()); } catch (_) {}
            cfg.evidenciasDadosGeraisMigrada = true;
            Storage.saveSettings(cfg);
        }
        // Dados Gerais mesclado entre Configurações e Catalogar (a pedido do
        // usuário): Foto de perfil, Documentos pessoais, Identidade e
        // Passaporte deixam de ter subpasta própria (01.1/01.2) e passam a
        // ficar direto em "01 Dados gerais", junto dos demais itens da
        // categoria — move os arquivos já existentes uma única vez. Roda
        // DEPOIS da migração acima (que pode ser a primeira a criar essas
        // subpastas, num install muito antigo), garantindo que os arquivos
        // já estejam lá antes de tentar movê-los pra pasta plana.
        if (!cfg.perfilMescladoDadosGerais && Storage.hasDirectory()) {
            const destino = LattesTypes.categoryFolder('DADOS_GERAIS');
            const idsFoto = state.items.filter(i => i.typeKey === 'FOTO_PERFIL').map(i => i.id);
            for (const id of idsFoto) {
                try { await Storage.moveItemFiles(id, PASTA_FOTOS_PERFIL_ANTIGA, destino); } catch (_) {}
            }
            const idsDocs = state.items.filter(i => ['DOCUMENTO_PESSOAL', 'DOC_IDENTIDADE', 'DOC_PASSAPORTE'].includes(i.typeKey)).map(i => i.id);
            for (const id of idsDocs) {
                try { await Storage.moveItemFiles(id, PASTA_DOCUMENTOS_PESSOAIS_ANTIGA, destino); } catch (_) {}
            }
            try { await Storage.removeSubdirIfEmpty(PASTA_FOTOS_PERFIL_ANTIGA); } catch (_) {}
            try { await Storage.removeSubdirIfEmpty(PASTA_DOCUMENTOS_PESSOAIS_ANTIGA); } catch (_) {}
            cfg.perfilMescladoDadosGerais = true;
            Storage.saveSettings(cfg);
        }

        // Aviso ao fechar/recarregar com edições não salvas
        window.addEventListener('beforeunload', (e) => { if (state.ui.formDirty) { e.preventDefault(); e.returnValue = ''; } });

        // Abas
        $$('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
        wireTabListKeyboardNav();
        // Vindo de outra página pelo botão de Configurações no cabeçalho
        // (ex.: index.html#config a partir de privacidade.html) — abre a
        // aba direto, em vez de sempre cair em "Início".
        switchTab(window.location.hash === '#config' ? 'config' : 'inicio');

        wireFirstRunNotice();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
