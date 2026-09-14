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
   lattesZen — Definições de tipo: 05.1 Produção bibliográfica
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "05.1 Produção bibliográfica"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.
   ========================================================================== */
import { F_TITULO, F_ANO, F_DOI, F_URL, F_AUTORES, F_CIDADE, F_NATUREZA, F_AFIM, F_PAIS, F_IDIOMA, MEIO_DIVULGACAO_OPTIONS, PROD_AUTORES_LISTA, PROD_PALAVRAS_AREA_SETORES_OUTRAS } from './lattes-types-campos.js';

export const TYPES_05_PRODUCAO_BIBLIOGRAFICA = {
    // 05.1 Produção bibliográfica
    ARTIGO_PERIODICO: { label: 'Artigos completos publicados em periódicos', fields: [
        F_DOI,
        F_TITULO, F_ANO, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'periodico', label: 'Periódico / Revista', type: 'text', required: true }, { key: 'issn', label: 'ISSN', type: 'text' },
        { key: 'volume', label: 'Volume', type: 'text' }, { key: 'fasciculo', label: 'Fascículo / Número', type: 'text' },
        { key: 'serie', label: 'Série', type: 'text' },
        { key: 'paginaInicial', label: 'Página inicial / Número artigo eletrônico', type: 'text' },
        { key: 'paginaFinal', label: 'Página final', type: 'text' },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    ARTIGO_ACEITO: { label: 'Artigos aceitos para publicação', fields: [
        F_DOI,
        F_TITULO, { ...F_ANO, label: 'Ano previsto para publicação' }, F_IDIOMA,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'periodico', label: 'Título do periódico/revista em que o artigo será publicado', type: 'text', required: true },
        { key: 'issn', label: 'ISSN', type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    // Mantido apenas para compatibilidade com itens já catalogados (chave
    // legada); novos itens usam os 2 tipos específicos abaixo (Livros/Capítulos).
    LIVRO_CAPITULO: { label: 'Livros e capítulos', fields: [
        { key: 'tipoObra', label: 'Tipo', type: 'select', required: true, options: ['Livro publicado', 'Livro organizado', 'Capítulo de livro'] },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_AUTORES, { key: 'tituloLivro', label: 'Título do livro (se capítulo)', type: 'text' },
        { key: 'organizadores', label: 'Organizadores', type: 'text' }, { key: 'editora', label: 'Editora', type: 'text' },
        F_CIDADE, { key: 'isbn', label: 'ISBN', type: 'text' }, { key: 'edicao', label: 'Edição', type: 'text' },
        { key: 'paginas', label: 'Páginas', type: 'text' }, F_IDIOMA, F_PAIS, F_URL] },
    LIVROS: { label: 'Livros', fields: [
        F_DOI,
        { key: 'tipoObra', label: 'Tipo', type: 'select', required: true, options: ['Livro publicado', 'Organização de obra publicada'] },
        { key: 'naturezaLivroPublicado', label: 'Natureza', type: 'select', options: ['Coletânea', 'Texto Integral', 'Verbete', 'Outro'],
          disabledWhen: { field: 'tipoObra', notEquals: 'Livro publicado' } },
        { key: 'naturezaOrganizacao', label: 'Natureza', type: 'select', options: ['Periódico', 'Outro', 'Livro', 'Anais', 'Catálogo', 'Coletânea', 'Enciclopédia'],
          disabledWhen: { field: 'tipoObra', notEquals: 'Organização de obra publicada' } },
        { key: 'titulo', label: 'Título do livro', type: 'text', required: true },
        { ...F_ANO, label: 'Ano' }, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'numeroVolumes', label: 'Número de volumes', type: 'text' },
        { key: 'paginas', label: 'Número de páginas', type: 'text' },
        { key: 'isbn', label: 'ISBN', type: 'text' },
        { key: 'edicao', label: 'Número da edição/revisão', type: 'text' },
        { key: 'serie', label: 'Série', type: 'text' },
        { key: 'cidade', label: 'Cidade da editora', type: 'text' },
        { key: 'editora', label: 'Nome da editora', type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    CAPITULOS_LIVRO: { label: 'Capítulos', fields: [
        F_DOI,
        { key: 'titulo', label: 'Título do capítulo', type: 'text', required: true },
        { ...F_ANO, label: 'Ano' }, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'tituloLivro', label: 'Título do livro', type: 'text' },
        { key: 'organizadores', label: 'Organizadores', type: 'text', help: 'Se houver mais de um organizador, informe os nomes separados por ponto e vírgula (;).' },
        { key: 'numeroVolumes', label: 'Número do volume', type: 'text' },
        { key: 'paginaInicial', label: 'Página inicial', type: 'text' },
        { key: 'paginaFinal', label: 'Página final', type: 'text' },
        { key: 'edicao', label: 'Número da edição/revisão', type: 'text' },
        { key: 'serie', label: 'Série', type: 'text' },
        { key: 'isbn', label: 'ISBN', type: 'text' },
        { key: 'cidade', label: 'Cidade da editora', type: 'text' },
        { key: 'editora', label: 'Nome da editora', type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    TEXTO_JORNAL: { label: 'Texto em jornal ou revista (magazine)', fields: [
        { key: 'natureza', label: 'Natureza', type: 'select', options: ['Jornal de notícias', 'Revista (Magazine)'] },
        F_TITULO, { ...F_ANO, label: 'Ano' },
        { key: 'pais', label: 'País da publicação', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' }, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'veiculo', label: 'Título do jornal/revista em que o texto foi publicado', type: 'text', required: true },
        { key: 'issn', label: 'ISSN', type: 'text' },
        { key: 'data', label: 'Data de publicação', type: 'date' },
        { key: 'volume', label: 'Volume', type: 'text' },
        { key: 'paginaInicial', label: 'Página inicial', type: 'text' },
        { key: 'paginaFinal', label: 'Página final', type: 'text' },
        { key: 'cidade', label: 'Local de publicação', type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    TRABALHO_EVENTO: { label: 'Trabalhos publicados em anais de eventos', fields: [
        F_DOI,
        F_NATUREZA(['Completo', 'Resumo', 'Resumo expandido']),
        F_TITULO, { ...F_ANO, label: 'Ano' },
        { key: 'pais', label: 'País de publicação', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' }, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'classificacaoEvento', label: 'Classificação do evento', type: 'select', options: ['Internacional', 'Nacional', 'Regional', 'Local'] },
        { key: 'evento', label: 'Nome do evento', type: 'text', required: true },
        F_CIDADE,
        { key: 'anoEvento', label: 'Ano do evento', type: 'datebr' },
        { key: 'anais', label: 'Título dos anais do evento', type: 'text' },
        { key: 'volume', label: 'Volume', type: 'text' },
        { key: 'fasciculo', label: 'Fascículo', type: 'text' },
        { key: 'serie', label: 'Série', type: 'text' },
        { key: 'paginaInicial', label: 'Página inicial', type: 'text' },
        { key: 'paginaFinal', label: 'Página final', type: 'text' },
        { key: 'isbn', label: 'ISBN/ISSN', type: 'text', validate: 'isbnIssn', placeholder: 'ISBN-10, ISBN-13 ou ISSN' },
        { key: 'editora', label: 'Nome da editora', type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    APRESENTACAO: { label: 'Apresentação de trabalho e palestra', fields: [
        F_DOI,
        F_NATUREZA(['Comunicação', 'Conferência ou palestra', 'Congresso', 'Seminário', 'Simpósio', 'Outra']),
        F_TITULO, { ...F_ANO, label: 'Ano' },
        { key: 'pais', label: 'País de publicação', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' }, F_IDIOMA,
        // Meio de divulgação/Home page aparecem na tela do Lattes para este
        // tipo, mas o schema de exportação offline (docs/CurriculoLattes.xsd)
        // não tem atributo correspondente em DADOS-BASICOS-DA-APRESENTACAO-DE-
        // TRABALHO — ficam só para registro, não são exportados no XML.
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'evento', label: 'Nome do evento', type: 'text' },
        { key: 'instituicao', label: 'Instituição promotora', type: 'text' },
        { key: 'local', label: 'Local', type: 'text' },
        F_CIDADE,
        PROD_AUTORES_LISTA,
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    PARTITURA: { label: 'Partitura musical', fields: [
        F_TITULO, F_ANO, F_NATUREZA(['Canto', 'Coral', 'Orquestra', 'Outro']), F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'formacao', label: 'Formação instrumental', type: 'text' },
        { key: 'editora', label: 'Editora', type: 'text' }, { key: 'cidade', label: 'Cidade da editora', type: 'text' },
        { key: 'paginas', label: 'Número de páginas', type: 'text' }, { key: 'numeroCatalogo', label: 'Número do catálogo', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    TRADUCAO: { label: 'Tradução', fields: [
        F_TITULO, F_ANO, F_NATUREZA(['Livro', 'Artigo', 'Outro']), F_PAIS,
        { key: 'idioma', label: 'Idioma da tradução', type: 'select', options: window.IDIOMAS_LATTES || [] },
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'autorOriginal', label: 'Autor da obra original', type: 'text' },
        { key: 'obraOriginal', label: 'Título da obra original', type: 'text' },
        { key: 'issnIsbn', label: 'ISSN/ISBN', type: 'text' },
        { key: 'idiomaOriginal', label: 'Idioma original', type: 'select', options: window.IDIOMAS_LATTES || [] },
        { key: 'editora', label: 'Editora da tradução', type: 'text' }, { key: 'cidade', label: 'Cidade da editora', type: 'text' },
        { key: 'edicao', label: 'No. edição ou revisão', type: 'text' }, { key: 'paginas', label: 'Número de páginas', type: 'text' },
        { key: 'volume', label: 'Volume', type: 'text' }, { key: 'fasciculo', label: 'Fascículo', type: 'text' }, { key: 'serie', label: 'Série', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    PREFACIO: { label: 'Prefácio, posfácio', fields: [
        { key: 'natureza', label: 'Tipo', type: 'select', options: ['Prefácio', 'Posfácio', 'Apresentação', 'Introdução'] },
        // "Natureza" real do schema (LIVRO/OUTRA/REVISTAS_OU_PERIODICOS) — não
        // confundir com o campo acima ("Tipo" na tela real, mas guardado na
        // chave `natureza` por herdar o átomo F_NATUREZA original).
        { key: 'naturezaObra', label: 'Natureza', type: 'select', options: ['Livro', 'Revistas ou periódicos', 'Outra'] },
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'autorPublicacao', label: 'Autor da publicação', type: 'text' },
        { key: 'obra', label: 'Título da publicação', type: 'text' },
        { key: 'issnIsbn', label: 'ISSN/ISBN', type: 'text' },
        { key: 'editora', label: 'Editora', type: 'text' }, { key: 'cidade', label: 'Cidade da editora', type: 'text' },
        { key: 'edicao', label: 'No. edição ou revisão', type: 'text' },
        // "Número de páginas" existe na tela real (doc), mas o schema oficial
        // não tem atributo para isso em DETALHAMENTO-DO-PREFACIO-POSFACIO —
        // fica só de uso interno, não é exportado no XML.
        { key: 'paginas', label: 'Número de páginas', type: 'text' },
        { key: 'volume', label: 'Volume', type: 'text' }, { key: 'fasciculo', label: 'Fascículo', type: 'text' }, { key: 'serie', label: 'Série', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    OUTRA_BIBLIOGRAFICA: { label: 'Outra produção bibliográfica', fields: [
        { key: 'natureza', label: 'Natureza', type: 'text' },
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'editora', label: 'Editora', type: 'text' }, { key: 'cidade', label: 'Cidade da editora', type: 'text' },
        { key: 'paginas', label: 'Número de páginas', type: 'text' }, { key: 'issnIsbn', label: 'ISSN/ISBN', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
};
