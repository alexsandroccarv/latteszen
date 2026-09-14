/* ==========================================================================
   lattesZen — Definições de tipo: 04 Projetos
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "04 Projetos"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.
   ========================================================================== */
import { QTD_TECNICO, projetoFieldsPadrao, PROJETO_ENSINO_FIELDS } from './lattes-types-campos.js';

export const TYPES_04_PROJETOS = {
    // 04 Projetos
    PROJETO_PESQUISA: { label: 'Projetos de pesquisa', fields: projetoFieldsPadrao(null, 'Nome do projeto', true) },
    PROJETO_DESENVOLVIMENTO: { label: 'Projeto de desenvolvimento tecnológico', fields: projetoFieldsPadrao([QTD_TECNICO]) },
    PROJETO_EXTENSAO: { label: 'Projeto de extensão', fields: projetoFieldsPadrao() },
    PROJETO_ENSINO: { label: 'Projeto de ensino', fields: PROJETO_ENSINO_FIELDS },
    PROJETO_OUTRO: { label: 'Outros tipos de projetos', fields: projetoFieldsPadrao() },
};
