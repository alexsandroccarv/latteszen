/* ==========================================================================
   lattesZen — Definições de tipo: 02 Formação
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "02 Formação"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.
   ========================================================================== */
import { F_INST, F_AINI, NIVEIS_FORMACAO, nivelExcept } from './lattes-types-campos.js';

export const TYPES_02_FORMACAO = {
    // 02 Formação
    FORMACAO_ACADEMICA: { label: 'Formação acadêmica/titulação', fields: [
        { key: 'nivel', label: 'Nível', type: 'select', required: true, options: NIVEIS_FORMACAO },
        // "Tipo de X": só existe (e só faz sentido) para o próprio nível X.
        { key: 'tipoDoutorado', label: 'Tipo de doutorado', type: 'select', options: ['Normal', 'Sanduíche', 'Cotutela', 'Cotutela-Sanduíche'],
          disabledWhen: { field: 'nivel', in: nivelExcept('Doutorado') } },
        { key: 'tipoMestrado', label: 'Tipo de mestrado', type: 'select', options: ['Normal', 'Sanduíche'],
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado') } },
        { key: 'tipoMestradoProfissional', label: 'Tipo de mestrado profissional', type: 'select', options: ['Normal', 'Sanduíche'],
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado profissional') } },
        { key: 'tipoGraduacao', label: 'Tipo de graduação', type: 'select', options: ['Normal', 'Sanduíche'],
          disabledWhen: { field: 'nivel', in: nivelExcept('Graduação') } },
        { key: 'instituicao', label: 'Instituição', type: 'text', required: true },
        { key: 'curso', label: 'Curso', type: 'text',
          disabledWhen: { field: 'nivel', in: ['Ensino fundamental', 'Ensino médio', 'Residência médica'] } },
        { key: 'cargaHoraria', label: 'Carga horária (h)', type: 'number', na: true,
          disabledWhen: { field: 'nivel', in: nivelExcept('Aperfeiçoamento', 'Especialização') } },
        { key: 'statusCurso', label: 'Status do curso', type: 'select', options: ['Em andamento', 'Concluído', 'Incompleto'] },
        { ...F_AINI, row: 'periodo' }, { key: 'anoFim', label: 'Conclusão (ano)', type: 'datebr', row: 'periodo',
          disabledWhen: { field: 'statusCurso', in: ['', 'Em andamento', 'Incompleto'] } },
        { key: 'anoObtencaoTitulo', label: 'Obtenção do título (mês/ano)', type: 'datebr',
          disabledWhen: [
              { field: 'nivel', in: nivelExcept('Mestrado', 'Mestrado profissional', 'Doutorado') },
              { field: 'statusCurso', in: ['', 'Em andamento', 'Incompleto'] },
          ] },
        { key: 'comBolsa', label: 'Com bolsa?', type: 'select', options: ['Sim', 'Não'],
          disabledWhen: { field: 'nivel', in: ['Ensino fundamental', 'Ensino médio'] } },
        { key: 'bolsa', label: 'Agência financiadora', type: 'text', disabledWhen: { field: 'comBolsa', in: ['', 'Não'] } },
        { key: 'titulo', label: 'Título da dissertação/tese', type: 'text', na: true,
          labelWhen: { field: 'nivel', map: { 'Graduação': 'Título monografia', 'Aperfeiçoamento': 'Título monografia', 'Especialização': 'Título monografia' } },
          disabledWhen: { field: 'nivel', in: ['Ensino fundamental', 'Ensino médio', 'Curso técnico', 'Residência médica'] } },
        { key: 'orientador', label: 'Nome completo do orientador', type: 'text', na: true,
          disabledWhen: { field: 'nivel', in: ['Ensino fundamental', 'Ensino médio', 'Curso técnico', 'Residência médica'] } },
        { key: 'coorientador', label: 'Nome completo do coorientador', type: 'text', na: true,
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado', 'Mestrado profissional', 'Doutorado') } },
        { key: 'residenciaEm', label: 'Residência médica em', type: 'text', disabledWhen: { field: 'nivel', in: nivelExcept('Residência médica') } },
        { key: 'numeroRegistro', label: 'Número do registro', type: 'text', disabledWhen: { field: 'nivel', in: nivelExcept('Residência médica') } },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).',
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado', 'Mestrado profissional', 'Doutorado', 'Residência médica') } },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.',
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado', 'Mestrado profissional', 'Doutorado', 'Residência médica') } },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).',
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado', 'Mestrado profissional', 'Doutorado', 'Residência médica') } },
    ] },
    POS_DOUTORADO: { label: 'Pós-doutorado e/ou livre-docência', fields: [
        { key: 'tipo', label: 'Nível', type: 'select', required: true, options: ['Pós-Doutorado', 'Livre-docência'] },
        { key: 'instituicao', label: 'Instituição', type: 'text', required: true },
        // Pós-Doutorado: Status do curso, Período (início/conclusão) e Bolsa.
        { key: 'statusCurso', label: 'Status do curso', type: 'select', options: ['Em andamento', 'Concluído', 'Incompleto'],
          disabledWhen: { field: 'tipo', equals: 'Livre-docência' } },
        { ...F_AINI, row: 'periodo', disabledWhen: { field: 'tipo', equals: 'Livre-docência' } },
        { key: 'anoFim', label: 'Ano de conclusão', type: 'datebr', row: 'periodo', disabledWhen: { field: 'tipo', equals: 'Livre-docência' } },
        { key: 'comBolsa', label: 'Com bolsa?', type: 'select', options: ['Sim', 'Não'],
          disabledWhen: { field: 'tipo', equals: 'Livre-docência' } },
        { key: 'bolsa', label: 'Agência financiadora', type: 'text', disabledWhen: { field: 'comBolsa', in: ['', 'Não'] } },
        // Livre-docência: Período (obtenção do título), Detalhamento (título),
        // Palavras-chave e Setores.
        { key: 'anoObtencaoTitulo', label: 'Obtenção do título', type: 'datebr', disabledWhen: { field: 'tipo', equals: 'Pós-Doutorado' } },
        { key: 'titulo', label: 'Título do trabalho', type: 'text', disabledWhen: { field: 'tipo', equals: 'Pós-Doutorado' } },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).',
          disabledWhen: { field: 'tipo', equals: 'Pós-Doutorado' } },
        // Áreas: comum aos dois níveis.
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).',
          disabledWhen: { field: 'tipo', equals: 'Pós-Doutorado' } },
    ] },
    // Nível de Formação complementar (espelha FORMACAO-COMPLEMENTAR do schema
    // Lattes: 4 elementos distintos — só "MBA" tem bolsa/orientador/monografia/
    // áreas/palavras-chave/setores; os outros 3 só têm os campos básicos.
    FORMACAO_COMPLEMENTAR: { label: 'Formação complementar', fields: [
        { key: 'nivel', label: 'Nível', type: 'select', required: true, default: 'Outros',
          options: ['Curso de curta duração', 'Extensão universitária', 'MBA', 'Outros'] },
        { key: 'titulo', label: 'Curso', type: 'text', required: true },
        F_INST,
        { key: 'cargaHoraria', label: 'Carga horária (h)', type: 'number', na: true },
        { key: 'statusCurso', label: 'Status do curso', type: 'select', options: ['Em andamento', 'Concluído', 'Incompleto'] },
        { key: 'anoInicio', label: 'Início (ano)', type: 'datebr', row: 'periodo' },
        { key: 'anoFim', label: 'Conclusão (ano)', type: 'datebr', row: 'periodo' },
        { key: 'anoObtencaoTitulo', label: 'Obtenção do título', type: 'datebr', disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'comBolsa', label: 'Com bolsa?', type: 'select', options: ['Sim', 'Não'], disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'bolsa', label: 'Agência financiadora', type: 'text', disabledWhen: [{ field: 'nivel', notEquals: 'MBA' }, { field: 'comBolsa', in: ['', 'Não'] }] },
        { key: 'tituloMonografia', label: 'Título da monografia', type: 'text', disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'orientador', label: 'Nome completo do orientador', type: 'text', disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).', disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.', disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).', disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
    ] },
};
