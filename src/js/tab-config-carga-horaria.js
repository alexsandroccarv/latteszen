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
   lattesZen — Importar "Carga Horária: Consolidada" (PDF) — Configurações
   --------------------------------------------------------------------------
   Mesmo padrão de xmlImportItemHtml/onXmlSelected (tab-config-xml.js): a
   Unifesp só disponibiliza esse relatório em PDF (nunca XML/JSON), mas o
   fluxo de revisão-antes-de-importar e a deduplicação por assinatura de
   conteúdo são os MESMOS — os candidatos viram itens NORMAIS do catálogo
   Lattes (mesmos typeKeys de sempre), independente do servidor ser TAE ou
   Docente (pedido do Alexsandro: nenhuma pasta/aba exclusiva de um módulo).
   ========================================================================== */
import { dadosItemHtml } from './tab-config-shared.js';
import { itemSignature, existingSignatureMap } from './tab-config-dedup.js';

const { state, $, $$, esc, toast, t } = window.AppCore;

export function cargaHorariaImportItemHtml() {
    return dadosItemHtml('fa-solid fa-file-pdf', t('tab_config_carga_horaria.titulo', 'Carga Horária (PDF Unifesp)'),
        t('tab_config_carga_horaria.ajuda', 'A Unifesp só disponibiliza o relatório "Carga Horária: Consolidada" em PDF (nunca em XML). Este importador lê o PDF e reconhece disciplinas, cursos e eventos — revise antes de confirmar quais viram itens do catálogo.'), `
            <input type="file" id="cargaHorariaInput" accept="application/pdf"
                   class="text-sm file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-govbr-600 dark:file:bg-unifesp-700 file:text-white">
            <div id="cargaHorariaResult" class="mt-3"></div>`);
}

export async function onCargaHorariaSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    const box = $('#cargaHorariaResult');
    box.innerHTML = `<p class="text-sm text-gray-500 italic">${esc(t('tab_config_carga_horaria.lendo', 'Lendo o PDF…'))}</p>`;
    let res;
    try {
        const buffer = await file.arrayBuffer();
        res = await window.ImportCargaHoraria.parsePdf(buffer);
    } catch (err) {
        box.innerHTML = '';
        toast(t('tab_config_carga_horaria.falha_ler', 'Não foi possível ler o PDF: {erro}', { erro: err.message }), 'erro');
        return;
    }
    state.importacoes.cargaHoraria = { res, arquivo: file };
    renderCargaHorariaResult();
}

function isDupCandidato(sigMap, cand) {
    const sig = itemSignature(cand.typeKeySugerido, cand.fields);
    return !!(sig && sigMap.has(sig));
}

function renderCargaHorariaResult() {
    const box = $('#cargaHorariaResult');
    if (!box) return;
    const st = state.importacoes.cargaHoraria;
    const items = (st && st.res.candidatos) || [];
    if (!items.length) {
        box.innerHTML = `<p class="text-sm text-gray-500 italic">${esc(t('tab_config_carga_horaria.nenhum_item', 'Nenhuma atividade reconhecida no PDF.'))}</p>`;
        return;
    }
    const sigMap = existingSignatureMap();
    const novos = items.filter((it) => !isDupCandidato(sigMap, it)).length;
    const jaCat = items.length - novos;
    const porTipo = {};
    items.forEach((it) => { porTipo[it.typeKeySugerido] = (porTipo[it.typeKeySugerido] || 0) + 1; });
    const resumo = Object.entries(porTipo)
        .map(([k, n]) => `<span class="badge bg-govbr-50 text-govbr-700 dark:bg-gray-700 dark:text-gray-200">${esc(LattesTypes.label(k))}: ${n}</span>`).join(' ');

    box.innerHTML = `
        <div class="mb-3">
            <p class="text-sm mb-1">${t('tab_config_carga_horaria.resumo_reconhecidos', '{total} atividades reconhecidas — <strong class="text-green-700 dark:text-green-400">{novos} novas</strong>, {existentes} já catalogada(s).', { total: items.length, novos, existentes: jaCat })}</p>
            <div class="flex flex-wrap gap-1">${resumo}</div>
        </div>
        <div class="flex items-center gap-2 mb-2 flex-wrap">
            <button id="btnChSelNovos" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">${esc(t('tab_config_carga_horaria.selecionar_novos', 'Selecionar novos'))}</button>
            <button id="btnChSelAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">${esc(t('tab_config_carga_horaria.todos', 'Todos'))}</button>
            <button id="btnChSelNone" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">${esc(t('tab_config_carga_horaria.nenhum', 'Nenhum'))}</button>
            <button id="btnChImport" class="ml-auto px-4 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold">
                <i class="fa-solid fa-download mr-1"></i> ${esc(t('tab_config_carga_horaria.importar_selecionados', 'Importar selecionados'))}
            </button>
        </div>
        <div class="space-y-1 scroll-area max-h-[60vh] overflow-y-auto pr-1">
            ${items.map((it, idx) => {
                const dup = isDupCandidato(sigMap, it);
                return `<label class="flex items-start gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm ${dup ? 'opacity-60' : ''}">
                    <input type="checkbox" class="chchk mt-1" data-idx="${idx}" ${dup ? '' : 'checked'}>
                    <span class="min-w-0 flex-1">
                        <span class="font-medium">${esc(it.titulo || t('tab_config_carga_horaria.sem_titulo', '(sem título)'))}</span>
                        <span class="flex items-center gap-1 flex-wrap text-xs text-gray-500 mt-0.5">
                            <span>${esc(it.secao || '')}</span> ·
                            <select class="chtipo text-xs px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" data-idx="${idx}">
                                ${it.typeKeyOpcoes.map((tk) => `<option value="${esc(tk)}" ${tk === it.typeKeySugerido ? 'selected' : ''}>${esc(LattesTypes.label(tk))}</option>`).join('')}
                            </select>
                            ${dup ? `· <em>${esc(t('tab_config_carga_horaria.ja_catalogado', 'já catalogado'))}</em>` : ''}
                        </span>
                        ${it.avisos.length ? `<span class="block text-xs text-amber-600 dark:text-amber-400 mt-0.5">${it.avisos.map((a) => esc(a)).join(' ')}</span>` : ''}
                    </span>
                </label>`;
            }).join('')}
        </div>`;

    $('#btnChSelNovos').addEventListener('click', () => $$('.chchk').forEach((c) => { c.checked = !isDupCandidato(sigMap, items[+c.dataset.idx]); }));
    $('#btnChSelAll').addEventListener('click', () => $$('.chchk').forEach((c) => { c.checked = true; }));
    $('#btnChSelNone').addEventListener('click', () => $$('.chchk').forEach((c) => { c.checked = false; }));
    $$('.chtipo').forEach((sel) => sel.addEventListener('change', () => { items[+sel.dataset.idx].typeKeySugerido = sel.value; }));
    $('#btnChImport').addEventListener('click', importCargaHorariaSelected);
}

