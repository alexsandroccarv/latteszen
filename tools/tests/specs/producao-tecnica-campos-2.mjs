/* ==========================================================================
   lattesZen — Produção técnica (auditoria vs. Lattes real), sub-lote 2:
   Programa de computador sem registro, Cartas/mapas ou similares, Curso de
   curta duração ministrado, Desenvolvimento de material didático ou
   instrucional, Editoração — campos que faltavam (Meio de divulgação, 10
   mais relevantes?, educação/popularização de C&T, potencial de inovação,
   Autores em lista, e os campos específicos de detalhamento de cada tipo).
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

test('Programa de computador sem registro: Natureza, Meio de divulgação, flags e Autores em lista salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Programa de computador sem registro');

    const opcoesNatureza = await page.locator('select[name="natureza"] option').allTextContents();
    assertEqual(opcoesNatureza.map((o) => o.trim()).filter((o) => o && o !== '—'), ['Computacional', 'Multimídia', 'Outro'],
        `Opções de Natureza incorretas — obtidas: ${JSON.stringify(opcoesNatureza)}`);

    await page.fill('input[name="titulo"]', 'Sistema de gestão acadêmica');
    await page.fill('input[name="ano"]', '2021');
    await page.selectOption('select[name="natureza"]', 'Computacional');
    await page.selectOption('select[name="meioDivulgacao"]', 'Meio digital');
    await page.click('input[name="relevante"]');
    await page.click('input[name="divulgacaoCT"]');
    await page.click('input[name="potencialInovacao"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.selectOption('select[name="disponibilidade"]', 'Irrestrita');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'SOFTWARE_SEM_REGISTRO');
    assert(!!item, 'O software deveria ter sido salvo');
    assertEqual(item.fields.natureza, 'Computacional', 'Natureza deveria ser salva');
    assertEqual(item.fields.meioDivulgacao, 'Meio digital', 'Meio de divulgação deveria ser salvo');
    assertEqual(item.fields.relevante, 'Sim', 'Relevante deveria ser salvo como Sim');
    assertEqual(item.fields.divulgacaoCT, 'Sim', 'Educação/popularização de C&T deveria ser salvo como Sim');
    assertEqual(item.fields.potencialInovacao, 'Sim', 'Potencial de inovação deveria ser salvo como Sim');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Fulano de Tal'], 'Autores (lista) deveria ter sido salvo');
    assertEqual(item.fields.disponibilidade, 'Irrestrita', 'Disponibilidade deveria ser salva');
});

test('Cartas, mapas ou similares: Tema, Técnica, Área representada e demais campos novos salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Cartas, mapas ou similares');

    await page.fill('input[name="titulo"]', 'Mapa geológico da bacia X');
    await page.fill('input[name="ano"]', '2019');
    await page.selectOption('select[name="natureza"]', 'Mapa');
    await page.selectOption('select[name="meioDivulgacao"]', 'Impresso');
    await page.click('input[name="relevante"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="tema"]', 'Geologia estrutural');
    await page.fill('input[name="tecnica"]', 'Sensoriamento remoto');
    await page.fill('input[name="areaRepresentada"]', 'Bacia sedimentar X');
    await page.fill('input[name="instituicao"]', 'CNPq');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'CARTA_MAPA');
    assert(!!item, 'A carta/mapa deveria ter sido salva');
    assertEqual(item.fields.tema, 'Geologia estrutural', 'Tema deveria ser salvo');
    assertEqual(item.fields.tecnica, 'Sensoriamento remoto', 'Técnica deveria ser salva');
    assertEqual(item.fields.areaRepresentada, 'Bacia sedimentar X', 'Área representada deveria ser salva');
    assertEqual(item.fields.instituicao, 'CNPq', 'Instituição financiadora deveria ser salva');
});

test('Curso de curta duração ministrado: Participação dos autores, Unidade e demais campos novos salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Curso de curta duração ministrado');

    await page.fill('input[name="titulo"]', 'Curso de introdução a Python');
    await page.fill('input[name="ano"]', '2022');
    await page.selectOption('select[name="nivel"]', 'Extensão');
    await page.selectOption('select[name="meioDivulgacao"]', 'Meio digital');
    await page.click('input[name="relevante"]');
    await page.click('input[name="divulgacaoCT"]');
    await page.selectOption('select[name="participacaoAutores"]', 'Docente');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="cargaHoraria"]', '20');
    await page.fill('input[name="unidade"]', 'horas');
    await page.fill('input[name="local"]', 'Auditório Central');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'CURSO_MINISTRADO');
    assert(!!item, 'O curso deveria ter sido salvo');
    assertEqual(item.fields.participacaoAutores, 'Docente', 'Participação dos autores deveria ser salva');
    assertEqual(item.fields.unidade, 'horas', 'Unidade deveria ser salva');
    assertEqual(item.fields.local, 'Auditório Central', 'Local do curso deveria ser salvo');
    assertEqual(item.fields.divulgacaoCT, 'Sim', 'Educação/popularização de C&T deveria ser salvo como Sim');
});

test('Desenvolvimento de material didático ou instrucional: Natureza (texto livre) e demais campos novos salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Desenvolvimento de material didático');

    await page.fill('input[name="titulo"]', 'Apostila de cálculo I');
    await page.fill('input[name="ano"]', '2020');
    await page.fill('input[name="natureza"]', 'Apostila impressa');
    await page.selectOption('select[name="meioDivulgacao"]', 'Impresso');
    await page.click('input[name="relevante"]');
    await page.click('input[name="divulgacaoCT"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'MATERIAL_DIDATICO');
    assert(!!item, 'O material didático deveria ter sido salvo');
    assertEqual(item.fields.natureza, 'Apostila impressa', 'Natureza deveria ser salva');
    assertEqual(item.fields.meioDivulgacao, 'Impresso', 'Meio de divulgação deveria ser salvo');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Fulano de Tal'], 'Autores (lista) deveria ter sido salvo');
});

test('Editoração: Meio de divulgação, Instituição promotora e Autores em lista (antes ausente) salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Editoração');

    await page.fill('input[name="titulo"]', 'Anais do congresso X');
    await page.fill('input[name="ano"]', '2018');
    await page.selectOption('select[name="natureza"]', 'Anais');
    await page.selectOption('select[name="meioDivulgacao"]', 'Impresso e mídia eletrônica');
    await page.click('input[name="relevante"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="paginas"]', '300');
    await page.fill('input[name="instituicao"]', 'Universidade Y');
    await page.fill('input[name="editora"]', 'Editora Universitária');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'EDITORACAO');
    assert(!!item, 'A editoração deveria ter sido salva');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Fulano de Tal'], 'Autores (lista) deveria ter sido salvo (antes o tipo não tinha campo de autores)');
    assertEqual(item.fields.instituicao, 'Universidade Y', 'Instituição promotora deveria ser salva');
    assertEqual(item.fields.meioDivulgacao, 'Impresso e mídia eletrônica', 'Meio de divulgação deveria ser salvo');
});
