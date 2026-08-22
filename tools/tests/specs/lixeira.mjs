/* ==========================================================================
   Regressão: Lixeira (exclusão vira soft-delete restaurável)
   --------------------------------------------------------------------------
   Excluir move o item para a lixeira (não apaga na hora); restaurar devolve
   ao catálogo; excluir definitivamente e "esvaziar lixeira" removem de vez;
   itens na lixeira há mais de TRASH_RETENTION_DIAS são purgados
   automaticamente no início do app.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function catalogIds(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').map((i) => i.id)); }
async function trashIds(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('lz_trash') || '[]').map((i) => i.id)); }
async function clickAct(page, titulo, act) {
    await page.evaluate(({ t, a }) => {
        const cards = Array.from(document.querySelectorAll('#itemList .bg-white.dark\\:bg-gray-800.border'));
        const card = cards.find((c) => c.textContent.includes(t));
        card.querySelector(`[data-act="${a}"]`).click();
    }, { t: titulo, a: act });
    await page.waitForTimeout(300);
}

test('Excluir move para a lixeira; restaurar devolve ao catálogo', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Lixeira 1', instituicao: 'X', anoFim: '2024' }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Lixeira 2', instituicao: 'Y', anoFim: '2023' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);

    await clickAct(page, 'Curso Lixeira 1', 'del');
    assertEqual((await catalogIds(page)).length, 1, 'Catálogo deveria ter 1 item após excluir');
    assertEqual((await trashIds(page)).length, 1, 'Lixeira deveria ter 1 item após excluir');

    const naListaAinda = await page.evaluate(() => document.querySelector('#itemList').textContent.includes('Curso Lixeira 1'));
    assertEqual(naListaAinda, false, 'Item excluído não deveria mais aparecer na lista de Conformidade');

    await page.click('[data-tab="config"]');
    await page.waitForTimeout(300);
    await page.click('[data-restaurar]');
    await page.waitForTimeout(300);
    assertEqual((await catalogIds(page)).length, 2, 'Catálogo deveria voltar a ter 2 itens após restaurar');
    assertEqual((await trashIds(page)).length, 0, 'Lixeira deveria ficar vazia após restaurar');
});

test('Excluir definitivamente e "Esvaziar lixeira" removem de vez', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Purga 1', instituicao: 'X', anoFim: '2024' }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Purga 2', instituicao: 'Y', anoFim: '2023' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    await clickAct(page, 'Curso Purga 1', 'del');
    await clickAct(page, 'Curso Purga 2', 'del');

    await page.click('[data-tab="config"]');
    await page.waitForTimeout(300);
    assertEqual((await trashIds(page)).length, 2, 'Lixeira deveria ter 2 itens');

    await page.click('[data-purgar]');
    await page.waitForTimeout(300);
    assertEqual((await trashIds(page)).length, 1, 'Lixeira deveria ter 1 item após excluir definitivamente o outro');

    await page.click('#btnEsvaziarLixeira');
    await page.waitForTimeout(300);
    assertEqual((await trashIds(page)).length, 0, 'Lixeira deveria ficar vazia após "Esvaziar lixeira"');
});

test('Itens na lixeira há mais de 30 dias são purgados automaticamente no início', async ({ page, baseUrl }) => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const mk = (titulo, deletedAt) => ({
        id: 'it-' + Math.random().toString(36).slice(2), createdAt: now, updatedAt: now, source: 'local', lattesItem: false,
        typeKey: 'FORMACAO_COMPLEMENTAR', categoryKey: 'FORMACAO', fields: { titulo, instituicao: 'X' },
        evidencias: [], hasPdf: false, pdfName: null, fileExt: null, lattesRef: null,
        deletedAt, trashFromFolder: 'Evidências/02 Formação',
    });
    const trash = [mk('Item Vencido', old), mk('Item Recente', recent)];

    await page.goto(baseUrl + '/index.html');
    await page.evaluate((t) => localStorage.setItem('lz_trash', JSON.stringify(t)), trash);
    await page.reload();
    await page.waitForTimeout(700);

    const titulosRestantes = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_trash') || '[]').map((i) => i.fields.titulo));
    assertEqual(titulosRestantes, ['Item Recente'], 'Só o item de 5 dias deveria sobrar; o de 31 dias deveria ter sido purgado');
});
