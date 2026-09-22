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
   lattesZen — Aba Súmula Curricular FAPESP
   --------------------------------------------------------------------------
   Módulo opcional (issue #8), no mesmo espírito do RSC (tab-rsc.js): um
   campo de texto livre — preenchível com um modelo automático gerado a
   partir do catálogo, ou editado/colado manualmente — exportado em .docx
   pra "Exportação/Súmula Curricular FAPESP". Diferente do RSC (que também
   gera um formulário estruturado + anexos numerados, pois o requerimento
   do RSC-PCCTAE exige comprovação documental item a item), a Súmula
   Curricular da FAPESP é um único documento de até 4 páginas — por isso
   aqui não há anexos nem numeração cruzada, só o texto.

   O roteiro oficial (https://fapesp.br/sumula) pede 6 seções fixas, e
   alguns itens têm limite de quantidade (até 3 no Histórico Profissional,
   até 5 em Contribuições e em Financiamentos) — não dá pra automatizar
   "quais são os mais relevantes" com segurança, então o modelo automático
   sugere os itens mais recentes de cada seção como PONTO DE PARTIDA
   (marcados com placeholders onde a decisão é do usuário, ex.: a
   justificativa de cada contribuição) — não pretende ser um documento
   pronto para submissão, só uma base organizada que economiza a montagem
   manual (mesmo escopo sugerido na issue).
   ========================================================================== */
window.TabSumula = (function () {
    const { state, $, esc, toast, itemYear, sortByYear, t, getLocale, datebrParaExibicao } = window.AppCore;

    // Nome e ORCID vêm da Identificação (Configurações › Perfil) — evita
    // duplicar esse cadastro aqui (mesmo princípio já usado pelo RSC pro
    // nome do servidor, ver tab-rsc.js/nomeServidorAtual).
    function perfilIdentificacao() {
        const item = state.catalogo.items.find(i => i.typeKey === 'IDENTIFICACAO');
        return (item && item.fields) || {};
    }

    /* ------------------------ Configuração (links) ------------------------ */
    function sumulaCfgSectionHtml(cfg) {
        const c = cfg || {};
        const perfil = perfilIdentificacao();
        return `<section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
            <h3 class="font-bold text-sm mb-2 flex items-center gap-2"><i class="fa-solid fa-id-card text-govbr-600 dark:text-unifesp-400"></i> ${esc(t('tab_sumula.dados_pessoais_titulo', 'Súmula: Dados pessoais'))}</h3>
            <p class="text-xs text-gray-500 mb-2">${t('tab_sumula.dados_pessoais_ajuda', 'Nome e ORCID vêm da <strong>Identificação</strong> (Configurações › Perfil): {nome}{orcid}.', { nome: esc(perfil.titulo || '—'), orcid: perfil.orcid ? ` · ORCID ${esc(perfil.orcid)}` : '' })}</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div><label class="block text-xs font-semibold mb-1" for="sumula-linkLattes">${esc(t('tab_sumula.link_lattes', 'Link do Currículo Lattes'))}</label>
                    <input id="sumula-linkLattes" type="text" value="${esc(c.linkLattes || '')}" placeholder="http://lattes.cnpq.br/..." class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></div>
                <div><label class="block text-xs font-semibold mb-1" for="sumula-linkWebOfScience">${esc(t('tab_sumula.link_wos', 'Link Web of Science (opcional)'))}</label>
                    <input id="sumula-linkWebOfScience" type="text" value="${esc(c.linkWebOfScience || '')}" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></div>
                <div><label class="block text-xs font-semibold mb-1" for="sumula-linkGoogleScholar">${esc(t('tab_sumula.link_scholar', 'Link Google Scholar / MyCitation (opcional)'))}</label>
                    <input id="sumula-linkGoogleScholar" type="text" value="${esc(c.linkGoogleScholar || '')}" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></div>
            </div>
            <div class="flex gap-2 mt-3">
                <button id="btnSaveSumulaCfg" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-floppy-disk mr-1"></i> ${esc(t('tab_catalogar.salvar', 'Salvar'))}</button>
            </div>
        </section>`;
    }
    function wireSumulaCfgSection() {
        const btn = $('#btnSaveSumulaCfg'); if (!btn) return;
        btn.addEventListener('click', () => {
            const cfg = {
                linkLattes: $('#sumula-linkLattes').value.trim(),
                linkWebOfScience: $('#sumula-linkWebOfScience').value.trim(),
                linkGoogleScholar: $('#sumula-linkGoogleScholar').value.trim(),
            };
            state.sumula.cfg = cfg;
            const s = Storage.loadSettings(); s.sumula = cfg; Storage.saveSettings(s);
            window.AppCore.persistirSumula();
            toast(t('tab_sumula.config_salva', 'Configuração da Súmula FAPESP salva.'), 'ok');
            render();
        });
    }

    /* ------------------ Recortes do catálogo por seção --------------------- */
    // anoInicio/anoFim são campos `datebr` — valor CANÔNICO (sem separador,
    // ver fieldDateBr em tab-catalogar.js), formatado aqui pro locale ativo
    // antes de entrar no texto da Súmula (senão imprimiria os dígitos crus).
    function periodoTexto(f) {
        const locale = getLocale();
        const ini = datebrParaExibicao((f && f.anoInicio) || '', locale);
        const fim = datebrParaExibicao((f && f.anoFim) || '', locale);
        if (ini && fim) return `${ini}–${fim}`;
        if (ini) return `${ini}–${t('tab_sumula.periodo_atual', 'atual')}`;
        return fim || '';
    }
    // 1) Formação: titulação acadêmica, pós-doutorado/livre-docência e
    // formação complementar — ordem cronológica (mais antiga primeiro),
    // igual à tabela do roteiro oficial.
    function formacaoItens() {
        return state.catalogo.items.filter(i => ['FORMACAO_ACADEMICA', 'POS_DOUTORADO', 'FORMACAO_COMPLEMENTAR'].includes(i.typeKey))
            .slice().sort((a, b) => (itemYear(a) || 0) - (itemYear(b) || 0));
    }
    // 2) Histórico Profissional/Acadêmico: até 3 vínculos/atuações mais
    // recentes (o roteiro pede "até 3 principais posições").
    function historicoProfissionalItens(limit) {
        return sortByYear(state.catalogo.items.filter(i => i.typeKey === 'VINCULO_PROFISSIONAL'), false).slice(0, limit);
    }
    function premiosItens() {
        return sortByYear(state.catalogo.items.filter(i => i.typeKey === 'PREMIO'), false);
    }
    // 3) Contribuições à Ciência: produção bibliográfica/técnica, patentes e
    // registros e inovação, dos últimos `anos` anos — até `limit` mais
    // recentes (o roteiro limita a 5, últimos 5 anos).
    function contribuicoesItens(limit, anos) {
        const anoCorte = new Date().getFullYear() - anos;
        const elegiveis = state.catalogo.items.filter(i => {
            const cat = LattesTypes.primaryCategory(i.typeKey);
            if (!['PRODUCOES', 'PATENTES_REGISTROS', 'INOVACAO'].includes(cat)) return false;
            const y = itemYear(i);
            return y == null || y >= anoCorte;
        });
        return sortByYear(elegiveis, false).slice(0, limit);
    }
    // 4) Financiamentos à Pesquisa: projetos de pesquisa (não desenvolvimento/
    // extensão/ensino — o roteiro fala especificamente em financiamento À
    // PESQUISA), até `limit` mais recentes.
    function financiamentosItens(limit) {
        return sortByYear(state.catalogo.items.filter(i => i.typeKey === 'PROJETO_PESQUISA'), false).slice(0, limit);
    }
    // 5) Indicadores Quantitativos: contagens automáticas do catálogo. Nem
    // todos os 12 indicadores do roteiro têm um campo correspondente na app
    // (ex.: nº de citações vem de bases externas; patentes não distinguem
    // solicitada/concedida/licenciada — ver comentário em lattes-types.js
    // sobre a remoção desse campo) — esses ficam como preenchimento manual.
    function indicadoresQuantitativos() {
        const porTipo = (...tipos) => state.catalogo.items.filter(i => tipos.includes(i.typeKey)).length;
        const orientacao = (tipoTipo, situacaoTipo) => state.catalogo.items.filter(i => i.typeKey === situacaoTipo && i.fields && i.fields.tipo === tipoTipo).length;
        return {
            livros: porTipo('LIVROS', 'LIVRO', 'LIVRO_CAPITULO'),
            periodicos: porTipo('ARTIGO_PERIODICO'),
            capitulos: porTipo('CAPITULOS_LIVRO', 'CAPITULO_LIVRO'),
            mestradoConcluidas: orientacao('Mestrado', 'ORIENTACAO_CONCLUIDA'),
            mestradoAndamento: orientacao('Mestrado', 'ORIENTACAO_ANDAMENTO'),
            doutoradoConcluidas: orientacao('Doutorado', 'ORIENTACAO_CONCLUIDA'),
            doutoradoAndamento: orientacao('Doutorado', 'ORIENTACAO_ANDAMENTO'),
            posDocConcluidas: orientacao('Pós-Doutorado', 'ORIENTACAO_CONCLUIDA'),
            posDocAndamento: orientacao('Pós-Doutorado', 'ORIENTACAO_ANDAMENTO'),
            patentes: state.catalogo.items.filter(i => LattesTypes.primaryCategory(i.typeKey) === 'PATENTES_REGISTROS').length,
        };
    }

    /* --------------------------- Modelo automático -------------------------- */
    function sumulaModelo(cfg) {
        const c = cfg || {};
        const perfil = perfilIdentificacao();
        const L = [];
        L.push(t('tab_sumula.modelo_nome', 'Nome: {v}', { v: perfil.titulo || '—' }));
        L.push(t('tab_sumula.modelo_orcid', 'Orcid (obrigatório): {v}', { v: perfil.orcid || '—' }));
        L.push(t('tab_sumula.modelo_lattes', 'Currículo Lattes: {v}', { v: c.linkLattes || '—' }));
        if (c.linkWebOfScience) L.push(t('tab_sumula.modelo_wos', 'Web of Science: {v}', { v: c.linkWebOfScience }));
        if (c.linkGoogleScholar) L.push(t('tab_sumula.modelo_scholar', 'MyCitation (Google Scholar): {v}', { v: c.linkGoogleScholar }));
        L.push('');

        const nadaDeclarar = t('tab_sumula.nada_a_declarar', 'NADA A DECLARAR');
        L.push(t('tab_sumula.secao1_titulo', '1) Formação'));
        const form = formacaoItens();
        if (!form.length) L.push(nadaDeclarar);
        else form.forEach(i => {
            const f = i.fields || {};
            const inst = f.instituicao ? ` — ${f.instituicao}` : '';
            L.push(`• ${LattesTypes.itemTitle(i)}${inst}`);
        });
        L.push('');

        L.push(t('tab_sumula.secao1_1_titulo', '1.1) Formação – Informações Adicionais'));
        L.push(t('tab_sumula.secao1_1_ajuda', '[Se aplicável: interrupções/afastamentos por prole, deficiência, incapacidade temporária ou cuidados intensivos (Portaria PR nº 171/2024) — inclua também a consulta prévia de elegibilidade. Caso contrário: NADA A DECLARAR.]'));
        L.push('');

        L.push(t('tab_sumula.secao2_titulo', '2) Histórico Profissional/Acadêmico'));
        L.push(t('tab_sumula.secao2_ajuda', '[Até 3 principais posições profissionais/acadêmicas (datas e instituições), atividades associativas, empreendedorismo/startups e distinções acadêmicas. Sugestão a partir do catálogo — ajuste livremente:]'));
        const hist = historicoProfissionalItens(3);
        if (!hist.length) L.push(nadaDeclarar);
        else hist.forEach(i => {
            const f = i.fields || {};
            const per = periodoTexto(f);
            L.push(`• ${LattesTypes.itemTitle(i)} — ${f.instituicao || '—'}${per ? ` (${per})` : ''}`);
        });
        const premios = premiosItens();
        if (premios.length) {
            L.push(t('tab_sumula.premios_distincoes', 'Prêmios e distinções:'));
            premios.forEach(i => L.push(`• ${LattesTypes.itemTitle(i)} — ${(i.fields || {}).entidade || ''}${itemYear(i) ? ` (${itemYear(i)})` : ''}`));
        }
        L.push('');

        L.push(t('tab_sumula.secao3_titulo', '3) Contribuições à Ciência (Científicas, Tecnológicas ou de Inovação)'));
        L.push(t('tab_sumula.secao3_ajuda', '[Até 5 pesquisas/produtos mais relevantes dos últimos 5 anos, com a justificativa da escolha (impacto e relevância) em até 5 linhas cada. Sugestão a partir do catálogo — troque pelos que julgar mais relevantes:]'));
        const contrib = contribuicoesItens(5, 5);
        if (!contrib.length) L.push(nadaDeclarar);
        else contrib.forEach(i => {
            L.push(`• ${LattesTypes.itemTitle(i)}${itemYear(i) ? ` (${itemYear(i)})` : ''}`);
            L.push(t('tab_sumula.justificativa_placeholder', '  Justificativa: [preencha aqui — impacto e relevância para os projetos de pesquisa em andamento/propostos]'));
        });
        L.push('');

        L.push(t('tab_sumula.secao4_titulo', '4) Financiamentos à Pesquisa'));
        L.push(t('tab_sumula.secao4_ajuda', '[Até 5 financiamentos mais relevantes, vigentes ou concluídos, como Pesquisador Responsável/Principal. Sugestão a partir do catálogo:]'));
        const financ = financiamentosItens(5);
        if (!financ.length) L.push(nadaDeclarar);
        else financ.forEach(i => {
            const f = i.fields || {};
            const per = periodoTexto(f);
            L.push(`• ${LattesTypes.itemTitle(i)}${per ? ` (${per})` : ''}${f.situacao ? ` — ${f.situacao}` : ''}`);
        });
        L.push('');

        L.push(t('tab_sumula.secao5_titulo', '5) Indicadores Quantitativos'));
        const ind = indicadoresQuantitativos();
        L.push(t('tab_sumula.ind_livros', '1) Livros publicados: {n}', { n: ind.livros }));
        L.push(t('tab_sumula.ind_periodicos', '2) Publicações em periódicos com seletiva política editorial: {n}', { n: ind.periodicos }));
        L.push(t('tab_sumula.ind_capitulos', '3) Capítulos de livros: {n}', { n: ind.capitulos }));
        L.push(t('tab_sumula.ind_mestrado_concluidas', '4.a) Dissertações de Mestrado orientadas e já defendidas: {n}', { n: ind.mestradoConcluidas }));
        L.push(t('tab_sumula.ind_mestrado_andamento', '4.b) Dissertações de Mestrado em andamento: {n}', { n: ind.mestradoAndamento }));
        L.push(t('tab_sumula.ind_doutorado_concluidas', '5.a) Teses de Doutorado orientadas e já defendidas: {n}', { n: ind.doutoradoConcluidas }));
        L.push(t('tab_sumula.ind_doutorado_andamento', '5.b) Teses de Doutorado em andamento: {n}', { n: ind.doutoradoAndamento }));
        L.push(t('tab_sumula.ind_posdoc_concluidas', '6.a) Supervisões de Pós-Doutorado concluídas: {n}', { n: ind.posDocConcluidas }));
        L.push(t('tab_sumula.ind_posdoc_andamento', '6.b) Supervisões de Pós-Doutorado em andamento: {n}', { n: ind.posDocAndamento }));
        L.push(t('tab_sumula.ind_citacoes', '7) Citações recebidas na literatura científica internacional (Web of Science, Scopus ou Google Scholar): [preencha manualmente — não calculado automaticamente]'));
        L.push(t('tab_sumula.ind_patentes', '8) Patentes solicitadas, concedidas e licenciadas: {n} no total [o catálogo não distingue solicitada/concedida/licenciada — detalhe manualmente, se necessário]', { n: ind.patentes }));
        L.push(t('tab_sumula.ind_produtos', '9) Produtos desenvolvidos e lançados no mercado: [preencha manualmente, ou NADA A DECLARAR]'));
        L.push(t('tab_sumula.ind_processos', '10) Processos otimizados implementados em empresas ou organizações sociais: [preencha manualmente, ou NADA A DECLARAR]'));
        L.push(t('tab_sumula.ind_empresas', '11) Empresas criadas ou apoiadas: [preencha manualmente, ou NADA A DECLARAR]'));
        L.push(t('tab_sumula.ind_consultorias', '12) Consultorias técnicas e científicas relevantes: [preencha manualmente, ou NADA A DECLARAR]'));
        L.push('');

        L.push(t('tab_sumula.secao6_titulo', '6) Outras Informações Relevantes'));
        L.push(t('tab_sumula.secao6a', '6.a) [Outras informações biográficas relevantes dos últimos 10 anos — experiência e competência na área ou em empreendedorismo e inovação.]'));
        L.push(t('tab_sumula.secao6b', '6.b) [Experiência internacional em pesquisa após o doutoramento — participação em redes internacionais de colaboração com resultados publicados.]'));
        L.push(t('tab_sumula.secao6c', '6.c) [Prêmios, distinções e honrarias, se não cobertos na seção 2.]'));

        return L.join('\n');
    }

    /* ------------------------------ Exportação ------------------------------ */
    function sanitizeArquivo(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, '').trim(); }
    // Pasta datada (uma por dia), mesmo padrão do RSC — reexportar no mesmo
    // dia sobrescreve os arquivos daquele dia.
    function pastaExportacaoHoje() {
        const hoje = new Date();
        const dd = String(hoje.getDate()).padStart(2, '0');
        const mm = String(hoje.getMonth() + 1).padStart(2, '0');
        const yyyy = hoje.getFullYear();
        return `${LattesTypes.sumulaFapespFolder()}/${dd}${mm}${yyyy}`;
    }
    function nomeArquivoSumula() {
        const safe = sanitizeArquivo(perfilIdentificacao().titulo) || t('tab_sumula.pesquisador_fallback', 'Pesquisador');
        const hoje = new Date();
        const dd = String(hoje.getDate()).padStart(2, '0');
        const mm = String(hoje.getMonth() + 1).padStart(2, '0');
        const yyyy = hoje.getFullYear();
        return `Sumula_Curricular_${safe}_${dd}${mm}${yyyy}.docx`;
    }
    // Corpo (OOXML) da Súmula em .docx: o texto do campo (livre — modelo
    // automático ou editado manualmente), reconhecendo as linhas "N)" e
    // "N.N)" do roteiro oficial como títulos (Título 2/3), pro documento
    // final navegar bem no Word — sem isso, um dump plano de parágrafos
    // (como no memorial do RSC) ficaria sem nenhuma estrutura visível, e
    // aqui NÃO há uma segunda passada estruturada por itens/critério como no
    // RSC pra compensar, já que a Súmula é só este texto.
    function sumulaDocxBody(texto) {
        const D = window.LzDocx;
        const parts = [];
        parts.push(D.heading(t('tab_sumula.docx_titulo', 'Súmula Curricular — FAPESP'), 1));
        const perfil = perfilIdentificacao();
        const subtitulo = [perfil.titulo, perfil.orcid ? `ORCID ${perfil.orcid}` : ''].filter(Boolean).join(' — ');
        if (subtitulo) parts.push(D.para(subtitulo, { italic: true, size: 18 }));
        parts.push(D.para(' '));
        String(texto || '').split('\n').forEach(linha => {
            const l = linha.trim();
            if (/^\d\)\s/.test(l)) { parts.push(D.heading(l, 2)); return; }
            if (/^\d\.\d\)\s/.test(l)) { parts.push(D.heading(l, 3)); return; }
            parts.push(D.para(linha));
        });
        return parts.join('');
    }
    async function exportarSumula(cfg) {
        if (!Storage.hasDirectory()) { toast(t('tab_rsc.configure_diretorio', 'Configure um diretório em Configurações para exportar.'), 'aviso'); return; }
        // Botão desabilitado durante a exportação — mesmo padrão do RSC
        // (tab-rsc.js, exportarRsc), pra consistência entre os dois módulos.
        const btn = $('#btnSumulaExportar');
        const original = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> ${esc(t('tab_sumula.gerando', 'Gerando…'))}`; }
        try {
            const folder = pastaExportacaoHoje();
            const texto = (state.sumula.texto && state.sumula.texto.trim()) ? state.sumula.texto : sumulaModelo(cfg);
            const bytes = window.LzDocx.buildDocx(sumulaDocxBody(texto));
            await Storage.writeFile(nomeArquivoSumula(), bytes, folder);
            toast(t('tab_sumula.exportado_sucesso', 'Súmula Curricular exportada em "{pasta}/".', { pasta: folder }), 'ok');
        } catch (e) { toast(t('tab_rsc.falha_exportar', 'Falha ao exportar: {erro}', { erro: e.message }), 'erro'); }
        finally { if (btn) { btn.disabled = false; btn.innerHTML = original; } }
    }

    function render() {
        const panel = $('#tab-sumula');
        if (!state.sumula.enabled) {
            panel.innerHTML = `<p class="text-sm text-gray-500 italic py-8 text-center">${t('tab_sumula.modulo_desabilitado', 'Módulo Súmula Curricular FAPESP desabilitado. Habilite em <strong>Configurações › Súmula Curricular FAPESP</strong>.')}</p>`;
            return;
        }
        const cfg = state.sumula.cfg || {};
        panel.innerHTML = `
            ${sumulaCfgSectionHtml(cfg)}

            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
                <div class="flex items-center justify-between gap-2 mb-1 flex-wrap">
                    <h3 class="font-bold text-sm">${esc(t('tab_sumula.texto_titulo', 'Texto da Súmula Curricular'))}</h3>
                    <button id="btnSumulaModeloPadrao" class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs"><i class="fa-solid fa-arrows-rotate mr-1"></i> ${esc(t('tab_rsc.preencher_modelo_automatico', 'Preencher com modelo automático'))}</button>
                </div>
                <p class="text-xs text-gray-500 mb-2">${t('tab_sumula.texto_ajuda', 'Organizado nas 6 seções exigidas pela FAPESP (<a href="https://fapesp.br/sumula" target="_blank" rel="noopener" class="underline">roteiro oficial</a>), com sugestões pré-preenchidas a partir do catálogo — revise, edite e complete antes de exportar. <strong>Não é um documento oficial pronto para submissão.</strong> Lembre-se: até 4 páginas A-4 (a FAPESP descarta o excedente).')}</p>
                <textarea id="sumulaTexto" rows="20" placeholder="${esc(t('tab_sumula.texto_placeholder', 'Clique em “Preencher com modelo automático” para começar…'))}" class="w-full text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 font-mono leading-relaxed">${esc(state.sumula.texto || '')}</textarea>
                <p id="sumulaTextoSalvo" class="text-xs text-gray-400 mt-1 h-4"></p>
            </div>

            <div class="flex gap-2 flex-wrap mt-4">
                <button id="btnSumulaExportar" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-file-export mr-1"></i> ${esc(t('tab_sumula.gerar_docx', 'Gerar Súmula Curricular (docx)'))}</button>
            </div>`;

        wireSumulaCfgSection();
        $('#btnSumulaExportar').addEventListener('click', () => exportarSumula(cfg));

        const area = $('#sumulaTexto');
        const info = $('#sumulaTextoSalvo');
        let saveTimer = null;
        const salvar = () => {
            state.sumula.texto = area.value;
            const s = Storage.loadSettings(); s.sumulaTexto = state.sumula.texto; Storage.saveSettings(s);
            window.AppCore.persistirSumula();
            if (info) { info.textContent = t('tab_rsc.salvo', 'Salvo.'); clearTimeout(info._t); info._t = setTimeout(() => { info.textContent = ''; }, 1500); }
        };
        area.addEventListener('input', () => { clearTimeout(saveTimer); saveTimer = setTimeout(salvar, 500); });
        area.addEventListener('blur', () => { clearTimeout(saveTimer); salvar(); });
        $('#btnSumulaModeloPadrao').addEventListener('click', () => {
            if (area.value.trim() && !confirm(t('tab_sumula.confirmar_substituir', 'Isso substitui o texto atual pelo modelo automático. Continuar?'))) return;
            area.value = sumulaModelo(cfg);
            salvar();
            toast(t('tab_sumula.preenchida_modelo', 'Súmula preenchida com o modelo automático.'), 'ok');
        });
    }

    return { render };
})();
