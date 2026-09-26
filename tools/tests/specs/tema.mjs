/* ==========================================================================
   Regressão: seletor de Tema (Configurações), trazido do templateZen
   --------------------------------------------------------------------------
   - "lattesZen dia" (govbr) é o tema padrão — aplicado mesmo sem nada
     escolhido ainda (data-lz-theme="govbr" + classe lz-theme).
   - "lattesZen noite" (padrao) é uma paleta ESCURA própria (data-lz-theme=
     "padrao" + classe lz-theme, igual a qualquer outro tema) — "gov.br" e
     "Padrão (gov.br)" eram dois nomes conflitantes pro mesmo visual claro,
     viraram esse par "dia"/"noite", com "noite" escura de verdade (pedido
     do Alexsandro: o nome tem que bater com o visual).
   - Escolher um tema aplica a classe .lz-theme + data-lz-theme no <html> e
     persiste no localStorage (lz_tema_preset).
   - O tema persiste entre reloads e entre páginas diferentes (a lógica de
     aplicação cedo roda em qualquer página, não só index.html).
   ========================================================================== */
import { test, assert, assertEqual } from '../harness.mjs';

async function abrirConfig(page, baseUrl) {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    // O seletor de tema mora na página "Recursos opcionais" do menu lateral de
    // Configurações — não é a página ativa por padrão (Armazenamento é).
    await page.click('[data-cfg-page-link="grp-opcionais"]');
    await page.waitForTimeout(150);
}

test('Seletor de tema existe em Configurações, com "lattesZen dia" (govbr) pré-selecionado por padrão', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    const sel = await page.$('#themeSelect');
    assert(sel, 'O seletor de tema deveria existir em Configurações');
    const valor = await page.$eval('#themeSelect', (el) => el.value);
    assertEqual(valor, 'govbr', 'Sem nada escolhido, o tema padrão deveria ser "lattesZen dia" (govbr)');
    const htmlClasses = await page.$eval('html', (el) => el.className);
    assert(htmlClasses.includes('lz-theme'), 'Com "lattesZen dia" como padrão, a classe lz-theme já deveria estar presente sem nada escolhido');
    const temaAttr = await page.$eval('html', (el) => el.getAttribute('data-lz-theme'));
    assertEqual(temaAttr, 'govbr', 'data-lz-theme deveria ser "govbr" por padrão, sem nada escolhido ainda');
});

test('Lista de temas corresponde exatamente à do templateZen (+ "lattesZen dia"/"lattesZen noite")', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    const valores = await page.$$eval('#themeSelect option', (opts) => opts.map((o) => o.value));
    assertEqual(valores, [
        'govbr', 'padrao', 'catppuccin-latte', 'catppuccin-mocha', 'dracula',
        'github-light', 'github-dark', 'rose-pine-dawn',
        'solarized-light', 'solarized-dark',
    ], `Lista de temas incorreta — obtida: ${JSON.stringify(valores)}`);

    const rotulos = await page.$$eval('#themeSelect option', (opts) => Object.fromEntries(opts.map((o) => [o.value, o.textContent.trim()])));
    assertEqual(rotulos.govbr, 'lattesZen dia', 'O tema "govbr" deveria se chamar "lattesZen dia" (não mais "gov.br")');
    assertEqual(rotulos.padrao, 'lattesZen noite', 'O tema "padrao" deveria se chamar "lattesZen noite" (não mais "Padrão (gov.br)")');
});

test('Escolher um tema aplica data-lz-theme + classe lz-theme e persiste', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    await page.selectOption('#themeSelect', 'dracula');
    await page.waitForTimeout(150);

    const temaAttr = await page.$eval('html', (el) => el.getAttribute('data-lz-theme'));
    assertEqual(temaAttr, 'dracula', 'data-lz-theme deveria ser "dracula" após a escolha');
    const temClasse = await page.$eval('html', (el) => el.classList.contains('lz-theme'));
    assert(temClasse, 'A classe lz-theme deveria estar presente após escolher um tema');

    const salvo = await page.evaluate(() => localStorage.getItem('lz_tema_preset'));
    assertEqual(salvo, 'dracula', 'O tema escolhido deveria ser salvo no localStorage');

    await page.reload();
    await page.waitForTimeout(400);
    const temaAposReload = await page.$eval('html', (el) => el.getAttribute('data-lz-theme'));
    assertEqual(temaAposReload, 'dracula', 'O tema deveria persistir após recarregar a página');
});

