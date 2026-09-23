/* ==========================================================================
   Regressão: SEO (meta tags, título da aba, robots.txt, sitemap.xml)
   --------------------------------------------------------------------------
   Cobre a issue #37: cada página pública precisa de <title>/description/
   canonical/Open Graph/Twitter Card próprios, e robots.txt/sitemap.xml
   precisam ser servidos. Inclui também o caso que motivou o bugfix desta
   mesma issue: document.title era sempre reescrito pra "lattesZen" genérico
   (por app.js e por um script inline repetido nas páginas estáticas),
   descartando o <title> descritivo de cada página — sem nome de perfil
   salvo, o título estático deve permanecer; com nome salvo, vira
   "lattesZen | Nome".
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

const PAGINAS = [
    'index.html', 'ajuda.html', 'ajuda-lattes.html', 'ajuda-rsc.html',
    'relacionando-lattes-rsc.html', 'doe-um-cafe.html', 'privacidade.html',
    'termodeuso.html', 'notas-de-versao.html', 'sobre.html',
];

for (const pagina of PAGINAS) {
    test(`${pagina} tem meta tags de SEO (description, canonical, Open Graph, Twitter Card)`, async ({ page, baseUrl }) => {
        await page.goto(baseUrl + '/' + pagina);
        const info = await page.evaluate(() => ({
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.content || '',
            canonical: document.querySelector('link[rel="canonical"]')?.href || '',
            ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
            ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
            ogUrl: document.querySelector('meta[property="og:url"]')?.content || '',
            ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
            twitterCard: document.querySelector('meta[name="twitter:card"]')?.content || '',
            twitterTitle: document.querySelector('meta[name="twitter:title"]')?.content || '',
        }));
        assert(info.title && info.title !== 'lattesZen', `${pagina}: título deveria ser descritivo, obtido "${info.title}"`);
        assert(info.description.length > 20, `${pagina}: meta description ausente ou curta demais`);
        assert(info.canonical.startsWith('https://ccarvalho.net/labs/latteszen/'), `${pagina}: canonical deveria apontar pro domínio publicado, obtido "${info.canonical}"`);
        assertEqual(info.ogTitle, info.title, `${pagina}: og:title deveria bater com o <title>`);
        assert(info.ogDescription.length > 20, `${pagina}: og:description ausente ou curta demais`);
        assert(info.ogUrl.startsWith('https://ccarvalho.net/labs/latteszen/'), `${pagina}: og:url deveria apontar pro domínio publicado`);
        assert(info.ogImage.endsWith('/images/og-image.png'), `${pagina}: og:image deveria apontar pra imagem de compartilhamento`);
        assertEqual(info.twitterCard, 'summary_large_image', `${pagina}: twitter:card deveria ser summary_large_image`);
        assertEqual(info.twitterTitle, info.title, `${pagina}: twitter:title deveria bater com o <title>`);
    });
}

const PAGINAS_ES = [
    'ajuda.es.html', 'ajuda-lattes.es.html', 'ajuda-rsc.es.html',
    'relacionando-lattes-rsc.es.html', 'doe-um-cafe.es.html',
    'sobre.es.html', 'privacidade.es.html', 'termodeuso.es.html',
];

for (const pagina of PAGINAS_ES) {
    const paginaPt = pagina.replace('.es.html', '.html');
    test(`${pagina}: lang="es", hreflang próprio, meta traduzidas e seletor PT|EN`, async ({ page, baseUrl }) => {
        const res = await page.goto(baseUrl + '/' + pagina);
        assertEqual(res.status(), 200, `${pagina} deveria responder 200`);
        const info = await page.evaluate(() => ({
            lang: document.documentElement.getAttribute('lang'),
            title: document.title,
            ogLocale: document.querySelector('meta[property="og:locale"]')?.content || '',
            canonical: document.querySelector('link[rel="canonical"]')?.href || '',
            hreflangEs: document.querySelector('link[rel="alternate"][hreflang="es"]')?.href || '',
            switcherLinks: Array.from(document.querySelectorAll('a[title="Ver en portugués"], a[title="View in English"]')).map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href') })),
        }));
        assertEqual(info.lang, 'es', `${pagina}: <html lang> deveria ser "es"`);
        assert(info.title && info.title !== 'lattesZen', `${pagina}: título deveria ser descritivo`);
        assertEqual(info.ogLocale, 'es_ES', `${pagina}: og:locale deveria ser "es_ES"`);
        assert(info.canonical.endsWith('/' + pagina), `${pagina}: canonical deveria apontar pro próprio arquivo .es.html, obtido "${info.canonical}"`);
        assert(info.hreflangEs.endsWith('/' + pagina), `${pagina}: hreflang="es" deveria apontar pro próprio arquivo, obtido "${info.hreflangEs}"`);
        assertEqual(info.switcherLinks.length, 2, `${pagina}: seletor de idioma deveria ter exatamente 2 links (PT e EN)`);
        const pt = info.switcherLinks.find(l => l.text === 'PT');
        const en = info.switcherLinks.find(l => l.text === 'EN');
        assert(pt, `${pagina}: deveria ter um link "PT" no seletor de idioma`);
        assert(en, `${pagina}: deveria ter um link "EN" no seletor de idioma`);
        assertEqual(pt.href, paginaPt, `${pagina}: link "PT" deveria apontar pro arquivo pt-br irmão`);
        assertEqual(en.href, paginaPt.replace('.html', '.en.html'), `${pagina}: link "EN" deveria apontar pro arquivo .en.html irmão`);
    });
}

test('robots.txt é servido e aponta pro sitemap.xml', async ({ page, baseUrl }) => {
    const res = await page.goto(baseUrl + '/robots.txt');
    assertEqual(res.status(), 200, 'robots.txt deveria responder 200');
    const body = await res.text();
    assert(body.includes('User-agent: *'), 'robots.txt deveria liberar todos os agentes');
    assert(body.includes('Sitemap: https://ccarvalho.net/labs/latteszen/sitemap.xml'), 'robots.txt deveria linkar o sitemap');
});

test('sitemap.xml é servido e lista todas as páginas públicas', async ({ page, baseUrl }) => {
    const res = await page.goto(baseUrl + '/sitemap.xml');
    assertEqual(res.status(), 200, 'sitemap.xml deveria responder 200');
    const body = await res.text();
    assert(body.includes('<urlset'), 'sitemap.xml deveria ser um <urlset> válido');
    const locs = (body.match(/<loc>/g) || []).length;
    assertEqual(locs, PAGINAS.length, `sitemap.xml deveria listar ${PAGINAS.length} páginas`);
});

test('imagem de compartilhamento (Open Graph) é servida', async ({ page, baseUrl }) => {
    const res = await page.goto(baseUrl + '/images/og-image.png');
    assertEqual(res.status(), 200, 'images/og-image.png deveria responder 200');
});

test('sem nome preenchido em Identificação, o título da aba permanece o título estático da página (não reseta pra "lattesZen")', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    const tituloEstatico = await page.evaluate(() => document.title);
    assert(tituloEstatico.startsWith('lattesZen') && tituloEstatico !== 'lattesZen', `Título estático de index.html deveria ser descritivo, obtido "${tituloEstatico}"`);

    await seedCatalog(page, baseUrl, []);
    const tituloDepois = await page.evaluate(() => document.title);
    assertEqual(tituloDepois, tituloEstatico, 'Sem item de Identificação, o título não deveria ser sobrescrito pro genérico "lattesZen"');
});

test('com nome preenchido em Identificação, o título da aba vira "lattesZen | Nome"', async ({ page, baseUrl }) => {
    const item = makeItem('IDENTIFICACAO', 'IDENTIFICACAO', { titulo: 'Maria da Silva' });
    await seedCatalog(page, baseUrl, [item]);
    const titulo = await page.evaluate(() => document.title);
    assertEqual(titulo, 'lattesZen | Maria da Silva', 'Com nome preenchido, o título deveria virar "lattesZen | Nome"');
});

test('página estática (ajuda.html) também preserva o título próprio sem nome salvo, e adota "lattesZen | Nome" quando há nome salvo', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/ajuda.html');
    const tituloEstatico = await page.evaluate(() => document.title);
    assert(tituloEstatico.startsWith('lattesZen') && tituloEstatico !== 'lattesZen', `Título estático de ajuda.html deveria ser descritivo, obtido "${tituloEstatico}"`);

    const item = makeItem('IDENTIFICACAO', 'IDENTIFICACAO', { titulo: 'João Pereira' });
    await page.evaluate((its) => localStorage.setItem('lz_catalog', JSON.stringify(its)), [item]);
    await page.reload();
    await page.waitForTimeout(300);
    const tituloComNome = await page.evaluate(() => document.title);
    assertEqual(tituloComNome, 'lattesZen | João Pereira', 'Com nome salvo, ajuda.html também deveria adotar "lattesZen | Nome"');
});
