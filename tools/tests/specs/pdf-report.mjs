/* ==========================================================================
   Regressão: "Relatório completo (PDF)" — Configurações → Trazer e levar
   dados → Exportar
   --------------------------------------------------------------------------
   Único PDF pronto para impressão/encadernação (capa, sumário paginado,
   Memorial, currículo completo, anexos com evidências mescladas de
   verdade). O motor (pdf-report.js) carrega o pdf-lib via CDN sob demanda —
   BLOQUEADO por padrão nesta suíte (mesmo bloqueio de Tailwind/Font
   Awesome, ver harness.mjs), então os testes aqui cobrem:
   1. O novo tipo MEMORIAL (perfil, singleton, sem exportação Lattes, fora
      da página pública).
   2. buildPublicModel({ incluirTodos }) — escopo "catálogo inteiro" vs "só
      Publicar na Web".
   3. A UI do cartão em Configurações (rádios + botão) e o comportamento de
      erro gracioso quando o pdf-lib não carrega (rede bloqueada).
   4. As funções puras do motor (quebrarLinhas/anexosDoModelo/
      calcularPaginasSumario), que não dependem do pdf-lib estar carregado.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function abrirExportar(page) {
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('[data-cfg-page-link="grp-exportar"]');
    await page.waitForTimeout(150);
}

test('MEMORIAL: existe como tipo de perfil (singleton, sem exportação Lattes)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const def = await page.evaluate(() => {
        const t = window.LattesTypes.getType('MEMORIAL');
        return t && { label: t.label, singleton: !!t.singleton, noExport: !!t.noExport, perfil: !!t.perfil, noEvidence: !!t.noEvidence };
    });
    assert(def, 'O tipo MEMORIAL deveria existir em LattesTypes');
    assertEqual(def.label, 'Memorial descritivo', `Rótulo incorreto — obtido: ${def && def.label}`);
    assert(def.singleton, 'MEMORIAL deveria ser singleton (um só por catálogo)');
    assert(def.noExport, 'MEMORIAL não deveria ser exportado no XML do Lattes (não é um campo real do Lattes)');
    assert(def.perfil, 'MEMORIAL deveria ser um tipo de perfil (mesmo grupo de Identificação/Texto inicial)');
});

test('MEMORIAL: aparece na categoria "01 Dados gerais" e mostra um trecho do texto como título (sem campo "titulo")', async ({ page, baseUrl }) => {
    const items = [makeItem('MEMORIAL', 'DADOS_GERAIS', { descricao: 'Texto de memorial bem mais longo que sessenta caracteres para testar o corte automático do título exibido no card.' })];
    await seedCatalog(page, baseUrl, items);
    const info = await page.evaluate(() => {
        const cat = window.LattesTypes.categoryByKey('DADOS_GERAIS');
        const it = window.AppCore.state.catalogo.items.find((i) => i.typeKey === 'MEMORIAL');
        return { naCategoria: cat.types.includes('MEMORIAL'), titulo: window.LattesTypes.itemTitle(it) };
    });
    assert(info.naCategoria, 'MEMORIAL deveria estar na lista de tipos da categoria "01 Dados gerais"');
    assert(info.titulo.endsWith('…') && info.titulo.length <= 61, `O título deveria ser um trecho cortado do texto (~60 caracteres + "…") — obtido: "${info.titulo}"`);
});

test('MEMORIAL: não aparece na página pública (Publicar na Web) nem entra como item normal do modelo', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal' }),
        makeItem('MEMORIAL', 'DADOS_GERAIS', { descricao: 'Texto do memorial, não deveria vazar para a página pública.' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo público', ano: '2023' }),
    ];
    await seedCatalog(page, baseUrl, items);
    const model = await page.evaluate(async () => window.TabPublicar.buildPublicModel({}));
    const todosOsTitulos = model.secoes.flatMap((s) => s.tipos.flatMap((t) => t.itens.map((i) => i.titulo)));
    assert(!todosOsTitulos.some((t) => /memorial/i.test(t)), `O texto do Memorial não deveria aparecer em nenhuma seção da página pública — títulos: ${JSON.stringify(todosOsTitulos)}`);
    assert(!model.bio || !/memorial/i.test(model.bio), 'O Memorial não deveria ser usado como "bio" da página pública (isso é o RESUMO_CV)');
});

test('buildPublicModel({ incluirTodos }): "catálogo inteiro" ignora o filtro Publicar na Web; sem a opção, respeita o filtro (comportamento padrão inalterado)', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Publicado na web', ano: '2023' }),
        Object.assign(makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Não publicado na web', ano: '2023' }), { visibilidade: { publicarWeb: false } }),
    ];
    await seedCatalog(page, baseUrl, items);

    const modeloPadrao = await page.evaluate(async () => window.TabPublicar.buildPublicModel({}));
    const titulosPadrao = modeloPadrao.secoes.flatMap((s) => s.tipos.flatMap((t) => t.itens.map((i) => i.titulo)));
    assert(titulosPadrao.includes('Publicado na web'), 'O item "Publicar na Web: sim" deveria aparecer no modelo padrão');
    assert(!titulosPadrao.includes('Não publicado na web'), 'Sem incluirTodos, o item "Publicar na Web: não" NÃO deveria aparecer (comportamento de sempre da página pública)');

    const modeloCompleto = await page.evaluate(async () => window.TabPublicar.buildPublicModel({ incluirTodos: true }));
    const titulosCompleto = modeloCompleto.secoes.flatMap((s) => s.tipos.flatMap((t) => t.itens.map((i) => i.titulo)));
    assert(titulosCompleto.includes('Publicado na web') && titulosCompleto.includes('Não publicado na web'), `Com incluirTodos, os dois itens deveriam aparecer — obtido: ${JSON.stringify(titulosCompleto)}`);
});

test('Configurações → Exportar: cartão "Relatório completo (PDF)" com as 2 opções de escopo', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirExportar(page);
    assertEqual(await page.locator('#btnPdfReportGerar').count(), 1, 'O botão "Gerar relatório (PDF)" deveria existir');
    assertEqual(await page.locator('#pdfReportEscopoTodos').count(), 1, 'A opção "Catálogo inteiro" deveria existir');
    assertEqual(await page.locator('#pdfReportEscopoWeb').count(), 1, 'A opção "Só Publicar na Web" deveria existir');
    assert(await page.isChecked('#pdfReportEscopoTodos'), '"Catálogo inteiro" deveria vir marcado por padrão');
});

test('Cartão "Relatório completo (PDF)": as 4 opções de conteúdo existem, "Completo" marcada por padrão', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirExportar(page);
    for (const id of ['pdfReportConteudoCompleto', 'pdfReportConteudoSemEvidencias', 'pdfReportConteudoApenasEvidencias', 'pdfReportConteudoPersonalizado']) {
        assertEqual(await page.locator('#' + id).count(), 1, `A opção "${id}" deveria existir`);
    }
    assert(await page.isChecked('#pdfReportConteudoCompleto'), '"Currículo completo (com evidências)" deveria vir marcada por padrão');
    assert(await page.locator('#pdfReportCategoriasWrap').evaluate((el) => el.classList.contains('hidden')), 'O bloco de categorias deveria começar escondido (só "Personalizado" o revela)');
});

test('Cartão "Relatório completo (PDF)": escolher "Personalizado" revela as 21 categorias; escolher outra opção esconde de novo', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirExportar(page);

    await page.check('#pdfReportConteudoPersonalizado');
    assert(!(await page.locator('#pdfReportCategoriasWrap').evaluate((el) => el.classList.contains('hidden'))), 'O bloco de categorias deveria aparecer ao escolher "Personalizado"');
    const numCategorias = await page.locator('.pdfReportCategoria').count();
    // 21 categorias no total (01-21), menos as 2 do módulo RSC (rscOnly),
    // que ficam de fora enquanto o módulo estiver desligado (padrão do seed).
    assertEqual(numCategorias, 19, `Deveria haver 19 checkboxes (21 categorias - 2 do RSC, desligado por padrão) — obtido: ${numCategorias}`);
    const todasMarcadas = await page.locator('.pdfReportCategoria').evaluateAll((els) => els.every((el) => el.checked));
    assert(todasMarcadas, 'Todas as categorias deveriam vir marcadas por padrão ao abrir "Personalizado"');

    await page.check('#pdfReportConteudoCompleto');
    assert(await page.locator('#pdfReportCategoriasWrap').evaluate((el) => el.classList.contains('hidden')), 'O bloco de categorias deveria esconder de novo ao voltar para "Completo"');
});

test('Cartão "Relatório completo (PDF)": "Selecionar todas"/"Limpar seleção" agem sobre as categorias', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirExportar(page);
    await page.check('#pdfReportConteudoPersonalizado');

    await page.click('#pdfReportCategoriasNenhuma');
    let marcadas = await page.locator('.pdfReportCategoria:checked').count();
    assertEqual(marcadas, 0, '"Limpar seleção" deveria desmarcar todas as categorias');

    await page.click('#pdfReportCategoriasTodas');
    marcadas = await page.locator('.pdfReportCategoria:checked').count();
    assertEqual(marcadas, 19, '"Selecionar todas" deveria marcar todas as categorias de novo (19, com o RSC desligado)');
});

test('Gerar em "Personalizado" sem nenhuma categoria marcada mostra aviso e não tenta gerar', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal' })]);
    await abrirExportar(page);
    await page.evaluate(() => {
        window.__gerarChamado = false;
        window.LzPdfReport = { gerar: async () => { window.__gerarChamado = true; return new Uint8Array([1]); } };
    });
    await page.check('#pdfReportConteudoPersonalizado');
    await page.click('#pdfReportCategoriasNenhuma');

    await page.click('#btnPdfReportGerar');
    await page.waitForFunction(
        () => Array.from(document.querySelectorAll('#toasts > div')).some((d) => /selecione pelo menos uma categoria/i.test(d.textContent)),
        undefined,
        { timeout: 5000 },
    );
    const chamado = await page.evaluate(() => window.__gerarChamado);
    assertEqual(chamado, false, 'window.LzPdfReport.gerar NÃO deveria ter sido chamado sem nenhuma categoria selecionada');
    const disabled = await page.evaluate(() => document.querySelector('#btnPdfReportGerar').disabled);
    assert(!disabled, 'O botão não deveria ficar travado em "Gerando…" — a validação acontece antes de desabilitá-lo');
});

test('Cada opção de conteúdo passa os parâmetros certos para LzPdfReport.gerar()', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal' })]);
    await abrirExportar(page);
    await page.evaluate(() => {
        window.__chamadasGerar = [];
        window.LzPdfReport = { gerar: async (opts) => { window.__chamadasGerar.push(opts); return new Uint8Array([1]); } };
    });

    const casos = [
        { id: 'pdfReportConteudoCompleto', esperado: { incluirCurriculo: true, incluirEvidencias: true, categorias: null } },
        { id: 'pdfReportConteudoSemEvidencias', esperado: { incluirCurriculo: true, incluirEvidencias: false, categorias: null } },
        { id: 'pdfReportConteudoApenasEvidencias', esperado: { incluirCurriculo: false, incluirEvidencias: true, categorias: null } },
    ];
    for (const { id, esperado } of casos) {
        await page.check('#' + id);
        await page.click('#btnPdfReportGerar');
        await page.waitForFunction(() => !document.querySelector('#btnPdfReportGerar').disabled, undefined, { timeout: 10000 });
    }
    // "Personalizado" com 2 categorias marcadas (as outras desmarcadas)
    await page.check('#pdfReportConteudoPersonalizado');
    await page.click('#pdfReportCategoriasNenhuma');
    await page.check('input.pdfReportCategoria[value="DADOS_GERAIS"]');
    await page.check('input.pdfReportCategoria[value="FORMACAO"]');
    await page.click('#btnPdfReportGerar');
    await page.waitForFunction(() => !document.querySelector('#btnPdfReportGerar').disabled, undefined, { timeout: 10000 });

    const chamadas = await page.evaluate(() => window.__chamadasGerar);
    assertEqual(chamadas.length, 4, `Deveria ter gerado 4 vezes (uma por opção testada) — obtido: ${chamadas.length}`);
    casos.forEach((caso, i) => {
        assertEqual(chamadas[i].incluirCurriculo, caso.esperado.incluirCurriculo, `${caso.id}: incluirCurriculo incorreto`);
        assertEqual(chamadas[i].incluirEvidencias, caso.esperado.incluirEvidencias, `${caso.id}: incluirEvidencias incorreto`);
        assertEqual(chamadas[i].categorias, caso.esperado.categorias, `${caso.id}: categorias deveria ser null`);
    });
    const personalizado = chamadas[3];
    assertEqual(personalizado.incluirCurriculo, true, 'Personalizado: incluirCurriculo deveria ser true');
    assertEqual(personalizado.incluirEvidencias, true, 'Personalizado: incluirEvidencias deveria ser true');
    assertEqual([...personalizado.categorias].sort(), ['DADOS_GERAIS', 'FORMACAO'], `Personalizado: categorias deveria ser só as 2 marcadas — obtido: ${JSON.stringify(personalizado.categorias)}`);
});

test('Ordenar por data: "decrescente" marcado por padrão; "crescente" passa ordemAsc: true para LzPdfReport.gerar()', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal' })]);
    await abrirExportar(page);
    assert(await page.isChecked('#pdfReportOrdemDesc'), '"Mais recentes primeiro (decrescente)" deveria vir marcada por padrão');
    await page.evaluate(() => {
        window.__chamadasGerar = [];
        window.LzPdfReport = { gerar: async (opts) => { window.__chamadasGerar.push(opts); return new Uint8Array([1]); } };
    });

    await page.click('#btnPdfReportGerar');
    await page.waitForFunction(() => !document.querySelector('#btnPdfReportGerar').disabled, undefined, { timeout: 10000 });
    await page.check('#pdfReportOrdemAsc');
    await page.click('#btnPdfReportGerar');
    await page.waitForFunction(() => !document.querySelector('#btnPdfReportGerar').disabled, undefined, { timeout: 10000 });

    const chamadas = await page.evaluate(() => window.__chamadasGerar);
    assertEqual(chamadas[0].ordemAsc, false, 'Com "decrescente" marcado, ordemAsc deveria ser false');
    assertEqual(chamadas[1].ordemAsc, true, 'Com "crescente" marcado, ordemAsc deveria ser true');
});

/* ==========================================================================
   Regressão: 2 modelos de diagramação do Relatório (PDF) — A (Editorial
   sóbrio, padrão) e B (Índice lateral colorido, com a data marcada numa
   versão CLARA da cor da categoria, não a cor cheia).
   ========================================================================== */
