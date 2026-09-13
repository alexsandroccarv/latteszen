/* ==========================================================================
   Regressão: reentrância no Salvar (Fase 2 da auditoria — estabilidade #2).

   Um duplo-clique ou duplo Enter no botão "Salvar" reentrava em
   onSubmitForm() enquanto a 1ª chamada ainda estava no meio de um await
   (ex.: gravando evidência ou persistindo o item) — podia criar 2 itens
   (violando até o singleton-por-campo do Endereço) ou perder evidência.
   onSubmitForm agora tem uma trava (onSubmitForm._busy) que bloqueia a 2ª
   chamada síncrona.
   ========================================================================== */
import { test, assert, seedCatalog } from '../harness.mjs';

test('Salvar: duplo submit síncrono (duplo clique/Enter) não cria 2 itens', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'DADOS_GERAIS');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'ENDERECO');
    await page.waitForTimeout(150);
    await page.fill('#dynFields input[name="titulo"]', 'Rua de teste, 100');

    // Dois "submit" disparados na mesma volta síncrona simulam o
    // duplo-clique/duplo-Enter: sem a trava, os dois chegavam a criar item.
    await page.evaluate(() => {
        const form = document.querySelector('#itemForm');
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    });
    await page.waitForTimeout(500);

    const itens = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]'));
    assert(itens.length === 1, `Esperado 1 item (a trava de reentrância deveria bloquear o 2º submit), obtido ${itens.length}`);
});
