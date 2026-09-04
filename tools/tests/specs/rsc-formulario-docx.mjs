/* ==========================================================================
   Regressão: formulário padrão RSC-PCCTAE em .docx (issue #40) — o antigo
   "Gerar formulário" baixava um .txt; agora gera um .docx de verdade (ZIP +
   OOXML, sem bibliotecas externas — ver src/js/docx-export.js). "Gerar
   memorial, formulário e anexos" (botão único — issue de unificação) grava
   memorial, formulário e os PDFs juntos, na mesma pasta datada dentro de
   "Exportação/RSC-PCCTAE" do diretório configurado.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

test('Com diretório configurado, o formulário é salvo como .docx válido, numa pasta datada, com os documentos comprobatórios numerados', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal Teste' }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso RSC Docx', instituicao: 'X', anoFim: '2024' }, {
            rsc: { conta: true, criterio: '1.3', jaUsado: false },
            evidencias: [{ basename: 'ev-form', ext: 'pdf', name: 'certificado.pdf', publica: false, tag: '' }],
        }),
    ];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page, {
        cargo: 'Assistente em Administração', nivelClassificacao: 'D', funcaoEncargo: 'Chefe de Setor',
        telefone: '(11) 1234-5678', email: 'fulano@ife.gov.br', saldoAnterior: '2,5', processoAnterior: '23000.000001/2020-00',
    });
    await page.evaluate(() => {
        window.Storage.hasDirectory = () => true;
        window.__saves = [];
        window.Storage.writeFile = async (filename, data, subdir) => { window.__saves.push({ filename, subdir, bytes: Array.from(data) }); };
        window.Storage.readAttachmentFile = async () => new Blob(['%PDF-1.4 conteúdo falso'], { type: 'application/pdf' });
    });
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);

    await page.click('#btnRscExportar');
    await page.waitForTimeout(300);

    const saves = await page.evaluate(() => window.__saves);
    const hoje = new Date();
    const ddmmyyyy = String(hoje.getDate()).padStart(2, '0') + String(hoje.getMonth() + 1).padStart(2, '0') + hoje.getFullYear();
    const pastaEsperada = `Exportação/RSC-PCCTAE/${ddmmyyyy}`;

    const saved = saves.find((s) => /^RSC_/.test(s.filename));
    assert(saved, 'Deveria ter salvo o arquivo do formulário ("RSC_*")');
    assertEqual(saved.subdir, pastaEsperada, 'O formulário deveria ir na mesma pasta datada do memorial/anexos, não direto em "Exportação/RSC-PCCTAE"');
    assert(saved.filename.endsWith('.docx'), `Nome do arquivo deveria terminar em .docx — obtido "${saved.filename}"`);
    assertEqual(saved.filename, `RSC_Fulano de Tal Teste_${ddmmyyyy}.docx`, 'Nome do arquivo deveria seguir o padrão RSC_NomeCompleto_ddmmyyyy.docx (issue reportada pelo usuário)');

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /memorial e formulário exportados/i.test(t)), 'Deveria confirmar que memorial e formulário foram exportados juntos');

    // Valida de verdade que os bytes formam um .docx (ZIP + OOXML) abrível.
    const dir = mkdtempSync(join(tmpdir(), 'lz-docx-'));
    const path = join(dir, 'formulario.docx');
    writeFileSync(path, Buffer.from(saved.bytes));

    const zipOk = execFileSync('python3', ['-c', `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
bad = z.testzip()
names = z.namelist()
assert bad is None, f"zip corrompido em {bad}"
for req in ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']:
    assert req in names, f"faltando {req}"
doc = z.read('word/document.xml').decode('utf-8')
print(doc)
`, path]).toString('utf-8');

    assert(!/&lt;w:(r|t|rPr)&gt;/.test(zipOk), 'document.xml não deveria conter marcação OOXML escapada como texto literal (heading()/cell() re-escapando um <w:r> já pronto)');
    assert(zipOk.includes('Requerimento de Reconhecimento de Saberes e Competências'), 'document.xml deveria conter o título do formulário');
    assert(zipOk.includes('Participação como membro de núcleos'), 'document.xml deveria listar a descrição do critério 1.3 do item cadastrado');
    assert(zipOk.includes('Chefe de Setor'), 'document.xml deveria conter a Função/Encargo configurada');
    assert(zipOk.includes('(X) D'), 'document.xml deveria marcar o Nível de Classificação "D"');
    assert(zipOk.includes('(11) 1234-5678'), 'document.xml deveria conter o Telefone (campo separado do E-mail)');
    assert(zipOk.includes('fulano@ife.gov.br'), 'document.xml deveria conter o E-mail (campo separado do Telefone)');
    assert(zipOk.includes('Assinatura'), 'document.xml deveria conter a linha de assinatura');

    // "Documentos comprobatórios (anexos)": mesmo identificador (3 dígitos +
    // nome) usado no PDF exportado de verdade — dá pra cruzar um com o outro.
    const anexoSave = saves.find((s) => s.subdir === `${pastaEsperada}/Anexos`);
    assert(anexoSave, 'Deveria ter exportado também o PDF do item na subpasta "Anexos"');
    assertEqual(anexoSave.filename, '001 Curso RSC Docx.pdf', 'O nome do PDF deveria ser "001 Curso RSC Docx.pdf" (3 dígitos + espaço, sem hífen)');
    assert(zipOk.includes('001 Curso RSC Docx.pdf'), 'A coluna "Documentos comprobatórios" do formulário deveria citar o mesmo identificador do PDF exportado');
});
