/* ==========================================================================
   Regressão: trava de acesso sem diretório de armazenamento configurado
   --------------------------------------------------------------------------
   Sem um diretório (local ou Google Drive) configurado, as abas que
   dependem de itens já cadastrados — Catalogar, Conformidade, Linha do
   tempo, Publicar, RSC, Súmula — ficam desabilitadas na barra de
   navegação, com uma dica explicando o motivo; "Início" e "Configurações"
   continuam sempre livres, pois é em Configurações › Armazenamento que
   mora o assistente de escolha do diretório (e Início já linka pra lá).
   A trava também vale a nível de código (switchTab), não só visual — um
   botão que chame switchTab() direto (ex.: "Ir para Catalogar" em Início)
   não consegue burlar o bloqueio.

   window.__LZ_TEST_SKIP_DIR_GATE é ligado por padrão em toda a suíte (ver
   harness.mjs) pra não quebrar os outros ~350 testes, que semeiam o
   catálogo direto via localStorage sem configurar diretório nenhum — os
   testes abaixo desligam o bypass pra exercitar a trava de verdade.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

const ABAS_TRAVADAS = ['catalogar', 'conformidade', 'linhatempo', 'publicar', 'rsc', 'sumula'];
const ABAS_LIVRES = ['inicio', 'config'];

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
                real.scanDirectory = async () => [];
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

    const ativa = await page.evaluate(() => window.AppCore.state.activeTab);
    assertEqual(ativa, 'inicio', 'Sem diretório configurado, switchTab("catalogar") não deveria trocar de aba');
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /diret[oó]rio/i.test(t)), 'Deveria mostrar um aviso pedindo pra configurar um diretório');
});

test('O botão "Ir para Catalogar" em Início não navega quando não há diretório configurado', async ({ page, baseUrl }) => {
    await ligarTravaDeVerdade(page);
    await seedCatalog(page, baseUrl, []);

    await page.click('#btnInicioCatalogar');
    await page.waitForTimeout(150);

    const ativa = await page.evaluate(() => window.AppCore.state.activeTab);
    assertEqual(ativa, 'inicio', 'Sem diretório configurado, "Ir para Catalogar" não deveria trocar de aba');
});

test('Com diretório já configurado, as abas nascem habilitadas e trocar de aba funciona normalmente', async ({ page, baseUrl }) => {
    await ligarTravaDeVerdade(page);
    await simularDiretorioConfigurado(page);
    await seedCatalog(page, baseUrl, []);

    const estados = await page.evaluate((abas) => Object.fromEntries(abas.map((a) => [a, document.querySelector(`[data-tab="${a}"]`).disabled])), ABAS_TRAVADAS);
    for (const aba of ABAS_TRAVADAS) assert(!estados[aba], `Com diretório configurado, a aba "${aba}" não deveria estar desabilitada`);

    await page.click('[data-tab="catalogar"]');
    await page.waitForTimeout(200);
    const ativa = await page.evaluate(() => window.AppCore.state.activeTab);
    assertEqual(ativa, 'catalogar', 'Com diretório configurado, deveria ser possível ir para Catalogar normalmente');
});

test('"Esquecer pasta" volta a travar as abas na hora (applyDirGate roda a cada render() de Configurações)', async ({ page, baseUrl }) => {
    await ligarTravaDeVerdade(page);
    await simularDiretorioConfigurado(page, { esqueciveis: true });
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);

    assert(!(await page.evaluate(() => document.querySelector('[data-tab="catalogar"]').disabled)), 'Pré-condição: com diretório configurado, "Catalogar" não deveria estar desabilitada ainda');

    await page.click('#btnForget');
    await page.waitForTimeout(200);

    const travada = await page.evaluate(() => document.querySelector('[data-tab="catalogar"]').disabled);
    assert(travada, 'Depois de "Esquecer pasta", a aba "Catalogar" deveria voltar a ficar desabilitada');
});