test('Modelo de diagramação: "A — Editorial sóbrio" marcado por padrão; escolher "B" passa modelo: "B" para LzPdfReport.gerar()', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal' })]);
    await abrirExportar(page);
    assertEqual(await page.locator('#pdfReportModeloA').count(), 1, 'A opção "Modelo A" deveria existir');
    assertEqual(await page.locator('#pdfReportModeloB').count(), 1, 'A opção "Modelo B" deveria existir');
    assert(await page.isChecked('#pdfReportModeloA'), '"A — Editorial sóbrio" deveria vir marcado por padrão');
    await page.evaluate(() => {
        window.__chamadasGerar = [];
        window.LzPdfReport = { gerar: async (opts) => { window.__chamadasGerar.push(opts); return new Uint8Array([1]); } };
    });

    await page.click('#btnPdfReportGerar');
    await page.waitForFunction(() => !document.querySelector('#btnPdfReportGerar').disabled, undefined, { timeout: 10000 });
    await page.check('#pdfReportModeloB');
    await page.click('#btnPdfReportGerar');
    await page.waitForFunction(() => !document.querySelector('#btnPdfReportGerar').disabled, undefined, { timeout: 10000 });

    const chamadas = await page.evaluate(() => window.__chamadasGerar);
    assertEqual(chamadas[0].modelo, 'A', 'Com "A" marcado, modelo deveria ser "A"');
    assertEqual(chamadas[1].modelo, 'B', 'Com "B" marcado, modelo deveria ser "B"');
});

