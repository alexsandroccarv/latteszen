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

    /* ---------------- WebDAV (alternativa à pasta local) ------------------
       `mode` decide qual back-end os métodos de arquivo abaixo usam. Em modo
       'webdav', `webdavCfg` guarda { baseUrl, username, password, pasta } —
       a senha fica em localStorage (via settings), como qualquer config do
       app; por isso a UI recomenda uma senha de aplicativo, não a principal.
       ------------------------------------------------------------------- */
    let mode = 'local'; // 'local' | 'webdav'
    let webdavCfg = null;
    function storageMode() { return mode; }
    // Caminho relativo ao servidor WebDAV configurado: pasta raiz + subdir + arquivo.
    function webPath(subdir, filename) {
        return [webdavCfg && webdavCfg.pasta, subdir, filename].filter(Boolean).join('/');
    }
    async function connectWebDAV(cfg) {
        const c = {
            baseUrl: String((cfg && cfg.baseUrl) || '').replace(/\/+$/, ''),
            username: (cfg && cfg.username) || '',
            password: (cfg && cfg.password) || '',
            pasta: String((cfg && cfg.pasta) || '').replace(/^\/+|\/+$/g, ''),
        };
        if (!c.baseUrl || !c.username || !c.password || !c.pasta) throw new Error('Preencha servidor, usuário, senha e pasta antes de conectar.');
        window.WebDavClient.configure(c);
        await window.WebDavClient.testConnection(); // lança erro (credenciais/rede/CORS) se falhar
        await window.WebDavClient.mkcolRecursive(c.pasta); // garante que a pasta raiz exista
        webdavCfg = c;
        mode = 'webdav';
        const s = loadSettings(); s.webdav = c; saveSettings(s);
        return c;
    }

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
        mode = 'local';
        await idbSet(IDB_KEY, handle);
        return handle;
    }

    // Restaura a config salva (pasta local OU WebDAV), sem pedir permissão
    // automaticamente. WebDAV tem prioridade se ambos estiverem salvos (não
    // deveria acontecer via UI normal, mas evita ambiguidade).
    async function restoreDirectory() {
        const s = loadSettings();
        if (s.webdav && s.webdav.baseUrl) {
            webdavCfg = s.webdav;
            mode = 'webdav';
            window.WebDavClient.configure(webdavCfg);
            return webdavCfg;
        }
        if (!supportsFS) return null;
        const handle = await idbGet(IDB_KEY);
        if (handle) { dirHandle = handle; mode = 'local'; }
        return handle || null;
    }

    async function ensureDirReady() {
        if (!dirHandle) throw new Error('Nenhum diretório configurado. Vá em Configurações e escolha uma pasta.');
        const ok = await verifyPermission(dirHandle, true);
        if (!ok) throw new Error('Permissão de escrita negada para o diretório.');
        return dirHandle;
    }

    function hasDirectory() { return mode === 'webdav' ? !!webdavCfg : !!dirHandle; }
    async function directoryName() {
        if (mode === 'webdav') return webdavCfg ? `Koofr (${webdavCfg.username}) — /${webdavCfg.pasta}` : null;
        return dirHandle ? dirHandle.name : null;
    }

    // Verifica se a pasta configurada ainda está acessível de verdade — não
    // só se HÁ um handle guardado, mas se a permissão continua concedida e se
    // a pasta em si ainda existe no disco (pode ter sido movida, renomeada ou
    // apagada fora do navegador, o que não revoga a permissão sozinho).
    // { requestIfNeeded: true } reprograma a permissão (mostra o prompt do
    // navegador) — só use isso a partir de um clique do usuário (gesto),
    // nunca em checagem automática (silenciosa) ao abrir o app.
    async function checkHealth(opts) {
        opts = opts || {};
        if (mode === 'webdav') {
            if (!webdavCfg) return { ok: true, hasDir: false };
            try {
                await window.WebDavClient.testConnection();
                return { ok: true, hasDir: true };
            } catch (e) {
                if (e.status === 401 || e.status === 403) return { ok: false, hasDir: true, reason: 'permission', message: e.message };
                if (e.isNetworkError) return { ok: false, hasDir: true, reason: 'network', message: e.message };
                return { ok: false, hasDir: true, reason: 'missing', message: e.message };
            }
        }
        if (!dirHandle) return { ok: true, hasDir: false };
        try {
            let perm = await dirHandle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted' && opts.requestIfNeeded) {
                perm = await dirHandle.requestPermission({ mode: 'readwrite' });
            }
            if (perm !== 'granted') return { ok: false, hasDir: true, reason: 'permission' };
        } catch (e) {
            return { ok: false, hasDir: true, reason: 'permission', message: e.message };
        }
        // Sondagem leve, só de leitura: se a pasta em si não existir mais,
        // isso falha (ex.: NotFoundError) mesmo com a permissão concedida.
        try { await dirHandle.values().next(); }
        catch (e) { return { ok: false, hasDir: true, reason: 'missing', message: e.message }; }
        return { ok: true, hasDir: true };
    }

    async function forgetDirectory() {
        if (mode === 'webdav') {
            webdavCfg = null;
            window.WebDavClient.configure(null);
            const s = loadSettings(); delete s.webdav; saveSettings(s);
            mode = 'local';
            return;
        }
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
        if (mode === 'webdav') {
            for (const name of names) { try { await window.WebDavClient.mkcolRecursive(webPath(name)); } catch (_) {} }
            return;
        }
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
        if (mode === 'webdav') {
            if (subdir) await window.WebDavClient.mkcolRecursive(webPath(subdir));
            await window.WebDavClient.put(webPath(subdir, filename), data);
            return;
        }
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
    // catalogados. Processados: subpasta (dentro dela) para onde o
    // original é movido depois de catalogado.
    const INBOX_FOLDER = 'Caixa de Entrada';
    const PROCESSED_FOLDER = 'Processados';

    async function inboxDir(create) {
        const dir = await ensureDirReady();
        return dir.getDirectoryHandle(INBOX_FOLDER, { create: !!create });
    }
    async function ensureInbox() {
        if (mode === 'webdav') {
            if (!webdavCfg) return;
            try { await window.WebDavClient.mkcolRecursive(webPath(INBOX_FOLDER)); } catch (_) {}
            try { await window.WebDavClient.mkcolRecursive(webPath(`${INBOX_FOLDER}/${PROCESSED_FOLDER}`)); } catch (_) {}
            return;
        }
        const inbox = await inboxDir(true);
        await inbox.getDirectoryHandle(PROCESSED_FOLDER, { create: true });
    }
    // Lista os arquivos (PDF/imagem) pendentes na Inbox (ignora subpastas)
    async function listInbox() {
        if (mode === 'webdav') {
            if (!webdavCfg) return [];
            let entries;
            try { entries = await window.WebDavClient.propfind(webPath(INBOX_FOLDER)); } catch (_) { return []; }
            if (!entries) return [];
            const out = [];
            for (const entry of entries) {
                if (entry.isDir) continue;
                const m = entry.nome.match(/\.([^.]+)$/);
                const ext = m ? m[1].toLowerCase() : '';
                if (!ATTACH_EXTS.includes(ext)) continue;
                out.push({ name: entry.nome, ext, size: entry.tamanho });
            }
            out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
            return out;
        }
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
        if (mode === 'webdav') {
            if (!webdavCfg) return null;
            return window.WebDavClient.get(webPath(INBOX_FOLDER, name));
        }
        const inbox = await inboxDir(true);
        const fh = await inbox.getFileHandle(name);
        return fh.getFile();
    }
    // Move o original da Inbox para Processados; sufixa em caso de colisão.
    async function moveInboxToProcessed(name) {
        if (mode === 'webdav') {
            if (!webdavCfg) return name;
            const dot = name.lastIndexOf('.');
            const base = dot > 0 ? name.slice(0, dot) : name;
            const ext = dot > 0 ? name.slice(dot) : '';
            let procEntries;
            try { procEntries = await window.WebDavClient.propfind(webPath(`${INBOX_FOLDER}/${PROCESSED_FOLDER}`)); } catch (_) { procEntries = null; }
            const existingNames = new Set((procEntries || []).filter((e) => !e.isDir).map((e) => e.nome));
            let target = name, n = 2;
            while (existingNames.has(target)) { target = `${base}-${n}${ext}`; n++; }
            await window.WebDavClient.mkcolRecursive(webPath(`${INBOX_FOLDER}/${PROCESSED_FOLDER}`));
            await window.WebDavClient.move(webPath(INBOX_FOLDER, name), webPath(`${INBOX_FOLDER}/${PROCESSED_FOLDER}`, target), false);
            return target;
        }
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
            if (mode === 'webdav') { try { await window.WebDavClient.del(webPath(subdir, `${basename}.${e}`)); } catch (_) {} }
            else { try { const d = await targetDir(subdir); await d.removeEntry(`${basename}.${e}`); } catch (_) {} }
        }
        await writeFile(`${basename}.${ext}`, fileOrBlob, subdir);
    }

    // Remove um anexo específico (todas as extensões daquele basename).
    async function deleteEntry(basename, subdir) {
        if (mode === 'webdav') {
            if (!webdavCfg) return;
            for (const ext of ATTACH_EXTS) { try { await window.WebDavClient.del(webPath(subdir, `${basename}.${ext}`)); } catch (_) {} }
            return;
        }
        if (!dirHandle) return;
        let dir;
        try { dir = await walkDir(dirHandle, subdir, false); } catch (_) { return; }
        for (const ext of ATTACH_EXTS) {
            try { await dir.removeEntry(`${basename}.${ext}`); } catch (_) {}
        }
    }

    // Remove todos os arquivos de um item: <id>.json, <id>.<ext> e <id>-*.<ext>.
    async function deleteItemFiles(id, subdir) {
        if (mode === 'webdav') {
            if (!webdavCfg) return;
            let entries;
            try { entries = await window.WebDavClient.propfind(webPath(subdir)); } catch (_) { return; }
            if (!entries) return;
            for (const entry of entries) {
                if (entry.isDir) continue;
                const name = entry.nome;
                let rm = name === `${id}.json`;
                if (!rm) {
                    const m = name.match(/^(.*)\.([^.]+)$/);
                    if (m) {
                        const base = m[1], ext = m[2].toLowerCase();
                        rm = (base === id || base.indexOf(id + '-') === 0) && ATTACH_EXTS.includes(ext);
                    }
                }
                if (rm) { try { await window.WebDavClient.del(webPath(subdir, name)); } catch (_) {} }
            }
            return;
        }
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
        if (mode === 'webdav') {
            if (!webdavCfg || fromSubdir === toSubdir) return;
            let entries;
            try { entries = await window.WebDavClient.propfind(webPath(fromSubdir)); } catch (_) { return; }
            if (!entries) return;
            const names = [];
            for (const entry of entries) {
                if (entry.isDir) continue;
                const name = entry.nome;
                if (name === `${id}.json`) { names.push(name); continue; }
                const m = name.match(/^(.*)\.([^.]+)$/);
                if (!m) continue;
                const base = m[1], ext = m[2].toLowerCase();
                if ((base === id || base.indexOf(id + '-') === 0) && ATTACH_EXTS.includes(ext)) names.push(name);
            }
            if (!names.length) return;
            try { await window.WebDavClient.mkcolRecursive(webPath(toSubdir)); } catch (_) {}
            for (const name of names) {
                try { await window.WebDavClient.move(webPath(fromSubdir, name), webPath(toSubdir, name), true); } catch (_) { /* se falhar um, segue os demais */ }
            }
            return;
        }
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
        if (mode === 'webdav') {
            if (!webdavCfg) return false;
            let entries;
            try { entries = await window.WebDavClient.propfind(webPath(name)); } catch (_) { return false; }
            if (entries === null || entries.length > 0) return false;
            try { await window.WebDavClient.del(webPath(name)); return true; } catch (_) { return false; }
        }
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
    // Renomeia/move uma pasta de sistema da raiz para outro nome ou caminho
    // (ex.: "00 Inbox" -> "Caixa de Entrada", ou "Exportar Lattes" ->
    // "Exportação/Lattes XML"), movendo todo o conteúdo — a File System
    // Access API não tem rename nativo. Não faz nada se a pasta antiga não existir.
    async function renameRootFolder(oldName, newPath) {
        if (mode === 'webdav') {
            if (!webdavCfg || oldName === newPath) return false;
            const existsOld = await window.WebDavClient.exists(webPath(oldName));
            if (!existsOld) return false;
            const parentSegs = String(newPath).split('/').filter(Boolean);
            parentSegs.pop();
            if (parentSegs.length) { try { await window.WebDavClient.mkcolRecursive(webPath(parentSegs.join('/'))); } catch (_) {} }
            try { await window.WebDavClient.move(webPath(oldName), webPath(newPath), true); return true; } catch (_) { return false; }
        }
        if (!dirHandle || oldName === newPath) return false;
        let oldHandle;
        try { oldHandle = await dirHandle.getDirectoryHandle(oldName); } catch (_) { return false; }
        const newHandle = await walkDir(dirHandle, newPath, true);
        await moveAllContents(oldHandle, newHandle);
        try { await dirHandle.removeEntry(oldName, { recursive: true }); } catch (_) {}
        return true;
    }
    // Igual a renameRootFolder, mas a pasta antiga/nova fica DENTRO de um
    // caminho pai (ex.: "00 Processado" -> "Processados" dentro de "Caixa
    // de Entrada"), não na raiz do diretório.
    async function renameNestedFolder(parentPath, oldName, newName) {
        if (mode === 'webdav') {
            if (!webdavCfg || oldName === newName) return false;
            const oldFull = parentPath ? `${parentPath}/${oldName}` : oldName;
            const newFull = parentPath ? `${parentPath}/${newName}` : newName;
            const existsOld = await window.WebDavClient.exists(webPath(oldFull));
            if (!existsOld) return false;
            try { await window.WebDavClient.move(webPath(oldFull), webPath(newFull), true); return true; } catch (_) { return false; }
        }
        if (!dirHandle || oldName === newName) return false;
        let parent;
        try { parent = await walkDir(dirHandle, parentPath, false); } catch (_) { return false; }
        let oldHandle;
        try { oldHandle = await parent.getDirectoryHandle(oldName); } catch (_) { return false; }
        const newHandle = await parent.getDirectoryHandle(newName, { create: true });
        await moveAllContents(oldHandle, newHandle);
        try { await parent.removeEntry(oldName, { recursive: true }); } catch (_) {}
        return true;
    }

    async function readAttachmentUrl(basename, subdir, ext) {
        if (mode === 'webdav') {
            if (!webdavCfg) return null;
            const tryExts = ext ? [ext.toLowerCase()] : ATTACH_EXTS;
            for (const e of tryExts) {
                try {
                    const blob = await window.WebDavClient.get(webPath(subdir, `${basename}.${e}`));
                    if (blob) return URL.createObjectURL(blob);
                } catch (_) { /* tenta próxima */ }
            }
            return null;
        }
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

    // Devolve o File (ou Blob, em modo WebDAV) de um anexo (para embutir em base64 na página pública).
    async function readAttachmentFile(basename, subdir, ext) {
        if (mode === 'webdav') {
            if (!webdavCfg) return null;
            const tryExts = ext ? [ext.toLowerCase()] : ATTACH_EXTS;
            for (const e of tryExts) {
                try {
                    const blob = await window.WebDavClient.get(webPath(subdir, `${basename}.${e}`));
                    if (blob) return blob;
                } catch (_) { /* tenta próxima */ }
            }
            return null;
        }
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
        if (mode === 'webdav') {
            if (!webdavCfg) return [];
            const items = [];
            async function scanOne(relPath) {
                let entries;
                try { entries = await window.WebDavClient.propfind(webPath(relPath)); } catch (_) { return; }
                if (!entries) return;
                for (const entry of entries) {
                    if (entry.isDir) {
                        if (entry.nome === INBOX_FOLDER) continue; // não indexa a bandeja de entrada
                        await scanOne(relPath ? `${relPath}/${entry.nome}` : entry.nome);
                    } else if (entry.nome.toLowerCase().endsWith('.json') && entry.nome !== 'catalogo.json' && entry.nome.indexOf('latteszen-') !== 0) {
                        try {
                            const blob = await window.WebDavClient.get(webPath(relPath, entry.nome));
                            if (!blob) continue;
                            const obj = JSON.parse(await blob.text());
                            if (obj && obj.id) items.push(obj);
                        } catch (_) { /* ignora inválidos */ }
                    }
                }
            }
            await scanOne('');
            return items;
        }
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

    /* ------------------------- Lixeira (localStorage) --------------------- */
    function loadTrash() {
        try { return JSON.parse(localStorage.getItem(K.trash)) || []; }
        catch (_) { return []; }
    }
    function saveTrash(items) {
        localStorage.setItem(K.trash, JSON.stringify(items));
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
        directoryName, forgetDirectory, verifyPermission, checkHealth,
        // WebDAV
        storageMode, connectWebDAV,
        // arquivos
        writeJson, writeFile, writeAttachment, deleteEntry, deleteItemFiles, moveItemFiles, removeSubdirIfEmpty, renameRootFolder, renameNestedFolder, readAttachmentUrl, readAttachmentFile, scanDirectory, ensureSubdirs,
        // bandeja de entrada (inbox)
        ensureInbox, listInbox, readInboxFile, moveInboxToProcessed,
        // catálogo + lixeira + settings
        loadCatalog, saveCatalog, loadTrash, saveTrash, loadSettings, saveSettings,
    };
})();
