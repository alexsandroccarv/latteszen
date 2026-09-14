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
