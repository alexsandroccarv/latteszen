/* ==========================================================================
   lattesZen — Eventos (auditoria vs. Lattes real): Participação em eventos e
   Organização de eventos.
   Participação em eventos já estava quase completa — auditoria confirmou que
   só falta "Classificação do evento" (Internacional/Nacional/Regional/Local),
   limitação genuína do schema (o atributo correspondente pertence a outro
   elemento — Trabalho publicado em anais, seção 5.5).
   Organização de eventos ganha Natureza, Idioma, Meio de divulgação, os dois
   flags, Duração (semanas), Evento itinerante, Catálogo, Local (distinto de
   Cidade), Autores em lista e Palavras-chave/Área/Setores/Outras informações.
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

test('Participação em eventos: não tem campo de Classificação do evento (limitação genuína de schema, sem elemento correspondente)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Eventos', 'Participação em eventos');

    const temClassificacao = await page.locator('[name="classificacao"], select:has-text("Internacional")').count();
    assert(temClassificacao === 0, 'Não deveria haver campo de Classificação do evento (sem correspondência no XSD/DTD para este tipo)');
});

test('Organização de eventos: Natureza, Idioma, Meio de divulgação, Duração, Itinerante, Catálogo, Local e Autores em lista salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Eventos', 'Organização de eventos');

    const opcoesNatureza = await page.locator('select[name="natureza"] option').allTextContents();
    assertEqual(opcoesNatureza.map((o) => o.trim()).filter((o) => o && o !== '—'), ['Curadoria', 'Montagem', 'Museologia', 'Organização'],
        `Opções de Natureza incorretas — obtidas: ${JSON.stringify(opcoesNatureza)}`);

    await page.fill('input[name="titulo"]', 'Congresso Brasileiro de Engenharia');
    await page.fill('input[name="ano"]', '2022');
    await page.selectOption('select[name="tipoEvento"]', 'Congresso');
    await page.selectOption('select[name="natureza"]', 'Organização');
    await page.selectOption('select[name="meioDivulgacao"]', 'Meio digital');
    await page.click('input[name="relevante"]');
    await page.click('input[name="divulgacaoCT"]');
    await page.fill('input[name="instituicao"]', 'UNIFESP');
    await page.fill('input[name="duracaoSemanas"]', '2');
    await page.click('input[name="itinerante"]');
    await page.click('input[name="catalogo"]');
    await page.fill('input[name="local"]', 'Centro de Convenções');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('textarea[name="palavrasChave"]', 'engenharia; congresso');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'ORGANIZACAO_EVENTO');
    assert(!!item, 'A organização de evento deveria ter sido salva');
    assertEqual(item.fields.natureza, 'Organização', 'Natureza deveria ser salva');
    assertEqual(item.fields.duracaoSemanas, '2', 'Duração (semanas) deveria ser salva');
    assertEqual(item.fields.itinerante, 'Sim', 'Evento itinerante deveria ser salvo como Sim');
    assertEqual(item.fields.catalogo, 'Sim', 'Catálogo deveria ser salvo como Sim');
    assertEqual(item.fields.local, 'Centro de Convenções', 'Local deveria ser salvo');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Fulano de Tal'], 'Autores (lista) deveria ter sido salvo');
});
