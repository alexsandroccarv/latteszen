/* ==========================================================================
   Regressão: configurações do sistema (prefixo do identificador, RSC/Súmula,
   listas de autocomplete etc.) se auto-salvam no diretório (configuracoes.json,
   mesmo princípio já usado por cada item do catálogo) e são restauradas ao
   sincronizar/escanear o diretório — não é mais preciso lembrar de um backup
   manual pra recuperar tudo num navegador/perfil novo.
   ========================================================================== */
import { test, assert, assertEqual, seedCatalog } from '../harness.mjs';

async function abrirSyncViaAssistente(page, baseUrl) {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(300);
    await page.click('[data-wizard-modo="existente"]');
    await page.waitForTimeout(50);
    await page.click('[data-wizard-tipo="local"]');
    await page.waitForTimeout(50);
}

test('Sincronizar do diretório também restaura as configurações do sistema (configuracoes.json)', async ({ page, baseUrl }) => {
    await abrirSyncViaAssistente(page, baseUrl);

    await page.evaluate(() => {
        window.Storage.scanDirectory = async () => [];
        window.Storage.readSettingsFromDirectory = async () => ({
            idPrefix: 'xyz',
            rscEnabled: true,
            rsc: { cargo: 'Pesquisador de teste' },
        });
    });

    await page.click('#btnSync');
    await page.waitForTimeout(400);

    const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}'));
    assertEqual(settings.idPrefix, 'xyz', 'O prefixo do identificador deveria ter sido restaurado do diretório');
    assertEqual(settings.rscEnabled, true, 'rscEnabled deveria ter sido restaurado do diretório');
    assertEqual(settings.rsc.cargo, 'Pesquisador de teste', 'A configuração do RSC deveria ter sido restaurada do diretório');

    const rscTabHidden = await page.$eval('.tab-btn[data-tab="rsc"]', (el) => el.classList.contains('hidden'));
    assert(!rscTabHidden, 'A aba RSC deveria ficar visível após restaurar rscEnabled=true do diretório');

    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.some((t) => /[Cc]onfigurações do sistema (também )?(atualizadas|restauradas)/.test(t)), 'Deveria avisar que as configurações também foram atualizadas');
});

test('Sem configuracoes.json no diretório, sincronizar não altera as configurações locais', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.idPrefix = 'abc';
        localStorage.setItem('lz_settings', JSON.stringify(s));
    });
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(300);
    await page.click('[data-wizard-modo="existente"]');
    await page.waitForTimeout(50);
    await page.click('[data-wizard-tipo="local"]');
    await page.waitForTimeout(50);

    await page.evaluate(() => {
        window.Storage.scanDirectory = async () => [];
        window.Storage.readSettingsFromDirectory = async () => null;
    });

    await page.click('#btnSync');
    await page.waitForTimeout(400);

    const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}'));
    assertEqual(settings.idPrefix, 'abc', 'Sem configuracoes.json no diretório, o prefixo local não deveria mudar');
});

test('Com diretório configurado, o card de status "Backup" mostra sincronização automática (sem contador de alterações)', async ({ page, baseUrl }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, 'Storage', {
            configurable: true,
            set(real) {
                real.hasDirectory = () => true;
                real.directoryName = async () => 'PastaFake';
                real.checkHealth = async () => ({ ok: true, hasDir: true });
                real.scanDirectory = async () => [];
                real.readSettingsFromDirectory = async () => null;
                Object.defineProperty(window, 'Storage', { value: real, writable: true, configurable: true });
            },
            get() { return undefined; },
        });
    });
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(300);

    const texto = await page.$eval('#backupStatusHint', (el) => el.textContent);
    assert(/sincronizam automaticamente com o diretório/.test(texto), 'Com diretório configurado, o status de Backup deveria indicar sincronização automática, não um contador de alterações');
});
