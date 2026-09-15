/* ==========================================================================
   Regressão: rodapé consolidado das páginas estáticas/app, trazido do
   templateZen (issue de paridade de rodapé) — mesma ordem/links/ícones do
   templateZen, adaptados às páginas reais do lattesZen:

   - Termo de uso / Privacidade / Ajuda / Sobre (nova página): ícone apenas,
     com title/aria-label para acessibilidade (sem texto visível).
   - Alto contraste e escala de fonte (A-/A+): inalterados.
   - Alternador de tema claro/escuro SAIU do rodapé (o templateZen não tem
     esse controle — usa temas predefinidos em Configurações, e o lattesZen
     não tinha isso; o tema agora só reage à preferência do sistema
     operacional/valor já salvo, sem controle manual na UI).
   - Selo de DOI (Zenodo) SAIU do rodapé (não existe no templateZen) — o DOI
     continua citado na nova página Sobre.
   - Versão: era texto solto + data (`lastModDate`); agora é um LINK
     (ícone de tag + nº da versão) para notas-de-versao.html, igual ao
     templateZen — `lastModDate` não existe mais.
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

const PAGINAS = ['index.html', 'ajuda.html', 'doe-um-cafe.html', 'notas-de-versao.html', 'privacidade.html', 'termodeuso.html', 'sobre.html'];

async function footerInfo(page) {
    return page.evaluate(() => {
        const footer = document.querySelector('footer');
        const linkInfo = (sel) => {
            const a = footer.querySelector(sel);
            return a ? { href: a.getAttribute('href'), title: a.getAttribute('title'), ariaLabel: a.getAttribute('aria-label'), text: a.textContent.trim() } : null;
        };
        return {
            hasTheme: !!footer.querySelector('#themeToggle'),
            hasDOI: !!footer.querySelector('img[src*="zenodo"]') || !!footer.querySelector('a[href*="zenodo"]'),
            hasLastMod: !!footer.querySelector('#lastModDate'),
            termos: linkInfo('a[href="termodeuso.html"]'),
            privacidade: linkInfo('a[href="privacidade.html"]'),
            ajuda: linkInfo('a[href="./ajuda.html"], a[href="ajuda.html"]'),
            sobre: linkInfo('a[href="sobre.html"]'),
            versao: linkInfo('a[href="notas-de-versao.html"]'),
        };
    });
}

for (const pagina of PAGINAS) {
    test(`Rodapé de ${pagina}: sem alternador de tema, sem selo DOI, sem "lastModDate"`, async ({ page, baseUrl }) => {
        await page.goto(baseUrl + '/' + pagina);
        await page.waitForTimeout(300);
        const info = await footerInfo(page);
        assert(!info.hasTheme, `${pagina}: rodapé não deveria mais ter #themeToggle`);
        assert(!info.hasDOI, `${pagina}: rodapé não deveria mais ter o selo de DOI (Zenodo)`);
        assert(!info.hasLastMod, `${pagina}: rodapé não deveria mais ter #lastModDate`);
    });

    test(`Rodapé de ${pagina}: Termo de uso/Privacidade/Ajuda/Sobre são ícones com title (sem texto visível)`, async ({ page, baseUrl }) => {
        await page.goto(baseUrl + '/' + pagina);
        await page.waitForTimeout(300);
        const info = await footerInfo(page);
        for (const [nome, item, tituloEsperado] of [
            ['Termo de uso', info.termos, 'Termo de uso'],
            ['Privacidade', info.privacidade, 'Política de privacidade'],
            ['Ajuda', info.ajuda, 'Ajuda'],
            ['Sobre', info.sobre, 'Sobre'],
        ]) {
            assert(item, `${pagina}: link "${nome}" deveria existir no rodapé`);
            assertEqual(item.text, '', `${pagina}: link "${nome}" não deveria ter texto visível (só ícone)`);
            assertEqual(item.title, tituloEsperado, `${pagina}: link "${nome}" deveria ter title="${tituloEsperado}"`);
            assertEqual(item.ariaLabel, tituloEsperado, `${pagina}: link "${nome}" deveria ter aria-label="${tituloEsperado}"`);
        }
    });

    test(`Rodapé de ${pagina}: versão é um link para notas-de-versao.html`, async ({ page, baseUrl }) => {
        await page.goto(baseUrl + '/' + pagina);
        await page.waitForTimeout(300);
        const info = await footerInfo(page);
        assert(info.versao, `${pagina}: deveria haver um link de versão apontando para notas-de-versao.html`);
        assertEqual(info.versao.title, 'Notas de versão', `${pagina}: link de versão deveria ter title="Notas de versão"`);
        // Regressão: nas páginas de apoio, o script que preenche #appVersion
        // era um <script> clássico (síncrono) DEPOIS de <script type="module"
        // src="js/config.js"> — como scripts clássicos rodam imediatamente
        // durante o parse e módulos só depois (adiados), o texto ficava
        // sempre vazio (window.APP_CONFIG ainda não existia). Corrigido
        // marcando esse script também como type="module" (mesma ordem de
        // execução do config.js). Sem esse teste, um "existe o link" não
        // pega a versão vazia — precisa checar o TEXTO mesmo.
        assert(/^v\d/.test(info.versao.text), `${pagina}: o link de versão deveria mostrar o número da versão (ex.: "v1.0.0"), não ficar vazio — obtido: "${info.versao.text}"`);
    });
}

test('Rodapé (index.html): ordem dos itens segue Termo/Privacidade/Ajuda/Sobre/AltoContraste/Fonte, depois Autor/Café/Licença/Versão/Código-fonte (extrema direita)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);
    const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll('footer a[href]')).map((a) => a.getAttribute('href')));
    assertEqual(hrefs, [
        'termodeuso.html', 'privacidade.html', './ajuda.html', 'sobre.html',
        'https://github.com/alexsandroccarv', 'doe-um-cafe.html',
        'https://www.gnu.org/licenses/agpl-3.0.html', 'notas-de-versao.html', 'https://github.com/alexsandroccarv/latteszen',
    ], `Ordem dos links do rodapé não confere — obtido: ${hrefs.join(', ')}`);
});

for (const pagina of PAGINAS) {
    test(`Rodapé de ${pagina}: sem separador "|" entre a Versão e o ícone de Código-fonte`, async ({ page, baseUrl }) => {
        await page.goto(baseUrl + '/' + pagina);
        await page.waitForTimeout(300);
        const consecutivos = await page.evaluate(() => {
            const versao = document.querySelector('footer a[href="notas-de-versao.html"]');
            const codigoFonte = document.querySelector('footer a[href="https://github.com/alexsandroccarv/latteszen"]');
            if (!versao || !codigoFonte) return null;
            // O grupo pai de "Versão" é o <span> com o ícone de tag; o irmão
            // logo depois dele deveria já ser o link de Código-fonte, sem
            // nenhum <span>"|"</span> entre os dois.
            const grupoVersao = versao.closest('span');
            return grupoVersao ? grupoVersao.nextElementSibling === codigoFonte : null;
        });
        assert(consecutivos, `${pagina}: o link de Código-fonte deveria vir logo depois do grupo da Versão, sem separador "|" entre eles`);
    });
}

test('Rodapé: "Código-fonte" é só ícone (sem texto visível), na extrema direita', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => {
        const link = document.querySelector('footer a[href="https://github.com/alexsandroccarv/latteszen"]');
        const rightGroup = link ? link.parentElement : null;
        const ultimoFilho = rightGroup ? rightGroup.lastElementChild : null;
        return link && {
            text: link.textContent.trim(),
            title: link.getAttribute('title'),
            ariaLabel: link.getAttribute('aria-label'),
            ehOUltimo: ultimoFilho === link,
        };
    });
    assert(info, 'Link de código-fonte deveria existir no rodapé');
    assertEqual(info.text, '', 'Código-fonte não deveria mais ter texto visível (só ícone)');
    assertEqual(info.ariaLabel, 'Código-fonte (repositório no GitHub)', 'Código-fonte deveria ter aria-label (ícone sem texto)');
    assert(info.ehOUltimo, 'Código-fonte deveria ser o último item do grupo direito do rodapé (extrema direita)');
});

test('Página sobre.html existe, com cabeçalho/rodapé padrão e menciona o DOI (Zenodo)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/sobre.html');
    await page.waitForTimeout(300);
    const h1 = await page.evaluate(() => document.querySelector('main h1')?.textContent || '');
    assert(/Sobre/.test(h1), `Título principal de sobre.html deveria mencionar "Sobre" — obtido "${h1}"`);
    const temDOI = await page.evaluate(() => !!document.querySelector('main a[href*="zenodo"]'));
    assert(temDOI, 'sobre.html deveria linkar o DOI do Zenodo (informação retirada do rodapé)');
    const temFooter = await page.evaluate(() => !!document.querySelector('footer #highContrastToggle'));
    assert(temFooter, 'sobre.html deveria ter o mesmo rodapé padrão do site');
});

// doe-um-cafe.html manteve só o link "Início" — as outras 5 tinham "Início"
// e "Voltar ao lattesZen" lado a lado (2 links redundantes, ambos indo pro
// mesmo lugar), consolidados num único link "Voltar ao início".
const PAGINAS_SO_INICIO = ['doe-um-cafe.html'];
const PAGINAS_VOLTAR_AO_INICIO = ['privacidade.html', 'termodeuso.html', 'ajuda.html', 'sobre.html', 'notas-de-versao.html'];

for (const pagina of PAGINAS_SO_INICIO) {
    test(`${pagina}: 2ª linha do cabeçalho mostra só "Início" (ícone + texto), sem a régua de abas fictícia`, async ({ page, baseUrl }) => {
        await page.goto(baseUrl + '/' + pagina);
        await page.waitForTimeout(300);

        const info = await page.evaluate(() => {
            const nav = document.querySelector('header nav');
            const links = nav ? Array.from(nav.querySelectorAll('a')) : [];
            return {
                quantidade: links.length,
                textos: links.map((a) => a.textContent.trim()),
                hrefs: links.map((a) => a.getAttribute('href')),
                temIcone: links.length === 1 && !!links[0].querySelector('i.fa-house'),
            };
        });
        assertEqual(info.quantidade, 1, `${pagina}: a 2ª linha do cabeçalho deveria ter só 1 link — obtido: ${info.textos.join(', ')}`);
        assert(/Início/.test(info.textos[0]), `${pagina}: o único link deveria ser "Início" — obtido "${info.textos[0]}"`);
        assertEqual(info.hrefs[0], 'index.html', `${pagina}: o link "Início" deveria apontar para index.html`);
        assert(info.temIcone, `${pagina}: o link "Início" deveria manter o ícone de casa (fa-house)`);
    });
}

for (const pagina of PAGINAS_VOLTAR_AO_INICIO) {
    test(`${pagina}: 2ª linha do cabeçalho mostra um único link "Voltar ao início" (ícones casa + seta)`, async ({ page, baseUrl }) => {
        await page.goto(baseUrl + '/' + pagina);
        await page.waitForTimeout(300);

        const info = await page.evaluate(() => {
            const nav = document.querySelector('header nav');
            const links = nav ? Array.from(nav.querySelectorAll('a')) : [];
            return {
                quantidade: links.length,
                textos: links.map((a) => a.textContent.trim()),
                hrefs: links.map((a) => a.getAttribute('href')),
                temIcones: links.length === 1 && !!links[0].querySelector('i.fa-house') && !!links[0].querySelector('i.fa-arrow-left'),
            };
        });
        assertEqual(info.quantidade, 1, `${pagina}: a 2ª linha do cabeçalho deveria ter só 1 link — obtido: ${info.textos.join(', ')}`);
        assert(/Voltar ao início/.test(info.textos[0]), `${pagina}: o link deveria ser "Voltar ao início" — obtido "${info.textos[0]}"`);
        assertEqual(info.hrefs[0], 'index.html', `${pagina}: o link deveria apontar para index.html`);
        assert(info.temIcones, `${pagina}: o link deveria ter os ícones de casa (fa-house) e seta (fa-arrow-left)`);
    });
}

test('Página ajuda.html (Início Rápido) linka para os dois guias específicos', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/ajuda.html');
    await page.waitForTimeout(300);

    const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll('main a')).map((a) => a.getAttribute('href')));
    assert(hrefs.includes('ajuda-lattes.html'), 'ajuda.html deveria linkar para ajuda-lattes.html');
    assert(hrefs.includes('ajuda-rsc.html'), 'ajuda.html deveria linkar para ajuda-rsc.html');

    const h1 = await page.evaluate(() => document.querySelector('main h1')?.textContent || '');
    assert(/Início Rápido/.test(h1), `Título principal deveria mencionar "Início Rápido" — obtido "${h1}"`);
});

test('Alto contraste e escala de fonte continuam funcionando no rodapé (index.html)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
        const visible = (el) => {
            let t = '';
            el.childNodes.forEach((n) => { if (n.nodeType === Node.TEXT_NODE) t += n.textContent; });
            return t.trim();
        };
        const hc = document.querySelector('#highContrastToggle');
        return {
            hcVisibleText: hc ? visible(hc) : null,
            hcHasIcon: !!(hc && hc.querySelector('i.fa-circle-half-stroke')),
        };
    });
    assert(info.hcVisibleText === '', `Botão de alto contraste não deveria ter texto visível fora do ícone — obtido "${info.hcVisibleText}"`);
    assert(info.hcHasIcon, 'Botão de alto contraste deveria manter o ícone');

    await page.click('#highContrastToggle');
    await page.waitForTimeout(150);
    const ativo = await page.evaluate(() => document.documentElement.classList.contains('high-contrast'));
    assert(ativo, 'Clicar no botão de alto contraste deveria ativar a classe high-contrast');

    await page.click('#fontInc');
    await page.waitForTimeout(150);
    const fontScale = await page.evaluate(() => localStorage.getItem('fontScale'));
    assertEqual(fontScale, '110', 'Clicar em "A+" deveria aumentar a escala de fonte pra 110%');
});
