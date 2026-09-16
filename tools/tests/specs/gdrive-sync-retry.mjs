/* ==========================================================================
   Regressão: sincronização com o Google Drive mais resiliente a falha
   transitória de rede — bug relatado pelo Alexsandro: sincronizar uma
   biblioteca de ~400 itens do Drive pelo celular mostrava só ~70. A causa:
   scanDirectory() varria a árvore de pastas recursivamente (uma requisição
   por pasta + uma por arquivo .json, sem lote nenhum) e desistia
   silenciosamente da pasta inteira (e de tudo dentro dela) na primeira
   falha de rede — comum numa varredura tão longa em rede móvel.
   Storage.comRetentativas() (ver storage.js) tenta de nervão antes de
   desistir; scanDirectory() agora devolve { items, falhas } em vez de só
   um array, pra quem chama (syncFromDirectory) avisar quando a
   sincronização ficou incompleta em vez de mostrar uma lista truncada
   sem explicação.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

test('Storage.comRetentativas(): sucede depois de falhar algumas vezes, sem esgotar as tentativas', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const resultado = await page.evaluate(async () => {
        let chamadas = 0;
        const fn = () => {
            chamadas += 1;
            if (chamadas < 3) return Promise.reject(new Error('falha transitória'));
            return Promise.resolve('ok');
        };
        const valor = await window.Storage.comRetentativas(fn, 3);
        return { valor, chamadas };
    });
    assertEqual(resultado.valor, 'ok', 'Deveria devolver o valor da tentativa que enfim funcionou');
    assertEqual(resultado.chamadas, 3, 'Deveria ter chamado a função 3 vezes (2 falhas + 1 sucesso)');
});

test('Storage.comRetentativas(): esgota as tentativas e relança o último erro', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const resultado = await page.evaluate(async () => {
        let chamadas = 0;
        const fn = () => { chamadas += 1; return Promise.reject(new Error(`falha ${chamadas}`)); };
        try {
            await window.Storage.comRetentativas(fn, 3);
            return { lancou: false, chamadas };
        } catch (e) {
            return { lancou: true, mensagem: e.message, chamadas };
        }
    });
    assert(resultado.lancou, 'Deveria relançar o erro depois de esgotar as tentativas');
    assertEqual(resultado.chamadas, 3, 'Deveria ter tentado exatamente 3 vezes, nem mais nem menos');
    assertEqual(resultado.mensagem, 'falha 3', 'Deveria relançar o erro da ÚLTIMA tentativa, não da primeira');
});

test('Storage.comRetentativas(): sem falha nenhuma, chama a função só 1 vez', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const chamadas = await page.evaluate(async () => {
        let n = 0;
        await window.Storage.comRetentativas(() => { n += 1; return Promise.resolve('ok'); }, 3);
        return n;
    });
    assertEqual(chamadas, 1, 'Sem falha, não deveria tentar de novo à toa');
});
