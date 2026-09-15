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
    await page.click('[data-cfg-page-link="grp-fontes"]');
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

test('Configurações → Trazer e levar dados → Exportar: cartão "Relatório completo (PDF)" com as 2 opções de escopo', async ({ page, baseUrl }) => {
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

/* ==========================================================================
   Regressão: buildPublicModel({ categorias }) — base do modo "Personalizado"
   do Relatório completo (PDF). O filtro precisa acontecer ANTES da mescla
   das categorias 12-19 numa seção só ("Além do Currículo Lattes"), senão
   escolher uma categoria mesclada isoladamente não funcionaria.
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

test('buildPublicModel({ categorias }): filtra corretamente mesmo dentro da seção mesclada "Além do Currículo Lattes" (categorias 12-19)', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal' }),
        makeItem('AL_HOBBY', 'AL_INTERESSES', { titulo: 'Fotografia analógica' }),      // categoria 15
        makeItem('AL_VOLUNTARIADO', 'AL_ENGAJAMENTO', { titulo: 'ONG de leitura' }),    // categoria 13
    ];
    await seedCatalog(page, baseUrl, items);

    const soInteresses = await page.evaluate(() => window.TabPublicar.buildPublicModel({ incluirTodos: true, categorias: ['AL_INTERESSES'] }));
    const titulos = soInteresses.secoes.flatMap((s) => s.tipos.flatMap((t) => t.itens.map((i) => i.titulo)));
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
