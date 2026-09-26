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
   lattesZen — Geração de texto do Memorial (item 3: Atividades de Extensão)
   --------------------------------------------------------------------------
   Monta o item 3 do Memorial Descritivo ("3. ATIVIDADES DE EXTENSÃO À
   COMUNIDADE, DE CURSOS E SERVIÇOS") a partir dos itens já cadastrados no
   catálogo e marcados "usar na Progressão" (ver renderVisibilidadeBlock em
   tab-catalogar.js) — cada item vira um bloco de texto com os MESMOS
   rótulos de campo do documento oficial da CPPD ("PROGRESSÃO FUNCIONAL -
   MEMORIAL.docx"), preenchidos com os dados reais do catálogo quando o
   Lattes tem um campo correspondente.

   Nem todo campo pedido pelo memorial existe hoje no catálogo (é exatamente
   a lacuna que já deixa o item "amarelo" em progressao-mapeamento.js — ex.:
   Código SIEX, Carga horária anual). Nesses casos o valor vem como
   PLACEHOLDER, igual ao "(Digite aqui...)" que o próprio documento oficial
   usa para os campos que o(a) docente preenche à mão — não inventamos dado
   que não existe.

   Um mesmo typeKey do Lattes pode alimentar mais de uma subseção (3.1/3.2)
   dependendo de um campo do próprio item — a escolha de qual "campos3_x"
   usar já vem pronta em progressao-mapeamento.js (subcategoria(item)), este
   módulo só faz a mostra o o texto para uma subcategoria já resolvida.
   ========================================================================== */
window.LzProgressaoMemorial = (function () {
    const { itemYear } = window.AppCore;
    const PLACEHOLDER = '[completar manualmente]';

    function v(campo) {
        const s = String(campo == null ? '' : campo).trim();
        return s || PLACEHOLDER;
    }
    function dataOuAndamento(anoFimCanonico, situacaoValor, valoresAndamento) {
        if (!anoFimCanonico && valoresAndamento.includes(situacaoValor)) return 'Em andamento';
        return anoFimCanonico ? window.AppCore.datebrParaExibicao(anoFimCanonico, 'pt-br') : PLACEHOLDER;
    }
    function data(canonico) {
        return canonico ? window.AppCore.datebrParaExibicao(canonico, 'pt-br') : PLACEHOLDER;
    }

    /* --------------------- 3.1 Projetos e Programas de Extensão --------------------- */
    // PROJETO_EXTENSAO não tem "Link de divulgação", "Carga horária anual"
    // nem "Código SIEX" como campos próprios, e "Atribuição/Cargo/Papel" fica
    // dentro da lista de equipe (não como um campo único do próprio item) —
    // por isso os quatro ficam como placeholder.
    function campos_3_1(item) {
        const f = item.fields || {};
        return [
            ['Natureza', v(f.natureza)],
            ['Título do projeto', v(f.titulo)],
            ['Resumo', v(f.descricao)],
            ['Link de divulgação', PLACEHOLDER],
            ['Carga horária anual', PLACEHOLDER],
            ['Início (mês/ano)', data(f.anoInicio)],
            ['Fim (mês/ano ou em andamento)', dataOuAndamento(f.anoFim, f.situacao, ['Em andamento'])],
            ['Atribuição/Cargo/Papel', PLACEHOLDER],
            ['Código SIEX', PLACEHOLDER],
        ];
    }

    /* --------------- 3.2 Eventos e Cursos de extensão (3 typeKeys) --------------- */
    function campos_3_2_organizacaoEvento(item) {
        const f = item.fields || {};
        return [
            ['Natureza da ação de extensão', v(f.natureza)],
            ['Título da ação de extensão', v(f.titulo)],
            ['Carga horária', PLACEHOLDER], // ORGANIZACAO_EVENTO só guarda duração em SEMANAS, não em horas
            ['Link de divulgação', v(f.url)],
            ['Início (mês/ano)', data(f.ano)],
            ['Fim (mês/ano)', data(f.anoFim)],
            ['Atribuição/Cargo/Papel', PLACEHOLDER],
            ['Código SIEX', PLACEHOLDER],
        ];
    }
    function campos_3_2_cursoMinistrado(item) {
        const f = item.fields || {};
        const cargaHoraria = f.cargaHoraria ? `${f.cargaHoraria}${f.unidade ? ' ' + f.unidade : 'h'}` : '';
        return [
            ['Natureza da ação de extensão', 'Curso'],
            ['Título da ação de extensão', v(f.titulo)],
            ['Carga horária', v(cargaHoraria)],
            ['Link de divulgação', v(f.url)],
            ['Início (mês/ano)', data(f.ano)],
            ['Fim (mês/ano)', data(f.anoFim)],
            ['Atribuição/Cargo/Papel', v(f.participacaoAutores)],
            ['Código SIEX', PLACEHOLDER],
        ];
    }
    function campos_3_2_participacaoEvento(item) {
        const f = item.fields || {};
        const cargaHoraria = f.cargaHoraria ? `${f.cargaHoraria}h` : '';
        return [
            ['Natureza da ação de extensão', v(f.natureza)],
            ['Título da ação de extensão', v(f.titulo)],
            ['Carga horária', v(cargaHoraria)],
            ['Link de divulgação', v(f.url)],
            ['Início (mês/ano)', data(f.ano)],
            ['Fim (mês/ano)', data(f.anoFim)],
            ['Atribuição/Cargo/Papel', v(f.tipoParticipacao || f.formaParticipacao)],
            ['Código SIEX', PLACEHOLDER],
        ];
    }

    /* ------- 3.3 Assessoria, consultoria, participação em órgãos de fomento ------- */
    function campos_3_3_assessoriaConsultoria(item) {
        const f = item.fields || {};
        return [
            ['Tipo', v(f.natureza)],
            ['Descreva', v(f.titulo)],
            ['Período (início/fim)', `${data(f.ano)} a ${dataOuAndamento(f.anoFim, null, [])}`],
        ];
    }
    function campos_3_3_comiteAssessoramento(item) {
        const f = item.fields || {};
        return [
            ['Tipo', `Membro de comitê de assessoramento${f.instituicao ? ' — ' + f.instituicao : ''}`],
            ['Descreva', v(f.titulo || f.outrasInfo)],
            ['Período (início/fim)', `${data(f.anoInicio)} a ${dataOuAndamento(f.anoFim, f.situacao, ['Atual (não finalizado)'])}`],
        ];
    }
    function campos_3_3_revisorFomento(item) {
        const f = item.fields || {};
        return [
            ['Tipo', `Revisor de projeto de agência de fomento${f.titulo ? ' — ' + f.titulo : ''}`],
            ['Descreva', v(f.outrasInfo)],
            ['Período (início/fim)', `${data(f.anoInicio)} a ${dataOuAndamento(f.anoFim, f.situacao, ['Atual (não finalizado)'])}`],
        ];
    }

    /* --------------------------- 3.4 Outras Ações de Extensão --------------------------- */
    // O memorial não lista campos específicos pra esta subseção (é texto
    // livre) — usamos os mesmos dados do tipo ATIV_EXTENSAO do Lattes.
    function campos_3_4(item) {
        const f = item.fields || {};
        return [
            ['Atividade', v(f.titulo)],
            ['Instituição/Órgão', v([f.instituicao, f.orgao].filter(Boolean).join(' — ') || '')],
            ['Período (início/fim)', `${data(f.anoInicio)} a ${dataOuAndamento(f.anoFim, f.situacao, ['Atual (não finalizado)'])}`],
        ];
    }

    // Um mesmo typeKey pode precisar de um campos_3_2_* diferente conforme o
    // caminho que progressao-mapeamento.js já escolheu (ex.: CURSO_MINISTRADO
    // cai em 1.3 OU 3.2 dependendo do nível) — aqui não reavaliamos aquela
    // escolha, só escolhemos QUAL função de campos usar para o typeKey.
    const CAMPOS_POR_TYPEKEY = {
        PROJETO_EXTENSAO: campos_3_1,
        ORGANIZACAO_EVENTO: campos_3_2_organizacaoEvento,
        CURSO_MINISTRADO: campos_3_2_cursoMinistrado,
        PARTICIPACAO_EVENTO: campos_3_2_participacaoEvento,
        ASSESSORIA_CONSULTORIA: campos_3_3_assessoriaConsultoria,
        COMITE_ASSESSORAMENTO: campos_3_3_comiteAssessoramento,
        REVISOR_FOMENTO: campos_3_3_revisorFomento,
        ATIV_EXTENSAO: campos_3_4,
    };

    // Texto de UM item, no mesmo formato "Rótulo: valor" linha a linha do
    // documento oficial.
    function blocoItem(item) {
        const construtor = CAMPOS_POR_TYPEKEY[item.typeKey];
        if (!construtor) return '';
        return construtor(item).map(([rotulo, valor]) => `${rotulo}: ${valor}`).join('\n');
    }

    // Monta o texto completo do item 3, agrupado por subcategoria (3.1 a
    // 3.4, na ordem oficial) e, dentro de cada uma, em ordem cronológica
    // (mais antigo primeiro — mesma convenção usada no restante do
    // documento, ex.: "1.1 ... (ordenar cronologicamente)"). `candidatos` é
    // a lista já filtrada (categoria === "3. ATIVIDADES DE EXTENSÃO..." e
    // item.progressao.usar === true) — quem decide isso é quem chama.
    function gerarItem3(candidatos) {
        const porSub = {};
        candidatos.forEach((c) => {
            const nome = c.subcategoria || 'Outros';
            (porSub[nome] = porSub[nome] || []).push(c);
        });
        const ordemSub = window.LzProgressaoMapa.ordemSubcategorias(window.LzProgressaoMapa.CATEGORIA_EXTENSAO);
        const blocos = ['3. ATIVIDADES DE EXTENSÃO À COMUNIDADE, DE CURSOS E SERVIÇOS'];
        ordemSub.forEach((sub) => {
            const itens = porSub[sub];
            if (!itens || !itens.length) return;
            itens.sort((a, b) => (itemYear(a.item) || 0) - (itemYear(b.item) || 0));
            blocos.push('');
            blocos.push(sub);
            itens.forEach(({ item }) => {
                blocos.push('');
                blocos.push(blocoItem(item));
            });
        });
        return blocos.join('\n');
    }

    return { gerarItem3, PLACEHOLDER };
})();
