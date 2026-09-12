/* ==========================================================================
   Regressão: seção "Currículo Lattes (XML)" em Configurações
   --------------------------------------------------------------------------
   - O aviso de consistência ("Para manter a consistência...") não é mais
     exibido nesta seção (o texto ficava redundante/alarmante para quem só
     quer importar uma vez).
   - Em "Importar", só o texto explicativo (o parágrafo "Exporte seu
     currículo em XML na Plataforma Lattes...") foi removido — a função de
     importar em si (input de arquivo, listagem de itens etc.) continua
     visível e funcionando normalmente.
   - A sub-seção "Exportar" (com o aviso "Funcionalidade futura" e os botões
     desabilitados "Baixar XML"/"Salvar na pasta") foi removida por completo
     — a exportação para XML ainda não está pronta pra uso, então não faz
     sentido ocupar espaço na tela com ela.
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

async function abrirConfig(page, baseUrl) {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
}

test('Aviso de consistência não aparece mais na seção Currículo Lattes (XML)', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    const secaoTexto = await page.$eval('#importXmlSection', (el) => el.textContent);
    assert(!secaoTexto.includes('Para manter a consistência'), 'O aviso de consistência não deveria mais aparecer na seção');
    assert(!secaoTexto.includes('muda o identificador dele e pode gerar'), 'O texto completo do aviso não deveria mais aparecer');
});

test('"Importar" perde só o texto explicativo — input de arquivo continua visível e funcional', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    const secaoTexto = await page.$eval('#importXmlSection', (el) => el.textContent);
    assert(!secaoTexto.includes('Exporte seu currículo em XML na Plataforma Lattes'), 'O parágrafo explicativo de Importar não deveria mais aparecer');
    assert(!secaoTexto.includes('Os itens serão listados para você escolher quais importar'), 'O parágrafo explicativo de Importar não deveria mais aparecer');

    const input = await page.$('#xmlInput');
    assert(input, 'O input de arquivo XML deveria continuar existindo');
    const visivel = await page.$eval('#xmlInput', (el) => el.offsetParent !== null);
    assert(visivel, 'O input de arquivo XML deveria continuar visível');

    assert(secaoTexto.includes('Importar'), 'O título "Importar" deveria continuar visível');
});

test('Sub-seção "Exportar" (XML) foi removida — funcionalidade ainda não pronta para uso', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    const secaoTexto = await page.$eval('#importXmlSection', (el) => el.textContent);
    assert(!secaoTexto.includes('Exportar'), 'A sub-seção "Exportar" não deveria mais aparecer');
    assert(!secaoTexto.includes('Funcionalidade futura'), 'O aviso de "Funcionalidade futura" da exportação não deveria mais aparecer');
    assertEqual(await page.locator('#btnXmlDownload').count(), 0, 'O botão "Baixar XML" não deveria mais existir');
    assertEqual(await page.locator('#btnXmlSave').count(), 0, 'O botão "Salvar na pasta" não deveria mais existir');
});
