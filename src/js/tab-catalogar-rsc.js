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
   lattesZen — Bloco RSC-PCCTAE dentro do formulário de Catalogar
   --------------------------------------------------------------------------
   Extraído de tab-catalogar.js (issue de refatoração) — bloco autocontido:
   só usa state/$/esc/normNome (AppCore) e LzRSC/LattesTypes (globais), sem
   nenhuma outra dependência do resto do arquivo (a Camada de Visibilidade,
   que fica entre os dois trechos abaixo no arquivo original, é um bloco à
   parte e continua em tab-catalogar.js). Nenhuma mudança de conteúdo, só
   saiu do arquivo único original.
   ========================================================================== */
const { state, $, $$, esc, normNome, t, formatarNumero } = window.AppCore;

    // Camada RSC no formulário (abaixo dos campos do item), quando habilitado.
    // Listener global de "clique fora" do buscador de critério — fechado/
    // recriado a cada renderRscBlock (roda de novo a cada item aberto); sem
    // isso, cada render empilharia mais um listener em document, nunca
    // removido (memory leak).
    let critOutsideClickHandler = null;
    export function renderRscBlock(item) {
        const box = $('#rscBlock'); if (!box) return;
        if (critOutsideClickHandler) { document.removeEventListener('click', critOutsideClickHandler); critOutsideClickHandler = null; }
        const typeKey = $('#selTipo') ? $('#selTipo').value : '';
        const eligivel = state.rsc.enabled && typeKey && !LattesTypes.isPerfilType(typeKey) && !LattesTypes.isNaoLattesType(typeKey);
        if (!eligivel) { box.innerHTML = ''; return; }
        const rsc = (item && item.rsc) || {};
        // Lista única com TODOS os critérios do decreto (~50 itens), agrupados
        // por Requisito — extensa demais pra rolar procurando um item específico
        // (issue #24). Achatada uma vez aqui; critListaHtml() a filtra em tempo
        // real conforme o usuário digita, exibida como lista clicável (issue
        // #25) em vez de um <select> que só mostra o resultado depois de aberto.
        const todosCriterios = Object.keys(LzRSC.REQUISITOS).flatMap(r =>
            LzRSC.criteriosDoRequisito(r).map(c => ({ ...c, reqLabel: LzRSC.REQUISITOS[r] })));
        function criteriosFiltrados(filtro) {
            const q = normNome(filtro || '');
            if (!q) return todosCriterios;
            return todosCriterios.filter(c => normNome(`${c.item} ${c.desc} ${c.unidade}`).includes(q));
        }
        function labelDoCriterio(id) {
            const c = todosCriterios.find(x => x.id === id);
            return c ? `${c.item}. ${c.desc} — ${c.unidade} · ${formatarNumero(c.pontos)} pts` : '';
        }
        // id previsível por critério (usado em aria-activedescendant, abaixo)
        const critOptId = (id) => `rsc-crit-opt-${id}`;
        function critListaHtml(filtro) {
            const encontrados = criteriosFiltrados(filtro);
            if (!encontrados.length) return `<p class="px-2 py-2 text-sm text-gray-500 italic">${esc(t('tab_catalogar_rsc.nenhum_criterio', 'Nenhum critério encontrado.'))}</p>`;
            const porReq = {};
            encontrados.forEach(c => (porReq[c.reqLabel] = porReq[c.reqLabel] || []).push(c));
            return Object.keys(porReq).map(label => {
                const itens = porReq[label].map(c =>
                    `<button type="button" id="${critOptId(c.id)}" role="option" data-crit="${c.id}" class="block w-full text-left px-2 py-1.5 text-sm hover:bg-amber-100 dark:hover:bg-gray-700">${c.item}. ${esc(c.desc)} — ${esc(c.unidade)} · ${formatarNumero(c.pontos)} pts</button>`).join('');
                return `<div><p class="sticky top-0 px-2 py-1 text-[11px] font-semibold text-gray-500 bg-gray-50 dark:bg-gray-800">${esc(t('tab_catalogar_rsc.requisito_label', 'Requisito {label}', { label }))}</p>${itens}</div>`;
            }).join('');
        }
        box.innerHTML = `
        <div id="rscFields" class="${rsc.conta ? '' : 'hidden'} bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded px-3 py-2 space-y-2">
            <div class="relative"><label class="block text-xs font-semibold mb-1" for="rscCritFiltro">${esc(t('tab_catalogar_rsc.criterio_especifico', 'Critério específico (Anexos I–VI do Decreto)'))}</label>
                <input type="text" id="rscCritFiltro" autocomplete="off" placeholder="${esc(t('tab_catalogar_rsc.criterio_placeholder', 'Digite pra buscar (ex.: prêmio, capacitação, comissão...)'))}"
                       value="${esc(labelDoCriterio(rsc.criterio))}"
                       role="combobox" aria-expanded="false" aria-controls="rscCritLista" aria-autocomplete="list"
                       class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                <input type="hidden" id="rscCrit" value="${esc(rsc.criterio || '')}">
                <div id="rscCritLista" role="listbox" aria-label="${esc(t('tab_catalogar_rsc.criterios_encontrados_aria', 'Critérios encontrados'))}" class="hidden absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-lg"></div>
                <p class="text-[11px] text-gray-500 mt-0.5">${esc(t('tab_catalogar_rsc.criterios_ajuda', 'Todos os critérios do decreto estão listados, agrupados por Requisito (I a VI). Digite acima para filtrar.'))}</p></div>
            <p class="text-[11px] text-gray-500"><i aria-hidden="true" class="fa-solid fa-calendar-days mr-1"></i>${t('tab_catalogar_rsc.periodo_ajuda', 'Para critérios por tempo (ano/mês), o período é calculado a partir dos campos de <strong>data</strong> do item acima (início/fim).')}</p>
            <div class="grid sm:grid-cols-2 gap-2">
                <div id="rscPapelWrap" class="hidden"><label class="block text-xs font-semibold mb-1" for="rscPapel">${esc(t('tab_catalogar_rsc.papel', 'Papel'))}</label>
                    <select id="rscPapel" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                        <option value="titular" ${rsc.papel !== 'substituto' ? 'selected' : ''}>${esc(t('tab_catalogar_rsc.papel_titular', 'Titular'))}</option>
                        <option value="substituto" ${rsc.papel === 'substituto' ? 'selected' : ''}>${esc(t('tab_catalogar_rsc.papel_substituto', 'Substituto'))}</option></select></div>
                <div id="rscQtdWrap" class="hidden"><label class="block text-xs font-semibold mb-1" for="rscQtd">${esc(t('tab_catalogar_rsc.quantidade', 'Quantidade'))}</label>
                    <input id="rscQtd" type="number" min="0" step="1" value="${esc(rsc.quantidade != null ? rsc.quantidade : 1)}" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></div>
            </div>
            <div><label class="block text-xs font-semibold mb-1" for="rscJust">${esc(t('tab_catalogar_rsc.justificativa', 'Justificativa (para o memorial)'))}</label>
                <textarea id="rscJust" rows="2" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">${esc(rsc.justificativa || '')}</textarea></div>
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="rscUsado" ${rsc.jaUsado ? 'checked' : ''}> ${esc(t('tab_catalogar_rsc.ja_usado', 'Já utilizado em concessão anterior (não conta no saldo)'))}</label>
            <p id="rscPontos" class="text-sm font-semibold text-amber-700 dark:text-amber-400"></p>
        </div>`;

        // O checkbox "usar para RSC" mora no bloco de Visibilidade (renderizado
        // ANTES deste, ver renderDynFields) — junto com "Lattes"/"Web" na
        // linha "Publicar". Aqui só lemos o elemento pelo id (documento
        // inteiro, não precisa estar dentro de #rscBlock).
        const conta = $('#rscConta'), fields = $('#rscFields'), critHidden = $('#rscCrit');
        if (!conta) return; // não deveria acontecer (mesma condição de elegibilidade em renderVisibilidadeBlock)
        function recompute() {
            const crit = LzRSC.criterio(critHidden.value);
            $('#rscPapelWrap').classList.toggle('hidden', !(crit && crit.pontosSub != null));
            $('#rscQtdWrap').classList.toggle('hidden', !(crit && crit.calc === 'unidade'));
            const data = collectRsc($('#itemForm'));
            const pi = LzRSC.pontosItem(data);
            const el = $('#rscPontos');
            if (!crit) { el.textContent = t('tab_catalogar_rsc.selecione_criterio', 'Selecione o critério para calcular os pontos.'); return; }
            el.textContent = t('tab_catalogar_rsc.pontos_resultado', 'Pontos: {pontos}  ({quantidade} × {unitario} · {unidade})', {
                pontos: formatarNumero(pi.pontos),
                quantidade: pi.quantidade,
                unitario: formatarNumero(pi.unitario),
                unidade: crit.unidade,
            });
        }
        conta.addEventListener('change', () => { fields.classList.toggle('hidden', !conta.checked); state.ui.formDirty = true; recompute(); });

        // Buscador de critério (issues #24/#25): lista de resultados clicável
        // logo abaixo do campo, refeita a cada tecla — em vez de um <select>
        // que só mostrava o filtro depois de clicar pra abrir.
        const critFiltro = $('#rscCritFiltro'), critLista = $('#rscCritLista');
        // Última seleção CONFIRMADA (clicada de fato) — separada de
        // critHidden.value, que fica vazio enquanto o usuário digita (só volta
        // a valer algo quando ele clica num resultado). É o que "restaurar o
        // campo" (clique fora / Esc sem escolher) usa como valor de retorno.
        let criterioConfirmado = rsc.criterio || '';
        // Semântica ARIA de combobox (issue de acessibilidade #17): sem
        // isto, um leitor de tela não anunciava que o campo abre uma lista
        // de opções, nem qual delas estava "em destaque" ao navegar com
        // ↓/↑ — aria-expanded reflete aberto/fechado, aria-activedescendant
        // aponta pro <button role="option"> destacado no momento (sem
        // mover o foco de verdade pra fora do campo de texto).
        const abrirLista = (filtro) => {
            critLista.innerHTML = critListaHtml(filtro);
            critLista.classList.remove('hidden');
            critFiltro.setAttribute('aria-expanded', 'true');
            critFiltro.removeAttribute('aria-activedescendant');
        };
        const fecharLista = () => {
            critLista.classList.add('hidden');
            critFiltro.setAttribute('aria-expanded', 'false');
            critFiltro.removeAttribute('aria-activedescendant');
        };
        const restaurarConfirmado = () => {
            critHidden.value = criterioConfirmado;
            critFiltro.value = labelDoCriterio(criterioConfirmado);
            recompute();
        };
        function selecionarCriterio(id) {
            criterioConfirmado = id;
            critHidden.value = id;
            critFiltro.value = labelDoCriterio(id);
            fecharLista();
            state.ui.formDirty = true;
            recompute();
        }
        // Destaque por teclado (↓/↑) entre as opções visíveis no momento —
        // move só o "destaque" visual/aria-activedescendant, o foco real
        // continua no campo de texto (padrão combobox do WAI-ARIA APG).
        function opcoesVisiveis() { return $$('[role="option"]', critLista); }
        function destacar(btn) {
            opcoesVisiveis().forEach(o => o.classList.remove('bg-amber-100', 'dark:bg-gray-700'));
            if (!btn) { critFiltro.removeAttribute('aria-activedescendant'); return; }
            btn.classList.add('bg-amber-100', 'dark:bg-gray-700');
            btn.scrollIntoView({ block: 'nearest' });
            critFiltro.setAttribute('aria-activedescendant', btn.id);
        }
        critFiltro.addEventListener('focus', () => abrirLista(critFiltro.value));
        critFiltro.addEventListener('input', (e) => {
            // Não deixa o evento borbulhar até o listener de #itemForm (que
            // marca state.ui.formDirty a qualquer "input" no formulário) — só
            // vira dado do item quando um resultado é de fato clicado.
            e.stopPropagation();
            critHidden.value = ''; // texto mudou: a seleção anterior não vale mais até escolher de novo (ou restaurar)
            abrirLista(critFiltro.value);
            recompute();
        });
        critFiltro.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                fecharLista();
                restaurarConfirmado();
                critFiltro.blur();
                return;
            }
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
            const opcoes = opcoesVisiveis();
            if (!opcoes.length) return;
            e.preventDefault();
            if (e.key === 'Enter') {
                const atual = opcoes.find(o => o.id === critFiltro.getAttribute('aria-activedescendant'));
                if (atual) selecionarCriterio(atual.dataset.crit);
                return;
            }
            const atualIdx = opcoes.findIndex(o => o.id === critFiltro.getAttribute('aria-activedescendant'));
            const proximo = e.key === 'ArrowDown' ? (atualIdx + 1) % opcoes.length : (atualIdx - 1 + opcoes.length) % opcoes.length;
            destacar(opcoes[proximo]);
        });
        critLista.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-crit]');
            if (btn) selecionarCriterio(btn.dataset.crit);
        });
        // Clique fora do campo/lista: fecha e, se o texto digitado não virou
        // uma seleção de verdade, volta a mostrar o critério anterior (não
        // deixa texto solto sem critério real por trás).
        critOutsideClickHandler = (e) => {
            if (critLista.classList.contains('hidden')) return;
            if (e.target === critFiltro || critLista.contains(e.target)) return;
            fecharLista();
            restaurarConfirmado();
        };
        document.addEventListener('click', critOutsideClickHandler);

        ['change', 'input'].forEach(ev => $('#rscFields').addEventListener(ev, () => { state.ui.formDirty = true; recompute(); }));
        // O período do RSC vem dos campos de data do item: recalcula ao editá-los.
        const itemForm = $('#itemForm');
        ['anoInicio', 'anoFim', 'ano'].forEach(name => {
            const el = itemForm && itemForm.elements ? itemForm.elements[name] : null;
            if (el && el.addEventListener) el.addEventListener('input', recompute);
        });
        recompute();
    }

    // Normaliza ano/data-completa para dd/mm/aaaa (usado no período do RSC —
    // item.rsc.dataInicio/dataFim, consumido por LzRSC.parseBR, sempre nesse
    // formato). 'aaaa' vira 01/01/aaaa (início) ou 31/12/aaaa (fim).
    // Duas origens possíveis pra `v`: 1) o CANÔNICO de um campo `datebr` do
    // próprio item (aaaa/mmaaaa/ddmmaaaa, sem separador, sempre ordem
    // dia-mês-ano — ver collectRsc/fld abaixo, que já lê o canônico, não o
    // texto exibido no campo); 2) "Data de abrangência (final)", um campo de
    // texto solto em Configurações › RSC, sempre dd/mm/aaaa OU aaaa (não
    // passa pela máscara/locale de datebr). ISO aaaa-mm-dd também aceito
    // (legado).
    function _rscToBR(v, endOfYear) {
        const s = String(v == null ? '' : v).trim();
        if (!s) return '';
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
        let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        m = s.match(/^(\d{2})\/(\d{4})$/); // mm/aaaa (com separador — Data de abrangência)
        if (m) return _ultimoOuPrimeiroDia(m[1], m[2], endOfYear);
        const d = s.replace(/\D/g, '');
        if (d.length === 8) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`; // ddmmaaaa canônico
        if (d.length === 6) return _ultimoOuPrimeiroDia(d.slice(0, 2), d.slice(2), endOfYear); // mmaaaa canônico
        if (d.length === 4) return endOfYear ? `31/12/${d}` : `01/01/${d}`; // aaaa
        return '';
    }
    function _ultimoOuPrimeiroDia(mm, aaaa, endOfYear) {
        if (!endOfYear) return `01/${mm}/${aaaa}`;
        const ultimoDia = new Date(Number(aaaa), Number(mm), 0).getDate();
        return `${String(ultimoDia).padStart(2, '0')}/${mm}/${aaaa}`;
    }
    // Lê a camada RSC do formulário → objeto rsc (ou {conta:false}). O período
    // (início/fim) é derivado dos campos de data do próprio item, não mais de
    // campos de data no bloco RSC (evita redundância). Itens ainda em
    // exercício (situação "Atual (não finalizado)") não têm data de fim
    // própria — nesse caso, o fim do período usado no cálculo é a "Data de
    // abrangência (final)" configurada em Configurações › RSC (issue #27):
    // sem isso, esses itens nunca teriam o tempo decorrido contado.
    export function collectRsc(form) {
        const conta = form.querySelector('#rscConta');
        if (!conta) return null;
        const val = id => { const el = form.querySelector('#' + id); return el ? el.value.trim() : ''; };
        const chk = id => { const el = form.querySelector('#' + id); return !!(el && el.checked); };
        // anoInicio/anoFim/ano são campos `datebr` — lê o CANÔNICO
        // (data-canonico, sempre dd-mm-aaaa, ver fieldDateBr/wireDateBr em
        // tab-catalogar.js), não o texto exibido (que pode estar em mm/dd
        // conforme o locale ativo) — senão _rscToBR interpretaria errado.
        const fld = name => { const el = form.elements ? form.elements[name] : null; return el ? (el.dataset.canonico || '') : ''; };
        const dataAbrangencia = (state.rsc.cfg && state.rsc.cfg.dataAbrangenciaFinal) || '';
        return {
            conta: conta.checked,
            criterio: val('rscCrit'),
            dataInicio: _rscToBR(fld('anoInicio'), false),
            dataFim: _rscToBR(fld('anoFim') || fld('ano'), true) || _rscToBR(dataAbrangencia, true),
            papel: val('rscPapel') || 'titular',
            quantidade: val('rscQtd') || '',
            justificativa: val('rscJust'), jaUsado: chk('rscUsado'),
        };
    }
