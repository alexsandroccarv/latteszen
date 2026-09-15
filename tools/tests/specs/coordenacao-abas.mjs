/* ==========================================================================
   Regressão: coordenação entre abas abertas simultaneamente (issue #140,
   item 2) — antes desta correção, Storage.saveCatalog()/saveTrash()
   sobrescreviam o array inteiro no localStorage a cada gravação, sem
   mesclar: duas abas abertas ao mesmo tempo se atropelavam silenciosamente
   (a última a salvar vencia).
   Os testes abaixo abrem duas páginas de verdade DENTRO DO MESMO contexto
   de navegador (mesma origem ⇒ mesmo localStorage) — exatamente como duas
   abas reais do mesmo navegador — e escrevem diretamente em lz_catalog/
   lz_trash a partir da 2ª página, o que dispara o evento nativo "storage"
   na 1ª (o navegador nunca dispara esse evento na própria aba que escreveu,
   só nas abas irmãs — por isso o teste precisa de duas páginas de verdade,
   não dá pra simular com uma só).
   ========================================================================== */
import { test, assert, assertEqual, makeItem } from '../harness.mjs';

async function abrirSegundaAba(page, baseUrl) {
    const aba2 = await page.context().newPage();
    await aba2.goto(baseUrl + '/index.html');
    await aba2.waitForTimeout(300);
    return aba2;
}

test('Duas abas: item editado em uma aparece mesclado na outra, sem apagar os demais', async ({ page, baseUrl }) => {
    const a = makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Item A (original)', instituicao: 'X' }, { id: 'it-aba-a', updatedAt: '2026-01-01T00:00:00.000Z' });
    const b = makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Item B', instituicao: 'Y' }, { id: 'it-aba-b', updatedAt: '2026-01-01T00:00:00.000Z' });
    await page.goto(baseUrl + '/index.html');
    await page.evaluate((its) => localStorage.setItem('lz_catalog', JSON.stringify(its)), [a, b]);
    await page.reload();
    await page.waitForTimeout(400);

    const aba2 = await abrirSegundaAba(page, baseUrl);

    // Aba 2 "salva" (edita o item A e cria o item C) — grava lz_catalog
    // direto, do jeito que Storage.saveCatalog(state.catalogo.items) faria.
    const editadoA = makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Item A (editado na aba 2)', instituicao: 'X' }, { id: 'it-aba-a', updatedAt: '2026-02-01T00:00:00.000Z' });
    const c = makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Item C (novo na aba 2)', instituicao: 'Z' }, { id: 'it-aba-c', updatedAt: '2026-02-01T00:00:00.000Z' });
    await aba2.evaluate((its) => localStorage.setItem('lz_catalog', JSON.stringify(its)), [editadoA, b, c]);

    // Dá tempo do evento "storage" chegar na aba 1 e a mesclagem rodar.
    await page.waitForTimeout(500);

    const itensAba1 = await page.evaluate(() => window.AppCore.state.catalogo.items.map((i) => ({ id: i.id, titulo: i.fields.titulo })));
    assertEqual(itensAba1.length, 3, 'Aba 1 deveria ter mesclado o item novo, ficando com 3 itens');
    assertEqual(itensAba1.find((i) => i.id === 'it-aba-a').titulo, 'Item A (editado na aba 2)', 'Item A deveria ter sido atualizado com a versão mais recente (da aba 2)');
    assert(itensAba1.some((i) => i.id === 'it-aba-b'), 'Item B (não tocado por nenhuma aba) não deveria ter sumido');
    assert(itensAba1.some((i) => i.id === 'it-aba-c'), 'Item C (criado na aba 2) deveria ter aparecido na aba 1');

    // A mesclagem também deveria ter sido persistida de volta no localStorage
    // da própria aba 1 (pra uma 3ª aba que abra depois já ver tudo).
    const persistidoAba1 = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog')).length);
    assertEqual(persistidoAba1, 3, 'A mesclagem deveria ter sido regravada no localStorage da aba 1');

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /atualizado a partir de outra aba/.test(t)), 'Deveria ter avisado que o catálogo mudou em outra aba');

    await aba2.close();
});

