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
   lattesZen — utilitário de acessibilidade: armadilha de foco para diálogos
   modais (issue #17)
   --------------------------------------------------------------------------
   firstRunModal (app.js) e o aviso de cookies (cookie-consent.js) já
   declaravam role="alertdialog"/aria-modal="true", mas nada de fato
   controlava o foco: ao abrir, o foco não ia pro diálogo; com Tab, dava
   pra sair dele e chegar em elementos da página por trás (que continuavam
   visíveis/clicáveis sob o overlay) — quem navega só por teclado ou usa
   leitor de tela não ficava de fato bloqueado pelo modal, diferente de
   quem usa mouse. Carregado ANTES de cookie-consent.js (ver ordem dos
   <script> em cada página) pra já estar disponível quando ele roda.
   ========================================================================== */
window.LzA11y = (function () {
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    // Prende o foco dentro de `container` enquanto o modal estiver aberto:
    // move o foco pro elemento em `initialFocus` (ou, sem ele, pro 1º
    // elemento focável em ordem do documento — que pode ser um link no meio
    // do texto, não necessariamente o botão principal; por isso vale passar
    // `initialFocus` explícito quando o modal tiver mais de 1 elemento
    // focável), faz Tab/Shift+Tab circularem só entre os elementos focáveis
    // de dentro, e chama `onEscape` (se houver) ao apertar Esc. Retorna
    // `release()`, que desliga tudo e devolve o foco pra quem estava
    // focado antes do modal abrir.
    function trapFocus(container, { onEscape, initialFocus } = {}) {
        const elementoAnterior = document.activeElement;

        function focaveisVisiveis() {
            return Array.from(container.querySelectorAll(FOCUSABLE))
                .filter((el) => el.offsetParent !== null || el === document.activeElement);
        }

        function onKeydown(e) {
            if (e.key === 'Escape' && onEscape) { onEscape(); return; }
            if (e.key !== 'Tab') return;
            const focaveis = focaveisVisiveis();
            if (!focaveis.length) { e.preventDefault(); return; }
            const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
            if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
            else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
        }

        document.addEventListener('keydown', onKeydown, true);

        const focaveis = focaveisVisiveis();
        (initialFocus || focaveis[0] || container).focus({ preventScroll: true });

        return function release() {
            document.removeEventListener('keydown', onKeydown, true);
            if (elementoAnterior && typeof elementoAnterior.focus === 'function') {
                elementoAnterior.focus({ preventScroll: true });
            }
        };
    }

    return { trapFocus };
})();
