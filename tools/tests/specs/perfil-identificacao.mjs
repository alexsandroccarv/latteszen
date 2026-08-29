/* ==========================================================================
   lattesZen — Identificação (perfil): "Nome em citações bibliográficas" como
   lista, migração do valor antigo (texto livre) e demais ajustes da auditoria
   contra docs/mapeamento-campos-lattes.md.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

test('Nome em citações bibliográficas: valor antigo (texto livre) migra para lista, e dá para adicionar mais variações', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', {
            titulo: 'Alexsandro Cardoso Carvalho',
            citacoes: 'CARVALHO, Alexsandro Cardoso\nCARVALHO, Alexsandro',
        }),
    ];
    await seedCatalog(page, baseUrl, items);

    await page.click('[data-tab="config"]');
    await page.waitForTimeout(300);
    await page.click('#perfilSection summary:has-text("Identificação")');
    await page.waitForTimeout(200);

    const linhasMigradas = await page.locator('[data-repeater-list="citacoes"] li').allTextContents();
    assertEqual(linhasMigradas.map((t) => t.trim()), ['CARVALHO, Alexsandro Cardoso', 'CARVALHO, Alexsandro'],
        `As 2 variações do texto antigo deveriam aparecer como linhas da lista — obtidas: ${JSON.stringify(linhasMigradas)}`);

    await page.fill('[data-repeater-input="citacoes:nome"]', 'Carvalho, A. C.');
    await page.click('[data-repeater-add="citacoes"]');
    await page.waitForTimeout(200);

    const linhasComNova = await page.locator('[data-repeater-list="citacoes"] li').allTextContents();
    assert(linhasComNova.some((t) => t.trim() === 'Carvalho, A. C.'), `A nova variação adicionada deveria aparecer na lista — obtidas: ${JSON.stringify(linhasComNova)}`);

    await page.click('form[data-perfil-form="IDENTIFICACAO"] button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const ident = salvo.find((i) => i.typeKey === 'IDENTIFICACAO');
    assertEqual(ident.fields.citacoes, [
        { nome: 'CARVALHO, Alexsandro Cardoso' },
        { nome: 'CARVALHO, Alexsandro' },
        { nome: 'Carvalho, A. C.' },
    ], 'citacoes deveria ser salvo como lista (array de {nome}), incluindo a variação nova');
});

test('Cor ou raça inclui a opção "Amarela"', async ({ page, baseUrl }) => {
    const items = [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal' })];
    await seedCatalog(page, baseUrl, items);

    await page.click('[data-tab="config"]');
    await page.waitForTimeout(300);
    await page.click('#perfilSection summary:has-text("Identificação")');
    await page.waitForTimeout(200);

    const opcoes = await page.locator('form[data-perfil-form="IDENTIFICACAO"] select[name="corRaca"] option').allTextContents();
    assert(opcoes.map((o) => o.trim()).includes('Amarela'), `"Amarela" deveria estar entre as opções de Cor ou raça — obtidas: ${JSON.stringify(opcoes)}`);
});

test('Foto de perfil não tem mais os campos "Ano de início"/"Ano de fim" (não existem na tela real do Lattes)', async ({ page, baseUrl }) => {
    const items = [makeItem('FOTO_PERFIL', 'PERFIL_FOTOS', { titulo: 'Foto oficial' })];
    await seedCatalog(page, baseUrl, items);

    await page.click('[data-tab="config"]');
    await page.waitForTimeout(300);
    await page.click('#perfilSection summary:has-text("Foto de perfil")');
    await page.waitForTimeout(200);

    const camposAno = await page.locator('form[data-perfil-form="FOTO_PERFIL"] input[name="ano"], form[data-perfil-form="FOTO_PERFIL"] input[name="anoFim"]').count();
    assert(camposAno === 0, 'O formulário de Foto de perfil não deveria mais ter campos de ano/anoFim');
});
