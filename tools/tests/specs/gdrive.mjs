/* ==========================================================================
   Regressão: armazenamento remoto via Google Drive (issue #12)
   --------------------------------------------------------------------------
   Não há como testar contra uma conta Google real no CI — a Google Identity
   Services (accounts.google.com/gsi/client) e a Drive API (googleapis.com)
   são simuladas: a primeira via um script fake que responde ao
   requestAccessToken() como o SDK real faria (callback com token ou erro);
   a segunda via um "Drive" mínimo em memória (pastas/arquivos com
   relação pai/filho por ID, como o Drive de verdade — sem "caminho").
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

const TEST_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

const FAKE_GIS_JS = `
window.google = window.google || {};
window.google.accounts = window.google.accounts || {};
window.google.accounts.oauth2 = {
    initTokenClient(config) {
        const client = { callback: config.callback };
        client.requestAccessToken = function () {
            setTimeout(() => {
                if (window.__gisMockError) { client.callback({ error: window.__gisMockError }); }
                else { client.callback({ access_token: 'fake-token-' + Math.random().toString(36).slice(2), expires_in: window.__gisMockExpiresIn || 3600 }); }
            }, 10);
        };
        return client;
    },
    revoke(token, cb) { if (cb) cb(); },
};
`;

async function mockGis(page) {
    await page.route('https://accounts.google.com/gsi/client', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_GIS_JS }));
}

// Simula o Google Picker (usado por GDriveClient.pickFolder, no assistente
// "Já tenho um diretório" > Google Drive) já "resolvido" (window.google.picker
// preenchido ANTES da navegação) — pickFolder() checa isso primeiro e nunca
// tenta baixar o script real (apis.google.com/js/api.js), então nem precisa
// interceptar rede pra isto. setVisible() simula o usuário escolhendo (ou
// cancelando) a pasta de forma assíncrona, como o seletor real faria.
async function mockPicker(page, { id = 'picked-folder-id', name = 'MinhaPastaExistente', cancelar = false } = {}) {
    await page.addInitScript(({ id, name, cancelar }) => {
        function DocsView() {
            this.setIncludeFolders = function () { return this; };
            this.setSelectFolderEnabled = function () { return this; };
            this.setEnableDrives = function () { return this; };
            this.setLabel = function () { return this; };
            this.setMimeTypes = function () { return this; };
            this.setParent = function () { return this; };
        }
        function PickerBuilder() {
            let callback = null;
            this.addView = function () { return this; };
            this.setOAuthToken = function () { return this; };
            this.setDeveloperKey = function () { return this; };
            this.setLocale = function () { return this; };
            this.setCallback = function (fn) { callback = fn; return this; };
            this.build = function () {
                return {
                    setVisible() {
                        setTimeout(() => {
                            if (cancelar) callback({ action: 'cancel' });
                            else callback({ action: 'picked', docs: [{ id, name }] });
                        }, 10);
                    },
                };
            };
        }
        window.google = window.google || {};
        window.google.picker = { ViewId: { DOCS: 'docs', FOLDERS: 'folders' }, Action: { PICKED: 'picked', CANCEL: 'cancel' }, DocsView, PickerBuilder };
    }, { id, name, cancelar });
}

// Servidor Drive mínimo, em memória: `files` (Map id -> {id,name,parentId,isDir,content,mimeType}).
function createMockDrive() {
    let nextId = 1;
    const files = new Map();
    files.set('root', { id: 'root', name: '', parentId: null, isDir: true, content: null });
    let offline = false;
    let forbidden = false;
    // Falha seletiva (em vez de offline/forbidden globais) — pra testar
    // detalhes de falha (Storage.scanDirectory) e "tentar de novo só o que
    // falhou" (retentarFalhasSincronizacao): só as pastas/arquivos cujo id
    // está nestes sets falham (abortam a conexão), o resto do Drive
    // simulado continua respondendo normalmente.
    let failFolderIds = new Set();
    let failFileIds = new Set();

    function newId() { return 'f' + (nextId++); }
    function childrenOf(parentId) { return Array.from(files.values()).filter((f) => f.parentId === parentId); }

    async function handle(route) {
        if (offline) { await route.abort('failed'); return; }
        const req = route.request();
        const method = req.method();
        const url = new URL(req.url());
        if (forbidden) { await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 401, message: 'Invalid Credentials' } }) }); return; }

        if (url.pathname === '/drive/v3/about') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { emailAddress: 'usuaria@example.com' } }) });
            return;
        }
        if (url.pathname === '/drive/v3/files' && method === 'GET') {
            const q = url.searchParams.get('q') || '';
            const parentMatch = q.match(/'([^']*)' in parents/);
            const parentId = parentMatch ? parentMatch[1] : null;
            if (parentId && failFolderIds.has(parentId)) { await route.abort('failed'); return; }
            const nameMatch = q.match(/name = '((?:[^'\\]|\\.)*)'/);
            const name = nameMatch ? nameMatch[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\') : null;
            const foldersOnly = /mimeType = 'application\/vnd\.google-apps\.folder'/.test(q);
            const excludeFolders = /mimeType != 'application\/vnd\.google-apps\.folder'/.test(q);
            let results = childrenOf(parentId);
            if (name !== null) results = results.filter((f) => f.name === name);
            if (foldersOnly) results = results.filter((f) => f.isDir);
            if (excludeFolders) results = results.filter((f) => !f.isDir);
            const body = { files: results.map((f) => ({ id: f.id, name: f.name, mimeType: f.isDir ? 'application/vnd.google-apps.folder' : (f.mimeType || 'application/octet-stream'), size: f.isDir ? undefined : String((f.content || '').length) })) };
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
            return;
        }
        if (url.pathname === '/drive/v3/files' && method === 'POST') {
            const meta = JSON.parse(req.postData() || '{}');
            const id = newId();
            files.set(id, { id, name: meta.name, parentId: (meta.parents || [])[0] || 'root', isDir: meta.mimeType === 'application/vnd.google-apps.folder', content: null, mimeType: meta.mimeType });
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id }) });
            return;
        }
        if (url.pathname === '/upload/drive/v3/files' && method === 'POST') {
            const raw = req.postData() || '';
            const ct = req.headers()['content-type'] || '';
            const boundaryMatch = ct.match(/boundary=([^;]+)/);
            const boundary = boundaryMatch ? boundaryMatch[1] : null;
            let metaStr = '{}', content = '', mimeType = 'application/octet-stream';
            if (boundary) {
                const parts = raw.split(`--${boundary}`).filter((p) => p && p.trim() && p.trim() !== '--');
                const metaPart = parts[0] || '';
                metaStr = metaPart.slice(metaPart.indexOf('\r\n\r\n') + 4).trim();
                const contentPart = parts[1] || '';
                const headerEnd = contentPart.indexOf('\r\n\r\n');
                const headerBlock = contentPart.slice(0, headerEnd);
                const mimeMatch = headerBlock.match(/Content-Type:\s*([^\r\n]+)/);
                if (mimeMatch) mimeType = mimeMatch[1].trim();
                content = contentPart.slice(headerEnd + 4).replace(/\r\n--[^\r\n]*--\s*$/, '');
            }
            const meta = JSON.parse(metaStr || '{}');
            const id = newId();
            files.set(id, { id, name: meta.name, parentId: (meta.parents || [])[0] || 'root', isDir: false, content, mimeType });
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id }) });
            return;
        }
        const uploadMediaMatch = url.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
        if (uploadMediaMatch && method === 'PATCH') {
            const id = uploadMediaMatch[1];
            const f = files.get(id);
            if (!f) { await route.fulfill({ status: 404, body: '' }); return; }
            f.content = req.postData() || '';
            f.mimeType = req.headers()['content-type'] || f.mimeType;
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id }) });
            return;
        }
        const fileIdMatch = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
        if (fileIdMatch) {
            const id = fileIdMatch[1];
            const f = files.get(id);
            if (method === 'GET') {
                if (url.searchParams.get('alt') === 'media' && failFileIds.has(id)) { await route.abort('failed'); return; }
                if (!f) { await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }); return; }
                if (url.searchParams.get('alt') === 'media') await route.fulfill({ status: 200, body: f.content || '' });
                else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: f.id, name: f.name, parents: f.parentId ? [f.parentId] : [] }) });
                return;
            }
            if (method === 'PATCH') {
                if (!f) { await route.fulfill({ status: 404, body: '' }); return; }
                const addParents = url.searchParams.get('addParents');
                if (addParents) f.parentId = addParents;
                const body = req.postData();
                if (body) { try { const j = JSON.parse(body); if (j.name) f.name = j.name; } catch (_) {} }
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: f.id }) });
                return;
            }
            if (method === 'DELETE') {
                files.delete(id);
                for (const [cid, cf] of Array.from(files)) if (cf.parentId === id) files.delete(cid);
                await route.fulfill({ status: 204, body: '' });
                return;
            }
        }
        await route.fulfill({ status: 501, body: '' });
    }

    return {
        files,
        setOffline(v) { offline = v; },
        setForbidden(v) { forbidden = v; },
        setFailFolderIds(ids) { failFolderIds = new Set(ids || []); },
        setFailFileIds(ids) { failFileIds = new Set(ids || []); },
        async install(page) { await page.route('https://www.googleapis.com/**', handle); },
    };
}

async function abrirConfig(page, baseUrl) {
    await page.addInitScript((cid) => { window.__LZ_TEST_GDRIVE_CLIENT_ID = cid; }, TEST_CLIENT_ID);
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
}

// Simula uma pasta local já escolhida (com arquivos, como se o usuário já
// tivesse um acervo) — só leitura, pra testar a migração local → Drive.
// window.showDirectoryPicker não é automatizável de verdade via Playwright,
// então é substituído por uma árvore fake em memória. Storage.chooseDirectory()
// também persiste o handle no IndexedDB de verdade (idbSet) — por isso os
// métodos (entries/getFile/etc.) ficam no PROTÓTIPO compartilhado, não como
// propriedade própria de cada objeto: o algoritmo de clonagem estruturada do
// IndexedDB clona só as propriedades PRÓPRIAS enumeráveis, então ignora o
// protótipo (sem erro de clonagem) — e o handle original em memória continua
// com os métodos disponíveis normalmente, via a cadeia de protótipos.
async function mockLocalDir(page, entries) {
    await page.addInitScript((tree) => {
        const FileProto = {
            async getFile() { return new File([this._content], this.name, { type: this._mime || 'application/octet-stream' }); },
        };
        const DirProto = {
            async queryPermission() { return 'granted'; },
            async requestPermission() { return 'granted'; },
            async *entries() {
                for (const e of this._list) {
                    if (e.kind === 'file') yield [e.name, Object.assign(Object.create(FileProto), { name: e.name, kind: 'file', _content: e.content, _mime: e.mimeType })];
                    else yield [e.name, Object.assign(Object.create(DirProto), { name: e.name, kind: 'directory', _list: e.children || [] })];
                }
            },
            async *values() { for await (const [, h] of this.entries()) yield h; },
        };
        window.showDirectoryPicker = async () => Object.assign(Object.create(DirProto), { name: 'MinhaPastaLocal', kind: 'directory', _list: tree });
    }, entries);
}

async function conectar(page, pasta) {
    // Sem diretório configurado ainda, a seção mostra o assistente guiado
    // (Primeira configuração/Já tenho → Local/Remoto) em vez dos campos do
    // Drive direto — navega os passos antes de preencher/clicar.
    if (await page.locator('[data-wizard-modo="novo"]').count()) {
        await page.click('[data-wizard-modo="novo"]');
        await page.waitForTimeout(50);
        await page.click('[data-wizard-tipo="remoto"]');
        await page.waitForTimeout(50);
    }
    if (pasta) await page.fill('#gdrivePasta', pasta);
    await page.click('#btnGDriveConnect');
    // O clique dispara conectar + criar toda a estrutura de pastas + sincronizar
    // (várias idas e vindas ao servidor mockado) — espera o botão voltar a ficar
    // habilitado (sucesso: renderConfig() troca o botão; falha: reabilitado
    // explicitamente no catch) em vez de um tempo fixo, que seria flaky aqui.
    await page.waitForFunction(() => {
        const btn = document.querySelector('#btnGDriveConnect');
        return !btn || !btn.disabled;
    }, { timeout: 8000 });
    await page.waitForTimeout(100);
}

test('Conectar ao Google Drive com sucesso cria a pasta raiz e passa a usar o Drive', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    const raiz = Array.from(mock.files.values()).find((f) => f.name === 'lattesZen' && f.isDir);
    assert(raiz, 'A pasta raiz "lattesZen" deveria ter sido criada no Drive');
    const dirLbl = await page.$eval('#dirNameLbl', (el) => el.textContent);
    assert(dirLbl.includes('Google Drive'), 'O rótulo da pasta atual deveria indicar o Google Drive como back-end em uso');
    const modo = await page.evaluate(() => window.Storage.storageMode());
    assertEqual(modo, 'gdrive', 'storageMode() deveria retornar "gdrive" após conectar com sucesso');
});

test('Assistente: "Já tenho um diretório" > "Google Drive" > "Selecionar pasta existente e conectar" reconecta à pasta escolhida (sem digitar nome, sem criar pasta nova)', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    // Pasta que a usuária JÁ usava antes (nome diferente do padrão "lattesZen"
    // sugerido no campo do modo "Primeira configuração") — o ponto do teste é
    // que o Picker reconecta a ELA (mesmo id), não cria uma pasta nova.
    mock.files.set('pasta-antiga-id', { id: 'pasta-antiga-id', name: 'acc-curriculum', parentId: 'root', isDir: true, content: null });
    await mockPicker(page, { id: 'pasta-antiga-id', name: 'acc-curriculum' });
    await abrirConfig(page, baseUrl);

    await page.click('[data-wizard-modo="existente"]');
    await page.waitForTimeout(50);
    await page.click('[data-wizard-tipo="remoto"]');
    await page.waitForTimeout(50);
    assertEqual(await page.locator('#gdrivePasta').count(), 0, 'Em "Já tenho um diretório", não deveria pedir pra digitar o nome da pasta');
    assertEqual((await page.locator('#btnGDriveConnect').textContent()).trim(), 'Selecionar pasta existente e conectar', 'O botão deveria deixar claro que abre um seletor, não que cria uma pasta nova');

    await page.click('#btnGDriveConnect');
    await page.waitForFunction(() => {
        const btn = document.querySelector('#btnGDriveConnect');
        return !btn || !btn.disabled;
    }, { timeout: 8000 });
    await page.waitForTimeout(100);

    const dirLbl = await page.$eval('#dirNameLbl', (el) => el.textContent);
    assert(dirLbl.includes('acc-curriculum'), 'O nome exibido deveria ser o da pasta escolhida no seletor, sem precisar digitar nada');
    const pastasComEsseNome = Array.from(mock.files.values()).filter((f) => f.name === 'acc-curriculum' && f.isDir);
    assertEqual(pastasComEsseNome.length, 1, 'Não deveria ter criado uma pasta nova — deveria reconectar à mesma pasta (mesmo id) escolhida no seletor');
    const subpastas = Array.from(mock.files.values()).filter((f) => f.parentId === 'pasta-antiga-id' && f.isDir);
    assert(subpastas.length > 0, 'A estrutura de subpastas (categorias do Lattes) deveria ter sido criada DENTRO da pasta escolhida, não de uma pasta nova');
});

test('Autorização recusada/cancelada não conecta e mostra mensagem no formulário', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await page.addInitScript(() => { window.__gisMockError = 'access_denied'; });
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    const status = await page.$eval('#gdriveStatus', (el) => el.textContent);
    assert(/recusad|cancelad/i.test(status), 'A mensagem deveria indicar que a autorização foi recusada/cancelada');
    const modo = await page.evaluate(() => window.Storage.storageMode());
    assertEqual(modo, 'local', 'Uma autorização recusada não deveria mudar o modo de armazenamento para gdrive');
});

test('checkHealth() reporta reason "network" quando a API do Drive fica inacessível', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    mock.setOffline(true);
    const health = await page.evaluate(() => window.Storage.checkHealth());
    assertEqual(health.ok, false, 'checkHealth deveria reportar falha quando a API está inacessível');
    assertEqual(health.reason, 'network', 'A falha de rede deveria ser reportada como reason "network"');
});

test('checkHealth() reporta reason "permission" quando o token é recusado (401 persistente)', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    mock.setForbidden(true); // Drive API sempre 401 (simula token/consentimento revogado)
    const health = await page.evaluate(() => window.Storage.checkHealth());
    assertEqual(health.ok, false, 'checkHealth deveria reportar falha quando as credenciais são recusadas (401)');
    assertEqual(health.reason, 'permission', 'HTTP 401/403 persistente deveria ser reportado como reason "permission"');
});

test('writeJson + scanDirectory fazem round-trip via Google Drive', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    await page.evaluate(async () => {
        await window.Storage.writeJson('it-gdrive1', { id: 'it-gdrive1', titulo: 'Item gravado via Google Drive' }, 'Produções');
    });
    const arquivo = Array.from(mock.files.values()).find((f) => f.name === 'it-gdrive1.json');
    assert(arquivo, 'O JSON deveria ter sido criado no Drive dentro da pasta "Produções"');

    const { items, falhas } = await page.evaluate(() => window.Storage.scanDirectory());
    assertEqual(items.length, 1, 'scanDirectory deveria reconstruir exatamente o item gravado');
    assertEqual(falhas, 0, 'Sem nenhuma falha de rede simulada, "falhas" deveria vir zerado');
    assertEqual(items[0].id, 'it-gdrive1', 'O item reconstruído deveria ter o mesmo id gravado');
    assertEqual(items[0].titulo, 'Item gravado via Google Drive', 'O item reconstruído deveria ter os mesmos campos gravados');
});

// Regressão: scanDirectory() passou a varrer pastas/arquivos em PARALELO
// (limitador de concorrência, ver Storage.criarLimitador) em vez de um de
// cada vez — pedido do Alexsandro pra acelerar a sincronização de uma
// biblioteca grande do Drive pelo celular. Vários itens espalhados por
// VÁRIAS pastas de categoria de propósito, pra exercitar de verdade a
// recursão concorrente (não só 1 arquivo em 1 pasta).
test('scanDirectory() reconstrói todos os itens de várias pastas de categoria, mesmo varrendo em paralelo', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    const pastas = ['Produções', 'Formação', 'Atuação', 'Projetos'];
    await page.evaluate(async (pastas) => {
        for (const pasta of pastas) {
            for (let i = 0; i < 3; i++) {
                const id = `it-${pasta}-${i}`;
                await window.Storage.writeJson(id, { id, titulo: `Item ${i} de ${pasta}` }, pasta);
            }
        }
    }, pastas);

    const { items, falhas } = await page.evaluate(() => window.Storage.scanDirectory());
    assertEqual(items.length, pastas.length * 3, `scanDirectory deveria reconstruir todos os ${pastas.length * 3} itens, espalhados pelas ${pastas.length} pastas`);
    assertEqual(falhas, 0, 'Sem nenhuma falha de rede simulada, "falhas" deveria vir zerado');
    const ids = items.map((it) => it.id).sort();
    const idsEsperados = pastas.flatMap((pasta) => [0, 1, 2].map((i) => `it-${pasta}-${i}`)).sort();
    assertEqual(ids, idsEsperados, 'Todos os ids gravados deveriam vir de volta, um por um, sem perder nem duplicar nenhum');
});

/* ==========================================================================
   Regressão: scanDirectory() ignora arquivos "ocultos" que o sistema
   operacional cria sozinho numa pasta (nunca escritos pelo próprio app) —
   relatado pelo Alexsandro: sincronizar pelo celular mostrava "N pasta(s)
   não sincronizadas" por causa de arquivos "._nomedoarquivo" (o
   "AppleDouble" que o macOS cria ao copiar/sincronizar arquivos fora de um
   disco formatado como APFS/HFS+ — guarda metadados de recurso, não é JSON
   de verdade, e mantém a extensão original, então batia com o filtro de
   ".json"). Como o sistema operacional os recria sozinho, a falha nunca se
   resolvia sozinha — precisou apagar os arquivos manualmente.
   ========================================================================== */
