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
   Regressão: trocar o idioma no assistente recarrega a página (nomes de
   pasta nascem no idioma escolhido)
   --------------------------------------------------------------------------
   lattes-types-*.js calcula rótulos de categoria/campo e nomes de pasta com
   t() UMA VEZ, no carregamento do script — antes de qualquer troca de
   idioma interativa no assistente. Sem um reload depois de trocar o
   #wizLocale, LattesTypes.allFolders() continuava devolvendo os nomes de
   pasta do idioma antigo (normalmente pt-br, o padrão de uma instalação
   nova), mesmo já com getLocale()/state.locale corretos — ou seja, a pasta
   criada ficava em português mesmo escolhendo English. A correção: trocar
   o idioma recarrega a página (agora com o idioma já persistido, lido no
   bootstrap síncrono de i18n.js — mesmo mecanismo que já fazia abrir o app
   de novo funcionar certo) e restaura o assistente exatamente no passo em
   que a pessoa estava, via sessionStorage (não precisa refazer os cliques).
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

async function abrirConfig(page, baseUrl) {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
}

test('Trocar o idioma no assistente recarrega a página e volta no mesmo passo, já com os nomes de pasta no idioma novo', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    await page.click('[data-wizard-modo="novo"]');
    await page.waitForTimeout(100);
    await page.click('[data-wizard-tipo="local"]');
    await page.waitForTimeout(100);
    assertEqual(await page.locator('#btnChooseDir').count(), 1, 'Deveria estar no passo "Pasta no computador", com "Escolher pasta" visível, antes de trocar o idioma');

    // Antes da correção: LattesTypes.allFolders() continuava com os nomes
    // de pasta em pt-br mesmo depois de setLocale('en') "ao vivo" (sem
    // reload), porque já tinham sido calculados uma vez no carregamento.
    const antesDoReload = await page.evaluate(() => {
        window.AppCore.setLocale('en');
        return window.LattesTypes.allFolders();
    });
    assert(antesDoReload.includes('Caixa de Entrada'), 'Confirma o bug que a correção resolve: setLocale() sem reload NÃO muda os nomes de pasta já calculados (ainda em pt-br aqui)');
    // Devolve pro estado antes desta checagem auxiliar (setLocale direto,
    // sem reload) não vazar pro restante do teste.
    await page.evaluate(() => window.AppCore.setLocale('pt-br'));

    await Promise.all([
        page.waitForNavigation(),
        page.selectOption('#wizLocale', 'en'),
    ]);
    // waitForNavigation() resolve no 'load' do documento novo — os scripts
    // (type="module", equivalentes a defer) já rodaram até o fim síncrono,
    // mas app.js/init() é assíncrona (aguarda leituras de IndexedDB/
    // Storage antes de chamar switchTab()), então pode terminar DEPOIS do
    // 'load'. Espera um sinal de verdade (Storage já existe e a aba
    // Configurações já está visível) em vez de um tempo fixo — evita o
    // "window.Storage.loadSettings is not a function" de pegar a página no
    // meio do carregamento.
    await page.waitForFunction(() => window.Storage && typeof window.Storage.loadSettings === 'function'
        && document.querySelector('#tab-config') && !document.querySelector('#tab-config').hidden);

    const r = await page.evaluate(() => ({
        abaAtiva: !document.querySelector('#tab-config').hidden,
        locale: window.LzI18n.getLocale(),
        localeSalvo: window.Storage.loadSettings().locale,
        pastas: window.LattesTypes.allFolders(),
        wizardRestoreSobrou: sessionStorage.getItem('lz_wizard_restore'),
    }));
    assert(r.abaAtiva, 'Depois do reload, deveria reabrir direto na aba Configurações (não em Início)');
    assertEqual(r.locale, 'en', 'O locale deveria continuar "en" depois do reload (persistido antes de recarregar)');
    assertEqual(r.localeSalvo, 'en', 'settings.locale deveria estar salvo como "en"');
    assert(r.pastas.includes('Inbox'), 'LattesTypes.allFolders() deveria trazer "Inbox" (en) depois do reload — não mais "Caixa de Entrada"');
    assert(!r.pastas.includes('Caixa de Entrada'), 'Não deveria sobrar nenhum nome de pasta em pt-br depois do reload em "en"');
    assertEqual(r.wizardRestoreSobrou, null, 'A chave de restauração do assistente deveria ser removida depois de usada (não pode sobrar pra sempre)');

    // O assistente deveria ter voltado exatamente no passo "Pasta no
    // computador" (Primeira configuração > local), sem precisar clicar de
    // novo em "Primeira configuração" — é o objetivo do sessionStorage.
    assertEqual(await page.locator('#btnChooseDir').count(), 1, 'Depois do reload, o assistente deveria reabrir já no passo "Pasta no computador" (Escolher pasta visível), sem refazer os cliques anteriores');
});

test('Escolher o mesmo idioma padrão (pt-br) logo de início não deixa lixo em sessionStorage', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    const r = await page.evaluate(() => sessionStorage.getItem('lz_wizard_restore'));
    assertEqual(r, null, 'Sem nenhuma troca de idioma ainda, não deveria haver nada em sessionStorage.lz_wizard_restore');
});
