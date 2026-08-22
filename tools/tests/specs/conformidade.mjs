/* ==========================================================================
   Regressão: aba Conformidade — filtro por ícone, delegação de eventos,
   "Salvar e próximo"
   --------------------------------------------------------------------------
   - Cada ícone de status é clicável e filtra a lista para aquele estado
     exato (ex.: relógio vermelho = só itens sem carga horária).
   - Os cliques (ícones de status e ações editar/duplicar/excluir) usam
     delegação de evento em #tab-conformidade, não um listener por botão —
     bug histórico: um listener direto se perderia porque #itemList é
     reconstruído sozinho (busca/ordenar) sem repassar pela função que fazia
     o wiring original.
   - "Salvar e próximo" avança para o próximo item do MESMO recorte
     (filtro/busca/ordenação) da Conformidade — inclusive quando a edição
     atual faz o item sair do filtro ativo (o caso mais comum: corrigir o
     problema que causou o filtro).
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function clickIconOn(page, titulo, faClass) {
    await page.evaluate(({ t, cls }) => {
        const cards = Array.from(document.querySelectorAll('#itemList .bg-white.dark\\:bg-gray-800.border'));
        const card = cards.find((c) => c.textContent.includes(t));
        const btn = Array.from(card.querySelectorAll('button[data-view]')).find((b) => b.querySelector('i.' + cls));
        btn.click();
    }, { t: titulo, cls: faClass });
    await page.waitForTimeout(200);
}
async function clickAct(page, titulo, act) {
    await page.evaluate(({ t, a }) => {
        const cards = Array.from(document.querySelectorAll('#itemList .bg-white.dark\\:bg-gray-800.border'));
        const card = cards.find((c) => c.textContent.includes(t));
        card.querySelector(`[data-act="${a}"]`).click();
    }, { t: titulo, a: act });
    await page.waitForTimeout(300);
}
async function itemCount(page) { return page.$eval('#itemCount', (el) => el.textContent.trim()); }

test('Ícone de status filtra a lista e a delegação sobrevive a uma busca', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso CH Vermelho', instituicao: 'X' }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso CH Verde', instituicao: 'X', cargaHoraria: '40' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);

    await clickIconOn(page, 'Curso CH Vermelho', 'fa-clock');
    assertEqual(await itemCount(page), '(1 de 2)', 'Contagem após filtrar pelo relógio vermelho');

    // #itemList é reconstruído pela busca — a delegação de clique deve
    // continuar funcionando nos botões recriados.
    await page.fill('#filterBox', 'Curso');
    await page.waitForTimeout(250);
    await clickIconOn(page, 'Curso CH Vermelho', 'fa-clock'); // desliga o filtro (clicar de novo limpa)
    assert((await itemCount(page)).includes('2'), 'Filtro desligado deveria voltar a mostrar os 2 itens');
});

test('Editar/duplicar/excluir via clique delegado', async ({ page, baseUrl }) => {
    const items = [makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Ações', instituicao: 'X', anoFim: '2024' })];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);

    await clickAct(page, 'Curso Ações', 'dup');
    assertEqual(await itemCount(page), '(2)', 'Contagem após duplicar');

    await clickAct(page, 'Curso Ações', 'del');
    assertEqual(await itemCount(page), '(1)', 'Contagem após mover 1 cópia para a lixeira');

    await clickAct(page, 'Curso Ações', 'edit');
    const aba = await page.evaluate(() => document.querySelector('.tab-btn[aria-selected="true"]').dataset.tab);
    const titulo = await page.$eval('[name="titulo"]', (el) => el.value);
    assertEqual({ aba, titulo }, { aba: 'catalogar', titulo: 'Curso Ações' }, 'Editar deveria abrir o item em Catalogar');
});

test('"Salvar e próximo" avança mesmo quando a edição tira o item do filtro ativo', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso A 2024', instituicao: 'X', anoFim: '2024' }), // sem CH -> vermelho
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso B 2023', instituicao: 'X', anoFim: '2023' }), // sem CH -> vermelho
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso C 2022', instituicao: 'X', anoFim: '2022', cargaHoraria: '20' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);

    await clickIconOn(page, 'Curso A 2024', 'fa-clock'); // filtra pelos "sem carga horária" (A e B)
    assertEqual(await itemCount(page), '(2 de 3)', 'Contagem após filtrar por "sem carga horária"');

    await clickAct(page, 'Curso A 2024', 'edit');
    await page.fill('[name="cargaHoraria"]', '10'); // corrige -> deixa de bater no filtro vermelho
    await page.click('#btnSalvarProximo');
    await page.waitForTimeout(400);
    const tituloNoForm = await page.$eval('[name="titulo"]', (el) => el.value);
    assertEqual(tituloNoForm, 'Curso B 2023', '"Salvar e próximo" deveria abrir o outro item vermelho, não travar por A ter saído do filtro');
});

test('Flag de "Salvar e próximo" não fica preso após uma validação falhar', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso X', instituicao: 'X', anoFim: '2024' }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Y', instituicao: 'X', anoFim: '2023' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    await clickAct(page, 'Curso X', 'edit');

    // Provoca uma falha de validação (URL num formato claramente inválido não
    // é o caso aqui; usamos um número negativo, rejeitado por validateItemFields).
    await page.fill('[name="cargaHoraria"]', '-5');
    await page.click('#btnSalvarProximo');
    await page.waitForTimeout(300);
    const aindaEmX = await page.$eval('[name="titulo"]', (el) => el.value);
    assertEqual(aindaEmX, 'Curso X', 'Validação deveria ter bloqueado o salvamento, mantendo o formulário em Curso X');

    // Corrige e salva pelo botão "Salvar" comum — NÃO deveria herdar o
    // comportamento de "e próximo" do clique anterior que falhou.
    await page.fill('[name="cargaHoraria"]', '5');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(350);
    const depoisDoSalvarComum = await page.$eval('[name="titulo"]', (el) => el.value);
    assertEqual(depoisDoSalvarComum, 'Curso X', '"Salvar" comum deveria reabrir o próprio item salvo, não avançar para o próximo');
});
