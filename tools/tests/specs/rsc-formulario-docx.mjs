/* ==========================================================================
   Regressão: formulário padrão RSC-PCCTAE em .docx (issue #40) — o antigo
   "Gerar formulário" baixava um .txt; agora gera um .docx de verdade (ZIP +
   OOXML, sem bibliotecas externas — ver src/js/docx-export.js) e grava
   direto na pasta "Exportação/RSC-PCCTAE" do diretório configurado, em vez
   de disparar um download do navegador.
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

test('Sem diretório configurado, "Salvar formulário" avisa e não grava nada', async ({ page, baseUrl }) => {
    const items = [makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso RSC Docx', instituicao: 'X', anoFim: '2024' },
        { rsc: { conta: true, criterio: '1.3', jaUsado: false } })];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page, { cargo: 'Assistente em Administração' });
    await page.evaluate(() => { window.Storage.writeFile = async () => { throw new Error('não deveria ser chamado'); }; });
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);

    await page.click('#btnRscForm');
    await page.waitForTimeout(300);
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /configure um diretório/i.test(t)), 'Deveria avisar que é preciso configurar um diretório');
});

test('Com diretório configurado, o formulário é salvo como .docx válido em "Exportação/RSC-PCCTAE"', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal Teste' }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso RSC Docx', instituicao: 'X', anoFim: '2024' },
            { rsc: { conta: true, criterio: '1.3', jaUsado: false } }),
    ];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page, {
        cargo: 'Assistente em Administração', nivelClassificacao: 'D', funcaoEncargo: 'Chefe de Setor',
        telefone: '(11) 1234-5678', email: 'fulano@ife.gov.br', saldoAnterior: '2,5', processoAnterior: '23000.000001/2020-00',
    });
    await page.evaluate(() => {
        window.Storage.hasDirectory = () => true;
        window.Storage.writeFile = async (filename, data, subdir) => {
            window.__saved = { filename, subdir, bytes: Array.from(data) };
        };
    });
    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);

    await page.click('#btnRscForm');
    await page.waitForTimeout(300);

    const saved = await page.evaluate(() => window.__saved);
    assert(saved, 'Storage.writeFile deveria ter sido chamado');
    assertEqual(saved.subdir, 'Exportação/RSC-PCCTAE', 'Pasta de exportação');
    assert(saved.filename.endsWith('.docx'), `Nome do arquivo deveria terminar em .docx — obtido "${saved.filename}"`);

    const hoje = new Date();
    const ddmmyyyy = String(hoje.getDate()).padStart(2, '0') + String(hoje.getMonth() + 1).padStart(2, '0') + hoje.getFullYear();
    assertEqual(saved.filename, `RSC_Fulano de Tal Teste_${ddmmyyyy}.docx`, 'Nome do arquivo deveria seguir o padrão RSC_NomeCompleto_ddmmyyyy.docx (issue reportada pelo usuário)');

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /formulário salvo/i.test(t)), 'Deveria confirmar que o formulário foi salvo');

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
});
