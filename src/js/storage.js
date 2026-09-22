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
   lattesZen — Camada de armazenamento
   --------------------------------------------------------------------------
   - Índice do catálogo: localStorage (chave lz_catalog) — funciona sempre.
   - Arquivos (ID.pdf / ID.json): File System Access API, num diretório
     escolhido pelo usuário e persistido no IndexedDB (o handle é
     estruturável-clonável e sobrevive entre sessões, mediante permissão).
   i18n (preparação): mensagens de erro/aviso voltadas ao usuário passam
   por window.AppCore.t — só chamadas em resposta a uma ação do usuário
   ou depois do boot completo do app (nunca no carregamento deste
   módulo), então window.AppCore já existe.
   ========================================================================== */
window.Storage = (function () {
    const K = APP_CONFIG.storageKeys;
    const t = (chave, padrao, vars) => window.AppCore.t(chave, padrao, vars);
    const compararTexto = (a, b, opcoes) => window.AppCore.compararTexto(a, b, opcoes);
    const IDB_NAME = 'lattesZen';
    const IDB_STORE = 'handles';
    const IDB_KEY = 'dirHandle';
    // Nome (base, sem extensão) do arquivo na raiz do diretório onde as
    // configurações do sistema (prefixo do identificador, listas de
    // autocomplete, RSC/Súmula, etc.) são salvas automaticamente — mesmo
    // princípio já usado pra cada item do catálogo (um JSON por item):
    // escanear o diretório basta pra ter tudo de volta, sem depender de
    // lembrar de fazer um backup manual.
    const SETTINGS_FILE_BASE = 'configuracoes';
    const SETTINGS_FILE = `${SETTINGS_FILE_BASE}.json`;

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

    /* ---------------- Google Drive (alternativa à pasta local) -------------
       `mode` decide qual back-end os métodos de arquivo abaixo usam. Em modo
       'gdrive', `gdriveCfg` guarda { pasta, rootFolderId, folderCache } — o
       Drive não tem "caminho" de verdade (só relações pai/filho por ID), por
       isso o cache: evita relistar/recriar a mesma cadeia de pastas a cada
       operação. Persiste em settings; o token de acesso em si NUNCA é salvo
       (fica só em memória, renovado via GDriveClient quando preciso).
       ------------------------------------------------------------------- */
    let mode = 'local'; // 'local' | 'gdrive'
    let gdriveCfg = null;
    function storageMode() { return mode; }
    function persistGDriveConfig() {
        const s = loadSettings();
        s.gdrive = { pasta: gdriveCfg.pasta, rootFolderId: gdriveCfg.rootFolderId, folderCache: gdriveCfg.folderCache, email: gdriveCfg.email || null };
        saveSettings(s);
    }
    // E-mail da conta Google conectada, buscando e guardando em cache (na
    // config em memória + settings) se ainda não tiver sido resolvido nesta
    // conexão (ex.: conexões feitas antes desse recurso existir).
    async function ensureGDriveEmail() {
        if (gdriveCfg.email) return gdriveCfg.email;
        try {
            const email = await window.GDriveClient.testConnection();
            if (email) { gdriveCfg.email = email; persistGDriveConfig(); }
            return email;
        } catch (_) { return null; }
    }
    // Resolve o ID da pasta correspondente a um caminho relativo à pasta raiz
    // (ex.: "Evidências/01 Dados gerais"), criando cada segmento se `create`.
    // Usa e alimenta o cache por caminho completo (e por prefixo, ao longo do
    // caminho) para não repetir buscas já feitas.
    async function resolveFolder(path, create) {
        if (!path) return gdriveCfg.rootFolderId;
        const cache = gdriveCfg.folderCache;
        if (cache[path]) return cache[path];
        const segs = String(path).split('/').filter(Boolean);
        let parentId = gdriveCfg.rootFolderId;
        let acumulado = '';
        for (const seg of segs) {
            acumulado = acumulado ? `${acumulado}/${seg}` : seg;
            if (cache[acumulado]) { parentId = cache[acumulado]; continue; }
            const id = create ? await window.GDriveClient.ensureFolder(parentId, seg) : await window.GDriveClient.findFolder(parentId, seg);
            if (!id) return null;
            cache[acumulado] = id;
            parentId = id;
        }
        persistGDriveConfig();
        return parentId;
    }
    // Localiza a pasta MAIS PROFUNDA que já existe na cadeia de um
    // subdiretório, sem criar nada — ex.: se "Evidências/Formação" ainda não
    // existe (nenhum arquivo enviado ali) mas "Evidências" existe, retorna o
    // ID de "Evidências" (exact: false). Sempre resolve a algo — na pior das
    // hipóteses, a própria pasta raiz do lattesZen no Drive (exact: true
    // quando path vazio). Erros de rede/autenticação SOBEM pro chamador (não
    // são confundidos com "pasta não existe").
    async function resolveDeepestExistingFolder(path) {
        if (!path) return { id: gdriveCfg.rootFolderId, exact: true };
        const cache = gdriveCfg.folderCache;
        if (cache[path]) return { id: cache[path], exact: true };
        const segs = String(path).split('/').filter(Boolean);
        let parentId = gdriveCfg.rootFolderId;
        let acumulado = '';
        for (const seg of segs) {
            acumulado = acumulado ? `${acumulado}/${seg}` : seg;
            if (cache[acumulado]) { parentId = cache[acumulado]; continue; }
            const id = await window.GDriveClient.findFolder(parentId, seg);
            if (!id) return { id: parentId, exact: false };
            cache[acumulado] = id;
            parentId = id;
        }
        persistGDriveConfig();
        return { id: parentId, exact: true };
    }
    // URL da pasta no Google Drive de um subdiretório — a pasta exata se já
    // existir, ou a pasta ancestral mais próxima que existir (sempre abre em
    // algum lugar do Drive; nunca falha por "pasta não existe" sozinho).
    // Retorna null só fora do modo Google Drive. Erros de rede/autenticação
    // sobem pro chamador — ver AppCore.openGDriveFolder.
    async function gdriveFolderUrl(subdir) {
        if (mode !== 'gdrive' || !gdriveCfg) return null;
        const { id: parentId, exact } = await resolveDeepestExistingFolder(subdir);
        const email = await ensureGDriveEmail();
        const base = `https://drive.google.com/drive/folders/${parentId}`;
        return { url: email ? `${base}?authuser=${encodeURIComponent(email)}` : base, exact };
    }
    // Abre o seletor de arquivos do Google (Picker) pra anexar, como
    // evidência, um arquivo já existente no Drive do usuário (em vez de
    // enviar do computador). Baixa o conteúdo na hora (fica pronto pra
    // entrar no mesmo fluxo de evidências que um arquivo local) e informa se
    // o arquivo escolhido está diretamente dentro da Caixa de Entrada —
    // nesse caso, o chamador trata como se tivesse vindo de lá (inboxName),
    // completando o efeito de "mover" (original vai pra Processados) quando
    // salvar; em qualquer outro caso (dentro de outra pasta do app, ou fora
    // dele), o original fica intocado (efeito de "copiar"). Retorna null se
    // o usuário cancelar o seletor.
    async function pickDriveEvidenceFile() {
        if (mode !== 'gdrive' || !gdriveCfg) throw new Error(t('storage.erro_sem_gdrive', 'Conecte o Google Drive antes de usar este recurso.'));
        const picked = await window.GDriveClient.pickFile(APP_CONFIG.googlePickerApiKey);
        if (!picked) return null;
        let driveSourceInbox = false;
        try {
            const inboxId = await resolveFolder(inboxFolder(), false);
            if (inboxId) {
                const parents = await window.GDriveClient.getFileParents(picked.id);
                driveSourceInbox = !!(parents && parents.includes(inboxId));
            }
        } catch (_) {}
        const blob = await window.GDriveClient.getFileContent(picked.id);
        if (!blob) throw new Error(t('storage.erro_download_arquivo', 'Não foi possível baixar o conteúdo do arquivo selecionado.'));
        const file = new File([blob], picked.name, { type: blob.type || picked.mimeType || 'application/octet-stream' });
        return { file, driveSourceInbox };
    }
    // cfg.pickExisting: true abre o seletor do Drive (Picker) para o usuário
    // ESCOLHER uma pasta já existente (nome vem da própria pasta escolhida,
    // não é digitado) — usado em "já tenho um diretório". Sem isso, cfg.pasta
    // é o nome de uma pasta a criar/encontrar na raiz do Drive — usado só em
    // "primeira configuração". Retorna null se o seletor for cancelado.
    // cfg.deferCommit: true deixa `mode`/`gdriveCfg` valendo só EM MEMÓRIA,
    // sem persistir em lz_settings (ver commitGDriveConnection() abaixo) —
    // usado pela migração local→Drive (issue #140, item 3): enquanto o Drive
    // ainda não é o back-end "de verdade" (persistido), uma falha no meio da
    // cópia (rede caiu, aba fechada) não deixa o app preso apontando pra uma
    // pasta do Drive só parcialmente preenchida — restoreDirectory() no
    // próximo boot volta a achar a pasta local (nunca deixou de ser a
    // configuração persistida) exatamente como se a migração nunca tivesse
    // começado.
    async function connectGoogleDrive(cfg) {
        window.GDriveClient.configure(APP_CONFIG.googleDriveClientId);
        await window.GDriveClient.connectInteractive(); // abre o consentimento do Google
        const email = await window.GDriveClient.testConnection();
        let rootFolderId, pasta;
        if (cfg && cfg.pickExisting) {
            const picked = await window.GDriveClient.pickFolder(APP_CONFIG.googlePickerApiKey);
            if (!picked) return null; // usuário cancelou o seletor
            rootFolderId = picked.id;
            pasta = picked.name;
        } else {
            pasta = String((cfg && cfg.pasta) || '').trim() || 'lattesZen';
            rootFolderId = await window.GDriveClient.ensureFolder('root', pasta);
        }
        gdriveCfg = { pasta, rootFolderId, folderCache: {}, email: email || null };
        mode = 'gdrive';
        if (!cfg || !cfg.deferCommit) persistGDriveConfig();
        return gdriveCfg;
    }

    // Reconecta a uma pasta do Drive JÁ CONHECIDA (rootFolderId salvo por uma
    // migração pendente — ver savePendingGDriveMigration abaixo), sem passar
    // pelo seletor de novo. O token de acesso é de curta duração, então uma
    // retomada em outra sessão ainda pede o consentimento do Google (rápido,
    // pra quem já autorizou antes) — só pula a escolha da pasta em si.
    // Sempre com deferCommit: só confirma o Drive como back-end ativo se a
    // cópia (chamada por quem invoca isto) terminar com sucesso.
    async function resumeGDriveConnection(pending) {
        window.GDriveClient.configure(APP_CONFIG.googleDriveClientId);
        await window.GDriveClient.connectInteractive();
        const email = await window.GDriveClient.testConnection();
        gdriveCfg = { pasta: pending.pasta, rootFolderId: pending.rootFolderId, folderCache: {}, email: email || pending.email || null };
        mode = 'gdrive';
        return gdriveCfg;
    }

    // Confirma a conexão iniciada com deferCommit — persiste de vez o Drive
    // como back-end ativo. Só deveria ser chamada depois que a cópia dos
    // arquivos (migrateLocalToGoogleDrive) já terminou com sucesso.
    function commitGDriveConnection() {
        persistGDriveConfig();
        clearPendingGDriveMigration();
    }

    // Desfaz uma conexão iniciada com deferCommit que NÃO chegou a ser
    // confirmada (cópia falhou) — volta a apontar pro back-end local em
    // memória. Nada precisa ser desfeito de verdade: como a conexão nunca
    // foi persistida, a pasta local sempre continuou sendo a configuração
    // "de verdade" (dirHandle nunca foi tocado). A pasta do Drive pode ter
    // ficado com uma cópia parcial — inofensiva, mas mencionada no aviso de
    // migração pendente (ver tab-config.js) pra quem for conferir.
    function discardGDriveConnection() {
        mode = 'local';
        gdriveCfg = null;
    }

    // Migração pendente: registrada ANTES da cópia começar (não depois),
    // exatamente pra sobreviver a uma aba fechada/travada no meio do
    // caminho — sem isto, uma falha nesse ponto não deixava rastro nenhum
    // pra recuperação/retomada (o problema original do item 3 da issue
    // #140). Guardada em lz_settings (mesmo lugar de `gdrive`, mas numa
    // chave à parte — nunca as duas coisas ao mesmo tempo têm o mesmo
    // significado: uma é "back-end ativo", a outra é "havia uma migração em
    // andamento pra esta pasta, ainda não confirmada").
    function savePendingGDriveMigration(info) {
        const s = loadSettings();
        s.gdriveMigrationPendente = { pasta: info.pasta, rootFolderId: info.rootFolderId, email: info.email || null, iniciadaEm: nowISOStorage() };
        saveSettings(s);
    }
    function loadPendingGDriveMigration() {
        const s = loadSettings();
        return s.gdriveMigrationPendente || null;
    }
    function clearPendingGDriveMigration() {
        const s = loadSettings();
        if (s.gdriveMigrationPendente) { delete s.gdriveMigrationPendente; saveSettings(s); }
    }
    // Cópia local de nowISO() — storage.js carrega ANTES de app.js (onde
    // window.AppCore.nowISO nasce), então não pode depender dele.
    function nowISOStorage() { return new Date().toISOString(); }

    // Copia recursivamente TODO o conteúdo da pasta LOCAL ativa (dirHandle)
    // para dentro da pasta já conectada no Google Drive (gdriveCfg), mantendo
    // a mesma estrutura de subpastas. Usado na migração local → Drive:
    // conectGoogleDrive() já deve ter rodado antes (gdriveCfg preenchido).
    // NÃO apaga nada da pasta local — é só cópia; quem chama decide depois
    // se orienta o usuário a excluir a pasta local manualmente. Idempotente:
    // se falhar no meio e for chamada de novo, os arquivos já copiados só são
    // sobrescritos (upsertFile), não duplicados.
    async function migrateLocalToGoogleDrive(onProgress) {
        if (!dirHandle) throw new Error(t('storage.erro_sem_pasta_local', 'Nenhuma pasta local configurada para migrar.'));
        if (!gdriveCfg) throw new Error(t('storage.erro_sem_gdrive_migrar', 'Conecte ao Google Drive antes de migrar os arquivos.'));
        let copiados = 0;
        async function copyDir(localHandle, driveParentId) {
            for await (const [name, h] of localHandle.entries()) {
                if (h.kind === 'file') {
                    const file = await h.getFile();
                    await window.GDriveClient.upsertFile(driveParentId, name, file);
                    copiados++;
                    if (onProgress) onProgress(copiados, name);
                } else if (h.kind === 'directory') {
                    const subId = await window.GDriveClient.ensureFolder(driveParentId, name);
                    await copyDir(h, subId);
                }
            }
        }
        await copyDir(dirHandle, gdriveCfg.rootFolderId);
        return copiados;
    }

    async function verifyPermission(handle, readWrite = true) {
        const opts = { mode: readWrite ? 'readwrite' : 'read' };
        if ((await handle.queryPermission(opts)) === 'granted') return true;
        if ((await handle.requestPermission(opts)) === 'granted') return true;
        return false;
    }

    async function chooseDirectory() {
        if (!supportsFS) throw new Error(t('storage.erro_sem_fs_api', 'Navegador sem suporte à File System Access API (use Chrome ou Edge).'));
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        dirHandle = handle;
        mode = 'local';
        await idbSet(IDB_KEY, handle);
        return handle;
    }

    // Restaura a config salva (pasta local OU Google Drive), sem pedir
    // permissão/reautenticar automaticamente. Drive tem prioridade se ambos
    // estiverem salvos (não deveria acontecer via UI normal).
    async function restoreDirectory() {
        const s = loadSettings();
        if (s.gdrive && s.gdrive.rootFolderId) {
            gdriveCfg = { pasta: s.gdrive.pasta, rootFolderId: s.gdrive.rootFolderId, folderCache: s.gdrive.folderCache || {}, email: s.gdrive.email || null };
            mode = 'gdrive';
            window.GDriveClient.configure(APP_CONFIG.googleDriveClientId);
            return gdriveCfg;
        }
        if (!supportsFS) return null;
        const handle = await idbGet(IDB_KEY);
        if (handle) { dirHandle = handle; mode = 'local'; }
        return handle || null;
    }

    async function ensureDirReady() {
        if (!dirHandle) throw new Error(t('storage.erro_sem_diretorio', 'Nenhum diretório configurado. Vá em Configurações e escolha uma pasta.'));
        const ok = await verifyPermission(dirHandle, true);
        if (!ok) throw new Error(t('storage.erro_permissao_negada', 'Permissão de escrita negada para o diretório.'));
        return dirHandle;
    }

    function hasDirectory() { return mode === 'gdrive' ? !!gdriveCfg : !!dirHandle; }
    async function directoryName() {
        if (mode === 'gdrive') return gdriveCfg ? `Google Drive — /${gdriveCfg.pasta}` : null;
        return dirHandle ? dirHandle.name : null;
    }
    // Só o nome "puro" da pasta raiz (sem o prefixo "Google Drive — /" que
    // directoryName() acrescenta pra exibição) — usado no rodapé "Evidência
    // disponível em:" do Relatório (PDF), que já traz o rótulo do modo de
    // armazenamento separado (ver linhaEvidenciaDisponivelEm em pdf-report.js).
    async function rootFolderName() {
        if (mode === 'gdrive') return gdriveCfg ? gdriveCfg.pasta : null;
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
        if (mode === 'gdrive') {
            if (!gdriveCfg) return { ok: true, hasDir: false };
            try {
                await window.GDriveClient.testConnection();
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
        if (mode === 'gdrive') {
            window.GDriveClient.disconnect();
            gdriveCfg = null;
            const s = loadSettings(); delete s.gdrive; saveSettings(s);
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
        if (mode === 'gdrive') {
            for (const name of names) { try { await resolveFolder(name, true); } catch (_) {} }
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
        if (mode === 'gdrive') {
            const parentId = await resolveFolder(subdir, true);
            await window.GDriveClient.upsertFile(parentId, filename, data);
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

    const ATTACH_EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'avi', 'mkv', 'zip', 'tar', 'gz', 'xz', '7z'];

    /* ------------------------- Bandeja de entrada ------------------------ */
    // Caixa de Entrada: pasta onde o usuário deposita arquivos ainda não
    // catalogados. Processados: subpasta (dentro dela) para onde o
    // original é movido depois de catalogado.
    // Mesma chave de tradução usada pela INBOX_FOLDER de lattes-types.js (é
    // o mesmo diretório físico) — chamadas como função (não const no topo do
    // módulo) porque storage.js carrega ANTES de app-core.js (ver ordem dos
    // <script> em index.html): window.AppCore.t só existe quando estas
    // funções são de fato chamadas (sempre em resposta a uma ação, nunca no
    // carregamento do módulo), nunca no topo do arquivo.
    const inboxFolder = () => t('lattes.pasta.caixa_entrada', 'Caixa de Entrada');
    const processedFolder = () => t('storage.pasta.processados', 'Processados');

    async function inboxDir(create) {
        const dir = await ensureDirReady();
        return dir.getDirectoryHandle(inboxFolder(), { create: !!create });
    }
    // A Caixa de Entrada em si já é criada por ensureSubdirs(LattesTypes.allFolders())
    // (chamado antes desta função em toda instalação nova) — aqui só falta
    // garantir a subpasta "Processados" dentro dela.
    async function ensureInbox() {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return;
            try { await resolveFolder(`${inboxFolder()}/${processedFolder()}`, true); } catch (_) {}
            return;
        }
        const inbox = await inboxDir(true);
        await inbox.getDirectoryHandle(processedFolder(), { create: true });
    }
    // Lista os arquivos (PDF/imagem) pendentes na Inbox (ignora subpastas)
    async function listInbox() {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return [];
            const parentId = await resolveFolder(inboxFolder(), false);
            if (!parentId) return [];
            let children; try { children = await window.GDriveClient.listChildren(parentId); } catch (_) { return []; }
            const out = [];
            for (const child of children) {
                if (child.isDir || ehArquivoOculto(child.name)) continue;
                const m = child.name.match(/\.([^.]+)$/);
                const ext = m ? m[1].toLowerCase() : '';
                if (!ATTACH_EXTS.includes(ext)) continue;
                out.push({ name: child.name, ext, size: child.size });
            }
            out.sort((a, b) => compararTexto(a.name, b.name));
            return out;
        }
        let inbox; try { inbox = await inboxDir(true); } catch (_) { return []; }
        const out = [];
        for await (const [name, h] of inbox.entries()) {
            if (h.kind !== 'file' || ehArquivoOculto(name)) continue;
            const m = name.match(/\.([^.]+)$/);
            const ext = m ? m[1].toLowerCase() : '';
            if (!ATTACH_EXTS.includes(ext)) continue;
            let size = null;
            try { size = (await h.getFile()).size; } catch (_) {}
            out.push({ name, ext, size });
        }
        out.sort((a, b) => compararTexto(a.name, b.name));
        return out;
    }
    async function readInboxFile(name) {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return null;
            const parentId = await resolveFolder(inboxFolder(), false);
            if (!parentId) return null;
            const fileId = await window.GDriveClient.findFile(parentId, name);
            return fileId ? window.GDriveClient.getFileContent(fileId) : null;
        }
        const inbox = await inboxDir(true);
        const fh = await inbox.getFileHandle(name);
        return fh.getFile();
    }
    // Move o original da Inbox para Processados; sufixa em caso de colisão.
    async function moveInboxToProcessed(name) {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return name;
            const inboxId = await resolveFolder(inboxFolder(), true);
            const procId = await resolveFolder(`${inboxFolder()}/${processedFolder()}`, true);
            const dot = name.lastIndexOf('.');
            const base = dot > 0 ? name.slice(0, dot) : name;
            const ext = dot > 0 ? name.slice(dot) : '';
            const procChildren = await window.GDriveClient.listChildren(procId);
            const existingNames = new Set(procChildren.filter((c) => !c.isDir).map((c) => c.name));
            let target = name, n = 2;
            while (existingNames.has(target)) { target = `${base}-${n}${ext}`; n++; }
            const fileId = await window.GDriveClient.findFile(inboxId, name);
            if (!fileId) return target;
            await window.GDriveClient.moveFile(fileId, procId, inboxId);
            if (target !== name) await window.GDriveClient.renameFile(fileId, target);
            return target;
        }
        const inbox = await inboxDir(true);
        const proc = await inbox.getDirectoryHandle(processedFolder(), { create: true });
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
            if (mode === 'gdrive') { try { const parentId = await resolveFolder(subdir, true); await window.GDriveClient.removeFileIfExists(parentId, `${basename}.${e}`); } catch (_) {} }
            else { try { const d = await targetDir(subdir); await d.removeEntry(`${basename}.${e}`); } catch (_) {} }
        }
        await writeFile(`${basename}.${ext}`, fileOrBlob, subdir);
    }

    // Remove um anexo específico (todas as extensões daquele basename).
    async function deleteEntry(basename, subdir) {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return;
            const parentId = await resolveFolder(subdir, false);
            if (!parentId) return;
            for (const ext of ATTACH_EXTS) { try { await window.GDriveClient.removeFileIfExists(parentId, `${basename}.${ext}`); } catch (_) {} }
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
        if (mode === 'gdrive') {
            if (!gdriveCfg) return;
            const parentId = await resolveFolder(subdir, false);
            if (!parentId) return;
            let children; try { children = await window.GDriveClient.listChildren(parentId); } catch (_) { return; }
            for (const child of children) {
                if (child.isDir) continue;
                let rm = child.name === `${id}.json`;
                if (!rm) {
                    const m = child.name.match(/^(.*)\.([^.]+)$/);
                    if (m) { const base = m[1], ext = m[2].toLowerCase(); rm = (base === id || base.indexOf(id + '-') === 0) && ATTACH_EXTS.includes(ext); }
                }
                if (rm) { try { await window.GDriveClient.deleteFile(child.id); } catch (_) {} }
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
        if (mode === 'gdrive') {
            if (!gdriveCfg || fromSubdir === toSubdir) return;
            const fromId = await resolveFolder(fromSubdir, false);
            if (!fromId) return;
            let children; try { children = await window.GDriveClient.listChildren(fromId); } catch (_) { return; }
            const matches = children.filter((child) => {
                if (child.isDir) return false;
                if (child.name === `${id}.json`) return true;
                const m = child.name.match(/^(.*)\.([^.]+)$/);
                if (!m) return false;
                const base = m[1], ext = m[2].toLowerCase();
                return (base === id || base.indexOf(id + '-') === 0) && ATTACH_EXTS.includes(ext);
            });
            if (!matches.length) return;
            const toId = await resolveFolder(toSubdir, true);
            for (const child of matches) {
                try { await window.GDriveClient.moveFile(child.id, toId, fromId); } catch (_) { /* se falhar um, segue os demais */ }
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
    // qualquer arquivo restante, por segurança. `path` pode ter "/" (subpasta
    // aninhada), não só um nome direto na raiz.
    async function removeSubdirIfEmpty(path) {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return false;
            const id = await resolveFolder(path, false);
            if (!id) return false;
            let children; try { children = await window.GDriveClient.listChildren(id); } catch (_) { return false; }
            if (children.length > 0) return false;
            try { await window.GDriveClient.deleteFile(id); delete gdriveCfg.folderCache[path]; persistGDriveConfig(); return true; } catch (_) { return false; }
        }
        if (!dirHandle) return false;
        const segs = String(path).split('/').filter(Boolean);
        const leaf = segs.pop();
        let parent;
        try { parent = segs.length ? await walkDir(dirHandle, segs.join('/'), false) : dirHandle; } catch (_) { return false; }
        let sub;
        try { sub = await parent.getDirectoryHandle(leaf); } catch (_) { return false; }
        for await (const _ of sub.values()) { return false; }
        try { await parent.removeEntry(leaf, { recursive: true }); return true; } catch (_) { return false; }
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
    // Renomeia/move uma pasta pra outro nome ou caminho (ex.: "00 Inbox" ->
    // "Caixa de Entrada", ou "Evidências/20 Fotos de Perfil" ->
    // "Evidências/01 Dados Gerais/01.1 Fotos de Perfil"), movendo todo o
    // conteúdo — a File System Access API não tem rename nativo. `oldPath`
    // pode ter "/" (não precisa estar na raiz). Não faz nada se a pasta
    // antiga não existir.
    async function renameRootFolder(oldPath, newPath) {
        if (mode === 'gdrive') {
            if (!gdriveCfg || oldPath === newPath) return false;
            const oldId = await resolveFolder(oldPath, false);
            if (!oldId) return false;
            const newSegs = String(newPath).split('/').filter(Boolean);
            const newLeaf = newSegs.pop();
            const newParentPath = newSegs.join('/');
            const newParentId = newParentPath ? await resolveFolder(newParentPath, true) : gdriveCfg.rootFolderId;
            try { await window.GDriveClient.moveAndRename(oldId, newParentId, gdriveCfg.rootFolderId, newLeaf); }
            catch (_) { return false; }
            delete gdriveCfg.folderCache[oldPath];
            gdriveCfg.folderCache[newPath] = oldId;
            persistGDriveConfig();
            return true;
        }
        if (!dirHandle || oldPath === newPath) return false;
        const oldSegs = String(oldPath).split('/').filter(Boolean);
        const oldLeaf = oldSegs.pop();
        let oldParent, oldHandle;
        try {
            oldParent = oldSegs.length ? await walkDir(dirHandle, oldSegs.join('/'), false) : dirHandle;
            oldHandle = await oldParent.getDirectoryHandle(oldLeaf);
        } catch (_) { return false; }
        const newHandle = await walkDir(dirHandle, newPath, true);
        await moveAllContents(oldHandle, newHandle);
        try { await oldParent.removeEntry(oldLeaf, { recursive: true }); } catch (_) {}
        return true;
    }
    // Igual a renameRootFolder, mas a pasta antiga/nova fica DENTRO de um
    // caminho pai (ex.: "00 Processado" -> "Processados" dentro de "Caixa
    // de Entrada"), não na raiz do diretório.
    async function renameNestedFolder(parentPath, oldName, newName) {
        if (mode === 'gdrive') {
            if (!gdriveCfg || oldName === newName) return false;
            const oldFull = parentPath ? `${parentPath}/${oldName}` : oldName;
            const newFull = parentPath ? `${parentPath}/${newName}` : newName;
            const oldId = await resolveFolder(oldFull, false);
            if (!oldId) return false;
            try { await window.GDriveClient.renameFile(oldId, newName); } catch (_) { return false; }
            delete gdriveCfg.folderCache[oldFull];
            gdriveCfg.folderCache[newFull] = oldId;
            persistGDriveConfig();
            return true;
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
        if (mode === 'gdrive') {
            if (!gdriveCfg) return null;
            const parentId = await resolveFolder(subdir, false);
            if (!parentId) return null;
            const tryExts = ext ? [ext.toLowerCase()] : ATTACH_EXTS;
            for (const e of tryExts) {
                try {
                    const fileId = await window.GDriveClient.findFile(parentId, `${basename}.${e}`);
                    if (!fileId) continue;
                    const blob = await window.GDriveClient.getFileContent(fileId);
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

    // Devolve o File (ou Blob, em modo Google Drive) de um anexo (para
    // embutir em base64 na página pública).
    async function readAttachmentFile(basename, subdir, ext) {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return null;
            const parentId = await resolveFolder(subdir, false);
            if (!parentId) return null;
            const tryExts = ext ? [ext.toLowerCase()] : ATTACH_EXTS;
            for (const e of tryExts) {
                try {
                    const fileId = await window.GDriveClient.findFile(parentId, `${basename}.${e}`);
                    if (!fileId) continue;
                    const blob = await window.GDriveClient.getFileContent(fileId);
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

    // Tenta de novo em caso de falha transitória (rede instável, comum em
    // celular) antes de desistir — usado na varredura do Google Drive
    // (scanDirectory), onde uma biblioteca grande dispara centenas de
    // requisições sequenciais (uma por pasta + uma por arquivo .json, sem
    // lote nenhum) e uma falha isolada não deveria descartar o resto da
    // árvore em silêncio (bug relatado pelo Alexsandro: sincronizar ~400
    // itens de uma pasta do Drive pelo celular mostrava só ~70 — a
    // varredura recursiva desistia da 1ª pasta que engasgasse, sem avisar).
    async function comRetentativas(fn, tentativas) {
        tentativas = tentativas || 3;
        let ultimoErro;
        for (let i = 0; i < tentativas; i++) {
            try { return await fn(); }
            catch (e) {
                ultimoErro = e;
                if (i < tentativas - 1) await new Promise((r) => setTimeout(r, 400 * Math.pow(2, i)));
            }
        }
        throw ultimoErro;
    }

    // Limita quantas chamadas de `fn` rodam ao mesmo tempo (semáforo simples)
    // — usado pra paralelizar a varredura do Google Drive sem disparar
    // centenas de requisições simultâneas de uma vez (esbarraria em rate
    // limit do Drive e sobrecarregaria uma conexão móvel fraca). max=6
    // acompanha o limite de conexões simultâneas por origem que os
    // navegadores já aplicam sozinhos — não adianta pedir mais que isso.
    function criarLimitador(max) {
        let ativos = 0;
        const fila = [];
        function proximo() {
            if (ativos >= max || !fila.length) return;
            ativos += 1;
            const { fn, resolve, reject } = fila.shift();
            fn().then(
                (v) => { ativos -= 1; resolve(v); proximo(); },
                (e) => { ativos -= 1; reject(e); proximo(); },
            );
        }
        return function executar(fn) {
            return new Promise((resolve, reject) => { fila.push({ fn, resolve, reject }); proximo(); });
        };
    }

    // Nomes de arquivo que nunca são conteúdo de verdade do catálogo — o
    // sistema operacional os recria sozinho em pastas externas/de rede
    // (ex.: "._nome.json", o "AppleDouble" que o macOS usa pra guardar
    // metadados de recurso ao copiar/sincronizar arquivos fora de um disco
    // formatado como APFS/HFS+ — mantém a extensão original, então batia
    // com o filtro de ".json" e o app tentava ler como se fosse um item de
    // verdade, sempre falhando o JSON.parse pra sempre — como esses
    // arquivos nunca somem sozinhos, toda sincronização reportava a MESMA
    // falha, indefinidamente, até apagar manualmente. Pedido do Alexsandro:
    // simplesmente ignorar qualquer nome começando com "." (também cobre
    // ".DS_Store" e afins) em vez de tentar ler.
    function ehArquivoOculto(name) { return String(name).charAt(0) === '.'; }

    // Nomes reservados na raiz do diretório que nunca são um item de
    // catálogo — o índice (catalogo.json), o antigo blob de configurações
    // (SETTINGS_FILE), exports legados ("latteszen-...") e, a partir desta
    // versão, um arquivo por módulo de configuração (ver
    // "Configurações modulares" mais abaixo) — sem isto, scanDirectory()
    // tentaria ler "rsc.json"/"nuvem-palavras.json" etc. como se fossem
    // itens do catálogo.
    const MODULOS_CONFIG = ['nuvem-palavras', 'rsc', 'sumula', 'geral', 'publicar', 'acessibilidade'];
    function ehArquivoDeConfiguracao(name) {
        return name === 'catalogo.json' || name === SETTINGS_FILE || name.indexOf('latteszen-') === 0
            || MODULOS_CONFIG.some((m) => name === `${m}.json`);
    }

    // Varre uma lista de "raízes" no Google Drive — cada raiz é
    // { tipo: 'pasta', id, caminho } (varre a pasta inteira, recursivamente)
    // ou { tipo: 'arquivo', id, caminho, pastaCaminho } (lê só ESSE arquivo,
    // sem relistar a pasta-mãe). Mesma função serve pra varredura completa
    // (raízes = [pasta raiz]) e pra "tentar de novo só o que falhou"
    // (raízes = os `detalhes` de uma varredura anterior — ver
    // retentarFalhasSincronizacao) — o formato de entrada e saída é o mesmo.
    // `detalhes` no retorno é a lista do que NÃO deu certo desta vez, no
    // mesmo formato de entrada, pronta pra alimentar uma nova tentativa.
    async function varrerArvoreGDrive(raizes, onProgress) {
        const items = [];
        let falhas = 0;
        const detalhes = [];
        // Varredura em PARALELO (até 6 requisições ao mesmo tempo) — pedido
        // do Alexsandro: no celular, uma biblioteca grande do Drive demorava
        // demais porque cada pasta e cada arquivo era buscado em série, um
        // de cada vez, pagando o round-trip da rede móvel centenas de vezes
        // seguidas. A ordem de chegada em `items` deixa de ser previsível,
        // mas isso não importa (syncFromDirectory mescla por id).
        const limite = criarLimitador(6);
        async function scanPasta(folderId, caminho) {
            let children;
            try { children = await limite(() => comRetentativas(() => window.GDriveClient.listChildren(folderId))); }
            catch (_) { falhas += 1; detalhes.push({ tipo: 'pasta', id: folderId, caminho: caminho || '(raiz)' }); return; }
            await Promise.all(children.map((child) => {
                if (child.isDir) {
                    if (child.name === inboxFolder()) return Promise.resolve(); // não indexa a bandeja de entrada
                    return scanPasta(child.id, caminho ? `${caminho}/${child.name}` : child.name);
                }
                if (!ehArquivoOculto(child.name) && child.name.toLowerCase().endsWith('.json') && !ehArquivoDeConfiguracao(child.name)) {
                    return lerArquivo(child.id, caminho ? `${caminho}/${child.name}` : child.name, caminho);
                }
                return Promise.resolve();
            }));
        }
        async function lerArquivo(fileId, caminhoArquivo, pastaCaminho) {
            try {
                const blob = await limite(() => comRetentativas(() => window.GDriveClient.getFileContent(fileId)));
                if (!blob) { falhas += 1; detalhes.push({ tipo: 'arquivo', id: fileId, caminho: caminhoArquivo, pastaCaminho: pastaCaminho || '(raiz)' }); return; }
                const obj = JSON.parse(await blob.text());
                if (obj && obj.id) { items.push(obj); if (onProgress) onProgress(items.length); }
            } catch (_) { falhas += 1; detalhes.push({ tipo: 'arquivo', id: fileId, caminho: caminhoArquivo, pastaCaminho: pastaCaminho || '(raiz)' }); }
        }
        await Promise.all(raizes.map((r) => (r.tipo === 'arquivo' ? lerArquivo(r.id, r.caminho, r.pastaCaminho) : scanPasta(r.id, r.caminho))));
        return { items, falhas, detalhes };
    }

    // Mesma ideia de varrerArvoreGDrive(), pro back-end de pasta local (File
    // System Access API) — `handle` no lugar de `id`.
    async function varrerArvoreLocal(raizes, onProgress) {
        const items = [];
        let falhas = 0;
        const detalhes = [];
        async function scanPasta(handle, caminho) {
            try {
                for await (const [name, h] of handle.entries()) {
                    if (h.kind === 'file' && !ehArquivoOculto(name) && name.toLowerCase().endsWith('.json') && !ehArquivoDeConfiguracao(name)) {
                        await lerArquivo(h, caminho ? `${caminho}/${name}` : name, caminho);
                    } else if (h.kind === 'directory') {
                        if (name === inboxFolder()) continue; // não indexa a bandeja de entrada
                        await scanPasta(h, caminho ? `${caminho}/${name}` : name);
                    }
                }
            } catch (_) { falhas += 1; detalhes.push({ tipo: 'pasta', handle, caminho: caminho || '(raiz)' }); }
        }
        async function lerArquivo(h, caminhoArquivo, pastaCaminho) {
            try {
                const file = await h.getFile();
                const obj = JSON.parse(await file.text());
                if (obj && obj.id) { items.push(obj); if (onProgress) onProgress(items.length); }
            } catch (_) { falhas += 1; detalhes.push({ tipo: 'arquivo', handle: h, caminho: caminhoArquivo, pastaCaminho: pastaCaminho || '(raiz)' }); }
        }
        await Promise.all(raizes.map((r) => (r.tipo === 'arquivo' ? lerArquivo(r.handle, r.caminho, r.pastaCaminho) : scanPasta(r.handle, r.caminho))));
        return { items, falhas, detalhes };
    }

    // Reconstrói o catálogo a partir dos *.json (raiz e subdiretórios de
    // categoria). Devolve { items, falhas, detalhes } — falhas é a contagem
    // total (pastas + arquivos que não puderam ser lidos mesmo depois de
    // tentar de novo) e `detalhes` diz ONDE cada uma aconteceu (pedido do
    // Alexsandro: um aviso genérico "2 pasta(s) não puderam ser lidas", sem
    // dizer quais pastas nem quantos itens ficaram de fora, não ajudava a
    // decidir o que fazer). Cada entrada de `detalhes` já vem pronta pra
    // alimentar retentarFalhasSincronizacao() — "tentar de novo" só o que
    // faltou, sem repetir a varredura inteira. onProgress(n) opcional —
    // chamado a cada item encontrado, com a contagem corrente (feedback de
    // progresso numa sincronização longa).
    async function scanDirectory(onProgress) {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return { items: [], falhas: 0, detalhes: [] };
            return varrerArvoreGDrive([{ tipo: 'pasta', id: gdriveCfg.rootFolderId, caminho: '' }], onProgress);
        }
        const dir = await ensureDirReady();
        return varrerArvoreLocal([{ tipo: 'pasta', handle: dir, caminho: '' }], onProgress);
    }

    // "Tentar de novo" só o que falhou numa sincronização anterior — recebe
    // o `detalhes` devolvido por scanDirectory() (ou por uma tentativa
    // anterior desta mesma função) e refaz SÓ aquelas pastas/arquivos, sem
    // varrer a biblioteca inteira de novo. Mesmo formato de retorno de
    // scanDirectory ({ items, falhas, detalhes }); quem chama (
    // syncFromDirectory, em app.js) ainda precisa mesclar `items` no
    // catálogo, igual faz com o resultado de scanDirectory.
    async function retentarFalhasSincronizacao(detalhes, onProgress) {
        if (!detalhes || !detalhes.length) return { items: [], falhas: 0, detalhes: [] };
        return mode === 'gdrive' ? varrerArvoreGDrive(detalhes, onProgress) : varrerArvoreLocal(detalhes, onProgress);
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
    // Agenda a gravação de configuracoes.json na raiz do diretório (debounced,
    // pra não regravar a cada tecla digitada num campo de texto — mesmo
    // padrão de debounce já usado ao salvar campos de texto longos). Falha
    // silenciosamente (ex.: sem diretório ainda, ou permissão perdida): a
    // saúde do diretório já é sinalizada em outro lugar da UI.
    let settingsWriteTimer = null;
    function scheduleSettingsWrite() {
        if (!hasDirectory()) return;
        clearTimeout(settingsWriteTimer);
        settingsWriteTimer = setTimeout(() => {
            writeJson(SETTINGS_FILE_BASE, loadSettings()).catch(() => {});
        }, 800);
    }
    function saveSettings(s) {
        try { localStorage.setItem(K.settings, JSON.stringify(s)); }
        catch (e) {
            // Mesma proteção que AppCore.saveCatalog()/saveTrash() já têm
            // contra estouro de cota do localStorage — sem isto, uma falha
            // aqui (ex.: RSC/Súmula com texto grande) era engolida em
            // silêncio, sem nenhum aviso ao usuário.
            if (window.AppCore) window.AppCore.toast(t('storage.erro_armazenamento_cheio', 'Não foi possível salvar as configurações (armazenamento cheio).'), 'erro');
            return false;
        }
        scheduleSettingsWrite();
        return true;
    }
    // Lê um arquivo .json (nome completo, com extensão) da RAIZ do diretório
    // configurado — devolve null se não existir, sem diretório, ou qualquer
    // erro de leitura/parse. Base de readSettingsFromDirectory() (o antigo
    // "configuracoes.json") e de readConfigModule() (os novos módulos, ver
    // abaixo) — mesma lógica gdrive/local, extraída pra não duplicar.
    async function lerJsonDaRaiz(nomeComExtensao) {
        if (mode === 'gdrive') {
            if (!gdriveCfg) return null;
            try {
                const fileId = await window.GDriveClient.findFile(gdriveCfg.rootFolderId, nomeComExtensao);
                if (!fileId) return null;
                const blob = await window.GDriveClient.getFileContent(fileId);
                if (!blob) return null;
                return JSON.parse(await blob.text());
            } catch (_) { return null; }
        }
        try {
            const dir = await ensureDirReady();
            const fh = await dir.getFileHandle(nomeComExtensao);
            const file = await fh.getFile();
            return JSON.parse(await file.text());
        } catch (_) { return null; }
    }
    // Lê configuracoes.json da raiz do diretório, se existir — hoje só serve
    // de FALLBACK pra migrar bibliotecas de antes da modularização (ver
    // MODULOS_CONFIG/restaurarModuloConfig abaixo): a partir desta versão,
    // cada módulo grava e lê seu próprio arquivo, então configuracoes.json
    // só ainda guarda o que é mesmo local/deste dispositivo (ex.:
    // gdriveMigrationPendente, avisoDevVisto, sinceBackup — ver comentário em
    // storageKeys, config.js).
    async function readSettingsFromDirectory() { return lerJsonDaRaiz(SETTINGS_FILE); }

    /* --------------- Configurações modulares (1 JSON por módulo) ---------
       Pedido do Alexsandro: nuvem de palavras, RSC, Súmula etc. deveriam
       sobreviver a trocar de dispositivo do mesmo jeito que os itens do
       catálogo já sobrevivem — cada módulo no seu próprio JSON na raiz do
       diretório (não mais um único "configuracoes.json" genérico), pra
       "Exportar configurações" deixar de ser necessário: basta reconectar
       ao mesmo diretório/Google Drive pra ter tudo de volta.
       ----------------------------------------------------------------- */
    function nomeArquivoModulo(modulo) { return `${modulo}.json`; }
    async function readConfigModule(modulo) {
        if (!hasDirectory()) return null;
        return lerJsonDaRaiz(nomeArquivoModulo(modulo));
    }
    // Grava um módulo (debounced, mesmo padrão de scheduleSettingsWrite —
    // várias chamadas seguidas, ex. digitando no memorial do RSC, colapsam
    // numa escrita só). Silencioso sem diretório, mesmo padrão de sempre.
    const moduloWriteTimers = {};
    function writeConfigModule(modulo, dados) {
        if (!hasDirectory()) return;
        clearTimeout(moduloWriteTimers[modulo]);
        moduloWriteTimers[modulo] = setTimeout(() => {
            // writeJson() já acrescenta ".json" sozinho (mesmo padrão de
            // SETTINGS_FILE_BASE) — passar nomeArquivoModulo() aqui (que já
            // tem a extensão) gravaria "rsc.json.json".
            writeJson(modulo, dados).catch(() => {});
        }, 800);
    }
    // Restaura um módulo: 1) tenta o arquivo próprio dele; 2) sem ele, tenta
    // extrair do configuracoes.json antigo (`extrairDoAntigo`, biblioteca de
    // antes desta modularização); 3) sem os dois, usa o estado ATUAL deste
    // dispositivo. Nos casos 2 e 3, GRAVA o resultado no arquivo do módulo —
    // corrige a causa raiz do problema relatado pelo Alexsandro: antes, uma
    // configuração só ia pro diretório se alguém clicasse "Salvar" DEPOIS de
    // já haver diretório configurado; conectar/sincronizar em si nunca
    // "semeava" o que o dispositivo já tinha. Agora toda sincronização
    // garante que o módulo existe no diretório, vindo de algum lugar.
    // Devolve { dados, deFora } — deFora=true quando os dados vieram do
    // diretório de verdade (arquivo do módulo ou o blob antigo), pra quem
    // chama distinguir "restaurei algo de fato" de "só semeei com o que
    // este dispositivo já tinha" (ex.: pra decidir se mostra "configurações
    // restauradas" na tela).
    async function restaurarModuloConfig(modulo, blobAntigo, extrairDoAntigo, estadoLocalAtual) {
        const doArquivo = await readConfigModule(modulo);
        if (doArquivo) return { dados: doArquivo, deFora: true };
        const doAntigo = blobAntigo ? extrairDoAntigo(blobAntigo) : null;
        const dados = doAntigo || estadoLocalAtual;
        writeConfigModule(modulo, dados);
        return { dados, deFora: !!doAntigo };
    }

    /* ------------- Tokens de publicação direta (GitHub/Netlify) ---------- */
    // Guardados numa chave própria do localStorage, separada de
    // loadSettings()/saveSettings() — ver comentário em APP_CONFIG.storageKeys.
    function loadDeployTokens() {
        try { return JSON.parse(localStorage.getItem(K.deployTokens)) || {}; }
        catch (_) { return {}; }
    }
    function loadDeployToken(provider) { return loadDeployTokens()[provider] || ''; }
    function saveDeployToken(provider, token) {
        const t = loadDeployTokens();
        if (token) t[provider] = token; else delete t[provider];
        localStorage.setItem(K.deployTokens, JSON.stringify(t));
    }

    return {
        supportsFS,
        // diretório
        chooseDirectory, restoreDirectory, ensureDirReady, hasDirectory,
        directoryName, rootFolderName, forgetDirectory, verifyPermission, checkHealth,
        // Google Drive
        storageMode, connectGoogleDrive, migrateLocalToGoogleDrive, gdriveFolderUrl,
        pickDriveEvidenceFile,
        // Migração local→Drive: confirmação/desfazimento da conexão adiada
        // (deferCommit) e a migração pendente que sobrevive a uma aba
        // fechada no meio da cópia — ver comentários nas próprias funções.
        resumeGDriveConnection, commitGDriveConnection, discardGDriveConnection,
        savePendingGDriveMigration, loadPendingGDriveMigration, clearPendingGDriveMigration,
        // arquivos
        writeJson, writeFile, writeAttachment, deleteEntry, deleteItemFiles, moveItemFiles, removeSubdirIfEmpty, renameRootFolder, renameNestedFolder, readAttachmentUrl, readAttachmentFile, scanDirectory, retentarFalhasSincronizacao, ensureSubdirs,
        // comRetentativas/criarLimitador expostas só para teste (tools/tests/specs/gdrive-sync-retry.mjs)
        comRetentativas, criarLimitador,
        // bandeja de entrada (inbox)
        ensureInbox, listInbox, readInboxFile, moveInboxToProcessed,
        // catálogo + lixeira + settings
        loadCatalog, saveCatalog, loadTrash, saveTrash, loadSettings, saveSettings, readSettingsFromDirectory,
        loadDeployToken, saveDeployToken,
        // Configurações modulares (1 JSON por módulo na raiz do diretório —
        // ver comentário acima de readConfigModule) — usadas por app.js
        // (syncFromDirectory, persistirXxx) pra ler/escrever/restaurar cada
        // módulo (nuvem de palavras, RSC, Súmula, geral, publicar, acessibilidade).
        readConfigModule, writeConfigModule, restaurarModuloConfig,
    };
})();
