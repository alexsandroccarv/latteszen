/* ==========================================================================
   Regressão: "18. Concursos e processos seletivos" — novo campo "Tipo de
   item" com as 7 opções pedidas.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

async function abrirConcursos(page) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'AL_CONCURSO_CAT');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'AL_CONCURSO');
    await page.waitForTimeout(150);
}

test('Concursos: "Tipo de item" tem as 7 opções pedidas', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirConcursos(page);

    const opcoes = await page.$eval('#dynFields select[name="tipoItem"]', (sel) => Array.from(sel.options).map((o) => o.value).filter(Boolean));
    assertEqual(opcoes, [
        'Concurso Público',
        'Processo Seletivo Simplificado (PSS)',
        'Processo Seletivo Acadêmico',
        'Concurso cultural, artístico ou literário',
        'Chamada Pública e Edital de Projetos',
        'Prêmios, Concurso de Ideias e Hackathon',
        'Seleção Interna',
    ], 'Tipo de item deveria ter exatamente as 7 opções pedidas, nesta ordem');
});

test('Concursos: salvar grava o Tipo de item escolhido', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirConcursos(page);

    await page.fill('#dynFields input[name="titulo"]', 'Concurso de teste');
    await page.selectOption('#dynFields select[name="tipoItem"]', 'Chamada Pública e Edital de Projetos');
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').find((i) => i.typeKey === 'AL_CONCURSO'));
    assert(salvo, 'O item de Concurso deveria ter sido salvo');
    assertEqual(salvo.fields.tipoItem, 'Chamada Pública e Edital de Projetos', 'Tipo de item deveria ter sido salvo corretamente');
});
