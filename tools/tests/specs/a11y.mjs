/* ==========================================================================
   Regressão: acessibilidade (issue #17 — auditoria de leitor de tela e
   navegação por teclado)
   --------------------------------------------------------------------------
   Cobre os achados da auditoria e as correções feitas: armadilha de foco em
   modais (firstRunModal, aviso de cookies), estado aria-pressed/aria-selected
   em botões de alternância e abas, navegação por setas na régua de abas,
   nomes acessíveis em controles antes mudos (ícone de ajuda, colunas de
   repeater, níveis de habilidade), e o combobox ARIA do buscador de
   critério do RSC.
   ========================================================================== */
import { test, assert, assertEqual, makeItem, seedCatalog } from '../harness.mjs';

test('firstRunModal: foco vai pro botão "Entendi" ao abrir, Tab fica preso dentro do modal, Esc fecha e marca avisoDevVisto', async ({ page, baseUrl }) => {
    // O harness marca avisoDevVisto=true por padrão em TODA navegação (pra
    // não travar os outros ~400 testes da suíte atrás do modal) — este
    // teste precisa da situação real de 1ª visita, então desfaz isso com um
    // init script de página, registrado DEPOIS do da suíte (roda por
    // último, e sobrescreve) — mesmo padrão usado por analytics.mjs/
    // dir-gate.mjs pra religar um comportamento que o harness desliga por padrão.
    await page.addInitScript(() => { localStorage.removeItem('lz_settings'); });
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    const aberto = await page.evaluate(() => !document.querySelector('#firstRunModal').classList.contains('hidden'));
    assert(aberto, 'firstRunModal deveria aparecer na 1ª visita (sem avisoDevVisto salvo)');
    const focoInicial = await page.evaluate(() => document.activeElement && document.activeElement.id);
    assertEqual(focoInicial, 'btnFirstRunOk', 'O foco deveria ir pro botão "Entendi" ao abrir o modal');

    // Tab (e Shift+Tab) só circulam entre os focáveis DE DENTRO do modal
    // (o link "issue no repositório" e o botão) — nunca escapam pra trás.
    await page.keyboard.press('Tab');
    const depoisDoTab = await page.evaluate(() => ({ tag: document.activeElement.tagName, dentro: !!document.activeElement.closest('#firstRunModal') }));
    assertEqual(depoisDoTab.tag, 'A', 'Tab a partir do botão deveria ir pro link (único outro focável do modal)');
    assert(depoisDoTab.dentro, 'O foco deveria continuar dentro do modal, não escapar pra página por trás');
    await page.keyboard.press('Tab');
    const voltaAoBotao = await page.evaluate(() => document.activeElement.id);
    assertEqual(voltaAoBotao, 'btnFirstRunOk', 'Tab de novo deveria circular de volta pro botão "Entendi"');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const fechado = await page.evaluate(() => document.querySelector('#firstRunModal').classList.contains('hidden'));
    assert(fechado, 'Esc deveria fechar o firstRunModal (mesmo efeito de clicar em "Entendi")');
    const marcado = await page.evaluate(() => JSON.parse(localStorage.getItem('lz_settings') || '{}').avisoDevVisto);
    assert(marcado, 'Fechar com Esc deveria marcar avisoDevVisto, igual ao clique no botão');
});

test('Aviso de cookies: foco vai pro botão "Aceitar" e fica preso ali (sem forma de escapar pro app por trás sem decidir)', async ({ page, baseUrl }) => {
    // ID de Analytics real (não o placeholder G-XXXXXXXXXX que os outros
    // testes da suíte usam pra desligar o aviso) — só assim o banner aparece.
    await page.addInitScript(() => { window.__LZ_TEST_ANALYTICS_ID = 'G-REAL123456'; });
    await page.goto(baseUrl + '/index.html');
    await page.waitForTimeout(400);

    const focoInicial = await page.evaluate(() => document.activeElement && document.activeElement.id);
    assertEqual(focoInicial, 'lzCookieAceitar', 'O foco deveria ir pro botão "Aceitar" ao abrir o aviso de cookies');
    await page.keyboard.press('Tab');
    const continuaNoBotao = await page.evaluate(() => document.activeElement && document.activeElement.id);
    assertEqual(continuaNoBotao, 'lzCookieAceitar', 'Tab não deveria escapar do aviso (único elemento focável — "Aceitar")');

    await page.click('#lzCookieAceitar');
    await page.waitForTimeout(150);
    const sumiu = await page.evaluate(() => !document.querySelector('#lzCookieBanner'));
    assert(sumiu, 'Aceitar deveria remover o aviso de cookies');
});