test('pdf-report.js: corDaCategoria() é determinística (mesma categoria sempre cai na mesma cor) e cai num cinza neutro sem número de categoria', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const resultado = await page.evaluate(() => ({
        atuacao1: window.LzPdfReport.corDaCategoria('03'),
        atuacao2: window.LzPdfReport.corDaCategoria('03'),
        formacao: window.LzPdfReport.corDaCategoria('02'),
        semNumero: window.LzPdfReport.corDaCategoria(null),
    }));
    assertEqual(resultado.atuacao1, resultado.atuacao2, 'A mesma categoria deveria sempre devolver a mesma cor (determinístico)');
    assert(JSON.stringify(resultado.atuacao1) !== JSON.stringify(resultado.formacao), 'Categorias diferentes deveriam (em geral) cair em cores diferentes — Atuação e Formação vieram iguais');
    assertEqual(resultado.semNumero, [0.42, 0.42, 0.42], 'Sem número de categoria (seção mesclada/Memorial/Anexos), deveria cair num cinza neutro fixo');
    resultado.atuacao1.forEach((c) => assert(c >= 0 && c <= 1, `Cada componente RGB deveria estar entre 0 e 1 — obtido: ${JSON.stringify(resultado.atuacao1)}`));
});

test('pdf-report.js: misturarComBranco() clareia uma cor sem estourar os limites 0-1 (usado no "chip" de data do Modelo B)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const resultado = await page.evaluate(() => ({
        semMistura: window.LzPdfReport.misturarComBranco([0.2, 0.4, 0.6], 0),
        meio: window.LzPdfReport.misturarComBranco([0.2, 0.4, 0.6], 0.5),
        total: window.LzPdfReport.misturarComBranco([0.2, 0.4, 0.6], 1),
    }));
    const proximoDe = (arr, esperado) => arr.every((c, i) => Math.abs(c - esperado[i]) < 0.0001);
    assert(proximoDe(resultado.semMistura, [0.2, 0.4, 0.6]), `fator 0 deveria devolver a cor original, sem mistura — obtido: ${JSON.stringify(resultado.semMistura)}`);
    assert(proximoDe(resultado.meio, [0.6, 0.7, 0.8]), `fator 0.5 deveria clarear pela metade do caminho até o branco — obtido: ${JSON.stringify(resultado.meio)}`);
    assertEqual(resultado.total, [1, 1, 1], 'fator 1 deveria virar branco puro');
    assert(resultado.meio.every((c, i) => c > resultado.semMistura[i]), 'A versão clareada deveria ter cada componente MAIOR que a cor original (mais clara, não mais escura)');
});