test('scanDirectory() (Google Drive) ignora arquivos ocultos (ex.: "._nome.json") em vez de tentar lê-los como item', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    await page.evaluate(async () => {
        await window.Storage.writeJson('it-normal', { id: 'it-normal', titulo: 'Item normal' }, 'Atuação');
    });
    const pastaAtuacao = Array.from(mock.files.values()).find((f) => f.name === 'Atuação' && f.isDir);
    assert(pastaAtuacao, 'A pasta "Atuação" deveria ter sido criada no mock');
    // Simula o arquivo "sombra" que o macOS cria sozinho — mesmo nome do
    // item real + ".json", mas sem JSON válido nenhum dentro (na vida
    // real, é dado binário de recurso).
    mock.files.set('fake-shadow', { id: 'fake-shadow', name: '._it-normal.json', parentId: pastaAtuacao.id, isDir: false, content: 'não é json de verdade' });

    const { items, falhas, detalhes } = await page.evaluate(() => window.Storage.scanDirectory());
    assertEqual(items.length, 1, 'Só o item de verdade deveria ter sido lido, ignorando o arquivo "._" oculto');
    assertEqual(items[0].id, 'it-normal', 'O item lido deveria ser o real, não o arquivo sombra');
    assertEqual(falhas, 0, 'O arquivo oculto não deveria contar como falha — ele é ignorado, nem chega a ser lido');
    assertEqual(detalhes.length, 0, 'Sem nenhuma falha, detalhes deveria vir vazio');
});

