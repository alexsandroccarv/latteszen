/* ==========================================================================
   lattesZen — Bancas (auditoria vs. Lattes real): Participação em bancas de
   trabalhos de conclusão e de comissões julgadoras.
   Ambos os tipos já estavam bem desenvolvidos (Natureza com as opções reais,
   Tipo só para Mestrado, Participantes da banca, Palavras-chave, Área do
   conhecimento) — faltava apenas Setores de atividade, confirmado no XSD/DTD
   para todos os elementos de Bancas mas nunca exportado.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function selecionar(page, categoriaTxt, tipoTxt) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    const catVal = await page.$eval('#selCategoria', (sel, txt) => Array.from(sel.options).find((o) => o.textContent.includes(txt))?.value, categoriaTxt);
    await page.selectOption('#selCategoria', catVal);
    await page.waitForTimeout(150);
    const tipoVal = await page.$eval('#selTipo', (sel, txt) => Array.from(sel.options).find((o) => o.textContent.includes(txt))?.value, tipoTxt);
    await page.selectOption('#selTipo', tipoVal);
    await page.waitForTimeout(150);
}

test('Participação em bancas de trabalhos de conclusão e de comissões julgadoras: ambas têm o campo Setores de atividade (antes ausente)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    for (const tipoTxt of ['bancas de trabalhos de conclusão', 'bancas de comissões julgadoras']) {
        await selecionar(page, 'Bancas', tipoTxt);
        const temSetores = await page.locator('[data-setor="1"]').count();
        assert(temSetores > 0, `${tipoTxt}: deveria ter o campo Setores de atividade`);
    }
});

test('Participação em bancas de trabalhos de conclusão: campos existentes continuam salvando corretamente junto com Setores de atividade', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Bancas', 'bancas de trabalhos de conclusão');

    await page.selectOption('select[name="tipo"]', 'Mestrado');
    await page.fill('input[name="titulo"]', 'Dissertação avaliada X');
    await page.fill('input[name="ano"]', '2022');
    await page.fill('input[name="candidato"]', 'Fulano de Tal');
    await page.fill('input[name="instituicao"]', 'UNIFESP');
    await page.fill('input[name="curso"]', 'PPG Medicina');
    await page.fill('textarea[name="membros"]', 'Membro Um; Membro Dois');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'BANCA_CONCLUSAO');
    assert(!!item, 'A participação em banca de conclusão deveria ter sido salva');
    assertEqual(item.fields.candidato, 'Fulano de Tal', 'Nome do candidato deveria ser salvo');
    assertEqual(item.fields.membros, 'Membro Um; Membro Dois', 'Participantes da banca deveria ser salvo');
});
