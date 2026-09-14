/* ==========================================================================
   lattesZen — Definições de tipo: 03 Atuação
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "03 Atuação"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.
   ========================================================================== */
import { F_INST, periodoComSituacao } from './lattes-types-campos.js';

export const TYPES_03_ATUACAO = {
    // 03 Atuação
    VINCULO_PROFISSIONAL: { label: 'Atuação profissional', fields: [
        { key: 'instituicao', label: 'Nome da instituição', type: 'text', required: true },
        { key: 'vinculo', label: 'Tipo do vínculo', type: 'select', options: ['Servidor público', 'Celetista', 'Professor visitante', 'Estudante', 'Bolsista', 'Outro'] },
        // Derivado do Tipo do vínculo (Servidor público/Celetista → Sim; os
        // demais → Não) — ver forceValueWhen/wireForcedValues em tab-catalogar.js.
        { key: 'vinculoEmpregaticio', label: 'Possui vínculo empregatício?', type: 'select', options: ['Sim', 'Não'],
            forceValueWhen: { field: 'vinculo', map: { 'Servidor público': 'Sim', 'Celetista': 'Sim', 'Professor visitante': 'Não', 'Estudante': 'Não', 'Bolsista': 'Não', 'Outro': 'Não' } } },
        { key: 'cargo', label: 'Enquadramento funcional', type: 'text' },
        { key: 'cargaHoraria', label: 'Carga horária semanal', type: 'number', na: true },
        { key: 'dedicacaoExclusiva', label: 'Dedicação exclusiva', type: 'checkbox' },
        ...periodoComSituacao(),
        { key: 'titulo', label: 'Outras informações', type: 'textarea' }] },
    LINHA_PESQUISA: { label: 'Linhas de pesquisa', fields: [{ key: 'titulo', label: 'Linha de pesquisa', type: 'text', required: true }, F_INST, { key: 'descricao', label: 'Objetivos', type: 'textarea' }] },
    // noExport: o schema oficial CurriculoLattes.xsd NÃO possui elemento para
    // corpo editorial, comitê de assessoramento nem revisor (periódico/fomento)
    // — só há ATIVIDADES-DE-CONSELHO-COMISSAO-E-CONSULTORIA (=ATIV_CONSELHO).
    // Ficam catalogáveis localmente e na página pública, mas fora do XML Lattes.
    CORPO_EDITORIAL: { label: 'Membro de corpo editorial', noExport: true, fields: [
        { key: 'titulo', label: 'Periódico', type: 'text', required: true },
        ...periodoComSituacao()] },
    COMITE_ASSESSORAMENTO: { label: 'Membro de comitê de assessoramento', noExport: true, fields: [
        { key: 'instituicao', label: 'Agência de fomento', type: 'text' },
        { key: 'titulo', label: 'Comitê', type: 'text', required: true },
        ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' }] },
    REVISOR_PERIODICO: { label: 'Revisor de periódico', noExport: true, fields: [
        { key: 'titulo', label: 'Periódico', type: 'text', required: true },
        ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' }] },
    REVISOR_FOMENTO: { label: 'Revisor de projeto de agência de fomento', noExport: true, fields: [
        { key: 'titulo', label: 'Agência de fomento', type: 'text', required: true },
        ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' }] },
    AREA_ATUACAO: { label: 'Áreas de atuação', noEvidence: true, perfil: true, fields: [{ key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', required: true, help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' }] },
    // Atividades da atuação profissional (subitens de "Atuação profissional",
    // na ordem e com os campos das telas reais do Lattes). O campo com "Digite
    // e pressione ENTER" (cargo, linha de pesquisa, treinamento…) é um texto
    // livre — separe múltiplos valores por ponto e vírgula (;).
    ATIV_DIRECAO: { label: 'Direção e administração', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Cargo ou função', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_PESQUISA: { label: 'Pesquisa e desenvolvimento', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Linhas de pesquisa', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_ENSINO: { label: 'Ensino', fields: [
        F_INST,
        { key: 'nivel', label: 'Nível', type: 'select', required: true, options: ['Graduação', 'Pós-graduação', 'Especialização', 'Aperfeiçoamento', 'Ensino fundamental', 'Ensino médio', 'Outros'] },
        { key: 'curso', label: 'Curso', type: 'text', required: true }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'disciplinas', label: 'Disciplinas ministradas', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_ESTAGIO: { label: 'Estágio', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Estágio realizado', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_SERVICO: { label: 'Serviço técnico especializado', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Serviço realizado', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_EXTENSAO: { label: 'Extensão universitária', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Atividade de extensão realizada', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_TREINAMENTO: { label: 'Treinamento', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Treinamento ministrado', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_OUTRA: { label: 'Outra atividade técnico-científica', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Outra atividade técnico-científica', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_CONSELHO: { label: 'Conselhos, comissões e consultoria', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Cargo ou função', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },
};