test('Duas abas: excluir um item em uma remove ele da outra (mescla catálogo + lixeira)', async ({ page, baseUrl }) => {
    const item = makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Item a excluir', instituicao: 'X' }, { id: 'it-del', updatedAt: '2026-01-01T00:00:00.000Z' });
    await page.goto(baseUrl + '/index.html');
    await page.evaluate((it) => localStorage.setItem('lz_catalog', JSON.stringify([it])), item);
    await page.reload();
    await page.waitForTimeout(400);

    const aba2 = await abrirSegundaAba(page, baseUrl);

    // Aba 2 "exclui" o item: some do catálogo, some na lixeira com deletedAt
    // mais recente que o updatedAt do item — do jeito que deleteItem() faz.
    const excluido = Object.assign({}, item, { deletedAt: '2026-02-01T00:00:00.000Z', trashFromFolder: 'X' });
    await aba2.evaluate((it) => {
        localStorage.setItem('lz_catalog', JSON.stringify([]));
        localStorage.setItem('lz_trash', JSON.stringify([it]));
    }, excluido);

    await page.waitForTimeout(500);

    const catalogo = await page.evaluate(() => window.AppCore.state.catalogo.items.map((i) => i.id));
    const lixeira = await page.evaluate(() => window.AppCore.state.catalogo.trash.map((i) => i.id));
    assert(!catalogo.includes('it-del'), 'Item excluído em outra aba não deveria continuar no catálogo local');
    assert(lixeira.includes('it-del'), 'Item excluído em outra aba deveria ter aparecido na lixeira local');

    await aba2.close();
});

test('Edição mais recente vence sobre uma exclusão desatualizada vinda de outra aba', async ({ page, baseUrl }) => {
    // Aba 1 já está com a versão EDITADA (updatedAt mais novo) em memória —
    // simula o usuário tendo acabado de salvar uma edição.
    const editado = makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Versão editada (mais recente)', instituicao: 'X' }, { id: 'it-conflito', updatedAt: '2026-03-01T00:00:00.000Z' });
    await page.goto(baseUrl + '/index.html');
    await page.evaluate((it) => localStorage.setItem('lz_catalog', JSON.stringify([it])), editado);
    await page.reload();
    await page.waitForTimeout(400);

    const aba2 = await abrirSegundaAba(page, baseUrl);

    // Aba 2 grava uma exclusão desatualizada (deletedAt ANTERIOR à edição já
    // aplicada na aba 1) — representa uma aba que ficou pra trás.
    const tombstoneAntigo = makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Versão antiga', instituicao: 'X' }, { id: 'it-conflito', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: '2026-01-15T00:00:00.000Z' });
    await aba2.evaluate((it) => {
        localStorage.setItem('lz_catalog', JSON.stringify([]));
        localStorage.setItem('lz_trash', JSON.stringify([it]));
    }, tombstoneAntigo);

    await page.waitForTimeout(500);

    const catalogo = await page.evaluate(() => window.AppCore.state.catalogo.items.map((i) => ({ id: i.id, titulo: i.fields.titulo })));
    const lixeira = await page.evaluate(() => window.AppCore.state.catalogo.trash.map((i) => i.id));
    assert(catalogo.some((i) => i.id === 'it-conflito'), 'A edição mais recente deveria ter vencido — item não deveria ter ido para a lixeira');
    assertEqual(catalogo.find((i) => i.id === 'it-conflito').titulo, 'Versão editada (mais recente)', 'O título deveria continuar sendo o da edição mais recente');
    assert(!lixeira.includes('it-conflito'), 'Item não deveria estar na lixeira (a exclusão era mais antiga que a edição)');

    await aba2.close();
});

test('Edição em andamento (formulário não salvo) não é derrubada por uma mudança de outra aba', async ({ page, baseUrl }) => {
    const a = makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Item A', instituicao: 'X' }, { id: 'it-form-a', updatedAt: '2026-01-01T00:00:00.000Z' });
    await page.goto(baseUrl + '/index.html');
    await page.evaluate((it) => localStorage.setItem('lz_catalog', JSON.stringify([it])), a);
    await page.reload();
    await page.waitForTimeout(400);

    // Simula edição não salva em andamento na aba 1 (Catalogar, formDirty).
    await page.evaluate(() => {
        window.AppCore.switchTab('catalogar');
        window.AppCore.state.ui.formDirty = true;
    });
    const htmlAntes = await page.evaluate(() => document.querySelector('#tab-catalogar').innerHTML);

    const aba2 = await abrirSegundaAba(page, baseUrl);
    const b = makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Item B (novo)', instituicao: 'Y' }, { id: 'it-form-b', updatedAt: '2026-02-01T00:00:00.000Z' });
    await aba2.evaluate((its) => localStorage.setItem('lz_catalog', JSON.stringify(its)), [a, b]);
    await page.waitForTimeout(500);

    // O DOM do formulário em edição não deveria ter sido re-renderizado...
    const htmlDepois = await page.evaluate(() => document.querySelector('#tab-catalogar').innerHTML);
    assertEqual(htmlDepois, htmlAntes, 'O formulário em edição não deveria ter sido re-renderizado enquanto há alterações não salvas');
    // ...mas o dado já deveria estar mesclado em memória (aparece ao sair/voltar da aba).
    const itens = await page.evaluate(() => window.AppCore.state.catalogo.items.map((i) => i.id));
    assert(itens.includes('it-form-b'), 'O item novo da outra aba deveria estar mesclado em memória mesmo sem re-renderizar');

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /termine ou cancele/.test(t)), 'Deveria avisar especificamente que há uma edição em andamento');

    await aba2.close();
});
