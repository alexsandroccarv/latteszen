/* ==========================================================================
   lattesZen — Formação complementar: campo "Nível" (Curso de curta duração /
   Extensão universitária / MBA / Outros), com os campos extras exclusivos de
   MBA (bolsa, orientador, monografia, áreas/palavras-chave/setores) — ajuste
   da auditoria contra docs/mapeamento-campos-lattes.md e o schema oficial
   (só o elemento MBA do XSD tem esses campos; os outros 3 não).
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

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

// "bolsa" fica fora daqui: além de depender do Nível, só aparece quando
// comBolsa = "Sim" (testado à parte).
const MBA_ONLY_SELECTORS = [
    '[data-field="comBolsa"]', '[data-field="tituloMonografia"]',
    '[data-field="orientador"]', '[data-field="palavrasChave"]', '[data-field="areaConhecimento"]', '[data-field="setores"]',
];

test('Formação complementar tem o campo Nível com as 4 opções da tela real do Lattes', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Formação', 'Formação complementar');
    const opcoes = await page.locator('select[name="nivel"] option').allTextContents();
    assertEqual(opcoes.map((o) => o.trim()).filter((o) => o && o !== '—'), ['Curso de curta duração', 'Extensão universitária', 'MBA', 'Outros'],
        `Opções de Nível incorretas — obtidas: ${JSON.stringify(opcoes)}`);
});

test('Campos exclusivos de MBA (bolsa, orientador, monografia, áreas) só aparecem quando Nível = MBA', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Formação', 'Formação complementar');

    await page.selectOption('select[name="nivel"]', 'Outros');
    await page.waitForTimeout(150);
    for (const sel of MBA_ONLY_SELECTORS) {
        const hidden = await page.locator(sel).evaluate((el) => el.classList.contains('hidden'));
        assert(hidden, `${sel} deveria estar escondido quando Nível = Outros`);
    }

    await page.selectOption('select[name="nivel"]', 'MBA');
    await page.waitForTimeout(150);
    for (const sel of MBA_ONLY_SELECTORS) {
        const hidden = await page.locator(sel).evaluate((el) => el.classList.contains('hidden'));
        assert(!hidden, `${sel} deveria aparecer quando Nível = MBA`);
    }
    const bolsaAindaEscondida = await page.locator('[data-field="bolsa"]').evaluate((el) => el.classList.contains('hidden'));
    assert(bolsaAindaEscondida, '"bolsa" deveria continuar escondido até comBolsa = Sim, mesmo com Nível = MBA');
    await page.selectOption('select[name="comBolsa"]', 'Sim');
    await page.waitForTimeout(150);
    const bolsaVisivel = await page.locator('[data-field="bolsa"]').evaluate((el) => el.classList.contains('hidden'));
    assert(!bolsaVisivel, '"bolsa" deveria aparecer com Nível = MBA e comBolsa = Sim');
});

test('Salvar um item de MBA grava Nível e os campos extras corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Formação', 'Formação complementar');

    await page.selectOption('select[name="nivel"]', 'MBA');
    await page.waitForTimeout(150);
    await page.fill('input[name="titulo"]', 'MBA em Gestão Pública');
    await page.fill('input[name="instituicao"]', 'FGV');
    await page.selectOption('select[name="comBolsa"]', 'Sim');
    await page.fill('input[name="bolsa"]', 'CAPES');
    await page.fill('input[name="tituloMonografia"]', 'Gestão pública aplicada');
    await page.fill('input[name="orientador"]', 'Orientador Tal');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'FORMACAO_COMPLEMENTAR');
    assert(!!item, 'O item de Formação complementar deveria ter sido salvo');
    assertEqual(item.fields.nivel, 'MBA', 'Nível deveria ser salvo como MBA');
    assertEqual(item.fields.bolsa, 'CAPES', 'Agência financiadora deveria ser salva');
    assertEqual(item.fields.tituloMonografia, 'Gestão pública aplicada', 'Título da monografia deveria ser salvo');
    assertEqual(item.fields.orientador, 'Orientador Tal', 'Orientador deveria ser salvo');
});
