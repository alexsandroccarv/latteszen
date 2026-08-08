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
    // Cria os subdiretórios (um por categoria) dentro da pasta escolhida
    async function ensureSubdirs(names) {
        const dir = await ensureDirReady();
        for (const name of names) {
            try { await dir.getDirectoryHandle(name, { create: true }); } catch (_) {}
        }
    }

    // Resolve o diretório-alvo: a raiz ou um subdiretório (criado se necessário)
    async function targetDir(subdir) {
        const dir = await ensureDirReady();
        if (!subdir) return dir;
        return dir.getDirectoryHandle(subdir, { create: true });
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

    async function writePdf(id, fileOrBlob, subdir) {
        await writeFile(`${id}.pdf`, fileOrBlob, subdir);
    }

    async function deleteFiles(id, subdir) {
        if (!dirHandle) return;
        let dir = dirHandle;
        if (subdir) { try { dir = await dirHandle.getDirectoryHandle(subdir); } catch (_) { return; } }
        for (const ext of ['pdf', 'json']) {
            try { await dir.removeEntry(`${id}.${ext}`); } catch (_) { /* pode não existir */ }
        }
    }

    async function readPdfUrl(id, subdir) {
        const dir = await ensureDirReady();
        let target = dir;
        if (subdir) { try { target = await dir.getDirectoryHandle(subdir); } catch (_) { return null; } }
        try {
            const fh = await target.getFileHandle(`${id}.pdf`);
            const file = await fh.getFile();
            return URL.createObjectURL(file);
        } catch (_) { return null; }
    }

    // Reconstrói o catálogo a partir dos *.json (raiz e subdiretórios de categoria)
    async function scanDirectory() {
        const dir = await ensureDirReady();
        const items = [];
        async function scanOne(handle) {
            for await (const [name, h] of handle.entries()) {
                if (h.kind === 'file' && name.toLowerCase().endsWith('.json') && name !== 'catalogo.json') {
                    try {
                        const file = await h.getFile();
                        const obj = JSON.parse(await file.text());
                        if (obj && obj.id) items.push(obj);
                    } catch (_) { /* ignora inválidos */ }
                } else if (h.kind === 'directory') {
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
        writeJson, writePdf, deleteFiles, readPdfUrl, scanDirectory, ensureSubdirs,
        // catálogo + settings
        loadCatalog, saveCatalog, loadSettings, saveSettings,
    };
})();
