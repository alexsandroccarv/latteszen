/* ==========================================================================
   Regressão: anexar um arquivo compactado (.zip/.tar/.gz) como evidência não
   pode tentar pré-visualizá-lo no painel (issue #38) — setPdf() navegava o
   <iframe id="pdfFrame"> direto para a blob URL do arquivo para qualquer
   extensão sem tratamento explícito; para .zip (sem visualizador nativo no
   navegador), isso disparava o diálogo nativo de "Salvar arquivo" em vez de
   mostrar algo, interrompendo o fluxo normal de anexar evidência.
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

async function selectTipo(page, catText, tipoText) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    const catVal = await page.$eval('#selCategoria', (sel, t) => Array.from(sel.options).find((o) => o.textContent.includes(t)).value, catText);
    await page.selectOption('#selCategoria', catVal);
    await page.waitForTimeout(150);
    const tipoVal = await page.$eval('#selTipo', (sel, t) => Array.from(sel.options).find((o) => o.textContent.includes(t)).value, tipoText);
    await page.selectOption('#selTipo', tipoVal);
    await page.waitForTimeout(150);
}

test('Anexar .zip como evidência não navega o iframe pra blob URL (mostra aviso de "sem pré-visualização")', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selectTipo(page, 'Concursos e Processos seletivos', 'Concursos e processos seletivos');
    await page.fill('[name="titulo"]', 'Concurso Teste Zip');

    await page.setInputFiles('#pdfInput', {
        name: 'evidencia.zip', mimeType: 'application/zip', buffer: Buffer.from('PK\x03\x04conteudo-fake-de-teste'),
    });
    await page.waitForTimeout(300);

    const estado = await page.evaluate(() => ({
        frameSrc: document.querySelector('#pdfFrame').src,
        frameHidden: document.querySelector('#pdfFrame').classList.contains('hidden'),
        noPreviewHidden: document.querySelector('#pdfNoPreview').classList.contains('hidden'),
        panelHidden: document.querySelector('#pdfSection').classList.contains('hidden'),
    }));
    assert(estado.frameSrc.endsWith('about:blank'), `O iframe não deveria navegar para a blob URL do .zip — obtido "${estado.frameSrc}"`);
    assert(estado.frameHidden, 'O iframe deveria continuar escondido para um arquivo .zip');
    assert(!estado.noPreviewHidden, 'O aviso de "sem pré-visualização" deveria aparecer para um arquivo .zip');
    assert(!estado.panelHidden, 'O painel de visualização deveria aparecer (mesmo mostrando o aviso, não o arquivo)');
});

test('Anexar um PDF continua pré-visualizando normalmente no iframe', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selectTipo(page, 'Concursos e Processos seletivos', 'Concursos e processos seletivos');
    await page.fill('[name="titulo"]', 'Concurso Teste PDF');

    await page.setInputFiles('#pdfInput', {
        name: 'evidencia.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 conteudo-fake-de-teste'),
    });
    await page.waitForTimeout(300);

    const estado = await page.evaluate(() => ({
        frameSrc: document.querySelector('#pdfFrame').src,
        frameHidden: document.querySelector('#pdfFrame').classList.contains('hidden'),
        noPreviewHidden: document.querySelector('#pdfNoPreview').classList.contains('hidden'),
    }));
    assert(estado.frameSrc.startsWith('blob:'), 'O iframe deveria navegar para a blob URL do PDF (comportamento normal, inalterado)');
    assert(!estado.frameHidden, 'O iframe deveria aparecer para um PDF');
    assert(estado.noPreviewHidden, 'O aviso de "sem pré-visualização" não deveria aparecer para um PDF');
});