test('Tema persiste em outras páginas (ex.: ajuda.html), não só no index.html', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.evaluate(() => localStorage.setItem('lz_tema_preset', 'rose-pine-dawn'));
    await page.goto(baseUrl + '/ajuda.html');
    await page.waitForTimeout(300);
    const temaAttr = await page.$eval('html', (el) => el.getAttribute('data-lz-theme'));
    assertEqual(temaAttr, 'rose-pine-dawn', 'O tema escolhido deveria se aplicar em qualquer página, não só index.html');
});

// Regressão: nas páginas de apoio (.help-doc/.cafe-doc), o conteúdo (cards,
// links, notas) tinha sua própria paleta claro/escuro fixa (--hdoc-*/--cafe-*)
// que ignorava o tema escolhido — só o cabeçalho/rodapé reagiam. Confere que
// as variáveis de conteúdo agora herdam do tema ativo (--lz-*).
const PAGINAS_COM_CONTEUDO_TEMATIZADO = [
    ['privacidade.html', 'hdoc'], ['termodeuso.html', 'hdoc'], ['ajuda.html', 'hdoc'],
    ['sobre.html', 'hdoc'], ['notas-de-versao.html', 'hdoc'], ['doe-um-cafe.html', 'cafe'],
];
for (const [pagina, prefixo] of PAGINAS_COM_CONTEUDO_TEMATIZADO) {
    test(`${pagina}: escolher um tema também muda a cor do conteúdo (--${prefixo}-accent), não só cabeçalho/rodapé`, async ({ page, baseUrl }) => {
        await page.goto(baseUrl + '/index.html');
        await page.evaluate(() => localStorage.setItem('lz_tema_preset', 'dracula'));
        await page.goto(baseUrl + '/' + pagina);
        await page.waitForTimeout(300);

        const vars = await page.evaluate((p) => {
            const cs = getComputedStyle(document.documentElement);
            return {
                contentAccent: cs.getPropertyValue(`--${p}-accent`).trim(),
                lzAccent: cs.getPropertyValue('--lz-accent').trim(),
            };
        }, prefixo);
        assert(vars.lzAccent, `${pagina}: --lz-accent deveria estar definido com o tema Drácula ativo`);
        assertEqual(vars.contentAccent, vars.lzAccent, `${pagina}: --${prefixo}-accent deveria seguir --lz-accent do tema escolhido (Drácula), não o azul padrão fixo`);
    });
}

test('Escolher "lattesZen noite" (padrao) aplica data-lz-theme="padrao" + classe lz-theme, igual a qualquer outro tema', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    await page.selectOption('#themeSelect', 'catppuccin-mocha');
    await page.waitForTimeout(150);
    await page.selectOption('#themeSelect', 'padrao');
    await page.waitForTimeout(150);

    const atributo = await page.$eval('html', (el) => el.getAttribute('data-lz-theme'));
    assertEqual(atributo, 'padrao', 'data-lz-theme deveria ser "padrao" ao escolher "lattesZen noite"');
    const temClasse = await page.$eval('html', (el) => el.classList.contains('lz-theme'));
    assert(temClasse, 'A classe lz-theme deveria continuar aplicada com "lattesZen noite" (paleta escura própria)');
    const salvo = await page.evaluate(() => localStorage.getItem('lz_tema_preset'));
    assertEqual(salvo, 'padrao', 'O valor salvo deveria refletir "padrao"');
});

test('"lattesZen noite" é de fato um tema escuro (pedido do Alexsandro — o nome tem que bater com o visual)', async ({ page, baseUrl }) => {
    await abrirConfig(page, baseUrl);
    await page.selectOption('#themeSelect', 'padrao');
    await page.waitForTimeout(150);

    const cores = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return { bg: cs.getPropertyValue('--lz-bg').trim(), text: cs.getPropertyValue('--lz-text').trim() };
    });
    const luminancia = (hex) => {
        const m = hex.replace('#', '');
        const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    };
    assert(luminancia(cores.bg) < 0.3, `"lattesZen noite" deveria ter um fundo escuro (--lz-bg) — obtido: ${cores.bg}`);
    assert(luminancia(cores.text) > 0.6, `"lattesZen noite" deveria ter texto claro sobre o fundo escuro (--lz-text) — obtido: ${cores.text}`);
});