test('buildPublicModel({ ordemAsc }): ordena os itens dentro da categoria crescente ou decrescente por ano', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo de 2020', ano: '2020' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo de 2023', ano: '2023' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo de 2015', ano: '2015' }),
    ];
    await seedCatalog(page, baseUrl, items);

    const decrescente = await page.evaluate(() => window.TabPublicar.buildPublicModel({ incluirTodos: true }));
    const titulosDesc = decrescente.secoes.flatMap((s) => s.tipos.flatMap((t) => t.itens.map((i) => i.titulo)));
    assertEqual(titulosDesc, ['Artigo de 2023', 'Artigo de 2020', 'Artigo de 2015'], `Padrão (sem ordemAsc) deveria ser decrescente — obtido: ${JSON.stringify(titulosDesc)}`);

    const crescente = await page.evaluate(() => window.TabPublicar.buildPublicModel({ incluirTodos: true, ordemAsc: true }));
    const titulosAsc = crescente.secoes.flatMap((s) => s.tipos.flatMap((t) => t.itens.map((i) => i.titulo)));
    assertEqual(titulosAsc, ['Artigo de 2015', 'Artigo de 2020', 'Artigo de 2023'], `ordemAsc: true deveria inverter para crescente — obtido: ${JSON.stringify(titulosAsc)}`);
});

/* ==========================================================================
   Regressão: Formação acadêmica/titulação tinha a data duplicada no
   Relatório (PDF) — LattesTypes.itemTitle() já prefixa o título com o
   período ("2018-2022 Doutorado · Ciência X"), e o relatório também
   acrescenta item.ano no FINAL da linha. tituloParaLinha() remove o
   prefixo só para este tipo, mantendo a data apenas no final.
   ========================================================================== */
test('pdf-report.js: tituloParaLinha() remove a data do início só em Formação acadêmica/titulação', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const resultado = await page.evaluate(() => ({
        comPeriodo: window.LzPdfReport.tituloParaLinha({ typeKey: 'FORMACAO_ACADEMICA', titulo: '2018-2022 Doutorado · Ciência X' }),
        anoUnico: window.LzPdfReport.tituloParaLinha({ typeKey: 'FORMACAO_ACADEMICA', titulo: '2022 Doutorado · Ciência X' }),
        semPeriodo: window.LzPdfReport.tituloParaLinha({ typeKey: 'FORMACAO_ACADEMICA', titulo: 'Doutorado · Ciência X' }),
        outroTipo: window.LzPdfReport.tituloParaLinha({ typeKey: 'ARTIGO_PERIODICO', titulo: '2018-2022 Não deveria mexer' }),
    }));
    assertEqual(resultado.comPeriodo, 'Doutorado · Ciência X', `Deveria remover o período "ano-ano" do início — obtido: "${resultado.comPeriodo}"`);
    assertEqual(resultado.anoUnico, 'Doutorado · Ciência X', `Deveria remover o ano único do início — obtido: "${resultado.anoUnico}"`);
    assertEqual(resultado.semPeriodo, 'Doutorado · Ciência X', 'Título sem período no início não deveria ser alterado');
    assertEqual(resultado.outroTipo, '2018-2022 Não deveria mexer', 'Outros tipos (sem esse prefixo de data) não deveriam ser afetados');
});

/* ==========================================================================
   Regressão: contador (001, 002...) no início de cada item, reiniciando a
   cada subtipo — formato padrão "NNN ano título"; Formação acadêmica é
   exceção (mantém a data só no final, ver tituloParaLinha acima).
   ========================================================================== */
test('pdf-report.js: linhaDoItem() formata "NNN ano título" por padrão, com contador de 3 dígitos', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const resultado = await page.evaluate(() => ({
        primeiro: window.LzPdfReport.linhaDoItem(1, { typeKey: 'PARTICIPACAO_EVENTO', titulo: 'Fórum Estatuinte da UFSC', ano: '1992' }),
        decimoQuinto: window.LzPdfReport.linhaDoItem(15, { typeKey: 'PARTICIPACAO_EVENTO', titulo: 'Outro evento', ano: '2020' }),
        semAno: window.LzPdfReport.linhaDoItem(2, { typeKey: 'PARTICIPACAO_EVENTO', titulo: 'Evento sem ano' }),
    }));
    assertEqual(resultado.primeiro, '001 1992 Fórum Estatuinte da UFSC', `Formato padrão incorreto — obtido: "${resultado.primeiro}"`);
    assertEqual(resultado.decimoQuinto, '015 2020 Outro evento', `Contador de 2 dígitos deveria virar "015" (3 dígitos) — obtido: "${resultado.decimoQuinto}"`);
    assertEqual(resultado.semAno, '002 Evento sem ano', `Sem ano, não deveria sobrar espaço extra — obtido: "${resultado.semAno}"`);
});

test('pdf-report.js: linhaDoItem() em Formação acadêmica usa "NNN título (ano)" (exceção — data no final)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const resultado = await page.evaluate(() => window.LzPdfReport.linhaDoItem(1, {
        typeKey: 'FORMACAO_ACADEMICA', titulo: '2018-2022 Doutorado · Ciência X', ano: '2018–2022',
    }));
    assertEqual(resultado, '001 Doutorado · Ciência X (2018–2022)', `Formação acadêmica deveria manter a data só no final — obtido: "${resultado}"`);
});

/* ==========================================================================
   Regressão: item com carga horária preenchida (campo "cargaHoraria",
   existe em Eventos/Formação/Vínculo profissional/Produção técnica etc.)
   mostra a carga horária no FINAL do item, entre parênteses — pedido do
   Alexsandro. Em Formação acadêmica, entra DEPOIS do "(ano)" (que já é uma
   exceção de formatação própria — ver teste acima).
   ========================================================================== */
test('pdf-report.js: sufixoCargaHoraria() formata " (N h)" quando existe, e ignora vazio/"Não se aplica"', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const resultado = await page.evaluate(() => ({
        com: window.LzPdfReport.sufixoCargaHoraria({ cargaHoraria: '8' }),
        vazio: window.LzPdfReport.sufixoCargaHoraria({ cargaHoraria: '' }),
        semCampo: window.LzPdfReport.sufixoCargaHoraria({}),
        naoSeAplica: window.LzPdfReport.sufixoCargaHoraria({ cargaHoraria: window.AppCore.NA_VALUE }),
    }));
    assertEqual(resultado.com, ' (8 h)', `Deveria formatar " (8 h)" — obtido: "${resultado.com}"`);
    assertEqual(resultado.vazio, '', 'Carga horária vazia não deveria gerar sufixo nenhum');
    assertEqual(resultado.semCampo, '', 'Item sem o campo cargaHoraria não deveria gerar sufixo nenhum');
    assertEqual(resultado.naoSeAplica, '', '"Não se aplica" (N/A explícito) não deveria gerar sufixo nenhum, igual a vazio');
});

