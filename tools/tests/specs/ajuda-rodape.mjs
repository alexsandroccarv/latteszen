/* ==========================================================================
   Regressão: rodapé consolidado das páginas estáticas — as duas entradas
   "Ajuda (Lattes)" e "Ajuda (RSC)" viraram um único link "Ajuda", apontando
   para a nova página-hub ajuda.html (Início Rápido, com chamadas para os
   dois guias específicos). O link "Notas de versão" saiu do rodapé — passou
   a viver dentro da aba Configurações, na seção "Sobre o lattesZen". Os
   alternadores de "Tema escuro/claro" e "Alto contraste" viraram somente
   ícone (o texto vira <span class="sr-only">, mantendo a acessibilidade sem
   ocupar espaço visual), e o link "Ajuda" ganhou um ícone de interrogação.
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

test('Tema e Alto contraste ficam só com ícone no rodapé; "Ajuda" ganha ícone de interrogação', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
        const visible = (el) => {
            // Texto visível = nós de texto diretos fora de elementos .sr-only.
            let t = '';
            el.childNodes.forEach((n) => {
                if (n.nodeType === Node.TEXT_NODE) t += n.textContent;
            });
            return t.trim();
        };
        const theme = document.querySelector('#themeToggle');
        const hc = document.querySelector('#highContrastToggle');
        const ajuda = Array.from(document.querySelectorAll('footer a')).find((a) => a.textContent.trim() === 'Ajuda');
        return {
            themeVisibleText: theme ? visible(theme) : null,
            themeHasIcon: !!(theme && theme.querySelector('i.fa-moon, i.fa-sun')),
            themeSrOnlyText: theme ? (theme.querySelector('.sr-only')?.textContent || null) : null,
            hcVisibleText: hc ? visible(hc) : null,
            hcHasIcon: !!(hc && hc.querySelector('i.fa-circle-half-stroke')),
            ajudaHasQuestionIcon: !!(ajuda && ajuda.querySelector('i.fa-circle-question')),
        };
    });

    assert(info.themeVisibleText === '', `Botão de tema não deveria ter texto visível fora do ícone — obtido "${info.themeVisibleText}"`);
    assert(info.themeHasIcon, 'Botão de tema deveria manter o ícone de lua/sol');
    assert(info.themeSrOnlyText, 'Botão de tema deveria manter o rótulo em .sr-only para acessibilidade');
    assert(info.hcVisibleText === '', `Botão de alto contraste não deveria ter texto visível fora do ícone — obtido "${info.hcVisibleText}"`);
    assert(info.hcHasIcon, 'Botão de alto contraste deveria manter o ícone');
    assert(info.ajudaHasQuestionIcon, 'Link "Ajuda" deveria ter o ícone de interrogação (fa-circle-question)');
});
