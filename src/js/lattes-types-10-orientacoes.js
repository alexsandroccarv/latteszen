/* ==========================================================================
   lattesZen — Definições de tipo: 10 Orientações
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "10 Orientações"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.
   ========================================================================== */
import { F_ANO, F_INST, F_AFIM, F_PAIS, F_IDIOMA } from './lattes-types-campos.js';

export const TYPES_10_ORIENTACOES = {
    // 10 Orientações
    ORIENTACAO_CONCLUIDA: { label: 'Orientações e supervisões concluídas', fields: [
        { key: 'tipo', label: 'Natureza', type: 'select', required: true, options: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Mestrado', 'Doutorado', 'Pós-Doutorado', 'Outra'] },
        { key: 'modalidade', label: 'Tipo', type: 'select', options: ['Acadêmico', 'Profissionalizante'], help: 'Apenas para Mestrado.',
          disabledWhen: { field: 'tipo', in: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Doutorado', 'Pós-Doutorado', 'Outra'] } },
        { key: 'titulo', label: 'Título do trabalho', type: 'text' }, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'orientando', label: 'Nome do orientado(a)', type: 'text', required: true },
        { key: 'natureza', label: 'Tipo de orientação', type: 'select', options: ['Orientador principal', 'Coorientador'] },
        { key: 'curso', label: 'Curso', type: 'text' }, F_INST,
        { key: 'comBolsa', label: 'Com bolsa?', type: 'checkbox' },
        { key: 'bolsa', label: 'Agência financiadora', type: 'text' },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    // "10 mais relevantes?" consta na tela real (doc 10.2, mesma estrutura de
    // 10.1), mas nenhum dos elementos DADOS-BASICOS-DA-ORIENTACAO-EM-
    // ANDAMENTO-DE-* tem o atributo FLAG-RELEVANCIA no XSD/DTD (só as
    // "concluídas" têm) — mantido na UI como referência do usuário, mas sem
    // exportação no XML para este tipo.
    ORIENTACAO_ANDAMENTO: { label: 'Orientações e supervisões em andamento', fields: [
        { key: 'tipo', label: 'Natureza', type: 'select', required: true, options: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Mestrado', 'Doutorado', 'Pós-Doutorado', 'Outra'] },
        { key: 'modalidade', label: 'Tipo', type: 'select', options: ['Acadêmico', 'Profissionalizante'], help: 'Apenas para Mestrado.',
          disabledWhen: { field: 'tipo', in: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Doutorado', 'Pós-Doutorado', 'Outra'] } },
        { key: 'titulo', label: 'Título do trabalho', type: 'text' }, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'orientando', label: 'Nome do orientando(a)', type: 'text', required: true },
        { key: 'natureza', label: 'Tipo de orientação', type: 'select', options: ['Orientador principal', 'Coorientador'] },
        { key: 'curso', label: 'Curso', type: 'text' }, F_INST,
        { key: 'comBolsa', label: 'Com bolsa?', type: 'checkbox' },
        { key: 'bolsa', label: 'Agência financiadora', type: 'text' },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
};
