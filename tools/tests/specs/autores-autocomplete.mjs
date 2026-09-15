/* ==========================================================================
   Regressão: autocomplete de Autores — mesmo comportamento já usado pelas
   demais listas (Instituições, Financiadores...): sugestão ao digitar (via
   datalist) + gerenciamento em Configurações → "Listas de autocomplete"
   (visualizar valores já usados + "Renomear em todos os itens").
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

test('Autores: o campo "Nome completo" do repeater tem datalist com nomes já usados no catálogo', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', {
            titulo: 'Artigo Um', autoresLista: [{ nomeCompleto: 'Maria da Silva', nomeCitacao: 'SILVA, M.' }],
        }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'PRODUCOES');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'ARTIGO_PERIODICO');
    await page.waitForTimeout(150);

    const listAttr = await page.$eval('[data-repeater-input="autoresLista:nomeCompleto"]', (el) => el.getAttribute('list'));
    assertEqual(listAttr, 'dl-autor', 'O campo "Nome completo" do repeater de Autores deveria apontar pro datalist dl-autor');

    const sugestoes = await page.$eval('#dl-autor', (dl) => Array.from(dl.options).map((o) => o.value));
    assert(sugestoes.includes('Maria da Silva'), 'O nome já usado no catálogo deveria aparecer como sugestão no datalist');
});

test('Autores: aparece em Configurações → "Listas de autocomplete", com "Renomear em todos os itens"', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', {
            titulo: 'Artigo Um', autoresLista: [{ nomeCompleto: 'Joao Souza', nomeCitacao: 'SOUZA, J.' }],
        }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    // "Listas de autocomplete" mora na página "Recursos opcionais" do menu
    // lateral — não é a página ativa por padrão (Armazenamento é).
    await page.click('[data-cfg-page-link="grp-opcionais"]');
    await page.waitForTimeout(150);

    const texto = await page.$eval('#tab-config', (el) => el.textContent);
    assert(texto.includes('Autores'), 'O grupo "Autores" deveria aparecer na lista de autocomplete de Configurações');

    const opcoes = await page.$eval('[data-renfrom="autor"]', (sel) => Array.from(sel.options).map((o) => o.value).filter(Boolean));
    assert(opcoes.includes('Joao Souza'), 'O select de "Renomear em todos os itens" de Autores deveria listar o nome já usado');
});

test('Autores: "Renomear em todos os itens" atualiza o nome no repeater (autoresLista) e no campo legado (autores)', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', {
            titulo: 'Artigo Um', autoresLista: [{ nomeCompleto: 'Ana Costa', nomeCitacao: 'COSTA, A.' }],
        }),
        makeItem('LIVRO_CAPITULO', 'PRODUCOES', { titulo: 'Livro Um', tipoObra: 'Livro publicado', autores: 'Ana Costa; Outro Nome' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('[data-cfg-page-link="grp-opcionais"]');
    await page.waitForTimeout(150);
    // Abre os <details> recolhidos (Listas de autocomplete > Autores) —
    // selectOption exige o elemento visível.
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));

    await page.selectOption('[data-renfrom="autor"]', 'Ana Costa');
    await page.waitForTimeout(100);
    await page.fill('[data-rento="autor"]', 'Ana Costa Silva');
    await page.waitForTimeout(100);

    await page.click('[data-rename="autor"]');
    await page.waitForTimeout(300);

    const catalogo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const artigo = catalogo.find((i) => i.typeKey === 'ARTIGO_PERIODICO');
    assertEqual(artigo.fields.autoresLista[0].nomeCompleto, 'Ana Costa Silva', 'O nome no repeater (autoresLista) deveria ter sido renomeado');
    const livro = catalogo.find((i) => i.typeKey === 'LIVRO_CAPITULO');
    assertEqual(livro.fields.autores, 'Ana Costa Silva; Outro Nome', 'O nome no campo legado "autores" deveria ter sido renomeado, mantendo o outro nome intacto');

    // Após aplicar, a seção "Listas de autocomplete" (e a lista editada)
    // devem continuar abertas — não deve "sair" da seção.
    const secaoAberta = await page.$eval('#detListasAutocomplete', (el) => el.open);
    assert(secaoAberta, 'A seção "Listas de autocomplete" deveria continuar aberta após aplicar o renomeio');
    const listaAberta = await page.$eval('details[data-vockey="autor"]', (el) => el.open);
    assert(listaAberta, 'A lista "Autores" deveria continuar aberta após aplicar o renomeio');
});

test('Listas de autocomplete: categorias aparecem em ordem alfabética', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('[data-cfg-page-link="grp-opcionais"]');
    await page.waitForTimeout(150);
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));

    const rotulos = await page.$$eval('#detListasAutocomplete details[data-vockey] > summary', (els) =>
        els.map((el) => el.textContent.trim().replace(/\s*\(\d+\)\s*$/, '')));
    const esperado = [...rotulos].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    assertEqual(rotulos, esperado, 'As categorias de "Listas de autocomplete" deveriam estar em ordem alfabética');
});
