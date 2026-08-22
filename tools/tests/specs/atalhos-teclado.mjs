/* ==========================================================================
   Regressão: atalhos de teclado em Catalogar (issue #4)
   --------------------------------------------------------------------------
   - Ctrl+S salva o item em edição (equivalente ao botão "Salvar").
   - Ctrl+Enter dispara "Salvar e próximo" (se estiver editando um item
     existente) ou "Salvar e novo" (se estiver criando um item sem "próximo"
     disponível).
   - Alt+↓ / Alt+↑, enquanto edita um item existente, navegam para o
     próximo/anterior item da mesma lista/recorte de Conformidade SEM salvar.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function clickAct(page, titulo, act) {
    await page.evaluate(({ t, a }) => {
        const cards = Array.from(document.querySelectorAll('#itemList .bg-white.dark\\:bg-gray-800.border'));
        const card = cards.find((c) => c.textContent.includes(t));
        card.querySelector(`[data-act="${a}"]`).click();
    }, { t: titulo, a: act });
    await page.waitForTimeout(300);
}

test('Ctrl+S salva o item em edição', async ({ page, baseUrl }) => {
    const items = [makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Atalho CtrlS', instituicao: 'X', anoFim: '2024' })];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    await clickAct(page, 'Curso Atalho CtrlS', 'edit');

    await page.fill('[name="instituicao"]', 'Instituto Alterado');
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(350);

    const salvo = await page.evaluate(() => {
        const items = JSON.parse(localStorage.getItem('lz_catalog') || '[]');
        const it = items.find((i) => i.fields && i.fields.titulo === 'Curso Atalho CtrlS');
        return it ? it.fields.instituicao : null;
    });
    assertEqual(salvo, 'Instituto Alterado', 'Ctrl+S deveria ter salvo a alteração');
});

test('Ctrl+Enter dispara "Salvar e próximo" quando editando um item existente', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Atalho A', instituicao: 'X', anoFim: '2024' }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Atalho B', instituicao: 'X', anoFim: '2023' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    await clickAct(page, 'Curso Atalho A', 'edit');

    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(400);
    const tituloNoForm = await page.$eval('[name="titulo"]', (el) => el.value);
    assertEqual(tituloNoForm, 'Curso Atalho B', 'Ctrl+Enter deveria salvar e abrir o próximo item da lista');
});

test('Ctrl+Enter dispara "Salvar e novo" ao criar um item sem "próximo" disponível', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(500);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(200);
    const catVal = await page.$eval('#selCategoria', (sel) => Array.from(sel.options).find((o) => o.textContent.includes('Formação')).value);
    await page.selectOption('#selCategoria', catVal);
    await page.waitForTimeout(150);
    const tipoVal = await page.$eval('#selTipo', (sel) => Array.from(sel.options).find((o) => o.textContent.includes('Formação complementar')).value);
    await page.selectOption('#selTipo', tipoVal);
    await page.waitForTimeout(150);

    await page.fill('[name="titulo"]', 'Curso Atalho Novo');
    await page.fill('[name="instituicao"]', 'Instituto X');
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(400);

    const tituloNoForm = await page.$eval('[name="titulo"]', (el) => el.value);
    assertEqual(tituloNoForm, '', 'Ctrl+Enter sem "próximo" disponível deveria ter usado "Salvar e novo" (formulário limpo, mesma categoria/tipo)');
    const salvou = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').some((i) => i.fields.titulo === 'Curso Atalho Novo'));
    assert(salvou, 'O item deveria ter sido salvo antes de limpar o formulário');
});

test('Alt+↓ / Alt+↑ navegam entre itens em edição sem salvar', async ({ page, baseUrl }) => {
    const items = [
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Seta A', instituicao: 'X', anoFim: '2024' }),
        makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Seta B', instituicao: 'X', anoFim: '2023' }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    await clickAct(page, 'Curso Seta A', 'edit');

    await page.keyboard.press('Alt+ArrowDown');
    await page.waitForTimeout(300);
    assertEqual(await page.$eval('[name="titulo"]', (el) => el.value), 'Curso Seta B', 'Alt+↓ deveria abrir o próximo item');

    await page.keyboard.press('Alt+ArrowUp');
    await page.waitForTimeout(300);
    assertEqual(await page.$eval('[name="titulo"]', (el) => el.value), 'Curso Seta A', 'Alt+↑ deveria voltar ao item anterior');

    // Não deve ter salvo nada durante a navegação (só abriu os itens).
    const catalogoIntacto = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').map((i) => i.fields.titulo).sort());
    assertEqual(catalogoIntacto, ['Curso Seta A', 'Curso Seta B'], 'Navegar com Alt+seta não deveria alterar o catálogo');
});
