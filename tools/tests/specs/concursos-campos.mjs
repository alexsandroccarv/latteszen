/* ==========================================================================
   Regressão: "18. Concursos e processos seletivos" — os 7 "Tipo de item"
   pedidos viram os próprios tipos do item (mesmo padrão de "19. Imprensa"),
   em vez de um campo de classificação duplicado dentro do formulário.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

async function abrirConcursos(page, tipo) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'AL_CONCURSO_CAT');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', tipo);
    await page.waitForTimeout(150);
}

test('Concursos: "Tipo do item" mostra os 7 rótulos pedidos, sem o antigo "Concursos e processos seletivos" único', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'AL_CONCURSO_CAT');
    await page.waitForTimeout(150);

    const opcoes = await page.$eval('#selTipo', (sel) => Array.from(sel.options).filter((o) => o.value).map((o) => o.textContent.trim()));
    assertEqual(opcoes, [
        'Concurso Público',
        'Processo Seletivo Simplificado (PSS)',
        'Processo Seletivo Acadêmico',
        'Concurso cultural, artístico ou literário',
        'Chamada Pública e Edital de Projetos',
        'Prêmios, Concurso de Ideias e Hackathon',
        'Seleção Interna',
    ], 'O Tipo do item deveria ter exatamente os 7 rótulos pedidos, nesta ordem');
});

test('Concursos: nenhum dos 7 tipos tem campo "Tipo de item" duplicado dentro do formulário', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirConcursos(page, 'AL_CONCURSO_PUBLICO');
    assertEqual(await page.locator('#dynFields [name="tipoItem"]').count(), 0, 'Não deveria existir um campo "Tipo de item" dentro do formulário — a classificação já é o próprio Tipo do item');
    assert(await page.locator('#dynFields input[name="titulo"]').count() === 1, 'O campo "Nome do concurso / processo seletivo" deveria continuar existindo');
});

test('Concursos: salvar um item de "Concurso Público" grava o typeKey certo', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirConcursos(page, 'AL_CONCURSO_PUBLICO');

    await page.fill('#dynFields input[name="titulo"]', 'Concurso de teste');
    await page.fill('#dynFields input[name="local"]', 'Prefeitura de Teste');
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').find((i) => i.fields.titulo === 'Concurso de teste'));
    assert(salvo, 'O item de Concurso deveria ter sido salvo');
    assertEqual(salvo.typeKey, 'AL_CONCURSO_PUBLICO', 'O item deveria ter sido salvo com o typeKey do Tipo de item escolhido');
    assertEqual(salvo.fields.local, 'Prefeitura de Teste', 'O campo Local deveria ter sido salvo corretamente');
});
