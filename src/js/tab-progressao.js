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
    // fileExt/checkEvidenceFile/allowedExtsForAccept/EVID_ACCEPT_DEFAULT NÃO
    // entram nessa desestruturação: são publicados em window.AppCore pelo
    // app.js, que carrega DEPOIS de tab-progressao.js (ver <script> em
    // index.html) — nesse instante ainda seriam `undefined`. Acessados como
    // window.AppCore.X() só quando usados (já carregado a essa altura),
    // mesmo padrão do checkEvidenceFile em tab-catalogar-evidencias.js.

    // Filtro por categoria da lista "itens candidatos" (Mockup B) — estado
    // do módulo, não de settings: só controla o que fica visível na tela,
    // não é salvo. null = "Todas".
    let filtroCategoria = null;
    // Prévia do item 3 do memorial (Atividades de Extensão) — mesmo tipo de
    // estado que filtroCategoria acima, também não salvo.
    let mostrarPreviaItem3 = false;

    // Começa `readonly` até o primeiro foco — mesmo mecanismo usado em todo
    // formulário de Catalogar (ver RO/wireReadonlyUntilFocus em
    // tab-catalogar.js): sem isso, o Chrome (e afins) autopreenche campos
    // como "Campus"/"Departamento" com sugestões de endereço só pelo nome
    // do rótulo, mesmo sem o usuário ter digitado nada ali antes.
    const RO = 'readonly data-ro-focus';
    function labelHtml(forId, lbl) {
        return `<label class="block text-xs font-semibold mb-1" for="${forId}">${esc(lbl)}</label>`;
    }
    function inpTexto(c, k, lbl) {
        return `<div>${labelHtml('progressao-' + k, lbl)}
            <input id="progressao-${k}" type="text" value="${esc(c[k] || '')}" autocomplete="off" ${RO} class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></div>`;
    }
    // Campus da Unifesp — lista fechada (pedido do Alexsandro), em vez de
    // texto livre: evita grafias divergentes do mesmo campus entre itens
    // diferentes (ex.: "São José dos Campos" vs. "S. J. dos Campos").
    const CAMPUS_OPCOES = ['Baixada Santista', 'Diadema', 'Guarulhos', 'Osasco', 'Reitoria', 'São José dos Campos', 'São Paulo', 'Zona Leste'];
    function inpCampus(c) {
        const v = c.campus || '';
        return `<div>${labelHtml('progressao-campus', 'Campus')}
            <select id="progressao-campus" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                <option value="">—</option>
                ${CAMPUS_OPCOES.map((o) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}
            </select></div>`;
    }
    // Unidade universitária — também lista fechada (pedido do Alexsandro),
    // mas dependente do Campus escolhido: cada campus da Unifesp tem seu
    // próprio conjunto de institutos/escolas. Reitoria não tem unidades
    // subordinadas no mesmo sentido (é a própria administração central),
    // então aparece como opção única dela mesma.
    const UNIDADES_POR_CAMPUS = {
        'Baixada Santista': ['Instituto do Mar (IMar)', 'Instituto Saúde e Sociedade (ISS)'],
        Diadema: ['Instituto de Ciências Ambientais, Químicas e Farmacêuticas (ICAQF)'],
        Guarulhos: ['Escola de Filosofia, Letras e Ciências Humanas (EFLCH)'],
        Osasco: ['Escola Paulista de Política, Economia e Negócios (EPPEN)'],
        Reitoria: ['Reitoria'],
        'São José dos Campos': ['Instituto de Ciência e Tecnologia (ICT)'],
        'São Paulo': ['Escola Paulista de Medicina (EPM)', 'Escola Paulista de Enfermagem (EPE)'],
        'Zona Leste': ['Instituto das Cidades (IC)'],
    };
    // Se o valor salvo não bater com nenhuma opção do campus atual (dado
    // legado, digitado quando "Unidade" ainda era texto livre), mantém como
    // opção extra em vez de descartar silenciosamente.
    function unidadeOpcoesHtml(campus, v) {
        const opcoes = UNIDADES_POR_CAMPUS[campus] || [];
        const todas = v && !opcoes.includes(v) ? [...opcoes, v] : opcoes;
        return '<option value="">—</option>' + todas.map((o) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('');
    }
    function inpUnidade(c) {
        return `<div>${labelHtml('progressao-unidade', 'Unidade universitária')}
            <select id="progressao-unidade" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                ${unidadeOpcoesHtml(c.campus || '', c.unidade || '')}
            </select></div>`;
    }
    function wireUnidadeFiltro() {
        const campusEl = $('#progressao-campus');
        const unidadeEl = $('#progressao-unidade');
        if (!campusEl || !unidadeEl) return;
        campusEl.addEventListener('change', () => {
            unidadeEl.innerHTML = unidadeOpcoesHtml(campusEl.value, '');
        });
    }
    // Classe/nível funcional atual — dado usado no cabeçalho do memorial
    // (carreira docente Lei 12.772/2012). Também lista fechada, mesmo
    // motivo do Campus/Unidade: evita grafias divergentes ("Adjunto" vs.
    // "Prof. Adjunto"). Não é o mesmo que o item VINCULO_PROFISSIONAL do
    // catálogo (esse continua um candidato "amarelo" normal) — aqui é o
    // dado funcional atual, preenchido uma vez, igual Campus/Unidade.
    const CLASSE_OPCOES = ['Auxiliar', 'Assistente', 'Adjunto', 'Associado', 'Titular'];
    const NIVEL_OPCOES = ['1', '2', '3', '4'];
    function inpSelectFechado(id, lbl, opcoes, v) {
        return `<div>${labelHtml(id, lbl)}
            <select id="${id}" class="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                <option value="">—</option>
                ${opcoes.map((o) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}
            </select></div>`;
    }
    function inpClasse(c) {
        return inpSelectFechado('progressao-classe', 'Classe atual', CLASSE_OPCOES, c.classe || '');
    }
    function inpNivel(c) {
        return inpSelectFechado('progressao-nivel', 'Nível atual', NIVEL_OPCOES, c.nivel || '');
    }
    // Regime de trabalho — mesma estratégia de lista fechada.
    const REGIME_OPCOES = ['20h semanais', '40h semanais', 'Dedicação exclusiva'];
    function inpRegime(c) {
        return inpSelectFechado('progressao-regime', 'Regime de trabalho', REGIME_OPCOES, c.regime || '');
    }
    // Campo de data com a MESMA máscara dd/mm/aaaa (auto-insere as barras
    // enquanto digita, largura fixa) usada em qualquer campo de data de
    // Catalogar — ver wireDateBr em tab-catalogar.js. Módulo 100% pt-br
    // (sem i18n — ver cabeçalho do arquivo), então sem a complexidade de
    // ordem por locale que existe lá: aqui é sempre dd/mm/aaaa.
    function inpData(c, k, lbl) {
        return `<div>${labelHtml('progressao-' + k, lbl)}
            <input id="progressao-${k}" type="text" value="${esc(c[k] || '')}" autocomplete="off" ${RO} inputmode="numeric" maxlength="10" placeholder="dd/mm/aaaa" data-datebr data-validate="dataCompleta" class="w-32 text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"></div>`;
    }
    // Evidência da "Data da última progressão" (ex.: declaração da
    // Propessoas) — anexo único, salvo à parte do formulário (não dá pra
    // adiar um File pro clique de "Salvar", já que ele não sobrevive a um
    // reload da página): grava assim que escolhido, igual à bandeja de
    // evidências de Catalogar (mesmo Storage.writeAttachment/checkEvidenceFile
    // — ver tab-catalogar-evidencias.js), só que como um anexo AVULSO (sem
    // item do catálogo por trás), numa pasta própria do módulo
    // (LattesTypes.progressaoDocentesFolder()). Só metadado ({nome, ext}) fica
    // em settings.progressao — o conteúdo do arquivo mora no diretório/Drive.
    const EVIDENCIA_BASENAME = 'evidencia-ultima-progressao';
    function inpDataUltimaProgressaoComEvidencia(c) {
        const ev = c.evidenciaUltimaProgressao || null;
        return `<div>${labelHtml('progressao-dataUltimaProgressao', 'Data da última progressão')}
            <div class="flex items-center gap-2 flex-wrap">
                <input id="progressao-dataUltimaProgressao" type="text" value="${esc(c.dataUltimaProgressao || '')}" autocomplete="off" ${RO} inputmode="numeric" maxlength="10" placeholder="dd/mm/aaaa" data-datebr data-validate="dataCompleta" class="w-32 text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900">
                <button type="button" id="btnEvidenciaUltimaProgressao" class="text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 shrink-0"><i aria-hidden="true" class="fa-solid fa-paperclip mr-1"></i>${esc(ev ? 'Trocar evidência' : 'Anexar evidência')}</button>
                <input type="file" id="progressao-evidenciaInput" class="hidden" accept="${esc(window.AppCore.EVID_ACCEPT_DEFAULT)}">
            </div>
            <div id="progressao-evidenciaInfo" class="text-xs mt-1">
                ${ev
                    ? `<a href="#" id="linkVerEvidenciaUltimaProgressao" class="text-govbr-600 dark:text-unifesp-400 underline">${esc(ev.nome)}</a> <button type="button" id="btnRemoverEvidenciaUltimaProgressao" class="ml-2 text-red-600 dark:text-red-400">${esc('Remover')}</button>`
                    : `<span class="text-gray-500">${esc('Evidência (opcional): declaração da Propessoas confirmando a data.')}</span>`}
            </div>
        </div>`;
    }
    function wireEvidenciaUltimaProgressao() {
        const btnAnexar = $('#btnEvidenciaUltimaProgressao');
        const inputEv = $('#progressao-evidenciaInput');
        if (btnAnexar && inputEv) {
            btnAnexar.addEventListener('click', () => inputEv.click());
            inputEv.addEventListener('change', async () => {
                const file = inputEv.files && inputEv.files[0];
                inputEv.value = '';
                if (!file) return;
                const err = window.AppCore.checkEvidenceFile(file, window.AppCore.allowedExtsForAccept(window.AppCore.EVID_ACCEPT_DEFAULT));
                if (err) { toast(err, 'aviso'); return; }
                if (!Storage.hasDirectory()) {
                    toast('Configure um diretório de armazenamento (ou Google Drive) em Configurações antes de anexar evidências.', 'aviso');
                    return;
                }
                const ext = window.AppCore.fileExt(file);
                try {
                    await Storage.writeAttachment(EVIDENCIA_BASENAME, file, LattesTypes.progressaoDocentesFolder(), ext);
                } catch (e) {
                    toast('Não foi possível salvar a evidência: ' + e.message, 'erro');
                    return;
                }
                const cfg = { ...(state.progressao.cfg || {}), evidenciaUltimaProgressao: { nome: file.name, ext } };
                state.progressao.cfg = cfg;
                const s = Storage.loadSettings(); s.progressao = cfg; Storage.saveSettings(s);
                window.AppCore.persistirProgressao();
                toast('Evidência anexada.', 'ok');
                render();
            });
        }
        const linkVer = $('#linkVerEvidenciaUltimaProgressao');
        if (linkVer) {
            linkVer.addEventListener('click', async (e) => {
                e.preventDefault();
                const ev = (state.progressao.cfg || {}).evidenciaUltimaProgressao;
                if (!ev) return;
                const url = await Storage.readAttachmentUrl(EVIDENCIA_BASENAME, LattesTypes.progressaoDocentesFolder(), ev.ext);
                if (!url) { toast('Não foi possível abrir a evidência.', 'erro'); return; }
                window.open(url, '_blank');
            });
        }
        const btnRemover = $('#btnRemoverEvidenciaUltimaProgressao');
        if (btnRemover) {
            btnRemover.addEventListener('click', async () => {
                if (!confirm('Remover a evidência anexada?')) return;
                try { await Storage.deleteEntry(EVIDENCIA_BASENAME, LattesTypes.progressaoDocentesFolder()); } catch (_) {}
                const cfg = { ...(state.progressao.cfg || {}) };
                delete cfg.evidenciaUltimaProgressao;
                state.progressao.cfg = cfg;
                const s = Storage.loadSettings(); s.progressao = cfg; Storage.saveSettings(s);
                window.AppCore.persistirProgressao();
                toast('Evidência removida.', 'ok');
                render();
            });
        }
    }
    function wireDateMask(container) {
        $$('[data-datebr]', container).forEach((el) => {
            el.addEventListener('input', () => {
                const d = el.value.replace(/\D/g, '').slice(0, 8);
                let out = d;
                if (d.length > 6) out = d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
                else if (d.length > 4) out = d.slice(0, 2) + '/' + d.slice(2);
                el.value = out;
            });
        });
    }

    function progressaoCfgSectionHtml(cfg) {
        const c = cfg || {};
        return `<section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
            <h3 class="font-bold text-sm mb-2 flex items-center gap-2"><i class="fa-solid fa-id-card text-govbr-600 dark:text-unifesp-400"></i> ${esc('Progressão Docente: Dados funcionais')}</h3>
            <p class="text-xs text-gray-500 mb-2">${esc('Nenhum desses dados existe em outro módulo do lattesZen — preencha manualmente.')}</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                ${inpData(c, 'dataPosse', 'Data de posse')}
                ${inpDataUltimaProgressaoComEvidencia(c)}
                ${inpCampus(c)}
                ${inpUnidade(c)}
                ${inpTexto(c, 'departamento', 'Departamento')}
                ${inpClasse(c)}
                ${inpNivel(c)}
                ${inpRegime(c)}
            </div>
            <div class="flex gap-2 mt-3">
                <button id="btnSaveProgressaoCfg" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-floppy-disk mr-1"></i> ${esc('Salvar')}</button>
            </div>
        </section>`;
    }
    function wireProgressaoCfgSection() {
        const panel = $('#tab-progressao');
        window.AppCore.wireValidators(panel);
        wireDateMask(panel);
        wireUnidadeFiltro();
        wireEvidenciaUltimaProgressao();
        $$('[data-ro-focus]', panel).forEach((el) => {
            el.addEventListener('focus', () => el.removeAttribute('readonly'), { once: true });
        });
        const btn = $('#btnSaveProgressaoCfg'); if (!btn) return;
        btn.addEventListener('click', () => {
            const keys = ['dataPosse', 'dataUltimaProgressao', 'campus', 'unidade', 'departamento', 'classe', 'nivel', 'regime'];
            // Preserva chaves que não vêm do formulário em si (ex.:
            // evidenciaUltimaProgressao, gravada à parte assim que o arquivo é
            // escolhido — ver wireEvidenciaUltimaProgressao) em vez de zerar
            // tudo que não está nesta lista.
            const cfg = { ...(state.progressao.cfg || {}) };
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
            .map((item) => ({
                item,
                status: window.LzProgressaoMapa.status(item),
                categoria: window.LzProgressaoMapa.categoria(item),
                subcategoria: window.LzProgressaoMapa.subcategoria(item),
            }))
            .filter(({ status, item }) => {
                if (!status) return false;
                if (anoRef == null) return true;
                const ano = itemYear(item);
                return ano == null || ano >= anoRef;
            })
            .sort((a, b) => (itemYear(b.item) || 0) - (itemYear(a.item) || 0));
    }

    // Agrupa os candidatos pela categoria do memorial e, dentro dela, pela
    // subcategoria (mesmos títulos e numeração do documento oficial — ver
    // ordemCategorias()/ordemSubcategorias() em progressao-mapeamento.js),
    // só incluindo (sub)categorias que têm pelo menos um candidato. Nem
    // toda categoria tem subcategoria (ex.: "Formação e Títulos") — esses
    // itens ficam em `itensDiretos`, exibidos direto sob o título da
    // categoria, sem subcabeçalho.
    function agruparPorCategoria(candidatos) {
        const porCategoria = {};
        candidatos.forEach((c) => {
            const nome = c.categoria || 'Outros';
            (porCategoria[nome] = porCategoria[nome] || []).push(c);
        });
        return window.LzProgressaoMapa.ordemCategorias()
            .filter((nome) => porCategoria[nome])
            .map((nome) => {
                const todos = porCategoria[nome];
                const itensDiretos = todos.filter((c) => !c.subcategoria);
                const porSub = {};
                todos.forEach((c) => { if (c.subcategoria) (porSub[c.subcategoria] = porSub[c.subcategoria] || []).push(c); });
                const subgrupos = window.LzProgressaoMapa.ordemSubcategorias(nome)
                    .filter((s) => porSub[s])
                    .map((s) => ({ nome: s, itens: porSub[s] }));
                return { nome, itensDiretos, subgrupos, total: todos.length };
            });
    }

    function statTileHtml(icon, colorClass, label, valor, sub) {
        return `<div class="flex-1 min-w-[170px] bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div class="flex items-center gap-2 mb-1">
                <i aria-hidden="true" class="fa-solid ${icon} ${colorClass}"></i>
                <span class="text-[11px] font-bold uppercase tracking-wide text-gray-500">${esc(label)}</span>
            </div>
            <div class="text-2xl font-extrabold">${esc(valor)}</div>
            <div class="text-xs text-gray-500">${esc(sub)}</div>
        </div>`;
    }

    function pillFiltroHtml(nome, count, ativo) {
        const cls = ativo
            ? 'bg-govbr-600 dark:bg-unifesp-700 text-white border-govbr-600 dark:border-unifesp-700'
            : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600';
        return `<button type="button" data-filtro-cat="${esc(nome === 'Todas' ? '' : nome)}" class="text-xs font-semibold px-3 py-1 rounded-full border ${cls}">${esc(nome)} (${esc(String(count))})</button>`;
    }

    // Fundo/borda NEUTROS na linha do item (mesmo padrão usado no resto do
    // app, ex.: tab-conformidade.js) — cores como bg-green-50/bg-amber-50
    // não são remapeadas pelos temas coloridos de Configurações › Tema (só
    // as classes neutras e as govbr-*/unifesp-* têm essa regra em
    // styles.css), então um card inteiro nessas cores ficava sempre
    // "claro", mesmo com um tema escuro ativo. A distinção verde/amarelo é
    // só um detalhe pequeno (ícone + friso à esquerda), legível em qualquer
    // tema.
    function itemRowHtml({ item, status }) {
        const marcado = !!(item.progressao && item.progressao.usar);
        const corIcone = status === 'verde' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';
        const friso = status === 'verde' ? 'border-l-green-500' : 'border-l-amber-500';
        const ano = itemYear(item);
        // "Informações complementares" ainda não tem formulário próprio (ver
        // cabeçalho do arquivo/progressao-mapeamento.js) — por enquanto só
        // reflete item.progressao.complementoOk, que nenhuma tela ainda
        // grava; assim que essa etapa futura existir, este selo passa a
        // acender "Info completa" sozinho, sem mudar nada aqui.
        const completo = !!(item.progressao && item.progressao.complementoOk);
        const infoHtml = status !== 'amarelo' || !marcado
            ? `<span class="text-xs text-gray-400 dark:text-gray-500 w-28 text-center shrink-0">—</span>`
            : completo
                ? `<span class="text-xs font-semibold px-2 py-0.5 rounded-full border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 w-28 text-center shrink-0">${esc('Info completa')}</span>`
                : `<span class="text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 w-28 text-center shrink-0">${esc('Info pendente')}</span>`;
        return `<div class="flex items-center justify-between gap-2 border border-l-4 ${friso} border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5 text-sm">
            <div class="min-w-0 flex-1 flex items-center gap-1">
                <span class="${corIcone} shrink-0"><i aria-hidden="true" class="fa-solid ${marcado ? 'fa-square-check' : 'fa-square'}"></i></span>
                <span class="truncate ml-1">${esc(LattesTypes.itemTitle(item))}</span>
                ${ano ? `<span class="text-xs text-gray-400 shrink-0 ml-1">(${esc(String(ano))})</span>` : ''}
            </div>
            ${infoHtml}
            <button type="button" data-editar="${esc(item.id)}" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 shrink-0">${esc('Editar')}</button>
        </div>`;
    }

    function stepperHtml(totalCompletos, totalAmareloValidados) {
        const etapa2Sub = totalAmareloValidados ? `${totalCompletos} de ${totalAmareloValidados} completas` : 'Nenhuma pendência';
        return `<div class="flex flex-wrap items-center gap-4 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 mt-3 bg-gray-50 dark:bg-gray-900">
            <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs shrink-0"><i aria-hidden="true" class="fa-solid fa-check"></i></span>
                <div><div class="text-xs font-bold">${esc('Seleção dos itens')}</div><div class="text-[11px] text-gray-500">${esc('Em andamento em Catalogar')}</div></div>
            </div>
            <div class="w-8 h-px bg-gray-300 dark:bg-gray-600 shrink-0"></div>
            <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full border-2 border-amber-500 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <div><div class="text-xs font-bold">${esc('Informações complementares')}</div><div class="text-[11px] text-gray-500">${esc(etapa2Sub)}</div></div>
            </div>
            <div class="w-8 h-px bg-gray-300 dark:bg-gray-600 shrink-0"></div>
            <div class="flex items-center gap-2 opacity-50">
                <span class="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 text-gray-400 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <div><div class="text-xs font-bold text-gray-400">${esc('Formulário de submissão')}</div><div class="text-[11px] text-gray-500">${esc('Em uma próxima etapa do módulo')}</div></div>
            </div>
        </div>`;
    }

    // Prévia do item 3 do memorial ("Atividades de Extensão"), gerada a
    // partir dos itens já validados dessa categoria — ver
    // progressao-memorial.js. Só os itens marcados "usar na Progressão"
    // entram (os demais o(a) docente ainda não decidiu incluir).
    // Cada item validado ganha um número sequencial dentro da própria
    // subseção — "seção.subseção.item" (ex.: 3.1.01, 3.1.02, 3.2.01...),
    // igual ao pedido do Alexsandro (ver montarEstrutura em
    // progressao-memorial.js) — formatado aqui em HTML pra leitura, com o
    // texto simples (pra colar no documento oficial) guardado à parte pro
    // botão "Copiar".
    function previaItem3Html(candidatos) {
        // A ausência de itens NÃO impede a prévia de aparecer — o relatório
        // inicial já aponta o que falta (ver progressao-memorial.js), em
        // vez de esconder a seção inteira.
        const itensExtensao = candidatos.filter((c) => c.categoria === window.LzProgressaoMapa.CATEGORIA_EXTENSAO && c.item.progressao && c.item.progressao.usar);
        const estrutura = window.LzProgressaoMemorial.montarEstrutura(itensExtensao);
        const textoParaCopiar = window.LzProgressaoMemorial.gerarItem3(itensExtensao);
        return `<div class="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
            <div class="flex items-center justify-between gap-2 mb-2">
                <span class="text-[11px] font-bold uppercase tracking-wide text-gray-500">${esc('Pronta pra revisar e colar no memorial oficial')}</span>
                <button type="button" id="btnCopiarItem3" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 shrink-0">${esc('Copiar')}</button>
            </div>
            <div class="text-xs font-mono whitespace-pre-wrap px-2 py-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-600 dark:text-gray-400 mb-3">${esc(estrutura.relatorio)}</div>
            <div class="space-y-3">
                <h4 class="text-sm font-bold">${esc(estrutura.categoria)}</h4>
                ${estrutura.subsecoes.map((sg) => `<div>
                    <h5 class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">${esc(sg.subcategoria)}</h5>
                    <div class="space-y-2">
                        ${sg.itens.map((it) => `<div class="border border-gray-200 dark:border-gray-700 rounded p-2 bg-white dark:bg-gray-950">
                            <div class="text-xs font-bold text-govbr-600 dark:text-unifesp-400 mb-1">${esc(it.numero)}</div>
                            <dl class="text-xs grid grid-cols-[max-content_1fr] gap-x-2 gap-y-0.5">
                                ${it.campos.map(([rotulo, valor]) => `<dt class="font-semibold text-gray-600 dark:text-gray-400">${esc(rotulo)}:</dt><dd class="text-gray-800 dark:text-gray-200">${esc(valor)}</dd>`).join('')}
                            </dl>
                        </div>`).join('')}
                    </div>
                </div>`).join('')}
            </div>
            <textarea id="previaItem3Texto" class="hidden" aria-hidden="true" tabindex="-1">${esc(textoParaCopiar)}</textarea>
            <p class="text-[11px] text-gray-500 mt-2">${esc(`Trechos marcados "${window.LzProgressaoMemorial.PLACEHOLDER}" são campos que o memorial pede mas ainda não existem no catálogo — complete-os direto no documento final.`)}</p>
        </div>`;
    }

    function candidatosSectionHtml() {
        const candidatos = candidatosProgressao();
        const cfg = state.progressao.cfg || {};
        const totalItens = candidatos.length;
        const totalValidados = candidatos.filter((c) => c.item.progressao && c.item.progressao.usar).length;
        const naoValidados = totalItens - totalValidados;
        const amareloValidados = candidatos.filter((c) => c.status === 'amarelo' && c.item.progressao && c.item.progressao.usar);
        const totalAmareloValidados = amareloValidados.length;
        const totalCompletos = amareloValidados.filter((c) => c.item.progressao && c.item.progressao.complementoOk).length;
        const pendentesBloqueio = totalAmareloValidados - totalCompletos;
        const grupos = agruparPorCategoria(candidatos);
        const gruposVisiveis = grupos.filter((g) => !filtroCategoria || g.nome === filtroCategoria);

        return `<section id="progressaoCandidatos" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 class="font-bold text-sm mb-1 flex items-center gap-2"><i aria-hidden="true" class="fa-solid fa-list-check text-govbr-600 dark:text-unifesp-400"></i> ${esc('Itens candidatos ao memorial')}</h3>
            <p class="text-xs text-gray-500 mb-3">${cfg.dataUltimaProgressao
                ? esc(`Itens do catálogo datados a partir de ${cfg.dataUltimaProgressao} (ou sem ano definido) com correspondência no memorial da CPPD. `)
                : esc('Informe a "Data da última progressão" acima para restringir a lista ao período correto — por enquanto, todos os itens com correspondência no memorial. ')}${esc('Marque "usar na Progressão" na própria aba Catalogar (mesmo mecanismo do RSC-PCCTAE): itens ')}<span class="text-green-600 dark:text-green-400 font-semibold">${esc('verdes')}</span>${esc(' precisam só do checkbox; itens ')}<span class="text-amber-600 dark:text-amber-400 font-semibold">${esc('amarelos')}</span>${esc(' têm lacunas cujos campos complementares ainda vamos desenhar juntos.')}</p>
            ${!totalItens ? `<p class="text-sm text-gray-500 italic py-4 text-center">${esc('Nenhum item candidato encontrado ainda — cadastre itens em Catalogar.')}</p>` : `
            <div class="flex flex-wrap gap-2 mb-3">
                ${statTileHtml('fa-list-check', 'text-govbr-600 dark:text-unifesp-400', 'Itens candidatos', String(totalItens), cfg.dataUltimaProgressao ? `desde ${cfg.dataUltimaProgressao}` : 'todos os períodos')}
                ${statTileHtml('fa-square-check', 'text-green-600 dark:text-green-400', 'Validados', String(totalValidados), `${naoValidados} ainda não validados`)}
                ${statTileHtml('fa-file-lines', 'text-amber-600 dark:text-amber-400', 'Informações complementares', `${totalCompletos}/${totalAmareloValidados}`, `${pendentesBloqueio} itens validados pendentes`)}
            </div>
            <div class="flex flex-wrap gap-2 mb-3">
                ${pillFiltroHtml('Todas', totalItens, !filtroCategoria)}
                ${grupos.map((g) => pillFiltroHtml(g.nome, g.total, filtroCategoria === g.nome)).join('')}
            </div>
            <div class="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                ${gruposVisiveis.map((g) => `<div>
                    <div class="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1 px-1">${esc(g.nome)}</div>
                    ${g.itensDiretos.length ? `<div class="space-y-1 mb-2">${g.itensDiretos.map(itemRowHtml).join('')}</div>` : ''}
                    ${g.subgrupos.map((sg) => `<div class="mb-2">
                        <div class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 pl-3">${esc(sg.nome)}</div>
                        <div class="space-y-1 pl-3">${sg.itens.map(itemRowHtml).join('')}</div>
                    </div>`).join('')}
                </div>`).join('')}
            </div>
            ${stepperHtml(totalCompletos, totalAmareloValidados)}
            `}
            <div class="mt-3">
                <button type="button" id="btnPreviaItem3" class="text-xs font-semibold px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600">
                    <i aria-hidden="true" class="fa-solid fa-file-lines mr-1"></i> ${esc(mostrarPreviaItem3 ? 'Ocultar prévia do item 3' : 'Gerar prévia do item 3 — Atividades de Extensão')}
                </button>
                ${mostrarPreviaItem3 ? previaItem3Html(candidatos) : ''}
            </div>
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
        $$('[data-filtro-cat]', panel).forEach((btn) => {
            btn.addEventListener('click', () => {
                filtroCategoria = btn.dataset.filtroCat || null;
                const secao = $('#progressaoCandidatos');
                if (!secao) return;
                secao.outerHTML = candidatosSectionHtml();
                wireCandidatosSection($('#tab-progressao'));
            });
        });
        const btnPrevia = $('#btnPreviaItem3', panel);
        if (btnPrevia) {
            btnPrevia.addEventListener('click', () => {
                mostrarPreviaItem3 = !mostrarPreviaItem3;
                const secao = $('#progressaoCandidatos');
                if (!secao) return;
                secao.outerHTML = candidatosSectionHtml();
                wireCandidatosSection($('#tab-progressao'));
            });
        }
        const btnCopiar = $('#btnCopiarItem3', panel);
        if (btnCopiar) {
            btnCopiar.addEventListener('click', async () => {
                const ta = $('#previaItem3Texto');
                if (!ta) return;
                try {
                    await navigator.clipboard.writeText(ta.value);
                    toast('Texto do item 3 copiado.', 'ok');
                } catch (e) {
                    toast('Não foi possível copiar automaticamente — selecione o texto formatado acima e copie manualmente (Ctrl+C).', 'info');
                }
            });
        }
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
