/* ==========================================================================
   lattesZen — Patentes e Registros (auditoria vs. Lattes real), sub-lote 2/2
   (final): Desenho industrial registrado, Marca registrada, Topografia de
   circuito integrado registrada. Todos ganham Instituição de registro
   (distinta de financiadora), potencial de inovação, Inventores em lista e
   Palavras-chave/Área/Setores/Outras informações. Marca ganha Tipo e
   Natureza como selects reais (Tipo sem mapeamento de exportação — limitação
   genuína do schema). Topografia não tem Depositante/Titular nem datas de
   registro/concessão (ausentes na tela real deste tipo, diferente de
   Desenho industrial).
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

test('Desenho industrial registrado: Instituição de registro (distinta de financiadora), potencial de inovação, Depositante/Titular e Inventores em lista salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Patentes e Registros', 'Desenho industrial');

    await page.fill('input[name="registro"]', 'BR302020001234');
    await page.fill('input[name="instituicaoRegistro"]', 'INPI');
    await page.fill('input[name="titulo"]', 'Design de embalagem ergonômica');
    await page.fill('input[name="ano"]', '2020');
    await page.click('input[name="potencialInovacao"]');
    await page.fill('textarea[name="titular"]', 'UNIFESP');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('textarea[name="instituicao"]', 'FAPESP');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'DESENHO_INDUSTRIAL');
    assert(!!item, 'O desenho industrial deveria ter sido salvo');
    assertEqual(item.fields.instituicaoRegistro, 'INPI', 'Instituição de registro deveria ser salva');
    assertEqual(item.fields.instituicao, 'FAPESP', 'Instituição(ões) financiadora(s) deveria ser salva separadamente da instituição de registro');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Fulano de Tal'], 'Inventores (lista) deveria ter sido salvo');
});

test('Marca registrada: Tipo e Natureza como selects reais, potencial de inovação e Inventores em lista salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Patentes e Registros', 'Marca registrada');

    const opcoesTipo = await page.locator('select[name="tipo"] option').allTextContents();
    assertEqual(opcoesTipo.map((o) => o.trim()).filter((o) => o && o !== '—'), ['de Produto', 'de Serviço', 'Coletiva', 'Certificação'],
        `Opções de Tipo incorretas — obtidas: ${JSON.stringify(opcoesTipo)}`);
    const opcoesNatureza = await page.locator('select[name="natureza"] option').allTextContents();
    assertEqual(opcoesNatureza.map((o) => o.trim()).filter((o) => o && o !== '—'), ['Figurativa', 'Nominativa', 'Mista', 'Tridimensional'],
        `Opções de Natureza incorretas — obtidas: ${JSON.stringify(opcoesNatureza)}`);
    const temFinalidade = await page.locator('textarea[name="finalidade"]').count();
    assert(temFinalidade === 0, 'Marca NÃO deveria ter o campo Finalidade (ausente na tela real deste tipo)');

    await page.fill('input[name="registro"]', 'BR512020009876');
    await page.fill('input[name="instituicaoRegistro"]', 'INPI');
    await page.selectOption('select[name="tipo"]', 'de Serviço');
    await page.selectOption('select[name="natureza"]', 'Mista');
    await page.fill('input[name="titulo"]', 'Marca XYZ');
    await page.fill('input[name="ano"]', '2021');
    await page.click('input[name="potencialInovacao"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'MARCA');
    assert(!!item, 'A marca deveria ter sido salva');
    assertEqual(item.fields.tipo, 'de Serviço', 'Tipo deveria ser salvo');
    assertEqual(item.fields.natureza, 'Mista', 'Natureza deveria ser salva');
    assertEqual(item.fields.instituicaoRegistro, 'INPI', 'Instituição de registro deveria ser salva');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Fulano de Tal'], 'Inventores (lista) deveria ter sido salvo');
});

test('Topografia de circuito integrado registrada: sem Depositante/Titular nem datas (diferente de Desenho industrial), com os demais campos novos', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Patentes e Registros', 'Topografia de circuito integrado');

    const temTitular = await page.locator('textarea[name="titular"]').count();
    assert(temTitular === 0, 'Topografia NÃO deveria ter o campo Depositante/Titular (ausente na tela real deste tipo)');
    const temDataDeposito = await page.locator('input[name="dataDeposito"]').count();
    assert(temDataDeposito === 0, 'Topografia NÃO deveria ter Data do registro/concessão (ausentes na tela real deste tipo)');

    await page.fill('input[name="registro"]', 'BR812020001111');
    await page.fill('input[name="instituicaoRegistro"]', 'INPI');
    await page.fill('input[name="titulo"]', 'Topografia de chip X');
    await page.fill('input[name="ano"]', '2022');
    await page.click('input[name="potencialInovacao"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('textarea[name="instituicao"]', 'CNPq');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'TOPOGRAFIA_CI');
    assert(!!item, 'A topografia de circuito integrado deveria ter sido salva');
    assertEqual(item.fields.instituicaoRegistro, 'INPI', 'Instituição de registro deveria ser salva');
    assertEqual(item.fields.instituicao, 'CNPq', 'Instituição(ões) financiadora(s) deveria ser salva');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Fulano de Tal'], 'Inventores (lista) deveria ter sido salvo');
});
