/* ==========================================================================
   Regressão: estratégia "candidatos à Progressão" (mesmo padrão do RSC-PCCTAE)
   --------------------------------------------------------------------------
   Checkbox "usar na Progressão" no bloco de Visibilidade (tab-catalogar.js),
   mesmo mecanismo do "usar para RSC" (#rscConta — ver visibilidade.mjs): só
   aparece com o módulo habilitado E o typeKey mapeado no memorial da CPPD
   (ver progressao-mapeamento.js). Itens "verde" (correspondência direta) só
   precisam do checkbox; "amarelo" (com lacunas) também, por enquanto — os
   campos complementares ficam para uma etapa futura. A aba Progressão
   Docente lista esses itens como "candidatos", filtrados pela data da
   última progressão.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog, makeItem } from '../harness.mjs';

async function habilitarProgressao(page, cfg) {
    await page.evaluate((c) => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.progressaoEnabled = true;
        if (c) s.progressao = c;
        localStorage.setItem('lz_settings', JSON.stringify(s));
    }, cfg || null);
    await page.reload();
    await page.waitForTimeout(500);
}

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

test('Sem o módulo Progressão habilitado, não aparece o checkbox "usar na Progressão"', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selectTipo(page, 'Formação', 'Formação complementar');
    assertEqual(await page.locator('#visibilidadeBlock #progressaoUsar').count(), 0, 'Sem Progressão habilitado, "usar na Progressão" não deveria existir');
});

test('Com Progressão habilitado + tipo mapeado no memorial, "Publicar" ganha o checkbox "usar na Progressão"', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await habilitarProgressao(page);
    await selectTipo(page, 'Formação', 'Formação complementar'); // FORMACAO_COMPLEMENTAR — verde no mapeamento
    const info = await page.evaluate(() => {
        const box = document.querySelector('#visibilidadeBlock');
        const label = Array.from(box.querySelectorAll('label')).find((l) => l.textContent.includes('usar na Progressão'));
        return {
            existe: !!box.querySelector('#progressaoUsar'),
            icone: label ? !!label.querySelector('i.fa-arrow-up-right-dots') : false,
        };
    });
    assert(info.existe, 'O checkbox "usar na Progressão" (#progressaoUsar) deveria existir');
    assert(info.icone, 'Checkbox "usar na Progressão" deveria ter o ícone fa-arrow-up-right-dots');
});

test('Com Progressão habilitado, um tipo SEM correspondência no memorial (ex.: Idiomas) não mostra o checkbox', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await habilitarProgressao(page);
    await selectTipo(page, 'Dados gerais', 'Idiomas');
    assertEqual(await page.locator('#visibilidadeBlock #progressaoUsar').count(), 0, 'IDIOMAS não está mapeado no memorial — não deveria ter o checkbox');
});

test('Marcar "usar na Progressão" e salvar persiste item.progressao.usar', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await habilitarProgressao(page);
    await selectTipo(page, 'Formação', 'Formação complementar');
    await page.fill('[name="titulo"]', 'Curso Teste Progressão');
    await page.fill('[name="instituicao"]', 'Instituto X');
    await page.check('#progressaoUsar');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(350);

    const salvo = await page.evaluate(() => {
        const items = JSON.parse(localStorage.getItem('lz_catalog') || '[]');
        const it = items.find((i) => i.fields && i.fields.titulo === 'Curso Teste Progressão');
        return it ? it.progressao : null;
    });
    assertEqual(salvo && salvo.usar, true, 'item.progressao.usar deveria ser salvo como true');
});

test('Aba Progressão Docente: lista "itens candidatos" com cor verde/amarela conforme o mapeamento', async ({ page, baseUrl }) => {
    const verde = makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Verde', periodico: 'Revista X', ano: '2024' });
    const amarelo = makeItem('PROJETO_PESQUISA', 'PROJETOS', { titulo: 'Projeto Amarelo', anoInicio: '2024' });
    await seedCatalog(page, baseUrl, [verde, amarelo]);
    await habilitarProgressao(page);
    await page.click('[data-tab="progressao"]');
    await page.waitForTimeout(200);

    const texto = await page.locator('#tab-progressao').innerText();
    assert(texto.includes('Artigo Verde'), 'A lista de candidatos deveria incluir o item verde');
    assert(texto.includes('Projeto Amarelo'), 'A lista de candidatos deveria incluir o item amarelo');

    const cores = await page.evaluate(() => {
        const linhas = Array.from(document.querySelectorAll('#tab-progressao [data-editar]')).map((btn) => btn.closest('div.flex'));
        const acha = (txt) => linhas.find((l) => l.textContent.includes(txt));
        return {
            verdeClasse: acha('Artigo Verde') ? acha('Artigo Verde').className : '',
            amareloClasse: acha('Projeto Amarelo') ? acha('Projeto Amarelo').className : '',
        };
    });
    assert(cores.verdeClasse.includes('green'), 'O item ARTIGO_PERIODICO (verde) deveria usar as classes de cor verde');
    assert(cores.amareloClasse.includes('amber'), 'O item PROJETO_PESQUISA (amarelo) deveria usar as classes de cor âmbar');
});

test('Aba Progressão Docente: com "data da última progressão" definida, itens de anos anteriores saem da lista de candidatos', async ({ page, baseUrl }) => {
    const antigo = makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Antigo', periodico: 'Revista X', ano: '2018' });
    const recente = makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Recente', periodico: 'Revista X', ano: '2024' });
    await seedCatalog(page, baseUrl, [antigo, recente]);
    await habilitarProgressao(page, { dataUltimaProgressao: '01/01/2023' });
    await page.click('[data-tab="progressao"]');
    await page.waitForTimeout(200);

    const texto = await page.locator('#tab-progressao').innerText();
    assert(!texto.includes('Artigo Antigo'), 'Item datado antes da última progressão não deveria aparecer como candidato');
    assert(texto.includes('Artigo Recente'), 'Item datado depois da última progressão deveria aparecer como candidato');
});

const CAT_PESQUISA = '2. ATIVIDADES DE PESQUISA';
const CAT_GESTAO = '4. ATIVIDADES DE GESTÃO E REPRESENTAÇÃO ACADÊMICA';

test('Aba Progressão Docente: candidatos aparecem agrupados por categoria E subcategoria do memorial, com a mesma numeração do documento oficial', async ({ page, baseUrl }) => {
    const artigo = makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Categoria Pesquisa', periodico: 'Revista X', ano: '2024' });
    const gestao = makeItem('ATIV_DIRECAO', 'ATUACAO', { titulo: 'Coordenação Categoria Gestão', instituicao: 'Unifesp', orgao: 'Departamento X', anoInicio: '2024' });
    await seedCatalog(page, baseUrl, [artigo, gestao]);
    await habilitarProgressao(page);
    await page.click('[data-tab="progressao"]');
    await page.waitForTimeout(200);

    const texto = await page.locator('#progressaoCandidatos').innerText();
    assert(texto.includes(CAT_PESQUISA), `Deveria mostrar o cabeçalho de categoria "${CAT_PESQUISA}"`);
    assert(texto.includes(CAT_GESTAO), `Deveria mostrar o cabeçalho de categoria "${CAT_GESTAO}"`);
    assert(texto.includes('2.2 Produção Científica'), 'Deveria mostrar a subcategoria "2.2 Produção Científica" (numeração igual à do memorial)');
    assert(texto.includes('4.1 Gestão'), 'Deveria mostrar a subcategoria "4.1 Gestão" (numeração igual à do memorial)');
    assert(texto.includes('Artigo Categoria Pesquisa'), 'O item de Pesquisa deveria estar listado');
    assert(texto.includes('Coordenação Categoria Gestão'), 'O item de Gestão deveria estar listado');
});

test('Aba Progressão Docente: clicar num filtro de categoria restringe a lista de candidatos', async ({ page, baseUrl }) => {
    const artigo = makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Categoria Pesquisa', periodico: 'Revista X', ano: '2024' });
    const gestao = makeItem('ATIV_DIRECAO', 'ATUACAO', { titulo: 'Coordenação Categoria Gestão', instituicao: 'Unifesp', orgao: 'Departamento X', anoInicio: '2024' });
    await seedCatalog(page, baseUrl, [artigo, gestao]);
    await habilitarProgressao(page);
    await page.click('[data-tab="progressao"]');
    await page.waitForTimeout(200);

    await page.click(`[data-filtro-cat="${CAT_PESQUISA}"]`);
    await page.waitForTimeout(150);
    const texto = await page.locator('#progressaoCandidatos').innerText();
    assert(texto.includes('Artigo Categoria Pesquisa'), 'O item da categoria filtrada deveria continuar visível');
    assert(!texto.includes('Coordenação Categoria Gestão'), 'O item de outra categoria deveria sumir da lista com o filtro ativo');

    await page.click('[data-filtro-cat=""]'); // "Todas"
    await page.waitForTimeout(150);
    const textoTodas = await page.locator('#progressaoCandidatos').innerText();
    assert(textoTodas.includes('Coordenação Categoria Gestão'), '"Todas" deveria voltar a mostrar os itens das demais categorias');
});

test('Aba Progressão Docente: indicadores mostram total de candidatos e quantos já foram validados', async ({ page, baseUrl }) => {
    const validado = makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Validado', periodico: 'Revista X', ano: '2024' }, { progressao: { usar: true } });
    const naoValidado = makeItem('ARTIGO_ACEITO', 'PRODUCOES', { titulo: 'Artigo Não Validado', periodico: 'Revista Y', ano: '2024' });
    await seedCatalog(page, baseUrl, [validado, naoValidado]);
    await habilitarProgressao(page);
    await page.click('[data-tab="progressao"]');
    await page.waitForTimeout(200);

    const valores = await page.$$eval('#progressaoCandidatos .text-2xl', (els) => els.map((el) => el.textContent.trim()));
    assertEqual(valores[0], '2', 'O indicador "Itens candidatos" deveria mostrar 2');
    assertEqual(valores[1], '1', 'O indicador "Validados" deveria mostrar 1');
});

test('Aba Progressão Docente: botão "Editar" de um candidato abre o item na aba Catalogar', async ({ page, baseUrl }) => {
    const item = makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo Para Editar', periodico: 'Revista X', ano: '2024' });
    await seedCatalog(page, baseUrl, [item]);
    await habilitarProgressao(page);
    await page.click('[data-tab="progressao"]');
    await page.waitForTimeout(200);

    await page.click('[data-editar]');
    await page.waitForTimeout(250);

    const ativa = await page.evaluate(() => window.AppCore.state.ui.activeTab);
    assertEqual(ativa, 'catalogar', 'Deveria ter navegado para a aba Catalogar');
    const tituloCampo = await page.inputValue('[name="titulo"]');
    assertEqual(tituloCampo, 'Artigo Para Editar', 'O item clicado deveria estar carregado no formulário');
});

/* ------------------ Prévia do item 3 do memorial (Extensão) ------------------ */
// Gera o texto do item "3. ATIVIDADES DE EXTENSÃO À COMUNIDADE, DE CURSOS E
// SERVIÇOS" a partir dos itens de Extensão já validados ("usar na
// Progressão"), com os MESMOS rótulos de campo do documento oficial da CPPD
// (ver progressao-memorial.js) — campos que o memorial pede mas não existem
// no catálogo (ex.: Código SIEX) viram "[completar manualmente]".
test('Aba Progressão Docente: "Gerar prévia do item 3" produz o texto com os rótulos oficiais do memorial, preenchidos com os dados do item', async ({ page, baseUrl }) => {
    const projeto = makeItem('PROJETO_EXTENSAO', 'PROJETOS', {
        titulo: 'Extensão nas Escolas Municipais', descricao: 'Ações educativas em escolas da rede pública.',
        natureza: 'Projeto Social de Extensão', situacao: 'Em andamento', anoInicio: '2023',
    }, { progressao: { usar: true } });
    await seedCatalog(page, baseUrl, [projeto]);
    await habilitarProgressao(page);
    await page.click('[data-tab="progressao"]');
    await page.waitForTimeout(200);

    await page.click('#btnPreviaItem3');
    await page.waitForTimeout(150);
    const texto = await page.inputValue('#previaItem3Texto');

    assert(texto.includes('3. ATIVIDADES DE EXTENSÃO À COMUNIDADE, DE CURSOS E SERVIÇOS'), 'Deveria abrir com o título oficial do item 3');
    assert(texto.includes('3.1 Projetos e Programas de Extensão'), 'Deveria mostrar o cabeçalho da subseção 3.1');
    assert(texto.includes('Título do projeto: Extensão nas Escolas Municipais'), 'Deveria preencher "Título do projeto" com o dado real do item');
    assert(texto.includes('Resumo: Ações educativas em escolas da rede pública.'), 'Deveria preencher "Resumo" a partir da Descrição do item');
    assert(texto.includes('Início (mês/ano): 2023'), 'Deveria preencher "Início" com o ano do item');
    assert(texto.includes('Fim (mês/ano ou em andamento): Em andamento'), 'Situação "Em andamento" sem ano fim deveria virar "Em andamento"');
    assert(texto.includes('Código SIEX: [completar manualmente]'), 'Campo que o memorial pede mas não existe no catálogo (Código SIEX) deveria virar placeholder');
    assert(texto.includes('Link de divulgação: [completar manualmente]'), 'Campo sem correspondência no catálogo (Link de divulgação) deveria virar placeholder');
});

test('Aba Progressão Docente: "Gerar prévia do item 3" avisa quando não há itens de Extensão validados', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await habilitarProgressao(page);
    await page.click('[data-tab="progressao"]');
    await page.waitForTimeout(200);

    // Sem candidatos nenhum, o botão de prévia não aparece (a seção
    // "itens candidatos" mostra o aviso de catálogo vazio).
    assertEqual(await page.locator('#btnPreviaItem3').count(), 0, 'Sem candidatos, o botão de prévia do item 3 não deveria existir');

    const naoValidado = makeItem('ATIV_EXTENSAO', 'ATUACAO', { titulo: 'Atividade de extensão não validada', instituicao: 'Unifesp', anoInicio: '2024' });
    await seedCatalog(page, baseUrl, [naoValidado]);
    await habilitarProgressao(page);
    await page.click('[data-tab="progressao"]');
    await page.waitForTimeout(200);

    await page.click('#btnPreviaItem3');
    await page.waitForTimeout(150);
    const texto = await page.locator('#progressaoCandidatos').innerText();
    assert(texto.includes('Nenhum item de Atividades de Extensão validado ainda'), 'Deveria avisar que não há itens de Extensão validados (o item existe, mas não foi marcado "usar na Progressão")');
});