test('Régua de abas: ArrowRight/ArrowLeft/Home/End movem o foco E trocam de aba (WAI-ARIA tablist)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.evaluate(() => document.querySelector('[role="tab"][data-tab="inicio"]').focus());

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    const depoisDireita = await page.evaluate(() => ({
        focado: document.activeElement.dataset.tab,
        selecionada: document.querySelector('[role="tab"][aria-selected="true"]').dataset.tab,
    }));
    assertEqual(depoisDireita.focado, 'catalogar', 'ArrowRight deveria mover o foco pra próxima aba');
    assertEqual(depoisDireita.selecionada, 'catalogar', 'ArrowRight deveria também ativar a aba (ativação automática)');

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    const depoisEsquerda = await page.evaluate(() => document.activeElement.dataset.tab);
    assertEqual(depoisEsquerda, 'inicio', 'ArrowLeft deveria voltar pra aba anterior');

    await page.keyboard.press('End');
    await page.waitForTimeout(100);
    const depoisEnd = await page.evaluate(() => document.activeElement.dataset.tab);
    assertEqual(depoisEnd, 'linhatempo', 'End deveria ir pra última aba visível por padrão (Publicar/RSC/Súmula começam ocultas até habilitadas em Configurações)');

    await page.keyboard.press('Home');
    await page.waitForTimeout(100);
    const depoisHome = await page.evaluate(() => document.activeElement.dataset.tab);
    assertEqual(depoisHome, 'inicio', 'Home deveria voltar pra 1ª aba');
});

test('headerConfigBtn usa aria-pressed (não aria-selected, que exige role=tab) e aria-controls/aria-labelledby ligam abas aos painéis', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    const antes = await page.evaluate(() => {
        const cfg = document.querySelector('#headerConfigBtn');
        return { pressed: cfg.getAttribute('aria-pressed'), temSelected: cfg.hasAttribute('aria-selected'), controls: cfg.getAttribute('aria-controls') };
    });
    assertEqual(antes.pressed, 'false', 'headerConfigBtn deveria começar aria-pressed=false');
    assert(!antes.temSelected, 'headerConfigBtn não deveria ter aria-selected (não tem role=tab nem fica dentro do tablist)');
    assertEqual(antes.controls, 'tab-config', 'headerConfigBtn deveria ter aria-controls apontando pro painel de Configurações');

    await page.click('#headerConfigBtn');
    await page.waitForTimeout(150);
    const depois = await page.evaluate(() => ({
        pressed: document.querySelector('#headerConfigBtn').getAttribute('aria-pressed'),
        inicioSelected: document.querySelector('[role="tab"][data-tab="inicio"]').getAttribute('aria-selected'),
    }));
    assertEqual(depois.pressed, 'true', 'headerConfigBtn deveria virar aria-pressed=true ao abrir Configurações');
    assertEqual(depois.inicioSelected, 'false', 'As demais abas (role=tab) deveriam continuar usando aria-selected, agora false');

    const wiring = await page.evaluate(() => {
        const tab = document.querySelector('[role="tab"][data-tab="catalogar"]');
        const painel = document.querySelector('#tab-catalogar');
        return { tabId: tab.id, painelControladoPor: tab.getAttribute('aria-controls'), painelLabelledby: painel.getAttribute('aria-labelledby') };
    });
    assertEqual(wiring.painelControladoPor, 'tab-catalogar', 'A aba Catalogar deveria controlar #tab-catalogar via aria-controls');
    assertEqual(wiring.painelLabelledby, wiring.tabId, 'O painel #tab-catalogar deveria ser rotulado pela sua aba via aria-labelledby');
});