test('pdf-report.js: linhaDoItem() acrescenta a carga horária no final; em Formação acadêmica, depois do "(ano)"', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const resultado = await page.evaluate(() => ({
        geral: window.LzPdfReport.linhaDoItem(1, { typeKey: 'PARTICIPACAO_EVENTO', titulo: 'Fórum Estatuinte da UFSC', ano: '1992', cargaHoraria: '8' }),
        formacao: window.LzPdfReport.linhaDoItem(1, { typeKey: 'FORMACAO_ACADEMICA', titulo: 'Doutorado · Ciência X', ano: '2018–2022', cargaHoraria: '360' }),
        semCarga: window.LzPdfReport.linhaDoItem(1, { typeKey: 'PARTICIPACAO_EVENTO', titulo: 'Evento sem carga', ano: '2020' }),
    }));
    assertEqual(resultado.geral, '001 1992 Fórum Estatuinte da UFSC (8 h)', `Deveria acrescentar a carga horária no final — obtido: "${resultado.geral}"`);
    assertEqual(resultado.formacao, '001 Doutorado · Ciência X (2018–2022) (360 h)', `Em Formação acadêmica, a carga horária deveria vir DEPOIS do "(ano)" — obtido: "${resultado.formacao}"`);
    assertEqual(resultado.semCarga, '001 2020 Evento sem carga', 'Sem carga horária, a linha não deveria ganhar nenhum sufixo extra');
});

test('buildPublicModel(): o item achatado leva a carga horária (fields.cargaHoraria) junto, pro Relatório (PDF) formatar', async ({ page, baseUrl }) => {
    const items = [
        makeItem('PARTICIPACAO_EVENTO', 'EVENTOS', { titulo: 'Evento com carga', ano: '2020', cargaHoraria: '8' }),
        makeItem('ATIV_CONSELHO', 'ATUACAO', { titulo: 'Conselho com carga', instituicao: 'UFSC', orgao: 'CONSU', ano: '2019', cargaHoraria: '4' }),
    ];
    await seedCatalog(page, baseUrl, items);
    const model = await page.evaluate(() => window.TabPublicar.buildPublicModel({ incluirTodos: true }));

    const secEventos = model.secoes.find((s) => s.id === 'sec-eventos');
    const eventoItem = secEventos.tipos.flatMap((t) => t.itens).find((i) => i.titulo === 'Evento com carga');
    assertEqual(eventoItem.cargaHoraria, '8', 'O item de Eventos (fora de Atuação) deveria carregar cargaHoraria no objeto achatado');

    const secAtuacao = model.secoes.find((s) => s.id === 'sec-atuacao');
    const conselhoItem = secAtuacao.tipos[0].subgrupos.flatMap((g) => g.itens).find((i) => i.titulo === 'Conselho com carga');
    assertEqual(conselhoItem.cargaHoraria, '4', 'O item de Atuação (dentro de subgrupos) também deveria carregar cargaHoraria');
});

test('buildPublicModel(): telefone e e-mail de Identificação aparecem no modelo (capa do Relatório PDF)', async ({ page, baseUrl }) => {
    const items = [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal', telefone: '(11) 1234-5678', email: 'fulana@exemplo.com' })];
    await seedCatalog(page, baseUrl, items);
    const model = await page.evaluate(() => window.TabPublicar.buildPublicModel({}));
    assertEqual(model.telefone, '(11) 1234-5678', 'model.telefone deveria vir do campo telefone de Identificação');
    assertEqual(model.email, 'fulana@exemplo.com', 'model.email deveria vir do campo email de Identificação');
});

test('buildPublicModel(): sem telefone/e-mail preenchidos, os campos vêm vazios (capa não mostra essas linhas)', async ({ page, baseUrl }) => {
    const items = [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulana de Tal' })];
    await seedCatalog(page, baseUrl, items);
    const model = await page.evaluate(() => window.TabPublicar.buildPublicModel({}));
    assertEqual(model.telefone, '', 'Sem telefone preenchido, deveria vir string vazia');
    assertEqual(model.email, '', 'Sem e-mail preenchido, deveria vir string vazia');
});

/* ==========================================================================
   Regressão: em Atuação, dentro de cada instituição os itens passam a ser
   agrupados por subtipo (Vínculo, Direção e assessoramento, Conselhos e
   comissões...) em vez de uma lista cronológica única — na ORDEM FIXA em
   que os tipos de Atuação estão cadastrados no sistema, não por recência.
   Vale tanto para o Relatório (PDF) quanto para a página pública (os dois
   usam buildPublicModel) — ver tipoHtml()/subgrupoHtml() em publish.js.
   ========================================================================== */
test('buildPublicModel(): Atuação agrupa por subtipo dentro de cada instituição, em ordem fixa (não cronológica)', async ({ page, baseUrl }) => {
    const items = [
        // UFSC: um item de Conselho (mais antigo) e um de Direção (mais
        // recente) — se a ordem fosse por recência, Direção viria primeiro;
        // na ordem fixa do tipo, Direção (ATIV_DIRECAO) vem ANTES de
        // Conselho (ATIV_CONSELHO) no cadastro do sistema.
        makeItem('ATIV_CONSELHO', 'ATUACAO', { titulo: 'Conselho Curador', instituicao: 'UFSC', orgao: 'CONSU', ano: '2010' }),
        makeItem('ATIV_DIRECAO', 'ATUACAO', { titulo: 'Diretor de Departamento', instituicao: 'UFSC', orgao: 'Depto. X', ano: '2022' }),
        makeItem('VINCULO_PROFISSIONAL', 'ATUACAO', { cargo: 'Professor Associado', instituicao: 'UFSC', ano: '2015' }),
    ];
    await seedCatalog(page, baseUrl, items);
    const model = await page.evaluate(() => window.TabPublicar.buildPublicModel({ incluirTodos: true }));
    const secAtuacao = model.secoes.find((s) => s.id === 'sec-atuacao');
    assert(secAtuacao, 'Deveria existir uma seção de Atuação');
    const ufsc = secAtuacao.tipos.find((t) => t.label === 'UFSC');
    assert(ufsc, 'Deveria existir um grupo "UFSC" (por instituição)');
    assert(Array.isArray(ufsc.subgrupos), 'O grupo da instituição deveria ter subgrupos (por subtipo), não itens direto');
    const rotulos = ufsc.subgrupos.map((g) => g.label);
    const idxVinculo = rotulos.findIndex((r) => /profissional/i.test(r));
    const idxDirecao = rotulos.findIndex((r) => /dire[çc][ãa]o/i.test(r));
    const idxConselho = rotulos.findIndex((r) => /conselho/i.test(r));
    assert(idxVinculo >= 0 && idxDirecao >= 0 && idxConselho >= 0, `Os 3 subtipos deveriam aparecer — obtido: ${JSON.stringify(rotulos)}`);
    assert(idxVinculo < idxDirecao && idxDirecao < idxConselho, `Ordem deveria ser fixa (Vínculo, Direção, Conselho), não por recência — obtido: ${JSON.stringify(rotulos)}`);
    const direcaoGrupo = ufsc.subgrupos[idxDirecao];
    assertEqual(direcaoGrupo.itens.length, 1, 'O subgrupo de Direção deveria ter 1 item');
    assertEqual(direcaoGrupo.itens[0].titulo, 'Diretor de Departamento', 'Título do item de Direção incorreto');
});

test('buildPublicModel(): instituições diferentes em Atuação continuam sendo grupos separados', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ATIV_CONSELHO', 'ATUACAO', { titulo: 'Conselho A', instituicao: 'UFSC', orgao: 'X', ano: '2020' }),
        makeItem('ATIV_CONSELHO', 'ATUACAO', { titulo: 'Conselho B', instituicao: 'USP', orgao: 'Y', ano: '2019' }),
    ];
    await seedCatalog(page, baseUrl, items);
    const model = await page.evaluate(() => window.TabPublicar.buildPublicModel({ incluirTodos: true }));
    const secAtuacao = model.secoes.find((s) => s.id === 'sec-atuacao');
    const instituicoes = secAtuacao.tipos.map((t) => t.label);
    assert(instituicoes.includes('UFSC') && instituicoes.includes('USP'), `Deveria ter 2 grupos, um por instituição — obtido: ${JSON.stringify(instituicoes)}`);
});

