/* ==========================================================================
   Regressão: nova aba "Linha do tempo" — painel estilo "gráfico de
   contribuições" (GitHub) com uma linha por categoria e uma coluna por ano;
   a intensidade da cor do quadradinho reflete a quantidade de itens daquela
   categoria naquele ano. O "ano" de cada item reaproveita AppCore.itemYear()
   (o mesmo já usado em Conformidade/Publicar), então itens com período
   (ex.: Formação) contam num único ano, não em todos os anos do intervalo.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

test('Catálogo vazio mostra aviso em vez da grade', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="linhatempo"]');
    await page.waitForTimeout(300);

    const texto = await page.$eval('#tab-linhatempo', (el) => el.textContent);
    assert(texto.includes('Nenhum item com ano identificável'), 'Sem itens com ano, deveria mostrar o aviso, não a grade');
});

test('Linha do tempo conta os itens por categoria e ano (quadradinho com o total exato)', async ({ page, baseUrl }) => {
    const items = [
        makeItem('LIVRO_CAPITULO', 'PRODUCOES', { titulo: 'Artigo A', ano: '2020' }),
        makeItem('LIVRO_CAPITULO', 'PRODUCOES', { titulo: 'Artigo B', ano: '2020' }),
        makeItem('LIVRO_CAPITULO', 'PRODUCOES', { titulo: 'Artigo C', ano: '2021' }),
        // Item com período (início/fim): itemYear() usa o ano de fim, um único ano — não espalha pelo intervalo.
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso X', anoInicio: '2018', anoFim: '2019' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="linhatempo"]');
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('#tab-linhatempo td [data-ano]'));
        const find = (ano) => cells.filter((c) => c.dataset.ano === String(ano)).map((c) => +c.dataset.qtd);
        return {
            anos2020: find(2020),
            anos2021: find(2021),
            anos2018: find(2018),
            anos2019: find(2019),
            texto: document.querySelector('#tab-linhatempo').textContent,
        };
    });

    assert(info.anos2020.includes(2), 'Deveria haver um quadradinho com quantidade 2 no ano 2020 (Artigo A + B)');
    assert(info.anos2021.includes(1), 'Deveria haver um quadradinho com quantidade 1 no ano 2021 (Artigo C)');
    assert(info.anos2019.includes(1), 'Curso com período 2018-2019 deveria contar no ano de FIM (2019)');
    assertEqual(info.anos2018.some((q) => q === 1), false, 'Curso com período 2018-2019 NÃO deveria contar (de novo) no ano de início — um único ano por item');
    assert(info.texto.includes('Formação'), 'A categoria Formação deveria aparecer como linha da grade');
    assert(info.texto.includes('Produções') || info.texto.includes('produções'), 'A categoria Produções deveria aparecer como linha da grade');
});
