/* ==========================================================================
   Regressão: armazenamento remoto via WebDAV, padronizado no Koofr (issue #13)
   --------------------------------------------------------------------------
   Não há como testar contra a conta Koofr real no CI (credenciais, CORS) —
   um servidor WebDAV mínimo (PROPFIND/MKCOL/PUT/GET/DELETE/MOVE) é simulado
   em memória via page.route, com um "modo offline" que aborta a requisição
   pra simular exatamente a falha de rede/CORS que preocupa nesta integração
   (ver `isNetworkError` em webdav-client.js).
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

const BASE = 'https://app.koofr.net/dav/Koofr';

function makePropfindXml(entries) {
    const items = entries.map((e) => `
        <D:response>
            <D:href>${e.href}</D:href>
            <D:propstat><D:prop>
                ${e.isDir ? '<D:resourcetype><D:collection/></D:resourcetype>' : `<D:resourcetype/><D:getcontentlength>${e.size || 0}</D:getcontentlength>`}
            </D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat>
        </D:response>`).join('');
    return `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:">${items}</D:multistatus>`;
}

// Servidor WebDAV mínimo, em memória: `dirs` (Set de caminhos) e `files`
// (Map caminho -> conteúdo) representam TODO o estado do servidor simulado.
function createMockWebDav() {
    const dirs = new Set(['']); // '' = raiz do baseUrl
    const files = new Map();
    let offline = false;
    let forbidden = false;

    function normalize(p) { return String(p || '').replace(/^\/+|\/+$/g, ''); }
    function pathFromUrl(url) { return normalize(decodeURIComponent(url.slice(BASE.length))); }
    function parentOf(path) { const i = path.lastIndexOf('/'); return i === -1 ? '' : path.slice(0, i); }
    function hdr(req, name) {
        const h = req.headers();
        const key = Object.keys(h).find((k) => k.toLowerCase() === name.toLowerCase());
        return key ? h[key] : undefined;
    }
    function moveSubtree(fromPath, toPath) {
        if (files.has(fromPath)) { files.set(toPath, files.get(fromPath)); files.delete(fromPath); return; }
        if (dirs.has(fromPath)) {
            dirs.add(toPath); dirs.delete(fromPath);
            const prefix = fromPath + '/';
            for (const d of Array.from(dirs)) if (d.indexOf(prefix) === 0) { dirs.add(toPath + '/' + d.slice(prefix.length)); dirs.delete(d); }
            for (const f of Array.from(files.keys())) if (f.indexOf(prefix) === 0) { files.set(toPath + '/' + f.slice(prefix.length), files.get(f)); files.delete(f); }
        }
    }

    async function handle(route) {
        if (offline) { await route.abort('failed'); return; }
        const req = route.request();
        const method = req.method();
        const path = pathFromUrl(req.url());
        if (forbidden) { await route.fulfill({ status: 401, body: '' }); return; }

        if (method === 'PROPFIND') {
            if (path !== '' && !dirs.has(path) && !files.has(path)) { await route.fulfill({ status: 404, body: '' }); return; }
            const depth = hdr(req, 'depth');
            const entries = [{ href: `/dav/Koofr/${path}`, isDir: dirs.has(path) }];
            if (depth === '1') {
                const prefix = path ? path + '/' : '';
                for (const d of dirs) { if (d !== path && d.indexOf(prefix) === 0 && d.slice(prefix.length).indexOf('/') === -1) entries.push({ href: `/dav/Koofr/${d}/`, isDir: true }); }
                for (const [f, content] of files) { if (f.indexOf(prefix) === 0 && f.slice(prefix.length).indexOf('/') === -1) entries.push({ href: `/dav/Koofr/${f}`, isDir: false, size: String(content).length }); }
            }
            await route.fulfill({ status: 207, contentType: 'application/xml', body: makePropfindXml(entries) });
            return;
        }
        if (method === 'MKCOL') {
            const parent = parentOf(path);
            if (parent !== '' && !dirs.has(parent)) { await route.fulfill({ status: 409, body: '' }); return; }
            if (dirs.has(path)) { await route.fulfill({ status: 405, body: '' }); return; }
            dirs.add(path);
            await route.fulfill({ status: 201, body: '' });
            return;
        }
        if (method === 'PUT') {
            files.set(path, req.postData() || '');
            await route.fulfill({ status: 201, body: '' });
            return;
        }
        if (method === 'GET') {
            if (!files.has(path)) { await route.fulfill({ status: 404, body: '' }); return; }
            await route.fulfill({ status: 200, body: files.get(path) });
            return;
        }
        if (method === 'DELETE') {
            files.delete(path); dirs.delete(path);
            const prefix = path + '/';
            for (const d of Array.from(dirs)) if (d.indexOf(prefix) === 0) dirs.delete(d);
            for (const f of Array.from(files.keys())) if (f.indexOf(prefix) === 0) files.delete(f);
            await route.fulfill({ status: 204, body: '' });
            return;
        }
        if (method === 'MOVE') {
            const dest = hdr(req, 'destination');
            const destPath = pathFromUrl(dest);
            if (!dirs.has(path) && !files.has(path)) { await route.fulfill({ status: 404, body: '' }); return; }
            moveSubtree(path, destPath);
            await route.fulfill({ status: 201, body: '' });
            return;
        }
        await route.fulfill({ status: 501, body: '' });
    }

    return {
        dirs, files,
        setOffline(v) { offline = v; },
        setForbidden(v) { forbidden = v; },
        async install(page) { await page.route(BASE + '**', handle); },
    };
}

async function abrirConfig(page, baseUrl) {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
}

async function preencherEConectar(page) {
    await page.fill('#webdavUser', 'usuaria@example.com');
    await page.fill('#webdavPass', 'senha-de-aplicativo');
    await page.fill('#webdavPasta', 'lattesZen');
    await page.click('#btnWebdavConnect');
    // O clique dispara conectar + criar toda a estrutura de pastas + sincronizar
    // (várias idas e vindas ao servidor mockado) — espera o botão voltar a ficar
    // habilitado (sucesso: renderConfig() troca o botão; falha: reabilitado
    // explicitamente no catch) em vez de um tempo fixo, que seria flaky aqui.
    await page.waitForFunction(() => {
        const btn = document.querySelector('#btnWebdavConnect');
        return !btn || !btn.disabled;
    }, { timeout: 5000 });
    await page.waitForTimeout(100);
}

test('Conectar ao Koofr com sucesso cria a pasta raiz e passa a usar o WebDAV', async ({ page, baseUrl }) => {
    const mock = createMockWebDav();
    await mock.install(page);
    await abrirConfig(page, baseUrl);
    await preencherEConectar(page);

    assert(mock.dirs.has('lattesZen'), 'A pasta raiz configurada deveria ter sido criada no servidor via MKCOL');
    const dirLbl = await page.$eval('#dirNameLbl', (el) => el.textContent);
    assert(dirLbl.includes('Koofr'), 'O rótulo da pasta atual deveria indicar o Koofr como back-end em uso');
    const mode = await page.evaluate(() => window.Storage.storageMode());
    assertEqual(mode, 'webdav', 'storageMode() deveria retornar "webdav" após conectar com sucesso');
});

test('Falha de conexão (rede/CORS simulada) não conecta e mostra mensagem no formulário', async ({ page, baseUrl }) => {
    const mock = createMockWebDav();
    mock.setOffline(true);
    await mock.install(page);
    await abrirConfig(page, baseUrl);
    await preencherEConectar(page);

    const status = await page.$eval('#webdavStatus', (el) => el.textContent);
    assert(/conex|CORS/i.test(status), 'A mensagem de erro deveria mencionar problema de conexão/CORS (não um erro genérico)');
    const mode = await page.evaluate(() => window.Storage.storageMode());
    assertEqual(mode, 'local', 'Uma falha ao conectar não deveria mudar o modo de armazenamento para webdav');
});

test('checkHealth() reporta reason "network" quando o servidor fica inacessível após conectado', async ({ page, baseUrl }) => {
    const mock = createMockWebDav();
    await mock.install(page);
    await abrirConfig(page, baseUrl);
    await preencherEConectar(page);

    mock.setOffline(true);
    const health = await page.evaluate(() => window.Storage.checkHealth());
    assertEqual(health.ok, false, 'checkHealth deveria reportar falha quando o servidor está inacessível');
    assertEqual(health.reason, 'network', 'A falha de rede/CORS deveria ser reportada como reason "network" (não "missing")');
});

test('checkHealth() reporta reason "permission" quando o servidor responde 401', async ({ page, baseUrl }) => {
    const mock = createMockWebDav();
    await mock.install(page);
    await abrirConfig(page, baseUrl);
    await preencherEConectar(page);

    mock.setForbidden(true);
    const health = await page.evaluate(() => window.Storage.checkHealth());
    assertEqual(health.ok, false, 'checkHealth deveria reportar falha quando as credenciais são recusadas (401)');
    assertEqual(health.reason, 'permission', 'HTTP 401/403 deveria ser reportado como reason "permission"');
});

test('writeJson + scanDirectory fazem round-trip via WebDAV', async ({ page, baseUrl }) => {
    const mock = createMockWebDav();
    await mock.install(page);
    await abrirConfig(page, baseUrl);
    await preencherEConectar(page);

    await page.evaluate(async () => {
        await window.Storage.writeJson('it-webdav1', { id: 'it-webdav1', titulo: 'Item gravado via WebDAV' }, 'Produções');
    });
    assert(mock.files.has('lattesZen/Produções/it-webdav1.json'), 'O JSON deveria ter sido gravado no caminho esperado do servidor simulado');

    const items = await page.evaluate(() => window.Storage.scanDirectory());
    assertEqual(items.length, 1, 'scanDirectory deveria reconstruir exatamente o item gravado');
    assertEqual(items[0].id, 'it-webdav1', 'O item reconstruído deveria ter o mesmo id gravado');
    assertEqual(items[0].titulo, 'Item gravado via WebDAV', 'O item reconstruído deveria ter os mesmos campos gravados');
});

test('deleteItemFiles remove os arquivos do item no servidor WebDAV', async ({ page, baseUrl }) => {
    const mock = createMockWebDav();
    await mock.install(page);
    await abrirConfig(page, baseUrl);
    await preencherEConectar(page);

    await page.evaluate(async () => {
        await window.Storage.writeJson('it-del1', { id: 'it-del1' }, 'Produções');
        await window.Storage.writeAttachment('it-del1', 'conteudo-fake', 'Produções', 'pdf');
    });
    assert(mock.files.has('lattesZen/Produções/it-del1.json'), 'Pré-condição: JSON deveria existir antes de excluir');
    assert(mock.files.has('lattesZen/Produções/it-del1.pdf'), 'Pré-condição: PDF deveria existir antes de excluir');

    await page.evaluate(() => window.Storage.deleteItemFiles('it-del1', 'Produções'));
    assert(!mock.files.has('lattesZen/Produções/it-del1.json'), 'O JSON do item deveria ter sido removido do servidor');
    assert(!mock.files.has('lattesZen/Produções/it-del1.pdf'), 'O PDF do item deveria ter sido removido do servidor');
});

test('moveInboxToProcessed usa MOVE nativo e resolve colisão de nome', async ({ page, baseUrl }) => {
    const mock = createMockWebDav();
    await mock.install(page);
    await abrirConfig(page, baseUrl);
    await preencherEConectar(page);

    mock.files.set('lattesZen/Caixa de Entrada/documento.pdf', 'conteudo-a');
    mock.files.set('lattesZen/Caixa de Entrada/Processados/documento.pdf', 'ja-existente'); // força colisão

    const alvo = await page.evaluate(() => window.Storage.moveInboxToProcessed('documento.pdf'));
    assertEqual(alvo, 'documento-2.pdf', 'Deveria sufixar o nome ao colidir com um arquivo já processado');
    assert(!mock.files.has('lattesZen/Caixa de Entrada/documento.pdf'), 'O original deveria ter saído da Caixa de Entrada (MOVE, não cópia)');
    assert(mock.files.has('lattesZen/Caixa de Entrada/Processados/documento-2.pdf'), 'O arquivo deveria estar em Processados com o nome sufixado');
    assertEqual(mock.files.get('lattesZen/Caixa de Entrada/Processados/documento-2.pdf'), 'conteudo-a', 'O conteúdo movido deveria ser o do arquivo original, não o que já existia');
});
