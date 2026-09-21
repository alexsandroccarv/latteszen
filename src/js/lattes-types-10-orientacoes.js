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
   lattesZen — Definições de tipo: 10 Orientações
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "10 Orientações"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.

   i18n (preparação): label/help/placeholder passam por t(); os arrays de
   `options` ficam de fora — ver nota de arquitetura no topo de
   lattes-types-campos.js (value vs. label ainda em aberto).
   ========================================================================== */
import { F_ANO, F_INST, F_AFIM, F_PAIS, F_IDIOMA } from './lattes-types-campos.js';
import { t } from './i18n.js';

export const TYPES_10_ORIENTACOES = {
    // 10 Orientações
    ORIENTACAO_CONCLUIDA: { label: t('lattes.tipo.ORIENTACAO_CONCLUIDA.label', 'Orientações e supervisões concluídas'), fields: [
        { key: 'tipo', label: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.tipo.label', 'Natureza'), type: 'select', required: true, options: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Mestrado', 'Doutorado', 'Pós-Doutorado', 'Outra'] },
        { key: 'modalidade', label: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.modalidade.label', 'Tipo'), type: 'select', options: ['Acadêmico', 'Profissionalizante'], help: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.modalidade.help', 'Apenas para Mestrado.'),
          disabledWhen: { field: 'tipo', in: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Doutorado', 'Pós-Doutorado', 'Outra'] } },
        { key: 'titulo', label: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.titulo.label', 'Título do trabalho'), type: 'text' }, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'url', label: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.url.label', 'Home page do trabalho (URL)'), type: 'url' },
        { key: 'relevante', label: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'orientando', label: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.orientando.label', 'Nome do orientado(a)'), type: 'text', required: true },
        { key: 'natureza', label: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.natureza.label', 'Tipo de orientação'), type: 'select', options: ['Orientador principal', 'Coorientador'] },
        { key: 'curso', label: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.curso.label', 'Curso'), type: 'text' }, F_INST,
        { key: 'comBolsa', label: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.com_bolsa.label', 'Com bolsa?'), type: 'checkbox' },
        { key: 'bolsa', label: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.bolsa.label', 'Agência financiadora'), type: 'text' },
        { key: 'palavrasChave', label: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.palavras_chave.label', 'Palavras-chave'), type: 'textarea', placeholder: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.palavras_chave.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.palavras_chave.help', 'Até 6 palavras-chave (limite da Plataforma Lattes).') },
        { key: 'areaConhecimento', label: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.area_conhecimento.label', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', help: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.area_conhecimento.help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.') },
        { key: 'setores', label: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.setores.label', 'Setores de atividade'), type: 'cnaeSetores', help: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.setores.help', 'Até 3 setores (lista CNAE).') },
        { key: 'outrasInfo', label: t('lattes.tipo.ORIENTACAO_CONCLUIDA.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
    ] },
    // "10 mais relevantes?" consta na tela real (doc 10.2, mesma estrutura de
    // 10.1), mas nenhum dos elementos DADOS-BASICOS-DA-ORIENTACAO-EM-
    // ANDAMENTO-DE-* tem o atributo FLAG-RELEVANCIA no XSD/DTD (só as
    // "concluídas" têm) — mantido na UI como referência do usuário, mas sem
    // exportação no XML para este tipo.
    ORIENTACAO_ANDAMENTO: { label: t('lattes.tipo.ORIENTACAO_ANDAMENTO.label', 'Orientações e supervisões em andamento'), fields: [
        { key: 'tipo', label: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.tipo.label', 'Natureza'), type: 'select', required: true, options: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Mestrado', 'Doutorado', 'Pós-Doutorado', 'Outra'] },
        { key: 'modalidade', label: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.modalidade.label', 'Tipo'), type: 'select', options: ['Acadêmico', 'Profissionalizante'], help: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.modalidade.help', 'Apenas para Mestrado.'),
          disabledWhen: { field: 'tipo', in: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Doutorado', 'Pós-Doutorado', 'Outra'] } },
        { key: 'titulo', label: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.titulo.label', 'Título do trabalho'), type: 'text' }, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'url', label: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.url.label', 'Home page do trabalho (URL)'), type: 'url' },
        { key: 'relevante', label: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'orientando', label: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.orientando.label', 'Nome do orientando(a)'), type: 'text', required: true },
        { key: 'natureza', label: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.natureza.label', 'Tipo de orientação'), type: 'select', options: ['Orientador principal', 'Coorientador'] },
        { key: 'curso', label: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.curso.label', 'Curso'), type: 'text' }, F_INST,
        { key: 'comBolsa', label: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.com_bolsa.label', 'Com bolsa?'), type: 'checkbox' },
        { key: 'bolsa', label: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.bolsa.label', 'Agência financiadora'), type: 'text' },
        { key: 'palavrasChave', label: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.palavras_chave.label', 'Palavras-chave'), type: 'textarea', placeholder: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.palavras_chave.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.palavras_chave.help', 'Até 6 palavras-chave (limite da Plataforma Lattes).') },
        { key: 'areaConhecimento', label: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.area_conhecimento.label', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', help: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.area_conhecimento.help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.') },
        { key: 'setores', label: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.setores.label', 'Setores de atividade'), type: 'cnaeSetores', help: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.setores.help', 'Até 3 setores (lista CNAE).') },
        { key: 'outrasInfo', label: t('lattes.tipo.ORIENTACAO_ANDAMENTO.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
    ] },
};
