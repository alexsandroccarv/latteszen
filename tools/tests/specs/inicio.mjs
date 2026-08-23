/* ==========================================================================
   Regressão: aba Início (onboarding)
   --------------------------------------------------------------------------
   Segunda aba extraída de app.js (tab-inicio.js) — não existia cobertura
   antes. Cobre os 3 botões de "Primeiros passos": navegar para Catalogar e
   ir para as duas seções de Configurações (pasta e importar XML).
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

async function abrirInicio(page, baseUrl) {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
}
function abaAtiva(page) {
    return page.evaluate(() => document.querySelector('.tab-btn[aria-selected="true"]').dataset.tab);
}

test('Início é a aba mostrada ao abrir o app', async ({ page, baseUrl }) => {
    await abrirInicio(page, baseUrl);
    assertEqual(await abaAtiva(page), 'inicio', 'A aba Início deveria estar selecionada ao carregar o app');
    const titulo = await page.$eval('#tab-inicio h2', (el) => el.textContent);
    assertEqual(titulo, 'lattesZen', 'O título de apresentação deveria estar na tela');
});

test('"Ir para Catalogar" troca para a aba Catalogar', async ({ page, baseUrl }) => {
    await abrirInicio(page, baseUrl);
    await page.click('#btnInicioCatalogar');
    await page.waitForTimeout(200);
    assertEqual(await abaAtiva(page), 'catalogar', 'Deveria ter trocado para a aba Catalogar');
});

test('"Ir para Configurações" (pasta) troca para Configurações e rola até a seção de diretório', async ({ page, baseUrl }) => {
    await abrirInicio(page, baseUrl);
    await page.click('#btnInicioDir');
    await page.waitForTimeout(300);
    assertEqual(await abaAtiva(page), 'config', 'Deveria ter trocado para a aba Configurações');
    const existeSecao = await page.$('#dirSection');
    assert(existeSecao, 'A seção de diretório deveria existir na tela de Configurações');
});

test('"Importar XML do Lattes" troca para Configurações e rola até a seção de importação', async ({ page, baseUrl }) => {
    await abrirInicio(page, baseUrl);
    await page.click('#btnInicioImportar');
    await page.waitForTimeout(300);
    assertEqual(await abaAtiva(page), 'config', 'Deveria ter trocado para a aba Configurações');
    const existeSecao = await page.$('#importXmlSection');
    assert(existeSecao, 'A seção de importação de XML deveria existir na tela de Configurações');
});