test('scanDirectory() (pasta local) também ignora arquivos ocultos (ex.: "._nome.json")', async ({ page, baseUrl }) => {
    await mockLocalDir(page, [
        { name: 'it-normal.json', kind: 'file', content: '{"id":"it-normal","titulo":"Item normal"}' },
        { name: '._it-normal.json', kind: 'file', content: 'não é json de verdade' },
        { name: '.DS_Store', kind: 'file', content: 'lixo binário do macOS' },
    ]);
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);
    await page.evaluate(() => window.Storage.chooseDirectory());

    const { items, falhas, detalhes } = await page.evaluate(() => window.Storage.scanDirectory());
    assertEqual(items.length, 1, 'Só o item de verdade deveria ter sido lido, ignorando os arquivos ocultos');
    assertEqual(items[0].id, 'it-normal', 'O item lido deveria ser o real');
    assertEqual(falhas, 0, 'Os arquivos ocultos não deveriam contar como falha');
    assertEqual(detalhes.length, 0, 'Sem nenhuma falha, detalhes deveria vir vazio');
});

/* ==========================================================================
   Regressão: mensagens de falha mais claras + "tentar de novo só o que
   falhou" (issue relatada pelo Alexsandro: depois de uma sincronização
   incompleta pelo celular, o aviso genérico "2 pasta(s) não puderam ser
   lidas" não dizia QUAIS pastas nem quantos itens ficaram de fora, e não
   havia como forçar uma nova tentativa só daquilo que faltou).
   ========================================================================== */
