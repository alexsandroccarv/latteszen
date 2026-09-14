/* ==========================================================================
   lattesZen — Definições de tipo: 11 Bancas
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "11 Bancas"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.
   ========================================================================== */
import { F_ANO, F_INST, F_AFIM, F_PAIS, F_IDIOMA } from './lattes-types-campos.js';

export const TYPES_11_BANCAS = {
    // 11 Bancas
    BANCA_CONCLUSAO: { label: 'Participação em bancas de trabalhos de conclusão', fields: [
        { key: 'tipo', label: 'Natureza', type: 'select', required: true, options: ['Mestrado', 'Doutorado', 'Exame de qualificação de doutorado', 'Exame de qualificação de mestrado', 'Curso de aperfeiçoamento/especialização', 'Graduação'] },
        { key: 'modalidade', label: 'Tipo', type: 'select', options: ['Acadêmico', 'Profissionalizante'], help: 'Apenas para Mestrado.',
          disabledWhen: { field: 'tipo', in: ['Doutorado', 'Exame de qualificação de doutorado', 'Exame de qualificação de mestrado', 'Curso de aperfeiçoamento/especialização', 'Graduação'] } },
        { key: 'titulo', label: 'Título', type: 'text' }, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'candidato', label: 'Nome do candidato', type: 'text' }, F_INST, { key: 'curso', label: 'Curso', type: 'text' },
        { key: 'membros', label: 'Participantes da banca', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Um nome por posição — a ordem digitada é a ordem de autoria na banca.' },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    BANCA_JULGADORA: { label: 'Participação em bancas de comissões julgadoras', fields: [
        { key: 'tipo', label: 'Natureza', type: 'select', required: true, options: ['Concurso público', 'Professor titular', 'Livre-docência', 'Avaliação de cursos', 'Outra'] },
        { key: 'titulo', label: 'Título', type: 'text', help: 'Título do concurso, cargo ou processo avaliado.' }, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        F_INST,
        { key: 'membros', label: 'Participantes da banca', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Um nome por posição — a ordem digitada é a ordem de autoria na banca.' },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
};
