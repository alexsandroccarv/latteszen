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
    const { state, $, esc, toast } = window.AppCore;

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

    function render() {
        const panel = $('#tab-progressao');
        if (!state.progressao.enabled) {
            panel.innerHTML = `<p class="text-sm text-gray-500 italic py-8 text-center">Módulo Progressão Docente Unifesp desabilitado. Habilite em <strong>Configurações › Unifesp: Progressão docente</strong>.</p>`;
            return;
        }
        const cfg = state.progressao.cfg || {};
        panel.innerHTML = `
            <h2 class="text-xl font-bold mb-4 flex items-center gap-2"><i class="fa-solid fa-arrow-up-right-dots text-govbr-600 dark:text-unifesp-400"></i> ${esc('Progressão Docente Unifesp')}</h2>
            ${progressaoCfgSectionHtml(cfg)}`;
        wireProgressaoCfgSection();
    }

    return { render };
})();