test('scanDirectory(): um arquivo que falha vira um "detalhes" com tipo/caminho/pasta certos, e retentarFalhasSincronizacao() recupera ele sozinho', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    await page.evaluate(async () => {
        await window.Storage.writeJson('it-ok', { id: 'it-ok', titulo: 'Este vai dar certo' }, 'Atuação');
        await window.Storage.writeJson('it-falha', { id: 'it-falha', titulo: 'Este vai falhar' }, 'Atuação');
    });
    const arquivoFalha = Array.from(mock.files.values()).find((f) => f.name === 'it-falha.json');
    assert(arquivoFalha, 'O JSON "it-falha" deveria ter sido criado no mock');
    mock.setFailFileIds([arquivoFalha.id]);

    const primeiraVarredura = await page.evaluate(() => window.Storage.scanDirectory());
    assertEqual(primeiraVarredura.items.length, 1, 'Só o item sem falha deveria ter sido lido na 1ª varredura');
    assertEqual(primeiraVarredura.items[0].id, 'it-ok', 'O item recuperado deveria ser o que não falhou');
    assertEqual(primeiraVarredura.falhas, 1, 'Deveria contar exatamente 1 falha');
    assertEqual(primeiraVarredura.detalhes.length, 1, 'detalhes deveria ter exatamente 1 entrada');
    assertEqual(primeiraVarredura.detalhes[0].tipo, 'arquivo', 'A falha é de um ARQUIVO específico, não da pasta inteira');
    assertEqual(primeiraVarredura.detalhes[0].caminho, 'Atuação/it-falha.json', 'O caminho deveria identificar a pasta E o arquivo que falhou');
    assertEqual(primeiraVarredura.detalhes[0].pastaCaminho, 'Atuação', 'pastaCaminho deveria ser só a pasta (pra agrupar várias falhas da mesma pasta)');

    // "Rede se recupera" — limpa a falha simulada e tenta de novo SÓ o que
    // o detalhes aponta, sem revarrer a pasta inteira.
    mock.setFailFileIds([]);
    const retentativa = await page.evaluate((detalhes) => window.Storage.retentarFalhasSincronizacao(detalhes), primeiraVarredura.detalhes);
    assertEqual(retentativa.items.length, 1, 'A retentativa deveria recuperar exatamente o item que tinha falhado');
    assertEqual(retentativa.items[0].id, 'it-falha', 'O item recuperado na retentativa deveria ser o "it-falha"');
    assertEqual(retentativa.falhas, 0, 'Sem falha simulada mais, a retentativa não deveria falhar');
    assertEqual(retentativa.detalhes.length, 0, 'Sem mais nada faltando, detalhes deveria voltar vazio');
});

