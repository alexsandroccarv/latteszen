/* ==========================================================================
   Regressão: itens de Atuação "Atual" (em exercício, sem data de fim própria)
   usam a "Data de abrangência (final)" configurada em Configurações › RSC
   como fim efetivo do período, para contar o tempo decorrido (issue #27).
   Sem essa configuração, o item cai no fallback manual (quantidade "1" fixa,
   independente de há quanto tempo já dura).
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function habilitarRsc(page, dataAbrangenciaFinal) {
    await page.evaluate((data) => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.rscEnabled = true;
        s.rsc = Object.assign({}, s.rsc, data ? { dataAbrangenciaFinal: data } : {});
        localStorage.setItem('lz_settings', JSON.stringify(s));
    }, dataAbrangenciaFinal || null);
    await page.reload();
    await page.waitForTimeout(500);
}

async function abrirESelecionarCriterio(page, baseUrl, titulo, dataAbrangenciaFinal) {
    const items = [makeItem('ATIV_DIRECAO', 'ATUACAO', {
        titulo, instituicao: 'X', anoInicio: '01/2023', situacao: 'Atual (não finalizado)',
    })];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page, dataAbrangenciaFinal);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    await page.evaluate((t) => {
        const cards = Array.from(document.querySelectorAll('#itemList .bg-white.dark\\:bg-gray-800.border'));
        const card = cards.find((c) => c.textContent.includes(t));
        card.querySelector('[data-act="edit"]').click();
    }, titulo);
    await page.waitForTimeout(300);
    await page.check('#rscConta');
    await page.waitForTimeout(150);
    await page.click('#rscCritFiltro');
    await page.click('#rscCritLista [data-crit="5.3"]'); // 4,5 pts/ano, "por ano ou fração > 6 meses"
    await page.waitForTimeout(150);
}

test('Sem "Data de abrangência (final)" configurada, item "Atual" usa a quantidade manual padrão (1)', async ({ page, baseUrl }) => {
    await abrirESelecionarCriterio(page, baseUrl, 'Cargo Atual Sem Config', null);
    const texto = await page.$eval('#rscPontos', (el) => el.textContent);
    assert(texto.includes('4,5') && texto.includes('1 ×'), `Sem data de abrangência configurada, deveria cair no padrão manual (1 × 4,5) — obtido "${texto}"`);
});

test('Com "Data de abrangência (final)" configurada, item "Atual" tem o tempo decorrido contado', async ({ page, baseUrl }) => {
    // Início em 01/2023, abrangência até 15/08/2025: ~31 meses = 2 anos +
    // fração de 7 meses (> 6) = quantidade 3 → 3 × 4,5 = 13,5 pts.
    await abrirESelecionarCriterio(page, baseUrl, 'Cargo Atual Com Config', '15/08/2025');
    const texto = await page.$eval('#rscPontos', (el) => el.textContent);
    assert(texto.includes('13,5') && texto.includes('3 ×'), `Deveria contar 3 anos/frações até a data de abrangência (3 × 4,5 = 13,5) — obtido "${texto}"`);
});
