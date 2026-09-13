/* ==========================================================================
   Regressão: "Área do conhecimento (CNPq/CAPES)" e "Setores de atividade"
   ocupavam muito espaço vertical nas telas de cadastro — passam a ficar
   recolhidos por padrão (num <details>, só abrindo ao clicar) e dividindo a
   mesma linha (lado a lado), em vez de empilhados um embaixo do outro.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

async function abrirArtigo(page) {
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'PRODUCOES');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'ARTIGO_PERIODICO');
    await page.waitForTimeout(150);
}

test('Área do conhecimento e Setores de atividade ficam recolhidos por padrão', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirArtigo(page);

    const areaAberta = await page.$eval('[data-field="areaConhecimento"] details', (el) => el.open);
    const setoresAberto = await page.$eval('[data-field="setores"] details', (el) => el.open);
    assert(!areaAberta, 'O <details> de Área do conhecimento deveria começar recolhido');
    assert(!setoresAberto, 'O <details> de Setores de atividade deveria começar recolhido');
});

test('Área do conhecimento e Setores de atividade dividem a mesma linha', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirArtigo(page);

    const mesmoPai = await page.evaluate(() => {
        const a = document.querySelector('[data-field="areaConhecimento"]');
        const s = document.querySelector('[data-field="setores"]');
        return !!(a && s && a.parentElement === s.parentElement && a.parentElement.classList.contains('flex'));
    });
    assert(mesmoPai, 'Os dois campos deveriam compartilhar o mesmo wrapper flex (lado a lado)');
});

test('Clicar no resumo expande a seleção de Área do conhecimento', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirArtigo(page);

    await page.click('[data-field="areaConhecimento"] summary');
    await page.waitForTimeout(100);
    const aberto = await page.$eval('[data-field="areaConhecimento"] details', (el) => el.open);
    assert(aberto, 'Clicar no resumo deveria expandir o <details>');

    await page.selectOption('[data-field="areaConhecimento"] [data-areatree="g"]', 'Ciências Exatas e da Terra');
    await page.waitForTimeout(100);
    await page.selectOption('[data-field="areaConhecimento"] [data-areatree="a"]', 'Ciência da Computação');
    await page.waitForTimeout(100);

    await page.fill('#dynFields input[name="titulo"]', 'Artigo de teste');
    await page.fill('#dynFields input[name="ano"]', '2020');
    await page.fill('#dynFields input[name="periodico"]', 'Revista de teste');
    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(300);

    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_catalog') || '[]').find((i) => i.typeKey === 'ARTIGO_PERIODICO'));
    assertEqual(salvo.fields.areaConhecimento, 'Ciências Exatas e da Terra > Ciência da Computação', 'A área selecionada deveria ter sido salva corretamente');
});

test('O resumo (recolhido) mostra a seleção já salva, sem precisar expandir', async ({ page, baseUrl }) => {
    const items = [
        makeItem('ARTIGO_PERIODICO', 'PRODUCOES', {
            titulo: 'Artigo já salvo', periodico: 'Revista X',
            areaConhecimento: 'Ciências Exatas e da Terra > Ciência da Computação',
            setores: 'Educação; Telecomunicações',
        }),
    ];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.evaluate((id) => {
        const item = window.AppCore.state.items.find((i) => i.id === id);
        window.AppCore.buildForm(item);
    }, items[0].id);
    await page.waitForTimeout(200);

    const resumoArea = await page.$eval('[data-field="areaConhecimento"] summary', (el) => el.textContent.trim());
    const resumoSetores = await page.$eval('[data-field="setores"] summary', (el) => el.textContent.trim());
    assertEqual(resumoArea, 'Ciências Exatas e da Terra > Ciência da Computação', 'O resumo recolhido deveria mostrar a área já salva');
    assertEqual(resumoSetores, 'Educação; Telecomunicações', 'O resumo recolhido deveria mostrar os setores já salvos');

    const areaAberta = await page.$eval('[data-field="areaConhecimento"] details', (el) => el.open);
    assert(!areaAberta, 'Mesmo com valor já salvo, deveria continuar recolhido até o usuário clicar');
});

test('Área do conhecimento obrigatória (Áreas de atuação): erro de validação expande o <details> automaticamente', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(150);
    await page.selectOption('#selCategoria', 'ATUACAO');
    await page.waitForTimeout(150);
    await page.selectOption('#selTipo', 'AREA_ATUACAO');
    await page.waitForTimeout(150);

    await page.click('#camposPanel button[type="submit"]');
    await page.waitForTimeout(200);

    const aberto = await page.$eval('[data-field="areaConhecimento"] details', (el) => el.open);
    assert(aberto, 'Faltando o campo obrigatório, o <details> deveria abrir sozinho pra mostrar o erro');
});
