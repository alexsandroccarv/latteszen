/* ==========================================================================
   Regressão: categoria "Grupos de Pesquisa" (issues #32 e #33) — os itens 6 e
   7 do Requisito VI (liderança/vice-liderança e participação em grupo de
   pesquisa/extensão registrado) não tinham nenhum tipo de item onde entrar.
   Cobre: a categoria só aparece com o módulo RSC habilitado, e um item desse
   tipo pode ser contabilizado no RSC com o critério 6.6.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

async function habilitarRsc(page) {
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.rscEnabled = true;
        localStorage.setItem('lz_settings', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForTimeout(500);
}

test('Categoria "Grupos de Pesquisa" só aparece no seletor com o módulo RSC habilitado', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(200);
    const semRsc = await page.$$eval('#selCategoria option', (opts) => opts.map((o) => o.value));
    assert(!semRsc.includes('RSC_GRUPO'), 'Sem o módulo RSC habilitado, "Grupos de Pesquisa" não deveria aparecer no seletor de categoria');

    await habilitarRsc(page);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(200);
    const comRsc = await page.$$eval('#selCategoria option', (opts) => opts.map((o) => o.value));
    assert(comRsc.includes('RSC_GRUPO'), 'Com o módulo RSC habilitado, "Grupos de Pesquisa" deveria aparecer no seletor de categoria');

    const rotulo = await page.$eval('#selCategoria', (sel, key) => {
        const opt = Array.from(sel.options).find((o) => o.value === key);
        return opt ? opt.textContent : null;
    }, 'RSC_GRUPO');
    assertEqual(rotulo, '20. Grupos de Pesquisa', 'O rótulo da categoria deveria ser "20. Grupos de Pesquisa"');
});

test('Categorias aparecem em ordem numérica no seletor, com "20. Grupos de Pesquisa" após a 19 (issue #36)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await habilitarRsc(page);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(200);

    const numeros = await page.$$eval('#selCategoria option', (opts) => opts
        .map((o) => o.textContent.match(/^(\d+)\./))
        .filter(Boolean)
        .map((m) => parseInt(m[1], 10)));
    const ordenado = [...numeros].sort((a, b) => a - b);
    assertEqual(numeros, ordenado, `As categorias deveriam aparecer em ordem numérica crescente — obtido [${numeros.join(', ')}]`);

    const idxBancas = numeros.indexOf(11);
    const idxGrupos = numeros.indexOf(20);
    assert(idxBancas >= 0 && idxGrupos > idxBancas, '"20. Grupos de Pesquisa" deveria aparecer depois da categoria 11 (Bancas), não entre 11 e 12');
});

test('Categoria "RSC — Atividades administrativas" (97) foi removida (issue #34)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await habilitarRsc(page);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(200);
    const opcoes = await page.$$eval('#selCategoria option', (opts) => opts.map((o) => o.value));
    assert(!opcoes.includes('RSC_ADMIN'), 'A categoria "RSC — Atividades administrativas" não deveria mais existir no seletor de categoria');
});

test('Item de "Grupo de pesquisa/extensão registrado" pode ser contabilizado no RSC com o critério 6.6', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await habilitarRsc(page);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(200);

    await page.selectOption('#selCategoria', 'RSC_GRUPO');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'RSC_GRUPO_PESQUISA');
    await page.waitForTimeout(150);
    await page.fill('[name="titulo"]', 'Grupo de Estudos em Redes');
    await page.selectOption('[name="papel"]', 'Líder');

    await page.check('#rscConta');
    await page.waitForTimeout(150);
    await page.click('#rscCritFiltro');
    await page.fill('#rscCritFiltro', 'grupo de pesquisa');
    await page.waitForTimeout(150);
    await page.click('#rscCritLista [data-crit="6.6"]');
    await page.waitForTimeout(150);
    const criterioSelecionado = await page.$eval('#rscCrit', (el) => el.value);
    assertEqual(criterioSelecionado, '6.6', 'O critério 6.6 (liderança/vice-liderança de grupo de pesquisa) deveria ter sido selecionado');

    await page.click('button[type="submit"]');
    await page.waitForTimeout(350);

    const salvo = await page.evaluate(() => {
        const items = JSON.parse(localStorage.getItem('lz_catalog') || '[]');
        const it = items.find((i) => i.fields && i.fields.titulo === 'Grupo de Estudos em Redes');
        return it ? { categoryKey: it.categoryKey, typeKey: it.typeKey, papel: it.fields.papel, rsc: it.rsc } : null;
    });
    assert(salvo, 'O item deveria ter sido salvo no catálogo');
    assertEqual(salvo.categoryKey, 'RSC_GRUPO', 'Categoria salva deveria ser RSC_GRUPO');
    assertEqual(salvo.typeKey, 'RSC_GRUPO_PESQUISA', 'Tipo salvo deveria ser RSC_GRUPO_PESQUISA');
    assertEqual(salvo.papel, 'Líder', 'O papel "Líder" deveria ter sido salvo nos campos do item');
    assertEqual(salvo.rsc && salvo.rsc.criterio, '6.6', 'O critério RSC salvo deveria ser 6.6');

    await page.click('[data-tab="rsc"]');
    await page.waitForTimeout(300);
    const texto = await page.$eval('#tab-rsc', (el) => el.textContent);
    assert(texto.includes('Grupo de Estudos em Redes'), 'O item deveria aparecer na lista de itens contabilizados no RSC');
    assert(texto.includes('7,5'), 'Os 7,5 pontos do critério 6.6 deveriam aparecer na tela do simulador');
});

test('Campos de "Grupo de pesquisa/extensão registrado" (issue #35): Instituição, Líder(es), Vice-líder, Área, Função e Egresso/Data de desligamento', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await habilitarRsc(page);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(200);

    await page.selectOption('#selCategoria', 'RSC_GRUPO');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'RSC_GRUPO_PESQUISA');
    await page.waitForTimeout(150);

    // "Data de desligamento" começa escondida (Egresso desmarcado por padrão).
    const escondidoAntes = await page.$eval('[data-field="anoFim"]', (el) => el.classList.contains('hidden'));
    assert(escondidoAntes, 'Sem "Egresso" marcado, "Data de desligamento" deveria ficar escondida');

    await page.fill('[name="titulo"]', 'Grupo de Estudos em Educação');
    await page.fill('[name="instituicao"]', 'UNIFESP');
    await page.fill('[name="lideres"]', 'Fulano de Tal; Ciclana da Silva');
    await page.fill('[name="viceLider"]', 'Beltrano Souza');
    await page.fill('[name="area"]', 'Educação');
    await page.selectOption('[name="papel"]', 'Pesquisador');
    await page.fill('[name="anoInicio"]', '03/2020');

    await page.check('[name="egresso"]');
    await page.waitForTimeout(150);
    const escondidoDepois = await page.$eval('[data-field="anoFim"]', (el) => el.classList.contains('hidden'));
    assert(!escondidoDepois, 'Com "Egresso" marcado, "Data de desligamento" deveria aparecer');
    await page.fill('[name="anoFim"]', '12/2023');

    await page.click('button[type="submit"]');
    await page.waitForTimeout(350);

    const salvo = await page.evaluate(() => {
        const items = JSON.parse(localStorage.getItem('lz_catalog') || '[]');
        const it = items.find((i) => i.fields && i.fields.titulo === 'Grupo de Estudos em Educação');
        return it ? it.fields : null;
    });
    assert(salvo, 'O item deveria ter sido salvo no catálogo');
    assertEqual(salvo.instituicao, 'UNIFESP', 'Instituição salva');
    assertEqual(salvo.lideres, 'Fulano de Tal; Ciclana da Silva', 'Líder(es) salvo(s)');
    assertEqual(salvo.viceLider, 'Beltrano Souza', 'Vice-líder salvo');
    assertEqual(salvo.area, 'Educação', 'Área salva');
    assertEqual(salvo.papel, 'Pesquisador', 'Função salva');
    assertEqual(salvo.egresso, 'Sim', 'Egresso salvo como "Sim"');
    assert(salvo.anoFim && salvo.anoFim.includes('2023'), 'Data de desligamento salva');
});
