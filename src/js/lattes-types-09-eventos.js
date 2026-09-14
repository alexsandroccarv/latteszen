/* ==========================================================================
   lattesZen — Definições de tipo: 09 Eventos
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "09 Eventos"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.
   ========================================================================== */
import { F_TITULO, F_ANO, F_URL, F_CIDADE, F_NATUREZA, F_AFIM, F_PAIS, F_IDIOMA, MEIO_DIVULGACAO_OPTIONS, PROD_AUTORES_LISTA, PROD_PALAVRAS_AREA_SETORES_OUTRAS } from './lattes-types-campos.js';

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
    PARTICIPACAO_EVENTO: { label: 'Participação em eventos, congressos, exposições, feiras e olimpíadas', fields: [
        { key: 'titulo', label: 'Nome do evento', type: 'text', required: true },
        { key: 'natureza', label: 'Natureza', type: 'select', required: true, options: ['Congresso', 'Seminário', 'Simpósio', 'Oficina', 'Encontro', 'Olimpíada', 'Feira', 'Exposição', 'Outra'] },
        { key: 'formaParticipacao', label: 'Forma de participação', type: 'select', options: ['Convidado', 'Participante', 'Ouvinte'] },
        { key: 'tipoParticipacao', label: 'Tipo de apresentação / participação', type: 'select', options: ['Conferencista', 'Simposista', 'Moderador', 'Avaliador', 'Homenageado'], disabledWhen: { field: 'formaParticipacao', equals: 'Ouvinte' } },
        { key: 'tituloApresentacao', label: 'Título da apresentação', type: 'text', help: 'Preencher apenas para Convidado ou Participante.', disabledWhen: { field: 'formaParticipacao', equals: 'Ouvinte' } },
        { ...F_ANO, row: 'periodo' }, F_AFIM,
        F_PAIS,
        F_CIDADE,
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox', help: 'Só se aplica a Convidado ou Participante — Ouvinte não tem produção.', disabledWhen: { field: 'formaParticipacao', equals: 'Ouvinte' } },
        { key: 'cargaHoraria', label: 'Carga horária (h)', type: 'number', na: true, help: 'Campo interno do lattesZen — não existe no Currículo Lattes e não é exportado no XML.' },
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' }] },
    ORGANIZACAO_EVENTO: { label: 'Organização de eventos, congressos, exposições, feiras e olimpíadas', fields: [
        { key: 'tipoEvento', label: 'Tipo', type: 'select', options: ['Concerto', 'Concurso', 'Congresso', 'Exposição', 'Festival', 'Feira', 'Olimpíada', 'Outro'] },
        F_NATUREZA(['Curadoria', 'Montagem', 'Museologia', 'Organização']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM,
        F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'instituicao', label: 'Instituição promotora', type: 'text' },
        { key: 'duracaoSemanas', label: 'Duração (semanas)', type: 'number' },
        { key: 'itinerante', label: 'Evento itinerante', type: 'checkbox' },
        { key: 'catalogo', label: 'Catálogo', type: 'checkbox' },
        { key: 'local', label: 'Local', type: 'text' }, F_CIDADE,
        PROD_AUTORES_LISTA,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
};