async function importCargaHorariaSelected() {
    const st = state.importacoes.cargaHoraria;
    const chosen = $$('.chchk').filter((c) => c.checked).map((c) => parseInt(c.dataset.idx, 10));
    if (!chosen.length) { toast(t('tab_config_carga_horaria.nenhum_selecionado', 'Nenhum item selecionado.'), 'aviso'); return; }
    const btn = $('#btnChImport');
    const original = btn ? btn.innerHTML : '';
    if (btn) btn.disabled = true;
    try {
        const sigMap = existingSignatureMap();
        const semDir = !Storage.hasDirectory();
        let n = 0, ignorados = 0, semEvidencia = 0, feito = 0;
        for (const idx of chosen) {
            const cand = st.res.candidatos[idx];
            const typeKey = cand.typeKeySugerido;
            const sig = itemSignature(typeKey, cand.fields);
            if (sig && sigMap.has(sig)) { ignorados++; feito++; continue; }
            const categoryKey = LattesTypes.primaryCategory(typeKey);
            const item = {
                id: window.AppCore.uid(), createdAt: window.AppCore.nowISO(), updatedAt: window.AppCore.nowISO(),
                lattesItem: true, typeKey, categoryKey, fields: cand.fields,
                source: 'carga-horaria-unifesp', lattesRef: null,
                hasPdf: false, pdfName: null, evidencias: [],
            };
            if (st.arquivo) {
                if (semDir) { semEvidencia++; }
                else {
                    const ext = window.AppCore.fileExt(st.arquivo) || 'pdf';
                    const basename = `${item.id}-${window.AppCore.randCode(2)}`;
                    try {
                        await Storage.writeAttachment(basename, st.arquivo, LattesTypes.categoryFolder(categoryKey), ext);
                        // publica: false (de propósito) — o mesmo PDF vira evidência de
                        // VÁRIOS itens (é uma prova coletiva do relatório da Unifesp, não
                        // um comprovante dedicado a este item específico). Em Conformidade
                        // isso faz o ícone de evidência aparecer em âmbar, não verde (ver
                        // evidenceIconsHtml em tab-conformidade.js — a cor já depende só de
                        // `publica`, sem precisar de nenhuma lógica nova) — sinalizando que
                        // o ideal é substituir por uma evidência própria quando possível.
                        item.evidencias = [{ basename, ext, name: st.arquivo.name, publica: false, tag: t('tab_config_carga_horaria.tag_evidencia', 'Carga horária (Unifesp)') }];
                        item.hasPdf = true; item.pdfName = st.arquivo.name; item.fileExt = ext;
                    } catch (_) { semEvidencia++; }
                }
            }
            await window.AppCore.persistItem(item);
            if (sig) sigMap.set(sig, item);
            n++; feito++;
            if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> ${esc(t('tab_config_carga_horaria.importando_progresso', 'Importando… ({feito}/{total})', { feito, total: chosen.length }))}`;
        }
        const extras = [
            ignorados ? t('tab_config_carga_horaria.n_ja_existentes', '{n} já existente(s) ignorado(s)', { n: ignorados }) : '',
            semEvidencia ? t('tab_config_carga_horaria.n_sem_evidencia', '{n} sem evidência anexada (configure um diretório em Configurações)', { n: semEvidencia }) : '',
        ].filter(Boolean).join(', ');
        toast(t('tab_config_carga_horaria.itens_importados', '{n} item(ns) importado(s){extras}.', { n, extras: extras ? ' — ' + extras : '' }), 'ok');
        renderCargaHorariaResult();
        window.AppCore.renderItemList();
    } finally {
        if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = original; }
    }
}
