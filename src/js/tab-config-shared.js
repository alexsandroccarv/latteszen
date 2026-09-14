/* ==========================================================================
   lattesZen — Utilidades compartilhadas entre os módulos de importação/exportação
   --------------------------------------------------------------------------
   Extraído de tab-config.js (issue de refatoração). Nenhuma mudança de
   conteúdo, só saiu do arquivo único original.
   ========================================================================== */
const { esc } = window.AppCore;

    // Ícone de ajuda "(?)" — mostra a explicação num tooltip nativo ao passar
    // o mouse (atributo title), em vez de texto solto ocupando espaço na
    // tela (a pedido do usuário, pra seção "Trazer e levar dados").
    function helpIcon(texto) {
        return `<i aria-hidden="true" class="fa-regular fa-circle-question text-gray-400 dark:text-gray-500 text-xs cursor-help" title="${esc(texto)}"></i>`;
    }
    // Um item das colunas Importar/Exportar de "Trazer e levar dados":
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
