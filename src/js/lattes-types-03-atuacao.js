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
   lattesZen — Definições de tipo: 03 Atuação
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "03 Atuação"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.

   i18n (preparação): label/placeholder/help passam por t(); os arrays de
   `options` viram `{ value, label }` via opcoes() — as CHAVES/VALORES de
   `forceValueWhen.map` continuam literais, batendo com `value` — ver nota
   de arquitetura no topo de lattes-types-campos.js.
   ========================================================================== */
import { F_INST, periodoComSituacao, opcoes } from './lattes-types-campos.js';
import { t } from './i18n.js';

export const TYPES_03_ATUACAO = {
    // 03 Atuação
    VINCULO_PROFISSIONAL: { label: t('lattes.tipo.VINCULO_PROFISSIONAL.label', 'Atuação profissional'), fields: [
        { key: 'instituicao', label: t('lattes.tipo.VINCULO_PROFISSIONAL.campo.instituicao.label', 'Nome da instituição'), type: 'text', required: true },
        { key: 'vinculo', label: t('lattes.tipo.VINCULO_PROFISSIONAL.campo.vinculo.label', 'Tipo do vínculo'), type: 'select', options: opcoes('vinculo_profissional_vinculo', ['Servidor público', 'Celetista', 'Professor visitante', 'Estudante', 'Bolsista', 'Outro']) },
        // Derivado do Tipo do vínculo (Servidor público/Celetista → Sim; os
        // demais → Não) — ver forceValueWhen/wireForcedValues em tab-catalogar.js.
        { key: 'vinculoEmpregaticio', label: t('lattes.tipo.VINCULO_PROFISSIONAL.campo.vinculo_empregaticio.label', 'Possui vínculo empregatício?'), type: 'select', options: opcoes('vinculo_empregaticio', ['Sim', 'Não']),
            forceValueWhen: { field: 'vinculo', map: { 'Servidor público': 'Sim', 'Celetista': 'Sim', 'Professor visitante': 'Não', 'Estudante': 'Não', 'Bolsista': 'Não', 'Outro': 'Não' } } },
        { key: 'cargo', label: t('lattes.tipo.VINCULO_PROFISSIONAL.campo.cargo.label', 'Enquadramento funcional'), type: 'text' },
        { key: 'cargaHoraria', label: t('lattes.tipo.VINCULO_PROFISSIONAL.campo.carga_horaria.label', 'Carga horária semanal'), type: 'number', na: true },
        { key: 'dedicacaoExclusiva', label: t('lattes.tipo.VINCULO_PROFISSIONAL.campo.dedicacao_exclusiva.label', 'Dedicação exclusiva'), type: 'checkbox' },
        ...periodoComSituacao(),
        { key: 'titulo', label: t('lattes.tipo.VINCULO_PROFISSIONAL.campo.titulo.label', 'Outras informações'), type: 'textarea' }] },
    LINHA_PESQUISA: { label: t('lattes.tipo.LINHA_PESQUISA.label', 'Linhas de pesquisa'), fields: [{ key: 'titulo', label: t('lattes.tipo.LINHA_PESQUISA.campo.titulo.label', 'Linha de pesquisa'), type: 'text', required: true }, F_INST, { key: 'descricao', label: t('lattes.tipo.LINHA_PESQUISA.campo.descricao.label', 'Objetivos'), type: 'textarea' }] },
    // noExport: o schema oficial CurriculoLattes.xsd NÃO possui elemento para
    // corpo editorial, comitê de assessoramento nem revisor (periódico/fomento)
    // — só há ATIVIDADES-DE-CONSELHO-COMISSAO-E-CONSULTORIA (=ATIV_CONSELHO).
    // Ficam catalogáveis localmente e na página pública, mas fora do XML Lattes.
    CORPO_EDITORIAL: { label: t('lattes.tipo.CORPO_EDITORIAL.label', 'Membro de corpo editorial'), noExport: true, fields: [
        { key: 'titulo', label: t('lattes.tipo.CORPO_EDITORIAL.campo.titulo.label', 'Periódico'), type: 'text', required: true },
        ...periodoComSituacao()] },
    COMITE_ASSESSORAMENTO: { label: t('lattes.tipo.COMITE_ASSESSORAMENTO.label', 'Membro de comitê de assessoramento'), noExport: true, fields: [
        { key: 'instituicao', label: t('lattes.tipo.COMITE_ASSESSORAMENTO.campo.instituicao.label', 'Agência de fomento'), type: 'text' },
        { key: 'titulo', label: t('lattes.tipo.COMITE_ASSESSORAMENTO.campo.titulo.label', 'Comitê'), type: 'text', required: true },
        ...periodoComSituacao(),
        { key: 'outrasInfo', label: t('lattes.tipo.COMITE_ASSESSORAMENTO.campo.outras_info.label', 'Outras informações'), type: 'textarea' }] },
    REVISOR_PERIODICO: { label: t('lattes.tipo.REVISOR_PERIODICO.label', 'Revisor de periódico'), noExport: true, fields: [
        { key: 'titulo', label: t('lattes.tipo.REVISOR_PERIODICO.campo.titulo.label', 'Periódico'), type: 'text', required: true },
        ...periodoComSituacao(),
        { key: 'outrasInfo', label: t('lattes.tipo.REVISOR_PERIODICO.campo.outras_info.label', 'Outras informações'), type: 'textarea' }] },
    REVISOR_FOMENTO: { label: t('lattes.tipo.REVISOR_FOMENTO.label', 'Revisor de projeto de agência de fomento'), noExport: true, fields: [
        { key: 'titulo', label: t('lattes.tipo.REVISOR_FOMENTO.campo.titulo.label', 'Agência de fomento'), type: 'text', required: true },
        ...periodoComSituacao(),
        { key: 'outrasInfo', label: t('lattes.tipo.REVISOR_FOMENTO.campo.outras_info.label', 'Outras informações'), type: 'textarea' }] },
    AREA_ATUACAO: { label: t('lattes.tipo.AREA_ATUACAO.label', 'Áreas de atuação'), noEvidence: true, perfil: true, fields: [{ key: 'areaConhecimento', label: t('lattes.tipo.AREA_ATUACAO.campo.area_conhecimento.label', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', required: true, help: t('lattes.tipo.AREA_ATUACAO.campo.area_conhecimento.help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.') }] },
    // Atividades da atuação profissional (subitens de "Atuação profissional",
    // na ordem e com os campos das telas reais do Lattes). O campo com "Digite
    // e pressione ENTER" (cargo, linha de pesquisa, treinamento…) é um texto
    // livre — separe múltiplos valores por ponto e vírgula (;).
    ATIV_DIRECAO: { label: t('lattes.tipo.ATIV_DIRECAO.label', 'Direção e administração'), fields: [
        F_INST, { key: 'orgao', label: t('lattes.tipo.ATIV_DIRECAO.campo.orgao.label', 'Órgão/Unidade'), type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: t('lattes.tipo.ATIV_DIRECAO.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
        { key: 'titulo', label: t('lattes.tipo.ATIV_DIRECAO.campo.titulo.label', 'Cargo ou função'), type: 'text', required: true, placeholder: t('lattes.tipo.ATIV_DIRECAO.campo.titulo.placeholder', 'Separe por ponto e vírgula (;)') }] },
    ATIV_PESQUISA: { label: t('lattes.tipo.ATIV_PESQUISA.label', 'Pesquisa e desenvolvimento'), fields: [
        F_INST, { key: 'orgao', label: t('lattes.tipo.ATIV_PESQUISA.campo.orgao.label', 'Órgão/Unidade'), type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: t('lattes.tipo.ATIV_PESQUISA.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
        { key: 'titulo', label: t('lattes.tipo.ATIV_PESQUISA.campo.titulo.label', 'Linhas de pesquisa'), type: 'text', required: true, placeholder: t('lattes.tipo.ATIV_PESQUISA.campo.titulo.placeholder', 'Separe por ponto e vírgula (;)') }] },
    ATIV_ENSINO: { label: t('lattes.tipo.ATIV_ENSINO.label', 'Ensino'), fields: [
        F_INST,
        { key: 'nivel', label: t('lattes.tipo.ATIV_ENSINO.campo.nivel.label', 'Nível'), type: 'select', required: true, options: opcoes('ativ_ensino_nivel', ['Graduação', 'Pós-graduação', 'Especialização', 'Aperfeiçoamento', 'Ensino fundamental', 'Ensino médio', 'Outros']) },
        { key: 'curso', label: t('lattes.tipo.ATIV_ENSINO.campo.curso.label', 'Curso'), type: 'text', required: true }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: t('lattes.tipo.ATIV_ENSINO.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
        { key: 'disciplinas', label: t('lattes.tipo.ATIV_ENSINO.campo.disciplinas.label', 'Disciplinas ministradas'), type: 'textarea', placeholder: t('lattes.tipo.ATIV_ENSINO.campo.disciplinas.placeholder', 'Separe por ponto e vírgula (;)') }] },
    ATIV_ESTAGIO: { label: t('lattes.tipo.ATIV_ESTAGIO.label', 'Estágio'), fields: [
        F_INST, { key: 'orgao', label: t('lattes.tipo.ATIV_ESTAGIO.campo.orgao.label', 'Órgão/Unidade'), type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: t('lattes.tipo.ATIV_ESTAGIO.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
        { key: 'titulo', label: t('lattes.tipo.ATIV_ESTAGIO.campo.titulo.label', 'Estágio realizado'), type: 'text', required: true, placeholder: t('lattes.tipo.ATIV_ESTAGIO.campo.titulo.placeholder', 'Separe por ponto e vírgula (;)') }] },
    ATIV_SERVICO: { label: t('lattes.tipo.ATIV_SERVICO.label', 'Serviço técnico especializado'), fields: [
        F_INST, { key: 'orgao', label: t('lattes.tipo.ATIV_SERVICO.campo.orgao.label', 'Órgão/Unidade'), type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: t('lattes.tipo.ATIV_SERVICO.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
        { key: 'titulo', label: t('lattes.tipo.ATIV_SERVICO.campo.titulo.label', 'Serviço realizado'), type: 'text', required: true, placeholder: t('lattes.tipo.ATIV_SERVICO.campo.titulo.placeholder', 'Separe por ponto e vírgula (;)') }] },
    ATIV_EXTENSAO: { label: t('lattes.tipo.ATIV_EXTENSAO.label', 'Extensão universitária'), fields: [
        F_INST, { key: 'orgao', label: t('lattes.tipo.ATIV_EXTENSAO.campo.orgao.label', 'Órgão/Unidade'), type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: t('lattes.tipo.ATIV_EXTENSAO.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
        { key: 'titulo', label: t('lattes.tipo.ATIV_EXTENSAO.campo.titulo.label', 'Atividade de extensão realizada'), type: 'text', required: true, placeholder: t('lattes.tipo.ATIV_EXTENSAO.campo.titulo.placeholder', 'Separe por ponto e vírgula (;)') }] },
    ATIV_TREINAMENTO: { label: t('lattes.tipo.ATIV_TREINAMENTO.label', 'Treinamento'), fields: [
        F_INST, { key: 'orgao', label: t('lattes.tipo.ATIV_TREINAMENTO.campo.orgao.label', 'Órgão/Unidade'), type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: t('lattes.tipo.ATIV_TREINAMENTO.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
        { key: 'titulo', label: t('lattes.tipo.ATIV_TREINAMENTO.campo.titulo.label', 'Treinamento ministrado'), type: 'text', required: true, placeholder: t('lattes.tipo.ATIV_TREINAMENTO.campo.titulo.placeholder', 'Separe por ponto e vírgula (;)') }] },
    ATIV_OUTRA: { label: t('lattes.tipo.ATIV_OUTRA.label', 'Outra atividade técnico-científica'), fields: [
        F_INST, { key: 'orgao', label: t('lattes.tipo.ATIV_OUTRA.campo.orgao.label', 'Órgão/Unidade'), type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: t('lattes.tipo.ATIV_OUTRA.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
        { key: 'titulo', label: t('lattes.tipo.ATIV_OUTRA.campo.titulo.label', 'Outra atividade técnico-científica'), type: 'text', required: true, placeholder: t('lattes.tipo.ATIV_OUTRA.campo.titulo.placeholder', 'Separe por ponto e vírgula (;)') }] },
    ATIV_CONSELHO: { label: t('lattes.tipo.ATIV_CONSELHO.label', 'Conselhos, comissões e consultoria'), fields: [
        F_INST, { key: 'orgao', label: t('lattes.tipo.ATIV_CONSELHO.campo.orgao.label', 'Órgão/Unidade'), type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: t('lattes.tipo.ATIV_CONSELHO.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
        { key: 'titulo', label: t('lattes.tipo.ATIV_CONSELHO.campo.titulo.label', 'Cargo ou função'), type: 'text', required: true, placeholder: t('lattes.tipo.ATIV_CONSELHO.campo.titulo.placeholder', 'Separe por ponto e vírgula (;)') }] },
};
