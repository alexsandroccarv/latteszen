/* ==========================================================================
   Regressão: importar publicações do ORCID (issue #7)
   --------------------------------------------------------------------------
   A API pública do ORCID é mockada via page.route (não há como testar contra
   o serviço real no CI) — devolve 3 obras: um artigo de periódico (com DOI e
   periódico), um capítulo de livro, e um tipo de obra sem mapeamento
   conhecido (deve cair no tipo-catálogo OUTRA_BIBLIOGRAFICA). Reaproveita a
   mesma deduplicação por assinatura de conteúdo já usada no import de XML.
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

const ORCID_ID = '0000-0002-1825-0097';
const ORCID_FIXTURE = {
    group: [
        {
            'work-summary': [{
                'put-code': 111,
                title: { title: { value: 'Um artigo de teste' } },
                type: 'journal-article',
                'publication-date': { year: { value: '2022' } },
                'journal-title': { value: 'Revista de Teste' },
                'external-ids': { 'external-id': [{ 'external-id-type': 'doi', 'external-id-value': '10.1000/teste123' }] },
            }],
        },
        {
            'work-summary': [{
                'put-code': 222,
                title: { title: { value: 'Um capítulo de livro de teste' } },
                type: 'book-chapter',
                'publication-date': { year: { value: '2021' } },
                'external-ids': { 'external-id': [] },
                url: { value: 'https://example.org/cap' },
            }],
        },
        {
            'work-summary': [{
                'put-code': 333,
                title: { title: { value: 'Um tipo de obra desconhecido' } },
                type: 'algum-tipo-nao-mapeado',
                'publication-date': { year: { value: '2020' } },
                'external-ids': { 'external-id': [] },
            }],
        },
    ],
};

async function mockOrcid(page) {
    await page.route('https://pub.orcid.org/**', (route) => {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ORCID_FIXTURE) });
    });
}

async function abrirConfigECOrcid(page, baseUrl) {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
}

test('ORCID iD inválido mostra erro e não busca nada', async ({ page, baseUrl }) => {
    await abrirConfigECOrcid(page, baseUrl);
    await page.fill('#orcidInput', 'não-é-um-orcid');
    await page.click('#btnOrcidBuscar');
    await page.waitForTimeout(300);
    const resultVazio = await page.$eval('#orcidResult', (el) => el.innerHTML.trim());
    assertEqual(resultVazio, '', 'Com ORCID inválido, a área de resultado não deveria ser preenchida');
});

test('Busca no ORCID lista as obras e infere o tipo de cada uma', async ({ page, baseUrl }) => {
    await mockOrcid(page);
    await abrirConfigECOrcid(page, baseUrl);
    await page.fill('#orcidInput', ORCID_ID);
    await page.click('#btnOrcidBuscar');
    await page.waitForTimeout(400);

    const texto = await page.$eval('#orcidResult', (el) => el.textContent);
    assert(texto.includes('3 obra(s) encontrada(s)'), 'Deveria informar 3 obras encontradas');
    assert(texto.includes('3 novas'), 'As 3 obras deveriam aparecer como novas (catálogo vazio)');
    assert(texto.includes('Um artigo de teste'), 'Deveria listar o artigo de periódico');
    assert(texto.includes('Artigos completos publicados em periódicos'), 'O artigo deveria ser mapeado para ARTIGO_PERIODICO');
    assert(texto.includes('Um capítulo de livro de teste') && texto.includes('Capítulos'), 'O capítulo deveria ser mapeado para CAPITULOS_LIVRO');
    assert(texto.includes('Um tipo de obra desconhecido') && texto.includes('Outra produção bibliográfica'), 'Tipo desconhecido deveria cair no catch-all OUTRA_BIBLIOGRAFICA');
});

test('Importar selecionados grava os itens com os campos extraídos do ORCID', async ({ page, baseUrl }) => {
    await mockOrcid(page);
    await abrirConfigECOrcid(page, baseUrl);
    await page.fill('#orcidInput', ORCID_ID);
    await page.click('#btnOrcidBuscar');
    await page.waitForTimeout(400);
    await page.click('#btnOrcidImport');
    await page.waitForTimeout(300);

    const catalogo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    assertEqual(catalogo.length, 3, 'Deveria ter importado as 3 obras');
    const artigo = catalogo.find((i) => i.fields.titulo === 'Um artigo de teste');
    assert(artigo, 'O artigo importado deveria existir no catálogo');
    assertEqual(artigo.typeKey, 'ARTIGO_PERIODICO', 'O artigo deveria ter sido salvo como ARTIGO_PERIODICO');
    assertEqual(artigo.fields.periodico, 'Revista de Teste', 'O nome do periódico deveria ter sido extraído');
    assertEqual(artigo.fields.doi, '10.1000/teste123', 'O DOI deveria ter sido extraído dos external-ids');
    assertEqual(artigo.fields.ano, '2022', 'O ano de publicação deveria ter sido extraído');
    assertEqual(artigo.source, 'orcid', 'O item importado deveria registrar source: orcid');
    assert(artigo.lattesItem === true, 'Publicação importada do ORCID deveria contar como item do Lattes (lattesItem: true)');
});

test('Reimportar as mesmas obras do ORCID não duplica (dedup por assinatura)', async ({ page, baseUrl }) => {
    await mockOrcid(page);
    await abrirConfigECOrcid(page, baseUrl);
    await page.fill('#orcidInput', ORCID_ID);
    await page.click('#btnOrcidBuscar');
    await page.waitForTimeout(400);
    await page.click('#btnOrcidImport');
    await page.waitForTimeout(300);

    // Busca de novo e tenta importar tudo outra vez.
    await page.click('#btnOrcidBuscar');
    await page.waitForTimeout(400);
    const textoSegunda = await page.$eval('#orcidResult', (el) => el.textContent);
    assert(textoSegunda.includes('0 novas'), 'Na segunda busca, as 3 obras já deveriam aparecer como "já catalogadas"');

    await page.click('#btnOrcidSelAll');
    await page.click('#btnOrcidImport');
    await page.waitForTimeout(300);
    const catalogo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    assertEqual(catalogo.length, 3, 'Reimportar as mesmas obras não deveria duplicar itens no catálogo');
});
