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
   lattesZen — Utilidades compartilhadas entre os módulos de importação/exportação
   --------------------------------------------------------------------------
   Extraído de tab-config.js (issue de refatoração). Nenhuma mudança de
   conteúdo, só saiu do arquivo único original.
   ========================================================================== */
const { esc, toast, t } = window.AppCore;

    // Ícone de ajuda "(?)" — mostra a explicação num tooltip nativo ao passar
    // o mouse (atributo title), em vez de texto solto ocupando espaço na
    // tela (a pedido do usuário, pras páginas "Importar"/"Exportar"). Um
    // <button> de verdade (não um <i aria-hidden> solto, issue de
    // acessibilidade #17): alcançável por teclado, com nome acessível via
    // aria-label, e clicável — o clique mostra a mesma explicação num toast,
    // cobrindo tanto quem não usa mouse quanto telas de toque (sem hover) —
    // mesmo padrão do botão de ajuda do RSC (tab-rsc.js). Delegado uma
    // única vez em #tab-config (ver wireHelpIcons() no fim deste arquivo).
    function helpIcon(texto) {
        return `<button type="button" class="lz-help-btn text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-help" title="${esc(texto)}" data-help="${esc(texto)}" aria-label="${esc(t('tab_rsc.ajuda_aria', 'Ajuda'))}"><i aria-hidden="true" class="fa-regular fa-circle-question text-xs"></i></button>`;
    }
    // Liga o clique dos helpIcon() de dentro de `panel` (mostra um toast com
    // a explicação completa) uma única vez — nó estável entre re-renders,
    // mesmo padrão de delegação usado em tab-conformidade.js.
    export function wireHelpIcons(panel) {
        if (!panel || panel.dataset.helpDelegado) return;
        panel.dataset.helpDelegado = '1';
        panel.addEventListener('click', (e) => {
            const btn = e.target.closest('.lz-help-btn');
            if (btn) toast(btn.dataset.help, 'info');
        });
    }
    // Um item das páginas "Importar"/"Exportar":
    // ícone + rótulo + ajuda (?) no cabeçalho, corpo (inputs/botões) embaixo.
    // `icon` inclui o prefixo do estilo (ex.: "fa-solid fa-file-import" ou
    // "fa-brands fa-orcid" — ORCID usa o conjunto "brands", não "solid").
    export function dadosItemHtml(icon, label, ajuda, bodyHtml) {
        return `
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900">
                <h3 class="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <i aria-hidden="true" class="${icon} text-govbr-600 dark:text-unifesp-400"></i> ${esc(label)} ${helpIcon(ajuda)}
                </h3>
                ${bodyHtml}
            </div>`;
    }


    // Carimbo de data/hora para nomes de arquivo: AAAA-MM-DD_HHMMSS (hora local)
    export function fileStamp() {
        const d = new Date(); const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    }
