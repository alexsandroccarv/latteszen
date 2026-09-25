/* ==========================================================================
   Regressão: módulo Progressão Docente Unifesp — mesmo padrão do RSC/Súmula
   (tab-config.js só tem o "Habilitar módulo"; os dados funcionais moram na
   própria aba, que só aparece quando o módulo é habilitado). Etapa inicial:
   só entrada manual (data de posse, data da última progressão, Campus/
   Unidade/Departamento) — sem memorial nem exportação ainda.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

// O checkbox "Habilitar módulo Progressão Docente Unifesp" mora na página
// "Módulos" do menu lateral de Configurações — não é a página ativa por
// padrão (Armazenamento é).
async function abrirModulos(page) {
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('[data-cfg-page-link="grp-modulos"]');
    await page.waitForTimeout(150);
}

test('Configurações → Unifesp: Progressão docente só tem o "Habilitar módulo" — os campos moram na aba Progressão Docente', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirModulos(page);

    assertEqual(await page.locator('#progressaoEnable').count(), 1, 'O checkbox "Habilitar módulo Progressão Docente Unifesp" deveria existir em Configurações');
    assertEqual(await page.locator('#progressao-dataPosse').count(), 0, 'O campo "Data de posse" não deveria estar em Configurações');

    const texto = await page.locator('#progressaoSection').innerText();
    assert(/apenas em português/i.test(texto), 'A seção deveria ter a marca "apenas em português" (módulo 100% pt-br, sem i18n)');

    await page.click('#progressaoEnable');
    await page.waitForTimeout(200);
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /módulo progressão docente unifesp habilitado/i.test(t)), 'Marcar o checkbox deveria habilitar e salvar na hora (sem precisar de botão "Salvar")');

    const habilitado = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').progressaoEnabled);
    assert(habilitado === true, 'progressaoEnabled deveria estar salvo em Configurações');
});

test('Aba "Progressão Docente" só aparece na navegação quando o módulo está habilitado', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const escondida = await page.evaluate(() => document.querySelector('.tab-btn[data-tab="progressao"]').classList.contains('hidden'));
    assert(escondida, 'A aba "Progressão Docente" deveria começar escondida (módulo desabilitado por padrão)');

    await abrirModulos(page);
    await page.click('#progressaoEnable');
    await page.waitForTimeout(200);
    const visivel = await page.evaluate(() => !document.querySelector('.tab-btn[data-tab="progressao"]').classList.contains('hidden'));
    assert(visivel, 'Habilitar o módulo deveria mostrar a aba "Progressão Docente" na navegação');
});

test('Progressão Docente: data de posse, data da última progressão e Campus/Unidade/Departamento salvam em settings.progressao', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirModulos(page);
    await page.click('#progressaoEnable');
    await page.waitForTimeout(100);
    await page.click('[data-tab="progressao"]');
    await page.waitForTimeout(200);

    await page.fill('#progressao-dataPosse', '01/03/2015');
    await page.fill('#progressao-dataUltimaProgressao', '01/03/2023');
    await page.fill('#progressao-campus', 'Campus São Paulo');
    await page.fill('#progressao-unidade', 'Escola Paulista de Medicina');
    await page.fill('#progressao-departamento', 'Informática em Saúde');
    await page.click('#btnSaveProgressaoCfg');
    await page.waitForTimeout(200);

    const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').progressao || {});
    assertEqual(cfg.dataPosse, '01/03/2015', 'Data de posse deveria ser salva');
    assertEqual(cfg.dataUltimaProgressao, '01/03/2023', 'Data da última progressão deveria ser salva');
    assertEqual(cfg.campus, 'Campus São Paulo', 'Campus deveria ser salvo');
    assertEqual(cfg.unidade, 'Escola Paulista de Medicina', 'Unidade deveria ser salva');
    assertEqual(cfg.departamento, 'Informática em Saúde', 'Departamento deveria ser salvo');
});

test('Progressão Docente: datas inválidas bloqueiam o salvamento (mesmo validador "dataCompleta" do resto do app)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirModulos(page);
    await page.click('#progressaoEnable');
    await page.waitForTimeout(100);
    await page.click('[data-tab="progressao"]');
    await page.waitForTimeout(200);

    await page.fill('#progressao-dataPosse', '31/02/2020'); // data inexistente
    // Blur do campo ANTES de clicar em Salvar: a validação no blur insere
    // uma mensagem de erro que desloca o layout — sem isso, esse
    // deslocamento aconteceria bem no meio do clique (foco ainda no
    // campo), podendo fazer o clique errar o botão (mesmo padrão de
    // rsc-config-campos.mjs).
    await page.locator('#progressao-dataPosse').evaluate((el) => el.blur());
    await page.waitForTimeout(150);
    await page.click('#btnSaveProgressaoCfg');
    await page.waitForTimeout(200);

    const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').progressao || {});
    assert(!cfg.dataPosse, 'Uma data inválida não deveria ser salva');
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /corrija os campos destacados/i.test(t)), 'Deveria avisar pra corrigir os campos antes de salvar');
});

test('Progressão Docente: campos de data têm máscara dd/mm/aaaa (auto-insere as barras) e largura fixa, igual ao resto do app', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirModulos(page);
    await page.click('#progressaoEnable');
    await page.waitForTimeout(100);
    await page.click('[data-tab="progressao"]');
    await page.waitForTimeout(200);

    const info = await page.evaluate(() => {
        const el = document.getElementById('progressao-dataPosse');
        return { temDatebr: el.hasAttribute('data-datebr'), classe: el.className };
    });
    assert(info.temDatebr, 'O campo de data deveria ter o atributo data-datebr (mesma máscara de Catalogar)');
    assert(info.classe.includes('w-32'), 'O campo de data deveria ter largura fixa (w-32), igual aos campos de data de Catalogar');

    await page.locator('#progressao-dataPosse').click(); // sai do readonly (mesmo padrão anti-autofill do resto do app)
    await page.locator('#progressao-dataPosse').fill(''); // limpa antes de digitar caractere a caractere
    await page.type('#progressao-dataPosse', '01032015');
    const valor = await page.inputValue('#progressao-dataPosse');
    assertEqual(valor, '01/03/2015', 'A máscara deveria auto-inserir as barras enquanto digita, igual aos campos de data de Catalogar');
});

test('Progressão Docente: campos de texto começam "readonly" e liberam ao focar (mesma proteção contra autofill do navegador usada no resto do app)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await abrirModulos(page);
    await page.click('#progressaoEnable');
    await page.waitForTimeout(100);
    await page.click('[data-tab="progressao"]');
    await page.waitForTimeout(200);

    const antes = await page.evaluate(() => document.getElementById('progressao-campus').hasAttribute('readonly'));
    assert(antes, 'O campo "Campus" deveria começar readonly (contorna autofill de endereço do navegador)');

    await page.locator('#progressao-campus').click();
    const depois = await page.evaluate(() => document.getElementById('progressao-campus').hasAttribute('readonly'));
    assert(!depois, 'Focar o campo deveria remover o readonly, liberando a digitação normal');
});

test('"Limpar catálogo" também zera a configuração da Progressão Docente Unifesp', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.progressaoEnabled = true;
        s.progressao = { dataPosse: '01/03/2015', campus: 'Campus São Paulo' };
        localStorage.setItem('lz_settings', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForTimeout(500);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    // "Limpar catálogo" mora na página "Zona de risco" do menu lateral.
    await page.click('[data-cfg-page-link="grp-risco"]');
    await page.waitForTimeout(150);

    // O harness já aceita diálogos nativos (confirm()) automaticamente — ver
    // page.on('dialog', ...) em harness.mjs.
    await page.click('#btnClear');
    await page.waitForTimeout(200);

    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}'));
    assertEqual(s.progressao, {}, 'A configuração da Progressão Docente Unifesp deveria ser zerada por "Limpar catálogo"');
});
