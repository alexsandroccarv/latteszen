/* ==========================================================================
   lattesZen — Definições de tipo: 05.2 Produção técnica
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "05.2 Produção técnica"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.
   ========================================================================== */
import { F_TITULO, F_ANO, F_URL, F_INST, F_FINAL, F_CIDADE, F_NATUREZA, F_AFIM, F_PAIS, F_IDIOMA, MEIO_DIVULGACAO_OPTIONS, PROD_AUTORES_LISTA, PROD_PALAVRAS_AREA_SETORES_OUTRAS } from './lattes-types-campos.js';

export const TYPES_05_PRODUCAO_TECNICA = {
    // 05.2 Produção técnica
    ASSESSORIA_CONSULTORIA: { label: 'Assessoria e consultoria', fields: [
        F_NATUREZA(['Assessoria', 'Consultoria']), F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'duracaoMeses', label: 'Duração (meses)', type: 'number' }, { key: 'paginas', label: 'Número de páginas', type: 'text' },
        { key: 'disponibilidade', label: 'Disponibilidade', type: 'text' }, F_CIDADE, F_INST,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    EXTENSAO_TECNOLOGICA: { label: 'Extensão tecnológica', fields: [
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'duracaoMeses', label: 'Duração (meses)', type: 'number' }, { key: 'paginas', label: 'Número de páginas', type: 'text' },
        { key: 'disponibilidade', label: 'Disponibilidade', type: 'text' }, F_CIDADE, F_INST,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    // "Tipo de programa" e "Depositante/Titular" (Pessoas/Instituições) são
    // grupos repetíveis da tela real sem elemento correspondente no XSD —
    // limitação genuína do schema, não têm como ser exportados. "Linguagens"
    // e "Qual o potencial de inovação?" (texto longo) também não têm atributo
    // correspondente. Nenhum dos quatro foi adicionado à UI por esse motivo.
    SOFTWARE_SEM_REGISTRO: { label: 'Programa de computador sem registro', fields: [
        F_NATUREZA(['Computacional', 'Multimídia', 'Outro']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'plataforma', label: 'Plataforma / Ambiente', type: 'text' },
        { key: 'disponibilidade', label: 'Disponibilidade', type: 'select', options: ['Restrita', 'Irrestrita'] },
        { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS.slice(0, 3),
        { key: 'outrasInfo', label: 'Resumo', type: 'textarea' },
    ] },
    PRODUTO_TECNOLOGICO: { label: 'Produtos', fields: [
        { key: 'natureza', label: 'Tipo', type: 'select', options: ['Piloto', 'Projeto', 'Protótipo', 'Outro'] },
        // "Natureza" real do schema (APARELHO/EQUIPAMENTO/FARMACOS_E_SIMILARES/
        // INSTRUMENTO/OUTRA) — distinta do "Tipo" acima (chave `natureza`
        // herdada do átomo F_NATUREZA original, mapeado pra TIPO-PRODUTO).
        { key: 'naturezaProduto', label: 'Natureza', type: 'select', options: ['Aparelho', 'Equipamento', 'Fármacos e similares', 'Instrumento', 'Outra'] },
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'disponibilidade', label: 'Disponibilidade', type: 'text' }, F_CIDADE,
        { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
        { key: 'registro', label: 'Registro (se houver)', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    PROCESSO_TECNICA: { label: 'Processos ou técnicas', fields: [
        F_NATUREZA(['Analítica', 'Instrumental', 'Pedagógica', 'Processual', 'Terapêutica', 'Outra']),
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'disponibilidade', label: 'Disponibilidade', type: 'text' }, F_CIDADE,
        { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    TRABALHO_TECNICO: { label: 'Trabalhos técnicos', fields: [
        F_NATUREZA(['Parecer', 'Elaboração de projeto', 'Relatório técnico', 'Serviços na área da saúde', 'Extensão tecnológica', 'Outra']),
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'duracaoMeses', label: 'Duração (meses)', type: 'number' }, { key: 'paginas', label: 'Número de páginas', type: 'text' },
        { key: 'disponibilidade', label: 'Disponibilidade', type: 'text' }, F_CIDADE, F_INST,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    CARTA_MAPA: { label: 'Cartas, mapas ou similares', fields: [
        F_NATUREZA(['Aerofotograma', 'Carta', 'Fotograma', 'Mapa', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'tema', label: 'Tema', type: 'text' },
        { key: 'tecnica', label: 'Técnica', type: 'text' },
        { key: 'areaRepresentada', label: 'Área representada', type: 'text' },
        { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    CURSO_MINISTRADO: { label: 'Curso de curta duração ministrado', fields: [
        { key: 'nivel', label: 'Nível do curso', type: 'select', options: ['Extensão', 'Aperfeiçoamento', 'Especialização', 'Outra'] },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'participacaoAutores', label: 'Participação dos autores', type: 'select', options: ['Docente', 'Organizador', 'Outra'] },
        PROD_AUTORES_LISTA,
        { key: 'cargaHoraria', label: 'Duração (carga horária)', type: 'number', na: true },
        { key: 'unidade', label: 'Unidade da duração (h, dias, meses...)', type: 'text' },
        { key: 'instituicao', label: 'Instituição promotora', type: 'text' },
        { key: 'local', label: 'Local do curso', type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    MATERIAL_DIDATICO: { label: 'Desenvolvimento de material didático ou instrucional', fields: [
        { key: 'natureza', label: 'Natureza', type: 'text' },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    EDITORACAO: { label: 'Editoração', fields: [
        F_NATUREZA(['Livro', 'Anais', 'Catálogo', 'Coletânea', 'Enciclopédia', 'Periódico', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'paginas', label: 'Nº de páginas', type: 'text' },
        // Editoração: o principal aqui é a Editora, não a instituição — nem
        // sempre há uma instituição promotora por trás (ex.: editora
        // comercial independente), por isso o N/A.
        { key: 'instituicao', label: 'Instituição promotora', type: 'text', na: true },
        { key: 'editora', label: 'Editora', type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    // Meio de divulgação e Home page NÃO têm atributo correspondente no XSD/DTD
    // para Manutenção de obra artística (ao contrário dos demais tipos da
    // seção) — limitação genuína do schema, por isso não entraram na UI. O
    // campo `finalidade` (chave antiga, atrás rotulada "Finalidade /
    // Descrição") já era exportado como LOCAL — relabeled pra bater com o
    // campo real da tela ("Local"), sem trocar a chave nem os dados salvos.
    MANUTENCAO_OBRA: { label: 'Manutenção de obra artística', fields: [
        { key: 'tipo', label: 'Tipo', type: 'select', options: ['Conservação', 'Restauração', 'Outro'] },
        F_NATUREZA(['Arquitetura', 'Desenho', 'Escultura', 'Fotografia', 'Gravura', 'Pintura', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'nomeObra', label: 'Nome da obra', type: 'text' },
        { key: 'autorObra', label: 'Autor da obra', type: 'text' },
        { key: 'anoObra', label: 'Ano da obra', type: 'text' },
        { key: 'acervo', label: 'Acervo', type: 'select', options: ['Público', 'Privado'] },
        { ...F_FINAL, label: 'Local' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    MAQUETE: { label: 'Maquete', fields: [
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'objetoRepresentado', label: 'Objeto representado', type: 'text' },
        { key: 'materialUtilizado', label: 'Material utilizado', type: 'text' },
        { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    MIDIA: { label: 'Entrevistas, mesas redondas, programas e comentários na mídia', fields: [
        { key: 'tipo', label: 'Natureza', type: 'select', options: ['Entrevista', 'Mesa redonda', 'Comentário', 'Programa', 'Outra'] },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'veiculo', label: 'Veículo de divulgação', type: 'text' },
        { key: 'tema', label: 'Tema', type: 'text' },
        { key: 'dataRealizacao', label: 'Data de realização', type: 'datebr' },
        { key: 'duracaoMinutos', label: 'Duração (minutos)', type: 'number' },
        PROD_AUTORES_LISTA, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    RELATORIO_PESQUISA: { label: 'Relatório de pesquisa', fields: [
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'nomeProjeto', label: 'Nome do projeto', type: 'text' },
        { key: 'paginas', label: 'Número de páginas', type: 'text' },
        { key: 'disponibilidade', label: 'Disponibilidade', type: 'text' },
        { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    // A tela real tem "Natureza" (select) e "Tema" (texto) como campos
    // distintos; o campo `plataforma` já existente (antes rotulado
    // "Plataforma / Tema" e, no export antigo, usado tanto como Natureza
    // quanto como Tema — bug de conflação) só correspondia de fato ao Tema —
    // relabeled, mantendo a chave e os dados salvos. `natureza` é campo novo.
    MIDIA_SOCIAL: { label: 'Redes sociais, websites e blogs', fields: [
        F_NATUREZA(['Rede Social', 'Fórum', 'Blog', 'Site']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'plataforma', label: 'Tema', type: 'text' },
        PROD_AUTORES_LISTA,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    OUTRA_TECNICA: { label: 'Outra produção técnica', fields: [
        { key: 'natureza', label: 'Natureza', type: 'text' },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'instituicao', label: 'Instituição promotora', type: 'text' },
        { key: 'local', label: 'Local', type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
};
