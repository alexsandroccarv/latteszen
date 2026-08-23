/* ==========================================================================
   Regressão: busca do critério do RSC-PCCTAE mostra uma lista de resultados
   clicável abaixo do campo, atualizada a cada tecla (issues #24 e #25) — a
   versão anterior filtrava um <select> nativo, que só mostrava o resultado
   depois de clicado pra abrir.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function habilitarRsc(page) {
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.rscEnabled = true;
        localStorage.setItem('lz_settings', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForTimeout(500);
}

async function abrirFormularioRsc(page, baseUrl, titulo) {
    const items = [makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo, instituicao: 'X', anoFim: '2024' })];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    await page.evaluate((t) => {
        const cards = Array.from(document.querySelectorAll('#itemList .bg-white.dark\\:bg-gray-800.border'));
        const card = cards.find((c) => c.textContent.includes(t));
        card.querySelector('[data-act="edit"]').click();
    }, titulo);
    await page.waitForTimeout(300);
    await page.check('#rscConta');
    await page.waitForTimeout(150);
}

test('Buscador de critério RSC mostra lista clicável que filtra a cada tecla', async ({ page, baseUrl }) => {
    await abrirFormularioRsc(page, baseUrl, 'Curso Filtro RSC');

    // Foca sem digitar nada: lista aparece com todos os ~50 critérios.
    await page.click('#rscCritFiltro');
    await page.waitForTimeout(150);
    const visivelSemFiltro = await page.$eval('#rscCritLista', (el) => !el.classList.contains('hidden'));
    assert(visivelSemFiltro, 'A lista deveria aparecer ao focar o campo, mesmo sem digitar nada');
    const antesDoFiltro = await page.$$eval('#rscCritLista [data-crit]', (btns) => btns.length);
    assert(antesDoFiltro > 40, `Deveria listar todos os ~50 critérios sem filtro (obtido ${antesDoFiltro})`);

    // Digitar "premiação" já filtra a lista visível, sem precisar abrir nada.
    await page.evaluate(() => { window.AppCore.state.formDirty = false; });
    await page.fill('#rscCritFiltro', 'premiação');
    await page.waitForTimeout(150);
    const depoisDoFiltro = await page.$$eval('#rscCritLista [data-crit]', (btns) => btns.map((b) => b.textContent));
    assertEqual(depoisDoFiltro.length, 3, 'Filtrar por "premiação" deveria restringir aos 3 critérios do Anexo III');
    assert(depoisDoFiltro.every((t) => /premiaç/i.test(t)), 'Todas as opções restantes deveriam mencionar "premiação"');
    const formDirtyAoDigitar = await page.evaluate(() => window.AppCore.state.formDirty);
    assert(!formDirtyAoDigitar, 'Digitar no filtro não deveria, por si só, marcar o formulário como alterado');

    // Clicar num resultado seleciona o critério (guardado em #rscCrit, oculto)
    // e mostra o texto completo no campo de busca.
    await page.click('#rscCritLista [data-crit="3.2"]');
    await page.waitForTimeout(150);
    const valorSelecionado = await page.$eval('#rscCrit', (el) => el.value);
    assertEqual(valorSelecionado, '3.2', 'Clicar num resultado deveria selecionar aquele critério');
    const textoAposSelecionar = await page.$eval('#rscCritFiltro', (el) => el.value);
    assert(textoAposSelecionar.includes('Premiação de âmbito nacional'), 'O campo deveria mostrar a descrição completa do critério escolhido');
    const listaFechou = await page.$eval('#rscCritLista', (el) => el.classList.contains('hidden'));
    assert(listaFechou, 'A lista deveria fechar depois de escolher um critério');
    const formDirtyAoSelecionar = await page.evaluate(() => window.AppCore.state.formDirty);
    assert(formDirtyAoSelecionar, 'Selecionar um critério de fato deveria marcar o formulário como alterado');

    // Digita de novo sem escolher nada e clica fora: volta a mostrar o
    // critério que já estava selecionado (não fica com texto solto).
    await page.fill('#rscCritFiltro', 'zzz_sem_correspondencia');
    await page.waitForTimeout(150);
    const semOpcoes = await page.$$eval('#rscCritLista [data-crit]', (btns) => btns.length);
    assertEqual(semOpcoes, 0, 'Um filtro sem correspondência não deveria listar nenhum resultado clicável');
    await page.click('#rscJust'); // clique fora do campo/lista (elemento sempre visível, sem depender de classes Tailwind)
    await page.waitForTimeout(150);
    const textoAposClicarFora = await page.$eval('#rscCritFiltro', (el) => el.value);
    assert(textoAposClicarFora.includes('Premiação de âmbito nacional'), 'Clicar fora sem escolher deveria restaurar o texto do critério já selecionado');
    const valorAposClicarFora = await page.$eval('#rscCrit', (el) => el.value);
    assertEqual(valorAposClicarFora, '3.2', 'A seleção anterior não deveria ter sido perdida');
});

test('Formulário RSC não mostra mais "De interesse institucional" nem "Além das atribuições ordinárias" (issue #31)', async ({ page, baseUrl }) => {
    // Mesmo para um item que já tinha esses dois campos marcados, o formulário
    // não deve renderizar os checkboxes correspondentes — são dados órfãos,
    // sem efeito em nenhum cálculo, filtro ou exportação do RSC.
    const items = [makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso Sem Interesse', instituicao: 'X', anoFim: '2024' },
        { rsc: { conta: true, criterio: '1.3', interesse: true, alemOrdinario: true, jaUsado: false } })];
    await seedCatalog(page, baseUrl, items);
    await habilitarRsc(page);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    await page.evaluate((t) => {
        const cards = Array.from(document.querySelectorAll('#itemList .bg-white.dark\\:bg-gray-800.border'));
        const card = cards.find((c) => c.textContent.includes(t));
        card.querySelector('[data-act="edit"]').click();
    }, 'Curso Sem Interesse');
    await page.waitForTimeout(300);

    const existemCheckboxes = await page.evaluate(() => ({
        interesse: !!document.querySelector('#rscInteresse'),
        alem: !!document.querySelector('#rscAlem'),
    }));
    assert(!existemCheckboxes.interesse, 'O checkbox "De interesse institucional" não deveria mais existir no formulário');
    assert(!existemCheckboxes.alem, 'O checkbox "Além das atribuições ordinárias" não deveria mais existir no formulário');
});