test('scanDirectory(): uma pasta inteira que falha ao LISTAR vira um "detalhes" tipo "pasta", e retentarFalhasSincronizacao() recupera tudo que tinha dentro', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    await page.evaluate(async () => {
        await window.Storage.writeJson('it-formacao-1', { id: 'it-formacao-1', titulo: 'Formação 1' }, 'Formação');
        await window.Storage.writeJson('it-atuacao-1', { id: 'it-atuacao-1', titulo: 'Atuação 1' }, 'Atuação');
        await window.Storage.writeJson('it-atuacao-2', { id: 'it-atuacao-2', titulo: 'Atuação 2' }, 'Atuação');
    });
    const pastaAtuacao = Array.from(mock.files.values()).find((f) => f.name === 'Atuação' && f.isDir);
    assert(pastaAtuacao, 'A pasta "Atuação" deveria ter sido criada no mock');
    mock.setFailFolderIds([pastaAtuacao.id]);

    const primeiraVarredura = await page.evaluate(() => window.Storage.scanDirectory());
    assertEqual(primeiraVarredura.items.length, 1, 'Só o item de "Formação" deveria ter sido lido (a listagem de "Atuação" falhou inteira)');
    assertEqual(primeiraVarredura.items[0].id, 'it-formacao-1', 'O item recuperado deveria ser o de "Formação"');
    assert(primeiraVarredura.falhas >= 1, 'Deveria contar ao menos 1 falha (a pasta "Atuação")');
    const falhaPasta = primeiraVarredura.detalhes.find((d) => d.tipo === 'pasta');
    assert(falhaPasta, 'detalhes deveria ter uma entrada do tipo "pasta"');
    assertEqual(falhaPasta.caminho, 'Atuação', 'A falha de pasta deveria identificar "Atuação" pelo caminho');

    mock.setFailFolderIds([]);
    const retentativa = await page.evaluate((detalhes) => window.Storage.retentarFalhasSincronizacao(detalhes), primeiraVarredura.detalhes);
    assertEqual(retentativa.items.length, 2, 'A retentativa deveria recuperar os 2 itens que estavam dentro de "Atuação"');
    assertEqual(retentativa.items.map((i) => i.id).sort(), ['it-atuacao-1', 'it-atuacao-2'], 'Deveria recuperar exatamente os 2 itens de "Atuação", sem repetir o de "Formação"');
    assertEqual(retentativa.falhas, 0, 'Sem falha simulada mais, a retentativa não deveria falhar');
});

test('UI: depois de "Sincronizar do diretório" com falhas, aparece o resumo com o caminho certo e um botão "tentar de novo" que recupera o restante', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    await page.evaluate(async () => {
        await window.Storage.writeJson('it-falha-ui', { id: 'it-falha-ui', titulo: 'Vai falhar na 1ª tentativa' }, 'Atuação');
    });
    const arquivoFalha = Array.from(mock.files.values()).find((f) => f.name === 'it-falha-ui.json');
    mock.setFailFileIds([arquivoFalha.id]);

    await page.click('#btnSync');
    await page.waitForFunction(() => {
        const el = document.querySelector('#syncStatus');
        return el && /Atuação/.test(el.textContent);
    }, { timeout: 10000 });

    const textoAviso = await page.$eval('#syncStatus', (el) => el.textContent);
    assert(/1 arquivo\(s\) não puderam ser lidos/.test(textoAviso), `O aviso deveria mencionar 1 arquivo não lido — obtido: "${textoAviso}"`);
    assert(/Atuação/.test(textoAviso), `O aviso deveria mencionar a pasta "Atuação" — obtido: "${textoAviso}"`);
    assertEqual(await page.locator('#btnRetentarFalhasSync').count(), 1, 'O botão "tentar sincronizar de novo" deveria aparecer');

    // Rede "se recupera" antes de clicar em tentar de novo.
    mock.setFailFileIds([]);
    await page.click('#btnRetentarFalhasSync');
    await page.waitForFunction(() => {
        const el = document.querySelector('#syncStatus');
        return el && el.textContent.trim() === '';
    }, { timeout: 10000 });

    const catalogo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').map((i) => i.id));
    assert(catalogo.includes('it-falha-ui'), 'O item que tinha falhado deveria estar no catálogo depois de "tentar de novo"');
});

// Regressão: o botão "Abrir no Google Drive" (Catalogar/Configurações) usava
// gdriveFolderUrl(subdir), que retornava null sempre que a subpasta exata
// ainda não existia (nenhum arquivo enviado ali) OU quando qualquer erro de
// rede/autenticação acontecia — os dois casos viravam o mesmo aviso enganoso
// "pasta ainda não existe". Agora: sem subpasta exata, cai pra pasta
// ancestral mais próxima (sempre abre em algum lugar do Drive); erros reais
// sobem como exceção pro chamador, sem virar esse aviso.
test('gdriveFolderUrl: cai pra pasta ancestral mais próxima antes do primeiro envio, e passa a apontar pra subpasta exata depois', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    const antes = await page.evaluate(() => window.Storage.gdriveFolderUrl('Produções'));
    assert(antes && antes.url, 'Deveria retornar uma URL mesmo sem a subpasta "Produções" existir ainda');
    assertEqual(antes.exact, false, 'Sem nenhum envio em "Produções", exact deveria ser false (a URL aponta pra pasta raiz)');
    assert(/\/drive\/folders\//.test(antes.url), 'A URL deveria apontar pra uma pasta do Drive');
    assert(/authuser=usuaria%40example\.com/.test(antes.url), 'A URL deveria indicar a conta conectada via authuser');

    await page.evaluate(async () => { await window.Storage.writeJson('it-drive-url', { id: 'it-drive-url' }, 'Produções'); });
    const depois = await page.evaluate(() => window.Storage.gdriveFolderUrl('Produções'));
    assertEqual(depois.exact, true, 'Depois do 1º envio em "Produções", exact deveria ser true (a subpasta já existe)');
    assert(depois.url !== antes.url, 'A URL deveria mudar — agora aponta pra subpasta "Produções", não mais pra raiz');
});

