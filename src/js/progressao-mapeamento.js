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
   lattesZen — Mapeamento Memorial CPPD/Unifesp ↔ taxonomia Lattes
   --------------------------------------------------------------------------
   Classificação, por typeKey (e por vezes por um campo do próprio item, ex.:
   `nivel`/`tipo`/`formaParticipacao`), de cada tipo do catálogo que
   corresponde a algum item do Memorial Descritivo oficial para Progressão
   Funcional da CPPD/Unifesp — mapeamento verificado lendo o documento oficial
   ("PROGRESSÃO FUNCIONAL - MEMORIAL.docx") e o código real de
   lattes-types-*.js, não por suposição.

   Cada regra também carrega `categoria`/`subcategoria`: os títulos e a
   numeração são EXATAMENTE os do memorial oficial (pedido do Alexsandro),
   usados pra agrupar a lista de "itens candidatos" na aba Progressão
   Docente. Nem toda categoria tem subcategoria (ex.: "Formação e Títulos",
   que no memorial é só uma lista simples dentro de IDENTIFICAÇÃO).

   'verde'   = correspondência direta — o item só precisa do checkbox
               "usar na Progressão" (ver tab-catalogar.js/renderVisibilidadeBlock).
   'amarelo' = correspondência com lacunas conhecidas (ex.: falta carga
               horária, falta código SIEX, opções de select mais genéricas
               que o memorial pede) — por enquanto o item também só ganha o
               checkbox; os campos complementares para fechar essas lacunas
               ainda serão desenhados numa etapa futura.
   (ausente) = tipo sem correspondência no memorial — nunca é candidato.

   Regras concorrentes pro mesmo typeKey são avaliadas em ordem — a primeira
   cujo `quando` (se houver) bater define o resultado; por isso as mais
   específicas vêm antes das mais genéricas (a última regra sem `quando` de
   cada typeKey é o "fallback").
   ========================================================================== */
