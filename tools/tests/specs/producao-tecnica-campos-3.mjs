/* ==========================================================================
   lattesZen — Produção técnica (auditoria vs. Lattes real), sub-lote 3 (final):
   Manutenção de obra artística, Maquete, Entrevistas/mesas redondas/mídia,
   Relatório de pesquisa, Redes sociais/websites/blogs, Outra produção
   técnica — campos que faltavam e correção da conflação Natureza/Tema em
   Redes sociais (antes um único campo "Plataforma / Tema" alimentava os dois
   atributos de exportação).
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function selecionar(page, categoriaTxt, tipoTxt) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    const catVal = await page.$eval('#selCategoria', (sel, txt) => Array.from(sel.options).find((o) => o.textContent.includes(txt))?.value, categoriaTxt);
    await page.selectOption('#selCategoria', catVal);
    await page.waitForTimeout(150);
    const tipoVal = await page.$eval('#selTipo', (sel, txt) => Array.from(sel.options).find((o) => o.textContent.includes(txt))?.value, tipoTxt);
    await page.selectOption('#selTipo', tipoVal);
    await page.waitForTimeout(150);
}

test('Manutenção de obra artística: Tipo, Natureza, Nome/Autor/Ano da obra e Acervo salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Manutenção de obra artística');

    await page.fill('input[name="titulo"]', 'Restauro de escultura sacra');
    await page.fill('input[name="ano"]', '2021');
    await page.selectOption('select[name="tipo"]', 'Restauração');
    await page.selectOption('select[name="natureza"]', 'Escultura');
    await page.click('input[name="relevante"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="nomeObra"]', 'Nossa Senhora Aparecida');
    await page.fill('input[name="autorObra"]', 'Artista Anônimo');
    await page.fill('input[name="anoObra"]', '1850');
    await page.selectOption('select[name="acervo"]', 'Público');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'MANUTENCAO_OBRA');
    assert(!!item, 'A manutenção de obra deveria ter sido salva');
    assertEqual(item.fields.tipo, 'Restauração', 'Tipo deveria ser salvo');
    assertEqual(item.fields.natureza, 'Escultura', 'Natureza deveria ser salva');
    assertEqual(item.fields.nomeObra, 'Nossa Senhora Aparecida', 'Nome da obra deveria ser salvo');
    assertEqual(item.fields.autorObra, 'Artista Anônimo', 'Autor da obra deveria ser salvo');
    assertEqual(item.fields.acervo, 'Público', 'Acervo deveria ser salvo');
});

test('Maquete: Meio de divulgação, Objeto representado, Material utilizado e Instituição financiadora salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Maquete');

    await page.fill('input[name="titulo"]', 'Maquete do campus novo');
    await page.fill('input[name="ano"]', '2020');
    await page.selectOption('select[name="meioDivulgacao"]', 'Meio digital');
    await page.click('input[name="relevante"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="objetoRepresentado"]', 'Campus universitário');
    await page.fill('input[name="materialUtilizado"]', 'Isopor e MDF');
    await page.fill('input[name="instituicao"]', 'UNIFESP');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'MAQUETE');
    assert(!!item, 'A maquete deveria ter sido salva');
    assertEqual(item.fields.objetoRepresentado, 'Campus universitário', 'Objeto representado deveria ser salvo');
    assertEqual(item.fields.materialUtilizado, 'Isopor e MDF', 'Material utilizado deveria ser salvo');
    assertEqual(item.fields.instituicao, 'UNIFESP', 'Instituição financiadora deveria ser salva');
});

test('Entrevistas/mesas redondas/mídia: Natureza tem a opção "Outra" (antes ausente), Tema, Data de realização e Duração salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Entrevistas, mesas redondas');

    const opcoes = await page.locator('select[name="tipo"] option').allTextContents();
    assertEqual(opcoes.map((o) => o.trim()).filter((o) => o && o !== '—'), ['Entrevista', 'Mesa redonda', 'Comentário', 'Programa', 'Outra'],
        `Opções de Natureza incorretas — obtidas: ${JSON.stringify(opcoes)}`);

    await page.fill('input[name="titulo"]', 'Entrevista sobre mudanças climáticas');
    await page.fill('input[name="ano"]', '2022');
    await page.selectOption('select[name="tipo"]', 'Entrevista');
    await page.selectOption('select[name="meioDivulgacao"]', 'Meio digital');
    await page.click('input[name="relevante"]');
    await page.click('input[name="divulgacaoCT"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="tema"]', 'Aquecimento global');
    await page.fill('input[name="dataRealizacao"]', '15/03/2022');
    await page.fill('input[name="duracaoMinutos"]', '30');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'MIDIA');
    assert(!!item, 'A mídia deveria ter sido salva');
    assertEqual(item.fields.tema, 'Aquecimento global', 'Tema deveria ser salvo');
    assertEqual(item.fields.dataRealizacao, '15/03/2022', 'Data de realização deveria ser salva');
    assertEqual(item.fields.duracaoMinutos, '30', 'Duração (minutos) deveria ser salva');
});

test('Relatório de pesquisa: Nome do projeto, Número de páginas, Disponibilidade e Autores em lista salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Relatório de pesquisa');

    await page.fill('input[name="titulo"]', 'Relatório final do projeto X');
    await page.fill('input[name="ano"]', '2021');
    await page.selectOption('select[name="meioDivulgacao"]', 'Impresso');
    await page.click('input[name="relevante"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="nomeProjeto"]', 'Projeto X');
    await page.fill('input[name="paginas"]', '80');
    await page.fill('input[name="disponibilidade"]', 'Restrita');
    await page.fill('input[name="instituicao"]', 'FAPESP');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'RELATORIO_PESQUISA');
    assert(!!item, 'O relatório de pesquisa deveria ter sido salvo');
    assertEqual(item.fields.nomeProjeto, 'Projeto X', 'Nome do projeto deveria ser salvo');
    assertEqual(item.fields.paginas, '80', 'Número de páginas deveria ser salvo');
    assertEqual(item.fields.disponibilidade, 'Restrita', 'Disponibilidade deveria ser salva');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Fulano de Tal'], 'Autores (lista) deveria ter sido salvo');
});

test('Redes sociais, websites e blogs: Natureza (novo campo) e Tema (antigo "Plataforma / Tema", relabeled) são campos distintos', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Redes sociais, websites e blogs');

    const opcoesNatureza = await page.locator('select[name="natureza"] option').allTextContents();
    assertEqual(opcoesNatureza.map((o) => o.trim()).filter((o) => o && o !== '—'), ['Rede Social', 'Fórum', 'Blog', 'Site'],
        `Opções de Natureza incorretas — obtidas: ${JSON.stringify(opcoesNatureza)}`);
    const temTema = await page.locator('input[name="plataforma"]').count();
    assert(temTema > 0, 'Deveria ter o campo Tema (chave antiga "plataforma", relabeled)');

    await page.fill('input[name="titulo"]', 'Blog de divulgação científica');
    await page.fill('input[name="ano"]', '2020');
    await page.selectOption('select[name="natureza"]', 'Blog');
    await page.fill('input[name="plataforma"]', 'Divulgação científica');
    await page.click('input[name="relevante"]');
    await page.click('input[name="divulgacaoCT"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'MIDIA_SOCIAL');
    assert(!!item, 'A mídia social deveria ter sido salva');
    assertEqual(item.fields.natureza, 'Blog', 'Natureza deveria ser salva');
    assertEqual(item.fields.plataforma, 'Divulgação científica', 'Tema (campo plataforma) deveria ser salvo');
});

test('Outra produção técnica: Meio de divulgação, Instituição promotora e Local salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Outra produção técnica');

    await page.fill('input[name="titulo"]', 'Consultoria técnica avulsa');
    await page.fill('input[name="ano"]', '2019');
    await page.fill('input[name="natureza"]', 'Vistoria técnica');
    await page.selectOption('select[name="meioDivulgacao"]', 'Impresso');
    await page.click('input[name="relevante"]');
    await page.click('input[name="divulgacaoCT"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="instituicao"]', 'Prefeitura Municipal');
    await page.fill('input[name="local"]', 'Sede administrativa');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'OUTRA_TECNICA');
    assert(!!item, 'A outra produção técnica deveria ter sido salva');
    assertEqual(item.fields.instituicao, 'Prefeitura Municipal', 'Instituição promotora deveria ser salva');
    assertEqual(item.fields.local, 'Sede administrativa', 'Local deveria ser salvo');
});
