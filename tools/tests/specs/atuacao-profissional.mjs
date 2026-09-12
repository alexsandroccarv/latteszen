/* ==========================================================================
   lattesZen — "03. Atuação → Atuação profissional": Tipo do vínculo como
   caixa de seleção, "Possui vínculo empregatício?" derivado desse Tipo, e
   Dedicação exclusiva como checkbox (a pedido do usuário).
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

test('Atuação profissional: Tipo do vínculo é uma caixa de seleção com as 6 opções pedidas', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'ATUACAO');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'VINCULO_PROFISSIONAL');
    await page.waitForTimeout(150);

    const tag = await page.$eval('#dynFields [name="vinculo"]', (el) => el.tagName);
    assertEqual(tag, 'SELECT', 'Tipo do vínculo deveria ser uma caixa de seleção (<select>), não texto livre');
    const opcoes = await page.$eval('#dynFields select[name="vinculo"]', (sel) => Array.from(sel.options).map((o) => o.value).filter(Boolean));
    assertEqual(opcoes.join(', '), 'Servidor público, Celetista, Professor visitante, Estudante, Bolsista, Outro',
        `Opções do Tipo do vínculo deveriam ser as 6 pedidas — obtida: ${JSON.stringify(opcoes)}`);
});

test('Atuação profissional: Servidor público ou Celetista força "Possui vínculo empregatício?" para Sim, travado', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'ATUACAO');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'VINCULO_PROFISSIONAL');
    await page.waitForTimeout(150);

    for (const tipo of ['Servidor público', 'Celetista']) {
        await page.selectOption('#dynFields select[name="vinculo"]', tipo);
        await page.waitForTimeout(100);
        const valor = await page.locator('#dynFields select[name="vinculoEmpregaticio"]').inputValue();
        assertEqual(valor, 'Sim', `Tipo "${tipo}" deveria forçar "Possui vínculo empregatício?" para Sim`);
        const travado = await page.$eval('#dynFields select[name="vinculoEmpregaticio"]', (el) => el.disabled);
        assert(travado, `"Possui vínculo empregatício?" deveria ficar travado (disabled) com Tipo "${tipo}"`);
    }
});

test('Atuação profissional: Professor visitante, Estudante, Bolsista ou Outro força "Possui vínculo empregatício?" para Não, travado', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'ATUACAO');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'VINCULO_PROFISSIONAL');
    await page.waitForTimeout(150);

    for (const tipo of ['Professor visitante', 'Estudante', 'Bolsista', 'Outro']) {
        await page.selectOption('#dynFields select[name="vinculo"]', tipo);
        await page.waitForTimeout(100);
        const valor = await page.locator('#dynFields select[name="vinculoEmpregaticio"]').inputValue();
        assertEqual(valor, 'Não', `Tipo "${tipo}" deveria forçar "Possui vínculo empregatício?" para Não`);
        const travado = await page.$eval('#dynFields select[name="vinculoEmpregaticio"]', (el) => el.disabled);
        assert(travado, `"Possui vínculo empregatício?" deveria ficar travado (disabled) com Tipo "${tipo}"`);
    }
});

test('Atuação profissional: Dedicação exclusiva é um checkbox (vazio = Não, marcado = Sim)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'ATUACAO');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'VINCULO_PROFISSIONAL');
    await page.waitForTimeout(150);

    const tipo = await page.$eval('#dynFields [name="dedicacaoExclusiva"]', (el) => el.type);
    assertEqual(tipo, 'checkbox', 'Dedicação exclusiva deveria ser um checkbox');

    await page.fill('#dynFields input[name="instituicao"]', 'Universidade Teste');
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);
    let salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').find((i) => i.typeKey === 'VINCULO_PROFISSIONAL'));
    assertEqual(salvo.fields.dedicacaoExclusiva, 'Não', 'Checkbox desmarcado deveria salvar Dedicação exclusiva como Não');

    await page.evaluate(() => window.AppCore.buildForm(window.AppCore.state.items.find((i) => i.id === window.AppCore.state.items.find((it) => it.typeKey === 'VINCULO_PROFISSIONAL').id)));
    await page.waitForTimeout(200);
    await page.check('#dynFields input[name="dedicacaoExclusiva"]');
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);
    salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').find((i) => i.typeKey === 'VINCULO_PROFISSIONAL'));
    assertEqual(salvo.fields.dedicacaoExclusiva, 'Sim', 'Checkbox marcado deveria salvar Dedicação exclusiva como Sim');
});

test('Atuação profissional: Carga horária semanal tem opção N/A', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'ATUACAO');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'VINCULO_PROFISSIONAL');
    await page.waitForTimeout(150);

    const naExiste = await page.$eval('#dynFields [data-na="cargaHoraria"]', (el) => el.type);
    assertEqual(naExiste, 'checkbox', 'Carga horária semanal deveria ter uma checkbox N/A ao lado');
});