test('gdriveFolderUrl: erro de autenticação sobe como exceção, não vira "pasta não existe"', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    mock.setForbidden(true);
    const erro = await page.evaluate(async () => {
        try { await window.Storage.gdriveFolderUrl('Produções'); return null; }
        catch (e) { return e.message || 'erro sem mensagem'; }
    });
    assert(erro, 'Um token recusado (401) deveria lançar uma exceção, não retornar silenciosamente null/undefined');
});

// Regressão: botão "Selecionar arquivo do Google Drive" (Catalogar →
// Evidências), que substituiu o antigo "abrir a pasta" — agora abre o
// Google Picker e anexa o arquivo escolhido. A UI real do Picker (iframe
// hospedado pelo Google) não é testável aqui, então window.GDriveClient.pickFile
// é substituído por um stub que devolve {id,name,mimeType} direto — o que É
// testável (e é o que realmente importa) é o que Storage.pickDriveEvidenceFile
// faz com o arquivo escolhido: baixa o conteúdo e decide mover (arquivo
// estava diretamente na Caixa de Entrada — vira evidência "da bandeja",
// movida pra Processados ao salvar) ou copiar (qualquer outro caso — dentro
// de outra pasta do app, ou fora dele — o original nunca é tocado).
test('pickDriveEvidenceFile: arquivo de FORA da pasta do app fica marcado pra copiar (original intocado)', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    // Arquivo fora da árvore do lattesZen (direto na raiz do Drive do usuário).
    mock.files.set('ext1', { id: 'ext1', name: 'evidencia-externa.pdf', parentId: 'root', isDir: false, content: 'conteudo-externo', mimeType: 'application/pdf' });
    await page.evaluate(() => {
        window.GDriveClient.pickFile = async () => ({ id: 'ext1', name: 'evidencia-externa.pdf', mimeType: 'application/pdf' });
    });

    const picked = await page.evaluate(async () => {
        const p = await window.Storage.pickDriveEvidenceFile();
        return { driveSourceInbox: p.driveSourceInbox, fileName: p.file.name, fileSize: p.file.size };
    });
    assertEqual(picked.driveSourceInbox, false, 'Arquivo fora da pasta do lattesZen: driveSourceInbox deveria ser false (copiar, não mover)');
    assertEqual(picked.fileName, 'evidencia-externa.pdf', 'O File reconstruído deveria manter o nome original do Drive');
    assert(picked.fileSize > 0, 'O File reconstruído deveria ter o conteúdo baixado (tamanho > 0)');
    assert(mock.files.has('ext1'), 'O arquivo original NÃO deveria ter sido tocado só por selecioná-lo/baixá-lo');
});

test('pickDriveEvidenceFile: arquivo DENTRO da pasta do app mas FORA da Caixa de Entrada também fica marcado pra copiar (original intocado)', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    const rootFolderId = await page.evaluate(() => window.Storage.loadSettings().gdrive.rootFolderId);
    // Subpasta dentro da árvore do lattesZen (ex.: já filed em "Produções"),
    // mas não é a Caixa de Entrada — pela regra atual, isso NÃO deve apagar
    // o original (só a Caixa de Entrada é "mover"; qualquer outro lugar
    // dentro da árvore do app é só "copiar", como um arquivo de fora).
    mock.files.set('sub1', { id: 'sub1', name: 'Produções', parentId: rootFolderId, isDir: true, content: null });
    mock.files.set('int1', { id: 'int1', name: 'evidencia-interna.pdf', parentId: 'sub1', isDir: false, content: 'conteudo-interno', mimeType: 'application/pdf' });
    await page.evaluate(() => {
        window.GDriveClient.pickFile = async () => ({ id: 'int1', name: 'evidencia-interna.pdf', mimeType: 'application/pdf' });
    });

    const picked = await page.evaluate(async () => {
        const p = await window.Storage.pickDriveEvidenceFile();
        return { driveSourceInbox: p.driveSourceInbox };
    });
    assertEqual(picked.driveSourceInbox, false, 'Arquivo dentro da pasta do app mas fora da Caixa de Entrada: driveSourceInbox deveria ser false (copiar, não mover)');
    assert(mock.files.has('int1'), 'O arquivo original (já filed noutra pasta do app) NÃO deveria ser apagado');
});

test('pickDriveEvidenceFile: arquivo DENTRO da Caixa de Entrada fica marcado como "da bandeja" (move pra Processados ao salvar)', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen'); // já cria "Caixa de Entrada" na raiz

    const rootFolderId = await page.evaluate(() => window.Storage.loadSettings().gdrive.rootFolderId);
    let inboxId = null;
    for (const f of mock.files.values()) { if (f.isDir && f.name === 'Caixa de Entrada' && f.parentId === rootFolderId) inboxId = f.id; }
    assert(inboxId, 'Setup do teste: a Caixa de Entrada deveria já existir depois de conectar');
    mock.files.set('in1', { id: 'in1', name: 'pendente.pdf', parentId: inboxId, isDir: false, content: 'conteudo-pendente', mimeType: 'application/pdf' });
    await page.evaluate(() => {
        window.GDriveClient.pickFile = async () => ({ id: 'in1', name: 'pendente.pdf', mimeType: 'application/pdf' });
    });

    const picked = await page.evaluate(async () => {
        const p = await window.Storage.pickDriveEvidenceFile();
        return { driveSourceInbox: p.driveSourceInbox, fileName: p.file.name };
    });
    assertEqual(picked.driveSourceInbox, true, 'Arquivo diretamente na Caixa de Entrada: driveSourceInbox deveria ser true (mover, não só copiar)');

    // Completa o efeito de "mover" — o mesmo mecanismo usado pela bandeja
    // clássica (useInboxFile/fromInbox), acionado em onSubmitForm() por
    // causa do inboxName marcado em addDriveEvidence().
    await page.evaluate((name) => window.Storage.moveInboxToProcessed(name), picked.fileName);
    let procId = null;
    for (const f of mock.files.values()) { if (f.isDir && f.name === 'Processados' && f.parentId === inboxId) procId = f.id; }
    assert(procId, 'A subpasta "Processados" deveria existir dentro da Caixa de Entrada');
    const emProcessados = Array.from(mock.files.values()).some((f) => f.id === 'in1' && f.parentId === procId);
    assert(emProcessados, 'O arquivo original deveria ter sido movido da Caixa de Entrada pra Processados');
});

