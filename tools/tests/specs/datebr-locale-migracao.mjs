// lattesZen — Copyright (C) 2026 Alexsandro Cardoso Carvalho
//
// This file is part of lattesZen.
//
// lattesZen is free software: you can redistribute it and/or modify it
// under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or (at
// your option) any later version.
//
// lattesZen is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public
// License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with lattesZen. If not, see <https://www.gnu.org/licenses/>.

/* ==========================================================================
   Regressão: campos `datebr` (data com máscara em tab-catalogar.js) — dois
   comportamentos novos:
   1) Migração: item salvo antes desta versão guardava "dd/mm/aaaa" (ou o
      legado ISO "aaaa-mm-dd") por extenso; agora o CANÔNICO gravado no item
      é sem separador (ex.: "21091990"), sempre ordem dia-mês-ano — ver
      AppCore.migrarDatasItem(), chamada dentro de migrarItens() no boot.
   2) Locale: a EXIBIÇÃO/digitação no campo de texto acompanha o idioma
      ativo (dd/mm/aaaa em pt-br, mm/dd/aaaa em en — ver datebrParaCanonico/
      datebrParaExibicao em app-core.js e fieldDateBr/wireDateBr em
      tab-catalogar.js), mas o valor GRAVADO no item continua sempre no
      mesmo formato canônico, independente do locale.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function abrirEdicao(page, item) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.evaluate((it) => window.AppCore.buildForm(window.AppCore.state.catalogo.items.find((i) => i.id === it.id)), item);
    await page.waitForTimeout(200);
}

test('datebr: item salvo com "dd/mm/aaaa" (formato antigo) é migrado pro canônico sem separador ao carregar', async ({ page, baseUrl }) => {
    const items = [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal', dataNascimento: '21/09/1990' })];
    await seedCatalog(page, baseUrl, items); // seedCatalog já recarrega a página — migrarItens() roda no boot
    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const ident = salvo.find((i) => i.typeKey === 'IDENTIFICACAO');
    assertEqual(ident.fields.dataNascimento, '21091990', 'A migração deveria ter tirado a "/" e gravado o canônico (dd-mm-aaaa, sem separador)');
});

test('datebr: item salvo no ISO legado ("aaaa-mm-dd") também migra pro canônico sem separador', async ({ page, baseUrl }) => {
    const items = [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal', dataNascimento: '1990-09-21' })];
    await seedCatalog(page, baseUrl, items);
    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const ident = salvo.find((i) => i.typeKey === 'IDENTIFICACAO');
    assertEqual(ident.fields.dataNascimento, '21091990', 'ISO legado (aaaa-mm-dd) deveria virar o canônico dd-mm-aaaa sem separador, igual ao formato "dd/mm/aaaa"');
});

test('datebr: em pt-br, o campo exibe/edita no formato dd/mm/aaaa (comportamento de sempre)', async ({ page, baseUrl }) => {
    const items = [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal', dataNascimento: '21091990' })];
    await seedCatalog(page, baseUrl, items);
    await abrirEdicao(page, items[0]);
    const exibido = await page.$eval('[name="dataNascimento"]', (el) => el.value);
    assertEqual(exibido, '21/09/1990', 'Em pt-br, o campo deveria mostrar dd/mm/aaaa (dia 21, mês 09, ano 1990)');

    await page.fill('[name="dataNascimento"]', '05/03/1985'); // dd/mm/aaaa: dia 5, mês 3, ano 1985
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);
    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const ident = salvo.find((i) => i.typeKey === 'IDENTIFICACAO');
    assertEqual(ident.fields.dataNascimento, '05031985', 'O canônico gravado deveria continuar dd-mm-aaaa (dia 05, mês 03, ano 1985)');
});

test('datebr: em "en", o campo exibe/edita no formato mm/dd/aaaa, mas o valor GRAVADO continua dd-mm-aaaa canônico', async ({ page, baseUrl }) => {
    const items = [makeItem('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal', dataNascimento: '21091990' })]; // dia 21, mês 09 (setembro), ano 1990
    await page.goto(baseUrl + '/index.html');
    await page.evaluate((its) => {
        localStorage.setItem('lz_catalog', JSON.stringify(its));
        localStorage.setItem('lz_settings', JSON.stringify({ locale: 'en' }));
    }, items);
    await page.reload();
    await page.waitForTimeout(500);

    await abrirEdicao(page, items[0]);
    const exibido = await page.$eval('[name="dataNascimento"]', (el) => el.value);
    assertEqual(exibido, '09/21/1990', 'Em "en", o campo deveria mostrar mm/dd/aaaa (mês 09, dia 21, ano 1990) — mesmo dado do dd/mm/aaaa de pt-br, só a ORDEM de exibição muda');

    // Digita uma data NOVA já no formato mm/dd/aaaa esperado em "en": mês 12
    // (dezembro), dia 25, ano 1991.
    await page.fill('[name="dataNascimento"]', '12/25/1991');
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);
    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    const ident = salvo.find((i) => i.typeKey === 'IDENTIFICACAO');
    assertEqual(ident.fields.dataNascimento, '25121991', 'O canônico gravado deveria continuar dd-mm-aaaa (dia 25, mês 12) mesmo tendo sido digitado em mm/dd/aaaa (locale en) — pra manter compatibilidade com o XML Lattes/ordenação/etc., que sempre esperam essa ordem');
});

test('datebr: um ano puro ou mês/ano (data parcial) não muda de ordem entre locales — só a data COMPLETA (8 dígitos) tem dia/mês trocados', async ({ page, baseUrl }) => {
    const items = [makeItem('FORMACAO_ACADEMICA', 'FORMACAO', { nivel: 'Doutorado', instituicao: 'USP', curso: 'Ciência da Computação', anoInicio: '092018', statusCurso: 'Em andamento' })]; // mm+aaaa: mês 09, ano 2018
    await page.goto(baseUrl + '/index.html');
    await page.evaluate((its) => {
        localStorage.setItem('lz_catalog', JSON.stringify(its));
        localStorage.setItem('lz_settings', JSON.stringify({ locale: 'en' }));
    }, items);
    await page.reload();
    await page.waitForTimeout(500);

    await abrirEdicao(page, items[0]);
    const exibido = await page.$eval('[name="anoInicio"]', (el) => el.value);
    assertEqual(exibido, '09/2018', 'mm/aaaa não tem ambiguidade de ordem entre locales — deveria continuar "09/2018" mesmo em "en"');
});
