/* ==========================================================================
   Regressão: filtro de busca no seletor de Critério específico do RSC-PCCTAE
   (issue #24) — a lista tem ~50 critérios, rolar tudo pra achar um era ruim.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function habilitarRsc(page) {
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.rscEnabled = true;
        localStorage.setItem('lz_settings', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForTimeout(500);
}

test('Filtro do critério RSC restringe as opções conforme o usuário digita', async ({ page, baseUrl }) => {
    const items = [makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Filtro RSC', instituicao: 'X', anoFim: '2024' })];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('#itemList .bg-white.dark\\:bg-gray-800.border'));
        const card = cards.find((c) => c.textContent.includes('Curso Filtro RSC'));
        card.querySelector('[data-act="edit"]').click();
    });
    await page.waitForTimeout(300);

    await page.check('#rscConta');
    await page.waitForTimeout(150);

    const antesDoFiltro = await page.$$eval('#rscCrit option[value]:not([value=""])', (opts) => opts.length);
    assert(antesDoFiltro > 40, `Deveria listar todos os ~50 critérios sem filtro (obtido ${antesDoFiltro})`);

    // Digitar no filtro não deve marcar o formulário como alterado (não é dado
    // do item) — zera a flag (marcada ao marcar o checkbox acima) pra isolar.
    await page.evaluate(() => { window.AppCore.state.formDirty = false; });
    await page.fill('#rscCritFiltro', 'ano');
    await page.waitForTimeout(150);
    const formDirtyAposDigitar = await page.evaluate(() => window.AppCore.state.formDirty);
    assert(!formDirtyAposDigitar, 'Digitar no filtro do critério não deveria marcar o formulário como alterado');
    await page.fill('#rscCritFiltro', '');
    await page.waitForTimeout(150);

    await page.fill('#rscCritFiltro', 'premiação');
    await page.waitForTimeout(150);
    const depoisDoFiltro = await page.$$eval('#rscCrit option[value]:not([value=""])', (opts) => opts.map((o) => o.textContent));
    assertEqual(depoisDoFiltro.length, 3, 'Filtrar por "premiação" deveria restringir aos 3 critérios do Anexo III');
    assert(depoisDoFiltro.every((t) => /premiaç/i.test(t)), 'Todas as opções restantes deveriam mencionar "premiação"');

    // Seleciona um critério filtrado, depois limpa o filtro: a seleção deve sobreviver.
    await page.selectOption('#rscCrit', '3.2');
    await page.fill('#rscCritFiltro', '');
    await page.waitForTimeout(150);
    const valorAposLimpar = await page.$eval('#rscCrit', (el) => el.value);
    assertEqual(valorAposLimpar, '3.2', 'A seleção feita durante o filtro deveria sobreviver ao limpar o filtro');

    // Filtro sem nenhuma correspondência: seleção anterior é descartada (não fica "escondida").
    await page.fill('#rscCritFiltro', 'zzz_inexistente');
    await page.waitForTimeout(150);
    const valorSemCorrespondencia = await page.$eval('#rscCrit', (el) => el.value);
    assertEqual(valorSemCorrespondencia, '', 'Um filtro sem correspondência deveria limpar a seleção, não escondê-la');
    const semOpcoes = await page.$$eval('#rscCrit option[value]:not([value=""])', (opts) => opts.length);
    assertEqual(semOpcoes, 0, 'Sem correspondência, nenhuma opção selecionável deveria restar');
});
