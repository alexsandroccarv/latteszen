/* ==========================================================================
   lattesZen — Aba RSC-PCCTAE (simulador + memorial/formulário)
   --------------------------------------------------------------------------
   Terceira aba extraída de app.js (ver issue de refatoração), mesmo padrão
   das anteriores — lê estado/utilidades de window.AppCore.
   ========================================================================== */
window.TabRsc = (function () {
    const { state, $, esc, toast } = window.AppCore;

    // Itens que contam para o RSC (elegíveis, marcados, com critério e não usados)
    function rscItensContados() {
        return state.items.filter(i => i.rsc && i.rsc.conta && i.rsc.criterio && !i.rsc.jaUsado);
    }
    function render() {
        const panel = $('#tab-rsc');
        if (!state.rscEnabled) {
            panel.innerHTML = `<p class="text-sm text-gray-500 italic py-8 text-center">Módulo RSC desabilitado. Habilite em <strong>Configurações › RSC-PCCTAE</strong>.</p>`;
            return;
        }
        const cfg = state.rscCfg || {};
        const itens = rscItensContados();
        const rscList = itens.map(i => i.rsc);
        const sim = LzRSC.simular(rscList, cfg.escolaridade);

        const reqLinha = (r) => {
            const pr = sim.porRequisito[r];
            return `<tr class="border-b border-gray-100 dark:border-gray-700/60">
                <td class="py-1 pr-2 text-xs">${esc(LzRSC.REQUISITOS[r])}</td>
                <td class="py-1 px-2 text-right tabular-nums">${pr.itens}</td>
                <td class="py-1 px-2 text-right tabular-nums">${pr.criterios.size}</td>
                <td class="py-1 pl-2 text-right tabular-nums font-semibold">${String(pr.pontos).replace('.', ',')}</td></tr>`;
        };
        const niveisLinha = sim.niveis.map(n => {
            const cls = n.atingido ? 'text-green-700 dark:text-green-400' : 'text-gray-500';
            const ic = n.atingido ? 'fa-circle-check' : 'fa-circle';
            const falta = [];
            if (!n.okPontos) falta.push(`+${String(n.faltaPontos).replace('.', ',')} pts`);
            if (!n.okCrit) falta.push(`+${n.faltaCriterios} critério(s)`);
            if (!n.okReq) falta.push('requisito específico');
            if (!n.okEsc) falta.push('escolaridade insuficiente');
            return `<li class="flex items-center gap-2 text-sm ${cls}"><i class="fa-solid ${ic}"></i> ${esc(n.nome)} <span class="text-xs text-gray-400">(${n.min.pontos} pts${n.min.criterios ? ', ' + n.min.criterios + ' crit.' : ''})</span> ${falta.length ? `<span class="text-xs text-amber-600">— falta ${falta.join(', ')}</span>` : ''}</li>`;
        }).join('');

        // Lista de itens contados (conformidade RSC), agrupada por requisito
        const grupos = {};
        itens.forEach(i => { const c = LzRSC.criterio(i.rsc.criterio); const r = c ? c.req : 0; (grupos[r] = grupos[r] || []).push(i); });
        const listaHtml = Object.keys(grupos).sort().map(r => `
            <details open class="border border-gray-200 dark:border-gray-700 rounded mb-2">
                <summary class="cursor-pointer px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-sm font-medium">${esc(LzRSC.REQUISITOS[r] || 'Sem requisito')} <span class="text-xs text-gray-500">(${grupos[r].length})</span></summary>
                <div class="p-2 space-y-1">${grupos[r].map(i => {
                    const pi = LzRSC.pontosItem(i.rsc), c = pi.crit;
                    return `<div class="flex items-center justify-between gap-2 text-sm border border-gray-100 dark:border-gray-700/60 rounded px-2 py-1">
                        <span class="min-w-0"><span class="font-medium">${esc(LattesTypes.itemTitle(i))}</span>
                        <span class="block text-xs text-gray-500">${c ? c.item + '. ' + esc(c.desc) : ''}</span></span>
                        <span class="shrink-0 font-semibold text-amber-700 dark:text-amber-400 tabular-nums">${String(pi.pontos).replace('.', ',')}</span></div>`;
                }).join('')}</div>
            </details>`).join('') || `<p class="text-sm text-gray-500 italic">Nenhum item marcado para o RSC ainda. Em Catalogar, marque “Contabilizar este item no RSC”.</p>`;

        panel.innerHTML = `
            <div class="grid lg:grid-cols-3 gap-4 mb-4">
                <div class="lg:col-span-1 bg-gradient-to-br from-govbr-600 to-govbr-800 dark:from-unifesp-700 dark:to-unifesp-900 text-white rounded-lg p-4">
                    <p class="text-sm opacity-90">Nível alcançável</p>
                    <p class="text-3xl font-bold">${esc(sim.nivelNome)}</p>
                    <p class="text-sm mt-1">Incentivo à Qualificação: <strong>${sim.iq}%</strong></p>
                    <p class="text-xs opacity-80 mt-2">${sim.total.toString().replace('.', ',')} pontos · ${sim.criteriosDistintos} critérios distintos</p>
                    ${cfg.escolaridade ? `<p class="text-xs opacity-80">Escolaridade limita a nível ${sim.capNivel}.</p>` : `<p class="text-xs opacity-90">⚠ Informe a escolaridade em Configurações.</p>`}
                </div>
                <div class="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 class="font-bold text-sm mb-2">Progresso por nível</h3>
                    <ul class="space-y-1">${niveisLinha}</ul>
                </div>
            </div>

            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
                <h3 class="font-bold text-sm mb-2">Pontos por requisito</h3>
                <table class="w-full text-sm"><thead><tr class="text-xs text-gray-500 text-right"><th class="text-left">Requisito</th><th>Itens</th><th>Critérios</th><th>Pontos</th></tr></thead>
                <tbody>${[1, 2, 3, 4, 5, 6].map(reqLinha).join('')}</tbody></table>
            </div>

            <div class="flex gap-2 flex-wrap mb-4">
                <button id="btnRscCsv" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-file-csv mr-1"></i> Exportar planilha (CSV)</button>
                <button id="btnRscMemorial" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-file-lines mr-1"></i> Gerar memorial</button>
                <button id="btnRscForm" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-file-word mr-1"></i> Salvar formulário (.docx)</button>
            </div>

            <h3 class="font-bold mb-2">Itens contabilizados</h3>
            ${listaHtml}`;

        $('#btnRscCsv').addEventListener('click', () => downloadText(rscCsv(itens), 'rsc-comprovacao.csv', 'text/csv'));
        $('#btnRscMemorial').addEventListener('click', () => downloadText(rscMemorial(itens, sim, cfg), 'rsc-memorial.txt', 'text/plain'));
        $('#btnRscForm').addEventListener('click', () => salvarFormularioDocx(itens, sim, cfg));
    }
    function downloadText(txt, nome, mime) {
        const blob = new Blob([txt], { type: (mime || 'text/plain') + ';charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; a.click(); URL.revokeObjectURL(a.href);
    }
    function csvCell(s) { s = String(s == null ? '' : s); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
    function rscCsv(itens) {
        const head = ['Requisito', 'Critério', 'Descrição do critério', 'Item (título)', 'Início', 'Fim', 'Papel', 'Qtd', 'Unitário', 'Pontos', 'Evidências'];
        const rows = itens.map(i => {
            const pi = LzRSC.pontosItem(i.rsc), c = pi.crit || {};
            const nEv = Array.isArray(i.evidencias) ? i.evidencias.length : 0;
            return [c.req || '', c.id || '', c.desc || '', LattesTypes.itemTitle(i), i.rsc.dataInicio || '', i.rsc.dataFim || '',
                (c.pontosSub != null ? i.rsc.papel : ''), pi.quantidade, pi.unitario, pi.pontos, nEv].map(csvCell).join(';');
        });
        return head.map(csvCell).join(';') + '\n' + rows.join('\n');
    }
    function rscMemorial(itens, sim, cfg) {
        const L = [];
        L.push('MEMORIAL — RSC-PCCTAE'); L.push('='.repeat(40));
        L.push(`Cargo: ${cfg.cargo || '—'}   Classe/nível: ${cfg.classe || '—'}`);
        L.push(`Lotação: ${cfg.lotacao || '—'}   SIAPE: ${cfg.siape || '—'}`);
        L.push(`Ingresso no cargo: ${cfg.ingresso || '—'}   Escolaridade: ${(LzRSC.escInfo(cfg.escolaridade) || {}).label || '—'}`);
        L.push(`Nível pleiteável (simulado): ${sim.nivelNome} — ${sim.total.toString().replace('.', ',')} pontos, ${sim.criteriosDistintos} critérios.`);
        L.push('');
        for (let r = 1; r <= 6; r++) {
            const grp = itens.filter(i => { const c = LzRSC.criterio(i.rsc.criterio); return c && c.req === r; });
            if (!grp.length) continue;
            L.push(`REQUISITO ${LzRSC.REQUISITOS[r]}`); L.push('-'.repeat(40));
            grp.forEach(i => {
                const pi = LzRSC.pontosItem(i.rsc), c = pi.crit;
                L.push(`• ${LattesTypes.itemTitle(i)}`);
                L.push(`  Critério ${c.id}: ${c.desc}`);
                const per = (i.rsc.dataInicio || i.rsc.dataFim) ? `  Período: ${i.rsc.dataInicio || '?'} a ${i.rsc.dataFim || '?'}.` : '';
                L.push(`  ${per}  Pontos: ${String(pi.pontos).replace('.', ',')} (${pi.quantidade} × ${String(pi.unitario).replace('.', ',')}).`);
                if (i.rsc.justificativa) L.push(`  Justificativa: ${i.rsc.justificativa}`);
                L.push('');
            });
        }
        return L.join('\n');
    }
    // Requisitos do RSC com a redação oficial do Anexo da Portaria MEC nº
    // 608/2026 (modelo padrão do formulário de requerimento) — ligeiramente
    // diferente do texto usado no simulador (LzRSC.REQUISITOS).
    const REQUISITOS_FORM = {
        1: 'I - Participação em grupos de trabalho, comissões, comitês, núcleos, representações ou similares',
        2: 'II - Projetos institucionais, gestão, ensino, pesquisa, extensão, inovação ou assistência',
        3: 'III - Premiações e reconhecimentos públicos',
        4: 'IV - Responsabilidades técnico-administrativas e/ou especializadas',
        5: 'V - Funções ou cargos de direção e assessoramento institucional',
        6: 'VI - Produção, prospecção e difusão de conhecimento',
    };
    const NUM_PT = n => String(n).replace('.', ',');

    function evidenciasTexto(item) {
        const evs = Array.isArray(item.evidencias) ? item.evidencias : [];
        if (!evs.length) return '—';
        return evs.map(e => e.name || e.basename || 'anexo').join('; ');
    }

    // Monta o corpo (XML OOXML) do formulário padrão RSC-PCCTAE (Anexo da
    // Portaria MEC nº 608/2026), a partir dos dados de configuração, dos
    // itens marcados e da simulação já calculada.
    function rscFormularioBody(itens, sim, cfg) {
        const D = window.LzDocx;
        const nome = (state.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo) || {}).fields;
        const nomeServidor = (nome && nome.titulo) || '';
        const parts = [];

        parts.push(D.heading('Requerimento de Reconhecimento de Saberes e Competências (RSC-PCCTAE)', 1));
        parts.push(D.para('Modelo padrão conforme Anexo da Portaria MEC nº 608, de 7 de julho de 2026.', { italic: true, size: 18 }));

        // ---- 1. Identificação do Servidor ----
        parts.push(D.heading('1. Identificação do Servidor', 2));
        const classeMarcada = n => cfg.nivelClassificacao === n ? `(X) ${n}` : `( ) ${n}`;
        parts.push(D.table([
            D.row([D.cell('Nome', { bold: true, width: 3000 }), D.cell(nomeServidor, { width: 6000 })]),
            D.row([D.cell('Siape', { bold: true }), D.cell(cfg.siape || '')]),
            D.row([D.cell('Cargo', { bold: true }), D.cell(cfg.cargo || '')]),
            D.row([D.cell('Data de ingresso em Instituição Federal de Ensino', { bold: true }), D.cell(cfg.ingresso || '')]),
            D.row([D.cell('Nível de Classificação', { bold: true }), D.cell(['A', 'B', 'C', 'D', 'E'].map(classeMarcada).join('   '))]),
            D.row([D.cell('Lotação', { bold: true }), D.cell(cfg.lotacao || '')]),
            D.row([D.cell('Função/Encargo (se houver)', { bold: true }), D.cell(cfg.funcaoEncargo || '')]),
            D.row([D.cell('Telefone/E-mail', { bold: true }), D.cell(cfg.telefoneEmail || '')]),
        ], [3000, 6000]));

        // ---- 2. Informações do Requerimento ----
        parts.push(D.heading('2. Informações do Requerimento', 2));
        const nivelAlvo = sim.nivelAlcancavel || 0;
        const nivelMarcado = n => nivelAlvo === n ? `(X) RSC-${['I', 'II', 'III', 'IV', 'V', 'VI'][n - 1]}` : `( ) RSC-${['I', 'II', 'III', 'IV', 'V', 'VI'][n - 1]}`;
        const minPontos = nivelAlvo ? sim.niveis[nivelAlvo - 1].min.pontos : null;
        const excedente = minPontos != null ? Math.max(0, +(sim.total - minPontos).toFixed(2)) : 0;
        parts.push(D.table([
            D.row([D.cell('Nível de RSC pretendido', { bold: true, width: 3000 }), D.cell([1, 2, 3, 4, 5, 6].map(nivelMarcado).join('   '), { width: 6000 })]),
            D.row([D.cell('Pontuação mínima necessária', { bold: true }), D.cell(minPontos != null ? NUM_PT(minPontos) : '—')]),
            D.row([D.cell('Pontuação total apresentada', { bold: true }), D.cell(NUM_PT(sim.total))]),
            D.row([D.cell('Quantidade de critérios específicos utilizados', { bold: true }), D.cell(String(sim.criteriosDistintos))]),
            D.row([D.cell('Pontuação total excedente (banco de pontos)', { bold: true }), D.cell(NUM_PT(excedente))]),
            D.row([D.cell('Saldo de pontuação de concessão anterior', { bold: true }), D.cell(cfg.saldoAnterior || '')]),
            D.row([D.cell('Número do processo relativo à concessão anterior (se houver)', { bold: true }), D.cell(cfg.processoAnterior || '')]),
        ], [3000, 6000]));

        // ---- 3. Descrição das Atividades por Requisito Legal ----
        parts.push(D.heading('3. Descrição das Atividades por Requisito Legal', 2));
        parts.push(D.para('Itens organizados conforme os requisitos do art. 4º, incisos I a VI, do Decreto do RSC-PCCTAE, vinculando cada atividade ao critério específico correspondente.', { size: 18 }));

        const grupos = {};
        itens.forEach(i => { const c = LzRSC.criterio(i.rsc.criterio); const r = c ? c.req : 0; (grupos[r] = grupos[r] || []).push(i); });
        const colWidths = [900, 4300, 1600, 900, 1100, 1900];
        for (let r = 1; r <= 6; r++) {
            parts.push(D.heading(`Critério ${REQUISITOS_FORM[r]}`, 3));
            const head = D.row([
                D.cell('Nº do item', { bold: true, width: colWidths[0], shade: 'EEEEEE' }),
                D.cell('Critério específico', { bold: true, width: colWidths[1], shade: 'EEEEEE' }),
                D.cell('Unidade de medida', { bold: true, width: colWidths[2], shade: 'EEEEEE' }),
                D.cell('Pontuação', { bold: true, width: colWidths[3], shade: 'EEEEEE' }),
                D.cell('Pontuação obtida', { bold: true, width: colWidths[4], shade: 'EEEEEE' }),
                D.cell('Documentos comprobatórios (anexos)', { bold: true, width: colWidths[5], shade: 'EEEEEE' }),
            ]);
            const grp = grupos[r] || [];
            const rows = grp.length ? grp.map(i => {
                const pi = LzRSC.pontosItem(i.rsc), c = pi.crit;
                return D.row([
                    D.cell(String(c.item), { width: colWidths[0] }),
                    D.cell(c.desc, { width: colWidths[1] }),
                    D.cell(c.unidade, { width: colWidths[2] }),
                    D.cell(NUM_PT(pi.unitario), { width: colWidths[3] }),
                    D.cell(NUM_PT(pi.pontos), { width: colWidths[4] }),
                    D.cell(evidenciasTexto(i), { width: colWidths[5] }),
                ]);
            }) : [D.row([D.cell('—  nenhum item cadastrado neste critério  —', { width: colWidths.slice(0, 5).reduce((a, b) => a + b, 0) }), D.cell('', { width: colWidths[5] })])];
            const subtotal = D.row([D.cell('Subtotal', { bold: true, width: colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] }),
                D.cell(NUM_PT((sim.porRequisito[r] || { pontos: 0 }).pontos), { bold: true, width: colWidths[4] }),
                D.cell('', { width: colWidths[5] })]);
            parts.push(D.table([head, ...rows, subtotal], colWidths));
        }
        parts.push(D.para([D.run('(Critério I + Critério II + Critério III + Critério IV + Critério V + Critério VI) TOTAL: ', { bold: true }), D.run(NUM_PT(sim.total))]));
        parts.push(D.para(`À vista das informações apresentadas, totalizo ${NUM_PT(sim.total)} pontos e atendo aos critérios legais e regulamentares para o nível ${sim.nivelNome} do RSC-PCCTAE. Solicito a análise pela CRSC-PCCTAE.`));

        // ---- 4. Declaração de Conformidade Legal ----
        parts.push(D.heading('4. Declaração de Conformidade Legal', 2));
        parts.push(D.para('Declaro, para os fins previstos no Decreto regulamentador do RSC-PCCTAE, que:'));
        parts.push(D.para('I - Todos os fatos apresentados ocorreram no exercício do cargo;'));
        parts.push(D.para('II - Nenhuma atividade aqui declarada foi utilizada em requerimentos anteriores;'));
        parts.push(D.para('III - Toda a documentação anexada é autêntica e comprova integralmente as atividades apresentadas; e'));
        parts.push(D.para('IV - Tenho ciência de que informações falsas implicam responsabilidade administrativa, civil e penal.'));
        parts.push(D.para(' '));
        parts.push(D.para('Assinatura: _______________________________________     Data: ____/____/________'));

        return parts.join('');
    }

    async function salvarFormularioDocx(itens, sim, cfg) {
        if (!Storage.hasDirectory()) { toast('Configure um diretório em Configurações para salvar o formulário.', 'aviso'); return; }
        try {
            const bytes = window.LzDocx.buildDocx(rscFormularioBody(itens, sim, cfg));
            const folder = LattesTypes.rscFolder();
            const nomeArquivo = 'Formulario-Requerimento-RSC-PCCTAE.docx';
            await Storage.writeFile(nomeArquivo, bytes, folder);
            toast(`Formulário salvo em "${folder}/${nomeArquivo}".`, 'ok');
        } catch (e) { toast('Falha ao salvar o formulário: ' + e.message, 'erro'); }
    }

    return { render };
})();
