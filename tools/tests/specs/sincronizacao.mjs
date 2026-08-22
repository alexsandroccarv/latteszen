/* ==========================================================================
   Regressão: sincronização do catálogo com o diretório
   --------------------------------------------------------------------------
   Storage.scanDirectory()/chooseDirectory() dependem da File System Access
   API real do navegador (seletor nativo de pasta) — não automatizável via
   Playwright/CDP. Os testes abaixo substituem essas funções por versões
   simuladas (o objeto window.Storage é só um objeto JS comum, com métodos
   sobrescrevíveis), o que exercita de verdade a lógica de mesclagem e os
   dois gatilhos de sincronização automática em app.js, sem depender do
   seletor nativo em si.
   ========================================================================== */
import { test, assert, assertEqual, makeItem } from '../harness.mjs';

function fakeDirItem(id, titulo) {
    const now = '2026-01-01T00:00:00.000Z';
    return {
        id, createdAt: now, updatedAt: now, source: 'local', lattesItem: false,
        typeKey: 'FORMACAO_COMPLEMENTAR', categoryKey: 'FORMACAO', fields: { titulo, instituicao: 'Z' },
        evidencias: [], hasPdf: false, pdfName: null, fileExt: null, lattesRef: null,
    };
}

test('Sincronização manual mescla por id (mantém locais, atualiza/soma da pasta)', async ({ page, baseUrl }) => {
    const local = makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Item A (local, desatualizado)', instituicao: 'X' }, { id: 'it-local-a' });
    await page.goto(baseUrl + '/index.html');
    await page.evaluate((it) => localStorage.setItem('lz_catalog', JSON.stringify([it])), local);
    await page.reload();
    await page.waitForTimeout(500);

    await page.evaluate((idA) => {
        window.Storage.scanDirectory = async () => ([
            Object.assign({}, JSON.parse(JSON.stringify({
                id: idA, createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', source: 'local', lattesItem: false,
                typeKey: 'FORMACAO_COMPLEMENTAR', categoryKey: 'FORMACAO', fields: { titulo: 'Item A (da pasta, atualizado)', instituicao: 'X' },
                evidencias: [], hasPdf: false, pdfName: null, fileExt: null, lattesRef: null,
            }))),
            { id: 'it-dir-b', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', source: 'local', lattesItem: false,
              typeKey: 'FORMACAO_COMPLEMENTAR', categoryKey: 'FORMACAO', fields: { titulo: 'Item B (só na pasta)', instituicao: 'Y' },
              evidencias: [], hasPdf: false, pdfName: null, fileExt: null, lattesRef: null },
        ]);
    }, local.id);

    await page.click('[data-tab="config"]');
    await page.waitForTimeout(300);
    await page.click('#btnSync');
    await page.waitForTimeout(400);

    const catalogo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').map((i) => ({ id: i.id, titulo: i.fields.titulo })));
    assertEqual(catalogo.length, 2, 'Deveria ter 2 itens após sincronizar');
    assertEqual(catalogo.find((i) => i.id === local.id).titulo, 'Item A (da pasta, atualizado)', 'Item A deveria ter o título atualizado vindo da pasta');
    assert(catalogo.some((i) => i.id === 'it-dir-b'), 'Item B (só na pasta) deveria ter sido incluído');
});

test('Catálogo vazio + diretório já configurado e saudável: sincroniza sozinho no início', async ({ page, baseUrl }) => {
    // Intercepta a 1ª atribuição a window.Storage (feita por storage.js) pra
    // "plugar" um diretório já configurado, saudável, e com itens — simula
    // abrir o app com localStorage limpo (perfil novo/outro computador) mas
    // um diretório que já tinha dados.
    await page.addInitScript(([itemX, itemY]) => {
        Object.defineProperty(window, 'Storage', {
            configurable: true,
            set(real) {
                real.hasDirectory = () => true;
                real.directoryName = async () => 'PastaFake';
                real.checkHealth = async () => ({ ok: true, hasDir: true });
                real.scanDirectory = async () => ([itemX, itemY]);
                Object.defineProperty(window, 'Storage', { value: real, writable: true, configurable: true });
            },
            get() { return undefined; },
        });
    }, [fakeDirItem('it-dir-x', 'Item X (só na pasta)'), fakeDirItem('it-dir-y', 'Item Y (só na pasta)')]);

    await page.goto(baseUrl + '/index.html'); // localStorage já limpo neste contexto novo
    await page.waitForTimeout(900);

    const titulos = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').map((i) => i.fields.titulo));
    assertEqual(titulos.sort(), ['Item X (só na pasta)', 'Item Y (só na pasta)'], 'Catálogo deveria ter sido preenchido automaticamente a partir da pasta');

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /sincronizados automaticamente/.test(t)), 'Deveria ter avisado que sincronizou automaticamente');
});

test('Sem diretório configurado, nada é sincronizado automaticamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(600);
    const catalogo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    assertEqual(catalogo, [], 'Catálogo deveria continuar vazio sem diretório configurado');
});
