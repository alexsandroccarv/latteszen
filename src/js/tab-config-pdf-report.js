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

const { state, $, $$, esc, toast } = window.AppCore;

// Uma checkbox por categoria (01-21) — mesma trava rscOnly já usada em
// Catalogar (tab-catalogar.js: `.filter(c => !c.rscOnly || state.rsc.enabled)`),
// pra não oferecer as categorias do módulo RSC (Grupos de Pesquisa, Atuação
// em Crise de Saúde Pública) a quem não tem o módulo ligado — sempre
// ficariam vazias. Marcadas por padrão (Personalizado começa com "tudo").
function categoriasCheckboxesHtml() {
    return LattesTypes.categories
        .filter((c) => !c.rscOnly || state.rsc.enabled)
        .map((c) => `
            <label class="flex items-center gap-1.5">
                <input type="checkbox" class="pdfReportCategoria" value="${esc(c.key)}" checked>
                ${esc(c.num)}. ${esc(c.label)}
            </label>`).join('');
}

export function pdfReportExportItemHtml() {
    return dadosItemHtml('fa-solid fa-file-pdf', 'Relatório completo (PDF)',
        'Um único arquivo PDF pronto para impressão/encadernação: capa, sumário com paginação, um Memorial (se você preencher um em Catalogar → Dados gerais), o currículo completo e, em anexo, as evidências marcadas como "pública" — mescladas de verdade dentro do PDF, não só citadas.', `
            <fieldset class="text-sm mb-2">
                <legend class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Quais itens considerar</legend>
                <label class="flex items-center gap-2 mb-1">
                    <input type="radio" name="pdfReportEscopo" id="pdfReportEscopoTodos" value="todos" checked>
                    Catálogo inteiro
                </label>
                <label class="flex items-center gap-2">
                    <input type="radio" name="pdfReportEscopo" id="pdfReportEscopoWeb" value="web">
                    Só os itens marcados para "Publicar na Web"
                </label>
            </fieldset>
            <fieldset class="text-sm mb-2">
                <legend class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">O que incluir no relatório</legend>
                <label class="flex items-center gap-2 mb-1">
                    <input type="radio" name="pdfReportConteudo" id="pdfReportConteudoCompleto" value="completo" checked>
                    Currículo completo (com evidências)
                </label>
                <label class="flex items-center gap-2 mb-1">
                    <input type="radio" name="pdfReportConteudo" id="pdfReportConteudoSemEvidencias" value="sem-evidencias">
                    Apenas currículo (sem evidências)
                </label>
                <label class="flex items-center gap-2 mb-1">
                    <input type="radio" name="pdfReportConteudo" id="pdfReportConteudoApenasEvidencias" value="apenas-evidencias">
                    Apenas evidências (sem o texto do currículo)
                </label>
                <label class="flex items-center gap-2">
                    <input type="radio" name="pdfReportConteudo" id="pdfReportConteudoPersonalizado" value="personalizado">
                    Personalizado (escolher categorias)
                </label>
            </fieldset>
            <fieldset id="pdfReportCategoriasWrap" class="hidden text-sm mb-2 border border-gray-200 dark:border-gray-700 rounded p-2">
                <legend class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 px-1">Categorias a incluir</legend>
                <div class="flex gap-3 text-xs mb-1.5">
                    <button type="button" id="pdfReportCategoriasTodas" class="underline hover:no-underline">Selecionar todas</button>
                    <button type="button" id="pdfReportCategoriasNenhuma" class="underline hover:no-underline">Limpar seleção</button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs max-h-48 overflow-y-auto">
                    ${categoriasCheckboxesHtml()}
                </div>
            </fieldset>
            <button id="btnPdfReportGerar" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-file-pdf mr-1"></i> Gerar relatório (PDF)</button>
            <p id="pdfReportStatus" class="text-xs text-gray-500 mt-2"></p>`);
}

function baixarArquivoBinario(nome, bytes, mime) {
    const blob = new Blob([bytes], { type: mime });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; a.click();
    URL.revokeObjectURL(a.href);
}

// Mostra o bloco de checkboxes de categorias só quando "Personalizado"
// está selecionado — os outros 3 modos (completo/sem-evidências/apenas-
// evidências) sempre consideram todas as categorias.
function wirePdfReportConteudoToggle() {
    const radios = $$('input[name="pdfReportConteudo"]');
    const wrap = $('#pdfReportCategoriasWrap');
    if (!radios.length || !wrap) return;
    const atualizar = () => {
        const personalizado = radios.find((r) => r.checked);
        wrap.classList.toggle('hidden', !personalizado || personalizado.value !== 'personalizado');
    };
    radios.forEach((r) => r.addEventListener('change', atualizar));
    atualizar();

    const btnTodas = $('#pdfReportCategoriasTodas');
    const btnNenhuma = $('#pdfReportCategoriasNenhuma');
    if (btnTodas) btnTodas.addEventListener('click', () => $$('.pdfReportCategoria').forEach((c) => { c.checked = true; }));
    if (btnNenhuma) btnNenhuma.addEventListener('click', () => $$('.pdfReportCategoria').forEach((c) => { c.checked = false; }));
}

export function wirePdfReportExport() {
    const btn = $('#btnPdfReportGerar');
    if (!btn) return;
    wirePdfReportConteudoToggle();
    const status = (t) => { const el = $('#pdfReportStatus'); if (el) el.textContent = t; };
    btn.addEventListener('click', async () => {
        const incluirTodos = $('#pdfReportEscopoTodos').checked;
        const conteudo = ($$('input[name="pdfReportConteudo"]').find((r) => r.checked) || {}).value || 'completo';
        const incluirCurriculo = conteudo !== 'apenas-evidencias';
        const incluirEvidencias = conteudo !== 'sem-evidencias';
        const categorias = conteudo === 'personalizado'
            ? $$('.pdfReportCategoria').filter((c) => c.checked).map((c) => c.value)
            : null;
        if (conteudo === 'personalizado' && !categorias.length) {
            toast('Selecione pelo menos uma categoria em "Personalizado" antes de gerar o relatório.', 'aviso');
            return;
        }
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Gerando relatório… (pode levar alguns minutos)';
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
            const bytes = await window.LzPdfReport.gerar({ incluirTodos, incluirCurriculo, incluirEvidencias, categorias });
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
                : `Relatório gerado — sem diretório configurado, não há onde salvar uma cópia (só o download)${incluirEvidencias ? ', e evidências em arquivo (PDF/imagem) não puderam ser anexadas (só evidências em link, se houver)' : ''}.`);
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
