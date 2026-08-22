/* ==========================================================================
   Regressão: "Buscar metadados" no campo DOI via Crossref (issue #5)
   --------------------------------------------------------------------------
   A API pública do Crossref é mockada via page.route (não há como testar
   contra o serviço real no CI). Cobre: DOI inválido/vazio não busca nada;
   preenchimento de campos vazios (título, ano, periódico, ISSN, autores);
   não sobrescreve campo já preenchido sem confirmação; sobrescreve quando
   a usuária confirma.
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

const CROSSREF_FIXTURE = {
    message: {
        title: ['Um Artigo Encontrado no Crossref'],
        author: [{ given: 'Maria', family: 'Autora' }, { given: 'João', family: 'Colaborador' }],
        published: { 'date-parts': [[2023, 5]] },
        'container-title': ['Revista Crossref de Teste'],
        ISSN: ['1234-5678'],
        volume: '10',
        issue: '2',
        page: '100-115',
    },
};

async function mockCrossref(page) {
    await page.route('https://api.crossref.org/**', (route) => {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CROSSREF_FIXTURE) });
    });
}

async function abrirArtigoPeriodico(page, baseUrl) {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    const catVal = await page.$eval('#selCategoria', (sel) => Array.from(sel.options).find((o) => o.textContent.includes('Produções')).value);
    await page.selectOption('#selCategoria', catVal);
    await page.waitForTimeout(150);
    const tipoVal = await page.$eval('#selTipo', (sel) => Array.from(sel.options).find((o) => o.textContent.includes('Artigos completos publicados em periódicos')).value);
    await page.selectOption('#selTipo', tipoVal);
    await page.waitForTimeout(150);
}

test('DOI vazio: "Buscar metadados" mostra erro e não preenche nada', async ({ page, baseUrl }) => {
    await abrirArtigoPeriodico(page, baseUrl);
    await page.click('[data-crossref-btn]');
    await page.waitForTimeout(300);
    const status = await page.$eval('[data-crossref-status]', (el) => el.textContent);
    assert(status.includes('DOI válido'), 'Deveria pedir um DOI válido antes de buscar');
    const titulo = await page.$eval('[name="titulo"]', (el) => el.value);
    assertEqual(titulo, '', 'Nenhum campo deveria ter sido preenchido sem um DOI válido');
});

test('Busca por DOI preenche os campos vazios do tipo atual', async ({ page, baseUrl }) => {
    await mockCrossref(page);
    await abrirArtigoPeriodico(page, baseUrl);
    await page.fill('[name="doi"]', '10.1000/teste456');
    await page.click('[data-crossref-btn]');
    await page.waitForTimeout(400);

    assertEqual(await page.$eval('[name="titulo"]', (el) => el.value), 'Um Artigo Encontrado no Crossref', 'Título deveria ter sido preenchido');
    assertEqual(await page.$eval('[name="ano"]', (el) => el.value), '2023', 'Ano deveria ter sido extraído da data de publicação');
    assertEqual(await page.$eval('[name="periodico"]', (el) => el.value), 'Revista Crossref de Teste', 'Periódico deveria ter sido preenchido (container-title)');
    assertEqual(await page.$eval('[name="issn"]', (el) => el.value), '1234-5678', 'ISSN deveria ter sido preenchido');
    assertEqual(await page.$eval('[name="volume"]', (el) => el.value), '10', 'Volume deveria ter sido preenchido');
    assertEqual(await page.$eval('[name="fasciculo"]', (el) => el.value), '2', 'Fascículo deveria ter sido preenchido (issue)');
    assertEqual(await page.$eval('[name="paginaInicial"]', (el) => el.value), '100', 'Página inicial deveria ter sido extraída de "page"');
    assertEqual(await page.$eval('[name="paginaFinal"]', (el) => el.value), '115', 'Página final deveria ter sido extraída de "page"');

    const autores = await page.evaluate(() => {
        const hidden = document.querySelector('[data-repeater="autoresLista"]');
        return JSON.parse(hidden.value || '[]').map((a) => a.nomeCompleto);
    });
    assertEqual(autores, ['Maria Autora', 'João Colaborador'], 'Autores deveriam ter sido extraídos de "author" (given + family)');

    const status = await page.$eval('[data-crossref-status]', (el) => el.textContent);
    assert(/\d+ campo\(s\) preenchido\(s\)/.test(status), 'Deveria informar quantos campos foram preenchidos');
});

test('Campo já preenchido não é sobrescrito quando a confirmação é recusada', async ({ page, baseUrl }) => {
    await mockCrossref(page);
    // Sobrepõe apenas o confirm() nesta página/contexto — o diálogo nativo
    // do harness sempre aceita, então isolamos essa decisão via JS.
    await page.addInitScript(() => { window.confirm = () => false; });
    await abrirArtigoPeriodico(page, baseUrl);
    await page.fill('[name="titulo"]', 'Título Já Digitado Pela Usuária');
    await page.fill('[name="doi"]', '10.1000/teste456');
    await page.click('[data-crossref-btn]');
    await page.waitForTimeout(400);

    assertEqual(await page.$eval('[name="titulo"]', (el) => el.value), 'Título Já Digitado Pela Usuária', 'Título já preenchido não deveria ser sobrescrito sem confirmação');
    // Campos ainda vazios (ano, periódico) devem ser preenchidos normalmente.
    assertEqual(await page.$eval('[name="ano"]', (el) => el.value), '2023', 'Campo vazio deveria ser preenchido mesmo quando outro campo recusa substituição');
});

test('Campo já preenchido é sobrescrito quando a confirmação é aceita', async ({ page, baseUrl }) => {
    await mockCrossref(page);
    await abrirArtigoPeriodico(page, baseUrl); // harness aceita o confirm() por padrão
    await page.fill('[name="titulo"]', 'Título Antigo');
    await page.fill('[name="doi"]', '10.1000/teste456');
    await page.click('[data-crossref-btn]');
    await page.waitForTimeout(400);

    assertEqual(await page.$eval('[name="titulo"]', (el) => el.value), 'Um Artigo Encontrado no Crossref', 'Título deveria ter sido substituído ao confirmar');
});

test('DOI não encontrado no Crossref mostra erro e não altera o formulário', async ({ page, baseUrl }) => {
    await page.route('https://api.crossref.org/**', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
    await abrirArtigoPeriodico(page, baseUrl);
    await page.fill('[name="doi"]', '10.1000/nao-existe');
    await page.click('[data-crossref-btn]');
    await page.waitForTimeout(400);

    const status = await page.$eval('[data-crossref-status]', (el) => el.textContent);
    assert(status.includes('não encontrado'), 'Deveria informar que o DOI não foi encontrado no Crossref');
    assertEqual(await page.$eval('[name="titulo"]', (el) => el.value), '', 'Formulário não deveria ser alterado quando o DOI não é encontrado');
});