/* ==========================================================================
   Regressão: em Produções (categoria 05), a linha-resumo do item mostra a
   AUTORIA primeiro, depois o periódico/evento — pedido do Alexsandro
   ("após o item vem a autoria e depois o evento ou periódico"). Fora de
   Produções, itemLinha() genérica continua igual (periódico/evento antes).
   ========================================================================== */
test('buildPublicModel(): em Produções, a linha do item mostra autoria antes do periódico/evento', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', {
            titulo: 'Artigo sobre X', ano: '2023', periodico: 'Revista Brasileira de Y',
            autoresLista: [{ nomeCompleto: 'Fulana de Tal' }, { nomeCompleto: 'Beltrano Silva' }],
        }),
    ];
    await seedCatalog(page, baseUrl, items);
    const model = await page.evaluate(() => window.TabPublicar.buildPublicModel({ incluirTodos: true }));
    const item = model.secoes.flatMap((s) => s.tipos.flatMap((t) => t.itens)).find((i) => i.titulo === 'Artigo sobre X');
    assert(item, 'O item de Produções deveria existir no modelo');
    assertEqual(item.linha, 'Fulana de Tal; Beltrano Silva · Revista Brasileira de Y', `A linha deveria trazer a autoria ANTES do periódico — obtido: "${item.linha}"`);
});

test('buildPublicModel(): em Produções, sem autoresLista cai no campo legado "autores" (separado por ";")', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo antigo', ano: '2018', periodico: 'Revista Z', autores: 'Fulana de Tal; Beltrano Silva' }),
    ];
    await seedCatalog(page, baseUrl, items);
    const model = await page.evaluate(() => window.TabPublicar.buildPublicModel({ incluirTodos: true }));
    const item = model.secoes.flatMap((s) => s.tipos.flatMap((t) => t.itens)).find((i) => i.titulo === 'Artigo antigo');
    assertEqual(item.linha, 'Fulana de Tal; Beltrano Silva · Revista Z', `Deveria usar o campo legado "autores" quando não há autoresLista — obtido: "${item.linha}"`);
});

/* ==========================================================================
   Regressão: buildPublicModel({ categorias }) — base do modo "Personalizado"
   do Relatório completo (PDF). O filtro precisa acontecer ANTES da mescla
   das categorias 12-19 numa seção só ("Outras atividades"), senão escolher
   uma categoria mesclada isoladamente não funcionaria.
   ========================================================================== */
test('buildPublicModel({ categorias }): restringe o modelo só às categorias informadas', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal' }),
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo de Produções', ano: '2023' }),
        makeItem('FORMACAO_ACADEMICA', 'FORMACAO', { nivel: 'Doutorado', curso: 'Ciência X', anoInicio: '2018', anoFim: '2022' }),
    ];
    await seedCatalog(page, baseUrl, items);

    const soProducoes = await page.evaluate(() => window.TabPublicar.buildPublicModel({ incluirTodos: true, categorias: ['PRODUCOES'] }));
    const titulosProducoes = soProducoes.secoes.flatMap((s) => s.tipos.flatMap((t) => t.itens.map((i) => i.titulo)));
    assert(titulosProducoes.includes('Artigo de Produções'), 'Categoria PRODUCOES deveria aparecer quando selecionada');
    assert(!titulosProducoes.some((t) => /Doutorado/.test(t)), 'Categoria FORMACAO NÃO deveria aparecer quando só PRODUCOES foi selecionada');

    const semFiltro = await page.evaluate(() => window.TabPublicar.buildPublicModel({ incluirTodos: true }));
    const titulosSemFiltro = semFiltro.secoes.flatMap((s) => s.tipos.flatMap((t) => t.itens.map((i) => i.titulo)));
    assert(titulosSemFiltro.includes('Artigo de Produções') && titulosSemFiltro.some((t) => /Doutorado/.test(t)), 'Sem opts.categorias, o comportamento de sempre (todas as categorias) deveria continuar');
});

