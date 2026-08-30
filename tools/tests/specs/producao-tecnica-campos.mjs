/* ==========================================================================
   lattesZen — Produção técnica (auditoria vs. Lattes real), sub-lote 1:
   Assessoria e consultoria, Extensão tecnológica, Produtos, Processos ou
   técnicas, Trabalhos técnicos — campos que faltavam (Meio de divulgação,
   10 mais relevantes?, potencial de inovação, Autores em lista,
   duração/páginas/disponibilidade, Palavras-chave/Área/Setores/Outras
   informações) e a distinção Tipo vs. Natureza em Produtos.
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

test('Assessoria e consultoria: novos campos (Meio de divulgação, relevante, Autores em lista, duração/páginas/disponibilidade, palavras-chave) salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Assessoria e consultoria');

    await page.fill('input[name="titulo"]', 'Consultoria em TI');
    await page.fill('input[name="ano"]', '2022');
    await page.selectOption('select[name="meioDivulgacao"]', 'Meio digital');
    await page.click('input[name="relevante"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="duracaoMeses"]', '6');
    await page.fill('input[name="paginas"]', '30');
    await page.fill('input[name="disponibilidade"]', 'Sob solicitação');
    await page.fill('textarea[name="palavrasChave"]', 'ti; consultoria');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'ASSESSORIA_CONSULTORIA');
    assert(!!item, 'A assessoria/consultoria deveria ter sido salva');
    assertEqual(item.fields.meioDivulgacao, 'Meio digital', 'Meio de divulgação deveria ser salvo');
    assertEqual(item.fields.relevante, 'Sim', 'Relevante deveria ser salvo como Sim');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Fulano de Tal'], 'Autores (lista) deveria ter sido salvo');
    assertEqual(item.fields.duracaoMeses, '6', 'Duração (meses) deveria ser salva');
    assertEqual(item.fields.disponibilidade, 'Sob solicitação', 'Disponibilidade deveria ser salva');
});

test('Extensão tecnológica: novos campos salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Extensão tecnológica');

    await page.fill('input[name="titulo"]', 'Extensão em manejo agrícola');
    await page.fill('input[name="ano"]', '2021');
    await page.selectOption('select[name="meioDivulgacao"]', 'Impresso');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Beltrano');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="cidade"]', 'Ribeirão Preto');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'EXTENSAO_TECNOLOGICA');
    assert(!!item, 'A extensão tecnológica deveria ter sido salva');
    assertEqual(item.fields.meioDivulgacao, 'Impresso', 'Meio de divulgação deveria ser salvo');
    assertEqual(item.fields.cidade, 'Ribeirão Preto', 'Cidade deveria ser salva');
});

test('Produtos: Tipo e Natureza são campos distintos, e ambos salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Produtos');

    const opcoesTipo = await page.locator('select[name="natureza"] option').allTextContents();
    assertEqual(opcoesTipo.map((o) => o.trim()).filter((o) => o && o !== '—'), ['Piloto', 'Projeto', 'Protótipo', 'Outro'],
        `Opções de Tipo (Produtos) incorretas — obtidas: ${JSON.stringify(opcoesTipo)}`);
    const opcoesNatureza = await page.locator('select[name="naturezaProduto"] option').allTextContents();
    assertEqual(opcoesNatureza.map((o) => o.trim()).filter((o) => o && o !== '—'), ['Aparelho', 'Equipamento', 'Fármacos e similares', 'Instrumento', 'Outra'],
        `Opções de Natureza (Produtos) incorretas — obtidas: ${JSON.stringify(opcoesNatureza)}`);

    await page.fill('input[name="titulo"]', 'Sensor de umidade');
    await page.fill('input[name="ano"]', '2023');
    await page.selectOption('select[name="natureza"]', 'Protótipo');
    await page.selectOption('select[name="naturezaProduto"]', 'Instrumento');
    await page.click('input[name="relevante"]');
    await page.click('input[name="potencialInovacao"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="registro"]', 'INPI 123456');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'PRODUTO_TECNOLOGICO');
    assert(!!item, 'O produto deveria ter sido salvo');
    assertEqual(item.fields.natureza, 'Protótipo', 'Tipo deveria ser salvo');
    assertEqual(item.fields.naturezaProduto, 'Instrumento', 'Natureza deveria ser salva separadamente do Tipo');
    assertEqual(item.fields.potencialInovacao, 'Sim', 'Potencial de inovação deveria ser salvo como Sim');
    assertEqual(item.fields.registro, 'INPI 123456', 'Registro deveria ser salvo');
});

test('Processos ou técnicas: novos campos salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Processos ou técnicas');

    await page.fill('input[name="titulo"]', 'Técnica de extração');
    await page.fill('input[name="ano"]', '2022');
    await page.selectOption('select[name="natureza"]', 'Instrumental');
    await page.click('input[name="potencialInovacao"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="disponibilidade"]', 'Restrita');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'PROCESSO_TECNICA');
    assert(!!item, 'O processo/técnica deveria ter sido salvo');
    assertEqual(item.fields.natureza, 'Instrumental', 'Natureza deveria ser salva');
    assertEqual(item.fields.potencialInovacao, 'Sim', 'Potencial de inovação deveria ser salvo como Sim');
    assertEqual(item.fields.disponibilidade, 'Restrita', 'Disponibilidade deveria ser salva');
});

test('Trabalhos técnicos: "Extensão tecnológica" é uma opção válida de Natureza (junto com Serviços na área da saúde, antes ausentes)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Trabalhos técnicos');

    const opcoes = await page.locator('select[name="natureza"] option').allTextContents();
    assertEqual(opcoes.map((o) => o.trim()).filter((o) => o && o !== '—'),
        ['Parecer', 'Elaboração de projeto', 'Relatório técnico', 'Serviços na área da saúde', 'Extensão tecnológica', 'Outra'],
        `Opções de Natureza (Trabalhos técnicos) incorretas — obtidas: ${JSON.stringify(opcoes)}`);

    await page.fill('input[name="titulo"]', 'Trabalho técnico ET');
    await page.fill('input[name="ano"]', '2020');
    await page.selectOption('select[name="natureza"]', 'Extensão tecnológica');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Ciclana');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="duracaoMeses"]', '2');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'TRABALHO_TECNICO');
    assert(!!item, 'O trabalho técnico deveria ter sido salvo');
    assertEqual(item.fields.natureza, 'Extensão tecnológica', 'Natureza deveria ser salva como escolhida na tela (degradação pra "Outra" só acontece na exportação XML, não no armazenamento)');
});
