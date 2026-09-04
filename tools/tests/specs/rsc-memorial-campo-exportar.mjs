/* ==========================================================================
   Regressão: campo de texto do Memorial (RSC) e exportação de "Gerar
   memorial" — issue "campo de texto grande pro memorial (IA ou manual) +
   botão Gerar memorial exporta memorial e PDFs vinculados pra uma pasta
   datada dentro de Exportação/RSC-PCCTAE".
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function habilitarRsc(page, cfg) {
    await page.evaluate((c) => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.rscEnabled = true;
        s.rsc = Object.assign({ escolaridade: 'medio' }, c);
        localStorage.setItem('lz_settings', JSON.stringify(s));
    }, cfg || {});
    await page.reload();
    await page.waitForTimeout(500);
}

test('RSC: campo do memorial existe, autosalva e persiste após recarregar', async ({ page, baseUrl }) => {
    const items = [makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso RSC Memorial', instituicao: 'X', anoFim: '2024' },
        { rsc: { conta: true, criterio: '1.3', jaUsado: false } })];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page, { cargo: 'Assistente em Administração' });
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);

    assertEqual(await page.locator('#rscMemorialTexto').count(), 1, 'Deveria existir o campo de texto do memorial');
    await page.fill('#rscMemorialTexto', 'Texto do memorial escrito por uma IA externa, colado aqui manualmente.');
    await page.waitForTimeout(700); // autosave debounced (500ms)

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').rscMemorialTexto);
    assertEqual(salvo, 'Texto do memorial escrito por uma IA externa, colado aqui manualmente.', 'O texto deveria ter sido autosalvo em Configurações');

    await page.reload();
    await page.waitForTimeout(500);
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);
    const valor = await page.locator('#rscMemorialTexto').inputValue();
    assertEqual(valor, 'Texto do memorial escrito por uma IA externa, colado aqui manualmente.', 'O texto deveria persistir depois de recarregar a página');
});

test('RSC: "Preencher com modelo automático" preenche o campo vazio com o memorial gerado', async ({ page, baseUrl }) => {
    const items = [makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Modelo Automático', instituicao: 'X', anoFim: '2024' },
        { rsc: { conta: true, criterio: '1.3', jaUsado: false } })];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page, { cargo: 'Assistente em Administração' });
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);

    await page.click('#btnRscMemorialPadrao');
    await page.waitForTimeout(200);
    const valor = await page.locator('#rscMemorialTexto').inputValue();
    assert(valor.includes('MEMORIAL — RSC-PCCTAE'), 'O modelo automático deveria preencher o campo com o memorial gerado');
    assert(valor.includes('Curso Modelo Automático'), 'O modelo automático deveria incluir o item contabilizado');
});

test('RSC: "Gerar memorial" sem diretório configurado avisa e não exporta nada', async ({ page, baseUrl }) => {
    const items = [makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Sem Diretório', instituicao: 'X', anoFim: '2024' },
        { rsc: { conta: true, criterio: '1.3', jaUsado: false } })];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page, { cargo: 'Assistente em Administração' });
    await page.evaluate(() => { window.Storage.writeFile = async () => { throw new Error('não deveria ser chamado'); }; });
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);

    await page.click('#btnRscMemorial');
    await page.waitForTimeout(300);
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /configure um diretório/i.test(t)), 'Deveria avisar que é preciso configurar um diretório');
});

test('RSC: "Gerar memorial" com diretório configurado exporta o texto do campo e os anexos numa pasta datada', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Com Anexo', instituicao: 'X', anoFim: '2024' }, {
            rsc: { conta: true, criterio: '1.3', jaUsado: false },
            evidencias: [{ basename: 'ev-abc123', ext: 'pdf', name: 'certificado.pdf', publica: false, tag: '' }],
        }),
    ];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page, { cargo: 'Assistente em Administração' });
    await page.evaluate(() => {
        window.Storage.hasDirectory = () => true;
        window.__saves = [];
        window.Storage.writeFile = async (filename, data, subdir) => { window.__saves.push({ filename, subdir, data }); };
        window.Storage.readAttachmentFile = async (basename, subdir, ext) => new Blob(['%PDF-1.4 conteúdo falso'], { type: 'application/pdf' });
    });
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);
    await page.fill('#rscMemorialTexto', 'Memorial final revisado.');
    await page.waitForTimeout(700);

    await page.click('#btnRscMemorial');
    await page.waitForTimeout(300);

    const saves = await page.evaluate(() => window.__saves.map((s) => ({ filename: s.filename, subdir: s.subdir, data: typeof s.data === 'string' ? s.data : null })));
    const hoje = new Date();
    const ddmmyyyy = String(hoje.getDate()).padStart(2, '0') + String(hoje.getMonth() + 1).padStart(2, '0') + hoje.getFullYear();
    const pastaEsperada = `Exportação/RSC-PCCTAE/${ddmmyyyy}`;

    const memorialSave = saves.find((s) => /^Memorial_/.test(s.filename));
    assert(memorialSave, 'Deveria ter salvo um arquivo "Memorial_*"');
    assertEqual(memorialSave.subdir, pastaEsperada, 'O memorial deveria ir na pasta datada dentro de Exportação/RSC-PCCTAE');
    assertEqual(memorialSave.data, 'Memorial final revisado.', 'O arquivo exportado deveria conter exatamente o texto do campo, não o modelo automático');

    const anexoSave = saves.find((s) => s.subdir === `${pastaEsperada}/Anexos`);
    assert(anexoSave, 'Deveria ter salvo o anexo do item na subpasta "Anexos"');
    assert(anexoSave.filename.includes('Curso Com Anexo'), 'O nome do arquivo do anexo deveria referenciar o título do item');
    assert(anexoSave.filename.endsWith('.pdf'), 'O anexo deveria manter a extensão .pdf');

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /memorial exportado/i.test(t)), 'Deveria confirmar que o memorial foi exportado');
});
