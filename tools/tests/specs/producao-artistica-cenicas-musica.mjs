/* ==========================================================================
   lattesZen — Outra produção artística/cultural (auditoria vs. Lattes real):
   Artes cênicas e Música — campos que faltavam (Natureza como select real,
   Meio de divulgação, 10 mais relevantes?, educação/popularização de C&T,
   Tipo de evento, Atividade dos autores, Data/Local de estreia, Premiação,
   Obra de referência, Duração, Temporada, Autores em lista). Música soma
   "Formação instrumental" e "Ineditismo da obra" (ausente em Artes cênicas
   por limitação genuína do schema). O campo antigo "Evento / Local" foi
   relabeled para "Instituição promotora do evento" (mesma chave).
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

test('Artes cênicas: Natureza (select real) e campos novos (Meio de divulgação, estreia, premiação, autores em lista) salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Artes cênicas');

    const opcoesNatureza = await page.locator('select[name="natureza"] option').allTextContents();
    assertEqual(opcoesNatureza.map((o) => o.trim()).filter((o) => o && o !== '—'),
        ['Audiovisual', 'Circense', 'Coreográfica', 'Diversas', 'Operística', 'Performática', 'Radialística', 'Teatral', 'Outra'],
        `Opções de Natureza incorretas — obtidas: ${JSON.stringify(opcoesNatureza)}`);
    const temIneditismo = await page.locator('input[name="ineditismo"]').count();
    assert(temIneditismo === 0, 'Artes cênicas NÃO deveria ter o campo Ineditismo da obra (sem atributo correspondente no XSD/DTD para este tipo)');

    await page.fill('input[name="titulo"]', 'Espetáculo Auto da Compadecida');
    await page.fill('input[name="ano"]', '2019');
    await page.selectOption('select[name="natureza"]', 'Teatral');
    await page.selectOption('select[name="meioDivulgacao"]', 'Meio digital');
    await page.click('input[name="relevante"]');
    await page.click('input[name="divulgacaoCT"]');
    await page.fill('input[name="tipoEvento"]', 'Festival');
    await page.fill('input[name="atividadeAutores"]', 'Direção');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="dataEstreia"]', '10/05/2019');
    await page.fill('input[name="localEstreia"]', 'Teatro Municipal');
    await page.fill('input[name="premiacao"]', 'Prêmio Shell');
    await page.fill('input[name="instituicaoPremio"]', 'Fundação Shell');
    await page.fill('input[name="duracaoMinutos"]', '90');
    await page.fill('input[name="temporada"]', '2019/1');
    await page.fill('input[name="evento"]', 'Festival de Teatro de Curitiba');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'ARTES_CENICAS');
    assert(!!item, 'A produção de artes cênicas deveria ter sido salva');
    assertEqual(item.fields.natureza, 'Teatral', 'Natureza deveria ser salva');
    assertEqual(item.fields.dataEstreia, '10/05/2019', 'Data de estreia deveria ser salva');
    assertEqual(item.fields.premiacao, 'Prêmio Shell', 'Premiação deveria ser salva');
    assertEqual(item.fields.evento, 'Festival de Teatro de Curitiba', 'Instituição promotora do evento (campo antigo "evento") deveria ser salva');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Fulano de Tal'], 'Autores (lista) deveria ter sido salvo');
});

test('Música: mesma estrutura de Artes cênicas, com Formação instrumental e Ineditismo da obra a mais', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Música');

    const opcoesNatureza = await page.locator('select[name="natureza"] option').allTextContents();
    assertEqual(opcoesNatureza.map((o) => o.trim()).filter((o) => o && o !== '—'),
        ['Apresentação de obra', 'Arranjo', 'Audiovisual', 'Composição', 'Diversas', 'Interpretação', 'Publicação de partitura', 'Registro fonográfico', 'Trilha sonora', 'Outra'],
        `Opções de Natureza incorretas — obtidas: ${JSON.stringify(opcoesNatureza)}`);

    await page.fill('input[name="titulo"]', 'Concerto para violino e orquestra');
    await page.fill('input[name="ano"]', '2021');
    await page.selectOption('select[name="natureza"]', 'Composição');
    await page.selectOption('select[name="meioDivulgacao"]', 'Filme');
    await page.click('input[name="relevante"]');
    await page.fill('input[name="formacaoInstrumental"]', 'Violino solo e orquestra de cordas');
    await page.click('input[name="ineditismo"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="obraReferencia"]', 'Concerto em Ré Maior');
    await page.fill('input[name="autorObraReferencia"]', 'Compositor X');
    await page.fill('input[name="anoObraReferencia"]', '1900');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'MUSICA');
    assert(!!item, 'A produção musical deveria ter sido salva');
    assertEqual(item.fields.formacaoInstrumental, 'Violino solo e orquestra de cordas', 'Formação instrumental deveria ser salva');
    assertEqual(item.fields.ineditismo, 'Sim', 'Ineditismo da obra deveria ser salvo como Sim');
    assertEqual(item.fields.obraReferencia, 'Concerto em Ré Maior', 'Obra de referência deveria ser salva');
});
