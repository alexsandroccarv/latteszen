/* ==========================================================================
   Regressão: Google Analytics (GA4) fica desligado por padrão (issue #28) —
   js/analytics.js só carrega o gtag.js de verdade quando APP_CONFIG.analyticsId
   for substituído pelo valor de exemplo "G-XXXXXXXXXX". Sem isso, nenhuma
   requisição deve sair do navegador rumo ao Google.
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

test('Sem ID configurado, o Google Analytics não carrega nada', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    const carregou = await page.evaluate(() => ({
        script: !!document.querySelector('script[src*="googletagmanager.com"]'),
        gtag: typeof window.gtag,
        dataLayer: window.dataLayer,
    }));
    assert(!carregou.script, 'Sem ID configurado (padrão de exemplo), nenhum script do gtag.js deveria ser injetado');
    assertEqual(carregou.gtag, 'undefined', 'window.gtag não deveria existir sem um ID configurado');
    assert(!carregou.dataLayer, 'window.dataLayer não deveria existir sem um ID configurado');
});

test('Com um ID de mensuração configurado, o Google Analytics carrega o gtag.js', async ({ page, baseUrl }) => {
    const ID_TESTE = 'G-TEST12345';
    await page.route('https://www.googletagmanager.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript((id) => { window.__LZ_TEST_ANALYTICS_ID = id; }, ID_TESTE);
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    const estado = await page.evaluate(() => {
        const s = document.querySelector('script[src*="googletagmanager.com"]');
        return { src: s ? s.src : null, gtag: typeof window.gtag, dataLayer: Array.isArray(window.dataLayer) };
    });
    assert(estado.src && estado.src.includes(encodeURIComponent('G-TEST12345')), `O script do gtag.js deveria referenciar o ID configurado — obtido "${estado.src}"`);
    assertEqual(estado.gtag, 'function', 'window.gtag deveria ter sido definido');
    assert(estado.dataLayer, 'window.dataLayer deveria ter sido inicializado como array');
});
