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

// Servidor Drive mínimo, em memória: `files` (Map id -> {id,name,parentId,isDir,content,mimeType}).
function createMockDrive() {
    let nextId = 1;
    const files = new Map();
    files.set('root', { id: 'root', name: '', parentId: null, isDir: true, content: null });
    let offline = false;
    let forbidden = false;

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
                if (!f) { await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }); return; }
                if (url.searchParams.get('alt') === 'media') await route.fulfill({ status: 200, body: f.content || '' });
                else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: f.id, name: f.name }) });
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

async function conectar(page, pasta) {
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

    const items = await page.evaluate(() => window.Storage.scanDirectory());
    assertEqual(items.length, 1, 'scanDirectory deveria reconstruir exatamente o item gravado');
    assertEqual(items[0].id, 'it-gdrive1', 'O item reconstruído deveria ter o mesmo id gravado');
    assertEqual(items[0].titulo, 'Item gravado via Google Drive', 'O item reconstruído deveria ter os mesmos campos gravados');
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
