/* ==========================================================================
   Regressão: importar publicações via BibTeX/RIS (issue #6)
   --------------------------------------------------------------------------
   O parse é 100% local (window.LzBibRis, sem rede) — o teste só precisa
   simular o upload de um arquivo (page.setInputFiles com buffer em memória).
   Reaproveita a mesma deduplicação por assinatura de conteúdo já usada no
   import de XML/ORCID.
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

const BIB_SAMPLE = `
@article{smith2020,
  title = {Um Artigo de Teste},
  author = {Smith, John and Doe, Jane},
  year = {2020},
  journal = {Revista de Teste},
  volume = {10},
  number = {2},
  pages = {100--115},
  issn = {1234-5678},
  doi = {10.1000/bibtexteste}
}

@phdthesis{unmapped2018,
  title = {Uma Tese Sem Mapeamento},
  author = {Nobody, N.},
  year = {2018}
}
`;

const RIS_SAMPLE = `
TY  - JOUR
AU  - Smith, John
TI  - Um Artigo Via RIS
T2  - Revista RIS de Teste
PY  - 2021
VL  - 5
IS  - 1
SP  - 20
EP  - 35
DO  - 10.2000/risteste
ER  -
`;

async function abrirConfig(page, baseUrl) {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
}

async function enviarArquivo(page, nome, conteudo) {
    await page.setInputFiles('#bibInput', { name: nome, mimeType: 'text/plain', buffer: Buffer.from(conteudo, 'utf-8') });
    await page.waitForTimeout(300);
}

test('Upload de .bib lista as entradas mapeadas e avisa sobre as sem mapeamento', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    await enviarArquivo(page, 'amostra.bib', BIB_SAMPLE);

    const texto = await page.$eval('#bibResult', (el) => el.textContent);
    assert(texto.includes('1 obra(s) reconhecida(s) (BIBTEX)'), 'Deveria reconhecer 1 obra mapeada (o @article)');
    assert(texto.includes('1 novas'), 'A obra mapeada deveria aparecer como nova (catálogo vazio)');
    assert(texto.includes('Um Artigo de Teste'), 'Deveria listar o artigo mapeado');
    assert(texto.includes('entrada(s) sem tipo correspondente') && texto.includes('Uma Tese Sem Mapeamento'), 'Deveria avisar sobre a tese (phdthesis) sem mapeamento, sem incluí-la na lista de importação');
});

test('Importar selecionados grava os campos extraídos do BibTeX', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    await enviarArquivo(page, 'amostra.bib', BIB_SAMPLE);
    await page.click('#btnBibImport');
    await page.waitForTimeout(300);

    const catalogo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    assertEqual(catalogo.length, 1, 'Só a entrada mapeada (article) deveria ter sido importada — a tese fica de fora');
    const artigo = catalogo[0];
    assertEqual(artigo.typeKey, 'ARTIGO_PERIODICO', 'Entrada @article deveria virar ARTIGO_PERIODICO');
    assertEqual(artigo.fields.titulo, 'Um Artigo de Teste', 'Título deveria ter sido extraído');
    assertEqual(artigo.fields.periodico, 'Revista de Teste', 'Periódico (journal) deveria ter sido extraído');
    assertEqual(artigo.fields.volume, '10', 'Volume deveria ter sido extraído');
    assertEqual(artigo.fields.fasciculo, '2', 'Fascículo (number) deveria ter sido extraído');
    assertEqual(artigo.fields.paginaInicial, '100', 'Página inicial deveria ter sido extraída de "pages"');
    assertEqual(artigo.fields.paginaFinal, '115', 'Página final deveria ter sido extraída de "pages"');
    assertEqual(artigo.fields.doi, '10.1000/bibtexteste', 'DOI deveria ter sido extraído');
    const autores = artigo.fields.autoresLista.map((a) => a.nomeCompleto);
    assertEqual(autores, ['John Smith', 'Jane Doe'], 'Autores "Sobrenome, Nome and Sobrenome, Nome" deveriam virar "Nome Sobrenome" na ordem natural');
    assertEqual(artigo.source, 'bibtex', 'Item importado deveria registrar source: bibtex');
});

test('Upload de .ris reconhece o tipo JOUR e preenche os campos', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    await enviarArquivo(page, 'amostra.ris', RIS_SAMPLE);
    const texto = await page.$eval('#bibResult', (el) => el.textContent);
    assert(texto.includes('1 obra(s) reconhecida(s) (RIS)'), 'Deveria reconhecer 1 obra no formato RIS');

    await page.click('#btnBibImport');
    await page.waitForTimeout(300);
    const catalogo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const artigo = catalogo.find((i) => i.fields.titulo === 'Um Artigo Via RIS');
    assert(artigo, 'Artigo do RIS deveria ter sido importado');
    assertEqual(artigo.typeKey, 'ARTIGO_PERIODICO', 'TY JOUR deveria virar ARTIGO_PERIODICO');
    assertEqual(artigo.fields.periodico, 'Revista RIS de Teste', 'Periódico (T2) deveria ter sido extraído');
    assertEqual(artigo.fields.paginaInicial, '20', 'Página inicial (SP) deveria ter sido extraída');
    assertEqual(artigo.fields.paginaFinal, '35', 'Página final (EP) deveria ter sido extraída');
    assertEqual(artigo.source, 'ris', 'Item importado do RIS deveria registrar source: ris');
});

test('Reimportar o mesmo arquivo BibTeX não duplica (dedup por assinatura)', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    await enviarArquivo(page, 'amostra.bib', BIB_SAMPLE);
    await page.click('#btnBibImport');
    await page.waitForTimeout(300);

    await enviarArquivo(page, 'amostra.bib', BIB_SAMPLE);
    const texto = await page.$eval('#bibResult', (el) => el.textContent);
    assert(texto.includes('0 novas'), 'Na segunda vez, a obra já deveria aparecer como "já catalogada"');

    await page.click('#btnBibSelAll');
    await page.click('#btnBibImport');
    await page.waitForTimeout(300);
    const catalogo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    assertEqual(catalogo.length, 1, 'Reimportar o mesmo arquivo não deveria duplicar o item no catálogo');
});

test('Arquivo em formato não reconhecido mostra mensagem de erro', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    await enviarArquivo(page, 'lixo.txt', 'isto não é nem BibTeX nem RIS, só texto qualquer.');
    const texto = await page.$eval('#bibResult', (el) => el.textContent);
    assert(texto.includes('Não foi possível reconhecer o formato'), 'Deveria avisar que o formato do arquivo não foi reconhecido');
});
