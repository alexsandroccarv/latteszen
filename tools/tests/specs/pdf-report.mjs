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
        const it = window.AppCore.state.items.find((i) => i.typeKey === 'MEMORIAL');
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
