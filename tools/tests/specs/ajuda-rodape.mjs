/* ==========================================================================
   Regressão: rodapé consolidado das páginas estáticas — as duas entradas
   "Ajuda (Lattes)" e "Ajuda (RSC)" viraram um único link "Ajuda", apontando
   para a nova página-hub ajuda.html (Início Rápido, com chamadas para os
   dois guias específicos). O link "Notas de versão" saiu do rodapé — passou
   a viver dentro da aba Configurações, na seção "Sobre o lattesZen".
   ========================================================================== */
import { test, assert } from '../harness.mjs';

test('Rodapé do app tem um único link "Ajuda" (sem "Notas de versão")', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);

    const footerText = await page.evaluate(() => document.querySelector('footer').textContent);
    assert(!/Ajuda \(Lattes\)/.test(footerText), 'Rodapé não deveria mais ter "Ajuda (Lattes)" separado');
    assert(!/Ajuda \(RSC\)/.test(footerText), 'Rodapé não deveria mais ter "Ajuda (RSC)" separado');
    assert(!/Notas de versão/.test(footerText), '"Notas de versão" deveria ter saído do rodapé');

    const ajudaHref = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('footer a'));
        const a = links.find((l) => l.textContent.trim() === 'Ajuda');
        return a ? a.getAttribute('href') : null;
    });
    assert(ajudaHref === './ajuda.html', `O link "Ajuda" do rodapé deveria apontar para ./ajuda.html — obtido "${ajudaHref}"`);
});

test('Página ajuda.html (Início Rápido) linka para os dois guias específicos', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/ajuda.html');
    await page.waitForTimeout(300);

    const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll('main a')).map((a) => a.getAttribute('href')));
    assert(hrefs.includes('ajuda-lattes.html'), 'ajuda.html deveria linkar para ajuda-lattes.html');
    assert(hrefs.includes('ajuda-rsc.html'), 'ajuda.html deveria linkar para ajuda-rsc.html');

    const h1 = await page.evaluate(() => document.querySelector('main h1')?.textContent || '');
    assert(/Início Rápido/.test(h1), `Título principal deveria mencionar "Início Rápido" — obtido "${h1}"`);
});

test('Configurações tem um link para as notas de versão', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(300);

    const href = await page.evaluate(() => {
        const a = document.querySelector('#tab-config a[href="notas-de-versao.html"]');
        return a ? a.getAttribute('href') : null;
    });
    assert(href === 'notas-de-versao.html', 'A aba Configurações deveria ter um link para notas-de-versao.html');
});
