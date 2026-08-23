/* ==========================================================================
   lattesZen — Orquestrador principal (SPA)
   ========================================================================== */
(function () {
    'use strict';

    // Versão do esquema dos itens (carimbada em cada item para migrações futuras)
    const SCHEMA_VERSION = 2;
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

    /* -------- Motor de formulário de tab-catalogar.js -----------------------
       tab-catalogar.js carrega ANTES deste arquivo e publica estas funções em
       AppCore para Configurações (formulários de perfil) continuar usando —
       diferente de switchTab/persistItem/etc. (o sentido inverso), aqui é
       seguro desestruturar direto no topo: quando esta linha roda, o módulo
       já publicou tudo. */
    const {
        buildForm, fieldHtml, wireValidators, wireCounters, wireDateBr, wireConditional, wireNA, wireAreaTree,
        collectFields, normalizeEncoding, validateItemFields, collectSuggestions, renameFieldValue, wireKeyboardShortcuts,
        AUTOCOMPLETE_KEYS, VOCAB_LABELS, DEFAULT_EVIDENCE_TAGS,
    } = window.AppCore;

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
    // Texto de status usado na seção "Diretório de arquivos" em Configurações.
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
        return { encontrados: found.length };
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

    // Exclui definitivamente um item já na lixeira (não pode mais ser desfeito).
    async function purgeTrashItem(id) {
        const idx = state.trash.findIndex(i => i.id === id);
        if (idx === -1) return;
        state.trash.splice(idx, 1);
        saveTrash();
        try { await Storage.deleteItemFiles(id, LattesTypes.lixeiraFolder()); } catch (_) {}
    }

    // Esvazia a lixeira inteira (usado pelo botão "Esvaziar lixeira" e pela
    // purga automática de itens antigos no início do app).
    async function emptyTrash(ids) {
        const alvo = ids || state.trash.map(i => i.id);
        for (const id of alvo) { try { await Storage.deleteItemFiles(id, LattesTypes.lixeiraFolder()); } catch (_) {} }
        state.trash = state.trash.filter(i => !alvo.includes(i.id));
        saveTrash();
    }

    // Purga automática: itens na lixeira há mais de TRASH_RETENTION_DIAS.
    // Roda uma vez no início do app (init()).
    async function purgeOldTrash() {
        const limite = Date.now() - TRASH_RETENTION_DIAS * 24 * 60 * 60 * 1000;
        const vencidos = state.trash.filter(i => new Date(i.deletedAt).getTime() < limite).map(i => i.id);
        if (vencidos.length) await emptyTrash(vencidos);
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
            <section id="importXmlSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
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
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Gera um arquivo <strong>curriculo-&lt;nome&gt;-&lt;data e hora&gt;.xml</strong> no formato oficial do CNPq (schema <em>CurriculoLattes</em>, codificação ISO-8859-1). O nome traz a data/hora da geração, então exportações anteriores não são sobrescritas. Inclui apenas os itens das categorias do Lattes — <strong>RSC, Conexões e Registros pessoais não são exportados</strong>. As evidências (PDFs) não fazem parte do XML.</p>
                <div class="text-sm rounded-md border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 px-3 py-2 mb-3 flex gap-2">
                    <i class="fa-solid fa-hourglass-half mt-0.5"></i>
                    <span><strong>Funcionalidade futura:</strong> a exportação para XML ainda está em desenvolvimento e está temporariamente desativada.</span>
                </div>
                ${xmlConsistencyNoticeHtml()}
                <div class="flex gap-2 flex-wrap">
                    <button id="btnXmlDownload" disabled class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm opacity-50 cursor-not-allowed"><i class="fa-solid fa-download mr-1"></i> Baixar XML (.xml)</button>
                    <button id="btnXmlSave" disabled class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm opacity-50 cursor-not-allowed"><i class="fa-solid fa-folder-open mr-1"></i> Salvar na pasta (${esc(LattesTypes.lattesXmlFolder())})</button>
                </div>
                <p id="xmlStatus" class="text-xs text-gray-500 mt-2"></p>
            </section>`;
    }

    // Nome do arquivo XML exportado, com timestamp (evita sobrescrever
    // exportações anteriores e registra quando cada uma foi gerada).
    function xmlFileName() {
        const nome = (state.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo) || {}).fields;
        const safe = (nome && nome.titulo ? nome.titulo : 'curriculo').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-').toLowerCase();
        return `curriculo-${safe}-${fileStamp()}.xml`;
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
            if (i.visibilidade && i.visibilidade.exportarLattes === false) return false;
            return !LattesTypes.isNaoLattesCategory(i.categoryKey);
        }).length;
        const dl = $('#btnXmlDownload');
        if (dl) dl.addEventListener('click', () => {
            xmlStatus('Gerando XML…');
            try {
                const { bytes } = generateLattesXml();
                const blob = new Blob([bytes], { type: 'application/xml' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = xmlFileName(); a.click(); URL.revokeObjectURL(a.href);
                xmlStatus(`XML gerado (${xmlExportaveis()} item(ns) exportado(s)).`);
                xmlConsistencyToast();
            } catch (e) { xmlStatus(''); toast('Falha ao gerar XML: ' + e.message, 'erro'); }
        });
        const sv = $('#btnXmlSave');
        if (sv) sv.addEventListener('click', async () => {
            if (!Storage.hasDirectory()) { toast('Configure um diretório abaixo para salvar na pasta.', 'aviso'); return; }
            xmlStatus('Gerando e salvando XML…');
            try {
                const folder = LattesTypes.lattesXmlFolder();
                const nomeArquivo = xmlFileName();
                const { bytes } = generateLattesXml();
                await Storage.writeFile(nomeArquivo, bytes, folder);
                xmlStatus(`Salvo em “${folder}/${nomeArquivo}” (${xmlExportaveis()} item(ns)).`);
                toast(`XML salvo em “${folder}/${nomeArquivo}”.`, 'ok');
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
        window.AppCore.renderItemList();
    }

    /* =====================================================================
       IMPORTAR PUBLICAÇÕES DO ORCID — seção dentro de Configurações
       ---------------------------------------------------------------------
       Busca as obras públicas de um ORCID iD (API pública, sem autenticação)
       e reaproveita a mesma tela de revisão/seleção e a mesma deduplicação
       por assinatura de conteúdo (itemSignature/existingSignatureMap) já
       usadas na importação do XML do Lattes — só a origem dos dados muda.
       ===================================================================== */
    // Tipo de obra do ORCID → tipo do lattesZen. Cobre os tipos mais comuns;
    // qualquer tipo não mapeado cai em OUTRA_BIBLIOGRAFICA (catch-all seguro).
    const ORCID_TYPE_MAP = {
        'journal-article': 'ARTIGO_PERIODICO', 'journal-issue': 'ARTIGO_PERIODICO',
        'book': 'LIVROS', 'edited-book': 'LIVROS',
        'book-chapter': 'CAPITULOS_LIVRO',
        'conference-paper': 'TRABALHO_EVENTO', 'conference-abstract': 'TRABALHO_EVENTO', 'conference-poster': 'TRABALHO_EVENTO',
        'lecture-speech': 'APRESENTACAO',
        'magazine-article': 'TEXTO_JORNAL', 'newsletter-article': 'TEXTO_JORNAL', 'newspaper-article': 'TEXTO_JORNAL', 'online-resource': 'TEXTO_JORNAL',
        'translation': 'TRADUCAO',
        'software': 'SOFTWARE_SEM_REGISTRO',
        'patent': 'PATENTE',
        'trademark': 'MARCA',
        'artistic-performance': 'ARTES_CENICAS',
        'cartographic-material': 'CARTA_MAPA',
        'image': 'OUTRA_ARTISTICA', 'video': 'OUTRA_ARTISTICA',
        'report': 'RELATORIO_PESQUISA', 'working-paper': 'RELATORIO_PESQUISA', 'preprint': 'RELATORIO_PESQUISA',
    };
    const ORCID_FALLBACK_TYPE = 'OUTRA_BIBLIOGRAFICA';

    function orcidImportSectionHtml() {
        const perfil = (state.items.find(i => i.typeKey === 'IDENTIFICACAO') || {}).fields || {};
        return `
            <section id="importOrcidSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-2 flex items-center gap-2">
                    <i aria-hidden="true" class="fa-brands fa-orcid text-green-600"></i> Importar publicações do ORCID
                </h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Busca as obras públicas registradas no seu <strong>ORCID iD</strong> (API pública do ORCID — nenhuma senha é necessária) e lista para você escolher quais importar, do mesmo jeito que a importação do XML do Lattes.
                </p>
                <div class="text-sm rounded-md border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 px-3 py-2 mb-3 flex gap-2">
                    <i class="fa-solid fa-triangle-exclamation mt-0.5"></i>
                    <span>Os <strong>autores</strong> são buscados automaticamente, mas só saem se o próprio autor tiver um nome público registrado no ORCID daquela obra — quando faltar, complete depois de importar. O <strong>tipo</strong> de cada obra é inferido automaticamente e pode precisar de ajuste.</span>
                </div>
                <div class="flex flex-wrap items-end gap-2">
                    <div>
                        <label class="block text-xs font-semibold mb-1" for="orcidInput">ORCID iD</label>
                        <input type="text" id="orcidInput" placeholder="0000-0000-0000-0000" value="${esc(perfil.orcid || '')}"
                               class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 w-48">
                    </div>
                    <button id="btnOrcidBuscar" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold">
                        <i class="fa-solid fa-magnifying-glass mr-1"></i> Buscar publicações
                    </button>
                </div>
                <div id="orcidResult" class="mt-3"></div>
            </section>`;
    }

    // Extrai um external-id específico (ex.: 'doi', 'uri') do work-summary do ORCID.
    function orcidExternalId(summary, kind) {
        const ids = summary['external-ids'] && summary['external-ids']['external-id'];
        if (!Array.isArray(ids)) return '';
        const found = ids.find((x) => x['external-id-type'] === kind);
        return found ? String(found['external-id-value'] || '').trim() : '';
    }
    // Converte um work-summary do ORCID num item do lattesZen (typeKey/categoryKey/fields).
    // `autores`, quando informado, vem da busca em lote de fetchOrcidWorkDetails (2ª
    // chamada) — o endpoint de listagem por si só não traz os colaboradores da obra.
    function orcidWorkToItem(summary, autores) {
        const typeKey = ORCID_TYPE_MAP[summary.type] || ORCID_FALLBACK_TYPE;
        const titulo = (summary.title && summary.title.title && summary.title.title.value) || '';
        const ano = (summary['publication-date'] && summary['publication-date'].year && summary['publication-date'].year.value) || '';
        const doi = orcidExternalId(summary, 'doi');
        const url = (summary.url && summary.url.value) || orcidExternalId(summary, 'uri') || '';
        const journal = (summary['journal-title'] && summary['journal-title'].value) || '';
        const def = LattesTypes.getType(typeKey);
        const temCampo = (k) => def && def.fields.some((f) => f.key === k);
        const fields = {};
        if (temCampo('titulo')) fields.titulo = titulo;
        if (temCampo('ano')) fields.ano = ano;
        if (temCampo('doi')) fields.doi = doi;
        if (temCampo('url')) fields.url = url;
        if (typeKey === 'ARTIGO_PERIODICO' || typeKey === 'ARTIGO_ACEITO') fields.periodico = journal;
        if (autores && autores.length) {
            if (temCampo('autoresLista')) fields.autoresLista = autores.map((nome) => ({ nomeCompleto: nome, nomeCitacao: '' }));
            else if (temCampo('autores')) fields.autores = autores.join('; ');
        }
        return { typeKey, categoryKey: LattesTypes.primaryCategory(typeKey), fields, putCode: summary['put-code'] };
    }
    // Extrai os nomes dos colaboradores com papel de autor (ou sem papel
    // informado — é o padrão da maioria dos registros) do registro COMPLETO de
    // uma obra do ORCID. Colaboradores sem "credit-name" público não têm como
    // ser nomeados (só o ORCID iD deles, sem nome de exibição) e são ignorados.
    function orcidContributorNames(work) {
        const list = work && work.contributors && work.contributors.contributor;
        if (!Array.isArray(list)) return [];
        return list
            .filter((c) => {
                const role = c['contributor-attributes'] && c['contributor-attributes']['contributor-role'];
                return !role || role === 'author';
            })
            .map((c) => (c['credit-name'] && c['credit-name'].value) || '')
            .filter(Boolean);
    }
    // Busca os registros COMPLETOS (com colaboradores) de uma lista de obras, em
    // lotes de até 50 (limite do endpoint de busca em lote da API do ORCID).
    // Retorna um Map put-code → nomes de autores. Uma falha num lote não trava
    // a importação — a obra simplesmente fica sem autores pré-preenchidos.
    async function fetchOrcidWorkDetails(orcid, putCodes) {
        const map = new Map();
        for (let i = 0; i < putCodes.length; i += 50) {
            const lote = putCodes.slice(i, i + 50);
            let resp;
            try { resp = await fetch(`https://pub.orcid.org/v3.0/${orcid}/works/${lote.join(',')}`, { headers: { 'Accept': 'application/json' } }); }
            catch (_) { continue; }
            if (!resp.ok) continue;
            const data = await resp.json();
            const bulk = Array.isArray(data.bulk) ? data.bulk : [];
            for (const entry of bulk) {
                const work = entry && entry.work;
                if (!work) continue;
                const nomes = orcidContributorNames(work);
                if (nomes.length) map.set(work['put-code'], nomes);
            }
        }
        return map;
    }
    // Busca as obras públicas de um ORCID iD. Lança erro (mensagem em pt-BR) se
    // o formato for inválido ou a consulta falhar.
    async function fetchOrcidWorks(orcid) {
        const clean = String(orcid || '').trim().toUpperCase();
        if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(clean)) throw new Error('ORCID iD inválido — use o formato 0000-0000-0000-0000.');
        let resp;
        try { resp = await fetch(`https://pub.orcid.org/v3.0/${clean}/works`, { headers: { 'Accept': 'application/json' } }); }
        catch (_) { throw new Error('Não foi possível conectar ao ORCID — verifique sua conexão com a internet.'); }
        if (!resp.ok) throw new Error(`ORCID retornou um erro (HTTP ${resp.status}) — confira se o ORCID iD existe e é público.`);
        const data = await resp.json();
        const groups = Array.isArray(data.group) ? data.group : [];
        const summaries = groups.map((g) => (g['work-summary'] && g['work-summary'][0]) || null).filter(Boolean);
        let autoresPorObra = new Map();
        try { autoresPorObra = await fetchOrcidWorkDetails(clean, summaries.map((s) => s['put-code'])); }
        catch (_) { /* segue sem autores pré-preenchidos */ }
        return summaries.map((s) => orcidWorkToItem(s, autoresPorObra.get(s['put-code'])));
    }

    function renderOrcidResult(items) {
        const box = $('#orcidResult');
        if (!items.length) { box.innerHTML = `<p class="text-sm text-gray-500 italic">Nenhuma obra pública encontrada para esse ORCID iD.</p>`; return; }
        const sigMap = existingSignatureMap();
        const isDup = (it) => (LattesTypes.isSingleton(it.typeKey) && state.items.some((x) => x.typeKey === it.typeKey)) || sigMap.has(itemSignature(it.typeKey, it.fields || {}));
        const novos = items.filter((it) => !isDup(it)).length;
        box.innerHTML = `
            <div class="mb-3">
                <p class="text-sm mb-1">${items.length} obra(s) encontrada(s) — <strong class="text-green-700 dark:text-green-400">${novos} novas</strong>, ${items.length - novos} já catalogada(s).</p>
            </div>
            <div class="flex items-center gap-2 mb-2 flex-wrap">
                <button id="btnOrcidSelNovos" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Selecionar novos</button>
                <button id="btnOrcidSelAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Todos</button>
                <button id="btnOrcidSelNone" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Nenhum</button>
                <button id="btnOrcidImport" class="ml-auto px-4 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold">
                    <i class="fa-solid fa-download mr-1"></i> Importar selecionados
                </button>
            </div>
            <div class="space-y-1 scroll-area max-h-[60vh] overflow-y-auto pr-1">
                ${items.map((it, idx) => {
                    const dup = isDup(it);
                    return `<label class="flex items-start gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm ${dup ? 'opacity-60' : ''}">
                        <input type="checkbox" class="orcidchk mt-1" data-idx="${idx}" ${dup ? '' : 'checked'}>
                        <span class="min-w-0">
                            <span class="font-medium">${esc(it.fields.titulo || '(sem título)')}</span>
                            <span class="block text-xs text-gray-500">${esc(LattesTypes.label(it.typeKey))} ${it.fields.ano ? '· ' + esc(it.fields.ano) : ''} ${dup ? '· <em>já catalogado</em>' : ''}</span>
                        </span>
                    </label>`;
                }).join('')}
            </div>`;

        $('#btnOrcidSelNovos').addEventListener('click', () => $$('.orcidchk').forEach((c) => { c.checked = !isDup(items[+c.dataset.idx]); }));
        $('#btnOrcidSelAll').addEventListener('click', () => $$('.orcidchk').forEach((c) => c.checked = true));
        $('#btnOrcidSelNone').addEventListener('click', () => $$('.orcidchk').forEach((c) => c.checked = false));
        $('#btnOrcidImport').addEventListener('click', importOrcidSelected);
    }

    async function importOrcidSelected() {
        const chosen = $$('.orcidchk').filter((c) => c.checked).map((c) => parseInt(c.dataset.idx, 10));
        if (!chosen.length) { toast('Nenhum item selecionado.', 'aviso'); return; }
        const sigMap = existingSignatureMap();
        let n = 0, ignorados = 0;
        for (const idx of chosen) {
            const src = state.orcidParsed[idx];
            const sig = itemSignature(src.typeKey, src.fields || {});
            if (sig && sigMap.has(sig)) { ignorados++; continue; } // já existe (mesma assinatura) — não duplica
            const item = {
                id: uid(), createdAt: nowISO(), updatedAt: nowISO(),
                lattesItem: true, typeKey: src.typeKey, categoryKey: src.categoryKey,
                fields: src.fields, source: 'orcid', lattesRef: null,
                hasPdf: false, pdfName: null, evidencias: [],
            };
            await persistItem(item);
            if (sig) sigMap.set(sig, item);
            n++;
        }
        toast(`${n} item(ns) importado(s) do ORCID${ignorados ? ` — ${ignorados} já existente(s) ignorado(s)` : ''}.`, 'ok');
        renderOrcidResult(state.orcidParsed);
        window.AppCore.renderItemList();
    }

    function wireOrcidImport() {
        const btn = $('#btnOrcidBuscar');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            const input = $('#orcidInput');
            btn.disabled = true; btn.textContent = 'Buscando…';
            try {
                const items = await fetchOrcidWorks(input.value);
                state.orcidParsed = items;
                renderOrcidResult(items);
            } catch (e) {
                $('#orcidResult').innerHTML = '';
                toast(e.message, 'erro');
            } finally {
                btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-magnifying-glass mr-1"></i> Buscar publicações';
            }
        });
    }

    /* =====================================================================
       IMPORTAR PUBLICAÇÕES DE BIBTEX/RIS — seção dentro de Configurações
       (issue #6)
       ---------------------------------------------------------------------
       Faz o parse local do arquivo (window.LzBibRis, sem rede) e reaproveita
       a mesma tela de revisão/seleção e a mesma deduplicação por assinatura
       de conteúdo já usadas no import de XML/ORCID.
       ===================================================================== */
    function bibImportSectionHtml() {
        return `
            <section id="importBibSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-2 flex items-center gap-2">
                    <i aria-hidden="true" class="fa-solid fa-file-lines text-govbr-600 dark:text-unifesp-400"></i> Publicações (BibTeX/RIS)
                </h2>
                <h3 class="text-sm font-semibold mb-1">Importar</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Traga referências exportadas de outra ferramenta (Zotero, Mendeley, EndNote, Google Scholar) — selecione um arquivo <code>.bib</code> (BibTeX) ou <code>.ris</code> (RIS).
                </p>
                <input type="file" id="bibInput" accept=".bib,.ris,text/plain,application/x-bibtex"
                       class="text-sm file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-govbr-600 dark:file:bg-unifesp-700 file:text-white">
                <div id="bibResult" class="mt-3"></div>

                <h3 class="text-sm font-semibold mt-5 mb-1">Exportar</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Gera um arquivo com as publicações já catalogadas (artigos, livros, capítulos, trabalhos em anais de evento e relatórios de pesquisa) — para usar em outra ferramenta de referências.
                </p>
                <div class="flex flex-wrap gap-2">
                    <button id="btnBibExportBib" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-download mr-1"></i> Baixar .bib (BibTeX)</button>
                    <button id="btnBibExportRis" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-download mr-1"></i> Baixar .ris (RIS)</button>
                </div>
                <p id="bibExportStatus" class="text-xs text-gray-500 mt-2"></p>
            </section>`;
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
    async function onBibFileSelected(e) {
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
        const { items, formato } = state.bibParsed;
        const sigMap = existingSignatureMap();
        let n = 0, ignorados = 0;
        for (const idx of chosen) {
            const src = items[idx];
            const sig = itemSignature(src.typeKey, src.fields || {});
            if (sig && sigMap.has(sig)) { ignorados++; continue; } // já existe (mesma assinatura) — não duplica
            const item = {
                id: uid(), createdAt: nowISO(), updatedAt: nowISO(),
                lattesItem: true, typeKey: src.typeKey, categoryKey: src.categoryKey,
                fields: src.fields, source: formato === 'ris' ? 'ris' : 'bibtex', lattesRef: null,
                hasPdf: false, pdfName: null, evidencias: [],
            };
            await persistItem(item);
            if (sig) sigMap.set(sig, item);
            n++;
        }
        toast(`${n} item(ns) importado(s)${ignorados ? ` — ${ignorados} já existente(s) ignorado(s)` : ''}.`, 'ok');
        renderBibResult(state.bibParsed);
        window.AppCore.renderItemList();
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
    function wireBibExport() {
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
            if (!confirm(`Mover "${LattesTypes.itemTitle(item)}" para a lixeira? Pode ser restaurado depois em Configurações › Lixeira.`)) return;
            await deleteItem(item.id);
            toast('Documento movido para a lixeira.', 'ok');
            refreshDocumentoPessoalList(sec);
            window.AppCore.renderItemList();
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
            if (!confirm(`Mover "${LattesTypes.itemTitle(item)}" para a lixeira?`)) return;
            await deleteItem(item.id);
            const form = sec.querySelector('#areaAtuacaoForm');
            if (form.dataset.editingId === item.id) areaAtuacaoResetForm(form);
            refreshAreaAtuacaoList(sec);
            window.AppCore.renderItemList();
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
            window.AppCore.renderItemList();
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
        window.AppCore.renderItemList();
    }

    // Cabeçalho de grupo das Configurações (divisor de seções)
    function cfgGroup(icon, title) {
        return `<h2 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2 pt-3 pb-1 border-b border-gray-200 dark:border-gray-700"><i class="fa-solid ${icon}"></i> ${esc(title)}</h2>`;
    }

    // Uma linha da lista da Lixeira: título, categoria, há quantos dias foi
    // excluído, e os botões de Restaurar / Excluir definitivamente.
    function trashItemRowHtml(item) {
        const dias = Math.max(0, Math.floor((Date.now() - new Date(item.deletedAt).getTime()) / 86400000));
        return `<li class="flex items-center justify-between gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm">
            <div class="min-w-0">
                <div class="font-medium truncate">${esc(LattesTypes.itemTitle(item))}</div>
                <div class="text-xs text-gray-500">${esc(LattesTypes.categoryLabel(item.categoryKey))} · excluído há ${dias} dia${dias === 1 ? '' : 's'}</div>
            </div>
            <div class="flex gap-1.5 shrink-0">
                <button data-restaurar="${item.id}" class="px-2.5 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-xs whitespace-nowrap"><i class="fa-solid fa-rotate-left mr-1"></i> Restaurar</button>
                <button data-purgar="${item.id}" class="px-2.5 py-1.5 rounded border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 text-xs whitespace-nowrap"><i class="fa-solid fa-trash mr-1"></i> Excluir definitivamente</button>
            </div>
        </li>`;
    }
    function lixeiraSectionHtml() {
        return `
            <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-2 flex items-center gap-2">
                    <i class="fa-solid fa-trash-can text-govbr-600 dark:text-unifesp-400"></i> Lixeira <span class="text-sm font-normal text-gray-500">(${state.trash.length})</span>
                </h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Itens excluídos ficam aqui por até ${TRASH_RETENTION_DIAS} dias antes de serem removidos definitivamente. Os arquivos (quando há diretório configurado) vão para a pasta “${esc(LattesTypes.lixeiraFolder())}”, não são apagados na hora.</p>
                ${state.trash.length ? `
                <div class="flex justify-end mb-2">
                    <button id="btnEsvaziarLixeira" class="px-3 py-1.5 rounded border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 text-xs"><i class="fa-solid fa-trash mr-1"></i> Esvaziar lixeira</button>
                </div>
                <ul class="space-y-2">${state.trash.map(trashItemRowHtml).join('')}</ul>` : `
                <p class="text-sm text-gray-500 italic">A lixeira está vazia.</p>`}
            </section>`;
    }
    function wireLixeiraSection() {
        $$('[data-restaurar]').forEach(b => b.addEventListener('click', async () => {
            await restoreItem(b.dataset.restaurar);
            toast('Item restaurado.', 'ok');
            window.AppCore.renderItemList();
            renderConfig();
        }));
        $$('[data-purgar]').forEach(b => b.addEventListener('click', async () => {
            const item = state.trash.find(i => i.id === b.dataset.purgar);
            if (item && !confirm(`Excluir definitivamente "${LattesTypes.itemTitle(item)}"? Esta ação não pode ser desfeita.`)) return;
            await purgeTrashItem(b.dataset.purgar);
            toast('Item excluído definitivamente.', 'ok');
            renderConfig();
        }));
        const btnEmpty = $('#btnEsvaziarLixeira');
        if (btnEmpty) btnEmpty.addEventListener('click', async () => {
            if (!confirm(`Excluir definitivamente os ${state.trash.length} item(ns) da lixeira? Esta ação não pode ser desfeita.`)) return;
            await emptyTrash();
            toast('Lixeira esvaziada.', 'ok');
            renderConfig();
        });
    }

    async function renderConfig() {
        updateHeaderIdentity(); // reflete edições no nome (Identificação, import, limpar catálogo…)
        const panel = $('#tab-config');
        const dirName = Storage.hasDirectory() ? await Storage.directoryName() : null;
        const storageMode = Storage.storageMode();
        // Reconfere a saúde da pasta (silencioso) toda vez que a aba é aberta,
        // pra manter o status em dia sem precisar clicar em "Verificar pasta".
        if (Storage.hasDirectory()) await checkDirHealth();

        panel.innerHTML = `
            <div class="space-y-6 max-w-2xl">
                ${cfgGroup('fa-folder-tree', 'Diretório e dados')}
                <section id="dirSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-folder-open text-govbr-600 dark:text-unifesp-400"></i> Diretório de arquivos</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Cada item catalogado é salvo aqui como <code class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">ID.pdf</code> +
                        <code class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">ID.json</code>.
                        ${Storage.supportsFS ? '' : '<span class="text-red-600 font-semibold">Seu navegador não suporta esta função — use Chrome ou Edge.</span>'}
                    </p>
                    <p class="text-sm mb-1">Pasta atual: <strong id="dirNameLbl">${dirName ? esc(dirName) : '<em>nenhuma</em>'}</strong></p>
                    ${dirName ? `<p class="text-sm mb-3" id="dirHealthStatus">${dirHealthStatusHtml()}</p>` : ''}
                    <div class="flex flex-wrap gap-2">
                        <button id="btnChooseDir" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm" ${Storage.supportsFS ? '' : 'disabled'}><i class="fa-solid fa-folder mr-1"></i> Escolher pasta</button>
                        <button id="btnSync" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-rotate mr-1"></i> Sincronizar do diretório</button>
                        ${dirName ? `<button id="btnCheckDir" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-stethoscope mr-1"></i> Verificar pasta</button>` : ''}
                        <button id="btnForget" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-link-slash mr-1"></i> Esquecer pasta</button>
                    </div>
                    <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <h3 class="text-sm font-bold mb-1">Armazenamento remoto (Google Drive)</h3>
                        <p class="text-xs text-gray-500 mb-2">
                            Alternativa à pasta local: os arquivos ficam numa pasta dedicada no seu Google Drive, acessível de mais de um dispositivo.
                            O lattesZen só acessa os arquivos que ele mesmo cria (escopo <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">drive.file</code>) — nunca o restante do seu Drive.
                            ${APP_CONFIG.googleDriveClientId ? '' : '<span class="text-red-600 font-semibold">Recurso ainda não configurado neste site (falta o Client ID do Google Cloud Console em config.js).</span>'}
                        </p>
                        <div class="flex flex-wrap gap-2 mb-2">
                            <input id="gdrivePasta" type="text" placeholder="Pasta (ex.: lattesZen)" value="lattesZen" ${storageMode === 'gdrive' ? 'disabled' : ''} class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                        </div>
                        <div class="flex flex-wrap gap-2 items-center">
                            <button id="btnGDriveConnect" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm" ${APP_CONFIG.googleDriveClientId ? '' : 'disabled'}><i class="fa-brands fa-google mr-1"></i> Conectar ao Google Drive</button>
                            ${storageMode === 'gdrive' ? `<span class="text-xs text-green-700 dark:text-green-400"><i class="fa-solid fa-circle-check mr-1"></i> Este é o armazenamento em uso.</span>` : ''}
                        </div>
                        <div id="gdriveStatus" class="text-sm mt-2"></div>
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

                ${cfgGroup('fa-id-badge', 'Outras fontes')}
                ${orcidImportSectionHtml()}
                ${bibImportSectionHtml()}
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

                ${cfgGroup('fa-trash-can', 'Lixeira')}
                ${lixeiraSectionHtml()}

                ${cfgGroup('fa-triangle-exclamation', 'Zona de risco')}
                <section class="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
                    <button id="btnClear" class="px-3 py-2 rounded bg-red-600 text-white text-sm"><i class="fa-solid fa-trash mr-1"></i> Limpar catálogo (índice local)</button>
                </section>
            </div>`;

        wirePerfilSection();
        wireRscConfig();
        wireExportLattes();
        wireLixeiraSection();
        wireOrcidImport();
        $('#bibInput').addEventListener('change', onBibFileSelected);
        wireBibExport();
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
                state.dirHealth = null; // acabou de ser escolhida; revalidada no próximo render
                // Sincroniza na hora: se a pasta já tinha itens (ex.: pasta de
                // outro computador, ou reconfigurando após limpar o navegador),
                // o catálogo local não precisa esperar um clique extra em
                // "Sincronizar do diretório" pra aparecer.
                let msg = 'Diretório configurado (estrutura de pastas criada).';
                try {
                    const { encontrados } = await syncFromDirectory();
                    msg += encontrados
                        ? ` ${encontrados} item(ns) já cadastrado(s) na pasta foram sincronizados automaticamente.`
                        : ' Pasta vazia — pronta para uso.';
                } catch (_) {}
                toast(msg, 'ok');
                window.AppCore.renderItemList();
                renderConfig();
            } catch (e) { if (e.name !== 'AbortError') toast(e.message, 'erro'); }
        });
        $('#btnSync').addEventListener('click', async () => {
            try {
                const { encontrados } = await syncFromDirectory();
                toast(`${encontrados} arquivo(s) .json lido(s) do diretório.`, 'ok');
                window.AppCore.renderItemList();
            } catch (e) { toast(e.message, 'erro'); }
        });
        $('#btnForget').addEventListener('click', async () => { await Storage.forgetDirectory(); state.dirHealth = null; renderDirBanner(); toast('Pasta esquecida.', 'ok'); renderConfig(); });
        const btnCheckDir = $('#btnCheckDir');
        if (btnCheckDir) btnCheckDir.addEventListener('click', async () => {
            await checkDirHealth({ requestIfNeeded: true });
            if (state.dirHealth && state.dirHealth.ok) toast('Pasta acessível.', 'ok');
            else toast('Não foi possível acessar a pasta — verifique se ela ainda existe e se a permissão foi concedida.', 'erro');
            renderConfig();
        });
        const btnGDriveConnect = $('#btnGDriveConnect');
        if (btnGDriveConnect) btnGDriveConnect.addEventListener('click', async () => {
            const pasta = $('#gdrivePasta').value.trim() || 'lattesZen';
            const statusEl = $('#gdriveStatus');
            btnGDriveConnect.disabled = true;
            if (statusEl) statusEl.innerHTML = '<span class="text-gray-500">Conectando… (autorize na janela do Google)</span>';
            try {
                await Storage.connectGoogleDrive({ pasta });
                await Storage.ensureSubdirs(LattesTypes.allFolders()); // cria a estrutura de pastas
                try { await Storage.ensureInbox(); } catch (_) {}      // cria "Caixa de Entrada" / "Processados"
                state.dirHealth = null; // acabou de conectar; revalidada no próximo render
                let msg = 'Conectado ao Google Drive (estrutura de pastas criada).';
                try {
                    const { encontrados } = await syncFromDirectory();
                    msg += encontrados
                        ? ` ${encontrados} item(ns) já cadastrado(s) na pasta foram sincronizados automaticamente.`
                        : ' Pasta vazia — pronta para uso.';
                } catch (_) {}
                toast(msg, 'ok');
                window.AppCore.renderItemList();
                renderConfig();
            } catch (e) {
                if (statusEl) statusEl.innerHTML = `<span class="text-red-700 dark:text-red-400"><i aria-hidden="true" class="fa-solid fa-triangle-exclamation mr-1"></i> ${esc(e.message)}</span>`;
                toast('Falha ao conectar: ' + e.message, 'erro');
                btnGDriveConnect.disabled = false;
            }
        });

        $('#btnExport').addEventListener('click', exportCatalog);
        $('#importJson').addEventListener('change', importCatalog);
        $('#btnClear').addEventListener('click', () => {
            if (!confirm('Isto apaga TODO o índice local no navegador — itens catalogados, rascunho, prévia de importação, listas de autocomplete e a configuração do RSC-PCCTAE. Os arquivos no diretório NÃO são removidos. Continuar?')) return;
            state.items = [];
            saveCatalog();
            clearDraft();                 // rascunho não salvo (lz_draft)
            state.lattesParsed = null;    // prévia de importação do XML
            state.orcidParsed = null;     // prévia de importação do ORCID
            state.bibParsed = null;       // prévia de importação de BibTeX/RIS
            state.editingId = null;       // sai de qualquer edição em curso
            state.evEditing = [];         // evidências em edição
            state.vocab = {};             // listas de autocomplete (curadas)
            state.rscCfg = {};            // configuração do RSC-PCCTAE
            // Persiste a limpeza das listas e do RSC nas configurações.
            const s = Storage.loadSettings(); s.vocab = {}; s.rsc = {}; Storage.saveSettings(s);
            resetBackupReminder();        // zera o contador de backup
            toast('Índice local limpo (itens, listas e RSC).', 'ok');
            window.AppCore.renderItemList();
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
    // Publicado em AppCore para tab-catalogar.js (renameFieldValue re-renderiza
    // Configurações após renomear um valor de autocomplete) — mesmo motivo de
    // uid/nowISO.
    window.AppCore.renderConfig = renderConfig;

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
        window.AppCore.renderItemList();
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
            window.AppCore.renderItemList();
            renderConfig();
        } catch (err) { toast('Falha ao importar: ' + err.message, 'erro'); }
        e.target.value = '';
    }

    /* =====================================================================
       Navegação por abas
       ===================================================================== */
    const RENDERERS = {
        inicio: TabInicio.render, catalogar: TabCatalogar.render, conformidade: TabConformidade.render,
        publicar: TabPublicar.render, rsc: TabRsc.render, config: renderConfig,
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
    // Publicado em AppCore para os módulos de aba já extraídos (ex.:
    // tab-inicio.js) poderem trocar de aba — eles carregam ANTES deste
    // arquivo, então só podem ler isto em tempo de clique, nunca no topo.
    window.AppCore.switchTab = switchTab;

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
        state.rscEnabled = !!cfg.rscEnabled;
        state.rscCfg = cfg.rsc || {};
        const { conexoesMigradas, pastasParaMover } = migrarItens();
        updateHeaderIdentity();
        applyRscVisibility();
        try { await Storage.restoreDirectory(); } catch (_) {}
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

        // Aviso ao fechar/recarregar com edições não salvas
        window.addEventListener('beforeunload', (e) => { if (state.formDirty) { e.preventDefault(); e.returnValue = ''; } });

        // Abas
        $$('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
        switchTab('inicio');

        wireFirstRunNotice();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