test('buildPublicModel({ categorias }): filtra corretamente mesmo dentro da seção mesclada "Outras atividades" (categorias 12-19); a categoria principal (subgrupos) continua aparecendo', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal' }),
        makeItem('AL_HOBBY', 'AL_INTERESSES', { titulo: 'Fotografia analógica' }),      // categoria 15
        makeItem('AL_VOLUNTARIADO', 'AL_ENGAJAMENTO', { titulo: 'ONG de leitura' }),    // categoria 13
    ];
    await seedCatalog(page, baseUrl, items);

    const soInteresses = await page.evaluate(() => window.TabPublicar.buildPublicModel({ incluirTodos: true, categorias: ['AL_INTERESSES'] }));
    const secExtras = soInteresses.secoes.find((s) => s.id === 'sec-extras');
    assert(secExtras, 'Deveria existir a seção mesclada "Outras atividades"');
    assertEqual(secExtras.label, 'Outras atividades', `A seção mesclada deveria se chamar "Outras atividades" — obtido: "${secExtras.label}"`);
    assert(Array.isArray(secExtras.tipos[0].subgrupos), 'Cada entrada da seção mesclada deveria ter subgrupos (categoria principal > subcategoria), não itens direto');
    assert(/^15\./.test(secExtras.tipos[0].label), `A categoria principal (com número) deveria aparecer — obtido: "${secExtras.tipos[0].label}"`);
    const titulos = secExtras.tipos.flatMap((t) => t.subgrupos.flatMap((g) => g.itens.map((i) => i.titulo)));
    assert(titulos.some((t) => /Fotografia anal[oó]gica/.test(t)), 'AL_INTERESSES (categoria 15) deveria aparecer quando selecionada');
    assert(!titulos.some((t) => /ONG de leitura/.test(t)), 'AL_ENGAJAMENTO (categoria 13, não selecionada) NÃO deveria vazar pra dentro da seção mesclada');
});

test('Gerar relatório sem conseguir carregar o pdf-lib (rede bloqueada) mostra um erro claro e não deixa o botão travado', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal' })]);
    await abrirExportar(page);

    await page.click('#btnPdfReportGerar');
    // Espera a rejeição do carregamento do pdf-lib (bloqueado pela rede) virar
    // toast, em vez de um waitForTimeout fixo — sob contenção de CPU do
    // runner de CI, um valor fixo curto demais fazia este teste falhar de
    // forma intermitente mesmo com o comportamento correto.
    await page.waitForFunction(
        () => Array.from(document.querySelectorAll('#toasts > div')).some((d) => /falha ao gerar o relat[oó]rio/i.test(d.textContent)),
        undefined,
        { timeout: 10000 },
    );

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /falha ao gerar o relat[oó]rio/i.test(t)), `Deveria mostrar um erro claro quando o pdf-lib não carrega — toasts: ${JSON.stringify(toasts)}`);
    const disabled = await page.evaluate(() => document.querySelector('#btnPdfReportGerar').disabled);
    assert(!disabled, 'O botão deveria voltar a ficar habilitado depois da falha (não travar preso em "Gerando…")');
});

test('pdf-report.js: quebrarLinhas() quebra texto longo em várias linhas sem estourar a largura', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const linhas = await page.evaluate(() => {
        const fonteFalsa = { widthOfTextAtSize: (t, tamanho) => t.length * tamanho * 0.5 };
        return window.LzPdfReport.quebrarLinhas('uma duas tres quatro cinco seis sete oito nove dez', fonteFalsa, 10, 60);
    });
    assert(linhas.length > 1, `Um texto longo deveria virar mais de 1 linha com largura estreita — obtido: ${JSON.stringify(linhas)}`);
    assert(linhas.every((l) => l.length * 5 <= 60 + 0.001), `Nenhuma linha deveria estourar a largura disponível — obtido: ${JSON.stringify(linhas)}`);
    assertEqual(linhas.join(' '), 'uma duas tres quatro cinco seis sete oito nove dez', 'Concatenar as linhas de volta deveria reconstituir o texto original (nenhuma palavra perdida/duplicada)');
});

test('pdf-report.js: quebrarLinhas() preserva parágrafos vazios (quebra dupla de linha) como uma linha em branco', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const linhas = await page.evaluate(() => {
        const fonteFalsa = { widthOfTextAtSize: (t, tamanho) => t.length * tamanho * 0.5 };
        return window.LzPdfReport.quebrarLinhas('primeiro paragrafo\n\nsegundo paragrafo', fonteFalsa, 10, 500);
    });
    assertEqual(linhas, ['primeiro paragrafo', '', 'segundo paragrafo'], `Deveria manter uma linha em branco entre os parágrafos — obtido: ${JSON.stringify(linhas)}`);
});

test('pdf-report.js: anexosDoModelo() achata as evidências de todas as seções/tipos/itens do modelo', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const lista = await page.evaluate(() => {
        const modeloFalso = {
            secoes: [{ tipos: [{ itens: [
                { titulo: 'Item A', anexos: [{ ext: 'pdf', name: 'a.pdf', dataUri: 'data:x' }] },
                { titulo: 'Item B', anexos: [] },
            ] }] }, { tipos: [{ itens: [
                { titulo: 'Item C', anexos: [{ ext: 'url', name: 'link', url: 'https://x' }] },
            ] }] }],
        };
        return window.LzPdfReport.anexosDoModelo(modeloFalso);
    });
    assertEqual(lista.length, 2, `Deveria achatar só as 2 evidências reais (Item B não tem nenhuma) — obtido: ${JSON.stringify(lista)}`);
    assertEqual(lista[0].itemTitulo, 'Item A');
    assertEqual(lista[1].itemTitulo, 'Item C');
});

test('Gerar relatório quando window.LzPdfReport não carregou (ex.: bloqueado por extensão do navegador) mostra um erro claro, não um TypeError críptico', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal' })]);
    await abrirExportar(page);
    // Simula js/pdf-report.js nunca tendo carregado (rede instável, ou uma
    // extensão de bloqueio de anúncios/rastreadores barrando o arquivo —
    // já aconteceu de verdade: o clique dava "Cannot read properties of
    // undefined (reading 'gerar')", um TypeError sem indicar a causa).
    await page.evaluate(() => { delete window.LzPdfReport; });

    await page.click('#btnPdfReportGerar');
    await page.waitForFunction(
        () => Array.from(document.querySelectorAll('#toasts > div')).some((d) => /falha ao gerar o relat[oó]rio/i.test(d.textContent)),
        undefined,
        { timeout: 10000 },
    );
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /pdf-report\.js/.test(t) && /bloqueando/i.test(t)), `Deveria explicar que js/pdf-report.js não carregou e sugerir verificar extensões/conexão — toasts: ${JSON.stringify(toasts)}`);
    const disabled = await page.evaluate(() => document.querySelector('#btnPdfReportGerar').disabled);
    assert(!disabled, 'O botão deveria voltar a ficar habilitado depois da falha (não travar preso em "Gerando…")');
});

/* ==========================================================================
   Regressão: caracteres fora do alfabeto WinAnsi (grego, setas, scripts não-
   latinos, emoji) derrubavam a geração do relatório inteiro com um erro
   técnico incompreensível ("WinAnsi cannot encode..."), por causa de UM
   caractere em qualquer campo (título, Memorial, nome de instituição) —
   nada incomum num currículo acadêmico (ex.: "α-sinucleína" num título de
   produção). sanitizarTexto() troca o que dá por um equivalente legível e o
   resto por "?", sem depender do pdf-lib estar carregado (a fonte falsa
   abaixo simula exatamente o alfabeto WinAnsi via getCharacterSet()).
   ========================================================================== */
