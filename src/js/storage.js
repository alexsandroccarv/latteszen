/* ==========================================================================
   lattesZen — Camada de armazenamento
   --------------------------------------------------------------------------
   - Índice do catálogo: localStorage (chave lz_catalog) — funciona sempre.
   - Arquivos (ID.pdf / ID.json): File System Access API, num diretório
     escolhido pelo usuário e persistido no IndexedDB (o handle é
     estruturável-clonável e sobrevive entre sessões, mediante permissão).
   ========================================================================== */
window.Storage = (function () {
    const K = APP_CONFIG.storageKeys;
    const IDB_NAME = 'lattesZen';
    const IDB_STORE = 'handles';
    const IDB_KEY = 'dirHandle';

    /* ---------------- IndexedDB (guarda o handle do diretório) ------------- */
    function idb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(IDB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async function idbSet(key, val) {
        const db = await idb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(val, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
    async function idbGet(key) {
        const db = await idb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const r = tx.objectStore(IDB_STORE).get(key);
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
    }
    async function idbDel(key) {
        const db = await idb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    /* -------------------------- Diretório (FS Access) --------------------- */
    let dirHandle = null;

    const supportsFS = 'showDirectoryPicker' in window;

    async function verifyPermission(handle, readWrite = true) {
        const opts = { mode: readWrite ? 'readwrite' : 'read' };
        if ((await handle.queryPermission(opts)) === 'granted') return true;
        if ((await handle.requestPermission(opts)) === 'granted') return true;
        return false;
    }

    async function chooseDirectory() {
        if (!supportsFS) throw new Error('Navegador sem suporte à File System Access API (use Chrome ou Edge).');
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        dirHandle = handle;
        await idbSet(IDB_KEY, handle);
        return handle;
    }

    // Restaura o handle salvo (sem pedir permissão automaticamente)
    async function restoreDirectory() {
        if (!supportsFS) return null;
        const handle = await idbGet(IDB_KEY);
        if (handle) dirHandle = handle;
        return handle || null;
    }

    async function ensureDirReady() {
        if (!dirHandle) throw new Error('Nenhum diretório configurado. Vá em Configurações e escolha uma pasta.');
        const ok = await verifyPermission(dirHandle, true);
        if (!ok) throw new Error('Permissão de escrita negada para o diretório.');
        return dirHandle;
    }

    function hasDirectory() { return !!dirHandle; }
    async function directoryName() { return dirHandle ? dirHandle.name : null; }

    async function forgetDirectory() {
        dirHandle = null;
        await idbDel(IDB_KEY);
    }

    /* -------------------------- Escrita de arquivos ---------------------- */
    // Anda por um caminho de subdiretórios ("A/B/C"), criando cada segmento
    // se `create` for true. Usado porque a File System Access API só resolve
    // um nível por chamada — não aceita caminhos com "/" de uma vez.
    async function walkDir(dir, subdirPath, create) {
        if (!subdirPath) return dir;
        let d = dir;
        for (const seg of String(subdirPath).split('/').filter(Boolean)) {
            d = await d.getDirectoryHandle(seg, { create: !!create });
        }
        return d;
    }

    // Cria os subdiretórios (um por categoria) dentro da pasta escolhida.
    // Cada nome pode ser um caminho com "/" (ex.: "Evidências/01 Dados gerais").
    async function ensureSubdirs(names) {
        const dir = await ensureDirReady();
        for (const name of names) {
            try { await walkDir(dir, name, true); } catch (_) {}
        }
    }

    // Resolve o diretório-alvo: a raiz ou um subdiretório/caminho (criado se necessário)
    async function targetDir(subdir) {
        const dir = await ensureDirReady();
        return walkDir(dir, subdir, true);
    }

    async function writeFile(filename, data, subdir) {
        const dir = await targetDir(subdir);
        const fh = await dir.getFileHandle(filename, { create: true });
        const w = await fh.createWritable();
        await w.write(data);
        await w.close();
    }

    async function writeJson(id, obj, subdir) {
        await writeFile(`${id}.json`, JSON.stringify(obj, null, 2), subdir);
    }

    const ATTACH_EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'avi', 'mkv', 'zip', 'tar', 'gz'];

    /* ------------------------- Bandeja de entrada ------------------------ */
    // Caixa de Entrada: pasta onde o usuário deposita arquivos ainda não
    // catalogados. 00 Processado: subpasta (dentro dela) para onde o
    // original é movido depois de catalogado.
    const INBOX_FOLDER = 'Caixa de Entrada';
    const PROCESSED_FOLDER = '00 Processado';

    async function inboxDir(create) {
        const dir = await ensureDirReady();
        return dir.getDirectoryHandle(INBOX_FOLDER, { create: !!create });
    }
    async function ensureInbox() {
        const inbox = await inboxDir(true);
        await inbox.getDirectoryHandle(PROCESSED_FOLDER, { create: true });
    }
    // Lista os arquivos (PDF/imagem) pendentes na Inbox (ignora subpastas)
    async function listInbox() {
        let inbox; try { inbox = await inboxDir(true); } catch (_) { return []; }
        const out = [];
        for await (const [name, h] of inbox.entries()) {
            if (h.kind !== 'file') continue;
            const m = name.match(/\.([^.]+)$/);
            const ext = m ? m[1].toLowerCase() : '';
            if (!ATTACH_EXTS.includes(ext)) continue;
            let size = null;
            try { size = (await h.getFile()).size; } catch (_) {}
            out.push({ name, ext, size });
        }
        out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        return out;
    }
    async function readInboxFile(name) {
        const inbox = await inboxDir(true);
        const fh = await inbox.getFileHandle(name);
        return fh.getFile();
    }
    // Move o original da Inbox para 00 - Processado; sufixa em caso de colisão.
    async function moveInboxToProcessed(name) {
        const inbox = await inboxDir(true);
        const proc = await inbox.getDirectoryHandle(PROCESSED_FOLDER, { create: true });
        const dot = name.lastIndexOf('.');
        const base = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : '';
        const exists = async (nm) => { try { await proc.getFileHandle(nm); return true; } catch (_) { return false; } };
        let target = name, n = 2;
        while (await exists(target)) { target = `${base}-${n}${ext}`; n++; }
        const srcFh = await inbox.getFileHandle(name);
        const file = await srcFh.getFile();
        const dstFh = await proc.getFileHandle(target, { create: true });
        const w = await dstFh.createWritable();
        await w.write(file);
        await w.close();
        await inbox.removeEntry(name);
        return target;
    }

    // Grava um anexo (evidência) com base name explícito: <basename>.<ext>.
    // Remove versões anteriores do MESMO basename com outra extensão.
    async function writeAttachment(basename, fileOrBlob, subdir, ext) {
        ext = (ext || 'pdf').toLowerCase();
        for (const e of ATTACH_EXTS) if (e !== ext) {
            try { const d = await targetDir(subdir); await d.removeEntry(`${basename}.${e}`); } catch (_) {}
        }
        await writeFile(`${basename}.${ext}`, fileOrBlob, subdir);
    }

    // Remove um anexo específico (todas as extensões daquele basename).
    async function deleteEntry(basename, subdir) {
        if (!dirHandle) return;
        let dir;
        try { dir = await walkDir(dirHandle, subdir, false); } catch (_) { return; }
        for (const ext of ATTACH_EXTS) {
            try { await dir.removeEntry(`${basename}.${ext}`); } catch (_) {}
        }
    }

    // Remove todos os arquivos de um item: <id>.json, <id>.<ext> e <id>-*.<ext>.
    async function deleteItemFiles(id, subdir) {
        if (!dirHandle) return;
        let dir;
        try { dir = await walkDir(dirHandle, subdir, false); } catch (_) { return; }
        const rm = [];
        for await (const [name, h] of dir.entries()) {
            if (h.kind !== 'file') continue;
            if (name === `${id}.json`) { rm.push(name); continue; }
            const m = name.match(/^(.*)\.([^.]+)$/);
            if (!m) continue;
            const base = m[1], ext = m[2].toLowerCase();
            if ((base === id || base.indexOf(id + '-') === 0) && ATTACH_EXTS.includes(ext)) rm.push(name);
        }
        for (const n of rm) { try { await dir.removeEntry(n); } catch (_) {} }
    }

    // Move os arquivos de um item (<id>.json, <id>.<ext>, <id>-*.<ext>) de um
    // subdiretório para outro — usado quando a CATEGORIA do item muda.
    async function moveItemFiles(id, fromSubdir, toSubdir) {
        if (!dirHandle || fromSubdir === toSubdir) return;
        let from;
        try { from = await walkDir(dirHandle, fromSubdir, false); } catch (_) { return; }
        const to = await targetDir(toSubdir);
        const names = [];
        for await (const [name, h] of from.entries()) {
            if (h.kind !== 'file') continue;
            if (name === `${id}.json`) { names.push(name); continue; }
            const m = name.match(/^(.*)\.([^.]+)$/);
            if (!m) continue;
            const base = m[1], ext = m[2].toLowerCase();
            if ((base === id || base.indexOf(id + '-') === 0) && ATTACH_EXTS.includes(ext)) names.push(name);
        }
        for (const name of names) {
            try {
                const fh = await from.getFileHandle(name);
                const file = await fh.getFile();
                const nh = await to.getFileHandle(name, { create: true });
                const w = await nh.createWritable();
                await w.write(file);
                await w.close();
                await from.removeEntry(name);
            } catch (_) { /* se falhar um, segue os demais */ }
        }
    }

    // Remove um subdiretório obsoleto da raiz, só se estiver vazio (ex.: pasta
    // de categoria removida/renomeada numa migração). Não apaga se houver
    // qualquer arquivo restante, por segurança.
    async function removeSubdirIfEmpty(name) {
        if (!dirHandle) return false;
        let sub;
        try { sub = await dirHandle.getDirectoryHandle(name); } catch (_) { return false; }
        for await (const _ of sub.values()) { return false; }
        try { await dirHandle.removeEntry(name, { recursive: true }); return true; } catch (_) { return false; }
    }

    // Move recursivamente TODO o conteúdo (arquivos e subpastas) de um
    // diretório para outro, mantendo a estrutura interna.
    async function moveAllContents(fromHandle, toHandle) {
        for await (const [name, h] of fromHandle.entries()) {
            if (h.kind === 'file') {
                try {
                    const file = await h.getFile();
                    const nh = await toHandle.getFileHandle(name, { create: true });
                    const w = await nh.createWritable();
                    await w.write(file);
                    await w.close();
                    await fromHandle.removeEntry(name);
                } catch (_) { /* se falhar um, segue os demais */ }
            } else if (h.kind === 'directory') {
                try {
                    const subTo = await toHandle.getDirectoryHandle(name, { create: true });
                    await moveAllContents(h, subTo);
                    await fromHandle.removeEntry(name);
                } catch (_) {}
            }
        }
    }
    // Renomeia uma pasta de sistema na raiz (ex.: "00 Inbox" -> "Caixa de
    // Entrada"), movendo todo o conteúdo — a File System Access API não tem
    // rename nativo. Não faz nada se a pasta antiga não existir.
    async function renameRootFolder(oldName, newName) {
        if (!dirHandle || oldName === newName) return false;
        let oldHandle;
        try { oldHandle = await dirHandle.getDirectoryHandle(oldName); } catch (_) { return false; }
        const newHandle = await dirHandle.getDirectoryHandle(newName, { create: true });
        await moveAllContents(oldHandle, newHandle);
        try { await dirHandle.removeEntry(oldName, { recursive: true }); } catch (_) {}
        return true;
    }

    async function readAttachmentUrl(basename, subdir, ext) {
        const dir = await ensureDirReady();
        let target;
        try { target = await walkDir(dir, subdir, false); } catch (_) { return null; }
        const tryExts = ext ? [ext.toLowerCase()] : ATTACH_EXTS;
        for (const e of tryExts) {
            try {
                const fh = await target.getFileHandle(`${basename}.${e}`);
                const file = await fh.getFile();
                return URL.createObjectURL(file);
            } catch (_) { /* tenta próxima */ }
        }
        return null;
    }

    // Devolve o File de um anexo (para embutir em base64 na página pública).
    async function readAttachmentFile(basename, subdir, ext) {
        const dir = await ensureDirReady();
        let target;
        try { target = await walkDir(dir, subdir, false); } catch (_) { return null; }
        const tryExts = ext ? [ext.toLowerCase()] : ATTACH_EXTS;
        for (const e of tryExts) {
            try { const fh = await target.getFileHandle(`${basename}.${e}`); return await fh.getFile(); }
            catch (_) { /* tenta próxima */ }
        }
        return null;
    }

    // Reconstrói o catálogo a partir dos *.json (raiz e subdiretórios de categoria)
    async function scanDirectory() {
        const dir = await ensureDirReady();
        const items = [];
        async function scanOne(handle) {
            for await (const [name, h] of handle.entries()) {
                if (h.kind === 'file' && name.toLowerCase().endsWith('.json') && name !== 'catalogo.json' && name.indexOf('latteszen-') !== 0) {
                    try {
                        const file = await h.getFile();
                        const obj = JSON.parse(await file.text());
                        if (obj && obj.id) items.push(obj);
                    } catch (_) { /* ignora inválidos */ }
                } else if (h.kind === 'directory') {
                    if (name === INBOX_FOLDER) continue; // não indexa a bandeja de entrada
                    try { await scanOne(h); } catch (_) {}
                }
            }
        }
        await scanOne(dir);
        return items;
    }

    /* ----------------------- Catálogo (localStorage) --------------------- */
    function loadCatalog() {
        try { return JSON.parse(localStorage.getItem(K.catalog)) || []; }
        catch (_) { return []; }
    }
    function saveCatalog(items) {
        localStorage.setItem(K.catalog, JSON.stringify(items));
    }

    /* ----------------------- Configurações gerais ------------------------ */
    function loadSettings() {
        try { return JSON.parse(localStorage.getItem(K.settings)) || {}; }
        catch (_) { return {}; }
    }
    function saveSettings(s) {
        localStorage.setItem(K.settings, JSON.stringify(s));
    }

    return {
        supportsFS,
        // diretório
        chooseDirectory, restoreDirectory, ensureDirReady, hasDirectory,
        directoryName, forgetDirectory, verifyPermission,
        // arquivos
        writeJson, writeFile, writeAttachment, deleteEntry, deleteItemFiles, moveItemFiles, removeSubdirIfEmpty, renameRootFolder, readAttachmentUrl, readAttachmentFile, scanDirectory, ensureSubdirs,
        // bandeja de entrada (inbox)
        ensureInbox, listInbox, readInboxFile, moveInboxToProcessed,
        // catálogo + settings
        loadCatalog, saveCatalog, loadSettings, saveSettings,
    };
})();
