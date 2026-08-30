/* ==========================================================================
   Regressão: nuvem de palavras, linha do tempo e seletor de tema na página
   pública (Publicar na Web) — issue "página pública: foto+nome no topo,
   contatos+bio logo abaixo, nuvem+linha do tempo antes dos itens, escolha
   de tema".
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

test('Prévia inclui Nuvem de palavras e Linha do tempo, na ordem certa (intro → nuvem → tempo → itens)', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal' }),
        makeItem('RESUMO_CV', 'DADOS_GERAIS', { descricao: 'Bio curta de teste.' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Publicável', ano: '2024', periodico: 'Revista Teste' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="publicar"]');
    await page.waitForTimeout(200);
    await page.click('#btnPubPreview');
    await page.waitForTimeout(400);

    const srcdoc = await page.$eval('#pubPreview', (el) => el.srcdoc);
    assert(srcdoc.includes('class="intro'), 'A prévia deveria trazer a introdução (mini-bio) logo abaixo do masthead');
    assert(srcdoc.includes('id="nuvem"'), 'A prévia deveria trazer a seção Nuvem de palavras');
    assert(srcdoc.includes('publicável'), 'A nuvem de palavras deveria incluir palavras do título do item');
    assert(srcdoc.includes('id="tempo"'), 'A prévia deveria trazer a seção Linha do tempo');
    assert(srcdoc.includes('Produções'), 'A linha do tempo deveria incluir a categoria do item (Produções)');

    const iIntro = srcdoc.indexOf('class="intro');
    const iNuvem = srcdoc.indexOf('id="nuvem"');
    const iTempo = srcdoc.indexOf('id="tempo"');
    const iSecoes = srcdoc.indexOf('id="sec-');
    assert(iIntro > -1 && iIntro < iNuvem, 'Introdução (contatos/bio) deveria vir antes da nuvem de palavras');
    assert(iNuvem < iTempo, 'Nuvem de palavras deveria vir antes da linha do tempo');
    assert(iTempo < iSecoes, 'Linha do tempo deveria vir antes dos itens do currículo');
});

test('Item com "Publicar na Web" desmarcado não vaza para a nuvem nem para a linha do tempo', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Público', ano: '2024', periodico: 'Revista A' }),
        makeItem('LIVRO_PUBLICADO', 'PRODUCOES', { titulo: 'Confidencialissimo', ano: '2023' }, { visibilidade: { publicarWeb: false } }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="publicar"]');
    await page.waitForTimeout(200);
    await page.click('#btnPubPreview');
    await page.waitForTimeout(400);

    const srcdoc = await page.$eval('#pubPreview', (el) => el.srcdoc);
    assert(!srcdoc.toLowerCase().includes('confidencialissimo'), 'Palavra exclusiva do item privado não deveria aparecer em lugar nenhum da prévia (nem na nuvem)');
});

test('Seletor de tema: padrão "elegante", muda o CSS gerado e persiste ao trocar de aba', async ({ page, baseUrl }) => {
    const items = [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal' })];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="publicar"]');
    await page.waitForTimeout(200);

    const initial = await page.$eval('#pubStyleSelect', (el) => el.value);
    assertEqual(initial, 'elegante', 'Tema padrão deveria ser "elegante"');

    await page.selectOption('#pubStyleSelect', 'moderno');
    await page.waitForTimeout(400);
    const srcdoc = await page.$eval('#pubPreview', (el) => el.srcdoc);
    assert(srcdoc.includes('#0f6f66'), 'CSS gerado deveria refletir a paleta "moderno" escolhida');

    await page.click('[data-tab="inicio"]');
    await page.waitForTimeout(100);
    await page.click('[data-tab="publicar"]');
    await page.waitForTimeout(200);
    const afterReturn = await page.$eval('#pubStyleSelect', (el) => el.value);
    assertEqual(afterReturn, 'moderno', 'Tema escolhido deveria persistir ao sair e voltar para a aba');
});