test('Conformidade: chips de filtro e ícones de status expõem aria-pressed refletindo o filtro ativo', async ({ page, baseUrl }) => {
    const items = [makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Item sem evidência', ano: '2023' })];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);

    const chip = await page.$('[data-view="semPdf"]');
    assert(chip, 'Deveria existir o chip "Sem evidência" (item sem PDF anexado)');
    const antes = await chip.getAttribute('aria-pressed');
    assertEqual(antes, 'false', 'Chip deveria começar aria-pressed=false (filtro não aplicado)');
    await chip.click();
    await page.waitForTimeout(200);
    const depois = await page.$eval('[data-view="semPdf"]', (el) => el.getAttribute('aria-pressed'));
    assertEqual(depois, 'true', 'Clicar no chip deveria virar aria-pressed=true');
});

test('Configurações: cartão "Relatório completo (PDF)" — ícone de ajuda é um botão acessível (foco por Tab, aria-label, clique mostra toast)', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []);
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(200);
    await page.click('[data-cfg-page-link="grp-exportar"]');
    await page.waitForTimeout(200);

    const info = await page.evaluate(() => {
        const btn = document.querySelector('[data-cfg-page="grp-exportar"] .lz-help-btn');
        return btn && { tag: btn.tagName, ariaLabel: btn.getAttribute('aria-label'), temTitle: !!btn.getAttribute('title') };
    });
    assert(info, 'Deveria existir pelo menos um botão de ajuda (.lz-help-btn) na página Exportar');
    assertEqual(info.tag, 'BUTTON', 'O ícone de ajuda deveria ser um <button> de verdade, não um <i> solto');
    assertEqual(info.ariaLabel, 'Ajuda', 'Deveria ter aria-label="Ajuda"');
    assert(info.temTitle, 'Deveria manter o title (tooltip no hover) além do aria-label');

    const btn = await page.$('[data-cfg-page="grp-exportar"] .lz-help-btn');
    await btn.click();
    await page.waitForTimeout(150);
    const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#toasts > div')).map((d) => d.textContent));
    assert(toasts.length > 0, 'Clicar no botão de ajuda deveria mostrar um toast (funciona em telas de toque, sem depender de hover)');
});

test('Configurações: botões do assistente de diretório (modo/tipo) expõem aria-pressed', async ({ page, baseUrl }) => {
    await seedCatalog(page, baseUrl, []); // sem diretório configurado — assistente aparece
    await page.click('[data-tab="config"]');
    await page.waitForTimeout(300);

    const modoBtn = await page.$('[data-wizard-modo="novo"]');
    assert(modoBtn, 'Botão "Primeira configuração" do assistente deveria existir');
    const antes = await modoBtn.getAttribute('aria-pressed');
    await modoBtn.click();
    await page.waitForTimeout(200);
    const depois = await page.$eval('[data-wizard-modo="novo"]', (el) => el.getAttribute('aria-pressed'));
    assertEqual(depois, 'true', 'Clicar em "Primeira configuração" deveria virar aria-pressed=true');
    assert(antes !== depois || antes === 'false', 'O estado deveria refletir de fato o modo selecionado');
});

test('Catalogar: níveis de habilidade (Idiomas → Proficiência) têm aria-label próprio por habilidade, não só o rótulo genérico do campo', async ({ page, baseUrl }) => {
    const items = [makeItem('IDIOMAS', 'DADOS_GERAIS', { titulo: 'Inglês', habilidades: 'Leitura:Bom;Fala:Razoável' })];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    await page.evaluate((t) => {
        const cards = Array.from(document.querySelectorAll('#itemList .bg-white.dark\\:bg-gray-800.border'));
        cards.find((c) => c.textContent.includes(t)).querySelector('[data-act="edit"]').click();
    }, 'Inglês');
    await page.waitForTimeout(300);

    const selects = await page.$$eval('select[data-slgroup]', (els) => els.map((e) => ({ skill: e.dataset.skill, ariaLabel: e.getAttribute('aria-label') })));
    assert(selects.length >= 4, `Deveria haver 4 selects de habilidade (Leitura/Fala/Escrita/Compreensão) — obtido ${selects.length}`);
    selects.forEach((s) => assertEqual(s.ariaLabel, s.skill, `O select da habilidade "${s.skill}" deveria ter aria-label próprio (igual ao nome da habilidade), não ficar mudo`));
    const labelsUnicos = new Set(selects.map((s) => s.ariaLabel));
    assertEqual(labelsUnicos.size, selects.length, 'Cada select deveria ter um aria-label DIFERENTE dos outros (um por habilidade)');
});

test('Catalogar: campo repeater (ex.: Autores) não deixa o <label> do campo apontar pro <input type="hidden">, e cada coluna tem aria-label', async ({ page, baseUrl }) => {
    const items = [makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Artigo com autores', ano: '2023', autoresLista: [{ nome: 'Fulano de Tal' }] })];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    await page.evaluate((t) => {
        const cards = Array.from(document.querySelectorAll('#itemList .bg-white.dark\\:bg-gray-800.border'));
        cards.find((c) => c.textContent.includes(t)).querySelector('[data-act="edit"]').click();
    }, 'Artigo com autores');
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
        const hidden = document.querySelector('input[type="hidden"][data-repeater]');
        const label = hidden ? document.querySelector(`label[for="${hidden.id}"]`) : null;
        const colInput = document.querySelector('[data-repeater-input]');
        return {
            hiddenTemLabelApontandoPraEle: !!label,
            colInputAriaLabel: colInput && colInput.getAttribute('aria-label'),
        };
    });
    assert(!info.hiddenTemLabelApontandoPraEle, 'Nenhum <label> deveria apontar pro <input type="hidden"> do repeater (era o bug: label ficava mudo, apontando pra um campo invisível)');
    assert(info.colInputAriaLabel, 'A coluna visível do repeater (onde a pessoa digita) deveria ter aria-label próprio');
});