test('pickDriveEvidenceFile: cancelar o seletor retorna null, sem baixar nada', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    await page.evaluate(() => { window.GDriveClient.pickFile = async () => null; });
    const resultado = await page.evaluate(() => window.Storage.pickDriveEvidenceFile());
    assertEqual(resultado, null, 'Cancelar o Picker deveria retornar null, sem lançar erro nem tentar baixar nada');
});

test('deleteItemFiles remove os arquivos do item no Google Drive', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    await page.evaluate(async () => {
        await window.Storage.writeJson('it-del1', { id: 'it-del1' }, 'Produções');
        await window.Storage.writeAttachment('it-del1', 'conteudo-fake', 'Produções', 'pdf');
    });
    assert(Array.from(mock.files.values()).some((f) => f.name === 'it-del1.json'), 'Pré-condição: JSON deveria existir antes de excluir');
    assert(Array.from(mock.files.values()).some((f) => f.name === 'it-del1.pdf'), 'Pré-condição: PDF deveria existir antes de excluir');

    await page.evaluate(() => window.Storage.deleteItemFiles('it-del1', 'Produções'));
    assert(!Array.from(mock.files.values()).some((f) => f.name === 'it-del1.json'), 'O JSON do item deveria ter sido removido do Drive');
    assert(!Array.from(mock.files.values()).some((f) => f.name === 'it-del1.pdf'), 'O PDF do item deveria ter sido removido do Drive');
});

test('moveInboxToProcessed usa MOVE (addParents/removeParents) e resolve colisão de nome', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await abrirConfig(page, baseUrl);
    await conectar(page, 'lattesZen');

    const inboxId = await page.evaluate(async () => {
        await window.Storage.ensureInbox();
        return null;
    });
    const inbox = Array.from(mock.files.values()).find((f) => f.name === 'Caixa de Entrada' && f.isDir);
    const processados = Array.from(mock.files.values()).find((f) => f.name === 'Processados' && f.isDir);
    assert(inbox && processados, 'Pré-condição: Caixa de Entrada e Processados deveriam existir após ensureInbox()');

    const origId = 'orig1';
    mock.files.set(origId, { id: origId, name: 'documento.pdf', parentId: inbox.id, isDir: false, content: 'conteudo-a', mimeType: 'application/pdf' });
    mock.files.set('colisao1', { id: 'colisao1', name: 'documento.pdf', parentId: processados.id, isDir: false, content: 'ja-existente', mimeType: 'application/pdf' }); // força colisão

    const alvo = await page.evaluate(() => window.Storage.moveInboxToProcessed('documento.pdf'));
    assertEqual(alvo, 'documento-2.pdf', 'Deveria sufixar o nome ao colidir com um arquivo já processado');
    const movido = mock.files.get(origId);
    assertEqual(movido.parentId, processados.id, 'O arquivo deveria ter sido movido para dentro de Processados (addParents/removeParents)');
    assertEqual(movido.name, 'documento-2.pdf', 'O arquivo movido deveria ter sido renomeado com o sufixo');
    assertEqual(movido.content, 'conteudo-a', 'O conteúdo movido deveria ser o do arquivo original, não o que já existia em Processados');
});

test('Assistente: "Já tenho um diretório" > "Google Drive" > "Migrar meus arquivos e conectar" copia os arquivos, mantém a estrutura e ativa o Drive', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await mockPicker(page, { name: 'lattesZen' });
    await mockLocalDir(page, [
        { name: 'it-1.json', kind: 'file', content: '{"id":"it-1"}' },
        { name: 'Produções', kind: 'directory', children: [
            { name: 'it-2.json', kind: 'file', content: '{"id":"it-2"}' },
            { name: 'it-2.pdf', kind: 'file', content: 'PDF-CONTEUDO-FAKE', mimeType: 'application/pdf' },
        ] },
    ]);
    await abrirConfig(page, baseUrl);

    // Sem diretório configurado ainda: navega o assistente até "Já tenho um
    // diretório" > "Google Drive" — "Migrar meus arquivos e conectar" pede
    // pra escolher a pasta local (mock) antes de conectar e copiar tudo.
    await page.click('[data-wizard-modo="existente"]');
    await page.waitForTimeout(50);
    await page.click('[data-wizard-tipo="remoto"]');
    await page.waitForTimeout(50);
    assertEqual(await page.locator('#btnGDriveMigrate').count(), 1, 'O botão "Migrar meus arquivos e conectar" deveria aparecer');
    assertEqual(await page.locator('#gdrivePasta').count(), 0, 'Em "Já tenho um diretório", não deveria pedir pra digitar o nome da pasta — o seletor do Drive fornece o nome');

    await page.click('#btnGDriveMigrate'); // o confirm() é aceito automaticamente pelo harness (page.on('dialog')); a pasta vem do Picker mockado
    await page.waitForFunction(() => !document.querySelector('[data-wizard-modo]'), { timeout: 8000 }); // assistente some quando o diretório fica configurado
    await page.waitForTimeout(100);

    const modo = await page.evaluate(() => window.Storage.storageMode());
    assertEqual(modo, 'gdrive', 'Depois de migrar, o armazenamento em uso deveria passar a ser o Google Drive');

    const nomes = Array.from(mock.files.values()).map((f) => f.name);
    assert(nomes.includes('it-1.json'), 'O arquivo da raiz da pasta local deveria ter sido copiado para o Drive');
    assert(nomes.includes('it-2.json') && nomes.includes('it-2.pdf'), 'Os arquivos da subpasta "Produções" deveriam ter sido copiados para o Drive');

    const pastaProducoes = Array.from(mock.files.values()).find((f) => f.name === 'Produções' && f.isDir);
    assert(pastaProducoes, 'A subpasta "Produções" deveria ter sido criada no Drive, preservando a estrutura da pasta local');
    const it2json = Array.from(mock.files.values()).find((f) => f.name === 'it-2.json');
    assertEqual(it2json.parentId, pastaProducoes.id, 'it-2.json deveria estar dentro da subpasta "Produções" no Drive');
    const it2pdf = Array.from(mock.files.values()).find((f) => f.name === 'it-2.pdf');
    assertEqual(it2pdf.content.trim(), 'PDF-CONTEUDO-FAKE', 'O conteúdo do PDF copiado deveria ser preservado');

    const aviso = await page.locator('#gdriveMigrationNotice').textContent();
    assert(/todas as atualizações.*ocorrem no google drive/i.test(aviso), 'Deveria mostrar um aviso persistente explicando que as atualizações agora ocorrem no Drive');
    assert(/pasta local pode ser exclu[ií]da/i.test(aviso), 'O aviso deveria mencionar que a pasta local pode ser excluída com segurança');

    assertEqual(await page.locator('#btnGDriveConnect').count(), 0, 'Com o diretório já configurado, a seção "Armazenamento remoto" não deveria mais aparecer no painel de estado');
});

