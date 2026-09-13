/* ==========================================================================
   Regressão: conteúdo digitado num campo (ex.: "Nome completo") vazando pra
   outros campos de tipos DIFERENTES (ex.: Endereço, Descrição/Nº do
   documento, Título, Rede/Plataforma), aparecendo sozinho ao focar (sem
   nenhum dropdown de sugestão pra clicar). autocomplete="off" (no <form> e em
   cada <input>) não é suficiente sozinho: o Chrome (e afins) ignora esse
   atributo, por design, no autofill de "Nome"/"Endereço" — a heurística usa o
   texto do rótulo, não só name/autocomplete. O remédio que de fato funciona:
   `readonly` até o 1º foco (o navegador não tenta preencher um campo
   somente-leitura na varredura inicial; wireReadonlyUntilFocus remove o
   atributo assim que o usuário for realmente interagir). A suíte usa
   page.fill(), que exige o elemento "editable" — harness.mjs contorna isso
   dando um clique real antes de cada fill() (dispara o mesmo foco que um
   usuário de verdade dispararia), sem precisar mudar teste por teste.
   ========================================================================== */
import { test, assert, seedCatalog } from '../harness.mjs';

async function abrir(page, baseUrl, categoria, tipo) {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', categoria);
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', tipo);
    await page.waitForTimeout(150);
}

test('Campo de texto genérico (ex.: Endereço → "titulo") tem autocomplete="off"', async ({ page, baseUrl }) => {
    await abrir(page, baseUrl, 'DADOS_GERAIS', 'ENDERECO');
    const ac = await page.$eval('#dynFields input[name="titulo"]', (el) => el.getAttribute('autocomplete'));
    assert(ac === 'off', `Esperado autocomplete="off", obtido "${ac}"`);
});

test('Campo textarea tem autocomplete="off"', async ({ page, baseUrl }) => {
    await abrir(page, baseUrl, 'DADOS_GERAIS', 'OUTRAS_INFO');
    const ac = await page.$eval('#dynFields textarea[name="descricao"]', (el) => el.getAttribute('autocomplete'));
    assert(ac === 'off', `Esperado autocomplete="off", obtido "${ac}"`);
});

test('Campo de data (datebr) tem autocomplete="off"', async ({ page, baseUrl }) => {
    await abrir(page, baseUrl, 'PRODUCOES', 'ARTIGO_PERIODICO');
    const ac = await page.$eval('#dynFields input[name="ano"]', (el) => el.getAttribute('autocomplete'));
    assert(ac === 'off', `Esperado autocomplete="off", obtido "${ac}"`);
});

test('Campo URL tem autocomplete="off"', async ({ page, baseUrl }) => {
    await abrir(page, baseUrl, 'PRODUCOES', 'ARTIGO_PERIODICO');
    const ac = await page.$eval('#dynFields input[name="url"]', (el) => el.getAttribute('autocomplete'));
    assert(ac === 'off', `Esperado autocomplete="off", obtido "${ac}"`);
});

test('Campo DOI tem autocomplete="off"', async ({ page, baseUrl }) => {
    await abrir(page, baseUrl, 'PRODUCOES', 'ARTIGO_PERIODICO');
    const ac = await page.$eval('#dynFields input[name="doi"]', (el) => el.getAttribute('autocomplete'));
    assert(ac === 'off', `Esperado autocomplete="off", obtido "${ac}"`);
});

test('Campo de repeater (ex.: Autores → "Nome completo") tem autocomplete="off"', async ({ page, baseUrl }) => {
    await abrir(page, baseUrl, 'PRODUCOES', 'ARTIGO_PERIODICO');
    const ac = await page.$eval('[data-repeater-input="autoresLista:nomeCompleto"]', (el) => el.getAttribute('autocomplete'));
    assert(ac === 'off', `Esperado autocomplete="off", obtido "${ac}"`);
});

test('Campo de texto genérico começa readonly (contorna o autofill de nome/endereço) e libera ao focar', async ({ page, baseUrl }) => {
    await abrir(page, baseUrl, 'DADOS_GERAIS', 'ENDERECO');
    const roAntes = await page.$eval('#dynFields input[name="titulo"]', (el) => el.hasAttribute('readonly'));
    assert(roAntes, 'O campo deveria começar readonly, antes de qualquer foco');

    await page.focus('#dynFields input[name="titulo"]');
    const roDepois = await page.$eval('#dynFields input[name="titulo"]', (el) => el.hasAttribute('readonly'));
    assert(!roDepois, 'Ao focar, o readonly deveria ser removido (liberando a digitação normal)');
});

test('Campo de repeater (Autores → "Nome completo") também começa readonly e libera ao focar', async ({ page, baseUrl }) => {
    await abrir(page, baseUrl, 'PRODUCOES', 'ARTIGO_PERIODICO');
    const sel = '[data-repeater-input="autoresLista:nomeCompleto"]';
    const roAntes = await page.$eval(sel, (el) => el.hasAttribute('readonly'));
    assert(roAntes, 'O campo do repeater deveria começar readonly, antes de qualquer foco');

    await page.focus(sel);
    const roDepois = await page.$eval(sel, (el) => el.hasAttribute('readonly'));
    assert(!roDepois, 'Ao focar, o readonly do campo do repeater deveria ser removido');
});

test('page.fill() continua funcionando normalmente mesmo com o campo começando readonly (harness clica antes de preencher)', async ({ page, baseUrl }) => {
    await abrir(page, baseUrl, 'DADOS_GERAIS', 'ENDERECO');
    await page.fill('#dynFields input[name="titulo"]', 'Rua de teste, 42');
    const valor = await page.$eval('#dynFields input[name="titulo"]', (el) => el.value);
    assert(valor === 'Rua de teste, 42', `page.fill() deveria ter preenchido normalmente, obtido "${valor}"`);
});
