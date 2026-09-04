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
