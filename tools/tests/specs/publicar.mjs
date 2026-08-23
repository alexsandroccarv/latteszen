/* ==========================================================================
   Regressão: aba Publicar (página pública do currículo)
   --------------------------------------------------------------------------
   Primeiro spec para esta aba — não existia cobertura antes da extração de
   tab-publicar.js (ver refatoração de app.js). Cobre o caminho principal:
   gerar a prévia a partir do catálogo (nome + item publicável) e confirmar
   que um item marcado como "não publicar na Web" some da prévia.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

test('Gerar prévia monta a página pública com nome e itens publicáveis', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Publicável', ano: '2024', periodico: 'Revista Teste' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="publicar"]');
    await page.waitForTimeout(200);
    await page.click('#btnPubPreview');
    await page.waitForTimeout(400);

    const status = await page.$eval('#pubStatus', (el) => el.textContent);
    assert(status.includes('atualizada'), 'Deveria confirmar que a prévia foi gerada');

    const srcdoc = await page.$eval('#pubPreview', (el) => el.srcdoc);
    assert(srcdoc.includes('Fulana de Tal'), 'A prévia deveria trazer o nome do item de Identificação');
    assert(srcdoc.includes('Artigo Publicável'), 'A prévia deveria trazer o título do item publicável');
    assert(srcdoc.includes('Revista Teste'), 'A prévia deveria trazer os detalhes do item (periódico)');
});

test('Item com "Publicar na Web" desmarcado não aparece na prévia', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Público', ano: '2024', periodico: 'Revista A' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Privado', ano: '2023', periodico: 'Revista B' }, { visibilidade: { publicarWeb: false } }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="publicar"]');
    await page.waitForTimeout(200);
    await page.click('#btnPubPreview');
    await page.waitForTimeout(400);

    const srcdoc = await page.$eval('#pubPreview', (el) => el.srcdoc);
    assert(srcdoc.includes('Artigo Público'), 'O item publicável deveria aparecer na prévia');
    assert(!srcdoc.includes('Artigo Privado'), 'O item com "Publicar na Web" desmarcado não deveria aparecer na prévia');
});
