/* ==========================================================================
   Regressão: critérios do RSC-PCCTAE com unidade "por ano/mês" precisam
   calcular a quantidade a partir do período real (data início/fim) do item,
   não de um valor fixo (issue #26).
   --------------------------------------------------------------------------
   O bug: LzRSC.quantidade() usava `q || fallback`, então um período
   legitimamente curto demais (0 anos/meses computados a partir das datas)
   caía no valor manual de quantidade — que o formulário sempre preenche com
   "1" por padrão no campo oculto #rscQtd, mesmo para critérios "por ano/mês"
   (onde esse campo nem aparece). Resultado: um período de 2 meses num
   critério "por ano ou fração > 6 meses" pontuava como se fosse 1 ano
   inteiro, em vez de 0.
   ========================================================================== */
import { test, assertEqual } from '../harness.mjs';

test('LzRSC.pontosItem calcula a quantidade "por ano/mês" a partir do período real', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    const casos = await page.evaluate(() => {
        const P = window.LzRSC.pontosItem;
        // Critério 5.3: "Exercício de função gratificada (FG-01/02)", 4,5
        // pts/ano, calc 'ano' — "por ano ou fração > 6 meses".
        return {
            doisMeses: P({ criterio: '5.3', dataInicio: '01/01/2024', dataFim: '01/03/2024', quantidade: '1' }),
            seteEMeioMeses: P({ criterio: '5.3', dataInicio: '01/01/2024', dataFim: '15/08/2024', quantidade: '1' }),
            vinteMeses: P({ criterio: '5.3', dataInicio: '01/01/2023', dataFim: '01/09/2024', quantidade: '1' }),
            semDatasComQuantidadeManual: P({ criterio: '5.3', dataInicio: '', dataFim: '', quantidade: '3' }),
        };
    });

    assertEqual(casos.doisMeses.quantidade, 0, 'Período de 2 meses (≤ 6) não deveria contar nenhum ano/fração');
    assertEqual(casos.doisMeses.pontos, 0, 'Sem quantidade, os pontos deveriam ser 0 (não 4,5 do padrão "1" mascarando o período curto)');

    assertEqual(casos.seteEMeioMeses.quantidade, 1, 'Fração de 7,5 meses (> 6) deveria contar como 1 ano');
    assertEqual(casos.seteEMeioMeses.pontos, 4.5, 'Fração > 6 meses deveria valer os 4,5 pts cheios do critério');

    assertEqual(casos.vinteMeses.quantidade, 2, '20 meses = 1 ano completo + fração de 8 meses (> 6) = 2');
    assertEqual(casos.vinteMeses.pontos, 9, '2 anos × 4,5 pts deveria dar 9 pontos');

    // Sem datas preenchidas (mesesEntre não consegue calcular), o valor
    // manual de quantidade continua servindo de fallback — comportamento
    // preservado, só o caso "datas presentes mas período curto" mudou.
    assertEqual(casos.semDatasComQuantidadeManual.quantidade, 3, 'Sem datas, deveria usar a quantidade informada manualmente');
    assertEqual(casos.semDatasComQuantidadeManual.pontos, 13.5, '3 × 4,5 pts = 13,5');
});
