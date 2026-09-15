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
   lattesZen — "Relatório completo (PDF)" — cartão dentro de Configurações →
   Trazer e levar dados → Exportar
   --------------------------------------------------------------------------
   Extraído no mesmo padrão de tab-config-bibtex.js/tab-config-xml.js — só a
   UI e a wiring do botão vivem aqui; a montagem do PDF em si (capa, sumário,
   divisórias, mesclagem de evidências) é toda de pdf-report.js
   (window.LzPdfReport), pra manter a lógica pesada fora de tab-config.js.
   ========================================================================== */
import { dadosItemHtml, fileStamp } from './tab-config-shared.js';

const { state, $, toast } = window.AppCore;

export function pdfReportExportItemHtml() {
    return dadosItemHtml('fa-solid fa-file-pdf', 'Relatório completo (PDF)',
        'Um único arquivo PDF pronto para impressão/encadernação: capa, sumário com paginação, um Memorial (se você preencher um em Catalogar → Dados gerais), o currículo completo e, em anexo, as evidências marcadas como "pública" — mescladas de verdade dentro do PDF, não só citadas.', `
            <fieldset class="text-sm mb-2">
                <legend class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">O que incluir no currículo do relatório</legend>
                <label class="flex items-center gap-2 mb-1">
                    <input type="radio" name="pdfReportEscopo" id="pdfReportEscopoTodos" value="todos" checked>
                    Catálogo inteiro
                </label>
                <label class="flex items-center gap-2">
                    <input type="radio" name="pdfReportEscopo" id="pdfReportEscopoWeb" value="web">
                    Só os itens marcados para "Publicar na Web"
                </label>
            </fieldset>
            <button id="btnPdfReportGerar" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-file-pdf mr-1"></i> Gerar relatório (PDF)</button>
            <p id="pdfReportStatus" class="text-xs text-gray-500 mt-2"></p>`);
}

function baixarArquivoBinario(nome, bytes, mime) {
    const blob = new Blob([bytes], { type: mime });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; a.click();
    URL.revokeObjectURL(a.href);
}

export function wirePdfReportExport() {
    const btn = $('#btnPdfReportGerar');
    if (!btn) return;
    const status = (t) => { const el = $('#pdfReportStatus'); if (el) el.textContent = t; };
    btn.addEventListener('click', async () => {
        const incluirTodos = $('#pdfReportEscopoTodos').checked;
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Gerando relatório… (pode levar alguns segundos)';
        status('');
        try {
            // window.LzPdfReport pode nunca ter sido definido se js/pdf-report.js
            // falhou ao carregar (rede instável, ou uma extensão de
            // bloqueio de anúncios/rastreadores barrando o arquivo — o
            // nome "pdf-report" bate com filtros comuns desse tipo de
            // extensão). Sem esta checagem, o erro virava um TypeError
            // críptico ("Cannot read properties of undefined (reading
            // 'gerar')"), sem indicar a causa nem o que fazer.
            if (!window.LzPdfReport) {
                throw new Error('O gerador de PDF não carregou (js/pdf-report.js). Verifique sua conexão e se alguma extensão do navegador (bloqueador de anúncios/rastreadores) não está bloqueando o arquivo, depois recarregue a página.');
            }
            const bytes = await window.LzPdfReport.gerar({ incluirTodos });
            const nomeItem = state.catalogo.items.find((i) => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo);
            const safe = (nomeItem && nomeItem.fields.titulo ? nomeItem.fields.titulo : 'curriculo').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-').toLowerCase();
            const nomeArquivo = `relatorio-completo-${safe}-${fileStamp()}.pdf`;
            baixarArquivoBinario(nomeArquivo, bytes, 'application/pdf');
            // Além do download, guarda uma cópia na pasta "Relatórios" do
            // diretório configurado (local ou Google Drive) — essa pasta já
            // existia na estrutura criada por Storage.ensureSubdirs(), mas
            // nada gravava nela até agora. Não fatal: se falhar (permissão
            // perdida, sem conexão com o Drive...), o download já feito
            // continua valendo — só avisa, não derruba o "sucesso" geral.
            let salvoNoDiretorio = false, avisoDiretorio = '';
            if (Storage.hasDirectory()) {
                try {
                    await Storage.writeFile(nomeArquivo, bytes, LattesTypes.relatoriosFolder());
                    salvoNoDiretorio = true;
                } catch (e) {
                    avisoDiretorio = ` (baixado, mas não foi possível salvar na pasta "Relatórios": ${e.message})`;
                }
            }
            status(Storage.hasDirectory()
                ? `Relatório gerado${salvoNoDiretorio ? ' e salvo na pasta "Relatórios"' : avisoDiretorio}.`
                : 'Relatório gerado — sem diretório configurado, evidências em arquivo (PDF/imagem) não puderam ser anexadas (só evidências em link, se houver), e não há onde salvar uma cópia (só o download).');
            toast(`Relatório completo (PDF) gerado${salvoNoDiretorio ? ' e salvo na pasta "Relatórios"' : ''}.`, avisoDiretorio ? 'aviso' : 'ok');
        } catch (e) {
            status('');
            toast('Falha ao gerar o relatório: ' + e.message, 'erro');
        } finally {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    });
}