window.LzProgressaoMapa = (function () {
    // Nomes/numeração idênticos ao documento oficial (títulos em maiúsculas
    // e numeração igual às seções 1-4; "Formação e Títulos" e "Classe/Nível
    // funcional" não são seções numeradas do memorial — a primeira é uma
    // lista simples dentro de IDENTIFICAÇÃO, a segunda nem existe como
    // "atividade" lá, é só onde catalogamos o vínculo funcional em si).
    const CAT_FORMACAO = 'Formação e Títulos';
    const CAT_ENSINO = '1. ATIVIDADES DE ENSINO NO PERÍODO DA SOLICITAÇÃO';
    const CAT_PESQUISA = '2. ATIVIDADES DE PESQUISA';
    const CAT_EXTENSAO = '3. ATIVIDADES DE EXTENSÃO À COMUNIDADE, DE CURSOS E SERVIÇOS';
    const CAT_GESTAO = '4. ATIVIDADES DE GESTÃO E REPRESENTAÇÃO ACADÊMICA';
    const CAT_CLASSE = 'Classe/Nível funcional';

    const SUB_1_1 = '1.1 Atividades didáticas na Graduação';
    const SUB_1_2 = '1.2 Atividades didáticas na Pós-Graduação Stricto Sensu';
    const SUB_1_3 = '1.3 Atividades didáticas na Pós-Graduação Lato Sensu';
    const SUB_1_4 = '1.4 Outras atividades de Ensino';
    const SUB_2_1 = '2.1 Projetos de pesquisa e bolsas recebidas (PQ, outras)';
    const SUB_2_2 = '2.2 Produção Científica';
    const SUB_2_3 = '2.3 Produção Técnica';
    const SUB_2_4 = '2.4 Prêmios recebidos';
    const SUB_2_5_1 = '2.5.1 Trabalhos acadêmicos';
    const SUB_2_5_2 = '2.5.2 Comissões Julgadoras (Concursos e processos seletivos para docente, pesquisador e outros)';
    const SUB_2_6 = '2.6 Editoria e Relatoria de Revistas Científicas ou Livros';
    const SUB_2_7 = '2.7 Titulação e Formação Complementar';
    const SUB_2_8 = '2.8 Outras atividades de Pesquisa';
    const SUB_3_1 = '3.1 Projetos e Programas de Extensão';
    const SUB_3_2 = '3.2 Eventos e Cursos de extensão (exceto cursos lato sensu)';
    const SUB_3_3 = '3.3 Assessoria, consultoria, participação em órgãos de fomento à pesquisa, ao ensino, à extensão';
    const SUB_3_4 = '3.4 Outras Ações de Extensão';
    const SUB_4_1 = '4.1 Gestão';
    const SUB_4_2 = '4.2 Representação';

    const REGRAS = [
        // Formação e Títulos (IDENTIFICAÇÃO)
        { typeKey: 'POS_DOUTORADO', quando: (f) => f.tipo === 'Livre-docência', status: 'verde', categoria: CAT_FORMACAO },
        // Pós-Doutorado em si é tratado como titulação complementar (2.7), não como um dos graus listados em "Formação e Títulos".
        { typeKey: 'POS_DOUTORADO', quando: (f) => f.tipo === 'Pós-Doutorado', status: 'amarelo', categoria: CAT_PESQUISA, subcategoria: SUB_2_7 }, // falta "título do projeto" (campo desabilitado nesse tipo)
        { typeKey: 'FORMACAO_ACADEMICA', quando: (f) => f.nivel === 'Graduação', status: 'amarelo', categoria: CAT_FORMACAO }, // sem "área" (areaConhecimento desabilitado nesse nível)
        { typeKey: 'FORMACAO_ACADEMICA', status: 'verde', categoria: CAT_FORMACAO }, // Mestrado/Doutorado/Especialização/Aperfeiçoamento/Livre-docência

        // 1. ATIVIDADES DE ENSINO NO PERÍODO DA SOLICITAÇÃO
        { typeKey: 'ATIV_ENSINO', quando: (f) => f.nivel === 'Graduação', status: 'amarelo', categoria: CAT_ENSINO, subcategoria: SUB_1_1 }, // falta carga horária
        { typeKey: 'ATIV_ENSINO', quando: (f) => f.nivel === 'Pós-graduação', status: 'amarelo', categoria: CAT_ENSINO, subcategoria: SUB_1_2 }, // idem — memorial não distingue Stricto/Lato aqui, assume Stricto Sensu
        { typeKey: 'ATIV_ENSINO', quando: (f) => f.nivel === 'Especialização' || f.nivel === 'Aperfeiçoamento', status: 'amarelo', categoria: CAT_ENSINO, subcategoria: SUB_1_3 },
        { typeKey: 'ATIV_ENSINO', status: 'amarelo', categoria: CAT_ENSINO, subcategoria: SUB_1_4 }, // Ensino fundamental/médio/Outros

        { typeKey: 'ORIENTACAO_CONCLUIDA', quando: (f) => f.tipo === 'Pós-Doutorado', status: 'verde', categoria: CAT_ENSINO, subcategoria: SUB_1_2 }, // "Supervisão de Alunos de pós-doutorado" também é parte de 1.2 no memorial
        { typeKey: 'ORIENTACAO_ANDAMENTO', quando: (f) => f.tipo === 'Pós-Doutorado', status: 'verde', categoria: CAT_ENSINO, subcategoria: SUB_1_2 },
        { typeKey: 'ORIENTACAO_CONCLUIDA', quando: (f) => f.tipo === 'Iniciação científica' || f.tipo === 'TCC / Graduação', status: 'amarelo', categoria: CAT_ENSINO, subcategoria: SUB_1_1 },
        { typeKey: 'ORIENTACAO_ANDAMENTO', quando: (f) => f.tipo === 'Iniciação científica' || f.tipo === 'TCC / Graduação', status: 'amarelo', categoria: CAT_ENSINO, subcategoria: SUB_1_1 },
        { typeKey: 'ORIENTACAO_CONCLUIDA', quando: (f) => f.tipo === 'Mestrado' || f.tipo === 'Doutorado', status: 'amarelo', categoria: CAT_ENSINO, subcategoria: SUB_1_2 }, // falta "Doutorado Profissional" como opção
        { typeKey: 'ORIENTACAO_ANDAMENTO', quando: (f) => f.tipo === 'Mestrado' || f.tipo === 'Doutorado', status: 'amarelo', categoria: CAT_ENSINO, subcategoria: SUB_1_2 },
        { typeKey: 'ORIENTACAO_CONCLUIDA', quando: (f) => f.tipo === 'Especialização / Monografia', status: 'amarelo', categoria: CAT_ENSINO, subcategoria: SUB_1_3 }, // falta "Residência/MBA" como opção
        { typeKey: 'ORIENTACAO_ANDAMENTO', quando: (f) => f.tipo === 'Especialização / Monografia', status: 'amarelo', categoria: CAT_ENSINO, subcategoria: SUB_1_3 },
        { typeKey: 'ORIENTACAO_CONCLUIDA', status: 'amarelo', categoria: CAT_ENSINO, subcategoria: SUB_1_4 }, // 'Outra'
        { typeKey: 'ORIENTACAO_ANDAMENTO', status: 'amarelo', categoria: CAT_ENSINO, subcategoria: SUB_1_4 },

        { typeKey: 'CURSO_MINISTRADO', quando: (f) => f.nivel === 'Extensão', status: 'amarelo', categoria: CAT_EXTENSAO, subcategoria: SUB_3_2 }, // falta código SIEX
        { typeKey: 'CURSO_MINISTRADO', quando: (f) => f.nivel === 'Aperfeiçoamento' || f.nivel === 'Especialização', status: 'amarelo', categoria: CAT_ENSINO, subcategoria: SUB_1_3 },
        { typeKey: 'CURSO_MINISTRADO', status: 'amarelo', categoria: CAT_EXTENSAO, subcategoria: SUB_3_2 }, // 'Outra'

        { typeKey: 'FORMACAO_COMPLEMENTAR', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_7 }, // "Cursos, Certificação, Aperfeiçoamento, Especialização, MBA..."

        // 2. ATIVIDADES DE PESQUISA
        { typeKey: 'PROJETO_PESQUISA', status: 'amarelo', categoria: CAT_PESQUISA, subcategoria: SUB_2_1 }, // falta atribuição estruturada (Responsável/Associado/Coordenador/...)
        { typeKey: 'ARTIGO_PERIODICO', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_2 },
        { typeKey: 'ARTIGO_ACEITO', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_2 },
        { typeKey: 'TRABALHO_EVENTO', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_2 },
        { typeKey: 'LIVROS', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_2 },
        { typeKey: 'CAPITULOS_LIVRO', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_2 },
        { typeKey: 'LIVRO_CAPITULO', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_2 }, // legado (mantido por compatibilidade)
        { typeKey: 'SOFTWARE_SEM_REGISTRO', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_3 },
        { typeKey: 'PRODUTO_TECNOLOGICO', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_3 },
        { typeKey: 'MATERIAL_DIDATICO', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_3 },
        { typeKey: 'RELATORIO_PESQUISA', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_3 },
        { typeKey: 'OUTRA_TECNICA', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_3 },
        { typeKey: 'PREMIO', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_4 },
        { typeKey: 'BANCA_CONCLUSAO', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_5_1 },
        { typeKey: 'BANCA_JULGADORA', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_5_2 },
        { typeKey: 'CORPO_EDITORIAL', status: 'amarelo', categoria: CAT_PESQUISA, subcategoria: SUB_2_6 }, // fora do XML oficial (noExport), mas catalogável
        { typeKey: 'REVISOR_PERIODICO', status: 'amarelo', categoria: CAT_PESQUISA, subcategoria: SUB_2_6 },
        { typeKey: 'PARTICIPACAO_EVENTO', quando: (f) => f.formaParticipacao === 'Ouvinte', status: 'amarelo', categoria: CAT_PESQUISA, subcategoria: SUB_2_7 }, // "Participação em eventos como ouvinte" — falta instituição
        { typeKey: 'PARTICIPACAO_EVENTO', status: 'amarelo', categoria: CAT_EXTENSAO, subcategoria: SUB_3_2 }, // Convidado/Participante (palestrante) — falta código SIEX
        { typeKey: 'ATIV_PESQUISA', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_8 },
        { typeKey: 'ATIV_OUTRA', status: 'verde', categoria: CAT_PESQUISA, subcategoria: SUB_2_8 },

        // 3. ATIVIDADES DE EXTENSÃO À COMUNIDADE, DE CURSOS E SERVIÇOS
        { typeKey: 'PROJETO_EXTENSAO', status: 'amarelo', categoria: CAT_EXTENSAO, subcategoria: SUB_3_1 }, // faltam natureza exata, carga horária anual, atribuições completas e código SIEX
        { typeKey: 'ORGANIZACAO_EVENTO', status: 'amarelo', categoria: CAT_EXTENSAO, subcategoria: SUB_3_2 }, // faltam opções de natureza do evento e código SIEX
        { typeKey: 'ASSESSORIA_CONSULTORIA', status: 'verde', categoria: CAT_EXTENSAO, subcategoria: SUB_3_3 },
        { typeKey: 'COMITE_ASSESSORAMENTO', status: 'verde', categoria: CAT_EXTENSAO, subcategoria: SUB_3_3 },
        { typeKey: 'REVISOR_FOMENTO', status: 'verde', categoria: CAT_EXTENSAO, subcategoria: SUB_3_3 },
        { typeKey: 'ATIV_EXTENSAO', status: 'verde', categoria: CAT_EXTENSAO, subcategoria: SUB_3_4 },

        // 4. ATIVIDADES DE GESTÃO E REPRESENTAÇÃO ACADÊMICA
        { typeKey: 'ATIV_DIRECAO', status: 'amarelo', categoria: CAT_GESTAO, subcategoria: SUB_4_1 }, // cargo em texto livre, sem opções pré-definidas por função
        { typeKey: 'ATIV_CONSELHO', status: 'amarelo', categoria: CAT_GESTAO, subcategoria: SUB_4_2 }, // idem, para conselhos/comissões/representação

        // Sem seção numerada correspondente no memorial — é dado funcional
        // (agora coberto por "Classe atual"/"Nível atual"/"Regime de
        // trabalho" em Configurações), não uma "atividade" datada.
        { typeKey: 'VINCULO_PROFISSIONAL', status: 'amarelo', categoria: CAT_CLASSE }, // sem opções exatas de Classe/Nível da carreira docente
    ];

    // Acha a primeira regra cujo typeKey bate e cujo `quando` (se houver) é
    // satisfeito pelos campos do item — mesma regra usada por status(),
    // categoria() e subcategoria(), garantindo que os três sempre vêm da
    // MESMA linha de REGRAS (nunca uma combinação inconsistente).
    function regraDoItem(item) {
        if (!item || !item.typeKey) return null;
        const f = item.fields || {};
        for (const r of REGRAS) {
            if (r.typeKey !== item.typeKey) continue;
            if (r.quando && !r.quando(f)) continue;
            return r;
        }
        return null;
    }

    // Status ('verde'/'amarelo') de um item já cadastrado.
    function status(item) {
        const r = regraDoItem(item);
        return r ? r.status : null;
    }

    // Categoria do memorial (título + numeração oficiais) a que o item
    // pertence — usada pra agrupar a lista de "itens candidatos".
    function categoria(item) {
        const r = regraDoItem(item);
        return r ? r.categoria : null;
    }

    // Subcategoria (a subseção numerada, ex.: "1.1 ...") — nem toda
    // categoria tem uma (Formação e Títulos/Classe-Nível não têm).
    function subcategoria(item) {
        const r = regraDoItem(item);
        return r ? (r.subcategoria || null) : null;
    }

    // Só o typeKey tem alguma correspondência mapeada? (usado pra decidir se
    // o checkbox "usar na Progressão" aparece no formulário de Catalogar —
    // não depende dos valores dos campos, que lá ainda podem estar sendo
    // editados ao vivo, ver tab-catalogar.js/renderVisibilidadeBlock).
    function elegivel(typeKey) {
        return REGRAS.some((r) => r.typeKey === typeKey);
    }

    const ORDEM_CATEGORIAS = [CAT_FORMACAO, CAT_ENSINO, CAT_PESQUISA, CAT_EXTENSAO, CAT_GESTAO, CAT_CLASSE];
    const ORDEM_SUBCATEGORIAS = {
        [CAT_ENSINO]: [SUB_1_1, SUB_1_2, SUB_1_3, SUB_1_4],
        [CAT_PESQUISA]: [SUB_2_1, SUB_2_2, SUB_2_3, SUB_2_4, SUB_2_5_1, SUB_2_5_2, SUB_2_6, SUB_2_7, SUB_2_8],
        [CAT_EXTENSAO]: [SUB_3_1, SUB_3_2, SUB_3_3, SUB_3_4],
        [CAT_GESTAO]: [SUB_4_1, SUB_4_2],
    };
    function ordemCategorias() {
        return ORDEM_CATEGORIAS.slice();
    }
    function ordemSubcategorias(nomeCategoria) {
        return (ORDEM_SUBCATEGORIAS[nomeCategoria] || []).slice();
    }

    return { status, elegivel, categoria, subcategoria, ordemCategorias, ordemSubcategorias };
})();
