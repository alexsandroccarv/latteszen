/* ==========================================================================
   lattesZen — Definições dos tipos de item do Currículo Lattes
   --------------------------------------------------------------------------
   Cada tipo espelha um item do Lattes e declara os campos (metadados) que
   deverão ser preenchidos ao catalogar. Estrutura extensível: para adicionar
   um novo tipo, basta incluí-lo em LATTES_CATEGORIES.

   Campo: { key, label, type, required?, options?, placeholder?, help? }
   type: 'text' | 'textarea' | 'number' | 'year' | 'date' | 'url' | 'select'
   ========================================================================== */

// Campos comuns a praticamente todo item
const F_TITULO = { key: 'titulo', label: 'Título', type: 'text', required: true };
const F_ANO    = { key: 'ano', label: 'Ano', type: 'year', required: true, placeholder: 'AAAA' };
const F_DOI    = { key: 'doi', label: 'DOI', type: 'text', placeholder: '10.xxxx/xxxxx' };
const F_URL    = { key: 'url', label: 'URL / Link', type: 'url' };
const F_AUTORES = { key: 'autores', label: 'Autores', type: 'textarea', placeholder: 'Separe os autores por ponto e vírgula (;)' };
const F_NATUREZA = (options) => ({ key: 'natureza', label: 'Natureza', type: 'select', options });

