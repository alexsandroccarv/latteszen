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

test('Atuação na página pública: itens de uma instituição aparecem agrupados por subtipo (subgrupo-label)', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal' }),
        makeItem('ATIV_CONSELHO', 'ATUACAO', { titulo: 'Conselho Curador', instituicao: 'UFSC', orgao: 'CONSU', ano: '2010' }),
        makeItem('ATIV_DIRECAO', 'ATUACAO', { titulo: 'Diretor de Departamento', instituicao: 'UFSC', orgao: 'Depto. X', ano: '2022' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="publicar"]');
    await page.waitForTimeout(200);
    await page.click('#btnPubPreview');
    await page.waitForTimeout(400);

    const srcdoc = await page.$eval('#pubPreview', (el) => el.srcdoc);
    assert(srcdoc.includes('>UFSC<'), 'A instituição (UFSC) deveria aparecer como título do grupo');
    assert(/subgrupo-label[^>]*>\s*Dire[çc][ãa]o e administra[çc][ãa]o/.test(srcdoc), `Deveria haver um subgrupo "Direção e administração" — trecho não encontrado no HTML gerado`);
    assert(/subgrupo-label[^>]*>\s*Conselhos, comiss[õo]es e consultoria/.test(srcdoc), `Deveria haver um subgrupo "Conselhos, comissões e consultoria" — trecho não encontrado no HTML gerado`);
    assert(srcdoc.includes('Diretor de Departamento') && srcdoc.includes('Conselho Curador'), 'Os títulos dos 2 itens deveriam aparecer na prévia');
});