test('RSC: buscador de critério é um combobox ARIA completo (role, aria-expanded, aria-activedescendant, navegação por setas)', async ({ page, baseUrl }) => {
    const items = [makeItem('FORMACAO_COMPLEMENTAR', 'FORMACAO', { titulo: 'Curso RSC A11y', instituicao: 'X', anoFim: '2024' })];
    await seedCatalog(page, baseUrl, items);
    await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('lz_settings') || '{}');
        s.rscEnabled = true;
        localStorage.setItem('lz_settings', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForTimeout(500);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    await page.evaluate((t) => {
        const cards = Array.from(document.querySelectorAll('#itemList .bg-white.dark\\:bg-gray-800.border'));
        cards.find((c) => c.textContent.includes(t)).querySelector('[data-act="edit"]').click();
    }, 'Curso RSC A11y');
    await page.waitForTimeout(300);
    await page.check('#rscConta');
    await page.waitForTimeout(150);

    const semantica = await page.evaluate(() => ({
        role: document.querySelector('#rscCritFiltro').getAttribute('role'),
        expanded: document.querySelector('#rscCritFiltro').getAttribute('aria-expanded'),
        listRole: document.querySelector('#rscCritLista').getAttribute('role'),
    }));
    assertEqual(semantica.role, 'combobox', 'Campo de busca deveria ter role=combobox');
    assertEqual(semantica.expanded, 'false', 'aria-expanded deveria começar false (lista fechada)');
    assertEqual(semantica.listRole, 'listbox', 'Lista de resultados deveria ter role=listbox');

    await page.click('#rscCritFiltro');
    await page.waitForTimeout(150);
    const abriu = await page.$eval('#rscCritFiltro', (el) => el.getAttribute('aria-expanded'));
    assertEqual(abriu, 'true', 'aria-expanded deveria virar true ao focar/abrir a lista');

    await page.fill('#rscCritFiltro', 'premiação');
    await page.waitForTimeout(150);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    const primeiroDestaque = await page.$eval('#rscCritFiltro', (el) => el.getAttribute('aria-activedescendant'));
    assert(primeiroDestaque, 'ArrowDown deveria destacar a 1ª opção (aria-activedescendant)');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    const segundoDestaque = await page.$eval('#rscCritFiltro', (el) => el.getAttribute('aria-activedescendant'));
    assert(segundoDestaque !== primeiroDestaque, 'ArrowDown de novo deveria mover o destaque pra próxima opção');

    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const selecionado = await page.$eval('#rscCrit', (el) => el.value);
    assert(selecionado, 'Enter deveria selecionar o critério em destaque');
    const fechou = await page.$eval('#rscCritFiltro', (el) => el.getAttribute('aria-expanded'));
    assertEqual(fechou, 'false', 'aria-expanded deveria voltar a false depois de selecionar');
});

test('Alvos de toque: ícones de ação por item (editar/duplicar/excluir) usam classes de tamanho maior (w-9 h-9), não mais w-7 h-7', async ({ page, baseUrl }) => {
    // Mede pela CLASSE, não pelo tamanho renderizado: a suíte bloqueia a CDN
    // do Tailwind de propósito (ver harness.mjs), então as classes
    // utilitárias de tamanho nunca chegam a aplicar CSS de verdade aqui —
    // o que dá pra verificar com confiança é que a classe certa (maior) foi
    // trocada pela antiga (menor), não o box renderizado em pixels.
    const items = [makeItem('ARTIGO_PERIODICO', 'PRODUCOES', { titulo: 'Item com botões de ação', ano: '2023' })];
    await seedCatalog(page, baseUrl, items);
    await page.click('[data-tab="conformidade"]');
    await page.waitForTimeout(300);
    await page.evaluate(() => { const d = document.querySelector('#itensSection'); if (d) d.open = true; });
    await page.waitForTimeout(150);

    const classes = await page.$$eval('[data-act="edit"], [data-act="del"]', (els) => els.map((e) => e.className));
    assert(classes.length > 0, 'Deveria haver botões de editar/excluir na lista de itens');
    classes.forEach((c) => {
        assert(/\bw-9\b/.test(c) && /\bh-9\b/.test(c), `Botão de ação deveria usar w-9 h-9 (36px) — obtido "${c}"`);
        assert(!/\bw-7\b/.test(c) && !/\bh-7\b/.test(c), `Botão de ação não deveria mais usar o tamanho antigo w-7 h-7 — obtido "${c}"`);
    });
});