window.LATTES_CATEGORIES = [
    {
        key: 'PRODUCAO_BIBLIOGRAFICA',
        label: 'Produção Bibliográfica',
        icon: 'fa-book',
        types: [
            {
                key: 'ARTIGO_PERIODICO', label: 'Artigo publicado em periódico',
                fields: [
                    F_TITULO, F_ANO, F_AUTORES,
                    { key: 'periodico', label: 'Periódico / Revista', type: 'text', required: true },
                    { key: 'issn', label: 'ISSN', type: 'text' },
                    { key: 'volume', label: 'Volume', type: 'text' },
                    { key: 'fasciculo', label: 'Fascículo / Número', type: 'text' },
                    { key: 'paginas', label: 'Páginas (ini-fim)', type: 'text', placeholder: 'ex.: 120-135' },
                    F_DOI, F_URL,
                ],
            },
            {
                key: 'LIVRO', label: 'Livro publicado ou organizado',
                fields: [
                    F_TITULO, F_ANO, F_AUTORES,
                    F_NATUREZA(['Livro publicado', 'Livro organizado']),
                    { key: 'editora', label: 'Editora', type: 'text', required: true },
                    { key: 'cidade', label: 'Cidade da editora', type: 'text' },
                    { key: 'isbn', label: 'ISBN', type: 'text' },
                    { key: 'edicao', label: 'Edição', type: 'text' },
                    { key: 'paginas', label: 'Nº de páginas', type: 'text' },
                    F_URL,
                ],
            },
            {
                key: 'CAPITULO_LIVRO', label: 'Capítulo de livro publicado',
                fields: [
                    F_TITULO, F_ANO, F_AUTORES,
                    { key: 'tituloLivro', label: 'Título do livro', type: 'text', required: true },
                    { key: 'organizadores', label: 'Organizadores do livro', type: 'text' },
                    { key: 'editora', label: 'Editora', type: 'text' },
                    { key: 'isbn', label: 'ISBN', type: 'text' },
                    { key: 'paginas', label: 'Páginas do capítulo', type: 'text', placeholder: 'ex.: 45-60' },
                    F_URL,
                ],
            },
            {
                key: 'TRABALHO_EVENTO', label: 'Trabalho completo/resumo em evento',
                fields: [
                    F_TITULO, F_ANO, F_AUTORES,
                    F_NATUREZA(['Completo', 'Resumo expandido', 'Resumo']),
                    { key: 'evento', label: 'Nome do evento', type: 'text', required: true },
                    { key: 'anais', label: 'Título dos anais / proceedings', type: 'text' },
                    { key: 'cidade', label: 'Cidade do evento', type: 'text' },
                    { key: 'paginas', label: 'Páginas', type: 'text' },
                    F_DOI, F_URL,
                ],
            },
            {
                key: 'TEXTO_JORNAL', label: 'Texto em jornal ou revista (magazine)',
                fields: [
                    F_TITULO, F_ANO, F_AUTORES,
                    { key: 'veiculo', label: 'Jornal / Revista', type: 'text', required: true },
                    { key: 'data', label: 'Data de publicação', type: 'date' },
                    { key: 'paginas', label: 'Páginas', type: 'text' },
                    F_URL,
                ],
            },
        ],
    },
    {
        key: 'PRODUCAO_TECNICA',
        label: 'Produção Técnica',
        icon: 'fa-screwdriver-wrench',
        types: [
            {
                key: 'SOFTWARE', label: 'Software / Programa de computador',
                fields: [
                    F_TITULO, F_ANO, F_AUTORES,
                    { key: 'plataforma', label: 'Plataforma / Ambiente', type: 'text' },
                    { key: 'finalidade', label: 'Finalidade', type: 'textarea' },
                    { key: 'registro', label: 'Registro / Patente (se houver)', type: 'text' },
                    F_URL,
                ],
            },
            {
                key: 'TRABALHO_TECNICO', label: 'Trabalho técnico / Consultoria / Parecer',
                fields: [
                    F_TITULO, F_ANO,
                    F_NATUREZA(['Assessoria', 'Consultoria', 'Parecer', 'Elaboração de projeto', 'Relatório técnico', 'Outra']),
                    { key: 'instituicao', label: 'Instituição/Empresa financiadora ou solicitante', type: 'text' },
                    { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' },
                    F_URL,
                ],
            },
            {
                key: 'APRESENTACAO', label: 'Apresentação de trabalho / Palestra',
                fields: [
                    F_TITULO, F_ANO,
                    F_NATUREZA(['Congresso', 'Seminário', 'Simpósio', 'Conferência ou palestra', 'Comunicação', 'Outra']),
                    { key: 'evento', label: 'Nome do evento', type: 'text' },
                    { key: 'cidade', label: 'Cidade', type: 'text' },
                    F_URL,
                ],
            },
            {
                key: 'CURSO_MINISTRADO', label: 'Curso de curta duração ministrado',
                fields: [
                    F_TITULO, F_ANO,
                    { key: 'instituicao', label: 'Instituição promotora', type: 'text' },
                    { key: 'cargaHoraria', label: 'Carga horária (h)', type: 'number' },
                    { key: 'nivel', label: 'Nível', type: 'select', options: ['Aperfeiçoamento', 'Extensão', 'Especialização', 'Outro'] },
                    F_URL,
                ],
            },
            {
                key: 'MATERIAL_DIDATICO', label: 'Material didático ou instrucional',
                fields: [
                    F_TITULO, F_ANO, F_AUTORES,
                    { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' },
                    F_URL,
                ],
            },
            {
                key: 'PRODUTO_TECNOLOGICO', label: 'Produto tecnológico',
                fields: [
                    F_TITULO, F_ANO, F_AUTORES,
                    { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' },
                    { key: 'registro', label: 'Registro / Patente (se houver)', type: 'text' },
                    F_URL,
                ],
            },
        ],
    },
    {
        key: 'FORMACAO',
        label: 'Formação',
        icon: 'fa-user-graduate',
        types: [
            {
                key: 'FORMACAO_ACADEMICA', label: 'Formação acadêmica / titulação',
                fields: [
                    { key: 'nivel', label: 'Nível', type: 'select', required: true,
                      options: ['Graduação', 'Especialização', 'Mestrado', 'Doutorado', 'Pós-Doutorado', 'Livre-docência'] },
                    { key: 'curso', label: 'Curso / Área', type: 'text', required: true },
                    { key: 'instituicao', label: 'Instituição', type: 'text', required: true },
                    { key: 'anoInicio', label: 'Ano de início', type: 'year' },
                    { key: 'anoFim', label: 'Ano de conclusão', type: 'year' },
                    { key: 'titulo', label: 'Título do trabalho (TCC/dissertação/tese)', type: 'text' },
                    { key: 'orientador', label: 'Orientador(a)', type: 'text' },
                ],
            },
            {
                key: 'FORMACAO_COMPLEMENTAR', label: 'Formação complementar / curso',
                fields: [
                    F_TITULO, F_ANO,
                    { key: 'instituicao', label: 'Instituição', type: 'text' },
                    { key: 'cargaHoraria', label: 'Carga horária (h)', type: 'number' },
                    F_URL,
                ],
            },
        ],
    },
    {
        key: 'ATUACAO',
        label: 'Atuação Profissional e Projetos',
        icon: 'fa-briefcase',
        types: [
            {
                key: 'VINCULO_PROFISSIONAL', label: 'Vínculo / atuação profissional',
                fields: [
                    { key: 'instituicao', label: 'Instituição / Empresa', type: 'text', required: true },
                    { key: 'vinculo', label: 'Tipo de vínculo', type: 'text' },
                    { key: 'cargo', label: 'Cargo / Função', type: 'text' },
                    { key: 'anoInicio', label: 'Ano de início', type: 'year', required: true },
                    { key: 'anoFim', label: 'Ano de fim (vazio = atual)', type: 'year' },
                    { key: 'titulo', label: 'Descrição das atividades', type: 'textarea' },
                ],
            },
            {
                key: 'PROJETO_PESQUISA', label: 'Projeto de pesquisa / extensão',
                fields: [
                    F_TITULO,
                    { key: 'anoInicio', label: 'Ano de início', type: 'year', required: true },
                    { key: 'anoFim', label: 'Ano de fim (vazio = em andamento)', type: 'year' },
                    { key: 'situacao', label: 'Situação', type: 'select', options: ['Em andamento', 'Concluído', 'Desativado'] },
                    { key: 'natureza', label: 'Natureza', type: 'select', options: ['Pesquisa', 'Extensão', 'Desenvolvimento', 'Ensino', 'Outra'] },
                    { key: 'financiador', label: 'Financiador / Agência', type: 'text' },
                    { key: 'descricao', label: 'Descrição', type: 'textarea' },
                ],
            },
        ],
    },
    {
        key: 'ORIENTACOES',
        label: 'Orientações',
        icon: 'fa-chalkboard-user',
        types: [
            {
                key: 'ORIENTACAO', label: 'Orientação / Supervisão',
                fields: [
                    { key: 'orientando', label: 'Nome do orientando(a)', type: 'text', required: true },
                    { key: 'tipo', label: 'Tipo', type: 'select', required: true,
                      options: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Mestrado', 'Doutorado', 'Pós-Doutorado', 'Outra'] },
                    { key: 'situacao', label: 'Situação', type: 'select', options: ['Em andamento', 'Concluída'] },
                    { key: 'titulo', label: 'Título do trabalho', type: 'text' },
                    { key: 'instituicao', label: 'Instituição', type: 'text' },
                    F_ANO,
                ],
            },
        ],
    },
    {
        key: 'BANCAS_EVENTOS',
        label: 'Bancas, Eventos e Prêmios',
        icon: 'fa-award',
        types: [
            {
                key: 'BANCA', label: 'Participação em banca',
                fields: [
                    { key: 'tipo', label: 'Tipo de banca', type: 'select', required: true,
                      options: ['Mestrado', 'Doutorado', 'Qualificação', 'TCC / Graduação', 'Concurso público', 'Comissão julgadora', 'Outra'] },
                    { key: 'candidato', label: 'Candidato(a) / Trabalho', type: 'text' },
                    { key: 'titulo', label: 'Título do trabalho avaliado', type: 'text' },
                    { key: 'instituicao', label: 'Instituição', type: 'text' },
                    F_ANO,
                ],
            },
            {
                key: 'PARTICIPACAO_EVENTO', label: 'Participação / organização de evento',
                fields: [
                    F_TITULO, F_ANO,
                    F_NATUREZA(['Participação', 'Organização']),
                    { key: 'tipoEvento', label: 'Tipo', type: 'select', options: ['Congresso', 'Simpósio', 'Seminário', 'Encontro', 'Oficina', 'Outro'] },
                    { key: 'cidade', label: 'Cidade', type: 'text' },
                    F_URL,
                ],
            },
            {
                key: 'PREMIO', label: 'Prêmio ou título',
                fields: [
                    F_TITULO, F_ANO,
                    { key: 'entidade', label: 'Entidade promotora', type: 'text', required: true },
                    { key: 'descricao', label: 'Descrição', type: 'textarea' },
                ],
            },
        ],
    },
];

/* --------------------------------------------------------------------------
   Categoria especial: itens NÃO LATTES (hobbies, atividades pessoais, etc.)
   -------------------------------------------------------------------------- */
window.NAO_LATTES_TYPE = {
    key: 'NAO_LATTES',
    label: 'Item não-Lattes (pessoal)',
    fields: [
        F_TITULO,
        { key: 'categoria', label: 'Categoria', type: 'select',
          options: ['Hobby', 'Atividade pessoal', 'Voluntariado', 'Certificado avulso', 'Curso livre', 'Outro'] },
        F_ANO,
        { key: 'descricao', label: 'Descrição', type: 'textarea' },
        F_URL,
    ],
};

/* --------------------------------------------------------------------------
   Índices auxiliares para busca rápida por chave de tipo
   -------------------------------------------------------------------------- */
window.LattesTypes = (function () {
    const byKey = {};
    LATTES_CATEGORIES.forEach(cat => {
        cat.types.forEach(t => {
            byKey[t.key] = { ...t, categoryKey: cat.key, categoryLabel: cat.label, categoryIcon: cat.icon };
        });
    });
    byKey[NAO_LATTES_TYPE.key] = { ...NAO_LATTES_TYPE, categoryKey: 'NAO_LATTES', categoryLabel: 'Não-Lattes', categoryIcon: 'fa-heart' };

    return {
        categories: LATTES_CATEGORIES,
        naoLattes: NAO_LATTES_TYPE,
        get(typeKey) { return byKey[typeKey] || null; },
        label(typeKey) { return byKey[typeKey] ? byKey[typeKey].label : typeKey; },
        // Rótulo curto e legível para um item (usado em listas/relatórios)
        itemTitle(item) {
            const f = item.fields || {};
            return f.titulo || f.curso || f.orientando || f.candidato || f.instituicao || '(sem título)';
        },
    };
})();
