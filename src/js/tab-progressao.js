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
   lattesZen — Aba Progressão Docente Unifesp
   --------------------------------------------------------------------------
   Módulo opcional, mesmo padrão do RSC-PCCTAE e da Súmula Curricular FAPESP
   (tab-rsc.js/tab-sumula.js): habilitado em Configurações › Módulos,
   totalmente em pt-br (sem i18n — regras da CPPD/Unifesp só existem em
   português, mesmo motivo do RSC/Súmula).

   Etapa inicial (conversamos antes de implementar — ver memorial anotado):
   só a entrada manual dos dados que NENHUM outro módulo do lattesZen tem
   hoje — "Lotação" (Campus/Unidade/Departamento) não existe em nenhum tipo
   Lattes, e a data da última progressão não pode ser obtida automaticamente
   (Portal da Transparência só expõe data de ingresso no cargo, não de
   progressão — investigado e descartado). O restante do módulo (memorial,
   interstício, exportação) fica para as próximas etapas.
   ========================================================================== */
window.TabProgressao = (function () {
    const { state, $, $$, esc, toast, itemYear, anoDe } = window.AppCore;

    function labelHtml(forId, lbl) {
        return `<label class="block text-xs font-semibold mb-1" for="${forId}">${esc(lbl)}</label>`;
    }
    function inp(c, k, lbl, ph, validateKind) {
        return `<div>${labelHtml('progressao-' + k, lbl)}
            <input id="progressao-${k}" type="text" value="${esc(c[k] || '')}" placeholder="${esc(ph || '')}" ${validateKind ? `data-validate="${validateKind}"` : ''} class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></div>`;
    }

    function progressaoCfgSectionHtml(cfg) {
        const c = cfg || {};
        return `<section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
            <h3 class="font-bold text-sm mb-2 flex items-center gap-2"><i class="fa-solid fa-id-card text-govbr-600 dark:text-unifesp-400"></i> ${esc('Progressão Docente: Dados funcionais')}</h3>
            <p class="text-xs text-gray-500 mb-2">${esc('Nenhum desses dados existe em outro módulo do lattesZen — preencha manualmente.')}</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                ${inp(c, 'dataPosse', 'Data de posse', '25/12/2026', 'dataCompleta')}
                ${inp(c, 'dataUltimaProgressao', 'Data da última progressão', '25/12/2026', 'dataCompleta')}
                ${inp(c, 'campus', 'Campus', '')}
                ${inp(c, 'unidade', 'Unidade universitária', '')}
                ${inp(c, 'departamento', 'Departamento', '')}
            </div>
            <div class="flex gap-2 mt-3">
                <button id="btnSaveProgressaoCfg" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-floppy-disk mr-1"></i> ${esc('Salvar')}</button>
            </div>
        </section>`;
    }
    function wireProgressaoCfgSection() {
        window.AppCore.wireValidators($('#tab-progressao'));
        const btn = $('#btnSaveProgressaoCfg'); if (!btn) return;
        btn.addEventListener('click', () => {
            const keys = ['dataPosse', 'dataUltimaProgressao', 'campus', 'unidade', 'departamento'];
            const cfg = {};
            let temErro = false;
            keys.forEach((k) => {
                const el = $('#progressao-' + k); if (!el) return;
                const v = el.value.trim();
                if (el.dataset.validate) {
                    const res = window.AppCore.validateField(el.dataset.validate, v);
                    if (v && !res.ok) { window.AppCore.setFieldError(el, res.msg); temErro = true; return; }
                    window.AppCore.setFieldError(el, '');
                }
                cfg[k] = v;
            });
            if (temErro) { toast('Corrija os campos destacados antes de salvar.', 'erro'); return; }
            state.progressao.cfg = cfg;
            const s = Storage.loadSettings(); s.progressao = cfg; Storage.saveSettings(s);
            window.AppCore.persistirProgressao();
            toast('Dados funcionais da Progressão Docente salvos.', 'ok');
            render();
        });
    }

    /* ------------------------- Itens candidatos ------------------------- */
    // A partir da "data da última progressão" e do mapeamento memorial ↔
    // Lattes (ver progressao-mapeamento.js), lista os itens do catálogo que
    // são candidatos ao memorial: typeKey mapeado (verde ou amarelo) e
    // datados a partir daquela data (ou sem ano legível — entram por
    // segurança, pra não esconder itens em andamento sem data de fim).
    // Sem a data ainda preenchida, mostra todos os itens mapeados (nada pra
    // cortar ainda). O "usar na Progressão" em si é marcado na própria aba
    // Catalogar (mesmo mecanismo do RSC-PCCTAE — ver renderVisibilidadeBlock
    // em tab-catalogar.js) — aqui é só a lista de revisão + atalho "Editar".
    function candidatosProgressao() {
        const cfg = state.progressao.cfg || {};
        const anoRefStr = anoDe(cfg.dataUltimaProgressao || '');
        const anoRef = anoRefStr ? parseInt(anoRefStr, 10) : null;
        return state.catalogo.items
            .map((item) => ({ item, status: window.LzProgressaoMapa.status(item) }))
            .filter(({ status, item }) => {
                if (!status) return false;
                if (anoRef == null) return true;
                const ano = itemYear(item);
                return ano == null || ano >= anoRef;
            })
            .sort((a, b) => (itemYear(b.item) || 0) - (itemYear(a.item) || 0));
    }

    function candidatosSectionHtml() {
        const candidatos = candidatosProgressao();
        const cfg = state.progressao.cfg || {};
        const marcados = candidatos.filter(({ item }) => item.progressao && item.progressao.usar).length;
        return `<section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 class="font-bold text-sm mb-2 flex items-center gap-2"><i class="fa-solid fa-list-check text-govbr-600 dark:text-unifesp-400"></i> ${esc('Itens candidatos ao memorial')} ${candidatos.length ? `<span class="text-xs font-normal text-gray-500">(${esc(String(marcados))} de ${esc(String(candidatos.length))} marcados)</span>` : ''}</h3>
            <p class="text-xs text-gray-500 mb-3">${cfg.dataUltimaProgressao
                ? esc(`Itens do catálogo datados a partir de ${cfg.dataUltimaProgressao} (ou sem ano definido) com correspondência no memorial da CPPD. `)
                : esc('Informe a "Data da última progressão" acima para restringir a lista ao período correto — por enquanto, todos os itens com correspondência no memorial. ')}${esc('Marque "usar na Progressão" na própria aba Catalogar (mesmo mecanismo do RSC-PCCTAE): itens ')}<span class="text-green-600 dark:text-green-400 font-semibold">${esc('verdes')}</span>${esc(' precisam só do checkbox; itens ')}<span class="text-amber-600 dark:text-amber-400 font-semibold">${esc('amarelos')}</span>${esc(' têm lacunas cujos campos complementares ainda vamos desenhar juntos.')}</p>
            ${!candidatos.length ? `<p class="text-sm text-gray-500 italic py-4 text-center">${esc('Nenhum item candidato encontrado ainda — cadastre itens em Catalogar.')}</p>` : `
            <div class="space-y-1 max-h-[32rem] overflow-y-auto">
                ${candidatos.map(({ item, status }) => {
                    const marcado = !!(item.progressao && item.progressao.usar);
                    const cor = status === 'verde' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';
                    const bg = status === 'verde' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800';
                    const ano = itemYear(item);
                    return `<div class="flex items-center justify-between gap-2 border ${bg} rounded px-2 py-1.5 text-sm">
                        <div class="min-w-0 flex-1 truncate">
                            <span class="${cor}"><i aria-hidden="true" class="fa-solid ${marcado ? 'fa-square-check' : 'fa-square'}"></i></span>
                            <span class="ml-1">${esc(LattesTypes.itemTitle(item))}</span>
                            ${ano ? `<span class="text-xs text-gray-400 ml-1">(${esc(String(ano))})</span>` : ''}
                        </div>
                        <button type="button" data-editar="${esc(item.id)}" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 shrink-0">${esc('Editar')}</button>
                    </div>`;
                }).join('')}
            </div>`}
        </section>`;
    }
    function wireCandidatosSection(panel) {
        $$('[data-editar]', panel).forEach((btn) => {
            btn.addEventListener('click', () => {
                const item = state.catalogo.items.find((i) => i.id === btn.dataset.editar);
                if (!item) return;
                window.AppCore.switchTab('catalogar');
                window.AppCore.buildForm(item);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    function render() {
        const panel = $('#tab-progressao');
        if (!state.progressao.enabled) {
            panel.innerHTML = `<p class="text-sm text-gray-500 italic py-8 text-center">Módulo Progressão Docente Unifesp desabilitado. Habilite em <strong>Configurações › Unifesp: Progressão docente</strong>.</p>`;
            return;
        }
        const cfg = state.progressao.cfg || {};
        panel.innerHTML = `
            <h2 class="text-xl font-bold mb-4 flex items-center gap-2"><i class="fa-solid fa-arrow-up-right-dots text-govbr-600 dark:text-unifesp-400"></i> ${esc('Progressão Docente Unifesp')}</h2>
            ${progressaoCfgSectionHtml(cfg)}
            ${candidatosSectionHtml()}`;
        wireProgressaoCfgSection();
        wireCandidatosSection(panel);
    }

    return { render };
})();
