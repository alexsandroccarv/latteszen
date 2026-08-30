/* ==========================================================================
   lattesZen — Produção bibliográfica (auditoria vs. Lattes real):
   - "Artigo completo": Meio de divulgação com as 7 opções padrão (antes só
     tinha 3, inconsistente com os demais tipos).
   - Partitura musical / Tradução / Prefácio, posfácio / Outra produção
     bibliográfica: campos que faltavam (Meio de divulgação, 10 mais
     relevantes?, Autores em lista, Palavras-chave/Área/Setores/Outras
     informações, e os campos específicos de detalhamento de cada tipo).
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

test('Artigo completo: Meio de divulgação tem as 7 opções padrão (não só 3)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Artigos completos');
    const opcoes = await page.locator('select[name="meioDivulgacao"] option').allTextContents();
    const semPlaceholder = opcoes.map((o) => o.trim()).filter((o) => o && o !== '—');
    assertEqual(semPlaceholder, ['Impresso', 'Meio magnético', 'Meio digital', 'Filme', 'Hipertexto', 'Outro', 'Impresso e mídia eletrônica'],
        `Opções de Meio de divulgação incorretas — obtidas: ${JSON.stringify(semPlaceholder)}`);
});

test('Partitura musical: campos que faltavam (Meio de divulgação, relevante, Autores em lista, editora/cidade/páginas/catálogo, palavras-chave) salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Partitura musical');

    await page.fill('input[name="titulo"]', 'Missa em Dó Maior');
    await page.fill('input[name="ano"]', '2020');
    await page.selectOption('select[name="meioDivulgacao"]', 'Meio digital');
    await page.click('input[name="relevante"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="formacao"]', 'Coral e orquestra');
    await page.fill('input[name="editora"]', 'Editora Musical');
    await page.fill('input[name="cidade"]', 'São Paulo');
    await page.fill('input[name="paginas"]', '40');
    await page.fill('input[name="numeroCatalogo"]', 'BWV 232');
    await page.fill('textarea[name="palavrasChave"]', 'música sacra; coral');
    await page.fill('textarea[name="outrasInfo"]', 'Estreada em 2020.');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'PARTITURA');
    assert(!!item, 'A partitura deveria ter sido salva');
    assertEqual(item.fields.meioDivulgacao, 'Meio digital', 'Meio de divulgação deveria ser salvo');
    assertEqual(item.fields.relevante, 'Sim', 'Relevante deveria ser salvo como Sim');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Fulano de Tal'], 'Autores (lista) deveria ter sido salvo');
    assertEqual(item.fields.cidade, 'São Paulo', 'Cidade da editora deveria ser salva');
    assertEqual(item.fields.numeroCatalogo, 'BWV 232', 'Número do catálogo deveria ser salvo');
    assertEqual(item.fields.palavrasChave, 'música sacra; coral', 'Palavras-chave deveria ser salva');
});

test('Tradução, Prefácio/posfácio e Outra produção bibliográfica têm os novos campos (Meio de divulgação, Autores em lista, Palavras-chave)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    for (const tipoTxt of ['Tradução', 'Prefácio', 'Outra produção bibliográfica']) {
        await selecionar(page, 'Produções', tipoTxt);
        const temMeio = await page.locator('select[name="meioDivulgacao"]').count();
        assert(temMeio > 0, `${tipoTxt}: deveria ter o campo Meio de divulgação`);
        const temAutoresLista = await page.locator('[data-repeater-wrap="autoresLista"]').count();
        assert(temAutoresLista > 0, `${tipoTxt}: deveria ter Autores como lista (repeater)`);
        const temPalavrasChave = await page.locator('textarea[name="palavrasChave"]').count();
        assert(temPalavrasChave > 0, `${tipoTxt}: deveria ter o campo Palavras-chave`);
    }

    // Prefácio/posfácio tem "Tipo" (Prefácio/Posfácio/...) E "Natureza"
    // (Livro/Revistas ou periódicos/Outra) como campos DISTINTOS.
    await selecionar(page, 'Produções', 'Prefácio');
    const opcoesNatureza = await page.locator('select[name="naturezaObra"] option').allTextContents();
    assertEqual(opcoesNatureza.map((o) => o.trim()).filter((o) => o && o !== '—'), ['Livro', 'Revistas ou periódicos', 'Outra'],
        `Opções de Natureza (Prefácio/posfácio) incorretas — obtidas: ${JSON.stringify(opcoesNatureza)}`);
});
