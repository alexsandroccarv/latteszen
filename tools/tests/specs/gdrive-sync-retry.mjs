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

/* ==========================================================================
   Regressão: varredura do Google Drive em paralelo (issue relatada pelo
   Alexsandro: sincronizar pelo celular era lento demais numa biblioteca
   grande, porque cada pasta e cada arquivo eram buscados em série, um de
   cada vez, pagando o round-trip da rede móvel centenas de vezes seguidas).
   Storage.criarLimitador() é o semáforo que deixa scanDirectory() disparar
   várias requisições ao mesmo tempo sem estourar um limite de concorrência.
   ========================================================================== */
test('Storage.criarLimitador(): nunca deixa mais que "max" tarefas rodando ao mesmo tempo', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const resultado = await page.evaluate(async () => {
        const limite = window.Storage.criarLimitador(2);
        let ativos = 0, picoAtivos = 0;
        const tarefa = (n) => limite(() => new Promise((resolve) => {
            ativos += 1;
            picoAtivos = Math.max(picoAtivos, ativos);
            setTimeout(() => { ativos -= 1; resolve(n); }, 30);
        }));
        const resultados = await Promise.all([1, 2, 3, 4, 5].map(tarefa));
        return { resultados, picoAtivos };
    });
    assertEqual(resultado.resultados, [1, 2, 3, 4, 5], 'Deveria devolver o resultado de cada tarefa (a Promise.all preserva a ordem, mesmo com execução concorrente)');
    assert(resultado.picoAtivos <= 2, `Não deveria rodar mais de 2 tarefas ao mesmo tempo (limite) — pico observado: ${resultado.picoAtivos}`);
    assertEqual(resultado.picoAtivos, 2, 'Com 5 tarefas e limite 2, o pico deveria mesmo chegar em 2 (a paralelização está de fato acontecendo, não caiu pra sequencial à toa)');
});

test('Storage.criarLimitador(): sem nenhuma tarefa em fila, executa direto (sem atraso artificial)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const valor = await page.evaluate(async () => {
        const limite = window.Storage.criarLimitador(6);
        return limite(() => Promise.resolve('valor-direto'));
    });
    assertEqual(valor, 'valor-direto', 'Uma única tarefa, bem abaixo do limite, deveria só repassar o valor resolvido');
});
