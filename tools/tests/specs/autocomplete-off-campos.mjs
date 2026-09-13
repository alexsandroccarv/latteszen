/* ==========================================================================
   Regressão: conteúdo digitado num campo (ex.: "Nome completo") vazando pra
   outros campos de tipos DIFERENTES (ex.: Endereço, Descrição/Nº do
   documento, Título, Rede/Plataforma). autocomplete="off" no <form> (já
   corrigido antes) não é suficiente sozinho: navegadores baseados em Chromium
   ignoram esse atributo no <form> especificamente para campos que reconhecem
   heuristicamente como "nome"/"endereço" (via o texto do rótulo, não só o
   atributo name) — o remédio efetivo é repetir autocomplete="off" em CADA
   <input>/<textarea> gerado dinamicamente, já que o "name" (ex.: "titulo") é
   compartilhado por dezenas de tipos diferentes nesta SPA (o campo nunca sai
   do DOM entre uma renderização e outra do jeito que o navegador espera).
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
