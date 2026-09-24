/* ==========================================================================
   Regressão: trava de acesso sem diretório de armazenamento configurado
   --------------------------------------------------------------------------
   Sem um diretório (local ou Google Drive) configurado, as abas que
   dependem de itens já cadastrados — Catalogar, Conformidade, Linha do
   tempo, Publicar, RSC, Súmula — ficam desabilitadas na barra de
   navegação, com uma dica explicando o motivo; "Início" e "Configurações"
   continuam sempre livres, pois é em Configurações › Armazenamento que
   mora o assistente de escolha do diretório (e Início já linka pra lá).
   A trava também vale a nível de código (switchTab), não só visual — nada
   que chame switchTab() direto consegue burlar o bloqueio.

   window.__LZ_TEST_SKIP_DIR_GATE é ligado por padrão em toda a suíte (ver
   harness.mjs) pra não quebrar os outros ~350 testes, que semeiam o
   catálogo direto via localStorage sem configurar diretório nenhum — os
   testes abaixo desligam o bypass pra exercitar a trava de verdade.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

const ABAS_TRAVADAS = ['catalogar', 'conformidade', 'linhatempo', 'publicar', 'rsc', 'sumula'];
const ABAS_LIVRES = ['inicio', 'config'];
// Dentro de Configurações, o mesmo bloqueio vale pra 5 das 6 páginas do
// menu lateral — só "Armazenamento" (onde mora o assistente) fica livre.
const CFG_PAGINAS_TRAVADAS = ['grp-importar', 'grp-exportar', 'grp-opcionais', 'grp-modulos', 'grp-risco'];

async function ligarTravaDeVerdade(page) {
    await page.addInitScript(() => { window.__LZ_TEST_SKIP_DIR_GATE = false; });
}

async function simularDiretorioConfigurado(page, { esqueciveis = false } = {}) {
    await page.addInitScript((esqueciveis) => {
        Object.defineProperty(window, 'Storage', {
            configurable: true,
            set(real) {
                let esquecida = false;
                real.hasDirectory = () => !esquecida;
                real.directoryName = async () => 'PastaFake';
                real.checkHealth = async () => ({ ok: true, hasDir: true });
                real.scanDirectory = async () => ({ items: [], falhas: 0 });
                real.readSettingsFromDirectory = async () => null;
                if (esqueciveis) real.forgetDirectory = async () => { esquecida = true; };
                Object.defineProperty(window, 'Storage', { value: real, writable: true, configurable: true });
            },
            get() { return undefined; },
        });
    }, esqueciveis);
}

test('Sem diretório configurado, as abas Catalogar/Conformidade/Linha do tempo/Publicar/RSC/Súmula ficam desabilitadas (com dica) — Início e Configurações continuam livres', async ({ page, baseUrl }) => {
    await ligarTravaDeVerdade(page);
    await seedCatalog(page, baseUrl, []);

    const estados = await page.evaluate((abas) => Object.fromEntries(abas.map((a) => {
        const b = document.querySelector(`[data-tab="${a}"]`);
        return [a, { disabled: b.disabled, titulo: b.title }];
    })), ABAS_TRAVADAS);
    for (const aba of ABAS_TRAVADAS) {
        assert(estados[aba].disabled, `Sem diretório configurado, a aba "${aba}" deveria estar desabilitada`);
        assert(/diret[oó]rio/i.test(estados[aba].titulo), `A aba "${aba}" desabilitada deveria ter uma dica explicando o motivo`);
    }

    const livres = await page.evaluate((abas) => Object.fromEntries(abas.map((a) => [a, document.querySelector(`[data-tab="${a}"]`).disabled])), ABAS_LIVRES);
    assert(!livres.inicio, 'A aba "Início" não deveria ficar desabilitada mesmo sem diretório configurado');
    assert(!livres.config, 'A aba "Configurações" não deveria ficar desabilitada mesmo sem diretório configurado — é lá que mora o assistente de diretório');
});

test('Chamar switchTab() direto pra uma aba travada não troca de aba e mostra um aviso (a trava não é só visual)', async ({ page, baseUrl }) => {
    await ligarTravaDeVerdade(page);
    await seedCatalog(page, baseUrl, []);

    await page.evaluate(() => window.AppCore.switchTab('catalogar'));
    await page.waitForTimeout(150);

    const ativa = await page.evaluate(() => window.AppCore.state.ui.activeTab);
    assertEqual(ativa, 'inicio', 'Sem diretório configurado, switchTab("catalogar") não deveria trocar de aba');
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /diret[oó]rio/i.test(t)), 'Deveria mostrar um aviso pedindo pra configurar um diretório');
});

test('Com diretório já configurado, as abas nascem habilitadas e trocar de aba funciona normalmente', async ({ page, baseUrl }) => {
    await ligarTravaDeVerdade(page);
    await simularDiretorioConfigurado(page);
    await seedCatalog(page, baseUrl, []);

    const estados = await page.evaluate((abas) => Object.fromEntries(abas.map((a) => [a, document.querySelector(`[data-tab="${a}"]`).disabled])), ABAS_TRAVADAS);
    for (const aba of ABAS_TRAVADAS) assert(!estados[aba], `Com diretório configurado, a aba "${aba}" não deveria estar desabilitada`);

    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(200);
    const ativa = await page.evaluate(() => window.AppCore.state.ui.activeTab);
    assertEqual(ativa, 'catalogar', 'Com diretório configurado, deveria ser possível ir para Catalogar normalmente');
});

test('"Esquecer diretório de armazenamento" volta a travar as abas na hora (applyDirGate roda a cada render() de Configurações)', async ({ page, baseUrl }) => {
    await ligarTravaDeVerdade(page);
    await simularDiretorioConfigurado(page, { esqueciveis: true });
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);

    assert(!(await page.evaluate(() => document.querySelector('[data-tab="catalogar"]').disabled)), 'Pré-condição: com diretório configurado, "Catalogar" não deveria estar desabilitada ainda');

    await page.click('#btnForget');
    await page.waitForTimeout(200);

    const travada = await page.evaluate(() => document.querySelector('[data-tab="catalogar"]').disabled);
    assert(travada, 'Depois de "Esquecer diretório de armazenamento", a aba "Catalogar" deveria voltar a ficar desabilitada');
});

test('Sem diretório configurado, as páginas "Importar"/"Exportar"/"Recursos opcionais"/"Módulos"/"Zona de risco" do menu lateral de Configurações ficam desabilitadas (com dica) — "Armazenamento" continua livre', async ({ page, baseUrl }) => {
    await ligarTravaDeVerdade(page);
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);

    const estados = await page.evaluate((paginas) => Object.fromEntries(paginas.map((p) => {
        const b = document.querySelector(`[data-cfg-page-link="${p}"]`);
        return [p, { disabled: b.disabled, titulo: b.title }];
    })), CFG_PAGINAS_TRAVADAS);
    for (const pagina of CFG_PAGINAS_TRAVADAS) {
        assert(estados[pagina].disabled, `Sem diretório configurado, a página "${pagina}" do menu lateral deveria estar desabilitada`);
        assert(/diret[oó]rio/i.test(estados[pagina].titulo), `A página "${pagina}" desabilitada deveria ter uma dica explicando o motivo`);
    }

    const livre = await page.evaluate(() => document.querySelector('[data-cfg-page-link="grp-armazenamento"]').disabled);
    assert(!livre, 'A página "Armazenamento" não deveria ficar desabilitada mesmo sem diretório configurado — é lá que mora o assistente');
});

test('Clicar numa página travada do menu lateral de Configurações não navega e mostra um aviso (a trava não é só visual)', async ({ page, baseUrl }) => {
    await ligarTravaDeVerdade(page);
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);

    // O botão desabilitado (pointer-events-none) não dispara clique de
    // verdade — dispara o evento direto, como um teste de acessibilidade
    // faria, pra confirmar que a trava de código (não só CSS) também segura.
    await page.evaluate(() => document.querySelector('[data-cfg-page-link="grp-risco"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForTimeout(150);

    const ativa = await page.evaluate(() => window.AppCore.state.ui.cfgActiveGroup);
    assert(ativa !== 'grp-risco', 'Sem diretório configurado, a página ativa de Configurações não deveria virar "Zona de risco"');
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /diret[oó]rio/i.test(t)), 'Deveria mostrar um aviso pedindo pra configurar um diretório');
});

test('Com diretório já configurado, as páginas do menu lateral de Configurações nascem habilitadas e navegar entre elas funciona normalmente', async ({ page, baseUrl }) => {
    await ligarTravaDeVerdade(page);
    await simularDiretorioConfigurado(page);
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);

    const estados = await page.evaluate((paginas) => Object.fromEntries(paginas.map((p) => [p, document.querySelector(`[data-cfg-page-link="${p}"]`).disabled])), CFG_PAGINAS_TRAVADAS);
    for (const pagina of CFG_PAGINAS_TRAVADAS) assert(!estados[pagina], `Com diretório configurado, a página "${pagina}" não deveria estar desabilitada`);

    await page.click('[data-cfg-page-link="grp-risco"]');
    await page.waitForTimeout(150);
    const ativa = await page.evaluate(() => window.AppCore.state.ui.cfgActiveGroup);
    assertEqual(ativa, 'grp-risco', 'Com diretório configurado, deveria ser possível navegar até "Zona de risco" normalmente');
});

test('Perder o diretório enquanto numa página que fica travada por isso volta pra "Armazenamento" (não trava numa página bloqueada)', async ({ page, baseUrl }) => {
    await ligarTravaDeVerdade(page);
    await simularDiretorioConfigurado(page, { esqueciveis: true });
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('[data-cfg-page-link="grp-risco"]');
    await page.waitForTimeout(150);

    // #btnForget só existe na própria página "Armazenamento" (não dá pra
    // clicar nele estando em "Zona de risco") — simula o diretório sumindo
    // por outro caminho (ex.: token do Drive expirado) e uma re-renderização
    // de Configurações em seguida, pra exercitar o fallback defensivo de
    // cfgAtiva em render() independente de como o diretório foi perdido.
    await page.evaluate(async () => {
        await window.Storage.forgetDirectory();
        await window.TabConfig.render();
    });
    await page.waitForTimeout(150);

    const ativa = await page.evaluate(() => window.AppCore.state.ui.cfgActiveGroup);
    assertEqual(ativa, 'grp-armazenamento', 'Perdendo o diretório estando em "Zona de risco", cfgActiveGroup deveria voltar pra "Armazenamento"');
    const paginaVisivel = await page.evaluate(() => !document.querySelector('[data-cfg-page="grp-armazenamento"]').classList.contains('hidden'));
    assert(paginaVisivel, 'A página "Armazenamento" deveria estar visível depois de esquecer o diretório');
});
