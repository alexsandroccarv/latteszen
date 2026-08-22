/* ==========================================================================
   lattesZen — mini test harness (Playwright puro, sem framework externo)
   --------------------------------------------------------------------------
   Suíte de regressão para bugs já encontrados (e corrigidos) manualmente ao
   longo do desenvolvimento — sem isso, nenhum deles tinha proteção contra
   reaparecer numa mudança futura (o CI só verificava sintaxe JS).

   Cada teste roda numa aba isolada (contexto novo do navegador — localStorage
   próprio, sem vazar estado entre testes) contra um servidor estático local
   servindo src/. Diálogos nativos (confirm()) são aceitos automaticamente,
   igual ao app espera em uso normal. Qualquer erro de JS não tratado durante
   o teste marca o teste como falho, mesmo que as asserções passem.

   Uso:  node tools/tests/run.mjs
   ========================================================================== */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = fileURLToPath(new URL('../../src/', import.meta.url));
const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png',
};

function startServer() {
    return new Promise((resolve, reject) => {
        const server = createServer(async (req, res) => {
            try {
                let p = decodeURIComponent(req.url.split('?')[0]);
                if (p === '/') p = '/index.html';
                const full = normalize(join(SRC_ROOT, p));
                if (!full.startsWith(SRC_ROOT)) throw new Error('fora da raiz');
                const data = await readFile(full);
                res.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream' });
                res.end(data);
            } catch (_) { res.writeHead(404); res.end('not found'); }
        });
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

const TESTS = [];
// Registra um teste. `fn` recebe { page, baseUrl } — o contexto do navegador
// (e seu localStorage) é isolado e descartado ao final de cada teste.
export function test(name, fn) { TESTS.push({ name, fn }); }

export function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert falhou'); }
export function assertEqual(actual, expected, msg) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${msg ? msg + ': ' : ''}esperado ${e}, obtido ${a}`);
}

// Semeia state.items (via lz_catalog) antes da primeira renderização —
// padrão usado em todos os specs. `items` já vem como array de itens prontos
// (ver makeItem em cada spec).
export async function seedCatalog(page, baseUrl, items) {
    await page.goto(baseUrl + '/index.html');
    await page.evaluate((its) => localStorage.setItem('lz_catalog', JSON.stringify(its)), items);
    await page.reload();
    await page.waitForTimeout(500);
}

export function makeItem(typeKey, categoryKey, fields, extra) {
    const now = new Date().toISOString();
    return Object.assign({
        id: 'it-' + Math.random().toString(36).slice(2), createdAt: now, updatedAt: now, source: 'local',
        lattesItem: false, typeKey, categoryKey, fields, evidencias: [], hasPdf: false, pdfName: null, fileExt: null, lattesRef: null,
    }, extra || {});
}

export async function runAll() {
    const server = await startServer();
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const execPath = process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
    const browser = await chromium.launch({ executablePath: execPath }).catch(async (e) => {
        console.error(`Falha ao abrir o Chromium em "${execPath}" (defina PW_CHROMIUM_PATH se necessário): ${e.message}`);
        throw e;
    });

    let passed = 0, failed = 0;
    const falhas = [];
    for (const { name, fn } of TESTS) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (e) => pageErrors.push(e.message));
        page.on('dialog', (d) => d.accept());
        try {
            await fn({ page, baseUrl });
            if (pageErrors.length) throw new Error('Erro(s) de JS na página: ' + pageErrors.join(' | '));
            console.log(`  ✅ ${name}`);
            passed++;
        } catch (e) {
            console.log(`  ❌ ${name}`);
            console.log(`     ${e.message}`);
            failed++;
            falhas.push(name);
        } finally {
            await context.close();
        }
    }
    await browser.close();
    await new Promise((r) => server.close(r));

    console.log('');
    console.log(`${passed}/${TESTS.length} teste(s) passaram.`);
    if (failed) console.log(`Falharam: ${falhas.join(', ')}`);
    process.exitCode = failed ? 1 : 0;
}
