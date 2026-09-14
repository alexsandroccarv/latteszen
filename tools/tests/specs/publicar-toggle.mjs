/* ==========================================================================
   Regressão: checkbox "Habilitar aba Publicar na Web" em Configurações —
   mesmo mecanismo do módulo RSC/Súmula (checkbox mostra/oculta a aba):
   padrão desmarcada/desabilitada na primeira utilização (opt-in), e fica
   como a pessoa deixou até ser trocada de novo.

   Exceção: quem já tinha itens cadastrados ANTES dessa mudança de padrão
   (pubWebEnabled nunca foi salvo, mas já existem itens no catálogo) é
   tratado como já habilitado — a aba não pode sumir de quem já publicava
   só por causa da atualização.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog, makeItem } from '../harness.mjs';

test('Catálogo vazio (primeira utilização): "Publicar na Web" começa desmarcada/oculta', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const visivel = await page.evaluate(() => !document.querySelector('.tab-btn[data-tab="publicar"]').classList.contains('hidden'));
    assert(!visivel, 'Numa primeira utilização (sem itens, nada salvo ainda), a aba Publicar deveria começar oculta');

    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    assertEqual(await page.locator('#pubWebEnable').count(), 1, 'O checkbox deveria existir em Configurações');
    const marcado = await page.isChecked('#pubWebEnable');
    assert(!marcado, 'O checkbox deveria vir desmarcado por padrão, como RSC e Súmula FAPESP');
});

test('Catálogo com itens já cadastrados (instalação anterior a este padrão): "Publicar na Web" continua habilitada', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, [makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Item de teste', ano: '2024' })]);
    const visivel = await page.evaluate(() => !document.querySelector('.tab-btn[data-tab="publicar"]').classList.contains('hidden'));
    assert(visivel, 'Com itens já cadastrados e pubWebEnabled nunca salvo, a aba Publicar deveria continuar habilitada (não quebra quem já usava)');

    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    const marcado = await page.isChecked('#pubWebEnable');
    assert(marcado, 'O checkbox deveria vir marcado para quem já tinha itens antes desse padrão mudar');
});

test('Marcar o checkbox habilita a aba "Publicar na Web" na hora; desmarcar de novo a esconde', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);

    await page.click('#pubWebEnable'); // marca
    await page.waitForTimeout(150);
    const visivel = await page.evaluate(() => !document.querySelector('.tab-btn[data-tab="publicar"]').classList.contains('hidden'));
    assert(visivel, 'Marcar o checkbox deveria mostrar a aba Publicar imediatamente');
    const toasts1 = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts1.some((t) => /habilitada/i.test(t)), 'Deveria confirmar que a aba foi habilitada');
    const salvoHabilitado = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').pubWebEnabled);
    assertEqual(salvoHabilitado, true, 'pubWebEnabled: true deveria estar salvo em Configurações');

    await page.click('#pubWebEnable'); // desmarca de novo
    await page.waitForTimeout(150);
    const escondidaDeNovo = await page.evaluate(() => document.querySelector('.tab-btn[data-tab="publicar"]').classList.contains('hidden'));
    assert(escondidaDeNovo, 'Desmarcar o checkbox de novo deveria esconder a aba imediatamente');
});

test('Habilitar e recarregar a página: a aba continua visível (fica acionada até ser desmarcada, mesmo padrão de RSC/Súmula)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('#pubWebEnable');
    await page.waitForTimeout(150);

    await page.reload();
    await page.waitForTimeout(500);
    const visivel = await page.evaluate(() => !document.querySelector('.tab-btn[data-tab="publicar"]').classList.contains('hidden'));
    assert(visivel, 'Depois de recarregar, a aba Publicar deveria continuar visível (preferência persistida)');
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    const marcado = await page.isChecked('#pubWebEnable');
    assert(marcado, 'O checkbox também deveria continuar marcado depois de recarregar');
});
