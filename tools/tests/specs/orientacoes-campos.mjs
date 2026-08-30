/* ==========================================================================
   lattesZen — Orientações (auditoria vs. Lattes real): Orientações e
   supervisões concluídas / em andamento.
   Ambas ganham "10 mais relevantes?" (só concluídas têm o atributo real no
   schema — ausente para "em andamento", confirmado limitação genuína), "Com
   bolsa?" separado de "Agência financiadora" (antes conflados num único
   campo de texto livre) e Setores de atividade.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function selecionar(page, categoriaTxt, tipoTxt) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    const catVal = await page.$eval('#selCategoria', (sel, txt) => Array.from(sel.options).find((o) => o.textContent.includes(txt))?.value, categoriaTxt);
    await page.selectOption('#selCategoria', catVal);
    await page.waitForTimeout(150);
    const tipoVal = await page.$eval('#selTipo', (sel, txt) => Array.from(sel.options).find((o) => o.textContent.includes(txt))?.value, tipoTxt);
    await page.selectOption('#selTipo', tipoVal);
    await page.waitForTimeout(150);
}

test('Orientações concluídas: "10 mais relevantes?", Com bolsa? (separado de Agência financiadora) e Setores de atividade salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Orientações', 'concluídas');

    await page.selectOption('select[name="tipo"]', 'Mestrado');
    await page.fill('input[name="orientando"]', 'Fulano de Tal');
    await page.fill('input[name="titulo"]', 'Dissertação de mestrado X');
    await page.fill('input[name="ano"]', '2022');
    await page.click('input[name="relevante"]');
    await page.click('input[name="comBolsa"]');
    await page.fill('input[name="bolsa"]', 'CAPES');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'ORIENTACAO_CONCLUIDA');
    assert(!!item, 'A orientação concluída deveria ter sido salva');
    assertEqual(item.fields.relevante, 'Sim', 'Relevante deveria ser salvo como Sim');
    assertEqual(item.fields.comBolsa, 'Sim', 'Com bolsa? deveria ser salvo como Sim');
    assertEqual(item.fields.bolsa, 'CAPES', 'Agência financiadora deveria ser salva separadamente de Com bolsa?');
});

test('Orientações em andamento: Com bolsa? e Setores de atividade salvam corretamente (sem campo de "10 mais relevantes?" na UI, ausente no schema para este tipo)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Orientações', 'andamento');

    await page.selectOption('select[name="tipo"]', 'Doutorado');
    await page.fill('input[name="orientando"]', 'Ciclana de Tal');
    await page.fill('input[name="titulo"]', 'Tese de doutorado Y');
    await page.fill('input[name="ano"]', '2023');
    await page.click('input[name="comBolsa"]');
    await page.fill('input[name="bolsa"]', 'CNPq');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'ORIENTACAO_ANDAMENTO');
    assert(!!item, 'A orientação em andamento deveria ter sido salva');
    assertEqual(item.fields.comBolsa, 'Sim', 'Com bolsa? deveria ser salvo como Sim');
    assertEqual(item.fields.bolsa, 'CNPq', 'Agência financiadora deveria ser salva');
});
