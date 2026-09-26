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
   Classificação, por typeKey (e por vezes pelo campo `nivel`/`tipo` do
   próprio item), de cada tipo do catálogo que corresponde a algum item do
   Memorial Descritivo oficial para Progressão Funcional da CPPD/Unifesp —
   baseada na análise item a item feita antes deste módulo (mapeamento
   verificado lendo o código real de lattes-types-*.js, não por suposição).

   'verde'   = correspondência direta — o item só precisa do checkbox
               "usar na Progressão" (ver tab-catalogar.js/renderVisibilidadeBlock).
   'amarelo' = correspondência com lacunas conhecidas (ex.: falta carga
               horária, falta código SIEX, opções de select mais genéricas
               que o memorial pede) — por enquanto o item também só ganha o
               checkbox; os campos complementares para fechar essas lacunas
               ainda serão desenhados numa etapa futura.
   (ausente) = tipo sem correspondência no memorial — nunca é candidato.

   Regras concorrentes pro mesmo typeKey são avaliadas em ordem — a primeira
   cujo `quando` (se houver) bater define o status; por isso as mais
   específicas vêm antes das mais genéricas.
   ========================================================================== */
window.LzProgressaoMapa = (function () {
    const REGRAS = [
        // Formação e Títulos (IDENTIFICAÇÃO)
        { typeKey: 'POS_DOUTORADO', quando: (f) => f.tipo === 'Livre-docência', status: 'verde' },
        { typeKey: 'POS_DOUTORADO', quando: (f) => f.tipo === 'Pós-Doutorado', status: 'amarelo' }, // falta "título do projeto" (campo desabilitado nesse tipo)
        { typeKey: 'FORMACAO_ACADEMICA', quando: (f) => f.nivel === 'Graduação', status: 'amarelo' }, // sem "área" (areaConhecimento desabilitado nesse nível)
        { typeKey: 'FORMACAO_ACADEMICA', status: 'verde' }, // Mestrado/Doutorado/Especialização/Aperfeiçoamento (2.7)

        // 1. Atividades de Ensino
        { typeKey: 'ATIV_ENSINO', status: 'amarelo' }, // 1.1/1.2/1.3 aulas — falta carga horária em todos os níveis
        { typeKey: 'ORIENTACAO_CONCLUIDA', quando: (f) => f.tipo === 'Pós-Doutorado', status: 'verde' },
        { typeKey: 'ORIENTACAO_ANDAMENTO', quando: (f) => f.tipo === 'Pós-Doutorado', status: 'verde' },
        { typeKey: 'ORIENTACAO_CONCLUIDA', status: 'amarelo' }, // demais tipos: faltam opções específicas (Mentoria/Monitoria/Estágio, Doutorado Profissional, Residência/MBA...)
        { typeKey: 'ORIENTACAO_ANDAMENTO', status: 'amarelo' },
        { typeKey: 'CURSO_MINISTRADO', status: 'amarelo' }, // alternativa p/ 1.3 lato sensu e 3.2 — falta código SIEX em 3.2
        { typeKey: 'FORMACAO_COMPLEMENTAR', status: 'verde' }, // 1.4 outras atividades de ensino + 2.7 cursos/certificações

        // 2. Atividades de Pesquisa
        { typeKey: 'PROJETO_PESQUISA', status: 'amarelo' }, // falta atribuição estruturada (Responsável/Associado/Coordenador/...)
        { typeKey: 'ARTIGO_PERIODICO', status: 'verde' },
        { typeKey: 'ARTIGO_ACEITO', status: 'verde' },
        { typeKey: 'TRABALHO_EVENTO', status: 'verde' },
        { typeKey: 'LIVROS', status: 'verde' },
        { typeKey: 'CAPITULOS_LIVRO', status: 'verde' },
        { typeKey: 'LIVRO_CAPITULO', status: 'verde' }, // legado (mantido por compatibilidade)
        { typeKey: 'SOFTWARE_SEM_REGISTRO', status: 'verde' },
        { typeKey: 'PRODUTO_TECNOLOGICO', status: 'verde' },
        { typeKey: 'MATERIAL_DIDATICO', status: 'verde' },
        { typeKey: 'RELATORIO_PESQUISA', status: 'verde' },
        { typeKey: 'OUTRA_TECNICA', status: 'verde' },
        { typeKey: 'PREMIO', status: 'verde' },
        { typeKey: 'BANCA_CONCLUSAO', status: 'verde' },
        { typeKey: 'BANCA_JULGADORA', status: 'verde' },
        { typeKey: 'CORPO_EDITORIAL', status: 'amarelo' }, // fora do XML oficial (noExport), mas catalogável
        { typeKey: 'REVISOR_PERIODICO', status: 'amarelo' },
        { typeKey: 'PARTICIPACAO_EVENTO', status: 'amarelo' }, // 2.7 ouvinte (falta instituição) / 3.2 palestrante (falta SIEX)
        { typeKey: 'ATIV_PESQUISA', status: 'verde' },
        { typeKey: 'ATIV_OUTRA', status: 'verde' },

        // 3. Atividades de Extensão
        { typeKey: 'PROJETO_EXTENSAO', status: 'amarelo' }, // faltam natureza exata, carga horária anual, atribuições completas e código SIEX
        { typeKey: 'ORGANIZACAO_EVENTO', status: 'amarelo' }, // faltam opções de natureza do evento e código SIEX
        { typeKey: 'ASSESSORIA_CONSULTORIA', status: 'verde' },
        { typeKey: 'COMITE_ASSESSORAMENTO', status: 'verde' },
        { typeKey: 'REVISOR_FOMENTO', status: 'verde' },
        { typeKey: 'ATIV_EXTENSAO', status: 'verde' },

        // 4. Atividades de Gestão e Representação Acadêmica
        { typeKey: 'ATIV_DIRECAO', status: 'amarelo' }, // cargo em texto livre, sem opções pré-definidas por função
        { typeKey: 'ATIV_CONSELHO', status: 'amarelo' }, // idem, para conselhos/comissões/representação

        // Classe/Nível funcional (dado funcional, não uma "atividade" datada)
        { typeKey: 'VINCULO_PROFISSIONAL', status: 'amarelo' }, // sem opções exatas de Classe/Nível da carreira docente
    ];

    // Status ('verde'/'amarelo') de um item já cadastrado, considerando
    // também campos como `nivel`/`tipo` quando a regra depender deles.
    function status(item) {
        if (!item || !item.typeKey) return null;
        const f = item.fields || {};
        for (const r of REGRAS) {
            if (r.typeKey !== item.typeKey) continue;
            if (r.quando && !r.quando(f)) continue;
            return r.status;
        }
        return null;
    }

    // Só o typeKey tem alguma correspondência mapeada? (usado pra decidir se
    // o checkbox "usar na Progressão" aparece no formulário de Catalogar —
    // não depende dos valores dos campos, que lá ainda podem estar sendo
    // editados ao vivo, ver tab-catalogar.js/renderVisibilidadeBlock).
    function elegivel(typeKey) {
        return REGRAS.some((r) => r.typeKey === typeKey);
    }

    // Categoria do memorial (mesma seção do CPPD) a que cada typeKey mapeado
    // pertence — usada pra agrupar a lista de "itens candidatos" na aba
    // Progressão Docente. Um typeKey só pertence a uma categoria, mesmo
    // quando tem mais de uma regra em REGRAS (condições diferentes do mesmo
    // tipo, ex.: POS_DOUTORADO), por isso é um mapa à parte, não um campo em
    // cada regra.
    const ORDEM_CATEGORIAS = [
        'Formação e Títulos',
        'Atividades de Ensino',
        'Atividades de Pesquisa',
        'Atividades de Extensão',
        'Atividades de Gestão e Representação Acadêmica',
        'Classe/Nível funcional',
    ];
    const CATEGORIAS = {
        POS_DOUTORADO: 'Formação e Títulos',
        FORMACAO_ACADEMICA: 'Formação e Títulos',

        ATIV_ENSINO: 'Atividades de Ensino',
        ORIENTACAO_CONCLUIDA: 'Atividades de Ensino',
        ORIENTACAO_ANDAMENTO: 'Atividades de Ensino',
        CURSO_MINISTRADO: 'Atividades de Ensino',
        FORMACAO_COMPLEMENTAR: 'Atividades de Ensino',

        PROJETO_PESQUISA: 'Atividades de Pesquisa',
        ARTIGO_PERIODICO: 'Atividades de Pesquisa',
        ARTIGO_ACEITO: 'Atividades de Pesquisa',
        TRABALHO_EVENTO: 'Atividades de Pesquisa',
        LIVROS: 'Atividades de Pesquisa',
        CAPITULOS_LIVRO: 'Atividades de Pesquisa',
        LIVRO_CAPITULO: 'Atividades de Pesquisa',
        SOFTWARE_SEM_REGISTRO: 'Atividades de Pesquisa',
        PRODUTO_TECNOLOGICO: 'Atividades de Pesquisa',
        MATERIAL_DIDATICO: 'Atividades de Pesquisa',
        RELATORIO_PESQUISA: 'Atividades de Pesquisa',
        OUTRA_TECNICA: 'Atividades de Pesquisa',
        PREMIO: 'Atividades de Pesquisa',
        BANCA_CONCLUSAO: 'Atividades de Pesquisa',
        BANCA_JULGADORA: 'Atividades de Pesquisa',
        CORPO_EDITORIAL: 'Atividades de Pesquisa',
        REVISOR_PERIODICO: 'Atividades de Pesquisa',
        PARTICIPACAO_EVENTO: 'Atividades de Pesquisa',
        ATIV_PESQUISA: 'Atividades de Pesquisa',
        ATIV_OUTRA: 'Atividades de Pesquisa',

        PROJETO_EXTENSAO: 'Atividades de Extensão',
        ORGANIZACAO_EVENTO: 'Atividades de Extensão',
        ASSESSORIA_CONSULTORIA: 'Atividades de Extensão',
        COMITE_ASSESSORAMENTO: 'Atividades de Extensão',
        REVISOR_FOMENTO: 'Atividades de Extensão',
        ATIV_EXTENSAO: 'Atividades de Extensão',

        ATIV_DIRECAO: 'Atividades de Gestão e Representação Acadêmica',
        ATIV_CONSELHO: 'Atividades de Gestão e Representação Acadêmica',

        VINCULO_PROFISSIONAL: 'Classe/Nível funcional',
    };
    function categoria(typeKey) {
        return CATEGORIAS[typeKey] || null;
    }
    function ordemCategorias() {
        return ORDEM_CATEGORIAS.slice();
    }

    return { status, elegivel, categoria, ordemCategorias };
})();
