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
   lattesZen — Definições de tipo: 20 Registros e Reconhecimentos (+ Conexões e Grupos de Pesquisa/RSC)
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "20 Registros e Reconhecimentos (+ Conexões e Grupos de Pesquisa/RSC)"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.
   ========================================================================== */
import { F_AINI, F_AFIM, alNome, alCertificacaoFields, alFiliacaoFields, alImprensaFields, alConcursoFields } from './lattes-types-campos.js';

export const TYPES_20_REGISTROS = {
    // 20 — Registros e Reconhecimentos
    // Mantido apenas para compatibilidade com itens já catalogados (chave
    // legada); novos itens usam os 3 tipos específicos abaixo.
    AL_IMPRENSA: { label: 'Imprensa', fields: [
        alNome('Título da matéria'),
        { key: 'entidade', label: 'Nome do veículo', type: 'text', required: true },
        { key: 'ano', label: 'Data de veiculação', type: 'datebr', required: true }] },
    // Rótulos alinhados ao "Tipo de item" pedido pelo usuário — cada um já
    // restringe sozinho as opções de "Tipo de participação" relevantes.
    AL_IMPRENSA_CITACAO: { label: 'Presença indireta/menção', fields: alImprensaFields(
        ['Citado nominalmente', 'Citado via documento/estudo', 'Fotografado/Imagem', 'Objeto da pauta', 'Alvo de crítica/Contraditório']) },
    AL_IMPRENSA_ENTREVISTADO: { label: 'Participação direta', fields: alImprensaFields(
        ['Entrevistado principal', 'Comentarista/Especialista', 'Articulista', 'Debatedor/Painelista', 'Porta-voz em coletiva']) },
    AL_IMPRENSA_OUTRA: { label: 'Bastidores e assessoria de RP', fields: alImprensaFields(
        ['Fonte em off/Background', 'Nota oficial', 'Sugestão de pauta/Pitching', 'Demanda não atendida']) },
    // Mantido apenas para compatibilidade com itens já catalogados (chave
    // legada); novos itens usam os 7 tipos específicos abaixo — um por
    // "Tipo de item" pedido pelo usuário (sem campo de classificação
    // duplicado dentro do formulário).
    AL_CONCURSO: { label: 'Concursos e processos seletivos', fields: alConcursoFields() },
    AL_CONCURSO_PUBLICO: { label: 'Concurso Público', fields: alConcursoFields() },
    AL_CONCURSO_PSS: { label: 'Processo Seletivo Simplificado (PSS)', fields: alConcursoFields() },
    AL_CONCURSO_ACADEMICO: { label: 'Processo Seletivo Acadêmico', fields: alConcursoFields() },
    AL_CONCURSO_CULTURAL: { label: 'Concurso cultural, artístico ou literário', fields: alConcursoFields() },
    AL_CONCURSO_CHAMADA_PUBLICA: { label: 'Chamada Pública e Edital de Projetos', fields: alConcursoFields() },
    AL_CONCURSO_HACKATHON: { label: 'Prêmios, Concurso de Ideias e Hackathon', fields: alConcursoFields() },
    AL_CONCURSO_INTERNA: { label: 'Seleção Interna', fields: alConcursoFields() },
    // Mantido apenas para compatibilidade com itens já catalogados (chave
    // legada); novos itens usam os 5 tipos específicos abaixo.
    AL_FILIACAO: { label: 'Filiações', fields: [
        alNome('Entidade'),
        { key: 'categoria', label: 'Categoria', type: 'text' },
        { key: 'numeroSocio', label: 'Número de sócio', type: 'text' },
        { ...F_AINI, row: 'periodo' }, F_AFIM] },
    AL_FILIACAO_CONSELHO: { label: 'Conselhos de Classe', fields: alFiliacaoFields() },
    AL_FILIACAO_CIENTIFICA: { label: 'Entidades Científicas e de Pesquisa', fields: alFiliacaoFields() },
    AL_FILIACAO_ASSOC_PROF: { label: 'Associações Profissionais Internacionais ou Nacionais', fields: alFiliacaoFields() },
    AL_FILIACAO_SINDICATO: { label: 'Sindicatos e Associações de Categoria', fields: alFiliacaoFields() },
    AL_FILIACAO_OUTRA: { label: 'Outras', fields: alFiliacaoFields() },
    // Mantido apenas para compatibilidade com itens já catalogados (chave
    // legada); novos itens usam os 4 tipos específicos abaixo.
    AL_CERTIFICACAO: { label: 'Certificações', fields: [
        alNome('Nome da certificação'),
        { key: 'entidade', label: 'Instituto certificador', type: 'text' },
        { key: 'anoInicio', label: 'Data da certificação', type: 'datebr', row: 'periodo' },
        { key: 'anoFim', label: 'Validade até', type: 'datebr', row: 'periodo' }] },
    AL_CERT_PROF_GESTAO: { label: 'Certificações Profissionais e de Gestão', fields: alCertificacaoFields() },
    AL_CERT_TI: { label: 'Certificações de TI', fields: alCertificacaoFields() },
    AL_CERT_FINANCEIRA: { label: 'Certificações Financeiras', fields: alCertificacaoFields() },
    AL_CERT_OUTRA: { label: 'Outras certificações', fields: alCertificacaoFields() },

    // Conexões (dentro de Dados gerais; somente link; sem comprovação; não-Lattes)
    CONEXAO_SOCIAL: { label: 'Redes sociais', noExport: true, noEvidence: true, naoLattes: true, fields: [
        { key: 'titulo', label: 'Rede / Plataforma', type: 'text', required: true, placeholder: 'ex.: Instagram, Facebook, X, YouTube, TikTok' },
        { key: 'url', label: 'Link (URL)', type: 'url', required: true, placeholder: 'https://...' },
        { key: 'usuario', label: 'Usuário / @', type: 'text' }] },
    // Sem "Identificador / ID": o identificador do usuário na plataforma já
    // faz parte do próprio Link (URL) — campo à parte seria redundante.
    CONEXAO_ACADEMICA: { label: 'Redes acadêmicas', noExport: true, noEvidence: true, naoLattes: true, fields: [
        { key: 'titulo', label: 'Plataforma', type: 'select', required: true, options: ['Currículo Lattes', 'Web of Science', 'Google Scholar (MyCitation)', 'Zotero', 'Outra'] },
        // Não marcado required: um campo obrigatório com disabledWhen fica
        // sempre "faltando" quando desabilitado (collectFields zera o valor
        // de campos desabilitados antes da validação) — deixando "Outra"
        // sem nome preenchido cai no rótulo genérico "Outra" (ver itemTitle).
        { key: 'outraNome', label: 'Nome da rede', type: 'text', placeholder: 'ex.: ResearchGate, Academia.edu, ORCID', disabledWhen: { field: 'titulo', notEquals: 'Outra' } },
        { key: 'url', label: 'Link (URL)', type: 'url', required: true, placeholder: 'https://...' }] },
    CONEXAO_PROFISSIONAL: { label: 'Redes profissionais', noExport: true, noEvidence: true, naoLattes: true, fields: [
        { key: 'titulo', label: 'Plataforma / Tipo', type: 'text', required: true, placeholder: 'ex.: LinkedIn, E-mail profissional, Site pessoal' },
        { key: 'url', label: 'Link / URL (ou e-mail)', type: 'url', required: true, placeholder: 'https://...  ou  nome@dominio' },
        { key: 'usuario', label: 'Usuário / contato', type: 'text' }] },

    /* --- Grupos de Pesquisa (não-Lattes; só com o módulo RSC) --- */
    RSC_GRUPO_PESQUISA: { label: 'Grupo de pesquisa/extensão registrado', noExport: true, rsc: true, fields: [
        { key: 'titulo', label: 'Grupo de pesquisa', type: 'text', required: true },
        { key: 'instituicao', label: 'Instituição', type: 'text', placeholder: 'ex.: UNIFESP' },
        { key: 'lideres', label: 'Líder(es)', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;) se houver mais de um' },
        { key: 'viceLider', label: 'Vice-líder', type: 'text' },
        { key: 'area', label: 'Área', type: 'text', placeholder: 'ex.: Educação' },
        { key: 'papel', label: 'Função', type: 'select', options: ['Líder', 'Vice-líder', 'Pesquisador', 'Estudante', 'Técnico', 'Colaborador estrangeiro'], required: true },
        { key: 'anoInicio', label: 'Data de inclusão', type: 'datebr' },
        { key: 'egresso', label: 'Egresso', type: 'checkbox' },
        { key: 'anoFim', label: 'Data de desligamento', type: 'datebr', disabledWhen: { field: 'egresso', in: ['Não'] } },
    ] },

    /* --- Atuação em Crise de Saúde Pública (não-Lattes; só com o módulo RSC) --- */
    RSC_CRISE_SAUDE_ATUACAO: { label: 'Atuação em crise de saúde pública', noExport: true, rsc: true, fields: [
        { key: 'tipoSituacao', label: 'Tipo de situação', type: 'select', options: ['Surto', 'Epidemia', 'Pandemia'], required: true },
        { key: 'ato', label: 'Ato que decretou a situação', type: 'text' },
        { key: 'anoInicio', label: 'Data de início', type: 'datebr', row: 'periodo' },
        { key: 'anoFim', label: 'Data de fim', type: 'datebr', row: 'periodo' },
        { key: 'descricao', label: 'Descrição da atuação', type: 'textarea' },
    ] },
};
