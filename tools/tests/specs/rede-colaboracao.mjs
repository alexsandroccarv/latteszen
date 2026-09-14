/* ==========================================================================
   Regressão: "Rede de colaboração" (aba Gráficos, issue #135) — rede
   egocêntrica de coautoria, logo abaixo de "Produção por tipo".
   --------------------------------------------------------------------------
   Ego = quem usa o lattesZen (Identificação: nome civil + variações de
   citação bibliográfica); Alteri = nomes distintos no campo "Autores" em
   LISTA (autoresLista: nomeCompleto/nomeCitacao) — presente em Produção
   bibliográfica/técnica/artística, Eventos e Patentes/Registros/Cultivar
   (mesmo campo por baixo, só o rótulo muda: "Autores"/"Inventores"/
   "Melhoristas"). Um item não precisa listar o Ego explicitamente pra
   contar — todo item do catálogo já é do próprio Ego.

   3 layouts (issue #135, escolhidos por <select>): radial concêntrico
   (Alteri mais próximos = mais itens em comum), forças ancoradas no Ego
   (Fruchterman-Reingold, Ego fixo no centro) e árvore radial (cada
   colaborador agrupado no tipo de produção em que mais colaborou com o
   Ego). O cálculo do grafo (nós + peso das arestas) é comum aos 3.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

function itemProducao(titulo, typeKey, autores, extra) {
    return makeItem(typeKey, 'PRODUCOES', Object.assign({ titulo, ano: '2023', autoresLista: autores.map((n) => ({ nomeCompleto: n })) }, extra || {}));
}

async function abrirGraficos(page) {
    await page.click('[data-tab="linhatempo"]');
    await page.waitForTimeout(300);
}

test('Sem coautoria no catálogo, mostra aviso em vez do grafo', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirGraficos(page);
    const texto = await page.$eval('#redeColaboracao', (el) => el.textContent);
    assert(/Nenhuma coautoria encontrada/i.test(texto), 'Sem itens com "Autores" em lista, deveria mostrar o aviso, não o grafo');
    assertEqual(await page.locator('#redeColaboracao svg').count(), 0, 'Sem coautoria, o SVG do grafo não deveria existir ainda');
});

test('Seção "Rede de colaboração" aparece logo abaixo de "Produção por tipo"', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, [itemProducao('Artigo A', 'ARTIGO_PERIODICO', ['Maria Silva'])]);
    await abrirGraficos(page);
    const h2s = await page.evaluate(() => Array.from(document.querySelectorAll('#tab-linhatempo h2')).map((h) => h.textContent.trim()));
    const idxProducao = h2s.findIndex((h) => /Produção por tipo/.test(h));
    const idxRede = h2s.findIndex((h) => /Rede de colaboração/.test(h));
    assert(idxProducao !== -1 && idxRede !== -1 && idxRede === idxProducao + 1, `"Rede de colaboração" deveria vir logo depois de "Produção por tipo" — títulos: ${h2s.join(' | ')}`);
});

test('Monta os nós (Ego + Alteri distintos) e pesos das arestas a partir de autoresLista, ignorando o próprio Ego', async ({ page, baseUrl }) => {
    const items = [
        makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Alexsandro Cardoso Carvalho', citacoes: [{ nome: 'CARVALHO, Alexsandro C.' }] }),
        itemProducao('Artigo 1', 'ARTIGO_PERIODICO', ['Alexsandro Cardoso Carvalho', 'Maria Silva', 'João Souza']),
        itemProducao('Artigo 2', 'ARTIGO_PERIODICO', ['Alexsandro Cardoso Carvalho', 'Maria Silva']),
        itemProducao('Artigo 3', 'ARTIGO_PERIODICO', ['CARVALHO, Alexsandro C.', 'Maria Silva', 'Pedro Lima']),
        // Item sem o Ego listado — ainda conta (o catálogo inteiro já é do Ego).
        itemProducao('Capitulo 1', 'LIVRO_CAPITULO', ['João Souza']),
    ];
    await seedCatalog(page, baseUrl, items);
    await abrirGraficos(page);

    const info = await page.evaluate(() => {
        const { alteri, paresAlterAlter } = window.TabLinhaTempo.montarRedeColaboracao();
        return {
            alteri: Array.from(alteri.entries()).map(([chave, a]) => [chave, a.nome, a.itens]).sort(),
            pares: Array.from(paresAlterAlter.entries()),
        };
    });

    assertEqual(info.alteri.length, 3, `Deveriam existir 3 Alteri distintos (Maria Silva, João Souza, Pedro Lima) — obtido: ${JSON.stringify(info.alteri)}`);
    const porNome = Object.fromEntries(info.alteri.map(([, nome, itens]) => [nome, itens]));
    assertEqual(porNome['Maria Silva'], 3, 'Maria Silva deveria ter 3 itens em comum com o Ego');
    assertEqual(porNome['João Souza'], 2, 'João Souza deveria ter 2 itens em comum com o Ego (Artigo 1 + Capítulo 1, mesmo sem o Ego listado no Capítulo 1)');
    assertEqual(porNome['Pedro Lima'], 1, 'Pedro Lima deveria ter 1 item em comum com o Ego');
    assert(!info.alteri.some(([, nome]) => /Alexsandro|Carvalho/i.test(nome)), `O próprio Ego (em qualquer variação de nome) não deveria virar um Alter — obtido: ${JSON.stringify(info.alteri)}`);

    // Maria Silva + João Souza aparecem juntos no Artigo 1, e Maria Silva +
    // Pedro Lima no Artigo 3 → 2 pares Alter–Alter (João Souza e Pedro Lima
    // nunca aparecem juntos num mesmo item).
    assertEqual(info.pares.length, 2, `Deveriam existir 2 pares Alter–Alter (Maria Silva+João Souza no Artigo 1; Maria Silva+Pedro Lima no Artigo 3) — obtido: ${JSON.stringify(info.pares)}`);
    assert(info.pares.every(([, peso]) => peso === 1), `Cada par deveria ter peso 1 (um único item em comum) — obtido: ${JSON.stringify(info.pares)}`);
});

test('Densidade da vizinhança é calculada corretamente (pares Alter–Alter / pares possíveis)', async ({ page, baseUrl }) => {
    // 3 Alteri (A, B, C) → 3 pares possíveis; só A–B compartilham item → densidade 1/3.
    const items = [
        itemProducao('Item 1', 'ARTIGO_PERIODICO', ['Autor A', 'Autor B']),
        itemProducao('Item 2', 'ARTIGO_PERIODICO', ['Autor C']),
    ];
    await seedCatalog(page, baseUrl, items);
    await abrirGraficos(page);

    const densidade = await page.evaluate(() => {
        const { alteri, paresAlterAlter } = window.TabLinhaTempo.montarRedeColaboracao();
        return window.TabLinhaTempo.densidadeVizinhanca(alteri.size, paresAlterAlter);
    });
    assert(Math.abs(densidade - (1 / 3)) < 1e-9, `Densidade deveria ser 1/3 (≈0.333) — obtido: ${densidade}`);

    const texto = await page.$eval('#redeColaboracao', (el) => el.textContent);
    assert(/33%/.test(texto), `O texto da seção deveria mostrar "33%" de densidade — obtido: ${texto}`);
});

test('Com só 1 Alter, não mostra densidade (não há par possível)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, [itemProducao('Item 1', 'ARTIGO_PERIODICO', ['Autor Único'])]);
    await abrirGraficos(page);
    const texto = await page.$eval('#redeColaboracao', (el) => el.textContent);
    assert(!/Densidade da vizinhança/.test(texto), 'Com um único colaborador, não há par possível — não deveria mostrar a métrica de densidade');
});

test('Seletor de layout tem as 3 opções da issue #135 e trocar redesenha o grafo (SVG muda)', async ({ page, baseUrl }) => {
    const items = [
        itemProducao('Item 1', 'ARTIGO_PERIODICO', ['Autor A', 'Autor B']),
        itemProducao('Item 2', 'ARTIGO_PERIODICO', ['Autor A', 'Autor C']),
        itemProducao('Item 3', 'TRABALHO_EVENTO', ['Autor D']),
    ];
    await seedCatalog(page, baseUrl, items);
    await abrirGraficos(page);

    const valores = await page.$$eval('#redeColabLayoutSelect option', (opts) => opts.map((o) => o.value));
    assertEqual(valores, ['concentrico', 'forcas', 'arvore'], `As 3 opções de layout deveriam existir, nessa ordem — obtido: ${JSON.stringify(valores)}`);

    const svgConcentrico = await page.$eval('#redeColaboracao svg', (el) => el.outerHTML);
    await page.selectOption('#redeColabLayoutSelect', 'forcas');
    await page.waitForTimeout(200);
    const svgForcas = await page.$eval('#redeColaboracao svg', (el) => el.outerHTML);
    assert(svgConcentrico !== svgForcas, 'Trocar para "forcas" deveria mudar o desenho do grafo (posições diferentes)');

    await page.selectOption('#redeColabLayoutSelect', 'arvore');
    await page.waitForTimeout(200);
    const svgArvore = await page.$eval('#redeColaboracao svg', (el) => el.outerHTML);
    assert(svgArvore !== svgForcas, 'Trocar para "arvore" deveria mudar o desenho do grafo de novo');
    // Árvore radial tem um nó extra por "ramo" (tipo de produção) além do Ego + Alteri.
    const totalCirculos = await page.locator('#redeColaboracao svg circle').count();
    assert(totalCirculos > 1 + 4, `Árvore radial deveria ter círculos extras de "ramo" (tipo de produção) além do Ego (1) + 4 Alteri — obtido: ${totalCirculos}`);
});

test('Todos os nós têm nó SVG (Ego + cada Alter) e a tabela acessível lista todos os colaboradores', async ({ page, baseUrl }) => {
    const items = [
        itemProducao('Item 1', 'ARTIGO_PERIODICO', ['Autor A', 'Autor B']),
        itemProducao('Item 2', 'LIVRO_CAPITULO', ['Autor C']),
    ];
    await seedCatalog(page, baseUrl, items);
    await abrirGraficos(page);

    const circulos = await page.locator('#redeColaboracao svg circle').count();
    assert(circulos >= 4, `Deveria haver pelo menos 4 círculos (1 Ego + 3 Alteri) — obtido: ${circulos}`);

    const linhasTabela = await page.evaluate(() => Array.from(document.querySelectorAll('#redeColaboracao table tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim())));
    assertEqual(linhasTabela.length, 3, `A tabela acessível deveria listar os 3 Alteri — obtido: ${JSON.stringify(linhasTabela)}`);
    assert(linhasTabela.some((l) => l[0] === 'Autor A' && l[1] === '1'), `"Autor A" deveria aparecer na tabela com 1 item em comum — obtido: ${JSON.stringify(linhasTabela)}`);
});

test('Mais de 40 colaboradores: o grafo mostra só os 40 com mais itens em comum, avisando quantos ficaram de fora (a tabela continua com todos)', async ({ page, baseUrl }) => {
    const autores = [];
    for (let i = 0; i < 45; i++) autores.push(`Colaborador ${String(i).padStart(2, '0')}`);
    // Cada autor num item próprio (1 item em comum cada) — nenhum empate
    // seletivo entre eles, então o corte é só pelo TOTAL (45 > 40).
    const items = autores.map((nome, i) => itemProducao(`Item ${i}`, 'ARTIGO_PERIODICO', [nome]));
    await seedCatalog(page, baseUrl, items);
    await abrirGraficos(page);

    const texto = await page.$eval('#redeColaboracao', (el) => el.textContent);
    assert(/40 colaboradores/.test(texto), `Deveria avisar que está mostrando os 40 colaboradores com mais itens em comum — obtido: ${texto}`);
    assert(/5 com menos colaborações não exibido/.test(texto), `Deveria avisar que 5 colaboradores ficaram de fora do desenho — obtido: ${texto}`);

    const linhasTabela = await page.locator('#redeColaboracao table tbody tr').count();
    assertEqual(linhasTabela, 45, 'A tabela acessível deveria continuar listando todos os 45 colaboradores, mesmo os que não aparecem no desenho');
});
