/* ==========================================================================
   lattesZen — Definições de tipo: 05.3 Produção artística/cultural
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "05.3 Produção artística/cultural"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.
   ========================================================================== */
import { F_TITULO, F_ANO, F_URL, F_CIDADE, F_NATUREZA, F_AFIM, F_PAIS, F_IDIOMA, MEIO_DIVULGACAO_OPTIONS, PROD_AUTORES_LISTA, PROD_PALAVRAS_AREA_SETORES_OUTRAS } from './lattes-types-campos.js';

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
    ARTES_CENICAS: { label: 'Artes cênicas', fields: [
        F_NATUREZA(['Audiovisual', 'Circense', 'Coreográfica', 'Diversas', 'Operística', 'Performática', 'Radialística', 'Teatral', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'tipoEvento', label: 'Tipo de evento', type: 'text' },
        { key: 'atividadeAutores', label: 'Atividade dos autores', type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'dataEstreia', label: 'Data de estreia', type: 'datebr' },
        { key: 'localEstreia', label: 'Local da estreia', type: 'text' },
        { key: 'premiacao', label: 'Premiação', type: 'text' },
        { key: 'instituicaoPremio', label: 'Nome da instituição promotora do prêmio', type: 'text' },
        { key: 'obraReferencia', label: 'Obra de referência', type: 'text' },
        { key: 'autorObraReferencia', label: 'Autor da obra de referência', type: 'text' },
        { key: 'anoObraReferencia', label: 'Ano da obra de referência', type: 'text' },
        { key: 'duracaoMinutos', label: 'Duração (minutos)', type: 'number' },
        { key: 'temporada', label: 'Temporada', type: 'text' },
        { key: 'evento', label: 'Instituição promotora do evento', type: 'text' },
        { key: 'localEvento', label: 'Local do evento', type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    MUSICA: { label: 'Música', fields: [
        F_NATUREZA(['Apresentação de obra', 'Arranjo', 'Audiovisual', 'Composição', 'Diversas', 'Interpretação', 'Publicação de partitura', 'Registro fonográfico', 'Trilha sonora', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'tipoEvento', label: 'Tipo de evento', type: 'text' },
        { key: 'atividadeAutores', label: 'Atividade dos autores', type: 'text' },
        { key: 'formacaoInstrumental', label: 'Formação instrumental', type: 'text' },
        { key: 'ineditismo', label: 'Ineditismo da obra', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'dataEstreia', label: 'Data de estreia', type: 'datebr' },
        { key: 'localEstreia', label: 'Local da estreia', type: 'text' },
        { key: 'premiacao', label: 'Premiação', type: 'text' },
        { key: 'instituicaoPremio', label: 'Nome da instituição promotora do prêmio', type: 'text' },
        { key: 'obraReferencia', label: 'Obra de referência', type: 'text' },
        { key: 'autorObraReferencia', label: 'Autor da obra de referência', type: 'text' },
        { key: 'anoObraReferencia', label: 'Ano da obra de referência', type: 'text' },
        { key: 'duracaoMinutos', label: 'Duração (minutos)', type: 'number' },
        { key: 'temporada', label: 'Temporada', type: 'text' },
        { key: 'evento', label: 'Instituição promotora do evento', type: 'text' },
        { key: 'localEvento', label: 'Local do evento', type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    // Tipo de evento / Itinerante / Nome da instituição promotora do prêmio
    // constam na tela real (doc 5.29), mas DETALHAMENTO-DE-ARTES-VISUAIS não
    // tem atributo correspondente no XSD/DTD — limitação genuína do schema,
    // por isso não entraram na UI.
    ARTES_VISUAIS: { label: 'Artes visuais', fields: [
        F_NATUREZA(['Intervenção urbana', 'Livro de artista', 'Performance', 'Pintura', 'Programação visual', 'Vídeo', 'Webart', 'Animação', 'Instalação', 'Computação gráfica', 'Desenho', 'Diversas', 'Escultura', 'Filme', 'Fotografia', 'Gravura', 'Ilustração', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'atividadeAutores', label: 'Atividade dos autores', type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'premiacao', label: 'Premiação', type: 'text' },
        { key: 'temporada', label: 'Temporada', type: 'text' },
        { key: 'evento', label: 'Instituição promotora do evento', type: 'text' },
        { key: 'localEvento', label: 'Local do evento', type: 'text' }, F_CIDADE,
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
    OUTRA_ARTISTICA: { label: 'Outra produção artística/cultural', fields: [
        { key: 'natureza', label: 'Natureza', type: 'text' },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'premiacao', label: 'Premiação', type: 'text' },
        { key: 'evento', label: 'Instituição promotora do evento', type: 'text' },
        { key: 'localEvento', label: 'Local do evento', type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
};