test('pdf-report.js: sanitizarTexto() troca letras gregas/setas por equivalentes legíveis (não crasha)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const resultado = await page.evaluate(() => {
        const fonteFalsa = (() => {
            const chars = " -():abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789áéíóúãõâêôàçÁÉÍÓÚÃÕÂÊÔÀÇ—'\"";
            const codes = new Set(Array.from(chars).map((c) => c.codePointAt(0)));
            return { widthOfTextAtSize: (t) => t.length * 5, getCharacterSet: () => Array.from(codes) };
        })();
        return window.LzPdfReport.sanitizarTexto(fonteFalsa, 'α-sinucleína: 2020 → 2024 (γ e não-latino: 你好)');
    });
    assertEqual(resultado, 'alfa-sinucleína: 2020 -> 2024 (gama e não-latino: ??)', `Deveria trocar α/→/γ por equivalentes legíveis e "你好" por "?" cada — obtido: ${JSON.stringify(resultado)}`);
});

test('pdf-report.js: sanitizarTexto() não mexe em texto já compatível, e ignora fontes de teste sem getCharacterSet()', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const { normal, semCharSet } = await page.evaluate(() => {
        const fonteFalsa = { widthOfTextAtSize: (t) => t.length * 5, getCharacterSet: () => Array.from({ length: 128 }, (_, i) => i) };
        const fonteSemCharSet = { widthOfTextAtSize: (t) => t.length * 5 }; // ex.: a fonteFalsa usada em quebrarLinhas() acima
        return {
            normal: window.LzPdfReport.sanitizarTexto(fonteFalsa, 'Texto normal, so ASCII.'),
            semCharSet: window.LzPdfReport.sanitizarTexto(fonteSemCharSet, 'α grego, sem char set pra filtrar.'),
        };
    });
    assertEqual(normal, 'Texto normal, so ASCII.', 'Texto já compatível com a fonte não deveria ser alterado');
    assertEqual(semCharSet, 'α grego, sem char set pra filtrar.', 'Sem getCharacterSet() (fonte de teste), a sanitização deveria ser pulada, não travar');
});

/* ==========================================================================
   Regressão: com um diretório configurado, o relatório gerado agora também
   é salvo na pasta "Relatórios" (já existia na estrutura de pastas, mas
   nada gravava nela) — além do download de sempre, que continua intacto.
   window.Storage é um objeto JS comum, sobrescrevível (mesmo padrão já
   usado em sincronizacao.mjs) — substitui hasDirectory()/writeFile() pra
   testar a chamada sem depender de um diretório real nem do pdf-lib.
   ========================================================================== */
test('Gerar relatório com diretório configurado também salva uma cópia na pasta "Relatórios"', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal' })]);
    await abrirExportar(page);
    await page.evaluate(() => {
        window.LzPdfReport = { gerar: async () => new Uint8Array([1, 2, 3]) };
        window.Storage.hasDirectory = () => true;
        window.__writeFileChamadas = [];
        window.Storage.writeFile = async (nome, bytes, subdir) => { window.__writeFileChamadas.push({ nome, subdir }); };
    });

    await page.click('#btnPdfReportGerar');
    await page.waitForFunction(() => !document.querySelector('#btnPdfReportGerar').disabled, undefined, { timeout: 10000 });
    await page.waitForTimeout(100);

    const chamadas = await page.evaluate(() => window.__writeFileChamadas);
    assertEqual(chamadas.length, 1, 'Storage.writeFile deveria ter sido chamado uma vez pra salvar o relatório na pasta');
    assertEqual(chamadas[0].subdir, 'Relatórios', `Deveria salvar dentro da pasta "Relatórios" — obtido: ${JSON.stringify(chamadas[0])}`);
    assert(chamadas[0].nome.startsWith('relatorio-completo-') && chamadas[0].nome.endsWith('.pdf'), `Nome do arquivo salvo inesperado: ${chamadas[0].nome}`);

    const status = await page.$eval('#pdfReportStatus', (el) => el.textContent);
    assert(/salvo na pasta "Relat[oó]rios"/i.test(status), `O status deveria confirmar que salvou na pasta "Relatórios" — obtido: "${status}"`);
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /salvo na pasta "Relat[oó]rios"/i.test(t)), `O toast deveria confirmar o salvamento na pasta — toasts: ${JSON.stringify(toasts)}`);
});

test('Gerar relatório sem diretório configurado NÃO tenta salvar na pasta (só o download)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal' })]);
    await abrirExportar(page);
    await page.evaluate(() => {
        window.LzPdfReport = { gerar: async () => new Uint8Array([1, 2, 3]) };
        window.Storage.hasDirectory = () => false;
        window.__writeFileChamado = false;
        window.Storage.writeFile = async () => { window.__writeFileChamado = true; };
    });

    await page.click('#btnPdfReportGerar');
    await page.waitForFunction(() => !document.querySelector('#btnPdfReportGerar').disabled, undefined, { timeout: 10000 });
    await page.waitForTimeout(100);

    const chamado = await page.evaluate(() => window.__writeFileChamado);
    assertEqual(chamado, false, 'Sem diretório configurado, Storage.writeFile não deveria ser chamado');
    const status = await page.$eval('#pdfReportStatus', (el) => el.textContent);
    assert(/sem diret[oó]rio configurado/i.test(status), `O status deveria explicar que não há onde salvar uma cópia — obtido: "${status}"`);
});

test('pdf-report.js: calcularPaginasSumario() cresce com o número de entradas', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const { poucas, muitas } = await page.evaluate(() => {
        const entradasPoucas = Array.from({ length: 3 }, (_, i) => ({ titulo: 'Seção ' + i, nivel: 0 }));
        const entradasMuitas = Array.from({ length: 200 }, (_, i) => ({ titulo: 'Seção ' + i, nivel: 1 }));
        return { poucas: window.LzPdfReport.calcularPaginasSumario(entradasPoucas), muitas: window.LzPdfReport.calcularPaginasSumario(entradasMuitas) };
    });
    assertEqual(poucas, 1, `Com poucas entradas, 1 página de sumário deveria bastar — obtido: ${poucas}`);
    assert(muitas > 1, `Com 200 entradas, deveria precisar de mais de 1 página de sumário — obtido: ${muitas}`);
});
