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

   i18n (preparação): label/help/placeholder passam por t(); os arrays de
   `options`/`default` ficam de fora — ver nota de arquitetura no topo de
   lattes-types-campos.js (value vs. label ainda em aberto).
   ========================================================================== */
import { F_TITULO, F_ANO, F_DOI, F_URL, F_AUTORES, F_CIDADE, F_NATUREZA, F_AFIM, F_PAIS, F_IDIOMA, MEIO_DIVULGACAO_OPTIONS, PROD_AUTORES_LISTA, PROD_PALAVRAS_AREA_SETORES_OUTRAS } from './lattes-types-campos.js';
import { t } from './i18n.js';

export const TYPES_05_PRODUCAO_BIBLIOGRAFICA = {
    // 05.1 Produção bibliográfica
    ARTIGO_PERIODICO: { label: t('lattes.tipo.ARTIGO_PERIODICO.label', 'Artigos completos publicados em periódicos'), fields: [
        F_DOI,
        F_TITULO, F_ANO, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.ARTIGO_PERIODICO.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: t('lattes.tipo.ARTIGO_PERIODICO.campo.url.label', 'Home page do trabalho (URL)'), type: 'url' },
        { key: 'relevante', label: t('lattes.tipo.ARTIGO_PERIODICO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.ARTIGO_PERIODICO.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'periodico', label: t('lattes.tipo.ARTIGO_PERIODICO.campo.periodico.label', 'Periódico / Revista'), type: 'text', required: true }, { key: 'issn', label: t('lattes.tipo.ARTIGO_PERIODICO.campo.issn.label', 'ISSN'), type: 'text' },
        { key: 'volume', label: t('lattes.tipo.ARTIGO_PERIODICO.campo.volume.label', 'Volume'), type: 'text' }, { key: 'fasciculo', label: t('lattes.tipo.ARTIGO_PERIODICO.campo.fasciculo.label', 'Fascículo / Número'), type: 'text' },
        { key: 'serie', label: t('lattes.tipo.ARTIGO_PERIODICO.campo.serie.label', 'Série'), type: 'text' },
        { key: 'paginaInicial', label: t('lattes.tipo.ARTIGO_PERIODICO.campo.pagina_inicial.label', 'Página inicial / Número artigo eletrônico'), type: 'text' },
        { key: 'paginaFinal', label: t('lattes.tipo.ARTIGO_PERIODICO.campo.pagina_final.label', 'Página final'), type: 'text' },
        { key: 'palavrasChave', label: t('lattes.tipo.ARTIGO_PERIODICO.campo.palavras_chave.label', 'Palavras-chave'), type: 'textarea', placeholder: t('lattes.tipo.ARTIGO_PERIODICO.campo.palavras_chave.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.ARTIGO_PERIODICO.campo.palavras_chave.help', 'Até 6 palavras-chave (limite da Plataforma Lattes).') },
        { key: 'areaConhecimento', label: t('lattes.tipo.ARTIGO_PERIODICO.campo.area_conhecimento.label', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', help: t('lattes.tipo.ARTIGO_PERIODICO.campo.area_conhecimento.help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.') },
        { key: 'setores', label: t('lattes.tipo.ARTIGO_PERIODICO.campo.setores.label', 'Setores de atividade'), type: 'cnaeSetores', help: t('lattes.tipo.ARTIGO_PERIODICO.campo.setores.help', 'Até 3 setores (lista CNAE).') },
        { key: 'outrasInfo', label: t('lattes.tipo.ARTIGO_PERIODICO.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
    ] },
    ARTIGO_ACEITO: { label: t('lattes.tipo.ARTIGO_ACEITO.label', 'Artigos aceitos para publicação'), fields: [
        F_DOI,
        F_TITULO, { ...F_ANO, label: t('lattes.tipo.ARTIGO_ACEITO.campo.ano.label', 'Ano previsto para publicação') }, F_IDIOMA,
        { key: 'relevante', label: t('lattes.tipo.ARTIGO_ACEITO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.ARTIGO_ACEITO.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        { key: 'periodico', label: t('lattes.tipo.ARTIGO_ACEITO.campo.periodico.label', 'Título do periódico/revista em que o artigo será publicado'), type: 'text', required: true },
        { key: 'issn', label: t('lattes.tipo.ARTIGO_ACEITO.campo.issn.label', 'ISSN'), type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'palavrasChave', label: t('lattes.tipo.ARTIGO_ACEITO.campo.palavras_chave.label', 'Palavras-chave'), type: 'textarea', placeholder: t('lattes.tipo.ARTIGO_ACEITO.campo.palavras_chave.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.ARTIGO_ACEITO.campo.palavras_chave.help', 'Até 6 palavras-chave (limite da Plataforma Lattes).') },
        { key: 'areaConhecimento', label: t('lattes.tipo.ARTIGO_ACEITO.campo.area_conhecimento.label', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', help: t('lattes.tipo.ARTIGO_ACEITO.campo.area_conhecimento.help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.') },
        { key: 'setores', label: t('lattes.tipo.ARTIGO_ACEITO.campo.setores.label', 'Setores de atividade'), type: 'cnaeSetores', help: t('lattes.tipo.ARTIGO_ACEITO.campo.setores.help', 'Até 3 setores (lista CNAE).') },
        { key: 'outrasInfo', label: t('lattes.tipo.ARTIGO_ACEITO.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
    ] },
    // Mantido apenas para compatibilidade com itens já catalogados (chave
    // legada); novos itens usam os 2 tipos específicos abaixo (Livros/Capítulos).
    LIVRO_CAPITULO: { label: t('lattes.tipo.LIVRO_CAPITULO.label', 'Livros e capítulos'), fields: [
        { key: 'tipoObra', label: t('lattes.tipo.LIVRO_CAPITULO.campo.tipo_obra.label', 'Tipo'), type: 'select', required: true, options: ['Livro publicado', 'Livro organizado', 'Capítulo de livro'] },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_AUTORES, { key: 'tituloLivro', label: t('lattes.tipo.LIVRO_CAPITULO.campo.titulo_livro.label', 'Título do livro (se capítulo)'), type: 'text' },
        { key: 'organizadores', label: t('lattes.tipo.LIVRO_CAPITULO.campo.organizadores.label', 'Organizadores'), type: 'text' }, { key: 'editora', label: t('lattes.tipo.LIVRO_CAPITULO.campo.editora.label', 'Editora'), type: 'text' },
        F_CIDADE, { key: 'isbn', label: t('lattes.tipo.LIVRO_CAPITULO.campo.isbn.label', 'ISBN'), type: 'text' }, { key: 'edicao', label: t('lattes.tipo.LIVRO_CAPITULO.campo.edicao.label', 'Edição'), type: 'text' },
        { key: 'paginas', label: t('lattes.tipo.LIVRO_CAPITULO.campo.paginas.label', 'Páginas'), type: 'text' }, F_IDIOMA, F_PAIS, F_URL] },
    LIVROS: { label: t('lattes.tipo.LIVROS.label', 'Livros'), fields: [
        F_DOI,
        { key: 'tipoObra', label: t('lattes.tipo.LIVROS.campo.tipo_obra.label', 'Tipo'), type: 'select', required: true, options: ['Livro publicado', 'Organização de obra publicada'] },
        { key: 'naturezaLivroPublicado', label: t('lattes.tipo.LIVROS.campo.natureza_livro_publicado.label', 'Natureza'), type: 'select', options: ['Coletânea', 'Texto Integral', 'Verbete', 'Outro'],
          disabledWhen: { field: 'tipoObra', notEquals: 'Livro publicado' } },
        { key: 'naturezaOrganizacao', label: t('lattes.tipo.LIVROS.campo.natureza_organizacao.label', 'Natureza'), type: 'select', options: ['Periódico', 'Outro', 'Livro', 'Anais', 'Catálogo', 'Coletânea', 'Enciclopédia'],
          disabledWhen: { field: 'tipoObra', notEquals: 'Organização de obra publicada' } },
        { key: 'titulo', label: t('lattes.tipo.LIVROS.campo.titulo.label', 'Título do livro'), type: 'text', required: true },
        { ...F_ANO, label: t('lattes.tipo.LIVROS.campo.ano.label', 'Ano') }, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.LIVROS.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: t('lattes.tipo.LIVROS.campo.url.label', 'Home page do trabalho (URL)'), type: 'url' },
        { key: 'relevante', label: t('lattes.tipo.LIVROS.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.LIVROS.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        { key: 'numeroVolumes', label: t('lattes.tipo.LIVROS.campo.numero_volumes.label', 'Número de volumes'), type: 'text' },
        { key: 'paginas', label: t('lattes.tipo.LIVROS.campo.paginas.label', 'Número de páginas'), type: 'text' },
        { key: 'isbn', label: t('lattes.tipo.LIVROS.campo.isbn.label', 'ISBN'), type: 'text' },
        { key: 'edicao', label: t('lattes.tipo.LIVROS.campo.edicao.label', 'Número da edição/revisão'), type: 'text' },
        { key: 'serie', label: t('lattes.tipo.LIVROS.campo.serie.label', 'Série'), type: 'text' },
        { key: 'cidade', label: t('lattes.tipo.LIVROS.campo.cidade.label', 'Cidade da editora'), type: 'text' },
        { key: 'editora', label: t('lattes.tipo.LIVROS.campo.editora.label', 'Nome da editora'), type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'palavrasChave', label: t('lattes.tipo.LIVROS.campo.palavras_chave.label', 'Palavras-chave'), type: 'textarea', placeholder: t('lattes.tipo.LIVROS.campo.palavras_chave.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.LIVROS.campo.palavras_chave.help', 'Até 6 palavras-chave (limite da Plataforma Lattes).') },
        { key: 'areaConhecimento', label: t('lattes.tipo.LIVROS.campo.area_conhecimento.label', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', help: t('lattes.tipo.LIVROS.campo.area_conhecimento.help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.') },
        { key: 'setores', label: t('lattes.tipo.LIVROS.campo.setores.label', 'Setores de atividade'), type: 'cnaeSetores', help: t('lattes.tipo.LIVROS.campo.setores.help', 'Até 3 setores (lista CNAE).') },
        { key: 'outrasInfo', label: t('lattes.tipo.LIVROS.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
    ] },
    CAPITULOS_LIVRO: { label: t('lattes.tipo.CAPITULOS_LIVRO.label', 'Capítulos'), fields: [
        F_DOI,
        { key: 'titulo', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.titulo.label', 'Título do capítulo'), type: 'text', required: true },
        { ...F_ANO, label: t('lattes.tipo.CAPITULOS_LIVRO.campo.ano.label', 'Ano') }, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.url.label', 'Home page do trabalho (URL)'), type: 'url' },
        { key: 'relevante', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        { key: 'tituloLivro', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.titulo_livro.label', 'Título do livro'), type: 'text' },
        { key: 'organizadores', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.organizadores.label', 'Organizadores'), type: 'text', help: t('lattes.tipo.CAPITULOS_LIVRO.campo.organizadores.help', 'Se houver mais de um organizador, informe os nomes separados por ponto e vírgula (;).') },
        { key: 'numeroVolumes', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.numero_volumes.label', 'Número do volume'), type: 'text' },
        { key: 'paginaInicial', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.pagina_inicial.label', 'Página inicial'), type: 'text' },
        { key: 'paginaFinal', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.pagina_final.label', 'Página final'), type: 'text' },
        { key: 'edicao', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.edicao.label', 'Número da edição/revisão'), type: 'text' },
        { key: 'serie', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.serie.label', 'Série'), type: 'text' },
        { key: 'isbn', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.isbn.label', 'ISBN'), type: 'text' },
        { key: 'cidade', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.cidade.label', 'Cidade da editora'), type: 'text' },
        { key: 'editora', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.editora.label', 'Nome da editora'), type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'palavrasChave', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.palavras_chave.label', 'Palavras-chave'), type: 'textarea', placeholder: t('lattes.tipo.CAPITULOS_LIVRO.campo.palavras_chave.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.CAPITULOS_LIVRO.campo.palavras_chave.help', 'Até 6 palavras-chave (limite da Plataforma Lattes).') },
        { key: 'areaConhecimento', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.area_conhecimento.label', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', help: t('lattes.tipo.CAPITULOS_LIVRO.campo.area_conhecimento.help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.') },
        { key: 'setores', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.setores.label', 'Setores de atividade'), type: 'cnaeSetores', help: t('lattes.tipo.CAPITULOS_LIVRO.campo.setores.help', 'Até 3 setores (lista CNAE).') },
        { key: 'outrasInfo', label: t('lattes.tipo.CAPITULOS_LIVRO.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
    ] },
    TEXTO_JORNAL: { label: t('lattes.tipo.TEXTO_JORNAL.label', 'Texto em jornal ou revista (magazine)'), fields: [
        { key: 'natureza', label: t('lattes.tipo.TEXTO_JORNAL.campo.natureza.label', 'Natureza'), type: 'select', options: ['Jornal de notícias', 'Revista (Magazine)'] },
        F_TITULO, { ...F_ANO, label: t('lattes.tipo.TEXTO_JORNAL.campo.ano.label', 'Ano') },
        { key: 'pais', label: t('lattes.tipo.TEXTO_JORNAL.campo.pais.label', 'País da publicação'), type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' }, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.TEXTO_JORNAL.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: t('lattes.tipo.TEXTO_JORNAL.campo.url.label', 'Home page do trabalho (URL)'), type: 'url' },
        { key: 'relevante', label: t('lattes.tipo.TEXTO_JORNAL.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.TEXTO_JORNAL.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        { key: 'veiculo', label: t('lattes.tipo.TEXTO_JORNAL.campo.veiculo.label', 'Título do jornal/revista em que o texto foi publicado'), type: 'text', required: true },
        { key: 'issn', label: t('lattes.tipo.TEXTO_JORNAL.campo.issn.label', 'ISSN'), type: 'text' },
        { key: 'data', label: t('lattes.tipo.TEXTO_JORNAL.campo.data.label', 'Data de publicação'), type: 'date' },
        { key: 'volume', label: t('lattes.tipo.TEXTO_JORNAL.campo.volume.label', 'Volume'), type: 'text' },
        { key: 'paginaInicial', label: t('lattes.tipo.TEXTO_JORNAL.campo.pagina_inicial.label', 'Página inicial'), type: 'text' },
        { key: 'paginaFinal', label: t('lattes.tipo.TEXTO_JORNAL.campo.pagina_final.label', 'Página final'), type: 'text' },
        { key: 'cidade', label: t('lattes.tipo.TEXTO_JORNAL.campo.cidade.label', 'Local de publicação'), type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'palavrasChave', label: t('lattes.tipo.TEXTO_JORNAL.campo.palavras_chave.label', 'Palavras-chave'), type: 'textarea', placeholder: t('lattes.tipo.TEXTO_JORNAL.campo.palavras_chave.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.TEXTO_JORNAL.campo.palavras_chave.help', 'Até 6 palavras-chave (limite da Plataforma Lattes).') },
        { key: 'areaConhecimento', label: t('lattes.tipo.TEXTO_JORNAL.campo.area_conhecimento.label', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', help: t('lattes.tipo.TEXTO_JORNAL.campo.area_conhecimento.help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.') },
        { key: 'setores', label: t('lattes.tipo.TEXTO_JORNAL.campo.setores.label', 'Setores de atividade'), type: 'cnaeSetores', help: t('lattes.tipo.TEXTO_JORNAL.campo.setores.help', 'Até 3 setores (lista CNAE).') },
        { key: 'outrasInfo', label: t('lattes.tipo.TEXTO_JORNAL.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
    ] },
    TRABALHO_EVENTO: { label: t('lattes.tipo.TRABALHO_EVENTO.label', 'Trabalhos publicados em anais de eventos'), fields: [
        F_DOI,
        F_NATUREZA(['Completo', 'Resumo', 'Resumo expandido']),
        F_TITULO, { ...F_ANO, label: t('lattes.tipo.TRABALHO_EVENTO.campo.ano.label', 'Ano') },
        { key: 'pais', label: t('lattes.tipo.TRABALHO_EVENTO.campo.pais.label', 'País de publicação'), type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' }, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.TRABALHO_EVENTO.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: t('lattes.tipo.TRABALHO_EVENTO.campo.url.label', 'Home page do trabalho (URL)'), type: 'url' },
        { key: 'relevante', label: t('lattes.tipo.TRABALHO_EVENTO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.TRABALHO_EVENTO.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        { key: 'classificacaoEvento', label: t('lattes.tipo.TRABALHO_EVENTO.campo.classificacao_evento.label', 'Classificação do evento'), type: 'select', options: ['Internacional', 'Nacional', 'Regional', 'Local'] },
        { key: 'evento', label: t('lattes.tipo.TRABALHO_EVENTO.campo.evento.label', 'Nome do evento'), type: 'text', required: true },
        F_CIDADE,
        { key: 'anoEvento', label: t('lattes.tipo.TRABALHO_EVENTO.campo.ano_evento.label', 'Ano do evento'), type: 'datebr' },
        { key: 'anais', label: t('lattes.tipo.TRABALHO_EVENTO.campo.anais.label', 'Título dos anais do evento'), type: 'text' },
        { key: 'volume', label: t('lattes.tipo.TRABALHO_EVENTO.campo.volume.label', 'Volume'), type: 'text' },
        { key: 'fasciculo', label: t('lattes.tipo.TRABALHO_EVENTO.campo.fasciculo.label', 'Fascículo'), type: 'text' },
        { key: 'serie', label: t('lattes.tipo.TRABALHO_EVENTO.campo.serie.label', 'Série'), type: 'text' },
        { key: 'paginaInicial', label: t('lattes.tipo.TRABALHO_EVENTO.campo.pagina_inicial.label', 'Página inicial'), type: 'text' },
        { key: 'paginaFinal', label: t('lattes.tipo.TRABALHO_EVENTO.campo.pagina_final.label', 'Página final'), type: 'text' },
        { key: 'isbn', label: t('lattes.tipo.TRABALHO_EVENTO.campo.isbn.label', 'ISBN/ISSN'), type: 'text', validate: 'isbnIssn', placeholder: t('lattes.tipo.TRABALHO_EVENTO.campo.isbn.placeholder', 'ISBN-10, ISBN-13 ou ISSN') },
        { key: 'editora', label: t('lattes.tipo.TRABALHO_EVENTO.campo.editora.label', 'Nome da editora'), type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'palavrasChave', label: t('lattes.tipo.TRABALHO_EVENTO.campo.palavras_chave.label', 'Palavras-chave'), type: 'textarea', placeholder: t('lattes.tipo.TRABALHO_EVENTO.campo.palavras_chave.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.TRABALHO_EVENTO.campo.palavras_chave.help', 'Até 6 palavras-chave (limite da Plataforma Lattes).') },
        { key: 'areaConhecimento', label: t('lattes.tipo.TRABALHO_EVENTO.campo.area_conhecimento.label', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', help: t('lattes.tipo.TRABALHO_EVENTO.campo.area_conhecimento.help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.') },
        { key: 'setores', label: t('lattes.tipo.TRABALHO_EVENTO.campo.setores.label', 'Setores de atividade'), type: 'cnaeSetores', help: t('lattes.tipo.TRABALHO_EVENTO.campo.setores.help', 'Até 3 setores (lista CNAE).') },
        { key: 'outrasInfo', label: t('lattes.tipo.TRABALHO_EVENTO.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
    ] },
    APRESENTACAO: { label: t('lattes.tipo.APRESENTACAO.label', 'Apresentação de trabalho e palestra'), fields: [
        F_DOI,
        F_NATUREZA(['Comunicação', 'Conferência ou palestra', 'Congresso', 'Seminário', 'Simpósio', 'Outra']),
        F_TITULO, { ...F_ANO, label: t('lattes.tipo.APRESENTACAO.campo.ano.label', 'Ano') },
        { key: 'pais', label: t('lattes.tipo.APRESENTACAO.campo.pais.label', 'País de publicação'), type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' }, F_IDIOMA,
        // Meio de divulgação/Home page aparecem na tela do Lattes para este
        // tipo, mas o schema de exportação offline (docs/CurriculoLattes.xsd)
        // não tem atributo correspondente em DADOS-BASICOS-DA-APRESENTACAO-DE-
        // TRABALHO — ficam só para registro, não são exportados no XML.
        { key: 'meioDivulgacao', label: t('lattes.tipo.APRESENTACAO.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: t('lattes.tipo.APRESENTACAO.campo.url.label', 'Home page do trabalho (URL)'), type: 'url' },
        { key: 'relevante', label: t('lattes.tipo.APRESENTACAO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.APRESENTACAO.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        { key: 'evento', label: t('lattes.tipo.APRESENTACAO.campo.evento.label', 'Nome do evento'), type: 'text' },
        { key: 'instituicao', label: t('lattes.tipo.APRESENTACAO.campo.instituicao.label', 'Instituição promotora'), type: 'text' },
        { key: 'local', label: t('lattes.tipo.APRESENTACAO.campo.local.label', 'Local'), type: 'text' },
        F_CIDADE,
        PROD_AUTORES_LISTA,
        { key: 'palavrasChave', label: t('lattes.tipo.APRESENTACAO.campo.palavras_chave.label', 'Palavras-chave'), type: 'textarea', placeholder: t('lattes.tipo.APRESENTACAO.campo.palavras_chave.placeholder', 'Separe por ponto e vírgula (;)'), help: t('lattes.tipo.APRESENTACAO.campo.palavras_chave.help', 'Até 6 palavras-chave (limite da Plataforma Lattes).') },
        { key: 'areaConhecimento', label: t('lattes.tipo.APRESENTACAO.campo.area_conhecimento.label', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', help: t('lattes.tipo.APRESENTACAO.campo.area_conhecimento.help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.') },
        { key: 'setores', label: t('lattes.tipo.APRESENTACAO.campo.setores.label', 'Setores de atividade'), type: 'cnaeSetores', help: t('lattes.tipo.APRESENTACAO.campo.setores.help', 'Até 3 setores (lista CNAE).') },
        { key: 'outrasInfo', label: t('lattes.tipo.APRESENTACAO.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
    ] },
    PARTITURA: { label: t('lattes.tipo.PARTITURA.label', 'Partitura musical'), fields: [
        F_TITULO, F_ANO, F_NATUREZA(['Canto', 'Coral', 'Orquestra', 'Outro']), F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.PARTITURA.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.PARTITURA.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'formacao', label: t('lattes.tipo.PARTITURA.campo.formacao.label', 'Formação instrumental'), type: 'text' },
        { key: 'editora', label: t('lattes.tipo.PARTITURA.campo.editora.label', 'Editora'), type: 'text' }, { key: 'cidade', label: t('lattes.tipo.PARTITURA.campo.cidade.label', 'Cidade da editora'), type: 'text' },
        { key: 'paginas', label: t('lattes.tipo.PARTITURA.campo.paginas.label', 'Número de páginas'), type: 'text' }, { key: 'numeroCatalogo', label: t('lattes.tipo.PARTITURA.campo.numero_catalogo.label', 'Número do catálogo'), type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    TRADUCAO: { label: t('lattes.tipo.TRADUCAO.label', 'Tradução'), fields: [
        F_TITULO, F_ANO, F_NATUREZA(['Livro', 'Artigo', 'Outro']), F_PAIS,
        { key: 'idioma', label: t('lattes.tipo.TRADUCAO.campo.idioma.label', 'Idioma da tradução'), type: 'select', options: window.IDIOMAS_LATTES || [] },
        { key: 'meioDivulgacao', label: t('lattes.tipo.TRADUCAO.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.TRADUCAO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'autorOriginal', label: t('lattes.tipo.TRADUCAO.campo.autor_original.label', 'Autor da obra original'), type: 'text' },
        { key: 'obraOriginal', label: t('lattes.tipo.TRADUCAO.campo.obra_original.label', 'Título da obra original'), type: 'text' },
        { key: 'issnIsbn', label: t('lattes.tipo.TRADUCAO.campo.issn_isbn.label', 'ISSN/ISBN'), type: 'text' },
        { key: 'idiomaOriginal', label: t('lattes.tipo.TRADUCAO.campo.idioma_original.label', 'Idioma original'), type: 'select', options: window.IDIOMAS_LATTES || [] },
        { key: 'editora', label: t('lattes.tipo.TRADUCAO.campo.editora.label', 'Editora da tradução'), type: 'text' }, { key: 'cidade', label: t('lattes.tipo.TRADUCAO.campo.cidade.label', 'Cidade da editora'), type: 'text' },
        { key: 'edicao', label: t('lattes.tipo.TRADUCAO.campo.edicao.label', 'No. edição ou revisão'), type: 'text' }, { key: 'paginas', label: t('lattes.tipo.TRADUCAO.campo.paginas.label', 'Número de páginas'), type: 'text' },
        { key: 'volume', label: t('lattes.tipo.TRADUCAO.campo.volume.label', 'Volume'), type: 'text' }, { key: 'fasciculo', label: t('lattes.tipo.TRADUCAO.campo.fasciculo.label', 'Fascículo'), type: 'text' }, { key: 'serie', label: t('lattes.tipo.TRADUCAO.campo.serie.label', 'Série'), type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    PREFACIO: { label: t('lattes.tipo.PREFACIO.label', 'Prefácio, posfácio'), fields: [
        { key: 'natureza', label: t('lattes.tipo.PREFACIO.campo.natureza.label', 'Tipo'), type: 'select', options: ['Prefácio', 'Posfácio', 'Apresentação', 'Introdução'] },
        // "Natureza" real do schema (LIVRO/OUTRA/REVISTAS_OU_PERIODICOS) — não
        // confundir com o campo acima ("Tipo" na tela real, mas guardado na
        // chave `natureza` por herdar o átomo F_NATUREZA original).
        { key: 'naturezaObra', label: t('lattes.tipo.PREFACIO.campo.natureza_obra.label', 'Natureza'), type: 'select', options: ['Livro', 'Revistas ou periódicos', 'Outra'] },
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.PREFACIO.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.PREFACIO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'autorPublicacao', label: t('lattes.tipo.PREFACIO.campo.autor_publicacao.label', 'Autor da publicação'), type: 'text' },
        { key: 'obra', label: t('lattes.tipo.PREFACIO.campo.obra.label', 'Título da publicação'), type: 'text' },
        { key: 'issnIsbn', label: t('lattes.tipo.PREFACIO.campo.issn_isbn.label', 'ISSN/ISBN'), type: 'text' },
        { key: 'editora', label: t('lattes.tipo.PREFACIO.campo.editora.label', 'Editora'), type: 'text' }, { key: 'cidade', label: t('lattes.tipo.PREFACIO.campo.cidade.label', 'Cidade da editora'), type: 'text' },
        { key: 'edicao', label: t('lattes.tipo.PREFACIO.campo.edicao.label', 'No. edição ou revisão'), type: 'text' },
        // "Número de páginas" existe na tela real (doc), mas o schema oficial
        // não tem atributo para isso em DETALHAMENTO-DO-PREFACIO-POSFACIO —
        // fica só de uso interno, não é exportado no XML.
        { key: 'paginas', label: t('lattes.tipo.PREFACIO.campo.paginas.label', 'Número de páginas'), type: 'text' },
        { key: 'volume', label: t('lattes.tipo.PREFACIO.campo.volume.label', 'Volume'), type: 'text' }, { key: 'fasciculo', label: t('lattes.tipo.PREFACIO.campo.fasciculo.label', 'Fascículo'), type: 'text' }, { key: 'serie', label: t('lattes.tipo.PREFACIO.campo.serie.label', 'Série'), type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    OUTRA_BIBLIOGRAFICA: { label: t('lattes.tipo.OUTRA_BIBLIOGRAFICA.label', 'Outra produção bibliográfica'), fields: [
        { key: 'natureza', label: t('lattes.tipo.OUTRA_BIBLIOGRAFICA.campo.natureza.label', 'Natureza'), type: 'text' },
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.OUTRA_BIBLIOGRAFICA.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.OUTRA_BIBLIOGRAFICA.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.OUTRA_BIBLIOGRAFICA.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'editora', label: t('lattes.tipo.OUTRA_BIBLIOGRAFICA.campo.editora.label', 'Editora'), type: 'text' }, { key: 'cidade', label: t('lattes.tipo.OUTRA_BIBLIOGRAFICA.campo.cidade.label', 'Cidade da editora'), type: 'text' },
        { key: 'paginas', label: t('lattes.tipo.OUTRA_BIBLIOGRAFICA.campo.paginas.label', 'Número de páginas'), type: 'text' }, { key: 'issnIsbn', label: t('lattes.tipo.OUTRA_BIBLIOGRAFICA.campo.issn_isbn.label', 'ISSN/ISBN'), type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
};
