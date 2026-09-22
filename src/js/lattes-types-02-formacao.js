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
   lattesZen — Definições de tipo: 02 Formação
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "02 Formação"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.

   i18n (preparação): label/help/placeholder passam por t(), inclusive os
   VALORES (não as chaves) do mapa `labelWhen.map` — são rótulos exibidos
   condicionalmente. Os arrays de `options` viram `{ value, label }` via
   opcoes() — `default` e as CHAVES de `disabledWhen`/`labelWhen`
   continuam literais, batendo com `value` — ver nota de arquitetura no
   topo de lattes-types-campos.js.
   ========================================================================== */
import { F_INST, F_AINI, NIVEIS_FORMACAO, nivelExcept, opcoes } from './lattes-types-campos.js';
import { t } from './i18n.js';

export const TYPES_02_FORMACAO = {
    // 02 Formação
    FORMACAO_ACADEMICA: { label: t('lattes.tipo.FORMACAO_ACADEMICA.label', 'Formação acadêmica/titulação'), fields: [
        { key: 'nivel', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.nivel.label', 'Nível'), type: 'select', required: true, options: NIVEIS_FORMACAO },
        // "Tipo de X": só existe (e só faz sentido) para o próprio nível X.
        { key: 'tipoDoutorado', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.tipo_doutorado.label', 'Tipo de doutorado'), type: 'select', options: opcoes('formacao_academica_tipo_doutorado', ['Normal', 'Sanduíche', 'Cotutela', 'Cotutela-Sanduíche']),
          disabledWhen: { field: 'nivel', in: nivelExcept('Doutorado') } },
        { key: 'tipoMestrado', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.tipo_mestrado.label', 'Tipo de mestrado'), type: 'select', options: opcoes('formacao_academica_tipo_mestrado', ['Normal', 'Sanduíche']),
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado') } },
        { key: 'tipoMestradoProfissional', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.tipo_mestrado_profissional.label', 'Tipo de mestrado profissional'), type: 'select', options: opcoes('formacao_academica_tipo_mestrado_profissional', ['Normal', 'Sanduíche']),
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado profissional') } },
        { key: 'tipoGraduacao', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.tipo_graduacao.label', 'Tipo de graduação'), type: 'select', options: opcoes('formacao_academica_tipo_graduacao', ['Normal', 'Sanduíche']),
          disabledWhen: { field: 'nivel', in: nivelExcept('Graduação') } },
        { key: 'instituicao', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.instituicao.label', 'Instituição'), type: 'text', required: true },
        { key: 'curso', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.curso.label', 'Curso'), type: 'text',
          disabledWhen: { field: 'nivel', in: ['Ensino fundamental', 'Ensino médio', 'Residência médica'] } },
        { key: 'cargaHoraria', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.carga_horaria.label', 'Carga horária (h)'), type: 'number', na: true,
          disabledWhen: { field: 'nivel', in: nivelExcept('Aperfeiçoamento', 'Especialização') } },
        { key: 'statusCurso', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.status_curso.label', 'Status do curso'), type: 'select', options: opcoes('status_curso', ['Em andamento', 'Concluído', 'Incompleto']) },
        { ...F_AINI, row: 'periodo' }, { key: 'anoFim', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.ano_fim.label', 'Conclusão (ano)'), type: 'datebr', row: 'periodo',
          disabledWhen: { field: 'statusCurso', in: ['', 'Em andamento', 'Incompleto'] } },
        { key: 'anoObtencaoTitulo', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.ano_obtencao_titulo.label', 'Obtenção do título (mês/ano)'), type: 'datebr',
          disabledWhen: [
              { field: 'nivel', in: nivelExcept('Mestrado', 'Mestrado profissional', 'Doutorado') },
              { field: 'statusCurso', in: ['', 'Em andamento', 'Incompleto'] },
          ] },
        { key: 'comBolsa', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.com_bolsa.label', 'Com bolsa?'), type: 'select', options: opcoes('com_bolsa', ['Sim', 'Não']),
          disabledWhen: { field: 'nivel', in: ['Ensino fundamental', 'Ensino médio'] } },
        { key: 'bolsa', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.bolsa.label', 'Agência financiadora'), type: 'text', disabledWhen: { field: 'comBolsa', in: ['', 'Não'] } },
        { key: 'titulo', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.titulo.label', 'Título da dissertação/tese'), type: 'text', na: true,
          labelWhen: { field: 'nivel', map: { 'Graduação': t('lattes.tipo.FORMACAO_ACADEMICA.campo.titulo.label_when.monografia', 'Título monografia'), 'Aperfeiçoamento': t('lattes.tipo.FORMACAO_ACADEMICA.campo.titulo.label_when.monografia', 'Título monografia'), 'Especialização': t('lattes.tipo.FORMACAO_ACADEMICA.campo.titulo.label_when.monografia', 'Título monografia') } },
          disabledWhen: { field: 'nivel', in: ['Ensino fundamental', 'Ensino médio', 'Curso técnico', 'Residência médica'] } },
        { key: 'orientador', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.orientador.label', 'Nome completo do orientador'), type: 'text', na: true,
          disabledWhen: { field: 'nivel', in: ['Ensino fundamental', 'Ensino médio', 'Curso técnico', 'Residência médica'] } },
        { key: 'coorientador', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.coorientador.label', 'Nome completo do coorientador'), type: 'text', na: true,
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado', 'Mestrado profissional', 'Doutorado') } },
        { key: 'residenciaEm', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.residencia_em.label', 'Residência médica em'), type: 'text', disabledWhen: { field: 'nivel', in: nivelExcept('Residência médica') } },
        { key: 'numeroRegistro', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.numero_registro.label', 'Número do registro'), type: 'text', disabledWhen: { field: 'nivel', in: nivelExcept('Residência médica') } },
        { key: 'palavrasChave', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.palavras_chave.label', 'Palavras-chave'), type: 'textarea', placeholder: t('lattes.tipo.FORMACAO_ACADEMICA.campo.palavras_chave.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.FORMACAO_ACADEMICA.campo.palavras_chave.help', 'Até 6 palavras-chave (limite da Plataforma Lattes).'),
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado', 'Mestrado profissional', 'Doutorado', 'Residência médica') } },
        { key: 'areaConhecimento', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.area_conhecimento.label', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', help: t('lattes.tipo.FORMACAO_ACADEMICA.campo.area_conhecimento.help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.'),
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado', 'Mestrado profissional', 'Doutorado', 'Residência médica') } },
        { key: 'setores', label: t('lattes.tipo.FORMACAO_ACADEMICA.campo.setores.label', 'Setores de atividade'), type: 'cnaeSetores', help: t('lattes.tipo.FORMACAO_ACADEMICA.campo.setores.help', 'Até 3 setores (lista CNAE).'),
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado', 'Mestrado profissional', 'Doutorado', 'Residência médica') } },
    ] },
    POS_DOUTORADO: { label: t('lattes.tipo.POS_DOUTORADO.label', 'Pós-doutorado e/ou livre-docência'), fields: [
        { key: 'tipo', label: t('lattes.tipo.POS_DOUTORADO.campo.tipo.label', 'Nível'), type: 'select', required: true, options: opcoes('pos_doutorado_tipo', ['Pós-Doutorado', 'Livre-docência']) },
        { key: 'instituicao', label: t('lattes.tipo.POS_DOUTORADO.campo.instituicao.label', 'Instituição'), type: 'text', required: true },
        // Pós-Doutorado: Status do curso, Período (início/conclusão) e Bolsa.
        { key: 'statusCurso', label: t('lattes.tipo.POS_DOUTORADO.campo.status_curso.label', 'Status do curso'), type: 'select', options: opcoes('status_curso', ['Em andamento', 'Concluído', 'Incompleto']),
          disabledWhen: { field: 'tipo', equals: 'Livre-docência' } },
        { ...F_AINI, row: 'periodo', disabledWhen: { field: 'tipo', equals: 'Livre-docência' } },
        { key: 'anoFim', label: t('lattes.tipo.POS_DOUTORADO.campo.ano_fim.label', 'Ano de conclusão'), type: 'datebr', row: 'periodo', disabledWhen: { field: 'tipo', equals: 'Livre-docência' } },
        { key: 'comBolsa', label: t('lattes.tipo.POS_DOUTORADO.campo.com_bolsa.label', 'Com bolsa?'), type: 'select', options: opcoes('com_bolsa', ['Sim', 'Não']),
          disabledWhen: { field: 'tipo', equals: 'Livre-docência' } },
        { key: 'bolsa', label: t('lattes.tipo.POS_DOUTORADO.campo.bolsa.label', 'Agência financiadora'), type: 'text', disabledWhen: { field: 'comBolsa', in: ['', 'Não'] } },
        // Livre-docência: Período (obtenção do título), Detalhamento (título),
        // Palavras-chave e Setores.
        { key: 'anoObtencaoTitulo', label: t('lattes.tipo.POS_DOUTORADO.campo.ano_obtencao_titulo.label', 'Obtenção do título'), type: 'datebr', disabledWhen: { field: 'tipo', equals: 'Pós-Doutorado' } },
        { key: 'titulo', label: t('lattes.tipo.POS_DOUTORADO.campo.titulo.label', 'Título do trabalho'), type: 'text', disabledWhen: { field: 'tipo', equals: 'Pós-Doutorado' } },
        { key: 'palavrasChave', label: t('lattes.tipo.POS_DOUTORADO.campo.palavras_chave.label', 'Palavras-chave'), type: 'textarea', placeholder: t('lattes.tipo.POS_DOUTORADO.campo.palavras_chave.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.POS_DOUTORADO.campo.palavras_chave.help', 'Até 6 palavras-chave (limite da Plataforma Lattes).'),
          disabledWhen: { field: 'tipo', equals: 'Pós-Doutorado' } },
        // Áreas: comum aos dois níveis.
        { key: 'areaConhecimento', label: t('lattes.tipo.POS_DOUTORADO.campo.area_conhecimento.label', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', help: t('lattes.tipo.POS_DOUTORADO.campo.area_conhecimento.help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.') },
        { key: 'setores', label: t('lattes.tipo.POS_DOUTORADO.campo.setores.label', 'Setores de atividade'), type: 'cnaeSetores', help: t('lattes.tipo.POS_DOUTORADO.campo.setores.help', 'Até 3 setores (lista CNAE).'),
          disabledWhen: { field: 'tipo', equals: 'Pós-Doutorado' } },
    ] },
    // Nível de Formação complementar (espelha FORMACAO-COMPLEMENTAR do schema
    // Lattes: 4 elementos distintos — só "MBA" tem bolsa/orientador/monografia/
    // áreas/palavras-chave/setores; os outros 3 só têm os campos básicos.
    FORMACAO_COMPLEMENTAR: { label: t('lattes.tipo.FORMACAO_COMPLEMENTAR.label', 'Formação complementar'), fields: [
        { key: 'nivel', label: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.nivel.label', 'Nível'), type: 'select', required: true, default: 'Outros',
          options: opcoes('formacao_complementar_nivel', ['Curso de curta duração', 'Extensão universitária', 'MBA', 'Outros']) },
        { key: 'titulo', label: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.titulo.label', 'Curso'), type: 'text', required: true },
        F_INST,
        { key: 'cargaHoraria', label: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.carga_horaria.label', 'Carga horária (h)'), type: 'number', na: true },
        { key: 'statusCurso', label: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.status_curso.label', 'Status do curso'), type: 'select', options: opcoes('status_curso', ['Em andamento', 'Concluído', 'Incompleto']) },
        { key: 'anoInicio', label: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.ano_inicio.label', 'Início (ano)'), type: 'datebr', row: 'periodo' },
        { key: 'anoFim', label: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.ano_fim.label', 'Conclusão (ano)'), type: 'datebr', row: 'periodo' },
        { key: 'anoObtencaoTitulo', label: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.ano_obtencao_titulo.label', 'Obtenção do título'), type: 'datebr', disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'comBolsa', label: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.com_bolsa.label', 'Com bolsa?'), type: 'select', options: opcoes('com_bolsa', ['Sim', 'Não']), disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'bolsa', label: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.bolsa.label', 'Agência financiadora'), type: 'text', disabledWhen: [{ field: 'nivel', notEquals: 'MBA' }, { field: 'comBolsa', in: ['', 'Não'] }] },
        { key: 'tituloMonografia', label: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.titulo_monografia.label', 'Título da monografia'), type: 'text', disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'orientador', label: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.orientador.label', 'Nome completo do orientador'), type: 'text', disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'palavrasChave', label: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.palavras_chave.label', 'Palavras-chave'), type: 'textarea', placeholder: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.palavras_chave.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.palavras_chave.help', 'Até 6 palavras-chave (limite da Plataforma Lattes).'), disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'areaConhecimento', label: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.area_conhecimento.label', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', help: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.area_conhecimento.help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.'), disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'setores', label: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.setores.label', 'Setores de atividade'), type: 'cnaeSetores', help: t('lattes.tipo.FORMACAO_COMPLEMENTAR.campo.setores.help', 'Até 3 setores (lista CNAE).'), disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
    ] },
};
