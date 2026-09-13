/* ==========================================================================
   Regressão: acessibilidade da cascata de Área do conhecimento (CNPq/CAPES)
   e Setores de atividade (Fase 2 da auditoria — usabilidade #3).

   associateLabels() só liga a <label> do campo ao 1º <select> da cascata —
   os outros 3 (Área/Subárea/Especialidade, ou Setor 2/3) ficavam sem nome
   acessível pra leitor de tela. Cada select agora tem seu próprio
   aria-label. O 1º select da cascata (Grande área) também recebe
   `required` quando o campo é obrigatório (ex.: Áreas de atuação) —
   inofensivo pro envio porque o <form> usa novalidate.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

test('Área do conhecimento: os 4 selects da cascata têm aria-label próprio', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'ATUACAO');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'AREA_ATUACAO');
    await page.waitForTimeout(150);

    const labels = await page.$$eval('[data-areatree-group] select', els => els.map(e => e.getAttribute('aria-label')));
    assertEqual(labels, ['Grande área', 'Área', 'Subárea', 'Especialidade']);
});

test('Área do conhecimento obrigatória (Áreas de atuação): o 1º select (Grande área) tem required', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'ATUACAO');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'AREA_ATUACAO');
    await page.waitForTimeout(150);

    const req = await page.$eval('[data-areatree="g"]', el => el.hasAttribute('required'));
    assert(req, 'O 1º select (Grande área) deveria ter required — o campo é obrigatório em Áreas de atuação');
});

test('Área do conhecimento opcional (Formação acadêmica): o 1º select não tem required', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'FORMACAO');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'FORMACAO_ACADEMICA');
    await page.waitForTimeout(150);
    await page.selectOption('#dynFields select[name="nivel"]', 'Doutorado');
    await page.waitForTimeout(150);

    const req = await page.$eval('[data-areatree="g"]', el => el.hasAttribute('required'));
    assert(!req, 'O 1º select não deveria ter required — o campo não é obrigatório em Formação acadêmica');
});

test('Setores de atividade: os 3 selects têm aria-label próprio (Setor 1/2/3)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'FORMACAO');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'FORMACAO_ACADEMICA');
    await page.waitForTimeout(150);
    await page.selectOption('#dynFields select[name="nivel"]', 'Doutorado');
    await page.waitForTimeout(150);

    const labels = await page.$$eval('[data-setor]', els => els.map(e => e.getAttribute('aria-label')));
    assertEqual(labels, ['Setor 1', 'Setor 2', 'Setor 3']);
});
