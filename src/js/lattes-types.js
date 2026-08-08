/* ==========================================================================
   lattesZen — Definições dos tipos de item do Currículo Lattes
   --------------------------------------------------------------------------
   As CATEGORIAS espelham o menu superior da Plataforma Lattes:
   Dados gerais · Formação · Atuação · Projetos · Produções ·
   Patentes e Registros · Inovação · Educação e Popularização de C&T ·
   Eventos · Orientações · Bancas.

   Cada tipo declara os campos (metadados) preenchidos ao catalogar.
   Campo: { key, label, type, required?, options?, placeholder?, help? }
   type: 'text' | 'textarea' | 'number' | 'year' | 'date' | 'url' | 'select'
   ========================================================================== */

// Campos reutilizados
const F_TITULO  = { key: 'titulo', label: 'Título', type: 'text', required: true };
const F_ANO     = { key: 'ano', label: 'Ano', type: 'year', required: true, placeholder: 'AAAA' };
const F_DOI     = { key: 'doi', label: 'DOI', type: 'text', placeholder: '10.xxxx/xxxxx' };
const F_URL     = { key: 'url', label: 'URL / Link', type: 'url' };
const F_AUTORES = { key: 'autores', label: 'Autores', type: 'textarea', placeholder: 'Separe os autores por ponto e vírgula (;)' };
const F_NATUREZA = (options) => ({ key: 'natureza', label: 'Natureza', type: 'select', options });

