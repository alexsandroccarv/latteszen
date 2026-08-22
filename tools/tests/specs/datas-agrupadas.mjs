/* ==========================================================================
   Regressão: largura fixa dos campos de data + agrupamento início/fim
   --------------------------------------------------------------------------
   - Todo campo 'datebr' usa largura fixa (w-32), não w-full — o valor nunca
     passa de 10 caracteres (dd/mm/aaaa).
   - Sempre que um par Início/Fim (ou Ano/Ano fim, Data de início/Data de fim
     etc.) existe no mesmo tipo, os dois campos ficam na mesma linha (mesmo
     `row`, agrupados no wrapper flex de dynFieldsHtml).
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

async function selecionar(page, categoriaTxt, tipoTxt) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    const catVal = await page.$eval('#selCategoria', (sel, txt) => Array.from(sel.options).find((o) => o.textContent.includes(txt))?.value, categoriaTxt);
    await page.selectOption('#selCategoria', catVal);
    await page.waitForTimeout(150);
    const tipoVal = await page.$eval('#selTipo', (sel, txt) => Array.from(sel.options).find((o) => o.textContent.includes(txt))?.value, tipoTxt);
    await page.selectOption('#selTipo', tipoVal);
    await page.waitForTimeout(150);
}

test('Campo de data usa largura fixa (w-32), não w-full', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Formação', 'Formação acadêmica');
    const cls = await page.$eval('input[name="anoInicio"]', (el) => el.className);
    assert(cls.includes('w-32'), 'Campo de data deveria ter a classe w-32 (largura fixa)');
    assert(!cls.includes('w-full'), 'Campo de data não deveria mais usar w-full (largura variável)');
});

test('Início e Fim ficam na mesma linha (mesmo agrupamento) em Formação acadêmica', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Formação', 'Formação acadêmica');
    const info = await page.evaluate(() => {
        const ini = document.querySelector('[data-field="anoInicio"]');
        const fim = document.querySelector('[data-field="anoFim"]');
        return { mesmoPai: !!ini && !!fim && ini.parentElement === fim.parentElement, classePai: ini ? ini.parentElement.className : '' };
    });
    assert(info.mesmoPai, 'anoInicio e anoFim deveriam compartilhar o mesmo wrapper (mesma linha)');
    assert(info.classePai.includes('flex'), 'O wrapper compartilhado deveria ser o flex de agrupamento (dynFieldsHtml)');
});

// Checa que os dois campos compartilham o MESMO wrapper flex de agrupamento
// (dynFieldsHtml só cria esse wrapper quando os campos têm `row` igual) — só
// checar "mesmo parentElement" não basta, porque campos SEM row também caem
// como filhos diretos do mesmo container `#dynFields` (class="space-y-3").
async function agrupadosNaLinha(page, keyIni, keyFim) {
    return page.evaluate(({ a, b }) => {
        const ini = document.querySelector(`[data-field="${a}"]`);
        const fim = document.querySelector(`[data-field="${b}"]`);
        if (!ini || !fim || ini.parentElement !== fim.parentElement) return false;
        return ini.parentElement.classList.contains('flex');
    }, { a: keyIni, b: keyFim });
}

test('Início e Fim ficam na mesma linha em Licença (dataInicio/dataFim)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Dados gerais', 'Licença');
    assert(await agrupadosNaLinha(page, 'dataInicio', 'dataFim'), 'dataInicio e dataFim deveriam ficar agrupados no wrapper flex (mesma linha) em Licença');
});

test('Início e Fim ficam na mesma linha em tipo "não-Lattes" (Cursos livres, F_AINI/F_AFIM)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selecionar(page, 'Desenvolvimento Pessoal', 'Cursos livres');
    assert(await agrupadosNaLinha(page, 'anoInicio', 'anoFim'), 'anoInicio e anoFim (F_AINI/F_AFIM) deveriam ficar agrupados no wrapper flex (mesma linha)');
});

test('Campo de data solo (sem par) não é indevidamente agrupado com outro campo', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    // AL_COLECIONISMO tem anoInicio (F_AINI) sem par anoFim — não deve virar
    // uma linha de 2 campos com o próximo campo (frequência).
    await selecionar(page, 'Interesses', 'Colecionismo');
    const info = await page.evaluate(() => {
        const ini = document.querySelector('[data-field="anoInicio"]');
        if (!ini) return null;
        const pai = ini.parentElement;
        const ehFlexAgrupado = pai.classList.contains('flex');
        return { ehFlexAgrupado, irmaos: ehFlexAgrupado ? pai.querySelectorAll(':scope > [data-field]').length : 1 };
    });
    assert(info, 'Deveria existir o campo anoInicio em Colecionismo');
    assertEqual(info.irmaos, 1, 'anoInicio (sem par anoFim) não deveria estar agrupado com outro campo na mesma linha');
});
