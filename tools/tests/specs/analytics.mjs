/* ==========================================================================
   Regressão: Google Analytics (GA4) só roda com consentimento (issue #30) —
   js/analytics.js e js/cookie-consent.js: sem ID real configurado, nada
   acontece; com ID configurado, um aviso de cookies aparece e o Analytics
   só carrega depois de "Aceitar" — "Recusar" mantém desligado e não repete
   o aviso; uma decisão já salva pula direto para o resultado certo.
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

test('Sem ID configurado, o Google Analytics não carrega nada e nenhum aviso de cookies aparece', async ({ page, baseUrl }) => {
    // Força o valor de exemplo (placeholder), simulando uma instância onde
    // ninguém configurou um ID de mensuração real — o padrão do repositório
    // (analyticsId em config.js) já vem com um ID real para a instância oficial.
    await page.addInitScript(() => { window.__LZ_TEST_ANALYTICS_ID = 'G-XXXXXXXXXX'; });
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    const estado = await page.evaluate(() => ({
        script: !!document.querySelector('script[src*="googletagmanager.com"]'),
        gtag: typeof window.gtag,
        dataLayer: window.dataLayer,
        banner: !!document.querySelector('#lzCookieBanner'),
    }));
    assert(!estado.script, 'Sem ID configurado (padrão de exemplo), nenhum script do gtag.js deveria ser injetado');
    assertEqual(estado.gtag, 'undefined', 'window.gtag não deveria existir sem um ID configurado');
    assert(!estado.dataLayer, 'window.dataLayer não deveria existir sem um ID configurado');
    assert(!estado.banner, 'Sem ID configurado, o aviso de cookies não deveria aparecer');
});

test('Com ID configurado e sem decisão prévia, o aviso de cookies aparece e o Analytics só carrega após "Aceitar"', async ({ page, baseUrl }) => {
    const ID_TESTE = 'G-TEST12345';
    await page.route('https://www.googletagmanager.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript((id) => { window.__LZ_TEST_ANALYTICS_ID = id; }, ID_TESTE);
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    const antes = await page.evaluate(() => ({
        banner: !!document.querySelector('#lzCookieBanner'),
        script: !!document.querySelector('script[src*="googletagmanager.com"]'),
    }));
    assert(antes.banner, 'Com ID configurado e sem decisão salva, o aviso de cookies deveria aparecer');
    assert(!antes.script, 'Antes de aceitar, o Analytics não deveria carregar');

    await page.click('#lzCookieAceitar');
    await page.waitForTimeout(200);

    const depois = await page.evaluate(() => {
        const s = document.querySelector('script[src*="googletagmanager.com"]');
        return {
            src: s ? s.src : null, gtag: typeof window.gtag, dataLayer: Array.isArray(window.dataLayer),
            banner: !!document.querySelector('#lzCookieBanner'),
            consentimento: localStorage.getItem('lz_cookie_consent'),
        };
    });
    assert(depois.src && depois.src.includes(encodeURIComponent(ID_TESTE)), `O script do gtag.js deveria referenciar o ID configurado — obtido "${depois.src}"`);
    assertEqual(depois.gtag, 'function', 'window.gtag deveria ter sido definido após aceitar');
    assert(depois.dataLayer, 'window.dataLayer deveria ter sido inicializado como array');
    assert(!depois.banner, 'O aviso de cookies deveria sumir após "Aceitar"');
    assertEqual(depois.consentimento, 'accepted', 'A decisão "accepted" deveria ficar salva em localStorage');
});

test('"Recusar" o aviso de cookies mantém o Analytics desligado e não mostra o aviso de novo', async ({ page, baseUrl }) => {
    const ID_TESTE = 'G-TEST12345';
    await page.route('https://www.googletagmanager.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript((id) => { window.__LZ_TEST_ANALYTICS_ID = id; }, ID_TESTE);
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    await page.click('#lzCookieRecusar');
    await page.waitForTimeout(200);

    const depois = await page.evaluate(() => ({
        script: !!document.querySelector('script[src*="googletagmanager.com"]'),
        banner: !!document.querySelector('#lzCookieBanner'),
        consentimento: localStorage.getItem('lz_cookie_consent'),
    }));
    assert(!depois.script, 'Após "Recusar", o Analytics não deveria carregar');
    assert(!depois.banner, 'O aviso de cookies deveria sumir após "Recusar"');
    assertEqual(depois.consentimento, 'rejected', 'A decisão "rejected" deveria ficar salva em localStorage');

    await page.reload();
    await page.waitForTimeout(400);
    const reload = await page.evaluate(() => ({
        script: !!document.querySelector('script[src*="googletagmanager.com"]'),
        banner: !!document.querySelector('#lzCookieBanner'),
    }));
    assert(!reload.script, 'Numa nova visita, com "Recusar" salvo, o Analytics continua desligado');
    assert(!reload.banner, 'Numa nova visita, com "Recusar" salvo, o aviso não deveria reaparecer');
});

test('Com consentimento já aceito anteriormente, o Analytics carrega direto, sem novo aviso', async ({ page, baseUrl }) => {
    const ID_TESTE = 'G-TEST12345';
    await page.route('https://www.googletagmanager.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript((id) => {
        window.__LZ_TEST_ANALYTICS_ID = id;
        localStorage.setItem('lz_cookie_consent', 'accepted');
    }, ID_TESTE);
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    const estado = await page.evaluate(() => {
        const s = document.querySelector('script[src*="googletagmanager.com"]');
        return { src: s ? s.src : null, banner: !!document.querySelector('#lzCookieBanner') };
    });
    assert(estado.src && estado.src.includes(encodeURIComponent(ID_TESTE)), 'Com consentimento já aceito, o Analytics deveria carregar automaticamente');
    assert(!estado.banner, 'Com consentimento já decidido, o aviso de cookies não deveria aparecer');
});