/* ---- Tipos, agrupados por categoria do menu Lattes ---- */
const T = {
    PREMIO: {
        key: 'PREMIO', label: 'Prêmio ou título',
        fields: [F_TITULO, F_ANO,
            { key: 'entidade', label: 'Entidade promotora', type: 'text', required: true },
            { key: 'descricao', label: 'Descrição', type: 'textarea' }],
    },
    FORMACAO_ACADEMICA: {
        key: 'FORMACAO_ACADEMICA', label: 'Formação acadêmica / titulação',
        fields: [
            { key: 'nivel', label: 'Nível', type: 'select', required: true,
              options: ['Graduação', 'Aperfeiçoamento', 'Especialização', 'Mestrado', 'Doutorado', 'Pós-Doutorado', 'Livre-docência', 'Residência médica'] },
            { key: 'curso', label: 'Curso / Área', type: 'text', required: true },
            { key: 'instituicao', label: 'Instituição', type: 'text', required: true },
            { key: 'anoInicio', label: 'Ano de início', type: 'year' },
            { key: 'anoFim', label: 'Ano de conclusão', type: 'year' },
            { key: 'titulo', label: 'Título do trabalho (TCC/dissertação/tese)', type: 'text' },
            { key: 'orientador', label: 'Orientador(a)', type: 'text' },
        ],
    },
    FORMACAO_COMPLEMENTAR: {
        key: 'FORMACAO_COMPLEMENTAR', label: 'Formação complementar / curso',
        fields: [F_TITULO, F_ANO,
            { key: 'instituicao', label: 'Instituição', type: 'text' },
            { key: 'cargaHoraria', label: 'Carga horária (h)', type: 'number' }, F_URL],
    },
    VINCULO_PROFISSIONAL: {
        key: 'VINCULO_PROFISSIONAL', label: 'Vínculo / atuação profissional',
        fields: [
            { key: 'instituicao', label: 'Instituição / Empresa', type: 'text', required: true },
            { key: 'vinculo', label: 'Tipo de vínculo', type: 'text' },
            { key: 'cargo', label: 'Cargo / Função', type: 'text' },
            { key: 'anoInicio', label: 'Ano de início', type: 'year' },
            { key: 'anoFim', label: 'Ano de fim (vazio = atual)', type: 'year' },
            { key: 'titulo', label: 'Descrição das atividades', type: 'textarea' },
        ],
    },
    PROJETO_PESQUISA: {
        key: 'PROJETO_PESQUISA', label: 'Projeto de pesquisa / extensão',
        fields: [F_TITULO,
            { key: 'anoInicio', label: 'Ano de início', type: 'year', required: true },
            { key: 'anoFim', label: 'Ano de fim (vazio = em andamento)', type: 'year' },
            { key: 'situacao', label: 'Situação', type: 'select', options: ['Em andamento', 'Concluído', 'Desativado'] },
            { key: 'natureza', label: 'Natureza', type: 'select', options: ['Pesquisa', 'Extensão', 'Desenvolvimento', 'Ensino', 'Outra'] },
            { key: 'financiador', label: 'Financiador / Agência', type: 'text' },
            { key: 'descricao', label: 'Descrição', type: 'textarea' }],
    },
    ARTIGO_PERIODICO: {
        key: 'ARTIGO_PERIODICO', label: 'Artigo publicado em periódico',
        fields: [F_TITULO, F_ANO, F_AUTORES,
            { key: 'periodico', label: 'Periódico / Revista', type: 'text', required: true },
            { key: 'issn', label: 'ISSN', type: 'text' },
            { key: 'volume', label: 'Volume', type: 'text' },
            { key: 'fasciculo', label: 'Fascículo / Número', type: 'text' },
            { key: 'paginas', label: 'Páginas (ini-fim)', type: 'text', placeholder: 'ex.: 120-135' },
            F_DOI, F_URL],
    },
    LIVRO: {
        key: 'LIVRO', label: 'Livro publicado ou organizado',
        fields: [F_TITULO, F_ANO, F_AUTORES, F_NATUREZA(['Livro publicado', 'Livro organizado']),
            { key: 'editora', label: 'Editora', type: 'text', required: true },
            { key: 'cidade', label: 'Cidade da editora', type: 'text' },
            { key: 'isbn', label: 'ISBN', type: 'text' },
            { key: 'edicao', label: 'Edição', type: 'text' },
            { key: 'paginas', label: 'Nº de páginas', type: 'text' }, F_URL],
    },
    CAPITULO_LIVRO: {
        key: 'CAPITULO_LIVRO', label: 'Capítulo de livro publicado',
        fields: [F_TITULO, F_ANO, F_AUTORES,
            { key: 'tituloLivro', label: 'Título do livro', type: 'text', required: true },
            { key: 'organizadores', label: 'Organizadores do livro', type: 'text' },
            { key: 'editora', label: 'Editora', type: 'text' },
            { key: 'isbn', label: 'ISBN', type: 'text' },
            { key: 'paginas', label: 'Páginas do capítulo', type: 'text', placeholder: 'ex.: 45-60' }, F_URL],
    },
    TRABALHO_EVENTO: {
        key: 'TRABALHO_EVENTO', label: 'Trabalho completo/resumo em evento',
        fields: [F_TITULO, F_ANO, F_AUTORES, F_NATUREZA(['Completo', 'Resumo expandido', 'Resumo']),
            { key: 'evento', label: 'Nome do evento', type: 'text', required: true },
            { key: 'anais', label: 'Título dos anais / proceedings', type: 'text' },
            { key: 'cidade', label: 'Cidade do evento', type: 'text' },
            { key: 'paginas', label: 'Páginas', type: 'text' }, F_DOI, F_URL],
    },
    TEXTO_JORNAL: {
        key: 'TEXTO_JORNAL', label: 'Texto em jornal ou revista',
        fields: [F_TITULO, F_ANO, F_AUTORES,
            { key: 'veiculo', label: 'Jornal / Revista', type: 'text', required: true },
            { key: 'data', label: 'Data de publicação', type: 'date' },
            { key: 'paginas', label: 'Páginas', type: 'text' }, F_URL],
    },
    TRABALHO_TECNICO: {
        key: 'TRABALHO_TECNICO', label: 'Trabalho técnico / Consultoria / Parecer',
        fields: [F_TITULO, F_ANO,
            F_NATUREZA(['Assessoria', 'Consultoria', 'Parecer', 'Elaboração de projeto', 'Relatório técnico', 'Outra']),
            { key: 'instituicao', label: 'Instituição/Empresa', type: 'text' },
            { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' }, F_URL],
    },
    APRESENTACAO: {
        key: 'APRESENTACAO', label: 'Apresentação de trabalho / Palestra',
        fields: [F_TITULO, F_ANO,
            F_NATUREZA(['Congresso', 'Seminário', 'Simpósio', 'Conferência ou palestra', 'Comunicação', 'Outra']),
            { key: 'evento', label: 'Nome do evento', type: 'text' },
            { key: 'instituicao', label: 'Instituição promotora', type: 'text' },
            { key: 'cidade', label: 'Cidade', type: 'text' }, F_URL],
    },
    MATERIAL_DIDATICO: {
        key: 'MATERIAL_DIDATICO', label: 'Material didático ou instrucional',
        fields: [F_TITULO, F_ANO, F_AUTORES,
            { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' }, F_URL],
    },
    EDITORACAO: {
        key: 'EDITORACAO', label: 'Editoração / Organização de obra',
        fields: [F_TITULO, F_ANO,
            F_NATUREZA(['Livro', 'Coletânea', 'Periódico', 'Anais', 'Enciclopédia', 'Outra']),
            { key: 'editora', label: 'Editora', type: 'text' },
            { key: 'cidade', label: 'Cidade', type: 'text' },
            { key: 'paginas', label: 'Nº de páginas', type: 'text' }, F_URL],
    },
    PATENTE: {
        key: 'PATENTE', label: 'Patente / Registro',
        fields: [F_TITULO, F_ANO, F_AUTORES,
            { key: 'categoria', label: 'Categoria / Tipo', type: 'text' },
            { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' },
            { key: 'registro', label: 'Nº do registro / depósito', type: 'text' },
            { key: 'instituicao', label: 'Instituição financiadora', type: 'text' }, F_URL],
    },
    SOFTWARE: {
        key: 'SOFTWARE', label: 'Programa de computador / Software',
        fields: [F_TITULO, F_ANO, F_AUTORES,
            { key: 'plataforma', label: 'Plataforma / Ambiente', type: 'text' },
            { key: 'finalidade', label: 'Finalidade', type: 'textarea' },
            { key: 'registro', label: 'Registro (se houver)', type: 'text' }, F_URL],
    },
    DESENHO_INDUSTRIAL: {
        key: 'DESENHO_INDUSTRIAL', label: 'Desenho industrial',
        fields: [F_TITULO, F_ANO, F_AUTORES,
            { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' },
            { key: 'registro', label: 'Nº do registro / depósito', type: 'text' },
            { key: 'instituicao', label: 'Instituição financiadora', type: 'text' }, F_URL],
    },
    MARCA: {
        key: 'MARCA', label: 'Marca registrada',
        fields: [F_TITULO, F_ANO, F_AUTORES,
            F_NATUREZA(['Produto', 'Serviço', 'Coletiva', 'Certificação', 'Outra']),
            { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' },
            { key: 'registro', label: 'Nº do registro / depósito', type: 'text' }, F_URL],
    },
    CULTIVAR_REGISTRADA: {
        key: 'CULTIVAR_REGISTRADA', label: 'Cultivar registrada',
        fields: [{ key: 'titulo', label: 'Denominação', type: 'text', required: true }, F_ANO, F_AUTORES,
            { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' },
            { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
            { key: 'registro', label: 'Nº do registro / solicitação', type: 'text' }, F_URL],
    },
    CULTIVAR_PROTEGIDA: {
        key: 'CULTIVAR_PROTEGIDA', label: 'Cultivar protegida',
        fields: [{ key: 'titulo', label: 'Denominação', type: 'text', required: true }, F_ANO, F_AUTORES,
            { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' },
            { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
            { key: 'registro', label: 'Nº do registro / solicitação', type: 'text' }, F_URL],
    },
    TOPOGRAFIA_CI: {
        key: 'TOPOGRAFIA_CI', label: 'Topografia de circuito integrado',
        fields: [F_TITULO, F_ANO, F_AUTORES,
            { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' },
            { key: 'registro', label: 'Nº do registro / depósito', type: 'text' },
            { key: 'instituicao', label: 'Instituição financiadora', type: 'text' }, F_URL],
    },
    PRODUTO_TECNOLOGICO: {
        key: 'PRODUTO_TECNOLOGICO', label: 'Produto tecnológico',
        fields: [F_TITULO, F_ANO, F_AUTORES,
            { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' },
            { key: 'registro', label: 'Registro / Patente (se houver)', type: 'text' }, F_URL],
    },
    PROCESSO_TECNICA: {
        key: 'PROCESSO_TECNICA', label: 'Processo ou técnica',
        fields: [F_TITULO, F_ANO, F_AUTORES,
            F_NATUREZA(['Analítico', 'Instrumental', 'Pedagógico', 'De produção', 'Outra']),
            { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' },
            { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
            { key: 'cidade', label: 'Cidade', type: 'text' }, F_URL],
    },
    CURSO_MINISTRADO: {
        key: 'CURSO_MINISTRADO', label: 'Curso de curta duração ministrado',
        fields: [F_TITULO, F_ANO,
            { key: 'instituicao', label: 'Instituição promotora', type: 'text' },
            { key: 'cargaHoraria', label: 'Carga horária (h)', type: 'number' },
            { key: 'nivel', label: 'Nível', type: 'select', options: ['Aperfeiçoamento', 'Extensão', 'Especialização', 'Outro'] }, F_URL],
    },
    PARTICIPACAO_EVENTO: {
        key: 'PARTICIPACAO_EVENTO', label: 'Participação em evento / congresso',
        fields: [F_TITULO, F_ANO,
            { key: 'tipoEvento', label: 'Tipo', type: 'select', options: ['Congresso', 'Feira', 'Simpósio', 'Seminário', 'Encontro', 'Oficina', 'Exposição', 'Olimpíada', 'Outro'] },
            { key: 'papel', label: 'Forma de participação', type: 'text' },
            { key: 'cidade', label: 'Cidade', type: 'text' }, F_URL],
    },
    ORGANIZACAO_EVENTO: {
        key: 'ORGANIZACAO_EVENTO', label: 'Organização de evento',
        fields: [F_TITULO, F_ANO,
            { key: 'tipoEvento', label: 'Tipo', type: 'select', options: ['Congresso', 'Feira', 'Simpósio', 'Seminário', 'Encontro', 'Oficina', 'Exposição', 'Outro'] },
            { key: 'instituicao', label: 'Instituição promotora', type: 'text' },
            { key: 'cidade', label: 'Cidade', type: 'text' }, F_URL],
    },
    ORIENTACAO: {
        key: 'ORIENTACAO', label: 'Orientação / Supervisão',
        fields: [
            { key: 'orientando', label: 'Nome do orientando(a)', type: 'text', required: true },
            { key: 'tipo', label: 'Tipo', type: 'select', required: true,
              options: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Mestrado', 'Doutorado', 'Pós-Doutorado', 'Outra'] },
            { key: 'situacao', label: 'Situação', type: 'select', options: ['Em andamento', 'Concluída'] },
            { key: 'titulo', label: 'Título do trabalho', type: 'text' },
            { key: 'instituicao', label: 'Instituição', type: 'text' }, F_ANO],
    },
    BANCA: {
        key: 'BANCA', label: 'Participação em banca',
        fields: [
            { key: 'tipo', label: 'Tipo de banca', type: 'select', required: true,
              options: ['Mestrado', 'Doutorado', 'Qualificação', 'Especialização / Aperfeiçoamento', 'TCC / Graduação', 'Concurso público', 'Professor titular', 'Livre-docência', 'Avaliação de cursos', 'Outra'] },
            { key: 'candidato', label: 'Candidato(a) / Trabalho', type: 'text' },
            { key: 'titulo', label: 'Título do trabalho avaliado', type: 'text' },
            { key: 'instituicao', label: 'Instituição', type: 'text' }, F_ANO],
    },
};

window.LATTES_CATEGORIES = [
    { key: 'DADOS_GERAIS', label: 'Dados gerais', icon: 'fa-id-card', types: [T.PREMIO] },
    { key: 'FORMACAO', label: 'Formação', icon: 'fa-user-graduate', types: [T.FORMACAO_ACADEMICA, T.FORMACAO_COMPLEMENTAR] },
    { key: 'ATUACAO', label: 'Atuação', icon: 'fa-briefcase', types: [T.VINCULO_PROFISSIONAL] },
    { key: 'PROJETOS', label: 'Projetos', icon: 'fa-diagram-project', types: [T.PROJETO_PESQUISA] },
    { key: 'PRODUCOES', label: 'Produções', icon: 'fa-book',
      types: [T.ARTIGO_PERIODICO, T.LIVRO, T.CAPITULO_LIVRO, T.TRABALHO_EVENTO, T.TEXTO_JORNAL, T.TRABALHO_TECNICO, T.APRESENTACAO, T.MATERIAL_DIDATICO, T.EDITORACAO] },
    { key: 'PATENTES_REGISTROS', label: 'Patentes e Registros', icon: 'fa-certificate',
      types: [T.PATENTE, T.SOFTWARE, T.DESENHO_INDUSTRIAL, T.MARCA, T.CULTIVAR_REGISTRADA, T.CULTIVAR_PROTEGIDA, T.TOPOGRAFIA_CI] },
    { key: 'INOVACAO', label: 'Inovação', icon: 'fa-lightbulb', types: [T.PRODUTO_TECNOLOGICO, T.PROCESSO_TECNICA] },
    { key: 'EDUCACAO_CT', label: 'Educação e Popularização de C&T', icon: 'fa-chalkboard-user', types: [T.CURSO_MINISTRADO] },
    { key: 'EVENTOS', label: 'Eventos', icon: 'fa-calendar-days', types: [T.PARTICIPACAO_EVENTO, T.ORGANIZACAO_EVENTO] },
    { key: 'ORIENTACOES', label: 'Orientações', icon: 'fa-user-group', types: [T.ORIENTACAO] },
    { key: 'BANCAS', label: 'Bancas', icon: 'fa-gavel', types: [T.BANCA] },
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
   Índices auxiliares
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
        categoryOf(typeKey) { return byKey[typeKey] ? byKey[typeKey].categoryLabel : ''; },
        itemTitle(item) {
            const f = item.fields || {};
            return f.titulo || f.curso || f.orientando || f.candidato || f.instituicao || '(sem título)';
        },
    };
})();
