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
   lattesZen — Definições de tipo: 05.3 Produção artística/cultural
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "05.3 Produção artística/cultural"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.

   i18n (preparação): label passa por t(); os arrays de `options` ficam de
   fora — ver nota de arquitetura no topo de lattes-types-campos.js (value
   vs. label ainda em aberto).
   ========================================================================== */
import { F_TITULO, F_ANO, F_URL, F_CIDADE, F_NATUREZA, F_AFIM, F_PAIS, F_IDIOMA, MEIO_DIVULGACAO_OPTIONS, PROD_AUTORES_LISTA, PROD_PALAVRAS_AREA_SETORES_OUTRAS } from './lattes-types-campos.js';
import { t } from './i18n.js';

export const TYPES_05_PRODUCAO_ARTISTICA = {
    // 05.3 Produção artística/cultural. Artes cênicas e Música têm a mesma
    // estrutura (Música soma "Formação instrumental"); o campo `evento`
    // (chave antiga, rotulado "Evento / Local") já era exportado como
    // INSTITUICAO-PROMOTORA-DO-EVENTO — relabeled pra bater com o campo real
    // da tela, sem trocar a chave nem os dados salvos.
    // "Ineditismo da obra" consta na tela real de Artes cênicas (doc 5.27.12),
    // mas DETALHAMENTO-DE-ARTES-CENICAS não tem o atributo FLAG-INEDITISMO-DA-
    // OBRA no XSD/DTD (só DETALHAMENTO-DA-MUSICA tem) — limitação genuína do
    // schema, por isso o campo não entrou na UI de Artes cênicas.
    ARTES_CENICAS: { label: t('lattes.tipo.ARTES_CENICAS.label', 'Artes cênicas'), fields: [
        F_NATUREZA(['Audiovisual', 'Circense', 'Coreográfica', 'Diversas', 'Operística', 'Performática', 'Radialística', 'Teatral', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.ARTES_CENICAS.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.ARTES_CENICAS.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.ARTES_CENICAS.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        { key: 'tipoEvento', label: t('lattes.tipo.ARTES_CENICAS.campo.tipo_evento.label', 'Tipo de evento'), type: 'text' },
        { key: 'atividadeAutores', label: t('lattes.tipo.ARTES_CENICAS.campo.atividade_autores.label', 'Atividade dos autores'), type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'dataEstreia', label: t('lattes.tipo.ARTES_CENICAS.campo.data_estreia.label', 'Data de estreia'), type: 'datebr' },
        { key: 'localEstreia', label: t('lattes.tipo.ARTES_CENICAS.campo.local_estreia.label', 'Local da estreia'), type: 'text' },
        { key: 'premiacao', label: t('lattes.tipo.ARTES_CENICAS.campo.premiacao.label', 'Premiação'), type: 'text' },
        { key: 'instituicaoPremio', label: t('lattes.tipo.ARTES_CENICAS.campo.instituicao_premio.label', 'Nome da instituição promotora do prêmio'), type: 'text' },
        { key: 'obraReferencia', label: t('lattes.tipo.ARTES_CENICAS.campo.obra_referencia.label', 'Obra de referência'), type: 'text' },
        { key: 'autorObraReferencia', label: t('lattes.tipo.ARTES_CENICAS.campo.autor_obra_referencia.label', 'Autor da obra de referência'), type: 'text' },
        { key: 'anoObraReferencia', label: t('lattes.tipo.ARTES_CENICAS.campo.ano_obra_referencia.label', 'Ano da obra de referência'), type: 'text' },
        { key: 'duracaoMinutos', label: t('lattes.tipo.ARTES_CENICAS.campo.duracao_minutos.label', 'Duração (minutos)'), type: 'number' },
        { key: 'temporada', label: t('lattes.tipo.ARTES_CENICAS.campo.temporada.label', 'Temporada'), type: 'text' },
        { key: 'evento', label: t('lattes.tipo.ARTES_CENICAS.campo.evento.label', 'Instituição promotora do evento'), type: 'text' },
        { key: 'localEvento', label: t('lattes.tipo.ARTES_CENICAS.campo.local_evento.label', 'Local do evento'), type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    MUSICA: { label: t('lattes.tipo.MUSICA.label', 'Música'), fields: [
        F_NATUREZA(['Apresentação de obra', 'Arranjo', 'Audiovisual', 'Composição', 'Diversas', 'Interpretação', 'Publicação de partitura', 'Registro fonográfico', 'Trilha sonora', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.MUSICA.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.MUSICA.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.MUSICA.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        { key: 'tipoEvento', label: t('lattes.tipo.MUSICA.campo.tipo_evento.label', 'Tipo de evento'), type: 'text' },
        { key: 'atividadeAutores', label: t('lattes.tipo.MUSICA.campo.atividade_autores.label', 'Atividade dos autores'), type: 'text' },
        { key: 'formacaoInstrumental', label: t('lattes.tipo.MUSICA.campo.formacao_instrumental.label', 'Formação instrumental'), type: 'text' },
        { key: 'ineditismo', label: t('lattes.tipo.MUSICA.campo.ineditismo.label', 'Ineditismo da obra'), type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'dataEstreia', label: t('lattes.tipo.MUSICA.campo.data_estreia.label', 'Data de estreia'), type: 'datebr' },
        { key: 'localEstreia', label: t('lattes.tipo.MUSICA.campo.local_estreia.label', 'Local da estreia'), type: 'text' },
        { key: 'premiacao', label: t('lattes.tipo.MUSICA.campo.premiacao.label', 'Premiação'), type: 'text' },
        { key: 'instituicaoPremio', label: t('lattes.tipo.MUSICA.campo.instituicao_premio.label', 'Nome da instituição promotora do prêmio'), type: 'text' },
        { key: 'obraReferencia', label: t('lattes.tipo.MUSICA.campo.obra_referencia.label', 'Obra de referência'), type: 'text' },
        { key: 'autorObraReferencia', label: t('lattes.tipo.MUSICA.campo.autor_obra_referencia.label', 'Autor da obra de referência'), type: 'text' },
        { key: 'anoObraReferencia', label: t('lattes.tipo.MUSICA.campo.ano_obra_referencia.label', 'Ano da obra de referência'), type: 'text' },
        { key: 'duracaoMinutos', label: t('lattes.tipo.MUSICA.campo.duracao_minutos.label', 'Duração (minutos)'), type: 'number' },
        { key: 'temporada', label: t('lattes.tipo.MUSICA.campo.temporada.label', 'Temporada'), type: 'text' },
        { key: 'evento', label: t('lattes.tipo.MUSICA.campo.evento.label', 'Instituição promotora do evento'), type: 'text' },
        { key: 'localEvento', label: t('lattes.tipo.MUSICA.campo.local_evento.label', 'Local do evento'), type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    // Tipo de evento / Itinerante / Nome da instituição promotora do prêmio
    // constam na tela real (doc 5.29), mas DETALHAMENTO-DE-ARTES-VISUAIS não
    // tem atributo correspondente no XSD/DTD — limitação genuína do schema,
    // por isso não entraram na UI.
    ARTES_VISUAIS: { label: t('lattes.tipo.ARTES_VISUAIS.label', 'Artes visuais'), fields: [
        F_NATUREZA(['Intervenção urbana', 'Livro de artista', 'Performance', 'Pintura', 'Programação visual', 'Vídeo', 'Webart', 'Animação', 'Instalação', 'Computação gráfica', 'Desenho', 'Diversas', 'Escultura', 'Filme', 'Fotografia', 'Gravura', 'Ilustração', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.ARTES_VISUAIS.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.ARTES_VISUAIS.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.ARTES_VISUAIS.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        { key: 'atividadeAutores', label: t('lattes.tipo.ARTES_VISUAIS.campo.atividade_autores.label', 'Atividade dos autores'), type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'premiacao', label: t('lattes.tipo.ARTES_VISUAIS.campo.premiacao.label', 'Premiação'), type: 'text' },
        { key: 'temporada', label: t('lattes.tipo.ARTES_VISUAIS.campo.temporada.label', 'Temporada'), type: 'text' },
        { key: 'evento', label: t('lattes.tipo.ARTES_VISUAIS.campo.evento.label', 'Instituição promotora do evento'), type: 'text' },
        { key: 'localEvento', label: t('lattes.tipo.ARTES_VISUAIS.campo.local_evento.label', 'Local do evento'), type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    // A tela real de "Outra produção artística/cultural" tem muito mais
    // campos (Tipo de evento, Atividade dos autores, Ineditismo da obra,
    // Data de estreia/encerramento, Local da estreia, Nome da instituição
    // promotora do prêmio, Obra de referência/autor/ano, Duração, Temporada —
    // doc 5.30), mas DETALHAMENTO-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL só tem
    // 5 atributos no XSD/DTD (INSTITUICAO-PROMOTORA-DO-EVENTO, LOCAL-DO-
    // EVENTO, CIDADE, EXPOSICAO, PREMIACAO) — de longe a maior limitação
    // genuína de schema encontrada nesta seção. Só os campos com
    // correspondência real entraram na UI.
    OUTRA_ARTISTICA: { label: t('lattes.tipo.OUTRA_ARTISTICA.label', 'Outra produção artística/cultural'), fields: [
        { key: 'natureza', label: t('lattes.tipo.OUTRA_ARTISTICA.campo.natureza.label', 'Natureza'), type: 'text' },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.OUTRA_ARTISTICA.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.OUTRA_ARTISTICA.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.OUTRA_ARTISTICA.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'premiacao', label: t('lattes.tipo.OUTRA_ARTISTICA.campo.premiacao.label', 'Premiação'), type: 'text' },
        { key: 'evento', label: t('lattes.tipo.OUTRA_ARTISTICA.campo.evento.label', 'Instituição promotora do evento'), type: 'text' },
        { key: 'localEvento', label: t('lattes.tipo.OUTRA_ARTISTICA.campo.local_evento.label', 'Local do evento'), type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
};
