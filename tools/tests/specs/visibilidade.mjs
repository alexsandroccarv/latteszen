/* ==========================================================================
   Regressão: bloco de Visibilidade no formulário de item
   --------------------------------------------------------------------------
   Deve ser só 3 checkboxes compactos ("Exportar item para meu Lattes",
   "Item visível (público) no Lattes", "Publicar item na Web"), sem título
   nem parágrafos explicativos — e categorias 12+ ("Além do Lattes") devem
   mostrar só o checkbox de Publicar na Web (não são campos do Lattes).
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

async function selectTipo(page, catText, tipoText) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    const catVal = await page.$eval('#selCategoria', (sel, t) => Array.from(sel.options).find((o) => o.textContent.includes(t)).value, catText);
    await page.selectOption('#selCategoria', catVal);
    await page.waitForTimeout(150);
    const tipoVal = await page.$eval('#selTipo', (sel, t) => Array.from(sel.options).find((o) => o.textContent.includes(t)).value, tipoText);
    await page.selectOption('#selTipo', tipoVal);
    await page.waitForTimeout(150);
}

test('Bloco de Visibilidade: 3 checkboxes compactos, sem título/descrições', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selectTipo(page, 'Formação', 'Formação complementar');
    const info = await page.evaluate(() => {
        const box = document.querySelector('#visibilidadeBlock');
        return {
            qtdCheckbox: box.querySelectorAll('input[type=checkbox]').length,
            temDescricoes: /Desmarque|Só anotação/.test(box.textContent),
            labels: Array.from(box.querySelectorAll('label')).map((l) => l.textContent.trim()),
        };
    });
    assertEqual(info.qtdCheckbox, 3, 'Deveria ter exatamente 3 checkboxes');
    assertEqual(info.temDescricoes, false, 'Não deveria ter parágrafos explicativos antigos');
    assertEqual(info.labels, ['Exportar item para meu Lattes', 'Item visível (público) no Lattes', 'Publicar item na Web'], 'Textos dos checkboxes');
});

test('Categoria 12+ ("Além do Lattes") só mostra "Publicar item na Web"', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selectTipo(page, 'Desenvolvimento Pessoal', 'Cursos livres');
    const info = await page.evaluate(() => {
        const box = document.querySelector('#visibilidadeBlock');
        return {
            qtdCheckbox: box.querySelectorAll('input[type=checkbox]').length,
            temExportar: !!box.querySelector('#visExportarLattes'),
            temPublicar: !!box.querySelector('#visPublicarWeb'),
        };
    });
    assertEqual(info, { qtdCheckbox: 1, temExportar: false, temPublicar: true }, 'Categoria 12+ deveria mostrar só o checkbox de Publicar na Web');
});

test('Desmarcar "Item visível" salva visivelNoLattes como "Privado"', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await selectTipo(page, 'Formação', 'Formação complementar');
    await page.fill('[name="titulo"]', 'Curso Privado Teste');
    await page.fill('[name="instituicao"]', 'Instituto X');
    await page.uncheck('#visVisivelLattes');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(350);
    const salvo = await page.evaluate(() => {
        const items = JSON.parse(localStorage.getItem('lz_catalog') || '[]');
        const it = items.find((i) => i.fields && i.fields.titulo === 'Curso Privado Teste');
        return it ? it.visibilidade : null;
    });
    assertEqual(salvo && salvo.visivelNoLattes, 'Privado', 'visivelNoLattes deveria ser "Privado" com o checkbox desmarcado');
});
