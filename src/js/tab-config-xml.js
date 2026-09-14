/* ==========================================================================
   lattesZen — Importar/Exportar Lattes (XML) — seção dentro de Configurações
   --------------------------------------------------------------------------
   Extraído de tab-config.js (issue de refatoração). Nenhuma mudança de
   conteúdo, só saiu do arquivo único original.
   ========================================================================== */
import { dadosItemHtml, fileStamp } from './tab-config-shared.js';
import { itemSignature, itemSignatures, existingSignatureMap } from './tab-config-dedup.js';

const { state, $, $$, esc, toast } = window.AppCore;

    /* =====================================================================
       IMPORTAR LATTES (XML) — seção dentro de Configurações
       ===================================================================== */
    // Aviso de consistência tocado nas operações de exportação: depois de
    // adotar o lattesZen, as edições devem ocorrer AQUI e não mais diretamente
    // na Plataforma Lattes (senão a assinatura do item muda e pode duplicar na
    // próxima importação).
    function xmlConsistencyToast() {
        toast('Lembrete: edite no lattesZen (não direto na Plataforma Lattes) para manter a consistência dos dados.', 'aviso');
    }


    // Import do XML do Lattes — item da coluna "Importar" de "Trazer e levar
    // dados". A verificação de compatibilidade ISO-8859-1 mora aqui dentro
    // (recolhida por padrão), já que só faz sentido no contexto do Lattes.
    export function xmlImportItemHtml() {
        return dadosItemHtml('fa-solid fa-file-import', 'Lattes (XML)',
            'Importa o currículo em XML exportado da Plataforma Lattes (CNPq). Os itens são listados para você escolher quais importar.', `
                <input type="file" id="xmlInput" accept=".xml,application/xml,text/xml"
                       class="text-sm file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-govbr-600 dark:file:bg-unifesp-700 file:text-white">
                <div id="xmlResult" class="mt-3"></div>

                <details class="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <summary class="cursor-pointer select-none text-xs font-semibold flex items-center gap-2">
                        <i aria-hidden="true" class="fa-solid fa-angle-right text-xs text-gray-400"></i>
                        <i aria-hidden="true" class="fa-solid fa-language text-govbr-600 dark:text-unifesp-400"></i>
                        Verificar compatibilidade com o Lattes (ISO-8859-1)
                    </summary>
                    <div class="pt-3">
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            O Currículo Lattes usa a codificação <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">ISO-8859-1</code>.
                            A verificação abaixo aponta caracteres fora dessa tabela (ex.: aspas “curvas”, travessão —, emoji) que,
                            na exportação, viram entidades numéricas. Você pode normalizá-los automaticamente.
                        </p>
                        <div class="flex flex-wrap gap-2">
                            <button id="btnCheckEnc" class="px-3 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm"><i class="fa-solid fa-spell-check mr-1"></i> Verificar codificação</button>
                            <button id="btnNormalize" class="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Normalizar pontuação</button>
                        </div>
                        <div id="encResult" class="text-sm mt-3"></div>
                    </div>
                </details>`);
    }

    // Nome do arquivo XML exportado, com timestamp (evita sobrescrever
    // exportações anteriores e registra quando cada uma foi gerada).
    function xmlFileName() {
        const nome = (state.items.find(i => i.typeKey === 'IDENTIFICACAO' && i.fields && i.fields.titulo) || {}).fields;
        const safe = (nome && nome.titulo ? nome.titulo : 'curriculo').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-').toLowerCase();
        return `curriculo-${safe}-${fileStamp()}.xml`;
    }
    // Ata os botões da exportação XML (usado dentro de renderConfig).
    export function wireExportLattes() {
        const xmlStatus = (t) => { const el = $('#xmlStatus'); if (el) el.textContent = t; };
        function generateLattesXml() {
            const cfg = Storage.loadSettings() || {};
            const xml = LattesXMLExport.build(state.items, { numeroIdentificador: cfg.lattesId || '' });
            // Serializa em ISO-8859-1 (entidades numéricas para fora do Latin-1).
            return { xml, bytes: LzEncoding.encodeLatin1Xml(xml) };
        }
        const xmlExportaveis = () => state.items.filter(i => {
            const def = LattesTypes.getType(i.typeKey);
            if (def && def.noExport) return false;
            if (i.visibilidade && i.visibilidade.exportarLattes === false) return false;
            return !LattesTypes.isNaoLattesCategory(i.categoryKey);
        }).length;
        const dl = $('#btnXmlDownload');
        if (dl) dl.addEventListener('click', () => {
            xmlStatus('Gerando XML…');
            try {
                const { bytes } = generateLattesXml();
                const blob = new Blob([bytes], { type: 'application/xml' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = xmlFileName(); a.click(); URL.revokeObjectURL(a.href);
                xmlStatus(`XML gerado (${xmlExportaveis()} item(ns) exportado(s)).`);
                xmlConsistencyToast();
            } catch (e) { xmlStatus(''); toast('Falha ao gerar XML: ' + e.message, 'erro'); }
        });
        const sv = $('#btnXmlSave');
        if (sv) sv.addEventListener('click', async () => {
            if (!Storage.hasDirectory()) { toast('Configure um diretório abaixo para salvar na pasta.', 'aviso'); return; }
            xmlStatus('Gerando e salvando XML…');
            try {
                const folder = LattesTypes.lattesXmlFolder();
                const nomeArquivo = xmlFileName();
                const { bytes } = generateLattesXml();
                await Storage.writeFile(nomeArquivo, bytes, folder);
                xmlStatus(`Salvo em “${folder}/${nomeArquivo}” (${xmlExportaveis()} item(ns)).`);
                toast(`XML salvo em “${folder}/${nomeArquivo}”.`, 'ok');
                xmlConsistencyToast();
            } catch (e) { xmlStatus(''); toast('Falha ao salvar XML: ' + e.message, 'erro'); }
        });
    }

    export async function onXmlSelected(e) {
        const file = e.target.files[0];
        if (!file) return;
        // Conversor de ENTRADA: decodifica respeitando o encoding do XML (Lattes = ISO-8859-1)
        const text = await LzEncoding.decodeXmlFile(file);
        const res = LattesXML.parse(text);
        state.lattesParsed = res;

        if (res.errors && res.errors.length) { toast(res.errors[0], 'erro'); }
        renderXmlResult(res);
    }


    function renderXmlResult(res) {
        const box = $('#xmlResult');
        if (!res.items.length) {
            box.innerHTML = `<p class="text-sm text-gray-500 italic">Nenhum item reconhecido no XML.</p>`;
            return;
        }
        const sigMap = existingSignatureMap();
        const isDup = (it) => (LattesTypes.isSingleton(it.typeKey) && state.items.some(x => x.typeKey === it.typeKey)) || sigMap.has(itemSignature(it.typeKey, it.fields || {}));
        const novos = res.items.filter(it => !isDup(it)).length;
        const jaCat = res.items.length - novos;
        const resumo = Object.entries(res.summary)
            .map(([k, n]) => `<span class="badge bg-govbr-50 text-govbr-700 dark:bg-gray-700 dark:text-gray-200">${esc(LattesTypes.label(k))}: ${n}</span>`).join(' ');

        box.innerHTML = `
            <div class="mb-3">
                ${res.titular ? `<p class="text-sm mb-1">Titular: <strong>${esc(res.titular)}</strong></p>` : ''}
                <p class="text-sm mb-1">${res.items.length} itens reconhecidos — <strong class="text-green-700 dark:text-green-400">${novos} novos</strong>, ${jaCat} já catalogado(s).</p>
                <div class="flex flex-wrap gap-1">${resumo}</div>
            </div>
            <div class="flex items-center gap-2 mb-2 flex-wrap">
                <button id="btnSelNovos" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Selecionar novos</button>
                <button id="btnSelAll" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Todos</button>
                <button id="btnSelNone" class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Nenhum</button>
                <button id="btnImport" class="ml-auto px-4 py-2 rounded bg-govbr-600 dark:bg-unifesp-700 text-white text-sm font-semibold">
                    <i class="fa-solid fa-download mr-1"></i> Importar selecionados
                </button>
            </div>
            <div class="space-y-1 scroll-area max-h-[60vh] overflow-y-auto pr-1">
                ${res.items.map((it, idx) => {
                    const dup = isDup(it);
                    return `<label class="flex items-start gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-sm ${dup ? 'opacity-60' : ''}">
                        <input type="checkbox" class="xmlchk mt-1" data-idx="${idx}" ${dup ? '' : 'checked'}>
                        <span class="min-w-0">
                            <span class="font-medium">${esc(it.fields.titulo || it.fields.curso || '(sem título)')}</span>
                            <span class="block text-xs text-gray-500">${esc(LattesTypes.label(it.typeKey))} ${it.fields.ano ? '· ' + esc(it.fields.ano) : ''} ${dup ? '· <em>já catalogado</em>' : ''}</span>
                        </span>
                    </label>`;
                }).join('')}
            </div>`;

        $('#btnSelNovos').addEventListener('click', () => $$('.xmlchk').forEach(c => {
            c.checked = !isDup(res.items[+c.dataset.idx]);
        }));
        $('#btnSelAll').addEventListener('click', () => $$('.xmlchk').forEach(c => c.checked = true));
        $('#btnSelNone').addEventListener('click', () => $$('.xmlchk').forEach(c => c.checked = false));
        $('#btnImport').addEventListener('click', importSelected);
    }

    async function importSelected() {
        const chosen = $$('.xmlchk').filter(c => c.checked).map(c => parseInt(c.dataset.idx, 10));
        if (!chosen.length) { toast('Nenhum item selecionado.', 'aviso'); return; }
        // Feedback de progresso + botão desabilitado durante a importação —
        // igual ao padrão já usado na busca do ORCID/migração pro Google
        // Drive (sem isto, um clique duplo no meio de uma importação de
        // muitos itens não tinha nenhum sinal visual de que já estava em
        // andamento). Restaurado no finally — inclusive se a própria
        // renderXmlResult() no fim já tiver substituído o botão (isConnected
        // vira false e a restauração aqui é um no-op inofensivo).
        const btn = $('#btnImport');
        const original = btn ? btn.innerHTML : '';
        if (btn) btn.disabled = true;
        try {
            // Deduplicação por assinatura de conteúdo — impede duplicar itens já
            // existentes a cada nova importação, mesmo que tenham sido editados ou
            // criados manualmente antes de constarem no Lattes.
            const sigMap = existingSignatureMap();
            const registrar = (it) => itemSignatures(it).forEach(s => { if (!sigMap.has(s)) sigMap.set(s, it); });
            let n = 0, atualizados = 0, ignorados = 0, feito = 0;
            for (const idx of chosen) {
                const src = state.lattesParsed.items[idx];
                // Tipos únicos (Identificação, Resumo, Outras info...): se já
                // existir um item desse tipo, ATUALIZA em vez de criar um novo.
                // Endereço não é singleton global (1 Residencial + 1 Profissional,
                // ver singletonBy) — cai na dedup por assinatura logo abaixo, que já
                // separa os dois pelo texto do logradouro.
                if (LattesTypes.isSingleton(src.typeKey)) {
                    const ex = state.items.find(i => i.typeKey === src.typeKey);
                    if (ex) {
                        ex.fields = src.fields; ex.categoryKey = src.categoryKey || ex.categoryKey;
                        ex.lattesRef = src.lattesRef; ex.updatedAt = window.AppCore.nowISO();
                        await window.AppCore.persistItem(ex);
                        atualizados++; feito++;
                        if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Importando… (${feito}/${chosen.length})`;
                        continue;
                    }
                }
                const sig = itemSignature(src.typeKey, src.fields || {});
                const match = sig ? sigMap.get(sig) : null;
                if (match) {
                    // Item já existe: NÃO duplica. Preserva os dados e as evidências
                    // do usuário; apenas "adota" como item do Lattes (grava o
                    // lattesRef original) para casar nas próximas importações.
                    let changed = false;
                    if (!match.lattesRef && src.lattesRef) { match.lattesRef = src.lattesRef; changed = true; }
                    if (changed) { match.updatedAt = window.AppCore.nowISO(); await window.AppCore.persistItem(match); atualizados++; }
                    else ignorados++;
                    registrar(match);
                    feito++;
                    if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Importando… (${feito}/${chosen.length})`;
                    continue;
                }
                const item = {
                    id: window.AppCore.uid(), createdAt: window.AppCore.nowISO(), updatedAt: window.AppCore.nowISO(),
                    lattesItem: true, typeKey: src.typeKey,
                    categoryKey: src.categoryKey || LattesTypes.primaryCategory(src.typeKey),
                    fields: src.fields,
                    source: 'lattes', lattesRef: src.lattesRef,
                    hasPdf: false, pdfName: null, evidencias: [],
                };
                await window.AppCore.persistItem(item);
                registrar(item);
                n++; feito++;
                if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Importando… (${feito}/${chosen.length})`;
            }
            const extras = [atualizados ? `${atualizados} atualizado(s)` : '', ignorados ? `${ignorados} já existente(s) ignorado(s)` : ''].filter(Boolean).join(', ');
            toast(`${n} item(ns) importado(s)${extras ? ' — ' + extras : ''}.`, 'ok');
            xmlConsistencyToast();
            renderXmlResult(state.lattesParsed);
            window.AppCore.renderItemList();
        } finally {
            if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = original; }
        }
    }