test('Todos os temas definem de fato as variáveis --lz-* (regressão: comentário CSS mal fechado zerava tudo)', async ({ page, baseUrl }) => {
    // Bug real (relatado pelo usuário): um comentário CSS contendo o texto
    // "govbr-*/unifesp-*" tem, sem querer, a sequência "*/" no meio — fecha
    // o comentário mais cedo do que deveria, e todo o texto até o próximo
    // "*/" (sem abertura correspondente) vira "CSS" inválido. Isso zerava
    // as variáveis --lz-* de TODOS os temas: fundo/texto ficavam
    // transparentes/herdados (cabeçalho "some", títulos ilegíveis), mesmo
    // com data-lz-theme e .lz-theme corretamente aplicados pelo JS — só
    // pegável checando se as variáveis realmente resolvem, não só a classe.
    await abrirConfig(page, baseUrl);
    const valores = await page.$$eval('#themeSelect option', (opts) => opts.map((o) => o.value));
    for (const tema of valores) {
        await page.selectOption('#themeSelect', tema);
        await page.waitForTimeout(80);
        const vars = await page.evaluate(() => {
            const cs = getComputedStyle(document.documentElement);
            return {
                bg: cs.getPropertyValue('--lz-bg').trim(),
                header: cs.getPropertyValue('--lz-header').trim(),
                text: cs.getPropertyValue('--lz-text').trim(),
                accent: cs.getPropertyValue('--lz-accent').trim(),
            };
        });
        for (const [k, v] of Object.entries(vars)) {
            assert(v.length > 0, `Tema "${tema}": --lz-${k} deveria ter um valor definido, veio vazio`);
        }
    }
});

test('Regressão: campos de texto (border-gray-*) continuam com borda visível em temas onde --lz-border == --lz-surface (Catppuccin Mocha)', async ({ page, baseUrl }) => {
    // Bug real (relatado pelo usuário via print de tela): a regra genérica
    // "html.lz-theme input:not(...):not(...):not(...):not(...)" (fundo/texto
    // dos campos) tinha, por causa dos ":not()", especificidade MAIOR que
    // ".border-gray-300"/".dark:border-gray-600" (que usam color-mix() pra
    // garantir contraste — ver comentário logo acima dessas regras em
    // styles.css) — então "roubava" a prioridade delas só em <input>,
    // fixando border-color: var(--lz-border) puro. Em temas onde
    // --lz-border é IGUAL a --lz-surface (Catppuccin Mocha, Drácula), isso
    // deixava os campos de texto/data sem nenhuma borda visível, enquanto
    // os <select> ao lado (sem ":not()" no seletor, logo menos específico)
    // continuavam normais — corrigido tirando border-color daquela regra
    // genérica, que não deveria mesmo decidir cor de borda.
    await page.goto(baseUrl + '/index.html');
    await page.evaluate(() => {
        localStorage.setItem('tema', 'dark');
        localStorage.setItem('lz_tema_preset', 'catppuccin-mocha');
    });
    await page.reload();
    await page.waitForTimeout(500);
    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(200);
    const catVal = await page.$eval('#selCategoria', (sel) => Array.from(sel.options).find((o) => o.textContent.includes('Formação')).value);
    await page.selectOption('#selCategoria', catVal);
    await page.waitForTimeout(150);
    const tipoVal = await page.$eval('#selTipo', (sel) => Array.from(sel.options).find((o) => o.textContent.includes('complementar')).value);
    await page.selectOption('#selTipo', tipoVal);
    await page.waitForTimeout(200);

    const cores = await page.evaluate(() => {
        const el = document.querySelector('[name="titulo"]');
        const cs = getComputedStyle(el);
        return { border: cs.borderTopColor, bg: cs.backgroundColor };
    });
    assert(cores.border !== cores.bg, `O campo de texto deveria ter uma borda visível (cor diferente do fundo) — border=${cores.border} bg=${cores.bg}`);
});

test('Sem tema escolhido, a grade da Linha do tempo continua com a escala própria (.viz-heat-*)', async ({ page, baseUrl }) => {
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);
    await page.click('[data-tab="linhatempo"]');
    await page.waitForTimeout(200);
    // Sem itens no catálogo o gráfico mostra o aviso, não a grade — o que
    // importa aqui é que a lista de classes usada pelo heatmap não referencia
    // mais govbr-*/unifesp-* (ficaria "achatada" por um tema no futuro).
    const usaClassesAntigas = await page.evaluate(() => {
        const mod = window.TabLinhaTempo;
        return mod && mod.NIVEL_CLASSES ? mod.NIVEL_CLASSES.some((c) => /govbr|unifesp/.test(c)) : null;
    });
    assertEqual(usaClassesAntigas, false, 'NIVEL_CLASSES não deveria mais usar classes govbr-*/unifesp-*');
});
