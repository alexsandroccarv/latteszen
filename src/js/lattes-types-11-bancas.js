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
   lattesZen — Definições de tipo: 11 Bancas
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "11 Bancas"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.

   i18n (preparação): label/help/placeholder passam por t(); os arrays de
   `options` (Natureza/Tipo) ficam de fora — ver nota de arquitetura no
   topo de lattes-types-campos.js (value vs. label ainda em aberto).
   ========================================================================== */
import { F_ANO, F_INST, F_AFIM, F_PAIS, F_IDIOMA } from './lattes-types-campos.js';
import { t } from './i18n.js';

export const TYPES_11_BANCAS = {
    // 11 Bancas
    BANCA_CONCLUSAO: { label: t('lattes.tipo.BANCA_CONCLUSAO.label', 'Participação em bancas de trabalhos de conclusão'), fields: [
        { key: 'tipo', label: t('lattes.tipo.BANCA_CONCLUSAO.campo.tipo.label', 'Natureza'), type: 'select', required: true, options: ['Mestrado', 'Doutorado', 'Exame de qualificação de doutorado', 'Exame de qualificação de mestrado', 'Curso de aperfeiçoamento/especialização', 'Graduação'] },
        { key: 'modalidade', label: t('lattes.tipo.BANCA_CONCLUSAO.campo.modalidade.label', 'Tipo'), type: 'select', options: ['Acadêmico', 'Profissionalizante'], help: t('lattes.tipo.BANCA_CONCLUSAO.campo.modalidade.help', 'Apenas para Mestrado.'),
          disabledWhen: { field: 'tipo', in: ['Doutorado', 'Exame de qualificação de doutorado', 'Exame de qualificação de mestrado', 'Curso de aperfeiçoamento/especialização', 'Graduação'] } },
        { key: 'titulo', label: t('lattes.tipo.BANCA_CONCLUSAO.campo.titulo.label', 'Título'), type: 'text' }, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'url', label: t('lattes.tipo.BANCA_CONCLUSAO.campo.url.label', 'Home page do trabalho (URL)'), type: 'url' },
        { key: 'candidato', label: t('lattes.tipo.BANCA_CONCLUSAO.campo.candidato.label', 'Nome do candidato'), type: 'text' }, F_INST, { key: 'curso', label: t('lattes.tipo.BANCA_CONCLUSAO.campo.curso.label', 'Curso'), type: 'text' },
        { key: 'membros', label: t('lattes.tipo.BANCA_CONCLUSAO.campo.membros.label', 'Participantes da banca'), type: 'textarea', placeholder: t('lattes.tipo.BANCA_CONCLUSAO.campo.membros.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.BANCA_CONCLUSAO.campo.membros.help', 'Um nome por posição — a ordem digitada é a ordem de autoria na banca.') },
        { key: 'palavrasChave', label: t('lattes.tipo.BANCA_CONCLUSAO.campo.palavras_chave.label', 'Palavras-chave'), type: 'textarea', placeholder: t('lattes.tipo.BANCA_CONCLUSAO.campo.palavras_chave.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.BANCA_CONCLUSAO.campo.palavras_chave.help', 'Até 6 palavras-chave (limite da Plataforma Lattes).') },
        { key: 'areaConhecimento', label: t('lattes.tipo.BANCA_CONCLUSAO.campo.area_conhecimento.label', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', help: t('lattes.tipo.BANCA_CONCLUSAO.campo.area_conhecimento.help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.') },
        { key: 'setores', label: t('lattes.tipo.BANCA_CONCLUSAO.campo.setores.label', 'Setores de atividade'), type: 'cnaeSetores', help: t('lattes.tipo.BANCA_CONCLUSAO.campo.setores.help', 'Até 3 setores (lista CNAE).') },
        { key: 'outrasInfo', label: t('lattes.tipo.BANCA_CONCLUSAO.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
    ] },
    BANCA_JULGADORA: { label: t('lattes.tipo.BANCA_JULGADORA.label', 'Participação em bancas de comissões julgadoras'), fields: [
        { key: 'tipo', label: t('lattes.tipo.BANCA_JULGADORA.campo.tipo.label', 'Natureza'), type: 'select', required: true, options: ['Concurso público', 'Professor titular', 'Livre-docência', 'Avaliação de cursos', 'Outra'] },
        { key: 'titulo', label: t('lattes.tipo.BANCA_JULGADORA.campo.titulo.label', 'Título'), type: 'text', help: t('lattes.tipo.BANCA_JULGADORA.campo.titulo.help', 'Título do concurso, cargo ou processo avaliado.') }, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'url', label: t('lattes.tipo.BANCA_JULGADORA.campo.url.label', 'Home page do trabalho (URL)'), type: 'url' },
        F_INST,
        { key: 'membros', label: t('lattes.tipo.BANCA_JULGADORA.campo.membros.label', 'Participantes da banca'), type: 'textarea', placeholder: t('lattes.tipo.BANCA_JULGADORA.campo.membros.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.BANCA_JULGADORA.campo.membros.help', 'Um nome por posição — a ordem digitada é a ordem de autoria na banca.') },
        { key: 'palavrasChave', label: t('lattes.tipo.BANCA_JULGADORA.campo.palavras_chave.label', 'Palavras-chave'), type: 'textarea', placeholder: t('lattes.tipo.BANCA_JULGADORA.campo.palavras_chave.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.BANCA_JULGADORA.campo.palavras_chave.help', 'Até 6 palavras-chave (limite da Plataforma Lattes).') },
        { key: 'areaConhecimento', label: t('lattes.tipo.BANCA_JULGADORA.campo.area_conhecimento.label', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', help: t('lattes.tipo.BANCA_JULGADORA.campo.area_conhecimento.help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.') },
        { key: 'setores', label: t('lattes.tipo.BANCA_JULGADORA.campo.setores.label', 'Setores de atividade'), type: 'cnaeSetores', help: t('lattes.tipo.BANCA_JULGADORA.campo.setores.help', 'Até 3 setores (lista CNAE).') },
        { key: 'outrasInfo', label: t('lattes.tipo.BANCA_JULGADORA.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
    ] },
};
