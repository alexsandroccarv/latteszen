// lattesZen — Copyright (C) 2026 Alexsandro Cardoso Carvalho
//
// This file is part of lattesZen.
//
// lattesZen is free software: you can redistribute it and/or modify it
// under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or (at
// your option) any later version.
//
// lattesZen is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public
// License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with lattesZen. If not, see <https://www.gnu.org/licenses/>.

/* ==========================================================================
   lattesZen — Aba Configurações (última aba extraída de app.js)
   --------------------------------------------------------------------------
   Sexta e última aba extraída de app.js (ver issue de refatoração) — inclui
   os formulários de perfil (Identificação, Foto, Endereço, Texto inicial,
   Outras informações), Área de atuação, Documentos pessoais, RSC-PCCTAE,
   Lixeira, backup/restauração do catálogo e ferramentas de codificação.
   Os importadores/exportadores de XML do Lattes, ORCID e BibTeX/RIS saíram
   para tab-config-xml.js/tab-config-orcid.js/tab-config-bibtex.js (issue de
   refatoração) — importados de volta abaixo; a dedup por assinatura
   (tab-config-dedup.js) e helpIcon/dadosItemHtml/fileStamp
   (tab-config-shared.js) são compartilhados entre eles.

   Mesmo padrão das abas já extraídas: lê estado/utilidades/motor de forms
   de window.AppCore (buildForm, fieldHtml, os wireX, collectFields... —
   publicados por tab-catalogar.js, que carrega ANTES deste módulo, então
   é seguro desestruturar direto no topo). Na direção oposta, funções que
   ficaram em app.js (saveCatalog, switchTab, checkDirHealth, syncFromDirectory,
   restoreItem/purgeTrashItem/emptyTrash, sanitizePrefix, updateHeaderIdentity,
   applyRscVisibility etc.) são lidas via window.AppCore.xxx dentro dos
   corpos das funções — app.js carrega DEPOIS deste módulo.
   ========================================================================== */
import { xmlImportItemHtml, wireExportLattes, onXmlSelected } from './tab-config-xml.js';
import { orcidImportItemHtml, wireOrcidImport } from './tab-config-orcid.js';
import { bibImportItemHtml, bibExportItemHtml, onBibFileSelected, wireBibExport } from './tab-config-bibtex.js';
import { pdfReportExportItemHtml, wirePdfReportExport } from './tab-config-pdf-report.js';
import { dadosItemHtml, fileStamp, wireHelpIcons } from './tab-config-shared.js';

