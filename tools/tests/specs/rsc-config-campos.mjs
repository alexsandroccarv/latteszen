/* ==========================================================================
   Regressão: Configurações → RSC — remoção do campo "Classe / nível"
   (redundante com o seletor "Nível de Classificação", que é o que de fato
   marca a caixinha no formulário .docx oficial) e separação do campo único
   "Telefone / E-mail" em dois campos distintos.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

test('RSC: campo "Classe / nível" não existe mais; "Telefone" e "E-mail" são campos separados', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('#rscEnable');
    await page.waitForTimeout(100);

    assertEqual(await page.locator('#rsc-classe').count(), 0, 'O campo "Classe / nível" não deveria mais existir');
    assertEqual(await page.locator('#rsc-telefoneEmail').count(), 0, 'O campo único "Telefone / E-mail" não deveria mais existir');
    assertEqual(await page.locator('#rsc-telefone').count(), 1, 'Deveria existir um campo "Telefone" separado');
    assertEqual(await page.locator('#rsc-email').count(), 1, 'Deveria existir um campo "E-mail" separado');
    assertEqual(await page.locator('#rsc-nivelClassificacao').count(), 1, 'O seletor "Nível de Classificação" (A-E) deveria continuar existindo');

    await page.fill('#rsc-telefone', '(11) 1234-5678');
    await page.fill('#rsc-email', 'fulano@instituicao.br');
    await page.click('#btnSaveRsc');
    await page.waitForTimeout(200);

    const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').rsc || {});
    assertEqual(cfg.telefone, '(11) 1234-5678', 'Telefone deveria ser salvo separadamente');
    assertEqual(cfg.email, 'fulano@instituicao.br', 'E-mail deveria ser salvo separadamente');
    assert(!('classe' in cfg), 'A configuração salva não deveria mais ter a chave "classe"');
    assert(!('telefoneEmail' in cfg), 'A configuração salva não deveria mais ter a chave única "telefoneEmail"');
});

test('RSC: valor antigo de "Telefone/E-mail" migra pra exibição nos 2 campos novos', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.rscEnabled = true;
        s.rsc = { cargo: 'Assistente em Administração', telefoneEmail: '(11) 1234-5678 / fulano@instituicao.br' };
        localStorage.setItem('lz_settings', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForTimeout(500);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);

    const telefone = await page.locator('#rsc-telefone').inputValue();
    const email = await page.locator('#rsc-email').inputValue();
    assertEqual(telefone, '(11) 1234-5678', 'Telefone deveria vir pré-preenchido a partir do valor antigo combinado');
    assertEqual(email, 'fulano@instituicao.br', 'E-mail deveria vir pré-preenchido a partir do valor antigo combinado');
});
