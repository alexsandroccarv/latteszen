/* ==========================================================================
   Regressão: campo de texto do Memorial (RSC) e exportação de "Gerar
   memorial" — issue "campo de texto grande pro memorial (IA ou manual) +
   botão Gerar memorial exporta memorial e PDFs vinculados pra uma pasta
   datada dentro de Exportação/RSC-PCCTAE".
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Lê o document.xml de dentro de um .docx (ZIP+OOXML) gerado em bytes, pra
// validar o conteúdo real do arquivo exportado (mesma técnica usada em
// rsc-formulario-docx.mjs).
function docxDocumentXml(bytes) {
    const dir = mkdtempSync(join(tmpdir(), 'lz-docx-'));
    const path = join(dir, 'memorial.docx');
    writeFileSync(path, Buffer.from(bytes));
    return execFileSync('python3', ['-c', `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None, "zip corrompido"
print(z.read('word/document.xml').decode('utf-8'))
`, path]).toString('utf-8');
}

// Extrai os parágrafos do XML (sem depender de biblioteca externa — só
// regex sobre o document.xml já validado como ZIP+XML bem formado acima),
// como [{style, text}], pra confirmar que os títulos usam mesmo o estilo
// nomeado "Heading2"/"Heading3" (não só formatação direta).
function docxParagraphs(xml) {
    return Array.from(xml.matchAll(/<w:p>(.*?)<\/w:p>/gs)).map((m) => {
        const body = m[1];
        const style = (body.match(/<w:pStyle w:val="([^"]+)"\/>/) || [])[1] || null;
        const text = Array.from(body.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)).map((t) => t[1]).join('');
        return { style, text };
    });
}

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

test('RSC: "Gerar memorial" com diretório configurado exporta o texto do campo (em .docx, com Requisito/Critério em Título 2/3) e o anexo numa pasta datada', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Com Anexo', instituicao: 'X', anoFim: '2024', cargaHoraria: '40' }, {
            rsc: { conta: true, criterio: '1.3', jaUsado: false, dataInicio: '01/01/2023', dataFim: '01/06/2023' },
            evidencias: [{ basename: 'ev-abc123', ext: 'pdf', name: 'certificado.pdf', publica: false, tag: '' }],
        }),
    ];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page, { cargo: 'Assistente em Administração' });
    await page.evaluate(() => {
        window.Storage.hasDirectory = () => true;
        window.__saves = [];
        window.Storage.writeFile = async (filename, data, subdir) => { window.__saves.push({ filename, subdir, data: Array.from(data) }); };
        window.Storage.readAttachmentFile = async () => new Blob(['%PDF-1.4 conteúdo falso'], { type: 'application/pdf' });
    });
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);
    await page.fill('#rscMemorialTexto', 'Memorial final revisado.');
    await page.waitForTimeout(700);

    const criterioDesc = await page.evaluate(() => LzRSC.criterio('1.3').desc);

    await page.click('#btnRscMemorial');
    await page.waitForTimeout(300);

    const saves = await page.evaluate(() => window.__saves.map((s) => ({ filename: s.filename, subdir: s.subdir, bytes: s.data })));
    const hoje = new Date();
    const ddmmyyyy = String(hoje.getDate()).padStart(2, '0') + String(hoje.getMonth() + 1).padStart(2, '0') + hoje.getFullYear();
    const pastaEsperada = `Exportação/RSC-PCCTAE/${ddmmyyyy}`;

    const memorialSave = saves.find((s) => /^Memorial_/.test(s.filename));
    assert(memorialSave, 'Deveria ter salvo um arquivo "Memorial_*"');
    assert(memorialSave.filename.endsWith('.docx'), `O memorial deveria ser exportado em .docx — obtido "${memorialSave.filename}"`);
    assertEqual(memorialSave.subdir, pastaEsperada, 'O memorial deveria ir na pasta datada dentro de Exportação/RSC-PCCTAE');

    const xml = docxDocumentXml(memorialSave.bytes);
    assert(xml.includes('Memorial final revisado.'), 'O .docx deveria conter exatamente o texto do campo, não o modelo automático');
    const paras = docxParagraphs(xml);

    const reqPara = paras.find((p) => p.text.startsWith('REQUISITO'));
    assert(reqPara, 'Deveria haver um parágrafo de Requisito');
    assertEqual(reqPara.style, 'Heading2', 'O Requisito deveria usar o estilo nomeado "Heading2" (Título 2 no Word em português)');

    const critPara = paras.find((p) => p.text.includes(criterioDesc));
    assert(critPara, 'Deveria haver um parágrafo com a descrição do critério');
    assertEqual(critPara.style, 'Heading3', 'O Critério deveria usar o estilo nomeado "Heading3" (Título 3 no Word em português)');

    const itemPara = paras.find((p) => p.text.includes('Curso Com Anexo'));
    assert(itemPara, 'Deveria haver um parágrafo com o item');
    assert(itemPara.style !== 'Heading2' && itemPara.style !== 'Heading3', 'O item em si não deveria usar estilo de título');
    assert(itemPara.text.startsWith('001 — '), `O item deveria começar com o número do anexo "001 — " — obtido "${itemPara.text}"`);
    assert(itemPara.text.includes('01/01/2023') && itemPara.text.includes('01/06/2023'), 'O item deveria trazer o período (data)');
    assert(itemPara.text.includes('Carga horária: 40h'), 'O item deveria trazer a carga horária');

    const anexoSave = saves.find((s) => s.subdir === `${pastaEsperada}/Anexos`);
    assert(anexoSave, 'Deveria ter salvo o anexo do item na subpasta "Anexos"');
    assert(anexoSave.filename.startsWith('001 '), `O nome do arquivo deveria começar com "001 " (3 dígitos + espaço, sem hífen) — obtido "${anexoSave.filename}"`);
    assert(!anexoSave.filename.includes(' - '), `O nome do arquivo não deveria ter hífen — obtido "${anexoSave.filename}"`);
    assert(anexoSave.filename.includes('Curso Com Anexo'), 'O nome do arquivo do anexo deveria referenciar o título do item');
    assert(anexoSave.filename.endsWith('.pdf'), 'O anexo deveria manter a extensão .pdf');

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /memorial exportado/i.test(t)), 'Deveria confirmar que o memorial foi exportado');
});

test('RSC: "Gerar memorial" numera os anexos sequencialmente entre vários itens (001, 002…), sem repetir, e lista os 2 números no mesmo item', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Primeiro Item', instituicao: 'X', anoFim: '2024' }, {
            rsc: { conta: true, criterio: '1.3', jaUsado: false },
            evidencias: [{ basename: 'ev-um', ext: 'pdf', name: 'doc-um.pdf', publica: false, tag: '' }],
        }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Segundo Item', instituicao: 'X', anoFim: '2023' }, {
            rsc: { conta: true, criterio: '1.3', jaUsado: false },
            evidencias: [
                { basename: 'ev-dois-a', ext: 'pdf', name: 'doc-dois-a.pdf', publica: false, tag: '' },
                { basename: 'ev-dois-b', ext: 'jpg', name: 'doc-dois-b.jpg', publica: false, tag: '' },
            ],
        }),
    ];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page, { cargo: 'Assistente em Administração' });
    await page.evaluate(() => {
        window.Storage.hasDirectory = () => true;
        window.__saves = [];
        window.Storage.writeFile = async (filename, data, subdir) => { window.__saves.push({ filename, subdir, data: Array.from(data) }); };
        window.Storage.readAttachmentFile = async () => new Blob(['%PDF-1.4 conteúdo falso'], { type: 'application/pdf' });
    });
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);
    await page.fill('#rscMemorialTexto', 'Memorial com múltiplos anexos.');
    await page.waitForTimeout(700);

    await page.click('#btnRscMemorial');
    await page.waitForTimeout(300);

    const saves = await page.evaluate(() => window.__saves.map((s) => ({ filename: s.filename, subdir: s.subdir, bytes: s.data })));
    const anexos = saves.filter((s) => /Anexos$/.test(s.subdir)).map((s) => s.filename).sort();
    assertEqual(anexos.length, 3, 'Deveria ter exportado os 3 anexos-arquivo (1 do primeiro item + 2 do segundo)');
    assert(anexos[0].startsWith('001 '), `Primeiro anexo deveria ser "001 …" — obtido "${anexos[0]}"`);
    assert(anexos[1].startsWith('002 '), `Segundo anexo deveria ser "002 …" — obtido "${anexos[1]}"`);
    assert(anexos[2].startsWith('003 '), `Terceiro anexo deveria ser "003 …" — obtido "${anexos[2]}"`);

    const memorialSave = saves.find((s) => /^Memorial_/.test(s.filename));
    const xml = docxDocumentXml(memorialSave.bytes);
    const paras = docxParagraphs(xml);
    const item1 = paras.find((p) => p.text.includes('Primeiro Item'));
    const item2 = paras.find((p) => p.text.includes('Segundo Item'));
    assert(item1 && item1.text.startsWith('001 — '), `"Primeiro Item" deveria começar com "001 — " — obtido "${item1 && item1.text}"`);
    assert(item2 && item2.text.startsWith('002, 003 — '), `"Segundo Item" (2 anexos) deveria listar os 2 números "002, 003 — " — obtido "${item2 && item2.text}"`);
});
