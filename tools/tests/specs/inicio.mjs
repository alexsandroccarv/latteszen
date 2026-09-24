/* ==========================================================================
   Regressão: aba Início (onboarding)
   --------------------------------------------------------------------------
   Segunda aba extraída de app.js (tab-inicio.js) — não existia cobertura
   antes. "Primeiros passos" tem só um botão de verdade ("Ir para
   Configurações", passo 1) — o passo 2 (Catalogar/Importar XML) é só texto
   informativo, sem botão, porque essas ações começam travadas até haver um
   diretório configurado (ver dir-gate.mjs).
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

async function abrirInicio(page, baseUrl) {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
}
function abaAtiva(page) {
    // headerConfigBtn não usa aria-selected (não tem role="tab" — issue de
    // acessibilidade #17), e sim aria-pressed — por isso o fallback abaixo,
    // senão a aba Configurações nunca seria encontrada por este helper.
    return page.evaluate(() => {
        const ativo = document.querySelector('.tab-btn[aria-selected="true"]') || document.querySelector('.tab-btn[aria-pressed="true"]');
        return ativo && ativo.dataset.tab;
    });
}

test('Início é a aba mostrada ao abrir o app', async ({ page, baseUrl }) => {
    await abrirInicio(page, baseUrl);
    assertEqual(await abaAtiva(page), 'inicio', 'A aba Início deveria estar selecionada ao carregar o app');
    const titulo = await page.$eval('#tab-inicio h2', (el) => el.textContent);
    assertEqual(titulo, 'lattesZen', 'O título de apresentação deveria estar na tela');
});

test('"Ir para Configurações" (pasta) troca para Configurações e rola até a seção de diretório', async ({ page, baseUrl }) => {
    await abrirInicio(page, baseUrl);
    await page.click('#btnInicioDir');
    await page.waitForTimeout(300);
    assertEqual(await abaAtiva(page), 'config', 'Deveria ter trocado para a aba Configurações');
    const existeSecao = await page.$('#dirSection');
    assert(existeSecao, 'A seção de diretório deveria existir na tela de Configurações');
});

test('Seção "Primeiros passos" aparece logo abaixo de "Que dores...", sem botões pro passo 2 (Catalogar/Importar XML começam travados)', async ({ page, baseUrl }) => {
    await abrirInicio(page, baseUrl);
    const titulos = await page.$$eval('#tab-inicio section h2', (els) => els.map((el) => el.textContent.trim()));
    const idxDores = titulos.findIndex((t) => t.includes('Que dores'));
    const idxPassos = titulos.findIndex((t) => t.includes('Primeiros passos'));
    assert(idxDores >= 0 && idxPassos === idxDores + 1,
        `"Primeiros passos" deveria ficar logo abaixo de "Que dores..." — ordem obtida: ${JSON.stringify(titulos)}`);

    assert(!(await page.$('#btnInicioCatalogar')), 'O botão "Ir para Catalogar" não deveria mais existir (a ação começa travada até configurar o diretório)');
    assert(!(await page.$('#btnInicioImportar')), 'O botão "Importar XML do Lattes" não deveria mais existir (a ação começa travada até configurar o diretório)');
    assert(await page.$('#btnInicioDir'), 'O botão "Ir para Configurações" (passo 1) deveria continuar existindo — essa ação não é travada');
});

test('Seção "Importante: suporte do navegador" aparece entre "Módulos opcionais" e "Software livre", com o link de solicitação do Google Drive', async ({ page, baseUrl }) => {
    await abrirInicio(page, baseUrl);
    const titulos = await page.$$eval('#tab-inicio section h2', (els) => els.map((el) => el.textContent.trim()));
    const idxModulos = titulos.findIndex((t) => t.includes('Módulos opcionais'));
    const idxImportante = titulos.findIndex((t) => t.includes('Importante'));
    const idxSoftware = titulos.findIndex((t) => t.includes('Software livre'));
    assert(idxModulos >= 0 && idxImportante === idxModulos + 1 && idxSoftware === idxImportante + 1,
        `A seção "Importante" deveria ficar entre "Módulos opcionais" e "Software livre" — ordem obtida: ${JSON.stringify(titulos)}`);

    const texto = await page.$eval('#tab-inicio', (el) => el.textContent);
    assert(texto.includes('Chromium'), 'Deveria mencionar navegadores baseados em Chromium');
    assert(texto.includes('Google Drive'), 'Deveria mencionar a opção de conectar ao Google Drive');

    const linkSolicitar = await page.$eval('#tab-inicio a[href*="github.com"][href*="issues"]', (el) => el.href);
    assert(linkSolicitar.includes('/issues'), 'Deveria linkar para o canal de solicitação (issues do repositório)');
});

test('Seção "Módulos opcionais" aparece logo abaixo de "Primeiros passos", com "RSC sem planilha (opcional)" e, logo abaixo, "Súmula FAPESP (opcional)" — e não mais dentro de "Que dores..."', async ({ page, baseUrl }) => {
    await abrirInicio(page, baseUrl);
    const titulos = await page.$$eval('#tab-inicio section h2', (els) => els.map((el) => el.textContent.trim()));
    const idxPassos = titulos.findIndex((t) => t.includes('Primeiros passos'));
    const idxModulos = titulos.findIndex((t) => t.includes('Módulos opcionais'));
    assert(idxPassos >= 0 && idxModulos === idxPassos + 1,
        `"Módulos opcionais" deveria ficar logo abaixo de "Primeiros passos" — ordem obtida: ${JSON.stringify(titulos)}`);

    const itensModulos = await page.$$eval('#tab-inicio section', (secs) => {
        const sec = secs.find((s) => s.querySelector('h2')?.textContent.includes('Módulos opcionais'));
        return sec ? Array.from(sec.querySelectorAll(':scope > div > div')).map((d) => d.textContent.trim()) : [];
    });
    const idxRsc = itensModulos.findIndex((t) => t.includes('RSC sem planilha'));
    const idxSumula = itensModulos.findIndex((t) => t.includes('Súmula FAPESP'));
    assert(idxRsc >= 0, `Deveria haver um item "RSC sem planilha" na seção "Módulos opcionais" — itens: ${JSON.stringify(itensModulos)}`);
    assert(itensModulos[idxRsc].includes('(opcional)'), 'O item "RSC sem planilha" deveria estar marcado como "(opcional)"');
    assert(idxSumula === idxRsc + 1, `"Súmula FAPESP" deveria vir logo abaixo de "RSC sem planilha" — itens: ${JSON.stringify(itensModulos)}`);
    assert(itensModulos[idxSumula].includes('(opcional)'), 'O item "Súmula FAPESP" deveria estar marcado como "(opcional)"');

    const itensDores = await page.$$eval('#tab-inicio section', (secs) => {
        const sec = secs.find((s) => s.querySelector('h2')?.textContent.includes('Que dores'));
        return sec ? Array.from(sec.querySelectorAll(':scope > div > div')).map((d) => d.textContent.trim()) : [];
    });
    assert(!itensDores.some((t) => t.includes('RSC sem planilha') || t.includes('Súmula FAPESP')),
        `"Que dores..." não deveria mais listar RSC/Súmula (movidos pra "Módulos opcionais") — itens: ${JSON.stringify(itensDores)}`);
});

test('Seção "Como citar" mostra a referência completa e o botão de copiar funciona', async ({ page, baseUrl }) => {
    await abrirInicio(page, baseUrl);
    const citacao = await page.$eval('#tab-inicio blockquote', (el) => el.textContent.replace(/\s+/g, ' ').trim());
    assert(citacao.includes('CARVALHO, Alexsandro Cardoso'), 'Citação deveria conter o autor');
    assert(citacao.includes('LattesZen: descomplicando o currículo Acadêmico'), 'Citação deveria conter o título');
    assert(citacao.includes('Versão 1.0.0'), 'Citação deveria conter a versão citada');
    assert(citacao.includes('Santos: Github, 2016'), 'Citação deveria conter local/editora/ano');
    const hrefDoi = await page.$eval('#tab-inicio blockquote a', (el) => el.getAttribute('href'));
    assertEqual(hrefDoi, 'https://zenodo.org/records/22781288', 'Link do DOI deveria apontar para o Zenodo');

    await page.context().grantPermissions(['clipboard-write', 'clipboard-read'], { origin: baseUrl });
    await page.click('#btnCopiarCitacao');
    await page.waitForTimeout(100);
    const textoBotao = await page.$eval('#btnCopiarCitacao', (el) => el.textContent.trim());
    assert(textoBotao.includes('Copiado'), 'Botão deveria mostrar confirmação de cópia');
});
