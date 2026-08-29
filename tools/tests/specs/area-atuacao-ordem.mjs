/* ==========================================================================
   lattesZen — Áreas de atuação: reordenar (▲▼) a lista em Configurações.
   Ajuste da auditoria contra docs/mapeamento-campos-lattes.md (3.7.1 —
   "controle de ordem por setas"), que a tela real do Lattes tem e o
   lattesZen ainda não tinha (só permitia adicionar/editar/remover).
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

test('Áreas de atuação: setas ▲▼ reordenam a lista e persistem a nova ordem', async ({ page, baseUrl }) => {
    const items = [
        makeItem('AREA_ATUACAO', 'ATUACAO', { grandeArea: 'Ciências da Saúde', area: 'Medicina', subarea: '', especialidade: '' }),
        makeItem('AREA_ATUACAO', 'ATUACAO', { grandeArea: 'Ciências Sociais Aplicadas', area: 'Direito', subarea: '', especialidade: '' }),
        makeItem('AREA_ATUACAO', 'ATUACAO', { grandeArea: 'Ciências Exatas e da Terra', area: 'Física', subarea: '', especialidade: '' }),
    ];
    await seedCatalog(page, baseUrl, items);

    await page.click('[data-tab="config"]');
    await page.waitForTimeout(300);
    await page.click('#perfilSection summary:has-text("Áreas de atuação")');
    await page.waitForTimeout(200);

    const ordemInicial = await page.locator('#areaAtuacaoList li span.flex-1').allTextContents();
    assertEqual(ordemInicial.map((t) => t.trim()), ['Ciências da Saúde > Medicina', 'Ciências Sociais Aplicadas > Direito', 'Ciências Exatas e da Terra > Física'],
        `Ordem inicial incorreta — obtida: ${JSON.stringify(ordemInicial)}`);

    // Primeira linha não tem "Subir" habilitado.
    const primeiraSubir = await page.locator('#areaAtuacaoList li').first().locator('[data-area-up]');
    assert(await primeiraSubir.isDisabled(), 'O botão "Subir" da primeira área deveria estar desabilitado');

    // Sobe "Direito" (2ª linha) para o topo.
    await page.locator('#areaAtuacaoList li', { hasText: 'Direito' }).locator('[data-area-up]').click();
    await page.waitForTimeout(200);

    const ordemDepois = await page.locator('#areaAtuacaoList li span.flex-1').allTextContents();
    assertEqual(ordemDepois.map((t) => t.trim()), ['Ciências Sociais Aplicadas > Direito', 'Ciências da Saúde > Medicina', 'Ciências Exatas e da Terra > Física'],
        `Ordem após subir "Direito" incorreta — obtida: ${JSON.stringify(ordemDepois)}`);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const areasSalvas = salvo.filter((i) => i.typeKey === 'AREA_ATUACAO').map((i) => i.fields.area);
    assertEqual(areasSalvas, ['Direito', 'Medicina', 'Física'], `A nova ordem deveria ter sido persistida no catálogo — obtida: ${JSON.stringify(areasSalvas)}`);
});
