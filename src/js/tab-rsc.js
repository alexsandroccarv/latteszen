/* ==========================================================================
   lattesZen — Aba RSC-PCCTAE (simulador + memorial/formulário)
   --------------------------------------------------------------------------
   Terceira aba extraída de app.js (ver issue de refatoração), mesmo padrão
   das anteriores — lê estado/utilidades de window.AppCore.
   ========================================================================== */
window.TabRsc = (function () {
    const { state, $, esc } = window.AppCore;

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
                <button id="btnRscForm" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-file-signature mr-1"></i> Gerar formulário</button>
            </div>

            <h3 class="font-bold mb-2">Itens contabilizados</h3>
            ${listaHtml}`;

        $('#btnRscCsv').addEventListener('click', () => downloadText(rscCsv(itens), 'rsc-comprovacao.csv', 'text/csv'));
        $('#btnRscMemorial').addEventListener('click', () => downloadText(rscMemorial(itens, sim, cfg), 'rsc-memorial.txt', 'text/plain'));
        $('#btnRscForm').addEventListener('click', () => downloadText(rscFormulario(sim, cfg), 'rsc-formulario.txt', 'text/plain'));
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
    function rscFormulario(sim, cfg) {
        const L = [];
        L.push('FORMULÁRIO — REQUERIMENTO DE RSC-PCCTAE'); L.push('='.repeat(40));
        L.push('1) DADOS FUNCIONAIS');
        L.push(`   Cargo: ${cfg.cargo || '—'}`); L.push(`   Classe/nível: ${cfg.classe || '—'}`);
        L.push(`   SIAPE: ${cfg.siape || '—'}`); L.push(`   Lotação: ${cfg.lotacao || '—'}`);
        L.push(`   Data de ingresso no cargo: ${cfg.ingresso || '—'}`);
        L.push(`   Escolaridade: ${(LzRSC.escInfo(cfg.escolaridade) || {}).label || '—'}`);
        L.push('');
        L.push('2) NÍVEL PLEITEADO');
        L.push(`   Nível RSC-PCCTAE pleiteado: ${sim.nivelNome}`);
        L.push(`   Pontuação apurada: ${sim.total.toString().replace('.', ',')}  |  Critérios distintos: ${sim.criteriosDistintos}`);
        L.push(`   Incentivo à Qualificação correspondente: ${sim.iq}%`);
        L.push('   Saldo de pontos de concessão anterior: ____');
        L.push('');
        L.push('3) DECLARAÇÃO DE CONFORMIDADE');
        L.push('   Declaro que as atividades e experiências relacionadas ocorreram no exercício');
        L.push('   do cargo e que os pontos não foram utilizados em concessões anteriores.');
        L.push('');
        L.push('   Local/Data: ______________________    Assinatura: ______________________');
        return L.join('\n');
    }

    return { render };
})();
