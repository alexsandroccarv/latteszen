/* ==========================================================================
   Regressão: toasts de erro/aviso ficam na tela até serem fechados
   --------------------------------------------------------------------------
   Antes, TODO toast (inclusive erro) sumia sozinho em ~3,7s — curto demais
   pra ler (ou copiar) uma mensagem de erro mais longa, como a de "Falha ao
   gerar o relatório: <mensagem técnica>". erro/aviso agora ficam até um
   clique manual no "×"; ok/info continuam confirmando e sumindo rápido.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

test('Toast de erro/aviso fica na tela além do tempo antigo de auto-sumiço; ok some sozinho', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.evaluate(() => {
        window.AppCore.toast('Uma confirmação normal.', 'ok');
        window.AppCore.toast('Um erro que precisa de tempo pra ler.', 'erro');
    });
    // Passa do antigo timeout fixo de auto-remoção (3,7s) com folga.
    await page.waitForTimeout(4200);
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(!toasts.some((t) => /confirmação normal/.test(t)), 'O toast "ok" deveria ter sumido sozinho, como sempre');
    assert(toasts.some((t) => /erro que precisa de tempo/.test(t)), 'O toast de erro NÃO deveria ter sumido sozinho — precisa continuar visível até ser fechado');
});

test('Toast de erro tem um botão de fechar acessível, que remove só aquele toast', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.evaluate(() => {
        window.AppCore.toast('Primeiro erro.', 'erro');
        window.AppCore.toast('Segundo erro.', 'erro');
    });
    await page.waitForTimeout(200);
    const botoesFechar = await page.locator('#toasts button[aria-label="Fechar aviso"]').count();
    assertEqual(botoesFechar, 2, 'Cada toast de erro deveria ter seu próprio botão de fechar');

    await page.locator('#toasts button[aria-label="Fechar aviso"]').first().click();
    await page.waitForTimeout(100);
    const restantes = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assertEqual(restantes.length, 1, 'Fechar um toast não deveria remover o outro');
    assert(restantes[0].includes('Segundo erro'), 'O toast restante deveria ser o segundo (o primeiro foi fechado)');
});

test('Toast "info"/"ok" continua sem botão de fechar (confirmação rápida, não precisa de ação manual)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.evaluate(() => window.AppCore.toast('Salvo com sucesso.', 'ok'));
    await page.waitForTimeout(200);
    const botoesFechar = await page.locator('#toasts button[aria-label="Fechar aviso"]').count();
    assertEqual(botoesFechar, 0, 'Um toast "ok" não deveria ter botão de fechar');
});
