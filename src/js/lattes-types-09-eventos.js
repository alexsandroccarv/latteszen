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
   lattesZen — Definições de tipo: 09 Eventos
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "09 Eventos"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.

   i18n (preparação): label/help passam por t(); os arrays de `options`
   viram `{ value, label }` via opcoes() — ver nota de arquitetura no
   topo de lattes-types-campos.js.
   ========================================================================== */
import { F_TITULO, F_ANO, F_URL, F_CIDADE, F_NATUREZA, F_AFIM, F_PAIS, F_IDIOMA, MEIO_DIVULGACAO_OPTIONS, PROD_AUTORES_LISTA, PROD_PALAVRAS_AREA_SETORES_OUTRAS, opcoes } from './lattes-types-campos.js';
import { t } from './i18n.js';

export const TYPES_09_EVENTOS = {
    // 09 Eventos
    // "Classificação do evento" (Internacional/Nacional/Regional/Local, doc
    // 9.1.5) consta na tela real, mas nenhum dos elementos DADOS-BASICOS-DA-
    // PARTICIPACAO-EM-* / DETALHAMENTO-DA-PARTICIPACAO-EM-* tem atributo
    // correspondente no XSD/DTD (o atributo CLASSIFICACAO-DO-EVENTO existe
    // no schema, mas pertence a DETALHAMENTO-DO-TRABALHO — Trabalho publicado
    // em anais de evento, seção 5.5, um tipo totalmente diferente) —
    // limitação genuína do schema, por isso não entrou na UI. Os demais
    // campos da tela real (9.1) já estavam corretamente mapeados.
    PARTICIPACAO_EVENTO: { label: t('lattes.tipo.PARTICIPACAO_EVENTO.label', 'Participação em eventos, congressos, exposições, feiras e olimpíadas'), fields: [
        { key: 'titulo', label: t('lattes.tipo.PARTICIPACAO_EVENTO.campo.titulo.label', 'Nome do evento'), type: 'text', required: true },
        { key: 'natureza', label: t('lattes.tipo.PARTICIPACAO_EVENTO.campo.natureza.label', 'Natureza'), type: 'select', required: true, options: opcoes('participacao_evento_natureza', ['Congresso', 'Seminário', 'Simpósio', 'Oficina', 'Encontro', 'Olimpíada', 'Feira', 'Exposição', 'Outra']) },
        { key: 'formaParticipacao', label: t('lattes.tipo.PARTICIPACAO_EVENTO.campo.forma_participacao.label', 'Forma de participação'), type: 'select', options: opcoes('participacao_evento_forma_participacao', ['Convidado', 'Participante', 'Ouvinte']) },
        { key: 'tipoParticipacao', label: t('lattes.tipo.PARTICIPACAO_EVENTO.campo.tipo_participacao.label', 'Tipo de apresentação / participação'), type: 'select', options: opcoes('participacao_evento_tipo_participacao', ['Conferencista', 'Simposista', 'Moderador', 'Avaliador', 'Homenageado']), disabledWhen: { field: 'formaParticipacao', equals: 'Ouvinte' } },
        { key: 'tituloApresentacao', label: t('lattes.tipo.PARTICIPACAO_EVENTO.campo.titulo_apresentacao.label', 'Título da apresentação'), type: 'text', help: t('lattes.tipo.PARTICIPACAO_EVENTO.campo.titulo_apresentacao.help', 'Preencher apenas para Convidado ou Participante.'), disabledWhen: { field: 'formaParticipacao', equals: 'Ouvinte' } },
        { ...F_ANO, row: 'periodo' }, F_AFIM,
        F_PAIS,
        F_CIDADE,
        { key: 'divulgacaoCT', label: t('lattes.tipo.PARTICIPACAO_EVENTO.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox', help: t('lattes.tipo.PARTICIPACAO_EVENTO.campo.divulgacao_ct.help', 'Só se aplica a Convidado ou Participante — Ouvinte não tem produção.'), disabledWhen: { field: 'formaParticipacao', equals: 'Ouvinte' } },
        { key: 'cargaHoraria', label: t('lattes.tipo.PARTICIPACAO_EVENTO.campo.carga_horaria.label', 'Carga horária (h)'), type: 'number', na: true, help: t('lattes.tipo.PARTICIPACAO_EVENTO.campo.carga_horaria.help', 'Campo interno do lattesZen — não existe no Currículo Lattes e não é exportado no XML.') },
        { key: 'url', label: t('lattes.tipo.PARTICIPACAO_EVENTO.campo.url.label', 'Home page do trabalho (URL)'), type: 'url' }] },
    ORGANIZACAO_EVENTO: { label: t('lattes.tipo.ORGANIZACAO_EVENTO.label', 'Organização de eventos, congressos, exposições, feiras e olimpíadas'), fields: [
        { key: 'tipoEvento', label: t('lattes.tipo.ORGANIZACAO_EVENTO.campo.tipo_evento.label', 'Tipo'), type: 'select', options: opcoes('organizacao_evento_tipo_evento', ['Concerto', 'Concurso', 'Congresso', 'Exposição', 'Festival', 'Feira', 'Olimpíada', 'Outro']) },
        F_NATUREZA(opcoes('organizacao_evento_natureza', ['Curadoria', 'Montagem', 'Museologia', 'Organização'])),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM,
        F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.ORGANIZACAO_EVENTO.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.ORGANIZACAO_EVENTO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.ORGANIZACAO_EVENTO.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        { key: 'instituicao', label: t('lattes.tipo.ORGANIZACAO_EVENTO.campo.instituicao.label', 'Instituição promotora'), type: 'text' },
        { key: 'duracaoSemanas', label: t('lattes.tipo.ORGANIZACAO_EVENTO.campo.duracao_semanas.label', 'Duração (semanas)'), type: 'number' },
        { key: 'itinerante', label: t('lattes.tipo.ORGANIZACAO_EVENTO.campo.itinerante.label', 'Evento itinerante'), type: 'checkbox' },
        { key: 'catalogo', label: t('lattes.tipo.ORGANIZACAO_EVENTO.campo.catalogo.label', 'Catálogo'), type: 'checkbox' },
        { key: 'local', label: t('lattes.tipo.ORGANIZACAO_EVENTO.campo.local.label', 'Local'), type: 'text' }, F_CIDADE,
        PROD_AUTORES_LISTA,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
};
