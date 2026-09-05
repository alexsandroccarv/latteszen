/* ==========================================================================
   Regressão: aba RSC-PCCTAE (simulador)
   --------------------------------------------------------------------------
   Terceira aba extraída de app.js (tab-rsc.js) — não existia cobertura da
   TELA do simulador em si antes (só um chip da Conformidade). Cobre: aviso
   de módulo desabilitado e renderização do nível/pontos com um item
   contabilizado.
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

test('Módulo RSC desabilitado mostra aviso em vez do simulador', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    // A aba RSC fica com a classe "hidden" (Tailwind) quando o módulo está
    // desabilitado — um usuário real não consegue clicar nela nesse estado.
    // Troca de aba direto via AppCore.switchTab (o mesmo switchTab usado pelo
    // clique normal) pra testar o render() do módulo, não a visibilidade do botão.
    await page.evaluate(() => window.AppCore.switchTab('rsc'));
    await page.waitForTimeout(200);
    const texto = await page.$eval('#tab-rsc', (el) => el.textContent);
    assert(texto.includes('Módulo RSC desabilitado'), 'Sem o módulo habilitado, deveria mostrar o aviso, não o simulador');
});

test('Aba RSC calcula pontos e lista o item contabilizado', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso RSC Teste', instituicao: 'X', anoFim: '2024' },
            { rsc: { conta: true, criterio: '1.3', jaUsado: false } }),
    ];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page);
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);

    const texto = await page.$eval('#tab-rsc', (el) => el.textContent);
    assert(texto.includes('Nível alcançável'), 'Deveria mostrar o cartão de nível alcançável');
    assert(texto.includes('Curso RSC Teste'), 'O item contabilizado deveria aparecer na lista');
    assert(/\b3\b/.test(texto), 'Os 3 pontos do critério 1.3 deveriam aparecer em algum lugar da tela');
});

test('RSC: "Itens contabilizados" lista cada item como "ano - nome/descrição"', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso RSC Teste', instituicao: 'X', anoFim: '2024' },
            { rsc: { conta: true, criterio: '1.3', jaUsado: false } }),
    ];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page);
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);

    const texto = await page.$eval('#tab-rsc', (el) => el.textContent);
    assert(texto.includes('2024 - Curso RSC Teste'), 'O item deveria aparecer prefixado pelo ano ("2024 - Curso RSC Teste")');
});

test('RSC: "Itens contabilizados" agrupa em 3 níveis — Requisito > Critério > itens (critério aparece uma única vez por grupo)', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso A', instituicao: 'X', anoFim: '2023' },
            { rsc: { conta: true, criterio: '1.3', jaUsado: false } }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso B', instituicao: 'X', anoFim: '2024' },
            { rsc: { conta: true, criterio: '1.3', jaUsado: false } }),
    ];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page);
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);

    const html = await page.$eval('#tab-rsc', (el) => el.innerHTML);
    const iReq = html.indexOf('I — Grupos, comissões, comitês e representações');
    const iCrit = html.indexOf('3. Participação como membro de núcleos');
    const iCursoA = html.indexOf('2023 - Curso A');
    const iCursoB = html.indexOf('2024 - Curso B');
    assert(iReq > -1 && iCrit > -1 && iCursoA > -1 && iCursoB > -1, 'Deveria haver o Requisito, o Critério e os 2 itens no HTML');
    assert(iReq < iCrit && iCrit < iCursoA && iCrit < iCursoB, 'A ordem no HTML deveria ser: Requisito, depois Critério, depois os itens');

    const ocorrenciasCriterio = html.split('3. Participação como membro de núcleos').length - 1;
    assertEqual(ocorrenciasCriterio, 1, 'A descrição do critério deveria aparecer uma única vez por grupo, não repetida em cada item');
});
