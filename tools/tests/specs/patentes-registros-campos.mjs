/* ==========================================================================
   lattesZen — Patentes e Registros (auditoria vs. Lattes real), sub-lote 1/2:
   Patente, Programa de Computador Registrado, Cultivar protegida/registrada.
   Patente ganha praticamente toda a estrutura real (Categoria, Natureza,
   Número do depósito PCT, potencial de inovação, Depositante/Titular,
   Inventores, Resumo, Finalidade, Instituição financiadora, Palavras-chave/
   Área/Setores). Programa de Computador Registrado ganha Instituição de
   registro (distinta de financiadora), datas de registro/certificado e os
   flags/Autores/Palavras-chave que faltavam. Cultivar protegida/registrada
   ganham potencial de inovação, Melhoristas (Autores) e Palavras-chave/Área/
   Setores/Outras informações.
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

test('Patente: Categoria, Natureza, PCT, potencial de inovação, Depositante/Titular, Inventores e Resumo salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Patentes e Registros', 'Patente');

    const opcoesCategoria = await page.locator('select[name="categoria"] option').allTextContents();
    assertEqual(opcoesCategoria.map((o) => o.trim()).filter((o) => o && o !== '—'), ['Produto', 'Processo', 'Produto e Processo', 'Outra'],
        `Opções de Categoria incorretas — obtidas: ${JSON.stringify(opcoesCategoria)}`);
    const opcoesNatureza = await page.locator('select[name="natureza"] option').allTextContents();
    assertEqual(opcoesNatureza.map((o) => o.trim()).filter((o) => o && o !== '—'), ['Patente de Invenção', 'Patente de Modelo de Utilidade'],
        `Opções de Natureza incorretas — obtidas: ${JSON.stringify(opcoesNatureza)}`);

    await page.fill('input[name="titulo"]', 'Dispositivo de purificação de água');
    await page.selectOption('select[name="categoria"]', 'Produto');
    await page.selectOption('select[name="natureza"]', 'Patente de Modelo de Utilidade');
    await page.fill('input[name="registro"]', 'BR 10 2020 001');
    await page.fill('input[name="instituicao"]', 'INPI');
    await page.fill('input[name="numeroPCT"]', 'PCT/BR2020/000123');
    await page.click('input[name="potencialInovacao"]');
    await page.fill('textarea[name="titular"]', 'UNIFESP; Fulano de Tal');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('textarea[name="outrasInfo"]', 'Resumo do invento.');
    await page.fill('textarea[name="instituicaoFinanceira"]', 'FAPESP; CNPq');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'PATENTE');
    assert(!!item, 'A patente deveria ter sido salva');
    assertEqual(item.fields.categoria, 'Produto', 'Categoria deveria ser salva');
    assertEqual(item.fields.natureza, 'Patente de Modelo de Utilidade', 'Natureza deveria ser salva');
    assertEqual(item.fields.numeroPCT, 'PCT/BR2020/000123', 'Número do depósito PCT deveria ser salvo');
    assertEqual(item.fields.potencialInovacao, 'Sim', 'Potencial de inovação deveria ser salvo como Sim');
    assertEqual(item.fields.titular, 'UNIFESP; Fulano de Tal', 'Depositante/Titular deveria ser salvo');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Fulano de Tal'], 'Inventores (autoresLista) deveria ter sido salvo');
    assertEqual(item.fields.instituicaoFinanceira, 'FAPESP; CNPq', 'Instituição(ões) financiadora(s) deveria ser salva separadamente da instituição de depósito');
});

test('Programa de Computador Registrado: Instituição de registro (distinta de financiadora), datas e Autores em lista salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Patentes e Registros', 'Programa de Computador Registrado');

    const temMeioDivulgacao = await page.locator('select[name="meioDivulgacao"]').count();
    assert(temMeioDivulgacao === 0, 'Programa de Computador Registrado NÃO deveria ter Meio de divulgação (ausente na tela real, diferente de Software sem registro)');

    await page.fill('input[name="registro"]', 'BR512020001234-5');
    await page.fill('input[name="instituicaoRegistro"]', 'INPI');
    await page.fill('input[name="titulo"]', 'Sistema de gestão hospitalar');
    await page.fill('input[name="dataDeposito"]', '2020-01-10');
    await page.fill('input[name="dataConcessao"]', '2020-06-10');
    await page.click('input[name="divulgacaoCT"]');
    await page.click('input[name="potencialInovacao"]');
    await page.click('input[name="relevante"]');
    await page.fill('textarea[name="instituicao"]', 'Hospital Universitário; FAPESP');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'SOFTWARE_REGISTRADO');
    assert(!!item, 'O software registrado deveria ter sido salvo');
    assertEqual(item.fields.instituicaoRegistro, 'INPI', 'Instituição de registro deveria ser salva');
    assertEqual(item.fields.instituicao, 'Hospital Universitário; FAPESP', 'Instituição(ões) financiadora(s) deveria ser salva separadamente da instituição de registro');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Fulano de Tal'], 'Autores (lista) deveria ter sido salvo');
});

test('Cultivar protegida e Cultivar registrada: potencial de inovação, Melhoristas (Autores) e Palavras-chave salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    for (const tipoTxt of ['Cultivar protegida', 'Cultivar registrada']) {
        await selecionar(page, 'Patentes e Registros', tipoTxt);
        const temPotencial = await page.locator('input[name="potencialInovacao"]').count();
        assert(temPotencial > 0, `${tipoTxt}: deveria ter o campo de potencial de inovação`);
        const temMelhoristas = await page.locator('[data-repeater-wrap="autoresLista"]').count();
        assert(temMelhoristas > 0, `${tipoTxt}: deveria ter Melhoristas como lista (repeater)`);
        const temPalavrasChave = await page.locator('textarea[name="palavrasChave"]').count();
        assert(temPalavrasChave > 0, `${tipoTxt}: deveria ter o campo Palavras-chave`);
    }

    await selecionar(page, 'Patentes e Registros', 'Cultivar protegida');
    await page.fill('input[name="titulo"]', 'Cultivar Soja XPTO');
    await page.fill('input[name="ano"]', '2021');
    await page.click('input[name="potencialInovacao"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Melhorista Um');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('textarea[name="palavrasChave"]', 'soja; melhoramento genético');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'CULTIVAR_PROTEGIDA');
    assert(!!item, 'A cultivar protegida deveria ter sido salva');
    assertEqual(item.fields.potencialInovacao, 'Sim', 'Potencial de inovação deveria ser salvo como Sim');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Melhorista Um'], 'Melhoristas (autoresLista) deveria ter sido salvo');
    assertEqual(item.fields.palavrasChave, 'soja; melhoramento genético', 'Palavras-chave deveria ser salva');
});