/* ==========================================================================
   Regressão: migração local→Drive interrompida no meio da cópia (issue
   #140, item 3) — antes desta correção, connectGoogleDrive() já trocava
   `mode` pra 'gdrive' e persistia isso ANTES da cópia dos arquivos rodar;
   uma falha no meio (rede caiu, aba fechada) deixava o app preso apontando
   pra uma pasta do Drive só parcialmente copiada, sem nenhum jeito de
   perceber ou retomar. Os testes abaixo derrubam só a etapa de UPLOAD (a
   cópia em si) — conectar e criar a estrutura de pastas continuam
   funcionando — pra isolar exatamente esse cenário.
   ========================================================================== */

test('Migração que falha no meio da cópia não troca de back-end — volta pro local e oferece retomar/descartar', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await mockPicker(page, { name: 'lattesZen' });
    await mockLocalDir(page, [{ name: 'it-1.json', kind: 'file', content: '{"id":"it-1"}' }]);
    await page.route('https://www.googleapis.com/upload/drive/v3/files**', (route) => route.abort('failed'));

    await abrirConfig(page, baseUrl);
    await page.click('[data-wizard-modo="existente"]');
    await page.waitForTimeout(50);
    await page.click('[data-wizard-tipo="remoto"]');
    await page.waitForTimeout(50);
    await page.click('#btnGDriveMigrate');
    await page.waitForFunction(() => !!document.querySelector('#gdriveMigrationPendente'), { timeout: 8000 });
    await page.waitForTimeout(100);

    const modo = await page.evaluate(() => window.Storage.storageMode());
    assertEqual(modo, 'local', 'Uma cópia que falhou no meio NÃO deveria ter deixado o app preso no Google Drive');
    const dirLbl = await page.$eval('#dirNameLbl', (el) => el.textContent);
    assert(dirLbl.includes('MinhaPastaLocal'), 'A pasta local deveria continuar sendo a "pasta atual" depois da falha');
    assertEqual(await page.locator('#btnResumeGDriveMigration').count(), 1, 'Deveria oferecer "Retomar migração"');
    assertEqual(await page.locator('#btnDiscardGDriveMigration').count(), 1, 'Deveria oferecer "Descartar aviso"');

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /pasta local continua sendo usada normalmente/i.test(t)), 'Deveria avisar que a pasta local continua em uso após a falha');
});

test('Retomar uma migração pendente reconecta na mesma pasta (sem seletor de novo) e completa a cópia', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await mockPicker(page, { name: 'lattesZen' });
    await mockLocalDir(page, [{ name: 'it-1.json', kind: 'file', content: '{"id":"it-1"}' }]);
    let bloquearUpload = true;
    await page.route('https://www.googleapis.com/upload/drive/v3/files**', (route) => bloquearUpload ? route.abort('failed') : route.fallback());

    await abrirConfig(page, baseUrl);
    await page.click('[data-wizard-modo="existente"]');
    await page.waitForTimeout(50);
    await page.click('[data-wizard-tipo="remoto"]');
    await page.waitForTimeout(50);
    await page.click('#btnGDriveMigrate');
    await page.waitForFunction(() => !!document.querySelector('#gdriveMigrationPendente'), { timeout: 8000 });

    bloquearUpload = false; // "a conexão voltou"
    await page.click('#btnResumeGDriveMigration');
    await page.waitForFunction(() => !document.querySelector('#gdriveMigrationPendente'), { timeout: 8000 });
    await page.waitForTimeout(100);

    const modo = await page.evaluate(() => window.Storage.storageMode());
    assertEqual(modo, 'gdrive', 'Depois de retomar com sucesso, o back-end em uso deveria passar a ser o Google Drive');
    const nomes = Array.from(mock.files.values()).map((f) => f.name);
    assert(nomes.includes('it-1.json'), 'O arquivo deveria ter sido copiado ao retomar a migração');
    const pendente = await page.evaluate(() => window.Storage.loadPendingGDriveMigration());
    assertEqual(pendente, null, 'A migração pendente deveria ter sido limpa após concluir com sucesso');
});

test('Descartar o aviso de migração pendente só remove o aviso — pasta local continua em uso', async ({ page, baseUrl }) => {
    const mock = createMockDrive();
    await mock.install(page);
    await mockGis(page);
    await mockPicker(page, { name: 'lattesZen' });
    await mockLocalDir(page, [{ name: 'it-1.json', kind: 'file', content: '{"id":"it-1"}' }]);
    await page.route('https://www.googleapis.com/upload/drive/v3/files**', (route) => route.abort('failed'));

    await abrirConfig(page, baseUrl);
    await page.click('[data-wizard-modo="existente"]');
    await page.waitForTimeout(50);
    await page.click('[data-wizard-tipo="remoto"]');
    await page.waitForTimeout(50);
    await page.click('#btnGDriveMigrate');
    await page.waitForFunction(() => !!document.querySelector('#gdriveMigrationPendente'), { timeout: 8000 });

    await page.click('#btnDiscardGDriveMigration'); // confirm() aceito automaticamente pelo harness
    await page.waitForFunction(() => !document.querySelector('#gdriveMigrationPendente'), { timeout: 8000 });

    const pendente = await page.evaluate(() => window.Storage.loadPendingGDriveMigration());
    assertEqual(pendente, null, 'A migração pendente deveria ter sido descartada');
    const modo = await page.evaluate(() => window.Storage.storageMode());
    assertEqual(modo, 'local', 'Descartar o aviso não deveria mudar o back-end em uso (continua local)');
});

test('Reabrir o app com uma migração pendente avisa por toast, apontando pra Configurações', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.gdriveMigrationPendente = { pasta: 'lattesZen', rootFolderId: 'abc123', email: null, iniciadaEm: new Date().toISOString() };
        localStorage.setItem('lz_settings', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForTimeout(600);
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /migra[çc][ãa]o para o google drive ficou incompleta/i.test(t)), 'Deveria avisar, ao reabrir, que há uma migração pendente');
});
