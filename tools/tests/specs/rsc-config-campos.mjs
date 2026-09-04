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

test('RSC: campo "Matrícula ou Funcional" existe logo após o SIAPE e salva corretamente', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('#rscEnable');
    await page.waitForTimeout(100);
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(200);

    assertEqual(await page.locator('#rsc-matriculaFuncional').count(), 1, 'Deveria existir um campo "Matrícula ou Funcional"');
    const ordem = await page.evaluate(() => Array.from(document.querySelectorAll('#tab-rsc input[id^="rsc-"]')).map((el) => el.id));
    const iSiape = ordem.indexOf('rsc-siape'), iMatricula = ordem.indexOf('rsc-matriculaFuncional');
    assert(iSiape > -1 && iMatricula === iSiape + 1, 'O campo "Matrícula ou Funcional" deveria vir logo após o SIAPE');

    await page.fill('#rsc-matriculaFuncional', '12345-6');
    await page.click('#btnSaveRscCfg');
    await page.waitForTimeout(200);
    const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').rsc || {});
    assertEqual(cfg.matriculaFuncional, '12345-6', 'Matrícula/Funcional deveria ser salva');
});

test('RSC: "Salvar" bloqueia com e-mail, data incompleta ou telefone sem DDD inválidos; corrigidos, salva normalmente', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('#rscEnable');
    await page.waitForTimeout(100);
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(200);

    await page.fill('#rsc-email', 'fulano@');
    await page.fill('#rsc-ingresso', '25/12'); // data incompleta
    await page.fill('#rsc-telefone', '1234-5678'); // sem DDD
    // Blur do último campo ANTES de clicar em Salvar: a validação no blur
    // insere uma mensagem de erro que desloca o layout — sem isso, esse
    // deslocamento aconteceria bem no meio do clique (foco ainda no
    // telefone), podendo fazer o clique errar o botão.
    await page.locator('#rsc-telefone').evaluate((el) => el.blur());
    await page.waitForTimeout(150);
    await page.click('#btnSaveRscCfg');
    await page.waitForTimeout(200);

    const toasts1 = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts1.some((t) => /corrija os campos/i.test(t)), 'Deveria avisar que há campos inválidos e não salvar');
    const cfgInvalido = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').rsc || {});
    assert(!cfgInvalido.email, 'Não deveria ter salvo com e-mail inválido');
    const emailInvalid = await page.evaluate(() => document.getElementById('rsc-email').getAttribute('aria-invalid'));
    assertEqual(emailInvalid, 'true', 'O campo de e-mail deveria ficar marcado como inválido');

    await page.fill('#rsc-email', 'fulano@instituicao.br');
    await page.fill('#rsc-ingresso', '25/12/2026');
    await page.fill('#rsc-telefone', '+55 (11) 91234-5678'); // DDI opcional + DDD
    await page.locator('#rsc-telefone').evaluate((el) => el.blur());
    await page.waitForTimeout(150);
    await page.click('#btnSaveRscCfg');
    await page.waitForTimeout(200);

    const toasts2 = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts2.some((t) => /configuração do rsc salva/i.test(t)), 'Corrigidos os campos, deveria salvar normalmente');
    const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').rsc || {});
    assertEqual(cfg.email, 'fulano@instituicao.br', 'E-mail corrigido deveria ser salvo');
    assertEqual(cfg.ingresso, '25/12/2026', 'Data corrigida deveria ser salva');
    assertEqual(cfg.telefone, '+55 (11) 91234-5678', 'Telefone com DDI deveria ser aceito e salvo');
});

test('RSC: data inválida em "Data de abrangência (final)" também é bloqueada (mesma validação dos outros 2 campos de data)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('#rscEnable');
    await page.waitForTimeout(100);
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(200);

    await page.fill('#rsc-dataAbrangenciaFinal', '31/02/2026'); // 31 de fevereiro não existe
    await page.locator('#rsc-dataAbrangenciaFinal').evaluate((el) => el.blur());
    await page.waitForTimeout(150);
    await page.click('#btnSaveRscCfg');
    await page.waitForTimeout(200);

    const invalid = await page.evaluate(() => document.getElementById('rsc-dataAbrangenciaFinal').getAttribute('aria-invalid'));
    assertEqual(invalid, 'true', 'Data de calendário inexistente deveria ser rejeitada');
    const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').rsc || {});
    assert(!cfg.dataAbrangenciaFinal, 'Não deveria ter salvo a data inexistente');
});
