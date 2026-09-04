/* ==========================================================================
   Regressão: campos de dados do servidor do RSC — vivem na própria aba RSC
   (não mais em Configurações, só o "Habilitar módulo" fica lá — issue de
   usabilidade). Cobre também a remoção do campo "Classe / nível" (redundante
   com o seletor "Nível de Classificação", que é o que de fato marca a
   caixinha no formulário .docx oficial) e a separação do campo único
   "Telefone / E-mail" em dois campos distintos.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

test('Configurações → RSC só tem o "Habilitar módulo" — os campos do servidor moraram na aba RSC', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);

    assertEqual(await page.locator('#rscEnable').count(), 1, 'O checkbox "Habilitar módulo RSC-PCCTAE" deveria continuar em Configurações');
    assertEqual(await page.locator('#rsc-cargo').count(), 0, 'O campo "Cargo" não deveria mais estar em Configurações');
    assertEqual(await page.locator('#rsc-telefone').count(), 0, 'O campo "Telefone" não deveria mais estar em Configurações');
    assertEqual(await page.locator('#btnSaveRsc').count(), 0, 'O antigo botão "Salvar RSC" não deveria mais existir em Configurações');

    await page.click('#rscEnable');
    await page.waitForTimeout(200);
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /módulo rsc habilitado/i.test(t)), 'Marcar o checkbox deveria habilitar e salvar na hora (sem precisar de botão "Salvar")');

    const habilitado = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').rscEnabled);
    assert(habilitado === true, 'rscEnabled deveria estar salvo em Configurações');
});

test('RSC: campo "Classe / nível" não existe; "Telefone" e "E-mail" são campos separados na aba RSC', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('#rscEnable');
    await page.waitForTimeout(100);
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(200);

    assertEqual(await page.locator('#rsc-classe').count(), 0, 'O campo "Classe / nível" não deveria mais existir');
    assertEqual(await page.locator('#rsc-telefoneEmail').count(), 0, 'O campo único "Telefone / E-mail" não deveria mais existir');
    assertEqual(await page.locator('#rsc-telefone').count(), 1, 'Deveria existir um campo "Telefone" separado na aba RSC');
    assertEqual(await page.locator('#rsc-email').count(), 1, 'Deveria existir um campo "E-mail" separado na aba RSC');
    assertEqual(await page.locator('#rsc-nivelClassificacao').count(), 1, 'O seletor "Nível de Classificação" (A-E) deveria continuar existindo');

    await page.fill('#rsc-telefone', '(11) 1234-5678');
    await page.fill('#rsc-email', 'fulano@instituicao.br');
    await page.click('#btnSaveRscCfg');
    await page.waitForTimeout(200);

    const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').rsc || {});
    assertEqual(cfg.telefone, '(11) 1234-5678', 'Telefone deveria ser salvo separadamente');
    assertEqual(cfg.email, 'fulano@instituicao.br', 'E-mail deveria ser salvo separadamente');
    assert(!('classe' in cfg), 'A configuração salva não deveria mais ter a chave "classe"');
    assert(!('telefoneEmail' in cfg), 'A configuração salva não deveria mais ter a chave única "telefoneEmail"');
});

test('RSC: valor antigo de "Telefone/E-mail" migra pra exibição nos 2 campos novos, na aba RSC', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.rscEnabled = true;
        s.rsc = { cargo: 'Assistente em Administração', telefoneEmail: '(11) 1234-5678 / fulano@instituicao.br' };
        localStorage.setItem('lz_settings', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForTimeout(500);
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(200);

    const telefone = await page.locator('#rsc-telefone').inputValue();
    const email = await page.locator('#rsc-email').inputValue();
    assertEqual(telefone, '(11) 1234-5678', 'Telefone deveria vir pré-preenchido a partir do valor antigo combinado');
    assertEqual(email, 'fulano@instituicao.br', 'E-mail deveria vir pré-preenchido a partir do valor antigo combinado');
});
