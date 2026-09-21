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

   i18n (preparação): label/placeholder passam por t() (placeholders que são
   só máscara de formato, como 'https://...', ficam de fora); os arrays de
   `options` viram `{ value, label }` via opcoes() — ver nota de
   arquitetura no topo de lattes-types-campos.js.
   ========================================================================== */
import { F_AINI, F_AFIM, alNome, alCertificacaoFields, alFiliacaoFields, alImprensaFields, alConcursoFields, opcoes } from './lattes-types-campos.js';
import { t } from './i18n.js';

export const TYPES_20_REGISTROS = {
    // 20 — Registros e Reconhecimentos
    // Mantido apenas para compatibilidade com itens já catalogados (chave
    // legada); novos itens usam os 3 tipos específicos abaixo.
    AL_IMPRENSA: { label: t('lattes.tipo.AL_IMPRENSA.label', 'Imprensa'), fields: [
        alNome(t('lattes.tipo.AL_IMPRENSA.campo.titulo_materia', 'Título da matéria')),
        { key: 'entidade', label: t('lattes.tipo.AL_IMPRENSA.campo.entidade.label', 'Nome do veículo'), type: 'text', required: true },
        { key: 'ano', label: t('lattes.tipo.AL_IMPRENSA.campo.ano.label', 'Data de veiculação'), type: 'datebr', required: true }] },
    // Rótulos alinhados ao "Tipo de item" pedido pelo usuário — cada um já
    // restringe sozinho as opções de "Tipo de participação" relevantes.
    AL_IMPRENSA_CITACAO: { label: t('lattes.tipo.AL_IMPRENSA_CITACAO.label', 'Presença indireta/menção'), fields: alImprensaFields(
        opcoes('al_imprensa_citacao_tipo_participacao', ['Citado nominalmente', 'Citado via documento/estudo', 'Fotografado/Imagem', 'Objeto da pauta', 'Alvo de crítica/Contraditório'])) },
    AL_IMPRENSA_ENTREVISTADO: { label: t('lattes.tipo.AL_IMPRENSA_ENTREVISTADO.label', 'Participação direta'), fields: alImprensaFields(
        opcoes('al_imprensa_entrevistado_tipo_participacao', ['Entrevistado principal', 'Comentarista/Especialista', 'Articulista', 'Debatedor/Painelista', 'Porta-voz em coletiva'])) },
    AL_IMPRENSA_OUTRA: { label: t('lattes.tipo.AL_IMPRENSA_OUTRA.label', 'Bastidores e assessoria de RP'), fields: alImprensaFields(
        opcoes('al_imprensa_outra_tipo_participacao', ['Fonte em off/Background', 'Nota oficial', 'Sugestão de pauta/Pitching', 'Demanda não atendida'])) },
    // Mantido apenas para compatibilidade com itens já catalogados (chave
    // legada); novos itens usam os 7 tipos específicos abaixo — um por
    // "Tipo de item" pedido pelo usuário (sem campo de classificação
    // duplicado dentro do formulário).
    AL_CONCURSO: { label: t('lattes.tipo.AL_CONCURSO.label', 'Concursos e processos seletivos'), fields: alConcursoFields() },
    AL_CONCURSO_PUBLICO: { label: t('lattes.tipo.AL_CONCURSO_PUBLICO.label', 'Concurso Público'), fields: alConcursoFields() },
    AL_CONCURSO_PSS: { label: t('lattes.tipo.AL_CONCURSO_PSS.label', 'Processo Seletivo Simplificado (PSS)'), fields: alConcursoFields() },
    AL_CONCURSO_ACADEMICO: { label: t('lattes.tipo.AL_CONCURSO_ACADEMICO.label', 'Processo Seletivo Acadêmico'), fields: alConcursoFields() },
    AL_CONCURSO_CULTURAL: { label: t('lattes.tipo.AL_CONCURSO_CULTURAL.label', 'Concurso cultural, artístico ou literário'), fields: alConcursoFields() },
    AL_CONCURSO_CHAMADA_PUBLICA: { label: t('lattes.tipo.AL_CONCURSO_CHAMADA_PUBLICA.label', 'Chamada Pública e Edital de Projetos'), fields: alConcursoFields() },
    AL_CONCURSO_HACKATHON: { label: t('lattes.tipo.AL_CONCURSO_HACKATHON.label', 'Prêmios, Concurso de Ideias e Hackathon'), fields: alConcursoFields() },
    AL_CONCURSO_INTERNA: { label: t('lattes.tipo.AL_CONCURSO_INTERNA.label', 'Seleção Interna'), fields: alConcursoFields() },
    // Mantido apenas para compatibilidade com itens já catalogados (chave
    // legada); novos itens usam os 5 tipos específicos abaixo.
    AL_FILIACAO: { label: t('lattes.tipo.AL_FILIACAO.label', 'Filiações'), fields: [
        alNome(t('lattes.tipo.AL_FILIACAO.campo.entidade', 'Entidade')),
        { key: 'categoria', label: t('lattes.tipo.AL_FILIACAO.campo.categoria.label', 'Categoria'), type: 'text' },
        { key: 'numeroSocio', label: t('lattes.tipo.AL_FILIACAO.campo.numero_socio.label', 'Número de sócio'), type: 'text' },
        { ...F_AINI, row: 'periodo' }, F_AFIM] },
    AL_FILIACAO_CONSELHO: { label: t('lattes.tipo.AL_FILIACAO_CONSELHO.label', 'Conselhos de Classe'), fields: alFiliacaoFields() },
    AL_FILIACAO_CIENTIFICA: { label: t('lattes.tipo.AL_FILIACAO_CIENTIFICA.label', 'Entidades Científicas e de Pesquisa'), fields: alFiliacaoFields() },
    AL_FILIACAO_ASSOC_PROF: { label: t('lattes.tipo.AL_FILIACAO_ASSOC_PROF.label', 'Associações Profissionais Internacionais ou Nacionais'), fields: alFiliacaoFields() },
    AL_FILIACAO_SINDICATO: { label: t('lattes.tipo.AL_FILIACAO_SINDICATO.label', 'Sindicatos e Associações de Categoria'), fields: alFiliacaoFields() },
    AL_FILIACAO_OUTRA: { label: t('lattes.tipo.AL_FILIACAO_OUTRA.label', 'Outras'), fields: alFiliacaoFields() },
    // Mantido apenas para compatibilidade com itens já catalogados (chave
    // legada); novos itens usam os 4 tipos específicos abaixo.
    AL_CERTIFICACAO: { label: t('lattes.tipo.AL_CERTIFICACAO.label', 'Certificações'), fields: [
        alNome(t('lattes.tipo.AL_CERTIFICACAO.campo.nome', 'Nome da certificação')),
        { key: 'entidade', label: t('lattes.tipo.AL_CERTIFICACAO.campo.entidade.label', 'Instituto certificador'), type: 'text' },
        { key: 'anoInicio', label: t('lattes.tipo.AL_CERTIFICACAO.campo.ano_inicio.label', 'Data da certificação'), type: 'datebr', row: 'periodo' },
        { key: 'anoFim', label: t('lattes.tipo.AL_CERTIFICACAO.campo.ano_fim.label', 'Validade até'), type: 'datebr', row: 'periodo' }] },
    AL_CERT_PROF_GESTAO: { label: t('lattes.tipo.AL_CERT_PROF_GESTAO.label', 'Certificações Profissionais e de Gestão'), fields: alCertificacaoFields() },
    AL_CERT_TI: { label: t('lattes.tipo.AL_CERT_TI.label', 'Certificações de TI'), fields: alCertificacaoFields() },
    AL_CERT_FINANCEIRA: { label: t('lattes.tipo.AL_CERT_FINANCEIRA.label', 'Certificações Financeiras'), fields: alCertificacaoFields() },
    AL_CERT_OUTRA: { label: t('lattes.tipo.AL_CERT_OUTRA.label', 'Outras certificações'), fields: alCertificacaoFields() },

    // Conexões (dentro de Dados gerais; somente link; sem comprovação; não-Lattes)
    CONEXAO_SOCIAL: { label: t('lattes.tipo.CONEXAO_SOCIAL.label', 'Redes sociais'), noExport: true, noEvidence: true, naoLattes: true, fields: [
        { key: 'titulo', label: t('lattes.tipo.CONEXAO_SOCIAL.campo.titulo.label', 'Rede / Plataforma'), type: 'text', required: true, placeholder: t('lattes.tipo.CONEXAO_SOCIAL.campo.titulo.placeholder', 'ex.: Instagram, Facebook, X, YouTube, TikTok') },
        { key: 'url', label: t('lattes.tipo.CONEXAO_SOCIAL.campo.url.label', 'Link (URL)'), type: 'url', required: true, placeholder: 'https://...' },
        { key: 'usuario', label: t('lattes.tipo.CONEXAO_SOCIAL.campo.usuario.label', 'Usuário / @'), type: 'text' }] },
    // Sem "Identificador / ID": o identificador do usuário na plataforma já
    // faz parte do próprio Link (URL) — campo à parte seria redundante.
    CONEXAO_ACADEMICA: { label: t('lattes.tipo.CONEXAO_ACADEMICA.label', 'Redes acadêmicas'), noExport: true, noEvidence: true, naoLattes: true, fields: [
        { key: 'titulo', label: t('lattes.tipo.CONEXAO_ACADEMICA.campo.titulo.label', 'Plataforma'), type: 'select', required: true, options: opcoes('conexao_academica_titulo', ['Currículo Lattes', 'Web of Science', 'Google Scholar (MyCitation)', 'Zotero', 'Outra']) },
        // Não marcado required: um campo obrigatório com disabledWhen fica
        // sempre "faltando" quando desabilitado (collectFields zera o valor
        // de campos desabilitados antes da validação) — deixando "Outra"
        // sem nome preenchido cai no rótulo genérico "Outra" (ver itemTitle).
        { key: 'outraNome', label: t('lattes.tipo.CONEXAO_ACADEMICA.campo.outra_nome.label', 'Nome da rede'), type: 'text', placeholder: t('lattes.tipo.CONEXAO_ACADEMICA.campo.outra_nome.placeholder', 'ex.: ResearchGate, Academia.edu, ORCID'), disabledWhen: { field: 'titulo', notEquals: 'Outra' } },
        { key: 'url', label: t('lattes.tipo.CONEXAO_ACADEMICA.campo.url.label', 'Link (URL)'), type: 'url', required: true, placeholder: 'https://...' }] },
    CONEXAO_PROFISSIONAL: { label: t('lattes.tipo.CONEXAO_PROFISSIONAL.label', 'Redes profissionais'), noExport: true, noEvidence: true, naoLattes: true, fields: [
        { key: 'titulo', label: t('lattes.tipo.CONEXAO_PROFISSIONAL.campo.titulo.label', 'Plataforma / Tipo'), type: 'text', required: true, placeholder: t('lattes.tipo.CONEXAO_PROFISSIONAL.campo.titulo.placeholder', 'ex.: LinkedIn, E-mail profissional, Site pessoal') },
        { key: 'url', label: t('lattes.tipo.CONEXAO_PROFISSIONAL.campo.url.label', 'Link / URL (ou e-mail)'), type: 'url', required: true, placeholder: t('lattes.tipo.CONEXAO_PROFISSIONAL.campo.url.placeholder', 'https://...  ou  nome@dominio') },
        { key: 'usuario', label: t('lattes.tipo.CONEXAO_PROFISSIONAL.campo.usuario.label', 'Usuário / contato'), type: 'text' }] },

    /* --- Grupos de Pesquisa (não-Lattes; só com o módulo RSC) --- */
    RSC_GRUPO_PESQUISA: { label: t('lattes.tipo.RSC_GRUPO_PESQUISA.label', 'Grupo de pesquisa/extensão registrado'), noExport: true, rsc: true, fields: [
        { key: 'titulo', label: t('lattes.tipo.RSC_GRUPO_PESQUISA.campo.titulo.label', 'Grupo de pesquisa'), type: 'text', required: true },
        { key: 'instituicao', label: t('lattes.tipo.RSC_GRUPO_PESQUISA.campo.instituicao.label', 'Instituição'), type: 'text', placeholder: t('lattes.tipo.RSC_GRUPO_PESQUISA.campo.instituicao.placeholder', 'ex.: UNIFESP') },
        { key: 'lideres', label: t('lattes.tipo.RSC_GRUPO_PESQUISA.campo.lideres.label', 'Líder(es)'), type: 'textarea', placeholder: t('lattes.tipo.RSC_GRUPO_PESQUISA.campo.lideres.placeholder', 'Separe por ponto e vírgula (;) se houver mais de um') },
        { key: 'viceLider', label: t('lattes.tipo.RSC_GRUPO_PESQUISA.campo.vice_lider.label', 'Vice-líder'), type: 'text' },
        { key: 'area', label: t('lattes.tipo.RSC_GRUPO_PESQUISA.campo.area.label', 'Área'), type: 'text', placeholder: t('lattes.tipo.RSC_GRUPO_PESQUISA.campo.area.placeholder', 'ex.: Educação') },
        { key: 'papel', label: t('lattes.tipo.RSC_GRUPO_PESQUISA.campo.papel.label', 'Função'), type: 'select', options: opcoes('rsc_grupo_pesquisa_papel', ['Líder', 'Vice-líder', 'Pesquisador', 'Estudante', 'Técnico', 'Colaborador estrangeiro']), required: true },
        { key: 'anoInicio', label: t('lattes.tipo.RSC_GRUPO_PESQUISA.campo.ano_inicio.label', 'Data de inclusão'), type: 'datebr' },
        { key: 'egresso', label: t('lattes.tipo.RSC_GRUPO_PESQUISA.campo.egresso.label', 'Egresso'), type: 'checkbox' },
        { key: 'anoFim', label: t('lattes.tipo.RSC_GRUPO_PESQUISA.campo.ano_fim.label', 'Data de desligamento'), type: 'datebr', disabledWhen: { field: 'egresso', in: ['Não'] } },
    ] },

    /* --- Atuação em Crise de Saúde Pública (não-Lattes; só com o módulo RSC) --- */
    RSC_CRISE_SAUDE_ATUACAO: { label: t('lattes.tipo.RSC_CRISE_SAUDE_ATUACAO.label', 'Atuação em crise de saúde pública'), noExport: true, rsc: true, fields: [
        { key: 'tipoSituacao', label: t('lattes.tipo.RSC_CRISE_SAUDE_ATUACAO.campo.tipo_situacao.label', 'Tipo de situação'), type: 'select', options: opcoes('rsc_crise_saude_atuacao_tipo_situacao', ['Surto', 'Epidemia', 'Pandemia']), required: true },
        { key: 'ato', label: t('lattes.tipo.RSC_CRISE_SAUDE_ATUACAO.campo.ato.label', 'Ato que decretou a situação'), type: 'text' },
        { key: 'anoInicio', label: t('lattes.tipo.RSC_CRISE_SAUDE_ATUACAO.campo.ano_inicio.label', 'Data de início'), type: 'datebr', row: 'periodo' },
        { key: 'anoFim', label: t('lattes.tipo.RSC_CRISE_SAUDE_ATUACAO.campo.ano_fim.label', 'Data de fim'), type: 'datebr', row: 'periodo' },
        { key: 'descricao', label: t('lattes.tipo.RSC_CRISE_SAUDE_ATUACAO.campo.descricao.label', 'Descrição da atuação'), type: 'textarea' },
    ] },
};