window.TabConfig = (function () {
    const {
        state, $, $$, esc, toast,
        itemsUsingValue, evCount,
        buildForm, fieldHtml, wireValidators, wireCounters, wireDateBr, wireConditional, wireNA, wireAreaTree, wireRepeater,
        collectFields, normalizeEncoding, validateItemFields, collectSuggestions, renameFieldValue,
        AUTOCOMPLETE_KEYS, VOCAB_LABELS, t, tp,
    } = window.AppCore;

    // Aviso persistente exibido logo após uma migração local → Google Drive
    // (não usa toast pra isso — some rápido demais pra uma mensagem
    // importante). Fica até o usuário clicar em "Entendi, dispensar", ou até
    // recarregar a página.
    let gdriveMigrationNotice = null;

    // Feedback de sincronização com contador corrente (pedido do Alexsandro:
    // "Sincronizando itens já existentes na pasta…" parado, sem indício
    // nenhum de progresso ou travamento, numa biblioteca grande do Google
    // Drive no celular). O total real só se sabe no fim (a varredura é
    // recursiva, pasta por pasta) — por isso um contador corrente, não uma
    // barra de "n de total", mesmo padrão já usado em migrateLocalToGoogleDrive.
    function statusSincronizandoHtml(n) {
        return `<span class="text-gray-500"><i aria-hidden="true" class="fa-solid fa-spinner fa-spin mr-1"></i> ${esc(tp('tab_config.sincronizando_progresso', n, { um: 'Sincronizando itens já existentes na pasta… ({n} encontrado até agora)', outros: 'Sincronizando itens já existentes na pasta… ({n} encontrados até agora)' }))}</span>`;
    }

    // Junta os itens de uma lista em texto, cortando numa quantidade máxima
    // ("a, b, c e mais 4") — pra um aviso de falha não virar um parágrafo
    // ilegível quando muita coisa falhou de uma vez (ex.: internet caiu no
    // meio de uma varredura grande).
    function listarComLimite(itens, max) {
        const visiveis = itens.slice(0, max);
        const resto = itens.length - visiveis.length;
        return visiveis.join(', ') + (resto > 0 ? t('tab_config.e_mais_n', ' e mais {n}', { n: resto }) : '');
    }

    // Resume o `detalhes` de uma sincronização incompleta (pastas que não
    // puderam ser LISTADAS + arquivos que não puderam ser LIDOS, ver
    // Storage.scanDirectory/retentarFalhasSincronizacao) num texto legível —
    // pedido do Alexsandro: um aviso genérico como "2 pasta(s) não puderam
    // ser lidas" não dizia quais pastas nem quantos itens ficaram de fora.
    // `esc` opcional: passa a função de escape (pra uso em innerHTML); sem
    // isso, devolve texto puro (pra uso em toast, que já usa textContent).
    function resumoFalhasSinc(detalhes, escapar) {
        const seguro = escapar || ((s) => s);
        const pastas = detalhes.filter((d) => d.tipo === 'pasta');
        const arquivos = detalhes.filter((d) => d.tipo === 'arquivo');
        const porPasta = new Map();
        arquivos.forEach((d) => { const chave = d.pastaCaminho || '(raiz)'; porPasta.set(chave, (porPasta.get(chave) || 0) + 1); });
        const partes = [];
        if (pastas.length) {
            partes.push(t('tab_config.pastas_nao_abertas', '{n} pasta(s) não puderam ser abertas: {lista}', { n: pastas.length, lista: listarComLimite(pastas.map((p) => `"${seguro(p.caminho)}"`), 5) }));
        }
        if (arquivos.length) {
            const porPastaTxt = listarComLimite(Array.from(porPasta.entries()).map(([caminho, n]) => `"${seguro(caminho)}" (${n})`), 5);
            partes.push(t('tab_config.arquivos_nao_lidos', '{n} arquivo(s) não puderam ser lidos, em: {lista}', { n: arquivos.length, lista: porPastaTxt }));
        }
        return partes.join(' ');
    }

    // Mostra o aviso detalhado de sincronização incompleta num container
    // (statusEl do Google Drive, ou o novo #syncStatus) COM um botão pra
    // tentar de novo só o que falhou (Storage.retentarFalhasSincronizacao,
    // via syncFromDirectory) — pedido do Alexsandro: "rotina que force
    // apenas as indisponíveis", em vez de repetir a sincronização inteira.
    // Ao tentar de novo, chama a si mesma com o resultado atualizado — se
    // ainda sobrar falha, o aviso e o botão continuam lá, só com a lista
    // menor; se resolver tudo, o container volta a ficar limpo.
    function mostrarAvisoFalhasSync(container, detalhes) {
        if (!container) return;
        if (!detalhes || !detalhes.length) { container.innerHTML = ''; return; }
        container.innerHTML = `<div class="text-amber-700 dark:text-amber-400">
            <p>${resumoFalhasSinc(detalhes, esc)}</p>
            <button type="button" id="btnRetentarFalhasSync" class="underline hover:no-underline mt-1">${esc(t('tab_config.tentar_sincronizar_novo', 'Tentar sincronizar de novo só o que falhou'))}</button>
        </div>`;
        const btn = container.querySelector('#btnRetentarFalhasSync');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            const originalLabel = btn.textContent;
            btn.textContent = t('tab_config.tentando_de_novo', 'Tentando de novo…');
            try {
                const resultado = await window.AppCore.syncFromDirectory((n) => {
                    btn.textContent = t('tab_config.tentando_de_novo_progresso', 'Tentando de novo… ({n} recuperado(s) até agora)', { n });
                }, detalhes);
                if (resultado.encontrados) window.AppCore.renderItemList();
                if (resultado.falhas) {
                    mostrarAvisoFalhasSync(container, resultado.detalhes);
                    toast(t('tab_config.ainda_faltou_sincronizar', 'Ainda faltou sincronizar {n} item(ns) — veja os detalhes na tela.', { n: resultado.falhas }), 'aviso');
                } else {
                    container.innerHTML = '';
                    toast(t('tab_config.tudo_sincronizado', 'Tudo sincronizado agora.'), 'ok');
                }
            } catch (e) {
                btn.disabled = false;
                btn.textContent = originalLabel;
                toast(t('tab_config.falha_sincronizar_novo', 'Falha ao tentar sincronizar de novo: {erro}', { erro: e.message }), 'erro');
            }
        });
    }

    // Assistente guiado de "Diretório de armazenamento", mostrado só enquanto
    // NENHUM diretório está configurado ainda (Storage.hasDirectory() falso)
    // — depois de configurado, a seção volta a mostrar o painel de estado
    // atual direto (pasta ativa + botões de gerenciar), sem o assistente.
    // 'novo' | 'existente' | null, e 'local' | 'remoto' | null.
    // Restaura o passo do assistente depois de um reload forçado por troca
    // de idioma no seletor abaixo (ver wizLocale) — a chave em sessionStorage
    // (não localStorage: só precisa sobreviver a ESSE reload, não a uma
    // sessão nova) é lida aqui, mas só removida por app.js/init() (que roda
    // depois, no fim da fila de <script>) — ver nota lá.
    let dirWizardModo = null;
    let dirWizardTipo = null;
    try {
        const restaurar = JSON.parse(sessionStorage.getItem('lz_wizard_restore') || 'null');
        if (restaurar) { dirWizardModo = restaurar.modo || null; dirWizardTipo = restaurar.tipo || null; }
    } catch (_) {}

    // Importação/exportação de Lattes XML (xmlConsistencyToast,
    // xmlImportItemHtml) e helpIcon/dadosItemHtml — extraídos para
    // tab-config-xml.js/tab-config-shared.js (issue de refatoração).

    /* =====================================================================
       TEMA — paletas prontas trazidas do templateZen ("conforme está lá"),
       seção dentro de Configurações. Aplica a classe .lz-theme + o atributo
       data-lz-theme no <html>; as cores em si vivem em styles.css (paletas
       por data-lz-theme, valendo pro app inteiro — não só cabeçalho/rodapé).
       ===================================================================== */
    // "govbr" e "padrao" eram dois temas de nome conflitante ("gov.br" e
    // "Padrão (gov.br)"), ambos claros. Viraram "lattesZen dia" (govbr, o
    // padrão do app) e "lattesZen noite" (padrao) — esta última com paleta
    // própria ESCURA (ver data-lz-theme="padrao" em styles.css), pedido do
    // Alexsandro pra bater com o nome ("noite" tem que ser escuro de
    // verdade, não só herdar o alternador de claro/escuro).
    const THEME_DEFAULT = 'govbr';
    const THEME_PRESETS = [
        { value: 'govbr', label: t('tab_config.tema_lattes_dia', 'lattesZen dia'), font: "'Rawline',system-ui,sans-serif" },
        { value: 'padrao', label: t('tab_config.tema_lattes_noite', 'lattesZen noite'), font: "system-ui,sans-serif" },
        { value: 'catppuccin-latte', label: 'Catppuccin Latte', font: "'Nunito',system-ui,sans-serif" },
        { value: 'catppuccin-mocha', label: 'Catppuccin Mocha', font: "'Nunito',system-ui,sans-serif" },
        { value: 'dracula', label: t('tab_config.tema_dracula', 'Drácula'), font: "'Fira Sans',system-ui,sans-serif" },
        { value: 'github-light', label: 'GitHub Light', font: "system-ui,sans-serif" },
        { value: 'github-dark', label: 'GitHub Dark', font: "system-ui,sans-serif" },
        { value: 'rose-pine-dawn', label: 'Rosé Pine Dawn', font: "'Quicksand',system-ui,sans-serif" },
        { value: 'solarized-light', label: 'Solarized Light', font: "'Source Sans 3',system-ui,sans-serif" },
        { value: 'solarized-dark', label: 'Solarized Dark', font: "'Source Sans 3',system-ui,sans-serif" },
    ];
    function themeSectionHtml() {
        return `
            <section id="temaSection" class="scroll-mt-20 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-2 flex items-center gap-2">
                    <i aria-hidden="true" class="fa-solid fa-palette text-govbr-600 dark:text-unifesp-400"></i> ${esc(t('tab_config.tema_titulo', 'Tema'))}
                </h2>
                <div class="space-y-2">
                    <label for="themeSelect" class="block text-sm">${esc(t('tab_config.escolha_tema', 'Escolha um tema'))}</label>
                    <select id="themeSelect" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-govbr-400">
                        ${THEME_PRESETS.map(p => `<option value="${esc(p.value)}" style="font-family:${p.font}">${esc(p.label)}</option>`).join('')}
                    </select>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${t('tab_config.tema_ajuda', 'O tema é aplicado ao app inteiro (cabeçalho, abas, botões, rodapé) e fica salvo neste navegador. "{padrao}" é o padrão.', { padrao: t('tab_config.tema_lattes_dia', 'lattesZen dia') })}</p>
                </div>
            </section>`;
    }
    // Aplica um tema (chamado ao trocar o select e uma vez no carregamento
    // desta aba, pra manter o <select> sincronizado com o que já está ativo
    // — a aplicação em si já ocorreu cedo, no script inline de cada página).
    function aplicarTema(preset) {
        const html = document.documentElement;
        if (preset) {
            html.setAttribute('data-lz-theme', preset);
            html.classList.add('lz-theme');
            if (typeof window.__loadThemeFont === 'function') window.__loadThemeFont(preset);
        } else {
            html.classList.remove('lz-theme');
            html.removeAttribute('data-lz-theme');
        }
        if (typeof window.__setThemeColor === 'function') window.__setThemeColor();
    }
    function wireThemeSection() {
        const sel = $('#themeSelect');
        if (!sel) return;
        const saved = localStorage.getItem(APP_CONFIG.storageKeys.themePreset) || THEME_DEFAULT;
        sel.value = saved;
        // Prévia de fonte nas opções do <select>: carrega as fontes de todos
        // os temas (só quando a aba Configurações é aberta, não no boot).
        if (typeof window.__loadThemeFont === 'function') {
            THEME_PRESETS.forEach(p => window.__loadThemeFont(p.value));
        }
        sel.addEventListener('change', () => {
            localStorage.setItem(APP_CONFIG.storageKeys.themePreset, sel.value);
            aplicarTema(sel.value);
            window.AppCore.persistirAcessibilidade();
        });
    }

    // Importação/exportação de Lattes XML, deduplicação por assinatura,
    // ORCID e BibTeX/RIS — extraídos para tab-config-xml.js/
    // tab-config-dedup.js/tab-config-orcid.js/tab-config-bibtex.js (issue de
    // refatoração), importados de volta no topo deste arquivo.

    // Backup completo (catálogo + configurações) em JSON — itens "lattesZen
    // (JSON)" das páginas "Importar"/"Exportar".
    function jsonImportItemHtml() {
        return dadosItemHtml('fa-solid fa-file-code', t('tab_config.json_titulo', 'lattesZen (JSON)'),
            t('tab_config.json_import_ajuda', 'Importa um arquivo JSON gerado pelo "Exportar catálogo" — restaura todo o catálogo (metadados) e as configurações do sistema (prefixo do identificador, listas de autocomplete, RSC-PCCTAE) num navegador novo.'), `
                <label class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm cursor-pointer inline-flex items-center gap-1.5"><i class="fa-solid fa-upload"></i> ${esc(t('tab_config.importar_catalogo', 'Importar catálogo'))}
                    <input type="file" id="importJson" accept="application/json" class="hidden">
                </label>`);
    }
    function jsonExportItemHtml(dirName) {
        const sinceBackup = (Storage.loadSettings() || {}).sinceBackup || 0;
        // Com diretório configurado, itens e configurações já se auto-salvam
        // lá (um JSON por item + configuracoes.json) — o contador de
        // "alterações desde o último backup" só é relevante pra quem ainda
        // não tem diretório (só localStorage, sem esse mecanismo).
        const backupDetail = dirName
            ? t('tab_config.backup_em_dia_com_dir', 'Em dia — itens e configurações sincronizam automaticamente com o diretório')
            : (sinceBackup ? tp('tab_config.backup_alteracoes', sinceBackup, { um: '{n} alteração desde o último backup', outros: '{n} alterações desde o último backup' }) : t('tab_config.backup_em_dia_sem_dir', 'Em dia — sem alterações desde o último backup'));
        return dadosItemHtml('fa-solid fa-file-code', t('tab_config.json_titulo', 'lattesZen (JSON)'),
            t('tab_config.json_export_ajuda', 'Exporte todo o catálogo (metadados) e as configurações do sistema (prefixo do identificador, listas de autocomplete, RSC-PCCTAE) num único arquivo JSON — útil pra levar tudo de uma vez a outro computador, ou pra quem ainda não configurou um diretório. Com um diretório configurado, itens e configurações já se auto-salvam lá a cada mudança (basta reescanear o diretório pra recuperar tudo), então este export é um extra, não uma necessidade. Com diretório, o arquivo também é salvo automaticamente na subpasta "Cópia de segurança".'), `
                <button id="btnExport" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-download mr-1"></i> ${esc(t('tab_config.exportar_catalogo', 'Exportar catálogo'))}</button>
                <p id="backupStatusHint" class="text-xs text-gray-500 dark:text-gray-400 mt-1.5">${esc(backupDetail)}</p>`);
    }

    // "Importar" e "Exportar" — 2 páginas próprias no menu lateral (antes
    // eram 2 colunas dentro de uma única página "Trazer e levar dados"),
    // reunindo Lattes (XML), ORCID, BibTeX/RIS e lattesZen (JSON) — cada um
    // num card próprio, com as explicações que antes ficavam em parágrafos
    // soltos agora num ícone de ajuda "(?)" (title, aparece ao passar o
    // mouse). `id="backupSection"` fica em Exportar, pra manter o atalho do
    // card de status "Backup".
    function importarSectionHtml() {
        return `
            <section id="importXmlSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-3 flex items-center gap-2"><i aria-hidden="true" class="fa-solid fa-file-import text-govbr-600 dark:text-unifesp-400"></i> ${esc(t('tab_config.importar', 'Importar'))}</h2>
                <div class="space-y-3">
                    ${xmlImportItemHtml()}
                    ${orcidImportItemHtml()}
                    ${bibImportItemHtml()}
                    ${jsonImportItemHtml()}
                </div>
            </section>`;
    }
    function exportarSectionHtml(dirName) {
        return `
            <section id="backupSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-3 flex items-center gap-2"><i aria-hidden="true" class="fa-solid fa-file-export text-govbr-600 dark:text-unifesp-400"></i> ${esc(t('tab_config.exportar', 'Exportar'))}</h2>
                <div class="space-y-3">
                    ${bibExportItemHtml()}
                    ${jsonExportItemHtml(dirName)}
                    ${pdfReportExportItemHtml()}
                </div>
            </section>`;
    }
    // (Importar/Exportar BibTeX/RIS — extraído para tab-config-bibtex.js, issue de refatoração)

    /* =====================================================================
       ABA: CONFIGURAÇÕES
       ===================================================================== */
    /* ------------------------- Configuração do RSC ------------------------ */
    // Os dados funcionais do servidor (cargo, SIAPE, contatos etc.) ficam na
    // própria aba RSC (ver tab-rsc.js) — aqui só o habilitar/desabilitar do
    // módulo, pra não duplicar formulário em dois lugares diferentes.
    function rscSectionHtml() {
        return `<section id="rscSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-award text-govbr-600 dark:text-unifesp-400"></i> RSC-PCCTAE</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">${t('tab_config.rsc_descricao', 'Reconhecimento de Saberes e Competências (Decreto nº 13.048/2026). Quando habilitado, cada item elegível ganha uma camada com os dados do RSC, e surge a aba <strong>RSC</strong> (simulador) — os dados da pessoa servidora (cargo, SIAPE, contatos etc.) são preenchidos lá. Uso individual.')}</p>
            <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" id="rscEnable" ${state.rsc.enabled ? 'checked' : ''}>
                <span>${t('tab_config.habilitar_modulo_rsc', 'Habilitar módulo <strong>RSC-PCCTAE</strong>')}</span>
            </label>
        </section>`;
    }
    function wireRscConfig() {
        const en = $('#rscEnable'); if (!en) return;
        en.addEventListener('change', () => {
            state.rsc.enabled = en.checked;
            const s = Storage.loadSettings(); s.rscEnabled = state.rsc.enabled; Storage.saveSettings(s);
            window.AppCore.persistirRsc();
            window.AppCore.applyRscVisibility();
            toast(state.rsc.enabled ? t('tab_config.rsc_habilitado', 'Módulo RSC habilitado.') : t('tab_config.rsc_desabilitado', 'Módulo RSC desabilitado.'), 'ok');
        });
    }

    /* --------------------- Configuração da Súmula FAPESP -------------------- */
    // Mesmo mecanismo do RSC acima: aqui só o habilitar/desabilitar do
    // módulo — os links (ORCID/Lattes/Web of Science/Google Scholar) e o
    // texto da súmula ficam na própria aba Súmula FAPESP (ver tab-sumula.js).
    function sumulaSectionHtml() {
        return `<section id="sumulaSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-file-lines text-govbr-600 dark:text-unifesp-400"></i> Súmula Curricular FAPESP</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">${t('tab_config.sumula_descricao', 'Gera, a partir do catálogo, uma base de texto organizada no modelo de Súmula Curricular exigido pela FAPESP em processos de bolsas/auxílios (não é um documento oficial pronto para submissão — é um ponto de partida a revisar e ajustar). Quando habilitado, surge a aba <strong>Súmula FAPESP</strong>.')}</p>
            <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" id="sumulaEnable" ${state.sumula.enabled ? 'checked' : ''}>
                <span>${t('tab_config.habilitar_modulo_sumula', 'Habilitar módulo <strong>Súmula Curricular FAPESP</strong>')}</span>
            </label>
        </section>`;
    }
    function wireSumulaConfig() {
        const en = $('#sumulaEnable'); if (!en) return;
        en.addEventListener('change', () => {
            state.sumula.enabled = en.checked;
            const s = Storage.loadSettings(); s.sumulaEnabled = state.sumula.enabled; Storage.saveSettings(s);
            window.AppCore.persistirSumula();
            window.AppCore.applySumulaVisibility();
            toast(state.sumula.enabled ? t('tab_config.sumula_habilitada', 'Módulo Súmula Curricular FAPESP habilitado.') : t('tab_config.sumula_desabilitada', 'Módulo Súmula Curricular FAPESP desabilitado.'), 'ok');
        });
    }

    // Mesmo mecanismo do RSC acima (checkbox mostra/oculta a aba): padrão
    // desmarcada na primeira utilização, e — como RSC/Súmula — fica como a
    // pessoa deixou até ser trocada de novo (ver comentário em
    // app-core.js/state.pubWebEnabled).
    function pubWebSectionHtml() {
        return `<section id="pubWebSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-globe text-govbr-600 dark:text-unifesp-400"></i> ${esc(t('tab_config.publicar_web_titulo', 'Publicar na Web'))}</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">${t('tab_config.publicar_web_descricao', 'Gera uma página pública do currículo (com o que estiver marcado como "pública") e permite publicá-la num site. Desabilitar aqui só esconde a aba <strong>Publicar</strong> — nada é apagado.')}</p>
            <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" id="pubWebEnable" ${state.pubWebEnabled ? 'checked' : ''}>
                <span>${t('tab_config.habilitar_aba_publicar', 'Habilitar aba <strong>Publicar na Web</strong>')}</span>
            </label>
        </section>`;
    }
    function wirePubWebConfig() {
        const en = $('#pubWebEnable'); if (!en) return;
        en.addEventListener('change', () => {
            state.pubWebEnabled = en.checked;
            const s = Storage.loadSettings(); s.pubWebEnabled = state.pubWebEnabled; Storage.saveSettings(s);
            window.AppCore.persistirGeral();
            window.AppCore.applyPublicarVisibility();
            toast(state.pubWebEnabled ? t('tab_config.publicar_web_habilitada', 'Aba "Publicar na Web" habilitada.') : t('tab_config.publicar_web_desabilitada', 'Aba "Publicar na Web" desabilitada.'), 'ok');
        });
    }
    // Duas listas configuráveis que a aba "Linha do tempo" usa para montar a
    // nuvem de palavras: palavras a excluir (nunca aparecem) e termos de mais
    // de uma palavra (ex.: "tech talks") que devem ser contados como um único
    // termo, em vez de "tech" e "talks" separados.
    function nuvemPalavrasSectionHtml() {
        return `
        <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-cloud text-govbr-600 dark:text-unifesp-400"></i> ${esc(t('tab_config.nuvem_palavras_titulo', 'Nuvem de palavras'))}</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">${t('tab_config.nuvem_palavras_descricao', 'Personalize a nuvem de palavras da aba <strong>Gráficos</strong>, montada a partir dos títulos, palavras-chave e área de conhecimento dos seus itens.')}</p>
            <div class="mb-3">
                <label class="block text-xs font-semibold mb-1" for="nuvemExclusaoInput">${esc(t('tab_config.palavras_excluidas', 'Palavras excluídas'))}</label>
                <textarea id="nuvemExclusaoInput" rows="2" placeholder="${esc(t('tab_config.separador_placeholder', 'Separe por ponto e vírgula (;), vírgula (,) ou uma por linha'))}" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">${esc((state.linhaTempo.nuvemExclusao || []).join('; '))}</textarea>
                <p class="text-xs text-gray-500 mt-1">${esc(t('tab_config.palavras_excluidas_ajuda', 'Termos que nunca devem aparecer na nuvem (ex.: uma sigla genérica, o nome da sua instituição). Separe por ponto e vírgula, vírgula ou quebra de linha.'))}</p>
            </div>
            <div class="mb-3">
                <label class="block text-xs font-semibold mb-1" for="nuvemCompostasInput">${esc(t('tab_config.palavras_compostas', 'Palavras compostas'))}</label>
                <textarea id="nuvemCompostasInput" rows="2" placeholder="${esc(t('tab_config.separador_placeholder_composta', 'Separe por ponto e vírgula (;), vírgula (,) ou uma por linha — ex.: tech talks; machine learning'))}" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">${esc((state.linhaTempo.nuvemCompostas || []).join('; '))}</textarea>
                <p class="text-xs text-gray-500 mt-1">${esc(t('tab_config.palavras_compostas_ajuda', 'Termos de mais de uma palavra que devem aparecer juntos na nuvem (ex.: "tech talks"), em vez de contados palavra a palavra. Separe por ponto e vírgula, vírgula ou quebra de linha.'))}</p>
            </div>
            <button id="btnSalvarNuvemListas" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-floppy-disk mr-1"></i> ${esc(t('tab_config.salvar_listas_nuvem', 'Salvar listas da nuvem'))}</button>
        </section>`;
    }
    function wireNuvemPalavrasSection() {
        const btn = $('#btnSalvarNuvemListas'); if (!btn) return;
        // Aceita ponto e vírgula, vírgula OU quebra de linha como separador —
        // um usuário reportou que a lista "não reconfigurava" a nuvem porque
        // separou os termos por vírgula/linha em vez de ";"; como só ";" era
        // reconhecido, a entrada inteira virava um único "termo" gigante que
        // nunca batia com nenhuma palavra real da nuvem.
        const parseLista = (v) => v.split(/[;,\n]+/).map(s => s.trim()).filter(Boolean);
        btn.addEventListener('click', () => {
            state.linhaTempo.nuvemExclusao = parseLista($('#nuvemExclusaoInput').value);
            state.linhaTempo.nuvemCompostas = parseLista($('#nuvemCompostasInput').value);
            const s = Storage.loadSettings();
            s.nuvemExclusao = state.linhaTempo.nuvemExclusao;
            s.nuvemCompostas = state.linhaTempo.nuvemCompostas;
            Storage.saveSettings(s);
            window.AppCore.persistirNuvem();
            toast(t('tab_config.listas_nuvem_salvas', 'Listas da nuvem de palavras salvas.'), 'ok');
        });
    }

    // Grupos de Configurações — fonte única usada tanto pelos títulos de
    // página (cfgGroup) quanto pelo menu lateral (cfgSidebarHtml), pra manter
    // os dois sempre em sincronia (mesma ordem, mesmo ícone, mesmo id).
    const CFG_GROUPS = [
        { id: 'grp-armazenamento', icon: 'fa-folder-tree', label: t('tab_config.grupo_armazenamento', 'Armazenamento') },
        { id: 'grp-importar', icon: 'fa-file-import', label: t('tab_config.importar', 'Importar') },
        { id: 'grp-exportar', icon: 'fa-file-export', label: t('tab_config.exportar', 'Exportar') },
        { id: 'grp-opcionais', icon: 'fa-puzzle-piece', label: t('tab_config.grupo_opcionais', 'Recursos opcionais') },
        { id: 'grp-modulos', icon: 'fa-layer-group', label: t('tab_config.grupo_modulos', 'Módulos') },
        { id: 'grp-risco', icon: 'fa-triangle-exclamation', label: t('tab_config.grupo_risco', 'Zona de risco') },
    ];
    // Cabeçalho de grupo das Configurações (título dentro da própria página) —
    // recebe uma entrada de CFG_GROUPS.
    function cfgGroup(g) {
        return `<h2 id="${g.id}" class="lg:col-span-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2 pt-1 pb-1 border-b border-gray-200 dark:border-gray-700"><i class="fa-solid ${g.icon}"></i> ${esc(g.label)}</h2>`;
    }

    // Menu lateral de Configurações: as 6 seções viram páginas independentes
    // (só uma visível por vez, ver render()) — clicar troca qual está ativa
    // (state.ui.cfgActiveGroup) e re-renderiza. No celular vira uma barra
    // horizontal rolável (ver .cfg-sidebar no CSS/classes abaixo).
    function cfgSidebarHtml(activeId) {
        return `
        <nav aria-label="Seções de Configurações" class="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible lg:w-48 lg:shrink-0">
            ${CFG_GROUPS.map(g => `
                <button type="button" data-cfg-page-link="${g.id}" aria-current="${g.id === activeId ? 'page' : 'false'}" class="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-left whitespace-nowrap ${g.id === activeId ? 'bg-govbr-600 dark:bg-unifesp-700 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}">
                    <i aria-hidden="true" class="fa-solid ${g.icon}"></i> ${esc(g.label)}
                </button>`).join('')}
        </nav>`;
    }
    // Troca a seção ativa do menu lateral — reusa render() inteiro (mesmo
    // padrão já usado por outras ações de Configurações), então toda a
    // wiring das seções continua funcionando sem duplicar lógica aqui.
    function wireCfgSidebar() {
        $$('[data-cfg-page-link]').forEach(b => b.addEventListener('click', () => {
            const groupId = b.dataset.cfgPageLink;
            // Trava real (não só visual): mesmo que o botão desabilitado
            // seja clicado por algum outro caminho, sem diretório
            // configurado a troca de página não acontece (mesmo padrão do
            // guard de switchTab() em app.js).
            if (window.AppCore.cfgGroupGated(groupId)) {
                toast(t('app.diretorio_necessario_toast', 'Configure um diretório de armazenamento em Configurações › Armazenamento antes de usar esta seção.'), 'aviso');
                return;
            }
            state.ui.cfgActiveGroup = groupId;
            render();
        }));
    }

    // Uma linha da lista da Lixeira: título, categoria, há quantos dias foi
    // excluído, e os botões de Restaurar / Excluir definitivamente.
    function trashItemRowHtml(item) {
        const dias = Math.max(0, Math.floor((Date.now() - new Date(item.deletedAt).getTime()) / 86400000));
        return `<li class="flex items-center justify-between gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm">
            <div class="min-w-0">
                <div class="font-medium truncate">${esc(LattesTypes.itemTitle(item))}</div>
                <div class="text-xs text-gray-500">${esc(LattesTypes.categoryLabel(item.categoryKey))} · ${esc(tp('tab_config.excluido_ha_dias', dias, { um: 'excluído há {n} dia', outros: 'excluído há {n} dias' }))}</div>
            </div>
            <div class="flex gap-1.5 shrink-0">
                <button data-restaurar="${item.id}" class="px-2.5 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-xs whitespace-nowrap"><i class="fa-solid fa-rotate-left mr-1"></i> ${esc(t('app.restaurar', 'Restaurar'))}</button>
                <button data-purgar="${item.id}" class="px-2.5 py-1.5 rounded border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 text-xs whitespace-nowrap"><i class="fa-solid fa-trash mr-1"></i> ${esc(t('tab_config.excluir_definitivamente', 'Excluir definitivamente'))}</button>
            </div>
        </li>`;
    }
    function lixeiraSectionHtml() {
        return `
            <section class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h2 class="text-lg font-bold mb-2 flex items-center gap-2">
                    <i class="fa-solid fa-trash-can text-govbr-600 dark:text-unifesp-400"></i> ${esc(t('tab_config.lixeira_titulo', 'Lixeira'))} <span class="text-sm font-normal text-gray-500">(${state.catalogo.trash.length})</span>
                </h2>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">${t('tab_config.lixeira_descricao', 'Itens excluídos ficam aqui por até {dias} dias antes de serem removidos definitivamente. Os arquivos (quando há diretório configurado) vão para a pasta “{pasta}”, não são apagados na hora.', { dias: window.AppCore.TRASH_RETENTION_DIAS, pasta: esc(LattesTypes.lixeiraFolder()) })}</p>
                ${state.catalogo.trash.length ? `
                <div class="flex justify-end mb-2">
                    <button id="btnEsvaziarLixeira" class="px-3 py-1.5 rounded border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 text-xs"><i class="fa-solid fa-trash mr-1"></i> ${esc(t('tab_config.esvaziar_lixeira', 'Esvaziar lixeira'))}</button>
                </div>
                <ul class="space-y-2">${state.catalogo.trash.map(trashItemRowHtml).join('')}</ul>` : `
                <p class="text-sm text-gray-500 italic">${esc(t('tab_config.lixeira_vazia', 'A lixeira está vazia.'))}</p>`}
            </section>`;
    }
    function wireLixeiraSection() {
        $$('[data-restaurar]').forEach(b => b.addEventListener('click', async () => {
            await window.AppCore.restoreItem(b.dataset.restaurar);
            toast(t('tab_config.item_restaurado', 'Item restaurado.'), 'ok');
            window.AppCore.renderItemList();
            render();
        }));
        $$('[data-purgar]').forEach(b => b.addEventListener('click', async () => {
            const item = state.catalogo.trash.find(i => i.id === b.dataset.purgar);
            if (item && !confirm(t('tab_config.confirmar_excluir_definitivo', 'Excluir definitivamente "{titulo}"? Esta ação não pode ser desfeita.', { titulo: LattesTypes.itemTitle(item) }))) return;
            await window.AppCore.purgeTrashItem(b.dataset.purgar);
            toast(t('tab_config.item_excluido_definitivo', 'Item excluído definitivamente.'), 'ok');
            render();
        }));
        const btnEmpty = $('#btnEsvaziarLixeira');
        if (btnEmpty) btnEmpty.addEventListener('click', async () => {
            if (!confirm(t('tab_config.confirmar_esvaziar_lixeira', 'Excluir definitivamente os {n} item(ns) da lixeira? Esta ação não pode ser desfeita.', { n: state.catalogo.trash.length }))) return;
            await window.AppCore.emptyTrash();
            toast(t('tab_config.lixeira_esvaziada', 'Lixeira esvaziada.'), 'ok');
            render();
        });
    }

    // Banner de migração local→Drive pendente (issue #140, item 3): aparece
    // sempre que Storage.loadPendingGDriveMigration() encontra uma migração
    // que começou a copiar mas não chegou a ser confirmada — a decisão de UX
    // pra recuperação/retomada que faltava (aba fechada/travada no meio da
    // cópia não deixava rastro nenhum antes disso). "Retomar" reconecta na
    // MESMA pasta do Drive (sem passar pelo seletor de novo) e refaz a
    // cópia — idempotente, então arquivos já copiados só são sobrescritos,
    // não duplicados. "Descartar" só apaga o aviso; a pasta local continua
    // sendo usada normalmente (nada precisa ser desfeito de verdade).
    function pendingGDriveMigrationHtml() {
        const pendente = Storage.loadPendingGDriveMigration();
        if (!pendente) return '';
        return `<div id="gdriveMigrationPendente" class="text-sm mt-3 p-3 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
            <p><i aria-hidden="true" class="fa-solid fa-triangle-exclamation mr-1"></i> ${t('tab_config.migracao_gdrive_pendente', 'Uma migração para o Google Drive (pasta "{pasta}") ficou incompleta — a pasta local ainda é a que está em uso. A pasta do Drive pode ter recebido uma cópia parcial dos arquivos.', { pasta: esc(pendente.pasta) })}</p>
            <div class="flex flex-wrap gap-2 mt-2">
                <button id="btnResumeGDriveMigration" class="px-3 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-xs"><i class="fa-solid fa-rotate-right mr-1"></i> ${esc(t('tab_config.retomar_migracao', 'Retomar migração'))}</button>
                <button id="btnDiscardGDriveMigration" class="px-3 py-1.5 rounded border border-amber-400 dark:border-amber-600 text-xs">${esc(t('tab_config.descartar_aviso', 'Descartar aviso'))}</button>
            </div>
            <p id="gdriveMigrationPendenteStatus" class="text-xs mt-1"></p>
        </div>`;
    }

    // Corpo comum da migração local→Drive (issue #140, item 3): cria a
    // estrutura de pastas, copia os arquivos e SÓ ENTÃO confirma o Drive
    // como back-end ativo (Storage.commitGDriveConnection) — chamada tanto
    // por uma migração nova quanto por "Retomar migração", depois que o
    // chamador já deixou gdriveCfg/mode apontando pro Drive (via
    // connectGoogleDrive({ deferCommit: true }) ou resumeGDriveConnection())
    // e já salvou a migração pendente. Numa falha no meio da cópia, desfaz a
    // conexão em memória (volta pro local) mas MANTÉM a migração pendente
    // salva, pra "Retomar migração" aparecer de novo da próxima vez.
    async function runGDriveMigrationCopy(statusEl) {
        try {
            await Storage.ensureSubdirs(LattesTypes.allFolders()); // cria a estrutura de pastas
            try { await Storage.ensureInbox(); } catch (_) {}      // garante a subpasta "Processados" da Caixa de Entrada
            if (statusEl) statusEl.innerHTML = `<span class="text-gray-500">${esc(t('tab_config.copiando_local_para_drive', 'Copiando arquivos da pasta local para o Google Drive…'))}</span>`;
            const copiados = await Storage.migrateLocalToGoogleDrive((n, name) => {
                if (statusEl) statusEl.innerHTML = `<span class="text-gray-500">${esc(t('tab_config.copiando_progresso', 'Copiando arquivos… ({n} até agora — {nome})', { n, nome: name }))}</span>`;
            });
            Storage.commitGDriveConnection(); // só agora o Drive vira o back-end ativo de verdade (persistido)
            state.dirHealth = null; // acabou de trocar de armazenamento; revalidada no próximo render
            let msg = t('tab_config.migracao_concluida', 'Migração concluída: {n} arquivo(s) copiado(s) para o Google Drive.', { n: copiados });
            let tipoToast = 'ok';
            let detalhesFalha = null;
            try {
                if (statusEl) statusEl.innerHTML = statusSincronizandoHtml(0);
                const { encontrados, falhas, detalhes } = await window.AppCore.syncFromDirectory((n) => {
                    if (statusEl) statusEl.innerHTML = statusSincronizandoHtml(n);
                });
                if (encontrados) msg += ' ' + t('tab_config.itens_sincronizados', '{n} item(ns) sincronizado(s).', { n: encontrados });
                if (falhas) { msg += ' ' + t('tab_config.atencao_itens_nao_lidos', 'Atenção: {n} item(ns) não puderam ser lidos — veja os detalhes na tela.', { n: falhas }); tipoToast = 'aviso'; detalhesFalha = detalhes; }
            } catch (_) {}
            toast(msg, tipoToast);
            gdriveMigrationNotice = t('tab_config.migracao_notice', 'Migração concluída. A partir de agora, todas as atualizações do lattesZen ocorrem no Google Drive — a pasta local não será mais usada pelo app. Confira na pasta do Drive se os arquivos foram copiados corretamente; depois disso, a pasta local pode ser excluída com segurança.');
            window.AppCore.renderItemList();
            await render();
            mostrarAvisoFalhasSync($('#syncStatus'), detalhesFalha);
        } catch (e) {
            Storage.discardGDriveConnection();
            toast(t('tab_config.falha_migracao', 'Falha na migração — a pasta local continua sendo usada normalmente. {erro}', { erro: e.message }), 'erro');
            render(); // já mostra o banner "migração pendente" (Retomar/Descartar) em vez do estado antigo
        }
    }

    async function render() {
        window.AppCore.updateHeaderIdentity(); // reflete edições no nome (Identificação, import, limpar catálogo…)
        window.AppCore.applyDirGate(); // reflete escolher/esquecer pasta, conectar/migrar Google Drive etc. nas abas travadas
        const panel = $('#tab-config');
        const dirName = Storage.hasDirectory() ? await Storage.directoryName() : null;
        const storageMode = Storage.storageMode();
        // Reconfere a saúde da pasta (silencioso) toda vez que a aba é aberta,
        // pra manter o status em dia sem precisar clicar em "Verificar pasta".
        if (Storage.hasDirectory()) await window.AppCore.checkDirHealth();

        // Sem diretório configurado ainda: assistente guiado (passo a passo)
        // em vez da parede de botões — pergunta primeiro configuração ou já
        // tem um diretório, depois local ou remoto, só então mostra a ação
        // certa. Com um diretório já ativo, pula direto pro painel de estado
        // (pasta atual + botões de gerenciar), como sempre foi.
        const semDiretorio = !Storage.hasDirectory();
        const modoBtn = (val, label) => `<button type="button" data-wizard-modo="${val}" aria-pressed="${dirWizardModo === val}" class="px-3 py-2 rounded text-sm border ${dirWizardModo === val ? 'bg-govbr-600 dark:bg-unifesp-700 text-white border-govbr-600 dark:border-unifesp-700' : 'border-gray-300 dark:border-gray-600'}">${esc(label)}</button>`;
        const tipoBtn = (val, label) => `<button type="button" data-wizard-tipo="${val}" aria-pressed="${dirWizardTipo === val}" class="px-3 py-2 rounded text-sm border ${dirWizardTipo === val ? 'bg-govbr-600 dark:bg-unifesp-700 text-white border-govbr-600 dark:border-unifesp-700' : 'border-gray-300 dark:border-gray-600'}">${esc(label)}</button>`;

        let dirSectionHtml;
        if (semDiretorio) {
            // Numeração dinâmica dos passos: o prefixo só existe no caminho
            // "Primeira configuração" (item 2 abaixo), então "Onde ficam os
            // arquivos?" é o passo 2 em "Já tenho um diretório" e o passo 3
            // em "Primeira configuração" — sem isso, os números fixos do
            // texto ficariam errados dependendo do caminho escolhido.
            let passo = 1;
            const temGDrivePickerKey = !!APP_CONFIG.googlePickerApiKey;
            let html = `
                <p class="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full px-2.5 py-1 mb-3">
                    <i aria-hidden="true" class="fa-solid fa-triangle-exclamation"></i> ${esc(t('tab_config.diretorio_nao_configurado', 'Diretório: Não configurado ainda'))}
                </p>
                <div class="mb-3">
                    <p class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">${passo++}. ${esc(t('tab_config.wizard_pergunta_1', 'Isto é uma primeira configuração, ou você já tem um diretório (local ou no Drive) com itens?'))}</p>
                    <div class="flex flex-wrap gap-2">
                        ${modoBtn('novo', t('tab_config.primeira_configuracao', 'Primeira configuração'))}
                        ${modoBtn('existente', t('tab_config.ja_tenho_diretorio', 'Já tenho um diretório'))}
                    </div>
                </div>`;
            // Prefixo do identificador dos arquivos: só faz sentido definir ao
            // criar um diretório NOVO (é gravado nos nomes dos arquivos desde
            // o primeiro item). Escolhendo "Já tenho um diretório", os
            // arquivos existentes já têm o prefixo deles — não há nada a
            // definir aqui, e perguntar de novo só confundiria.
            if (dirWizardModo === 'novo') {
                html += `
                <div class="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 class="text-sm font-bold mb-1">${passo++}. ${esc(t('tab_config.prefixo_titulo', 'Prefixo do identificador dos arquivos'))}</h3>
                    <p class="text-xs text-gray-500 mb-2">${t('tab_config.prefixo_ajuda', 'Os arquivos são nomeados como <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">prefixo-XXX.pdf</code> (3 alfanuméricos). Prefixo de até 3 caracteres (letras minúsculas/números). Só precisa definir uma vez — depois de configurar o diretório, esta opção some daqui.')}</p>
                    <div class="flex items-center gap-2">
                        <input id="idPrefix" type="text" maxlength="3" value="${esc(state.idPrefix)}" class="w-20 text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 font-mono">
                        <span class="text-xs text-gray-500">${t('tab_config.exemplo_prefixo', 'Exemplo: <code id="idPrefixEx" class="bg-gray-200 dark:bg-gray-700 px-1 rounded">{prefixo}-k7p</code>', { prefixo: esc(state.idPrefix) })}</span>
                        <button id="btnSavePrefix" class="ml-auto px-3 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-floppy-disk mr-1"></i> ${esc(t('tab_config.salvar_prefixo', 'Salvar prefixo'))}</button>
                    </div>
                </div>
                <div class="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 class="text-sm font-bold mb-1">${passo++}. ${esc(t('tab_config.idioma_titulo', 'Idioma'))}</h3>
                    <p class="text-xs text-gray-500 mb-2">${esc(t('tab_config.idioma_ajuda', 'Idioma da estrutura de pastas e do restante do app. Só precisa definir uma vez, antes das pastas serem criadas — depois de configurar o diretório, esta opção some daqui.'))}</p>
                    <select id="wizLocale" class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                        ${window.AppCore.localesDisponiveis().map(loc => `<option value="${esc(loc)}" ${loc === state.locale ? 'selected' : ''}>${esc(window.AppCore.nomeLocale(loc))}</option>`).join('')}
                    </select>
                </div>`;
            }
            if (dirWizardModo) {
                html += `
                <div class="mb-3">
                    <p class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">${passo++}. ${esc(t('tab_config.onde_ficam_arquivos', 'Onde ficam os arquivos?'))}</p>
                    <div class="flex flex-wrap gap-2">
                        ${tipoBtn('local', t('tab_config.pasta_no_computador', 'Pasta no computador'))}
                        ${tipoBtn('remoto', 'Google Drive')}
                    </div>
                </div>`;
            }
            if (dirWizardModo && dirWizardTipo === 'local') {
                html += `
                <div class="flex flex-wrap gap-2">
                    <button id="btnChooseDir" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm" ${Storage.supportsFS ? '' : 'disabled'}><i class="fa-solid fa-folder mr-1"></i> ${esc(t('tab_config.escolher_pasta', 'Escolher pasta'))}</button>
                </div>
                ${Storage.supportsFS ? '' : `<p class="text-xs text-red-600 font-semibold mt-1">${esc(t('tab_config.pasta_local_nao_suportada', 'Pasta local não funciona neste navegador (em celular, nenhum navegador suporta — nem trocando de app; no computador, funciona só em Chrome ou Edge). Volte e escolha "Google Drive" em vez disso.'))}</p>`}
                ${dirWizardModo === 'existente' ? `<p class="text-xs text-gray-500 mt-1">${esc(t('tab_config.escolher_pasta_ajuda', '"Escolher pasta" abre o seletor do sistema — selecione a pasta que você já usa; o nome dela é usado automaticamente, não precisa digitar nada.'))}</p>` : ''}`;
            }
            if (dirWizardModo && dirWizardTipo === 'remoto') {
                const gdriveDisabled = !APP_CONFIG.googleDriveClientId || (dirWizardModo === 'existente' && !temGDrivePickerKey);
                html += `
                ${dirWizardModo === 'novo' ? `
                <div class="flex flex-wrap gap-2 mb-2">
                    <input id="gdrivePasta" type="text" placeholder="Pasta (ex.: lattesZen)" value="lattesZen" class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                </div>` : `
                <p class="text-xs text-gray-500 mb-2">${t('tab_config.gdrive_seletor_ajuda', 'Ao clicar, um seletor do Google Drive abre para você escolher a pasta que já usa — o nome dela é usado automaticamente, não precisa digitar nada.{avisoChave}', { avisoChave: temGDrivePickerKey ? '' : ` <span class="text-red-600 font-semibold">${esc(t('tab_config.picker_nao_configurado', 'Recurso ainda não configurado neste site (falta a Chave de API do Picker em config.js).'))}</span>` })}</p>`}
                <p class="text-xs text-gray-500 mb-2">
                    ${t('tab_config.gdrive_escopo_ajuda', 'O lattesZen só acessa os arquivos que ele mesmo cria (escopo <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">drive.file</code>) — nunca o restante do seu Drive.')}
                    ${APP_CONFIG.googleDriveClientId ? '' : `<span class="text-red-600 font-semibold">${esc(t('tab_config.client_id_nao_configurado', 'Recurso ainda não configurado neste site (falta o Client ID do Google Cloud Console em config.js).'))}</span>`}
                </p>
                <div class="flex flex-wrap gap-2">
                    <button id="btnGDriveConnect" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm" ${gdriveDisabled ? 'disabled' : ''}><i class="fa-brands fa-google mr-1"></i> ${dirWizardModo === 'existente' ? esc(t('tab_config.selecionar_pasta_conectar', 'Selecionar pasta existente e conectar')) : esc(t('tab_config.conectar_gdrive', 'Conectar ao Google Drive'))}</button>
                    ${dirWizardModo === 'existente' ? `<button id="btnGDriveMigrate" class="px-3 py-2 rounded border border-govbr-600 dark:border-unifesp-400 text-govbr-700 dark:text-unifesp-300 text-sm" ${gdriveDisabled ? 'disabled' : ''}><i class="fa-solid fa-cloud-arrow-up mr-1"></i> ${esc(t('tab_config.migrar_conectar', 'Migrar meus arquivos e conectar'))}</button>` : ''}
                </div>
                ${dirWizardModo === 'existente' ? `<p class="text-xs text-gray-500 mt-1">${t('tab_config.gdrive_existente_ajuda', '"Selecionar pasta existente e conectar" abre o seletor do Drive pra você escolher a pasta que já usa. "Migrar meus arquivos e conectar" pede pra você escolher a pasta local atual e copia tudo para a pasta do Drive escolhida no seletor (existente, ou nova pelo botão "Nova pasta" do próprio seletor) antes de trocar.')}</p>` : ''}
                <div id="gdriveStatus" class="text-sm mt-2"></div>`;
            }
            dirSectionHtml = html;
        } else {
            // Com um diretório já configurado (local ou Google Drive), a seção
            // "Armazenamento remoto (Google Drive)" não aparece mais aqui —
            // só faz sentido no assistente, antes de configurar (ou depois de
            // "Esquecer diretório de armazenamento"). "Pasta atual" já indica
            // qual back-end está em uso; pra trocar, o caminho é "Esquecer
            // diretório de armazenamento" e refazer o assistente (inclusive
            // pra migrar arquivos locais pro Drive).
            // "Escolher pasta" não aparece mais aqui: com um diretório já
            // configurado, o caminho pra trocar é "Esquecer diretório de
            // armazenamento" e refazer o assistente (mostrar o botão de novo
            // aqui era redundante e confundia com uma troca direta, que não
            // é o que ele faz).
            dirSectionHtml = `
                <p class="text-sm mb-1">${t('tab_config.pasta_atual', 'Pasta atual: <strong id="dirNameLbl">{nome}</strong>', { nome: esc(dirName) })}</p>
                <p class="text-sm mb-3" id="dirHealthStatus">${window.AppCore.dirHealthStatusHtml()}</p>
                <div class="flex flex-wrap gap-2">
                    <button id="btnSync" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-rotate mr-1"></i> ${esc(t('tab_config.sincronizar_diretorio', 'Sincronizar do diretório'))}</button>
                    <button id="btnCheckDir" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-stethoscope mr-1"></i> ${esc(t('tab_config.verificar_pasta', 'Verificar pasta'))}</button>
                    <button id="btnForget" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-link-slash mr-1"></i> ${esc(t('tab_config.esquecer_diretorio', 'Esquecer diretório de armazenamento'))}</button>
                </div>
                <div id="syncStatus" class="text-sm mt-2"></div>`;
        }

        // Cada seção vira uma "página" independente — só a ativa
        // (state.ui.cfgActiveGroup, lembrada durante a sessão) fica visível;
        // as outras 3 continuam no DOM só com `hidden`, então toda a wiring
        // abaixo (wireThemeSection, wireRscConfig...) continua funcionando
        // igual, sem precisar saber qual página está aberta.
        let cfgAtiva = state.ui.cfgActiveGroup || CFG_GROUPS[0].id;
        // Defensivo: se a página ativa ficou travada (ex.: "Esquecer
        // diretório de armazenamento" enquanto "Outros recursos" estava
        // aberta), volta pra "Armazenamento" em vez de renderizar uma
        // página que deveria estar bloqueada.
        if (window.AppCore.cfgGroupGated(cfgAtiva)) {
            cfgAtiva = CFG_GROUPS[0].id;
            state.ui.cfgActiveGroup = cfgAtiva;
        }
        panel.innerHTML = `
            <div class="flex flex-col lg:flex-row gap-6">
                ${cfgSidebarHtml(cfgAtiva)}
                <div class="flex-1 min-w-0 space-y-6">
                <div data-cfg-page="${CFG_GROUPS[0].id}" class="grid grid-cols-1 gap-6 ${cfgAtiva === CFG_GROUPS[0].id ? '' : 'hidden'}">
                ${cfgGroup(CFG_GROUPS[0])}
                <section id="dirSection" class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <h2 class="text-lg font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-folder-open text-govbr-600 dark:text-unifesp-400"></i> ${esc(t('tab_config.diretorio_armazenamento_titulo', 'Diretório de armazenamento'))}</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        ${t('tab_config.diretorio_armazenamento_desc', 'Cada item catalogado é salvo aqui como <code class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">ID.pdf</code> + <code class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">ID.json</code>.')}
                        ${Storage.supportsFS ? '' : `<span class="text-amber-700 dark:text-amber-400 font-semibold">${esc(t('tab_config.navegador_sem_pasta_local', 'Este navegador não suporta pasta local (celular, ou Safari/Firefox no computador) — use o Google Drive abaixo.'))}</span>`}
                    </p>
                    ${dirSectionHtml}
                    ${gdriveMigrationNotice ? `<div id="gdriveMigrationNotice" class="text-sm mt-3 p-3 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
                        <i class="fa-solid fa-triangle-exclamation mr-1"></i> ${esc(gdriveMigrationNotice)}
                        <button id="btnDismissGDriveNotice" class="block mt-1 text-xs underline">${esc(t('tab_config.entendi_dispensar', 'Entendi, dispensar'))}</button>
                    </div>` : ''}
                    ${pendingGDriveMigrationHtml()}
                </section>
                </div>

                <div data-cfg-page="${CFG_GROUPS[1].id}" class="grid grid-cols-1 gap-6 ${cfgAtiva === CFG_GROUPS[1].id ? '' : 'hidden'}">
                ${cfgGroup(CFG_GROUPS[1])}
                ${importarSectionHtml()}
                </div>

                <div data-cfg-page="${CFG_GROUPS[2].id}" class="grid grid-cols-1 gap-6 ${cfgAtiva === CFG_GROUPS[2].id ? '' : 'hidden'}">
                ${cfgGroup(CFG_GROUPS[2])}
                ${exportarSectionHtml(dirName)}
                </div>

                <div data-cfg-page="${CFG_GROUPS[3].id}" class="grid grid-cols-1 lg:grid-cols-2 gap-6 ${cfgAtiva === CFG_GROUPS[3].id ? '' : 'hidden'}">
                ${cfgGroup(CFG_GROUPS[3])}
                ${pubWebSectionHtml()}
                ${nuvemPalavrasSectionHtml()}

                <details id="detListasAutocomplete" class="lg:col-span-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <summary class="text-lg font-bold mb-2 flex items-center gap-2 cursor-pointer select-none">
                        <i aria-hidden="true" class="fa-solid fa-angle-right text-sm text-gray-400"></i>
                        <i class="fa-solid fa-list-check text-govbr-600 dark:text-unifesp-400"></i> ${esc(t('tab_config.listas_autocomplete_titulo', 'Listas de autocomplete'))}
                    </summary>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        ${t('tab_config.listas_autocomplete_desc', 'Listas de sugestões dos campos (Instituições, Financiadores/Agências, etc.). Valores já usados no catálogo aparecem automaticamente. Estas listas são <strong>apenas para visualização</strong> — a única forma de alterá-las é a função <strong>Renomear em todos os itens</strong>, garantindo consistência com os itens já lançados.')}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-start gap-2">
                        <i aria-hidden="true" class="fa-solid fa-wand-magic-sparkles text-govbr-600 dark:text-unifesp-400 mt-0.5"></i>
                        <span>${t('tab_config.renomear_ajuda', 'Para <strong>corrigir/normalizar</strong> um valor (ex.: padronizar o nome de uma instituição), use <strong>Renomear em todos os itens</strong> dentro de cada lista: o novo valor é aplicado a todos os itens que usam o antigo, e os arquivos JSON no diretório são regravados.')}</span>
                    </p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
                        ${AUTOCOMPLETE_KEYS.map(k => `
                            <details data-vockey="${k}" class="border border-gray-200 dark:border-gray-700 rounded">
                                <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium flex items-center gap-2">
                                    ${esc(VOCAB_LABELS[k] || k)}
                                    <span class="text-xs font-normal text-gray-500">(${collectSuggestions(k).length})</span>
                                </summary>
                                <div class="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-900/40">
                                    <p class="text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                                        <i aria-hidden="true" class="fa-solid fa-arrows-turn-right mr-1"></i> ${esc(t('tab_config.renomear_em_todos', 'Renomear em todos os itens'))}
                                    </p>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <select data-renfrom="${k}" class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 flex-1 min-w-[10rem]">
                                            <option value="">${esc(t('tab_config.valor_atual_opt', '— valor atual —'))}</option>
                                            ${collectSuggestions(k).map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}
                                        </select>
                                        <span class="text-gray-400" aria-hidden="true">→</span>
                                        <input type="text" data-rento="${k}" placeholder="${esc(t('tab_config.novo_valor_placeholder', 'Novo valor (normalizado)'))}" class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 flex-1 min-w-[10rem]">
                                        <button type="button" data-rename="${k}" class="px-3 py-1.5 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm whitespace-nowrap disabled:opacity-40" disabled>${esc(t('tab_config.aplicar', 'Aplicar'))}</button>
                                    </div>
                                    <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1" data-rencount="${k}"></p>
                                </div>
                                <div class="p-2">
                                    <p class="text-[11px] text-gray-500 dark:text-gray-400 mb-1"><i aria-hidden="true" class="fa-solid fa-eye mr-1"></i> ${t('tab_config.somente_leitura_ajuda', 'Somente leitura — use “Renomear” acima para alterar.')}</p>
                                    <textarea id="vocab-${k}" rows="6" readonly tabindex="-1" aria-label="${esc(t('tab_config.sugestoes_aria', 'Sugestões de {label} (somente leitura)', { label: VOCAB_LABELS[k] || k }))}" class="w-full text-sm px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-mono cursor-default resize-none focus:outline-none">${esc(collectSuggestions(k).join('\n'))}</textarea>
                                </div>
                            </details>`).join('')}
                    </div>
                </details>
                ${themeSectionHtml()}
                </div>

                <div data-cfg-page="${CFG_GROUPS[4].id}" class="grid grid-cols-1 lg:grid-cols-2 gap-6 ${cfgAtiva === CFG_GROUPS[4].id ? '' : 'hidden'}">
                ${cfgGroup(CFG_GROUPS[4])}
                ${rscSectionHtml()}
                ${sumulaSectionHtml()}
                </div>

                <div data-cfg-page="${CFG_GROUPS[5].id}" class="grid grid-cols-1 lg:grid-cols-2 gap-6 ${cfgAtiva === CFG_GROUPS[5].id ? '' : 'hidden'}">
                ${cfgGroup(CFG_GROUPS[5])}
                ${lixeiraSectionHtml()}
                <section class="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
                    <button id="btnClear" class="px-3 py-2 rounded bg-red-600 text-white text-sm"><i class="fa-solid fa-trash mr-1"></i> ${esc(t('tab_config.limpar_catalogo', 'Limpar catálogo (índice local)'))}</button>
                </section>
                </div>
                </div>
            </div>`;

        // Reaplica a trava aqui (não só no topo desta função): o menu
        // lateral acabou de ser recriado por innerHTML acima, então os
        // botões travados no topo (antes desta re-renderização) já não
        // existem mais — precisa rodar de novo sobre os novos.
        window.AppCore.applyDirGate();
        wireCfgSidebar();
        wireThemeSection();
        wireRscConfig();
        wireSumulaConfig();
        wirePubWebConfig();
        wireNuvemPalavrasSection();
        wireExportLattes();
        wireHelpIcons(panel);
        wireLixeiraSection();
        wireOrcidImport();
        $('#bibInput').addEventListener('change', onBibFileSelected);
        wireBibExport();
        wirePdfReportExport();
        $('#xmlInput').addEventListener('change', onXmlSelected);
        const idPrefixInput = $('#idPrefix');
        if (idPrefixInput) idPrefixInput.addEventListener('input', (e) => {
            $('#idPrefixEx').textContent = `${window.AppCore.sanitizePrefix(e.target.value)}-k7p`;
        });
        const btnSavePrefix = $('#btnSavePrefix');
        if (btnSavePrefix) btnSavePrefix.addEventListener('click', () => {
            state.idPrefix = window.AppCore.sanitizePrefix($('#idPrefix').value);
            const s = Storage.loadSettings(); s.idPrefix = state.idPrefix; Storage.saveSettings(s);
            window.AppCore.persistirGeral();
            toast(t('tab_config.prefixo_definido', 'Prefixo definido: "{prefixo}". Novos arquivos: {prefixo}-XXX.', { prefixo: state.idPrefix }), 'ok');
            render();
        });
        const wizLocale = $('#wizLocale');
        if (wizLocale) wizLocale.addEventListener('change', () => {
            state.locale = window.AppCore.setLocale(wizLocale.value);
            const s = Storage.loadSettings(); s.locale = state.locale; Storage.saveSettings(s);
            window.AppCore.persistirGeral();
            // lattes-types-*.js (rótulos de categoria/campo, nomes de pasta)
            // calcula tudo com t() UMA VEZ, no carregamento do script — bem
            // antes desta troca de idioma acontecer. setLocale() aqui só
            // afeta t() daqui pra frente nesta mesma página; os nomes de
            // pasta que serão criados ao clicar "Escolher pasta"/"Conectar"
            // (LattesTypes.allFolders()) continuariam vindo no idioma
            // antigo sem um reload, porque já foram computados no
            // carregamento. Recarrega pra tudo (inclusive nomes de pasta)
            // já nascer no idioma escolhido — guarda o passo atual do
            // assistente (ver dirWizardModo/dirWizardTipo acima) pra
            // reabrir exatamente onde a pessoa parou.
            try { sessionStorage.setItem('lz_wizard_restore', JSON.stringify({ modo: dirWizardModo, tipo: dirWizardTipo })); } catch (_) {}
            location.reload();
        });
        const btnChooseDir = $('#btnChooseDir');
        if (btnChooseDir) btnChooseDir.addEventListener('click', async () => {
            try {
                await Storage.chooseDirectory();
                await Storage.ensureSubdirs(LattesTypes.allFolders()); // cria a estrutura de pastas
                try { await Storage.ensureInbox(); } catch (_) {}      // garante a subpasta "Processados" da Caixa de Entrada
                state.dirHealth = null; // acabou de ser escolhida; revalidada no próximo render
                // Sincroniza na hora: se a pasta já tinha itens (ex.: pasta de
                // outro computador, ou reconfigurando após limpar o navegador),
                // o catálogo local não precisa esperar um clique extra em
                // "Sincronizar do diretório" pra aparecer.
                let msg = t('tab_config.diretorio_configurado', 'Diretório configurado (estrutura de pastas criada).');
                let tipoToast = 'ok';
                const originalChooseDirLabel = btnChooseDir.innerHTML;
                let detalhesFalha = null;
                try {
                    const { encontrados, configRestaurada, falhas, detalhes } = await window.AppCore.syncFromDirectory((n) => {
                        btnChooseDir.innerHTML = `<i aria-hidden="true" class="fa-solid fa-spinner fa-spin mr-1"></i> ${esc(t('tab_config.sincronizando_ate_agora', 'Sincronizando… ({n} até agora)', { n }))}`;
                    });
                    msg += encontrados
                        ? ' ' + t('tab_config.itens_ja_cadastrados_sincronizados', '{n} item(ns) já cadastrado(s) na pasta foram sincronizados automaticamente.', { n: encontrados })
                        : ' ' + t('tab_config.pasta_vazia_pronta', 'Pasta vazia — pronta para uso.');
                    if (configRestaurada) msg += ' ' + t('tab_config.config_tambem_restauradas', 'Configurações do sistema também restauradas.');
                    if (falhas) { msg += ' ' + t('tab_config.atencao_itens_nao_lidos_simples', 'Atenção: {n} item(ns) não puderam ser lidos.', { n: falhas }); tipoToast = 'aviso'; detalhesFalha = detalhes; }
                } catch (_) {
                } finally {
                    btnChooseDir.innerHTML = originalChooseDirLabel;
                }
                toast(msg, tipoToast);
                window.AppCore.renderItemList();
                await render();
                mostrarAvisoFalhasSync($('#syncStatus'), detalhesFalha);
            } catch (e) { if (e.name !== 'AbortError') toast(e.message, 'erro'); }
        });
        const btnSync = $('#btnSync');
        if (btnSync) btnSync.addEventListener('click', async () => {
            const originalSyncLabel = btnSync.innerHTML;
            try {
                const { encontrados, configRestaurada, falhas, detalhes } = await window.AppCore.syncFromDirectory((n) => {
                    btnSync.innerHTML = `<i aria-hidden="true" class="fa-solid fa-spinner fa-spin mr-1"></i> ${esc(t('tab_config.sincronizando_ate_agora', 'Sincronizando… ({n} até agora)', { n }))}`;
                });
                let msg = t('tab_config.arquivos_json_lidos', '{n} arquivo(s) .json lido(s) do diretório.{configTxt}', { n: encontrados, configTxt: configRestaurada ? ' ' + t('tab_config.config_atualizadas', 'Configurações do sistema atualizadas.') : '' });
                if (falhas) msg += ' ' + t('tab_config.atencao_itens_nao_lidos', 'Atenção: {n} item(ns) não puderam ser lidos — veja os detalhes na tela.', { n: falhas });
                toast(msg, falhas ? 'aviso' : 'ok');
                window.AppCore.renderItemList();
                await render();
                mostrarAvisoFalhasSync($('#syncStatus'), detalhes);
            } catch (e) { toast(e.message, 'erro'); }
            finally { btnSync.innerHTML = originalSyncLabel; }
        });
        // "Esquecer diretório de armazenamento" só existe com um diretório já
        // configurado (dirSectionHtml do ramo `else` acima) — sem diretório
        // ainda, não há o que esquecer.
        const btnForget = $('#btnForget');
        if (btnForget) btnForget.addEventListener('click', async () => {
            await Storage.forgetDirectory();
            state.dirHealth = null;
            dirWizardModo = null; dirWizardTipo = null; // volta o assistente pro início
            window.AppCore.renderDirBanner();
            toast(t('tab_config.diretorio_esquecido', 'Diretório esquecido — escolha um novo diretório ou pasta no Drive abaixo.'), 'ok');
            render();
        });
        $$('[data-wizard-modo]').forEach(btn => {
            btn.addEventListener('click', () => { dirWizardModo = btn.dataset.wizardModo; dirWizardTipo = null; render(); });
        });
        $$('[data-wizard-tipo]').forEach(btn => {
            btn.addEventListener('click', () => { dirWizardTipo = btn.dataset.wizardTipo; render(); });
        });
        const btnCheckDir = $('#btnCheckDir');
        if (btnCheckDir) btnCheckDir.addEventListener('click', async () => {
            await window.AppCore.checkDirHealth({ requestIfNeeded: true });
            if (state.dirHealth && state.dirHealth.ok) toast(t('tab_config.pasta_acessivel', 'Pasta acessível.'), 'ok');
            else toast(t('tab_config.pasta_nao_acessivel', 'Não foi possível acessar a pasta — verifique se ela ainda existe e se a permissão foi concedida.'), 'erro');
            render();
        });
        const btnGDriveConnect = $('#btnGDriveConnect');
        if (btnGDriveConnect) btnGDriveConnect.addEventListener('click', async () => {
            const existente = dirWizardModo === 'existente';
            const statusEl = $('#gdriveStatus');
            btnGDriveConnect.disabled = true;
            if (statusEl) statusEl.innerHTML = existente
                ? `<span class="text-gray-500">${esc(t('tab_config.conectando_existente', 'Conectando… (autorize na janela do Google e escolha sua pasta no seletor)'))}</span>`
                : `<span class="text-gray-500">${esc(t('tab_config.conectando_novo', 'Conectando… (autorize na janela do Google)'))}</span>`;
            try {
                const cfg = existente ? { pickExisting: true } : { pasta: $('#gdrivePasta').value.trim() || 'lattesZen' };
                const resultado = await Storage.connectGoogleDrive(cfg);
                if (!resultado) { btnGDriveConnect.disabled = false; if (statusEl) statusEl.innerHTML = ''; return; } // cancelou o seletor de pasta
                await Storage.ensureSubdirs(LattesTypes.allFolders()); // cria a estrutura de pastas
                try { await Storage.ensureInbox(); } catch (_) {}      // garante a subpasta "Processados" da Caixa de Entrada
                state.dirHealth = null; // acabou de conectar; revalidada no próximo render
                let msg = existente ? t('tab_config.conectado_pasta', 'Conectado à pasta "{pasta}" no Google Drive.', { pasta: resultado.pasta }) : t('tab_config.conectado_gdrive_novo', 'Conectado ao Google Drive (estrutura de pastas criada).');
                let tipoToast = 'ok';
                // Biblioteca grande + celular pode levar um tempo real pra
                // sincronizar (uma requisição por pasta/arquivo) — sem isto,
                // a tela ficava parada sem nenhum indício de que algo estava
                // acontecendo (pedido do Alexsandro: feedback de que a ação
                // está em andamento, com um contador — "Sincronizando…"
                // parado não deixa claro se travou ou se está funcionando).
                if (statusEl) statusEl.innerHTML = statusSincronizandoHtml(0);
                let detalhesFalha = null;
                try {
                    const { encontrados, configRestaurada, falhas, detalhes } = await window.AppCore.syncFromDirectory((n) => {
                        if (statusEl) statusEl.innerHTML = statusSincronizandoHtml(n);
                    });
                    msg += encontrados
                        ? ' ' + t('tab_config.itens_ja_cadastrados_sincronizados', '{n} item(ns) já cadastrado(s) na pasta foram sincronizados automaticamente.', { n: encontrados })
                        : ' ' + t('tab_config.pasta_vazia_pronta', 'Pasta vazia — pronta para uso.');
                    if (configRestaurada) msg += ' ' + t('tab_config.config_tambem_restauradas', 'Configurações do sistema também restauradas.');
                    if (falhas) { msg += ' ' + t('tab_config.atencao_itens_nao_lidos', 'Atenção: {n} item(ns) não puderam ser lidos — veja os detalhes na tela.', { n: falhas }); tipoToast = 'aviso'; detalhesFalha = detalhes; }
                } catch (_) {}
                toast(msg, tipoToast);
                window.AppCore.renderItemList();
                await render();
                mostrarAvisoFalhasSync($('#syncStatus'), detalhesFalha);
            } catch (e) {
                if (statusEl) statusEl.innerHTML = `<span class="text-red-700 dark:text-red-400"><i aria-hidden="true" class="fa-solid fa-triangle-exclamation mr-1"></i> ${esc(e.message)}</span>`;
                toast(t('tab_config.falha_conectar', 'Falha ao conectar: {erro}', { erro: e.message }), 'erro');
                btnGDriveConnect.disabled = false;
            }
        });
        const btnGDriveMigrate = $('#btnGDriveMigrate');
        if (btnGDriveMigrate) btnGDriveMigrate.addEventListener('click', async () => {
            const aviso = t('tab_config.aviso_migracao_gdrive', 'Isso copia TODOS os arquivos da pasta local atual para uma pasta no seu Google Drive (a pasta local não é apagada durante a cópia).\n\nAo terminar, o lattesZen passa a usar o Google Drive — TODAS as atualizações futuras (novos itens, edições, anexos) vão para lá, não mais para a pasta local.\n\nDepois de conferir que os arquivos foram copiados corretamente, você pode excluir a pasta local com segurança.\n\nDeseja continuar?');
            if (!confirm(aviso)) return;
            const statusEl = $('#gdriveStatus');
            btnGDriveMigrate.disabled = true;
            if (btnGDriveConnect) btnGDriveConnect.disabled = true;
            try {
                // No assistente (sem diretório ativo ainda), "Migrar meus
                // arquivos e conectar" ainda não tem uma pasta local pra
                // migrar — pede pra escolher agora, antes de conectar.
                if (!Storage.hasDirectory()) {
                    if (statusEl) statusEl.innerHTML = `<span class="text-gray-500">${esc(t('tab_config.escolha_pasta_local', 'Escolha a pasta local com os seus arquivos…'))}</span>`;
                    await Storage.chooseDirectory();
                }
                if (statusEl) statusEl.innerHTML = `<span class="text-gray-500">${esc(t('tab_config.conectando_destino', 'Conectando… (autorize na janela do Google e escolha a pasta de destino no seletor)'))}</span>`;
                // deferCommit: true — só passa a valer pra valer (persistido,
                // usado por restoreDirectory() no próximo boot) depois que a
                // cópia terminar com sucesso, lá em runGDriveMigrationCopy()
                // (ver comentário completo em Storage.connectGoogleDrive).
                const resultado = await Storage.connectGoogleDrive({ pickExisting: true, deferCommit: true });
                if (!resultado) { btnGDriveMigrate.disabled = false; if (btnGDriveConnect) btnGDriveConnect.disabled = false; if (statusEl) statusEl.innerHTML = ''; return; } // cancelou o seletor de pasta
                // Registra a migração como pendente ANTES de copiar — é o
                // que sobrevive a uma aba fechada/travada no meio do
                // caminho, permitindo "Retomar migração" depois (ver banner
                // em dirSectionHtml) em vez de recomeçar do zero.
                Storage.savePendingGDriveMigration(resultado);
                await runGDriveMigrationCopy(statusEl);
            } catch (e) {
                if (e.name === 'AbortError') { btnGDriveMigrate.disabled = false; if (btnGDriveConnect) btnGDriveConnect.disabled = false; return; } // cancelou o seletor de pasta
                Storage.discardGDriveConnection();
                toast(t('tab_config.falha_conectar_preparar_migracao', 'Falha ao conectar/preparar a migração: {erro}', { erro: e.message }), 'erro');
                btnGDriveMigrate.disabled = false;
                if (btnGDriveConnect) btnGDriveConnect.disabled = false;
            }
        });
        const btnDismissGDriveNotice = $('#btnDismissGDriveNotice');
        if (btnDismissGDriveNotice) btnDismissGDriveNotice.addEventListener('click', () => { gdriveMigrationNotice = null; render(); });

        // Migração pendente (issue #140, item 3): banner mostrado por
        // dirSectionHtml/pendingGDriveMigrationHtml() sempre que
        // Storage.loadPendingGDriveMigration() encontra uma migração que
        // começou a copiar mas não chegou a ser confirmada (ver
        // connectGoogleDrive({ deferCommit: true }) acima).
        const btnResumeGDriveMigration = $('#btnResumeGDriveMigration');
        if (btnResumeGDriveMigration) btnResumeGDriveMigration.addEventListener('click', async () => {
            const pending = Storage.loadPendingGDriveMigration();
            if (!pending) return;
            if (Storage.storageMode() !== 'local' || !Storage.hasDirectory()) {
                toast(t('tab_config.pasta_local_nao_configurada', 'A pasta local original não está mais configurada aqui — não é possível retomar automaticamente. Descarte este aviso e, se quiser, repita a migração escolhendo a pasta de novo.'), 'erro');
                return;
            }
            const statusEl = $('#gdriveMigrationPendenteStatus');
            btnResumeGDriveMigration.disabled = true;
            try {
                if (statusEl) statusEl.textContent = t('tab_config.reconectando_gdrive', 'Reconectando ao Google Drive…');
                await Storage.resumeGDriveConnection(pending);
                await runGDriveMigrationCopy(statusEl);
            } catch (e) {
                Storage.discardGDriveConnection();
                if (statusEl) statusEl.textContent = '';
                toast(t('tab_config.falha_retomar_migracao', 'Falha ao retomar a migração: {erro}', { erro: e.message }), 'erro');
                btnResumeGDriveMigration.disabled = false;
            }
        });
        const btnDiscardGDriveMigration = $('#btnDiscardGDriveMigration');
        if (btnDiscardGDriveMigration) btnDiscardGDriveMigration.addEventListener('click', () => {
            if (!confirm(t('tab_config.confirmar_descartar_migracao', 'Descartar o aviso de migração pendente? A pasta local continua sendo usada normalmente. Se a pasta do Google Drive já tiver recebido alguma cópia parcial, você pode apagá-la manualmente pelo drive.google.com — o lattesZen não vai tentar completá-la sozinho.'))) return;
            Storage.clearPendingGDriveMigration();
            toast(t('tab_config.aviso_migracao_descartado', 'Aviso de migração pendente descartado.'), 'ok');
            render();
        });

        $('#btnExport').addEventListener('click', exportCatalog);
        $('#importJson').addEventListener('change', importCatalog);
        $('#btnClear').addEventListener('click', () => {
            if (!confirm(t('tab_config.confirmar_limpar_catalogo', 'Isto apaga TODO o índice local no navegador — itens catalogados, rascunho, prévia de importação, listas de autocomplete e as configurações do RSC-PCCTAE e da Súmula FAPESP. Os arquivos no diretório NÃO são removidos. Continuar?'))) return;
            state.catalogo.items = [];
            window.AppCore.saveCatalog();
            window.AppCore.clearDraft();                 // rascunho não salvo (lz_draft)
            state.importacoes.lattes = null;    // prévia de importação do XML
            state.importacoes.orcid = null;     // prévia de importação do ORCID
            state.importacoes.bib = null;       // prévia de importação de BibTeX/RIS
            state.catalogo.editingId = null;       // sai de qualquer edição em curso
            state.catalogo.evEditing = [];         // evidências em edição
            state.vocab = {};             // listas de autocomplete (curadas)
            state.rsc.cfg = {};            // configuração do RSC-PCCTAE
            state.sumula.cfg = {};         // configuração da Súmula FAPESP
            state.sumula.texto = '';       // texto da Súmula FAPESP
            // Persiste a limpeza das listas, do RSC e da Súmula nas configurações.
            const s = Storage.loadSettings(); s.vocab = {}; s.rsc = {}; s.sumula = {}; s.sumulaTexto = ''; Storage.saveSettings(s);
            window.AppCore.persistirGeral();
            window.AppCore.persistirRsc();
            window.AppCore.persistirSumula();
            window.AppCore.resetBackupReminder();        // zera o contador de backup
            toast(t('tab_config.indice_limpo', 'Índice local limpo (itens, listas, RSC e Súmula FAPESP).'), 'ok');
            window.AppCore.renderItemList();
            render();               // re-renderiza a aba (Perfil, listas, RSC, contadores)
        });
        // Renomear/normalizar valores de autocomplete em todos os itens
        $$('[data-renfrom]').forEach(sel => {
            const k = sel.getAttribute('data-renfrom');
            const toEl = document.querySelector(`[data-rento="${k}"]`);
            const btn = document.querySelector(`[data-rename="${k}"]`);
            const cnt = document.querySelector(`[data-rencount="${k}"]`);
            const refresh = () => {
                const f = sel.value.trim();
                if (btn) btn.disabled = !f;
                if (cnt) cnt.textContent = f ? t('tab_config.itens_usam_valor', '{n} item(ns) usam este valor.', { n: itemsUsingValue(k, f).length }) : '';
            };
            sel.addEventListener('change', () => {
                if (toEl && sel.value.trim()) toEl.value = sel.value.trim(); // pré-preenche p/ editar
                refresh();
            });
            if (toEl) toEl.addEventListener('input', refresh);
            if (btn) btn.addEventListener('click', () => renameFieldValue(k, sel.value, toEl ? toEl.value : ''));
        });
        $('#btnCheckEnc').addEventListener('click', () => verificarCodificacao());
        $('#btnNormalize').addEventListener('click', () => normalizarPontuacao());
    }

    // Varre o catálogo procurando caracteres fora do ISO-8859-1
    function scanEncoding() {
        const problemas = [];
        state.catalogo.items.forEach(i => {
            const chars = new Set();
            Object.values(i.fields || {}).forEach(v => {
                LzEncoding.findNonLatin1(v).forEach(x => chars.add(x.ch));
            });
            if (chars.size) problemas.push({ item: i, chars: Array.from(chars) });
        });
        return problemas;
    }

    function verificarCodificacao() {
        const box = $('#encResult');
        const probs = scanEncoding();
        if (!probs.length) {
            box.innerHTML = `<p class="text-green-700 dark:text-green-400"><i class="fa-solid fa-circle-check"></i> ${esc(t('tab_config.todos_compativeis_iso', 'Todos os {n} itens são 100% compatíveis com ISO-8859-1. Prontos para exportar ao Lattes.', { n: state.catalogo.items.length }))}</p>`;
            return;
        }
        box.innerHTML = `
            <p class="text-amber-700 dark:text-amber-400 mb-2"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(t('tab_config.itens_fora_iso', '{n} item(ns) com caracteres fora do ISO-8859-1:', { n: probs.length }))}</p>
            <div class="space-y-1 max-h-60 overflow-y-auto">
                ${probs.map(p => `<div class="text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1">
                    <span class="font-medium">${esc(LattesTypes.itemTitle(p.item))}</span>
                    <span class="text-gray-500">${t('tab_config.caracteres_lista', '— caracteres: {lista}', { lista: p.chars.map(c => `<code>${esc(c)}</code>(U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')})`).join(' ') })}</span>
                </div>`).join('')}
            </div>
            <p class="text-xs text-gray-500 mt-2">${t('tab_config.normalizar_ajuda', 'Use “Normalizar pontuação” para converter os casos comuns. Os que restarem serão exportados como entidades numéricas XML (válidas no Lattes).')}</p>`;
    }

    async function normalizarPontuacao() {
        let alterados = 0;
        state.catalogo.items.forEach(i => {
            let changed = false;
            Object.keys(i.fields || {}).forEach(k => {
                const orig = i.fields[k];
                if (typeof orig === 'string') {
                    const norm = LzEncoding.normalizePunctuation(orig);
                    if (norm !== orig) { i.fields[k] = norm; changed = true; }
                }
            });
            if (changed) { i.updatedAt = window.AppCore.nowISO(); alterados++; }
        });
        if (!alterados) { toast(t('tab_config.nada_a_normalizar', 'Nada a normalizar — pontuação já compatível.'), 'ok'); verificarCodificacao(); return; }
        window.AppCore.saveCatalog();
        // regrava os JSON no diretório, se configurado
        if (Storage.hasDirectory()) {
            for (const i of state.catalogo.items) {
                try { await Storage.writeJson(i.id, i, LattesTypes.categoryFolder(i.categoryKey)); } catch (_) {}
            }
        }
        toast(t('tab_config.pontuacao_normalizada', 'Pontuação normalizada em {n} item(ns).', { n: alterados }), 'ok');
        window.AppCore.renderItemList();
        verificarCodificacao();
    }

    // (fileStamp — extraído para tab-config-shared.js)
    // Nome-base do backup: latteszen-<Nome completo>-<timestamp>
    // O nome vem do item de Identificação (Dados gerais); se não houver, omite.
    function catalogBaseName() {
        const id = state.catalogo.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo);
        const nome = id ? String(id.fields.titulo) : '';
        const safe = nome.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
        return safe ? `latteszen-${safe}-${fileStamp()}` : `latteszen-${fileStamp()}`;
    }

    async function exportCatalog() {
        const data = {
            app: 'lattesZen', version: APP_CONFIG.version, schemaVersion: window.AppCore.SCHEMA_VERSION, exportedAt: window.AppCore.nowISO(),
            items: state.catalogo.items,
            // Configurações do sistema (prefixo do identificador, listas de
            // autocomplete, RSC etc.) — sem isto, restaurar o backup num
            // navegador novo perde tudo que está em Configurações.
            settings: Storage.loadSettings(),
        };
        const nome = catalogBaseName();
        // Local padrão: subpasta "00 - Backup" dentro do diretório configurado
        if (Storage.hasDirectory()) {
            try {
                await Storage.writeJson(nome, data, LattesTypes.backupFolder());
                window.AppCore.resetBackupReminder();
                toast(t('tab_config.backup_salvo', 'Backup salvo em "{caminho}".', { caminho: `${LattesTypes.backupFolder()}/${nome}.json` }), 'ok');
                return;
            } catch (e) {
                toast(t('tab_config.falha_salvar_diretorio', 'Falha ao salvar no diretório: {erro} — baixando arquivo.', { erro: e.message }), 'aviso');
            }
        }
        // Sem diretório (ou falha): baixa o arquivo
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${nome}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        window.AppCore.resetBackupReminder();
    }

    // Higieniza um item vindo de JSON externo (integridade)
    function sanitizeImportedItem(i) {
        if (!Array.isArray(i.evidencias)) {
            i.evidencias = i.hasPdf ? [{ basename: i.id, ext: i.fileExt || 'pdf', name: i.pdfName || `${i.id}.pdf`, publica: true }] : [];
        }
        i.hasPdf = i.evidencias.length > 0;
        if (!i.categoryKey && i.typeKey) i.categoryKey = LattesTypes.primaryCategory(i.typeKey);
        i.schemaVersion = window.AppCore.SCHEMA_VERSION;
    }

    async function importCatalog(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const data = JSON.parse(await file.text());
            const items = Array.isArray(data) ? data : data.items;
            if (!Array.isArray(items)) throw new Error(t('tab_config.formato_invalido', 'Formato inválido.'));
            const byId = new Map(state.catalogo.items.map(i => [i.id, i]));
            items.forEach(i => { if (i && i.id) { sanitizeImportedItem(i); byId.set(i.id, i); } });
            state.catalogo.items = Array.from(byId.values());
            window.AppCore.saveCatalog();
            // Restaura as configurações do sistema, se presentes no backup (prefixo
            // do identificador, listas de autocomplete, RSC etc.) — essencial ao
            // restaurar num navegador novo, onde essas configurações não existem.
            let restaurouConfig = false;
            if (data.settings && typeof data.settings === 'object') {
                const merged = Object.assign(Storage.loadSettings(), data.settings);
                Storage.saveSettings(merged);
                state.vocab = merged.vocab || {};
                state.idPrefix = window.AppCore.sanitizePrefix(merged.idPrefix || 'lz');
                state.locale = window.AppCore.setLocale(merged.locale || state.locale);
                state.catalogo.lastCat = merged.lastCat || '';
                state.catalogo.lastType = merged.lastType || '';
                state.rsc.enabled = !!merged.rscEnabled;
                state.rsc.cfg = merged.rsc || {};
                window.AppCore.applyRscVisibility();
                state.sumula.enabled = !!merged.sumulaEnabled;
                state.sumula.cfg = merged.sumula || {};
                state.sumula.texto = merged.sumulaTexto || '';
                window.AppCore.applySumulaVisibility();
                state.pubWebEnabled = merged.pubWebEnabled !== undefined ? !!merged.pubWebEnabled : state.catalogo.items.length > 0;
                window.AppCore.applyPublicarVisibility();
                restaurouConfig = true;
            }
            toast(t('tab_config.itens_importados_json', '{n} item(ns) importado(s) do JSON.{sufixo}', { n: items.length, sufixo: restaurouConfig ? ' ' + t('tab_config.config_restauradas', 'Configurações do sistema restauradas.') : '' }), 'ok');
            window.AppCore.renderItemList();
            render();
        } catch (err) { toast(t('tab_config.falha_importar', 'Falha ao importar: {erro}', { erro: err.message }), 'erro'); }
        e.target.value = '';
    }

    // Publicado em AppCore: RENDERERS.config (ver app.js) usa TabConfig.render
    // diretamente; a exposição abaixo mantém o nome renderConfig, já usado
    // por tab-catalogar.js (renameFieldValue re-renderiza Configurações
    // após renomear um valor de autocomplete).
    window.AppCore.renderConfig = render;

    // aplicarTema exposta pra app.js reaplicar o tema restaurado do módulo
    // "acessibilidade" (ver syncFromDirectory), sem duplicar a lógica aqui.
    return { render, aplicarTema };
})();
