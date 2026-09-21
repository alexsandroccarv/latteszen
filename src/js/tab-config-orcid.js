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
   lattesZen — Importar publicações do ORCID — seção dentro de Configurações
   --------------------------------------------------------------------------
   Extraído de tab-config.js (issue de refatoração). Nenhuma mudança de
   conteúdo, só saiu do arquivo único original.
   ========================================================================== */
import { dadosItemHtml } from './tab-config-shared.js';
import { itemSignature, existingSignatureMap } from './tab-config-dedup.js';

const { state, $, $$, esc, toast, t } = window.AppCore;


    /* =====================================================================
       IMPORTAR PUBLICAÇÕES DO ORCID — seção dentro de Configurações
       ---------------------------------------------------------------------
       Busca as obras públicas de um ORCID iD (API pública, sem autenticação)
       e reaproveita a mesma tela de revisão/seleção e a mesma deduplicação
       por assinatura de conteúdo (itemSignature/existingSignatureMap) já
       usadas na importação do XML do Lattes — só a origem dos dados muda.
       ===================================================================== */
    // Tipo de obra do ORCID → tipo do lattesZen. Cobre os tipos mais comuns;
    // qualquer tipo não mapeado cai em OUTRA_BIBLIOGRAFICA (catch-all seguro).
    const ORCID_TYPE_MAP = {
        'journal-article': 'ARTIGO_PERIODICO', 'journal-issue': 'ARTIGO_PERIODICO',
        'book': 'LIVROS', 'edited-book': 'LIVROS',
        'book-chapter': 'CAPITULOS_LIVRO',
        'conference-paper': 'TRABALHO_EVENTO', 'conference-abstract': 'TRABALHO_EVENTO', 'conference-poster': 'TRABALHO_EVENTO',
        'lecture-speech': 'APRESENTACAO',
        'magazine-article': 'TEXTO_JORNAL', 'newsletter-article': 'TEXTO_JORNAL', 'newspaper-article': 'TEXTO_JORNAL', 'online-resource': 'TEXTO_JORNAL',
        'translation': 'TRADUCAO',
        'software': 'SOFTWARE_SEM_REGISTRO',
        'patent': 'PATENTE',
        'trademark': 'MARCA',
        'artistic-performance': 'ARTES_CENICAS',
        'cartographic-material': 'CARTA_MAPA',
        'image': 'OUTRA_ARTISTICA', 'video': 'OUTRA_ARTISTICA',
        'report': 'RELATORIO_PESQUISA', 'working-paper': 'RELATORIO_PESQUISA', 'preprint': 'RELATORIO_PESQUISA',
    };
    const ORCID_FALLBACK_TYPE = 'OUTRA_BIBLIOGRAFICA';

    export function orcidImportItemHtml() {
        const perfil = (state.catalogo.items.find(i => i.typeKey === 'IDENTIFICACAO') || {}).fields || {};
        return dadosItemHtml('fa-brands fa-orcid', t('tab_config_orcid.titulo', 'ORCID (online)'),
            t('tab_config_orcid.ajuda', 'Busca as obras públicas registradas no seu ORCID iD (API pública — nenhuma senha é necessária) e lista para você escolher quais importar, do mesmo jeito que a importação do XML do Lattes. Os autores só saem se o próprio autor tiver um nome público registrado no ORCID daquela obra — quando faltar, complete depois de importar. O tipo de cada obra é inferido automaticamente e pode precisar de ajuste.'), `
                <div class="flex flex-wrap items-end gap-2">
                    <div>
                        <label class="block text-xs font-semibold mb-1" for="orcidInput">ORCID iD</label>
                        <input type="text" id="orcidInput" placeholder="0000-0000-0000-0000" value="${esc(perfil.orcid || '')}"
                               class="text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 w-48">
                    </div>
                    <button id="btnOrcidBuscar" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold">
                        <i class="fa-solid fa-magnifying-glass mr-1"></i> ${esc(t('tab_config_orcid.buscar_publicacoes', 'Buscar publicações'))}
                    </button>
                </div>
                <div id="orcidResult" class="mt-3"></div>`);
    }

    // Extrai um external-id específico (ex.: 'doi', 'uri') do work-summary do ORCID.
    function orcidExternalId(summary, kind) {
        const ids = summary['external-ids'] && summary['external-ids']['external-id'];
        if (!Array.isArray(ids)) return '';
        const found = ids.find((x) => x['external-id-type'] === kind);
        return found ? String(found['external-id-value'] || '').trim() : '';
    }
    // Converte um work-summary do ORCID num item do lattesZen (typeKey/categoryKey/fields).
    // `autores`, quando informado, vem da busca em lote de fetchOrcidWorkDetails (2ª
    // chamada) — o endpoint de listagem por si só não traz os colaboradores da obra.
    function orcidWorkToItem(summary, autores) {
        const typeKey = ORCID_TYPE_MAP[summary.type] || ORCID_FALLBACK_TYPE;
        const titulo = (summary.title && summary.title.title && summary.title.title.value) || '';
        const ano = (summary['publication-date'] && summary['publication-date'].year && summary['publication-date'].year.value) || '';
        const doi = orcidExternalId(summary, 'doi');
        // Sanitiza a URL vinda da API do ORCID (fonte externa, fora do nosso
        // controle) antes de guardar — sem isso ela nunca passa por
        // validateURL (a importação em lote salva os itens direto, sem abrir
        // o formulário), então um esquema perigoso (ex.: javascript:) num
        // registro comprometido iria parar intacto na página pública.
        const urlBruta = (summary.url && summary.url.value) || orcidExternalId(summary, 'uri') || '';
        const urlValidada = window.AppCore.validateURL(urlBruta);
        const url = urlValidada.ok ? urlValidada.value : '';
        const journal = (summary['journal-title'] && summary['journal-title'].value) || '';
        const def = LattesTypes.getType(typeKey);
        const temCampo = (k) => def && def.fields.some((f) => f.key === k);
        const fields = {};
        if (temCampo('titulo')) fields.titulo = titulo;
        if (temCampo('ano')) fields.ano = ano;
        if (temCampo('doi')) fields.doi = doi;
        if (temCampo('url')) fields.url = url;
        if (typeKey === 'ARTIGO_PERIODICO' || typeKey === 'ARTIGO_ACEITO') fields.periodico = journal;
        if (autores && autores.length) {
            if (temCampo('autoresLista')) fields.autoresLista = autores.map((nome) => ({ nomeCompleto: nome, nomeCitacao: '' }));
            else if (temCampo('autores')) fields.autores = autores.join('; ');
        }
        return { typeKey, categoryKey: LattesTypes.primaryCategory(typeKey), fields, putCode: summary['put-code'] };
    }
    // Extrai os nomes dos colaboradores com papel de autor (ou sem papel
    // informado — é o padrão da maioria dos registros) do registro COMPLETO de
    // uma obra do ORCID. Colaboradores sem "credit-name" público não têm como
    // ser nomeados (só o ORCID iD deles, sem nome de exibição) e são ignorados.
    function orcidContributorNames(work) {
        const list = work && work.contributors && work.contributors.contributor;
        if (!Array.isArray(list)) return [];
        return list
            .filter((c) => {
                const role = c['contributor-attributes'] && c['contributor-attributes']['contributor-role'];
                return !role || role === 'author';
            })
            .map((c) => (c['credit-name'] && c['credit-name'].value) || '')
            .filter(Boolean);
    }
    // Busca os registros COMPLETOS (com colaboradores) de uma lista de obras, em
    // lotes de até 50 (limite do endpoint de busca em lote da API do ORCID).
    // Retorna um Map put-code → nomes de autores. Uma falha num lote não trava
    // a importação — a obra simplesmente fica sem autores pré-preenchidos.
    async function fetchOrcidWorkDetails(orcid, putCodes) {
        const map = new Map();
        for (let i = 0; i < putCodes.length; i += 50) {
            const lote = putCodes.slice(i, i + 50);
            let resp;
            try { resp = await fetch(`https://pub.orcid.org/v3.0/${orcid}/works/${lote.join(',')}`, { headers: { 'Accept': 'application/json' } }); }
            catch (_) { continue; }
            if (!resp.ok) continue;
            const data = await resp.json();
            const bulk = Array.isArray(data.bulk) ? data.bulk : [];
            for (const entry of bulk) {
                const work = entry && entry.work;
                if (!work) continue;
                const nomes = orcidContributorNames(work);
                if (nomes.length) map.set(work['put-code'], nomes);
            }
        }
        return map;
    }
    // Busca as obras públicas de um ORCID iD. Lança erro (mensagem em pt-BR) se
    // o formato for inválido ou a consulta falhar.
    async function fetchOrcidWorks(orcid) {
        const clean = String(orcid || '').trim().toUpperCase();
        if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(clean)) throw new Error(t('tab_config_orcid.id_invalido', 'ORCID iD inválido — use o formato 0000-0000-0000-0000.'));
        let resp;
        try { resp = await fetch(`https://pub.orcid.org/v3.0/${clean}/works`, { headers: { 'Accept': 'application/json' } }); }
        catch (_) { throw new Error(t('tab_config_orcid.erro_conexao', 'Não foi possível conectar ao ORCID — verifique sua conexão com a internet.')); }
        if (!resp.ok) throw new Error(t('tab_config_orcid.erro_http', 'ORCID retornou um erro (HTTP {status}) — confira se o ORCID iD existe e é público.', { status: resp.status }));
        const data = await resp.json();
        const groups = Array.isArray(data.group) ? data.group : [];
        const summaries = groups.map((g) => (g['work-summary'] && g['work-summary'][0]) || null).filter(Boolean);
        let autoresPorObra = new Map();
        try { autoresPorObra = await fetchOrcidWorkDetails(clean, summaries.map((s) => s['put-code'])); }
        catch (_) { /* segue sem autores pré-preenchidos */ }
        return summaries.map((s) => orcidWorkToItem(s, autoresPorObra.get(s['put-code'])));
    }

    function renderOrcidResult(items) {
        const box = $('#orcidResult');
        if (!items.length) { box.innerHTML = `<p class="text-sm text-gray-500 italic">${esc(t('tab_config_orcid.nenhuma_obra', 'Nenhuma obra pública encontrada para esse ORCID iD.'))}</p>`; return; }
        const sigMap = existingSignatureMap();
        const isDup = (it) => (LattesTypes.isSingleton(it.typeKey) && state.catalogo.items.some((x) => x.typeKey === it.typeKey)) || sigMap.has(itemSignature(it.typeKey, it.fields || {}));
        const novos = items.filter((it) => !isDup(it)).length;
        box.innerHTML = `
            <div class="mb-3">
                <p class="text-sm mb-1">${t('tab_config_orcid.resumo_encontradas', '{total} obra(s) encontrada(s) — <strong class="text-green-700 dark:text-green-400">{novos} novas</strong>, {existentes} já catalogada(s).', { total: items.length, novos, existentes: items.length - novos })}</p>
            </div>
            <div class="flex items-center gap-2 mb-2 flex-wrap">
                <button id="btnOrcidSelNovos" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">${esc(t('tab_config_bibtex.selecionar_novos', 'Selecionar novos'))}</button>
                <button id="btnOrcidSelAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">${esc(t('tab_config_bibtex.todos', 'Todos'))}</button>
                <button id="btnOrcidSelNone" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">${esc(t('tab_config_bibtex.nenhum', 'Nenhum'))}</button>
                <button id="btnOrcidImport" class="ml-auto px-4 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold">
                    <i class="fa-solid fa-download mr-1"></i> ${esc(t('tab_config_bibtex.importar_selecionados', 'Importar selecionados'))}
                </button>
            </div>
            <div class="space-y-1 scroll-area max-h-[60vh] overflow-y-auto pr-1">
                ${items.map((it, idx) => {
                    const dup = isDup(it);
                    return `<label class="flex items-start gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm ${dup ? 'opacity-60' : ''}">
                        <input type="checkbox" class="orcidchk mt-1" data-idx="${idx}" ${dup ? '' : 'checked'}>
                        <span class="min-w-0">
                            <span class="font-medium">${esc(it.fields.titulo || t('tab_config_bibtex.sem_titulo', '(sem título)'))}</span>
                            <span class="block text-xs text-gray-500">${esc(LattesTypes.label(it.typeKey))} ${it.fields.ano ? '· ' + esc(it.fields.ano) : ''} ${dup ? `· <em>${esc(t('tab_config_bibtex.ja_catalogado', 'já catalogado'))}</em>` : ''}</span>
                        </span>
                    </label>`;
                }).join('')}
            </div>`;

        $('#btnOrcidSelNovos').addEventListener('click', () => $$('.orcidchk').forEach((c) => { c.checked = !isDup(items[+c.dataset.idx]); }));
        $('#btnOrcidSelAll').addEventListener('click', () => $$('.orcidchk').forEach((c) => c.checked = true));
        $('#btnOrcidSelNone').addEventListener('click', () => $$('.orcidchk').forEach((c) => c.checked = false));
        $('#btnOrcidImport').addEventListener('click', importOrcidSelected);
    }

    async function importOrcidSelected() {
        const chosen = $$('.orcidchk').filter((c) => c.checked).map((c) => parseInt(c.dataset.idx, 10));
        if (!chosen.length) { toast(t('tab_config_bibtex.nenhum_selecionado', 'Nenhum item selecionado.'), 'aviso'); return; }
        // Feedback de progresso + botão desabilitado — ver comentário em
        // importSelected() (importação do XML), mesmo padrão.
        const btn = $('#btnOrcidImport');
        const original = btn ? btn.innerHTML : '';
        if (btn) btn.disabled = true;
        try {
            const sigMap = existingSignatureMap();
            let n = 0, ignorados = 0, feito = 0;
            for (const idx of chosen) {
                const src = state.importacoes.orcid[idx];
                const sig = itemSignature(src.typeKey, src.fields || {});
                if (sig && sigMap.has(sig)) { ignorados++; feito++; if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> ${esc(t('tab_config_bibtex.importando_progresso', 'Importando… ({feito}/{total})', { feito, total: chosen.length }))}`; continue; } // já existe (mesma assinatura) — não duplica
                const item = {
                    id: window.AppCore.uid(), createdAt: window.AppCore.nowISO(), updatedAt: window.AppCore.nowISO(),
                    lattesItem: true, typeKey: src.typeKey, categoryKey: src.categoryKey,
                    fields: src.fields, source: 'orcid', lattesRef: null,
                    hasPdf: false, pdfName: null, evidencias: [],
                };
                await window.AppCore.persistItem(item);
                if (sig) sigMap.set(sig, item);
                n++; feito++;
                if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> ${esc(t('tab_config_bibtex.importando_progresso', 'Importando… ({feito}/{total})', { feito, total: chosen.length }))}`;
            }
            const ignoradosSufixo = ignorados ? t('tab_config_bibtex.ja_existentes_sufixo', ' — {n} já existente(s) ignorado(s)', { n: ignorados }) : '';
            toast(t('tab_config_orcid.itens_importados', '{n} item(ns) importado(s) do ORCID{sufixo}.', { n, sufixo: ignoradosSufixo }), 'ok');
            renderOrcidResult(state.importacoes.orcid);
            window.AppCore.renderItemList();
        } finally {
            if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = original; }
        }
    }

    export function wireOrcidImport() {
        const btn = $('#btnOrcidBuscar');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            const input = $('#orcidInput');
            btn.disabled = true; btn.textContent = t('tab_rsc.buscando', 'Buscando…');
            try {
                const items = await fetchOrcidWorks(input.value);
                state.importacoes.orcid = items;
                renderOrcidResult(items);
            } catch (e) {
                $('#orcidResult').innerHTML = '';
                toast(e.message, 'erro');
            } finally {
                btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-magnifying-glass mr-1"></i> ${esc(t('tab_config_orcid.buscar_publicacoes', 'Buscar publicações'))}`;
            }
        });
    }
