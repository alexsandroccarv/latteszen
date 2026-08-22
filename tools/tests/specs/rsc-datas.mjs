/* ==========================================================================
   Regressão: LzRSC.parseBR() precisa rejeitar datas de calendário
   inexistentes (ex.: 31/02), não "rolar" silenciosamente pro mês seguinte
   --------------------------------------------------------------------------
   new Date(ano, mes, dia) do JS nunca retorna Invalid Date por dia fora do
   mês — ele soma o excedente ao mês seguinte (31/02/2024 vira 02/03/2024).
   Isso inflava/reduzia silenciosamente a contagem de meses/anos no simulador
   de RSC-PCCTAE a partir de uma data digitada errada.
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

test('LzRSC.parseBR rejeita datas de calendário inexistentes', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    const casos = await page.evaluate(() => {
        const P = window.LzRSC.parseBR;
        const fmt = (dt) => dt ? `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}` : null;
        return {
            valida: fmt(P('15/06/2024')),
            fimDeMes: fmt(P('29/02/2024')), // 2024 é bissexto — válida
            inexistente29: fmt(P('29/02/2023')), // 2023 não é bissexto
            inexistente31fev: fmt(P('31/02/2024')),
            inexistente31abr: fmt(P('31/04/2024')),
            mesInvalido: fmt(P('10/13/2024')),
            diaZero: fmt(P('00/06/2024')),
        };
    });

    assertEqual(casos.valida, '15/06/2024', 'Data válida comum deveria ser aceita');
    assertEqual(casos.fimDeMes, '29/02/2024', '29/02 num ano bissexto deveria ser aceito');
    assertEqual(casos.inexistente29, null, '29/02/2023 (não bissexto) não existe — deveria ser rejeitada, não virar 01/03');
    assertEqual(casos.inexistente31fev, null, '31/02 não existe em nenhum ano — deveria ser rejeitada, não virar 02 ou 03/03');
    assertEqual(casos.inexistente31abr, null, 'Abril tem 30 dias — 31/04 deveria ser rejeitada, não virar 01/05');
    assertEqual(casos.mesInvalido, null, 'Mês 13 deveria ser rejeitado');
    assertEqual(casos.diaZero, null, 'Dia 00 deveria ser rejeitado');
});
