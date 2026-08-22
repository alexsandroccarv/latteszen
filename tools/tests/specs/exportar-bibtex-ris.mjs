/* ==========================================================================
   Regressão: exportar publicações para BibTeX/RIS
   --------------------------------------------------------------------------
   Par inverso da importação (issue #6): gera .bib/.ris a partir do catálogo,
   só para os 5 tipos reconhecidos na importação (round-trip simétrico).
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';
import { readFileSync } from 'node:fs';

async function abrirConfig(page, baseUrl) {
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
}

test('Exportar .bib gera um artigo com os campos esperados e ignora tipo não mapeado', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', {
            titulo: 'Um Artigo Exportável', ano: '2022', periodico: 'Revista X', doi: '10.1000/export1',
            autoresLista: [{ nomeCompleto: 'Maria Autora', nomeCitacao: '' }],
        }),
        makeItem('FORMACAO_ACADEMICA', 'FORMACAO', { instituicao: 'Universidade Y', anoInicio: '2010', anoFim: '2014' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await abrirConfig(page, baseUrl);

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('#btnBibExportBib'),
    ]);
    const path = await download.path();
    const conteudo = readFileSync(path, 'utf-8');

    assert(conteudo.includes('@article{'), 'Deveria gerar uma entrada @article');
    assert(conteudo.includes('title = {Um Artigo Exportável}'), 'Título deveria estar no .bib gerado');
    assert(conteudo.includes('author = {Autora, Maria}'), 'Autor deveria estar no formato "Sobrenome, Nome"');
    assert(conteudo.includes('year = {2022}'), 'Ano deveria estar presente');
    assert(conteudo.includes('journal = {Revista X}'), 'Periódico deveria estar presente');
    assert(conteudo.includes('doi = {10.1000/export1}'), 'DOI deveria estar presente');
    assert(!conteudo.includes('Universidade Y'), 'Item de Formação (tipo não mapeado) não deveria entrar na exportação');

    const status = await page.$eval('#bibExportStatus', (el) => el.textContent);
    assert(status.includes('1 publicação'), 'Deveria informar 1 publicação exportada');
});

test('Exportar .ris gera as tags esperadas', async ({ page, baseUrl }) => {
    const items = [makeItem('LIVROS', 'PRODUCOES', {
        titulo: 'Um Livro Exportável', ano: '2021', editora: 'Editora Z', isbn: '978-0-000000-1-1',
        autoresLista: [{ nomeCompleto: 'João da Silva', nomeCitacao: '' }],
    })];
    await seedCatalog(page, baseUrl, items);
    await abrirConfig(page, baseUrl);

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('#btnBibExportRis'),
    ]);
    const conteudo = readFileSync(await download.path(), 'utf-8');

    assert(conteudo.includes('TY  - BOOK'), 'Deveria gerar o tipo BOOK');
    assert(conteudo.includes('AU  - Silva, João da'), 'Autor deveria estar no formato "Sobrenome, Nome"');
    assert(conteudo.includes('TI  - Um Livro Exportável'), 'Título deveria estar presente');
    assert(conteudo.includes('PY  - 2021'), 'Ano deveria estar presente');
    assert(conteudo.includes('PB  - Editora Z'), 'Editora deveria estar presente');
    assert(conteudo.includes('SN  - 978-0-000000-1-1'), 'ISBN deveria estar presente (via SN)');
    assert(conteudo.includes('ER  -'), 'Registro deveria ser encerrado com ER');
});

test('Exportar sem publicações elegíveis não baixa nada e avisa', async ({ page, baseUrl }) => {
    const items = [makeItem('FORMACAO_ACADEMICA', 'FORMACAO', { instituicao: 'Universidade Y', anoInicio: '2010', anoFim: '2014' })];
    await seedCatalog(page, baseUrl, items);
    await abrirConfig(page, baseUrl);

    await page.click('#btnBibExportBib');
    await page.waitForTimeout(300);
    const status = await page.$eval('#bibExportStatus', (el) => el.textContent);
    assert(status.includes('Nenhuma publicação'), 'Deveria avisar que não há publicação exportável no catálogo');
});

test('Publicação exportada em .bib pode ser reimportada (round-trip)', async ({ page, baseUrl }) => {
    const items = [makeItem('ARTIGO_PERIODICO', 'PRODUCOES', {
        titulo: 'Artigo Round-trip', ano: '2023', periodico: 'Revista Round-trip', doi: '10.1000/roundtrip',
        autoresLista: [{ nomeCompleto: 'Ana Pesquisadora', nomeCitacao: '' }],
    })];
    await seedCatalog(page, baseUrl, items);
    await abrirConfig(page, baseUrl);

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('#btnBibExportBib'),
    ]);
    const conteudo = readFileSync(await download.path(), 'utf-8');

    const parsed = await page.evaluate((texto) => window.LzBibRis.parse(texto), conteudo);
    assertEqual(parsed.formato, 'bibtex', 'O arquivo exportado deveria ser reconhecido como BibTeX ao reimportar');
    assertEqual(parsed.entradas.length, 1, 'Deveria reconhecer a mesma entrada exportada');
    assertEqual(parsed.entradas[0].titulo, 'Artigo Round-trip', 'Título deveria sobreviver ao round-trip exportar→importar');
    assertEqual(parsed.entradas[0].autores, ['Ana Pesquisadora'], 'Autor deveria sobreviver ao round-trip (Sobrenome, Nome → Nome Sobrenome)');
});
