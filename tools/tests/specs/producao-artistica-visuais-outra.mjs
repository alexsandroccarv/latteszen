/* ==========================================================================
   lattesZen — Outra produção artística/cultural (auditoria vs. Lattes real),
   parte 2 (final): Artes visuais e Outra produção artística/cultural.
   Artes visuais ganha Natureza como select real, Meio de divulgação, 10 mais
   relevantes?, Atividade dos autores, Premiação, Temporada, Autores em
   lista. "Outra produção artística/cultural" é a maior limitação de schema
   da seção 5 — a tela real tem ~15 campos de detalhamento, mas o XSD/DTD só
   suporta 5 (Instituição promotora do evento, Local do evento, Cidade,
   Exposição, Premiação); só os com correspondência real entraram na UI.
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

test('Artes visuais: Natureza (select real) e campos novos (Meio de divulgação, Atividade dos autores, Premiação, Temporada, autores em lista) salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Artes visuais');

    const opcoesNatureza = await page.locator('select[name="natureza"] option').allTextContents();
    assertEqual(opcoesNatureza.map((o) => o.trim()).filter((o) => o && o !== '—'),
        ['Intervenção urbana', 'Livro de artista', 'Performance', 'Pintura', 'Programação visual', 'Vídeo', 'Webart', 'Animação', 'Instalação', 'Computação gráfica', 'Desenho', 'Diversas', 'Escultura', 'Filme', 'Fotografia', 'Gravura', 'Ilustração', 'Outra'],
        `Opções de Natureza incorretas — obtidas: ${JSON.stringify(opcoesNatureza)}`);

    await page.fill('input[name="titulo"]', 'Instalação sobre memória urbana');
    await page.fill('input[name="ano"]', '2022');
    await page.selectOption('select[name="natureza"]', 'Instalação');
    await page.selectOption('select[name="meioDivulgacao"]', 'Meio digital');
    await page.click('input[name="relevante"]');
    await page.click('input[name="divulgacaoCT"]');
    await page.fill('input[name="atividadeAutores"]', 'Curadoria');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="premiacao"]', 'Prêmio Marcantonio Vilaça');
    await page.fill('input[name="temporada"]', '2022/2');
    await page.fill('input[name="evento"]', 'Bienal de São Paulo');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'ARTES_VISUAIS');
    assert(!!item, 'A produção de artes visuais deveria ter sido salva');
    assertEqual(item.fields.natureza, 'Instalação', 'Natureza deveria ser salva');
    assertEqual(item.fields.atividadeAutores, 'Curadoria', 'Atividade dos autores deveria ser salva');
    assertEqual(item.fields.premiacao, 'Prêmio Marcantonio Vilaça', 'Premiação deveria ser salva');
    assertEqual(item.fields.temporada, '2022/2', 'Temporada deveria ser salva');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Fulano de Tal'], 'Autores (lista) deveria ter sido salvo');
});

test('Outra produção artística/cultural: Meio de divulgação, Premiação, Instituição/Local do evento e Autores em lista salvam corretamente', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Produções', 'Outra produção artística');

    await page.fill('input[name="titulo"]', 'Performance urbana coletiva');
    await page.fill('input[name="ano"]', '2020');
    await page.fill('input[name="natureza"]', 'Intervenção coletiva');
    await page.selectOption('select[name="meioDivulgacao"]', 'Hipertexto');
    await page.click('input[name="relevante"]');
    await page.click('input[name="divulgacaoCT"]');
    await page.fill('[data-repeater-input="autoresLista:nomeCompleto"]', 'Fulano de Tal');
    await page.click('[data-repeater-add="autoresLista"]');
    await page.fill('input[name="premiacao"]', 'Menção honrosa');
    await page.fill('input[name="evento"]', 'Coletivo Arte Urbana');
    await page.fill('input[name="localEvento"]', 'Praça Central');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const item = salvo.find((i) => i.typeKey === 'OUTRA_ARTISTICA');
    assert(!!item, 'A outra produção artística deveria ter sido salva');
    assertEqual(item.fields.premiacao, 'Menção honrosa', 'Premiação deveria ser salva');
    assertEqual(item.fields.evento, 'Coletivo Arte Urbana', 'Instituição promotora do evento deveria ser salva');
    assertEqual(item.fields.localEvento, 'Praça Central', 'Local do evento deveria ser salvo');
    assertEqual(item.fields.autoresLista.map((a) => a.nomeCompleto), ['Fulano de Tal'], 'Autores (lista) deveria ter sido salvo');
});
