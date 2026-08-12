/* ==========================================================================
   lattesZen — Taxonomia de Categorias e Tipos (espelha a Plataforma Lattes)
   --------------------------------------------------------------------------
   11 categorias numeradas, cada uma com sua lista de tipos (algumas com
   subgrupos, como Produções). Um mesmo TIPO pode aparecer em mais de uma
   categoria (ex.: Patente em "Patentes e Registros" e "Inovação"); por isso
   o item catalogado guarda SEMPRE categoryKey + typeKey.

   Campo: { key, label, type, required?, options?, placeholder? }
   type: 'text' | 'textarea' | 'number' | 'year' | 'date' | 'url' | 'select'
   ========================================================================== */

// Átomos de campo reutilizados
const F_TITULO  = { key: 'titulo', label: 'Título', type: 'text', required: true };
const F_ANO     = { key: 'ano', label: 'Ano', type: 'year', required: true, placeholder: 'AAAA' };
const F_DOI     = { key: 'doi', label: 'DOI', type: 'text', placeholder: '10.xxxx/xxxxx' };
const F_URL     = { key: 'url', label: 'URL / Link', type: 'url' };
const F_AUTORES = { key: 'autores', label: 'Autores', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' };
const F_INST    = { key: 'instituicao', label: 'Instituição', type: 'text' };
const F_FINAL   = { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' };
const F_CIDADE  = { key: 'cidade', label: 'Cidade', type: 'text' };
const F_NATUREZA = (options) => ({ key: 'natureza', label: 'Natureza', type: 'select', options });
const F_AINI = { key: 'anoInicio', label: 'Ano de início', type: 'year' };
const F_AFIM = { key: 'anoFim', label: 'Ano de fim', type: 'year' };
const F_PAIS = { key: 'pais', label: 'País', type: 'text', placeholder: 'Brasil' };
const F_IDIOMA = { key: 'idioma', label: 'Idioma', type: 'text', placeholder: 'Português' };

// Conjuntos de campos reutilizáveis
const PROJETO_FIELDS = [F_TITULO,
    { key: 'anoInicio', label: 'Ano de início', type: 'year', required: true }, F_AFIM,
    { key: 'situacao', label: 'Situação', type: 'select', options: ['Em andamento', 'Concluído', 'Desativado'] },
    { key: 'financiador', label: 'Financiador / Agência', type: 'text' },
    { key: 'coordenador', label: 'Coordenador(a)', type: 'text' },
    { key: 'descricao', label: 'Descrição', type: 'textarea' }];
const PI_FIELDS = [F_TITULO, F_ANO, F_AUTORES, F_FINAL,
    { key: 'registro', label: 'Nº do registro / depósito', type: 'text' },
    { key: 'dataDeposito', label: 'Data do depósito', type: 'date' },
    { key: 'dataConcessao', label: 'Data da concessão', type: 'date' },
    { key: 'instituicao', label: 'Instituição financiadora', type: 'text' }, F_PAIS];
const CULTIVAR_FIELDS = [{ key: 'titulo', label: 'Denominação', type: 'text', required: true }, F_ANO, F_AUTORES,
    F_FINAL, { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
    { key: 'registro', label: 'Nº do registro / solicitação', type: 'text' },
    { key: 'dataConcessao', label: 'Data da concessão / registro', type: 'date' }, F_PAIS];

// Átomos para a categoria 99 (Atividades livres)
const AL_ENT   = { key: 'entidade', label: 'Entidade', type: 'text' };
const AL_PAPEL = { key: 'papel', label: 'Papel / Atuação', type: 'text' };
const AL_FREQ  = { key: 'frequencia', label: 'Carga horária / Frequência', type: 'text' };
const AL_IMP   = { key: 'descricao', label: 'Conquistas / Impacto', type: 'textarea' };
const AL_LOCAL = { key: 'local', label: 'Local / Cidade', type: 'text' };
const AL_ANO   = { key: 'ano', label: 'Ano', type: 'year' };
const alNome = (label) => ({ key: 'titulo', label, type: 'text', required: true });

/* ---- Definição global dos TIPOS (por chave) ---- */
const TYPES = {
    // 01 Dados gerais
    IDENTIFICACAO: { label: 'Identificação', noEvidence: true, singleton: true, perfil: true, fields: [{ key: 'titulo', label: 'Nome completo', type: 'text', required: true }, { key: 'nomeSocial', label: 'Nome social', type: 'text' }, { key: 'citacoes', label: 'Nome em citações bibliográficas', type: 'text' }, { key: 'nacionalidade', label: 'Nacionalidade', type: 'text', placeholder: 'Brasileira' }, { key: 'pais', label: 'País de nascimento', type: 'text', placeholder: 'Brasil' }, { key: 'orcid', label: 'ORCID', type: 'text' }, F_URL] },
    FOTO_PERFIL: { label: 'Foto de perfil', noExport: true, noEvidence: true, singleton: true, perfil: true, accept: 'image/jpeg,image/png', fields: [{ key: 'titulo', label: 'Descrição', type: 'text', placeholder: 'ex.: Foto oficial 2025' }, { key: 'ano', label: 'Ano', type: 'year' }] },
    DOCUMENTO_PESSOAL: { label: 'Documentos pessoais', noExport: true, accept: 'application/pdf,image/jpeg,image/png', fields: [
        { key: 'tipoDoc', label: 'Tipo de documento', type: 'select', required: true, options: ['RG', 'CPF', 'Título de eleitor', 'Certidão de nascimento', 'Certidão de casamento', 'Conselho de classe', 'Diploma / Certificado', 'Carteira profissional', 'CNH', 'Passaporte', 'Comprovante de residência', 'Reservista', 'PIS/PASEP', 'Outro'] },
        { key: 'titulo', label: 'Descrição / Nº do documento', type: 'text', required: true },
        { key: 'orgao', label: 'Órgão emissor', type: 'text' },
        { key: 'data', label: 'Data de emissão / validade', type: 'date' },
        { key: 'observacoes', label: 'Observações', type: 'textarea' }] },
    ENDERECO: { label: 'Endereço', singleton: true, noEvidence: true, perfil: true, fields: [{ key: 'titulo', label: 'Endereço', type: 'text', required: true }, { key: 'tipo', label: 'Tipo', type: 'select', options: ['Profissional', 'Residencial'] }, F_CIDADE, { key: 'uf', label: 'UF', type: 'text' }, { key: 'cep', label: 'CEP', type: 'text' }] },
    LICENCA: { label: 'Licença maternidade', fields: [{ key: 'titulo', label: 'Descrição', type: 'text', required: true }, { key: 'tipo', label: 'Tipo', type: 'select', options: ['Maternidade'] }, { key: 'dataInicio', label: 'Data de início', type: 'date' }, { key: 'dataFim', label: 'Data de fim', type: 'date' }] },
    IDIOMAS: { label: 'Idiomas', fields: [{ key: 'titulo', label: 'Idioma', type: 'text', required: true }, { key: 'habilidades', label: 'Proficiência (nível por habilidade)', type: 'skilllevels', options: ['Leitura', 'Fala', 'Escrita', 'Compreensão'], levels: ['Bom', 'Razoável', 'Pouco'] }] },
    PREMIO: { label: 'Prêmios e títulos', fields: [F_TITULO, F_ANO, { key: 'entidade', label: 'Entidade promotora', type: 'text', required: true }] },
    RESUMO_CV: { label: 'Texto inicial do Currículo Lattes', singleton: true, noEvidence: true, perfil: true, fields: [{ key: 'titulo', label: 'Identificação', type: 'text' }, { key: 'descricao', label: 'Texto', type: 'textarea', required: true }] },
    OUTRAS_INFO: { label: 'Outras informações relevantes', singleton: true, noEvidence: true, perfil: true, fields: [{ key: 'titulo', label: 'Título', type: 'text', required: true }, { key: 'descricao', label: 'Descrição', type: 'textarea' }] },

    // 02 Formação
    FORMACAO_ACADEMICA: { label: 'Formação acadêmica/titulação', fields: [
        { key: 'nivel', label: 'Nível', type: 'select', required: true, options: ['Ensino fundamental', 'Ensino médio', 'Curso técnico', 'Graduação', 'Aperfeiçoamento', 'Especialização', 'Mestrado', 'Doutorado', 'Residência médica'] },
        { key: 'curso', label: 'Curso / Área', type: 'text', required: true }, { key: 'instituicao', label: 'Instituição', type: 'text', required: true },
        F_AINI, { key: 'anoFim', label: 'Ano de conclusão', type: 'year' },
        { key: 'titulo', label: 'Título do trabalho (TCC/dissertação/tese)', type: 'text' }, { key: 'orientador', label: 'Orientador(a)', type: 'text' },
        { key: 'coorientador', label: 'Coorientador(a)', type: 'text' },
        { key: 'bolsa', label: 'Bolsista / Agência financiadora', type: 'text' }] },
    POS_DOUTORADO: { label: 'Pós-doutorado e/ou livre-docência', fields: [
        { key: 'tipo', label: 'Tipo', type: 'select', required: true, options: ['Pós-Doutorado', 'Livre-docência'] },
        { key: 'instituicao', label: 'Instituição', type: 'text', required: true }, F_AINI, { key: 'anoFim', label: 'Ano de conclusão', type: 'year' },
        { key: 'titulo', label: 'Título do trabalho', type: 'text' },
        { key: 'bolsa', label: 'Bolsista / Agência financiadora', type: 'text' }] },
    FORMACAO_COMPLEMENTAR: { label: 'Formação complementar', fields: [F_TITULO, F_AINI, { key: 'anoFim', label: 'Ano de conclusão', type: 'year' }, F_INST, { key: 'cargaHoraria', label: 'Carga horária (h)', type: 'number' }] },

    // 03 Atuação
    VINCULO_PROFISSIONAL: { label: 'Atuação profissional', fields: [
        { key: 'instituicao', label: 'Instituição / Empresa', type: 'text', required: true }, { key: 'vinculo', label: 'Tipo de vínculo', type: 'text' },
        { key: 'cargo', label: 'Cargo / Função (enquadramento)', type: 'text' },
        { key: 'regime', label: 'Regime de trabalho', type: 'select', options: ['Dedicação exclusiva', 'Integral', 'Parcial'] },
        { key: 'cargaHoraria', label: 'Carga horária semanal (h)', type: 'number' },
        F_AINI, { key: 'anoFim', label: 'Ano de fim (vazio = atual)', type: 'year' },
        { key: 'titulo', label: 'Outras informações / atividades', type: 'textarea' }] },
    LINHA_PESQUISA: { label: 'Linhas de pesquisa', fields: [{ key: 'titulo', label: 'Linha de pesquisa', type: 'text', required: true }, F_INST, { key: 'descricao', label: 'Objetivos', type: 'textarea' }] },
    CORPO_EDITORIAL: { label: 'Membro de corpo editorial', fields: [{ key: 'titulo', label: 'Periódico', type: 'text', required: true }, { key: 'issn', label: 'ISSN', type: 'text' }, F_AINI, F_AFIM] },
    COMITE_ASSESSORAMENTO: { label: 'Membro de comitê de assessoramento', fields: [{ key: 'titulo', label: 'Comitê / Órgão', type: 'text', required: true }, F_INST, F_AINI, F_AFIM] },
    REVISOR_PERIODICO: { label: 'Revisor de periódico', fields: [{ key: 'titulo', label: 'Periódico', type: 'text', required: true }, { key: 'issn', label: 'ISSN', type: 'text' }, F_AINI, F_AFIM] },
    REVISOR_FOMENTO: { label: 'Revisor de projeto de agência de fomento', fields: [{ key: 'titulo', label: 'Agência de fomento', type: 'text', required: true }, F_AINI, F_AFIM] },
    AREA_ATUACAO: { label: 'Áreas de atuação', noEvidence: true, fields: [{ key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', required: true, help: 'Selecione do mais geral ao mais específico: Grande área › Área › Subárea › Especialidade.' }] },
    // Atividades da atuação profissional
    ATIV_ENSINO: { label: 'Ensino / Disciplinas ministradas', fields: [{ key: 'titulo', label: 'Curso / Nível', type: 'text', required: true }, F_INST, F_AINI, F_AFIM, { key: 'disciplinas', label: 'Disciplinas', type: 'textarea' }] },
    ATIV_DIRECAO: { label: 'Direção e administração', fields: [{ key: 'titulo', label: 'Cargo / Função', type: 'text', required: true }, { key: 'orgao', label: 'Órgão', type: 'text' }, F_INST, F_AINI, F_AFIM] },
    ATIV_CONSELHO: { label: 'Conselho, comissão e consultoria', fields: [{ key: 'titulo', label: 'Órgão / Comissão', type: 'text', required: true }, { key: 'papel', label: 'Atuação', type: 'text' }, F_INST, F_AINI, F_AFIM] },
    ATIV_EXTENSAO: { label: 'Atividade de extensão universitária', fields: [{ key: 'titulo', label: 'Atividade realizada', type: 'text', required: true }, { key: 'orgao', label: 'Órgão', type: 'text' }, F_INST, F_AINI, F_AFIM] },
    ATIV_SERVICO: { label: 'Serviço técnico especializado', fields: [{ key: 'titulo', label: 'Serviço realizado', type: 'text', required: true }, { key: 'orgao', label: 'Órgão', type: 'text' }, F_INST, F_AINI, F_AFIM] },
    ATIV_OUTRA: { label: 'Outra atividade técnico-científica', fields: [{ key: 'titulo', label: 'Atividade realizada', type: 'text', required: true }, { key: 'orgao', label: 'Órgão', type: 'text' }, F_INST, F_AINI, F_AFIM] },

    // 04 Projetos
    PROJETO_PESQUISA: { label: 'Projetos de pesquisa', fields: PROJETO_FIELDS },
    PROJETO_DESENVOLVIMENTO: { label: 'Projeto de desenvolvimento tecnológico', fields: PROJETO_FIELDS },
    PROJETO_EXTENSAO: { label: 'Projeto de extensão', fields: PROJETO_FIELDS },
    PROJETO_ENSINO: { label: 'Projeto de ensino', fields: PROJETO_FIELDS },
    PROJETO_OUTRO: { label: 'Outros tipos de projetos', fields: PROJETO_FIELDS },

    // 05.1 Produção bibliográfica
    ARTIGO_PERIODICO: { label: 'Artigos completos publicados em periódicos', fields: [F_TITULO, F_ANO, F_AUTORES,
        { key: 'periodico', label: 'Periódico / Revista', type: 'text', required: true }, { key: 'issn', label: 'ISSN', type: 'text' },
        { key: 'volume', label: 'Volume', type: 'text' }, { key: 'fasciculo', label: 'Fascículo / Número', type: 'text' },
        { key: 'paginas', label: 'Páginas', type: 'text', placeholder: 'ex.: 120-135' }, F_IDIOMA, F_PAIS, F_DOI, F_URL] },
    ARTIGO_ACEITO: { label: 'Artigos aceitos para publicação', fields: [F_TITULO, F_ANO, F_AUTORES,
        { key: 'periodico', label: 'Periódico / Revista', type: 'text', required: true }, { key: 'issn', label: 'ISSN', type: 'text' }, F_IDIOMA, F_DOI, F_URL] },
    LIVRO_CAPITULO: { label: 'Livros e capítulos', fields: [
        { key: 'tipoObra', label: 'Tipo', type: 'select', required: true, options: ['Livro publicado', 'Livro organizado', 'Capítulo de livro'] },
        F_TITULO, F_ANO, F_AUTORES, { key: 'tituloLivro', label: 'Título do livro (se capítulo)', type: 'text' },
        { key: 'organizadores', label: 'Organizadores', type: 'text' }, { key: 'editora', label: 'Editora', type: 'text' },
        F_CIDADE, { key: 'isbn', label: 'ISBN', type: 'text' }, { key: 'edicao', label: 'Edição', type: 'text' },
        { key: 'paginas', label: 'Páginas', type: 'text' }, F_IDIOMA, F_PAIS, F_URL] },
    TEXTO_JORNAL: { label: 'Texto em jornal ou revista (magazine)', fields: [F_TITULO, F_ANO, F_AUTORES,
        { key: 'veiculo', label: 'Jornal / Revista', type: 'text', required: true }, { key: 'data', label: 'Data', type: 'date' },
        { key: 'volume', label: 'Volume', type: 'text' }, { key: 'paginas', label: 'Páginas', type: 'text' }, F_CIDADE, F_PAIS, F_IDIOMA, F_URL] },
    TRABALHO_EVENTO: { label: 'Trabalhos publicados em anais de eventos', fields: [F_TITULO, F_ANO, F_AUTORES,
        F_NATUREZA(['Completo', 'Resumo expandido', 'Resumo']), { key: 'evento', label: 'Nome do evento', type: 'text', required: true },
        { key: 'anais', label: 'Título dos anais', type: 'text' }, { key: 'isbn', label: 'ISBN/ISSN dos anais', type: 'text' }, { key: 'cidade', label: 'Cidade do evento', type: 'text' }, F_PAIS,
        { key: 'paginas', label: 'Páginas', type: 'text' }, F_IDIOMA, F_DOI, F_URL] },
    APRESENTACAO: { label: 'Apresentação de trabalho e palestra', fields: [F_TITULO, F_ANO, F_AUTORES,
        F_NATUREZA(['Congresso', 'Seminário', 'Simpósio', 'Conferência ou palestra', 'Comunicação', 'Outra']),
        { key: 'evento', label: 'Nome do evento', type: 'text' }, { key: 'instituicao', label: 'Instituição promotora', type: 'text' },
        { key: 'pais', label: 'País', type: 'text', placeholder: 'Brasil' }, F_CIDADE, F_IDIOMA] },
    PARTITURA: { label: 'Partitura musical', fields: [F_TITULO, F_ANO, F_AUTORES, F_NATUREZA(['Canto', 'Coral', 'Orquestra', 'Outro']), { key: 'formacao', label: 'Formação instrumental', type: 'text' }, { key: 'editora', label: 'Editora', type: 'text' }, F_PAIS, F_IDIOMA, F_URL] },
    TRADUCAO: { label: 'Tradução', fields: [F_TITULO, F_ANO, F_AUTORES, F_NATUREZA(['Livro', 'Artigo', 'Outro']), { key: 'autorOriginal', label: 'Autor da obra original', type: 'text' }, { key: 'obraOriginal', label: 'Título da obra original', type: 'text' }, { key: 'idiomaOriginal', label: 'Idioma original', type: 'text' }, { key: 'idioma', label: 'Idioma da tradução', type: 'text' }, { key: 'editora', label: 'Editora', type: 'text' }, F_PAIS, F_URL] },
    PREFACIO: { label: 'Prefácio, posfácio', fields: [F_TITULO, F_ANO, F_AUTORES, F_NATUREZA(['Prefácio', 'Posfácio', 'Apresentação', 'Introdução']), { key: 'obra', label: 'Título da publicação', type: 'text' }, { key: 'editora', label: 'Editora', type: 'text' }, F_PAIS, F_IDIOMA, F_URL] },
    OUTRA_BIBLIOGRAFICA: { label: 'Outra produção bibliográfica', fields: [F_TITULO, F_ANO, F_AUTORES, { key: 'natureza', label: 'Natureza', type: 'text' }, { key: 'editora', label: 'Editora', type: 'text' }, F_PAIS, F_IDIOMA, F_URL] },

    // 05.2 Produção técnica
    ASSESSORIA_CONSULTORIA: { label: 'Assessoria e consultoria', fields: [F_TITULO, F_ANO, F_AUTORES, F_NATUREZA(['Assessoria', 'Consultoria']), F_INST, F_FINAL, F_PAIS, F_CIDADE, F_IDIOMA, F_URL] },
    EXTENSAO_TECNOLOGICA: { label: 'Extensão tecnológica', fields: [F_TITULO, F_ANO, F_AUTORES, F_INST, F_FINAL, F_PAIS, F_CIDADE, F_IDIOMA, F_URL] },
    SOFTWARE_SEM_REGISTRO: { label: 'Programa de computador sem registro', fields: [F_TITULO, F_ANO, F_AUTORES, { key: 'plataforma', label: 'Plataforma / Ambiente', type: 'text' }, F_FINAL, F_PAIS, F_IDIOMA, F_URL] },
    PRODUTO_TECNOLOGICO: { label: 'Produtos', fields: [F_TITULO, F_ANO, F_AUTORES, F_NATUREZA(['Piloto', 'Projeto', 'Protótipo', 'Outro']), F_FINAL, { key: 'registro', label: 'Registro (se houver)', type: 'text' }, F_PAIS, F_CIDADE, F_URL] },
    PROCESSO_TECNICA: { label: 'Processos ou técnicas', fields: [F_TITULO, F_ANO, F_AUTORES, F_NATUREZA(['Analítica', 'Instrumental', 'Pedagógica', 'Processual', 'Terapêutica', 'Outra']), F_FINAL, { key: 'instituicao', label: 'Instituição financiadora', type: 'text' }, F_PAIS, F_CIDADE, F_URL] },
    TRABALHO_TECNICO: { label: 'Trabalhos técnicos', fields: [F_TITULO, F_ANO, F_AUTORES, F_NATUREZA(['Parecer', 'Elaboração de projeto', 'Relatório técnico', 'Outra']), F_INST, F_FINAL, F_PAIS, F_CIDADE, F_IDIOMA, F_URL] },
    CARTA_MAPA: { label: 'Cartas, mapas ou similares', fields: [F_TITULO, F_ANO, F_AUTORES, F_NATUREZA(['Carta', 'Mapa', 'Aerofotograma', 'Fotograma', 'Outra']), F_FINAL, F_PAIS, F_IDIOMA, F_URL] },
    CURSO_MINISTRADO: { label: 'Curso de curta duração ministrado', fields: [F_TITULO, F_ANO, F_AUTORES, { key: 'instituicao', label: 'Instituição promotora', type: 'text' }, { key: 'cargaHoraria', label: 'Carga horária (h)', type: 'number' }, { key: 'nivel', label: 'Nível', type: 'select', options: ['Aperfeiçoamento', 'Extensão', 'Especialização', 'Outra'] }, F_PAIS, F_CIDADE, F_IDIOMA, F_URL] },
    MATERIAL_DIDATICO: { label: 'Desenvolvimento de material didático ou instrucional', fields: [F_TITULO, F_ANO, F_AUTORES, F_FINAL, F_PAIS, F_IDIOMA, F_URL] },
    EDITORACAO: { label: 'Editoração', fields: [F_TITULO, F_ANO, F_NATUREZA(['Livro', 'Coletânea', 'Periódico', 'Anais', 'Enciclopédia', 'Catálogo', 'Outra']), { key: 'editora', label: 'Editora', type: 'text' }, { key: 'paginas', label: 'Nº de páginas', type: 'text' }, F_PAIS, F_CIDADE, F_IDIOMA, F_URL] },
    MANUTENCAO_OBRA: { label: 'Manutenção de obra artística', fields: [F_TITULO, F_ANO, F_AUTORES, F_FINAL, F_PAIS, F_CIDADE] },
    MAQUETE: { label: 'Maquete', fields: [F_TITULO, F_ANO, F_AUTORES, F_FINAL, F_PAIS, F_URL] },
    MIDIA: { label: 'Entrevistas, mesas redondas, programas e comentários na mídia', fields: [F_TITULO, F_ANO, F_AUTORES, { key: 'veiculo', label: 'Veículo / Emissora', type: 'text' }, { key: 'tipo', label: 'Tipo', type: 'select', options: ['Entrevista', 'Mesa redonda', 'Programa', 'Comentário'] }, F_PAIS, F_CIDADE, F_IDIOMA, F_URL] },
    RELATORIO_PESQUISA: { label: 'Relatório de pesquisa', fields: [F_TITULO, F_ANO, F_AUTORES, F_INST, F_PAIS, F_IDIOMA, F_URL] },
    MIDIA_SOCIAL: { label: 'Redes sociais, websites e blogs', fields: [F_TITULO, F_ANO, F_AUTORES, { key: 'plataforma', label: 'Plataforma / Tema', type: 'text' }, F_PAIS, F_IDIOMA, F_URL] },
    OUTRA_TECNICA: { label: 'Outra produção técnica', fields: [F_TITULO, F_ANO, F_AUTORES, { key: 'natureza', label: 'Natureza', type: 'text' }, F_FINAL, F_PAIS, F_CIDADE, F_IDIOMA, F_URL] },

    // 05.3 Produção artística/cultural
    ARTES_CENICAS: { label: 'Artes cênicas', fields: [F_TITULO, F_ANO, F_AUTORES, { key: 'natureza', label: 'Natureza', type: 'text' }, { key: 'evento', label: 'Evento / Local', type: 'text' }, F_PAIS, F_CIDADE, F_IDIOMA, F_URL] },
    MUSICA: { label: 'Música', fields: [F_TITULO, F_ANO, F_AUTORES, { key: 'natureza', label: 'Natureza', type: 'text' }, { key: 'evento', label: 'Evento / Local', type: 'text' }, F_PAIS, F_CIDADE, F_IDIOMA, F_URL] },
    ARTES_VISUAIS: { label: 'Artes visuais', fields: [F_TITULO, F_ANO, F_AUTORES, { key: 'natureza', label: 'Natureza', type: 'text' }, { key: 'evento', label: 'Evento / Local', type: 'text' }, F_PAIS, F_CIDADE, F_IDIOMA, F_URL] },
    OUTRA_ARTISTICA: { label: 'Outra produção artística/cultural', fields: [F_TITULO, F_ANO, F_AUTORES, { key: 'natureza', label: 'Natureza', type: 'text' }, F_PAIS, F_CIDADE, F_IDIOMA, F_URL] },

    // 06/07 Patentes e Registros / Inovação
    PATENTE: { label: 'Patente', fields: [F_TITULO, F_ANO, F_AUTORES, { key: 'categoria', label: 'Categoria / Tipo', type: 'text' }, F_FINAL, { key: 'registro', label: 'Nº do registro / depósito', type: 'text' }, { key: 'dataDeposito', label: 'Data do depósito', type: 'date' }, { key: 'dataConcessao', label: 'Data da concessão', type: 'date' }, { key: 'situacao', label: 'Situação', type: 'select', options: ['Depositada', 'Concedida', 'Em exame', 'Indeferida'] }, { key: 'instituicao', label: 'Instituição financiadora', type: 'text' }, F_PAIS, F_URL] },
    SOFTWARE_REGISTRADO: { label: 'Programa de Computador Registrado', fields: [F_TITULO, F_ANO, F_AUTORES, { key: 'plataforma', label: 'Plataforma / Ambiente', type: 'text' }, F_FINAL, { key: 'registro', label: 'Nº do registro', type: 'text' }, F_PAIS, F_URL] },
    CULTIVAR_PROTEGIDA: { label: 'Cultivar protegida', fields: CULTIVAR_FIELDS },
    CULTIVAR_REGISTRADA: { label: 'Cultivar registrada', fields: CULTIVAR_FIELDS },
    DESENHO_INDUSTRIAL: { label: 'Desenho industrial registrado', fields: PI_FIELDS },
    MARCA: { label: 'Marca registrada', fields: [F_TITULO, F_ANO, F_AUTORES, { key: 'natureza', label: 'Natureza', type: 'text' }, F_FINAL, { key: 'registro', label: 'Nº do registro / depósito', type: 'text' }, { key: 'dataDeposito', label: 'Data do depósito', type: 'date' }, { key: 'dataConcessao', label: 'Data da concessão', type: 'date' }, F_PAIS] },
    TOPOGRAFIA_CI: { label: 'Topografia de circuito integrado registrada', fields: PI_FIELDS },

    // 09 Eventos
    PARTICIPACAO_EVENTO: { label: 'Participação em eventos, congressos, exposições, feiras e olimpíadas', fields: [
        { key: 'titulo', label: 'Nome do evento', type: 'text', required: true },
        { key: 'natureza', label: 'Natureza', type: 'select', required: true, options: ['Congresso', 'Seminário', 'Simpósio', 'Oficina', 'Encontro', 'Olimpíada', 'Feira', 'Exposição', 'Outra'] },
        { key: 'formaParticipacao', label: 'Forma de participação', type: 'select', options: ['Convidado', 'Participante', 'Ouvinte'] },
        { key: 'tipoParticipacao', label: 'Tipo de apresentação / participação', type: 'select', options: ['Conferencista', 'Simposista', 'Moderador', 'Avaliador', 'Homenageado'] },
        { key: 'tituloApresentacao', label: 'Título da apresentação', type: 'text', help: 'Preencher apenas para Convidado ou Participante.' },
        F_ANO,
        { key: 'pais', label: 'País', type: 'text', placeholder: 'Brasil' },
        F_CIDADE,
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'select', options: ['Sim', 'Não'] },
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' }] },
    ORGANIZACAO_EVENTO: { label: 'Organização de eventos, congressos, exposições, feiras e olimpíadas', fields: [F_TITULO, F_ANO, { key: 'tipoEvento', label: 'Tipo', type: 'select', options: ['Concerto', 'Concurso', 'Congresso', 'Exposição', 'Festival', 'Feira', 'Olimpíada', 'Outro'] }, { key: 'instituicao', label: 'Instituição promotora', type: 'text' }, { key: 'pais', label: 'País', type: 'text', placeholder: 'Brasil' }, F_CIDADE, F_URL] },

    // 10 Orientações
    ORIENTACAO_CONCLUIDA: { label: 'Orientações e supervisões concluídas', fields: [{ key: 'orientando', label: 'Nome do orientado(a)', type: 'text', required: true }, { key: 'tipo', label: 'Tipo', type: 'select', required: true, options: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Mestrado', 'Doutorado', 'Pós-Doutorado', 'Outra'] }, { key: 'natureza', label: 'Natureza', type: 'select', options: ['Orientador principal', 'Coorientador'] }, { key: 'titulo', label: 'Título do trabalho', type: 'text' }, { key: 'curso', label: 'Curso', type: 'text' }, F_INST, { key: 'bolsa', label: 'Bolsista / Agência financiadora', type: 'text' }, { key: 'pais', label: 'País', type: 'text', placeholder: 'Brasil' }, F_ANO] },
    ORIENTACAO_ANDAMENTO: { label: 'Orientações e supervisões em andamento', fields: [{ key: 'orientando', label: 'Nome do orientando(a)', type: 'text', required: true }, { key: 'tipo', label: 'Tipo', type: 'select', required: true, options: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Mestrado', 'Doutorado', 'Pós-Doutorado', 'Outra'] }, { key: 'natureza', label: 'Natureza', type: 'select', options: ['Orientador principal', 'Coorientador'] }, { key: 'titulo', label: 'Título do trabalho', type: 'text' }, { key: 'curso', label: 'Curso', type: 'text' }, F_INST, { key: 'bolsa', label: 'Bolsista / Agência financiadora', type: 'text' }, { key: 'pais', label: 'País', type: 'text', placeholder: 'Brasil' }, F_ANO] },

    // 11 Bancas
    BANCA_CONCLUSAO: { label: 'Participação em bancas de trabalhos de conclusão', fields: [{ key: 'tipo', label: 'Tipo', type: 'select', required: true, options: ['Mestrado', 'Doutorado', 'Qualificação', 'Especialização / Aperfeiçoamento', 'TCC / Graduação'] }, { key: 'candidato', label: 'Candidato(a)', type: 'text' }, { key: 'titulo', label: 'Título do trabalho', type: 'text' }, { key: 'curso', label: 'Curso', type: 'text' }, F_INST, { key: 'membros', label: 'Demais membros da banca', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' }, F_ANO] },
    BANCA_JULGADORA: { label: 'Participação em bancas de comissões julgadoras', fields: [{ key: 'tipo', label: 'Tipo', type: 'select', required: true, options: ['Concurso público', 'Professor titular', 'Livre-docência', 'Avaliação de cursos', 'Outra'] }, { key: 'titulo', label: 'Título / Cargo', type: 'text' }, F_INST, { key: 'membros', label: 'Demais membros da banca', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' }, F_ANO] },

    // 99 Atividades livres — Desenvolvimento Pessoal e Habilidades
    AL_CURSO_LIVRE: { label: 'Cursos livres', fields: [alNome('Nome do curso'), { key: 'entidade', label: 'Instituição', type: 'text' }, { key: 'frequencia', label: 'Carga horária', type: 'text' }, F_AINI, F_AFIM, AL_IMP, F_URL] },
    AL_IDIOMAS: { label: 'Idiomas e proficiências', fields: [alNome('Idioma'), { key: 'habilidades', label: 'Proficiência (nível por habilidade)', type: 'skilllevels', options: ['Leitura', 'Fala', 'Escrita', 'Compreensão'], levels: ['Bom', 'Razoável', 'Pouco'] }, { key: 'entidade', label: 'Onde estudou', type: 'text' }, F_AINI, F_AFIM, AL_IMP] },
    AL_TREINAMENTO: { label: 'Treinamentos e workshops', fields: [alNome('Nome'), AL_ENT, AL_PAPEL, AL_FREQ, F_AINI, F_AFIM, AL_IMP, F_URL] },
    AL_PROJETO_PESSOAL: { label: 'Projetos pessoais e autodidatismo', fields: [alNome('Nome do projeto'), AL_PAPEL, F_AINI, F_AFIM, { key: 'frequencia', label: 'Frequência / Dedicação', type: 'text' }, AL_IMP, F_URL] },

    // 99 — Engajamento Comunitário e Cidadania
    AL_VOLUNTARIADO: { label: 'Voluntariado e trabalho social', fields: [alNome('Nome da atividade'), { key: 'entidade', label: 'Organização', type: 'text' }, AL_PAPEL, F_AINI, F_AFIM, { key: 'frequencia', label: 'Carga horária / Frequência', type: 'text' }, AL_IMP] },
    AL_LIDERANCA: { label: 'Liderança e atuação associativa', fields: [alNome('Nome / Cargo'), { key: 'entidade', label: 'Entidade / Associação', type: 'text' }, AL_PAPEL, F_AINI, F_AFIM, AL_IMP] },
    AL_ORG_EVENTO_COM: { label: 'Organização de eventos comunitários', fields: [alNome('Nome do evento'), { key: 'entidade', label: 'Entidade promotora', type: 'text' }, AL_PAPEL, AL_ANO, AL_LOCAL, AL_IMP] },

    // 99 — Saúde, Esporte e Bem-Estar
    AL_ESPORTE: { label: 'Experiências esportivas', fields: [alNome('Modalidade / Atividade'), { key: 'entidade', label: 'Clube / Local', type: 'text' }, AL_PAPEL, F_AINI, F_AFIM, { key: 'frequencia', label: 'Frequência', type: 'text' }, AL_IMP] },
    AL_COMPETICAO: { label: 'Competições e torneios amadores', fields: [alNome('Competição'), { key: 'entidade', label: 'Organizador', type: 'text' }, { key: 'papel', label: 'Categoria / Colocação', type: 'text' }, AL_ANO, AL_LOCAL, { key: 'descricao', label: 'Resultado / Impacto', type: 'textarea' }] },
    AL_EXPEDICAO: { label: 'Expedições, Trilhas e roteiros', fields: [alNome('Expedição / Trilha'), AL_LOCAL, AL_ANO, { key: 'frequencia', label: 'Distância / Duração', type: 'text' }, AL_PAPEL, AL_IMP] },
    AL_BEMESTAR: { label: 'Práticas integrativas e bem-estar', fields: [alNome('Prática'), AL_ENT, { key: 'frequencia', label: 'Frequência', type: 'text' }, F_AINI, F_AFIM, AL_IMP] },

    // 99 — Interesses, Cultura e Lazer
    AL_HOBBY: { label: 'Hobbies e expressão artística', fields: [alNome('Hobby / Atividade'), AL_PAPEL, { key: 'frequencia', label: 'Frequência', type: 'text' }, F_AINI, F_AFIM, AL_IMP, F_URL] },
    AL_COLECIONISMO: { label: 'Colecionismo', fields: [alNome('Coleção / Tema'), { key: 'descricao', label: 'Descrição / Acervo', type: 'textarea' }, F_AINI, { key: 'frequencia', label: 'Nº de itens / Frequência', type: 'text' }, F_URL] },
    AL_CULTURAL: { label: 'Experiências culturais', fields: [alNome('Experiência'), AL_LOCAL, AL_ANO, AL_IMP] },
    AL_GASTRONOMIA: { label: 'Gastronomia e culinária', fields: [alNome('Atividade / Especialidade'), AL_PAPEL, { key: 'frequencia', label: 'Frequência', type: 'text' }, AL_IMP, F_URL] },

    // 98 Conexões (somente link; sem comprovação; não-Lattes)
    CONEXAO_SOCIAL: { label: 'Rede social', noExport: true, noEvidence: true, fields: [
        { key: 'titulo', label: 'Rede / Plataforma', type: 'text', required: true, placeholder: 'ex.: Instagram, Facebook, X, YouTube, TikTok' },
        { key: 'url', label: 'Link (URL)', type: 'text', required: true, placeholder: 'https://...' },
        { key: 'usuario', label: 'Usuário / @', type: 'text' }] },
    CONEXAO_ACADEMICA: { label: 'Perfil acadêmico', noExport: true, noEvidence: true, fields: [
        { key: 'titulo', label: 'Plataforma', type: 'text', required: true, placeholder: 'ex.: ORCID, Lattes, Zotero, ResearchGate, Google Scholar' },
        { key: 'url', label: 'Link (URL)', type: 'text', required: true, placeholder: 'https://...' },
        { key: 'usuario', label: 'Identificador / ID', type: 'text' }] },
    CONEXAO_PROFISSIONAL: { label: 'Rede / contato profissional', noExport: true, noEvidence: true, fields: [
        { key: 'titulo', label: 'Plataforma / Tipo', type: 'text', required: true, placeholder: 'ex.: LinkedIn, E-mail profissional, Site pessoal' },
        { key: 'url', label: 'Link / URL (ou e-mail)', type: 'text', required: true, placeholder: 'https://...  ou  nome@dominio' },
        { key: 'usuario', label: 'Usuário / contato', type: 'text' }] },

    /* --- RSC — Atividades administrativas (não-Lattes; só com o módulo RSC) --- */
    RSC_COMISSAO: { label: 'Comissão / GT / comitê / conselho', noExport: true, rsc: true, fields: [
        { key: 'titulo', label: 'Descrição da atividade', type: 'text', required: true },
        { key: 'orgao', label: 'Órgão / unidade', type: 'text' }, { key: 'descricao', label: 'Detalhes', type: 'textarea' }] },
    RSC_CONCURSO: { label: 'Organização de concurso / vestibular / seleção', noExport: true, rsc: true, fields: [
        { key: 'titulo', label: 'Descrição da atividade', type: 'text', required: true },
        { key: 'orgao', label: 'Órgão / unidade', type: 'text' }, { key: 'descricao', label: 'Detalhes', type: 'textarea' }] },
    RSC_CONTRATO: { label: 'Gestão / fiscalização de contrato', noExport: true, rsc: true, fields: [
        { key: 'titulo', label: 'Contrato / objeto', type: 'text', required: true },
        { key: 'orgao', label: 'Órgão / unidade', type: 'text' }, { key: 'descricao', label: 'Detalhes', type: 'textarea' }] },
    RSC_LICITACAO: { label: 'Licitação / planejamento de contratação', noExport: true, rsc: true, fields: [
        { key: 'titulo', label: 'Descrição da atividade', type: 'text', required: true },
        { key: 'orgao', label: 'Órgão / unidade', type: 'text' }, { key: 'descricao', label: 'Detalhes', type: 'textarea' }] },
    RSC_SISTEMA: { label: 'Sistema estruturante / TI', noExport: true, rsc: true, fields: [
        { key: 'titulo', label: 'Sistema', type: 'text', required: true },
        { key: 'orgao', label: 'Órgão / unidade', type: 'text' }, { key: 'descricao', label: 'Atuação', type: 'textarea' }] },
    RSC_CARGO_FUNCAO: { label: 'Cargo de direção / função gratificada (CD/FG)', noExport: true, rsc: true, fields: [
        { key: 'titulo', label: 'Cargo / função (ex.: CD-04, FG-01)', type: 'text', required: true },
        { key: 'orgao', label: 'Órgão / unidade', type: 'text' }, { key: 'descricao', label: 'Atribuições', type: 'textarea' }] },
    RSC_RESP_SETOR: { label: 'Responsável por setor / unidade', noExport: true, rsc: true, fields: [
        { key: 'titulo', label: 'Setor / unidade', type: 'text', required: true },
        { key: 'orgao', label: 'Órgão', type: 'text' }, { key: 'descricao', label: 'Detalhes', type: 'textarea' }] },
    RSC_APOIO_TECNICO: { label: 'Apoio técnico especializado', noExport: true, rsc: true, fields: [
        { key: 'titulo', label: 'Descrição da atividade', type: 'text', required: true },
        { key: 'orgao', label: 'Órgão / unidade', type: 'text' }, { key: 'descricao', label: 'Detalhes', type: 'textarea' }] },
    RSC_ADMIN_OUTRA: { label: 'Outra atividade administrativa', noExport: true, rsc: true, fields: [
        { key: 'titulo', label: 'Descrição da atividade', type: 'text', required: true },
        { key: 'orgao', label: 'Órgão / unidade', type: 'text' }, { key: 'descricao', label: 'Detalhes', type: 'textarea' }] },
};
// Garante que cada tipo conheça a própria chave
Object.keys(TYPES).forEach(k => TYPES[k].key = k);

/* ---- As 11 categorias do menu Lattes (com subgrupos onde há) ---- */
const PROD_BIBLIO = ['ARTIGO_PERIODICO', 'ARTIGO_ACEITO', 'LIVRO_CAPITULO', 'TEXTO_JORNAL', 'TRABALHO_EVENTO', 'APRESENTACAO', 'PARTITURA', 'TRADUCAO', 'PREFACIO', 'OUTRA_BIBLIOGRAFICA'];
const PROD_TECNICA = ['ASSESSORIA_CONSULTORIA', 'EXTENSAO_TECNOLOGICA', 'SOFTWARE_SEM_REGISTRO', 'PRODUTO_TECNOLOGICO', 'PROCESSO_TECNICA', 'TRABALHO_TECNICO', 'CARTA_MAPA', 'CURSO_MINISTRADO', 'MATERIAL_DIDATICO', 'EDITORACAO', 'MANUTENCAO_OBRA', 'MAQUETE', 'MIDIA', 'RELATORIO_PESQUISA', 'MIDIA_SOCIAL', 'OUTRA_TECNICA'];
const PROD_ARTISTICA = ['ARTES_CENICAS', 'MUSICA', 'ARTES_VISUAIS', 'OUTRA_ARTISTICA'];
const PI_TYPES = ['PATENTE', 'SOFTWARE_REGISTRADO', 'CULTIVAR_PROTEGIDA', 'CULTIVAR_REGISTRADA', 'DESENHO_INDUSTRIAL', 'MARCA', 'TOPOGRAFIA_CI'];

window.LATTES_CATEGORIES = [
    { num: '01', key: 'DADOS_GERAIS', label: 'Dados gerais', icon: 'fa-id-card',
      // Identificação, Foto, Endereço, Texto inicial e Outras informações são
      // editados em Configurações (perfil); aqui ficam os demais itens de 01.
      types: ['DOCUMENTO_PESSOAL', 'LICENCA', 'IDIOMAS', 'PREMIO'] },
    { num: '02', key: 'FORMACAO', label: 'Formação', icon: 'fa-user-graduate',
      types: ['FORMACAO_ACADEMICA', 'POS_DOUTORADO', 'FORMACAO_COMPLEMENTAR'] },
    { num: '03', key: 'ATUACAO', label: 'Atuação', icon: 'fa-briefcase',
      types: ['VINCULO_PROFISSIONAL', 'ATIV_ENSINO', 'ATIV_DIRECAO', 'ATIV_CONSELHO', 'ATIV_EXTENSAO', 'ATIV_SERVICO', 'ATIV_OUTRA', 'LINHA_PESQUISA', 'CORPO_EDITORIAL', 'COMITE_ASSESSORAMENTO', 'REVISOR_PERIODICO', 'REVISOR_FOMENTO', 'AREA_ATUACAO'] },
    { num: '04', key: 'PROJETOS', label: 'Projetos', icon: 'fa-diagram-project',
      types: ['PROJETO_PESQUISA', 'PROJETO_DESENVOLVIMENTO', 'PROJETO_EXTENSAO', 'PROJETO_ENSINO', 'PROJETO_OUTRO'] },
    { num: '05', key: 'PRODUCOES', label: 'Produções', icon: 'fa-book',
      groups: [
          { label: 'Produção Bibliográfica', types: PROD_BIBLIO },
          { label: 'Produção Técnica', types: PROD_TECNICA },
          { label: 'Outra produção artística/cultural', types: PROD_ARTISTICA },
      ] },
    { num: '06', key: 'PATENTES_REGISTROS', label: 'Patentes e Registros', icon: 'fa-certificate', types: PI_TYPES },
    { num: '07', key: 'INOVACAO', label: 'Inovação', icon: 'fa-lightbulb',
      types: ['SOFTWARE_SEM_REGISTRO', 'PRODUTO_TECNOLOGICO', 'PROCESSO_TECNICA', 'PROJETO_PESQUISA', 'PROJETO_DESENVOLVIMENTO', 'PROJETO_EXTENSAO', 'PROJETO_ENSINO', 'PROJETO_OUTRO'] },
    { num: '08', key: 'EDUCACAO_CT', label: 'Educação e Popularização de C&T', icon: 'fa-chalkboard-user',
      types: ['ARTIGO_PERIODICO', 'ARTIGO_ACEITO', 'LIVRO_CAPITULO', 'TEXTO_JORNAL', 'TRABALHO_EVENTO', 'APRESENTACAO', 'SOFTWARE_SEM_REGISTRO', 'CURSO_MINISTRADO', 'MATERIAL_DIDATICO', 'MIDIA', 'SOFTWARE_REGISTRADO', 'ORGANIZACAO_EVENTO', 'PARTICIPACAO_EVENTO', 'MIDIA_SOCIAL', 'ARTES_VISUAIS', 'ARTES_CENICAS', 'MUSICA', 'OUTRA_BIBLIOGRAFICA', 'OUTRA_TECNICA', 'OUTRA_ARTISTICA'] },
    { num: '09', key: 'EVENTOS', label: 'Eventos', icon: 'fa-calendar-days', types: ['PARTICIPACAO_EVENTO', 'ORGANIZACAO_EVENTO'] },
    { num: '10', key: 'ORIENTACOES', label: 'Orientações', icon: 'fa-user-group', types: ['ORIENTACAO_CONCLUIDA', 'ORIENTACAO_ANDAMENTO'] },
    { num: '11', key: 'BANCAS', label: 'Bancas', icon: 'fa-gavel', types: ['BANCA_CONCLUSAO', 'BANCA_JULGADORA'] },
    { num: '97', key: 'RSC_ADMIN', label: 'RSC — Atividades administrativas', icon: 'fa-building-columns', naoLattes: true, rscOnly: true,
      types: ['RSC_COMISSAO', 'RSC_CONCURSO', 'RSC_CONTRATO', 'RSC_LICITACAO', 'RSC_SISTEMA', 'RSC_CARGO_FUNCAO', 'RSC_RESP_SETOR', 'RSC_APOIO_TECNICO', 'RSC_ADMIN_OUTRA'] },
    { num: '98', key: 'CONEXOES', label: 'Conexões', icon: 'fa-share-nodes', naoLattes: true,
      groups: [
          { label: 'Sociais', types: ['CONEXAO_SOCIAL'] },
          { label: 'Acadêmicas', types: ['CONEXAO_ACADEMICA'] },
          { label: 'Profissionais', types: ['CONEXAO_PROFISSIONAL'] },
      ] },
    { num: '99', key: 'ATIVIDADES_LIVRES', label: 'Atividades livres', icon: 'fa-person-hiking', naoLattes: true,
      groups: [
          { label: 'Desenvolvimento Pessoal e Habilidades', types: ['AL_CURSO_LIVRE', 'AL_IDIOMAS', 'AL_TREINAMENTO', 'AL_PROJETO_PESSOAL'] },
          { label: 'Engajamento Comunitário e Cidadania', types: ['AL_VOLUNTARIADO', 'AL_LIDERANCA', 'AL_ORG_EVENTO_COM'] },
          { label: 'Saúde, Esporte e Bem-Estar', types: ['AL_ESPORTE', 'AL_COMPETICAO', 'AL_EXPEDICAO', 'AL_BEMESTAR'] },
          { label: 'Interesses, Cultura e Lazer', types: ['AL_HOBBY', 'AL_COLECIONISMO', 'AL_CULTURAL', 'AL_GASTRONOMIA'] },
      ] },
];
const AL_KEYS = ['AL_CURSO_LIVRE', 'AL_IDIOMAS', 'AL_TREINAMENTO', 'AL_PROJETO_PESSOAL', 'AL_VOLUNTARIADO', 'AL_LIDERANCA', 'AL_ORG_EVENTO_COM', 'AL_ESPORTE', 'AL_COMPETICAO', 'AL_EXPEDICAO', 'AL_BEMESTAR', 'AL_HOBBY', 'AL_COLECIONISMO', 'AL_CULTURAL', 'AL_GASTRONOMIA'];

// Categoria "primária" de cada tipo (usada pelo importador do XML)
const PRIMARY_CATEGORY = {
    IDENTIFICACAO: 'DADOS_GERAIS', FOTO_PERFIL: 'DADOS_GERAIS', DOCUMENTO_PESSOAL: 'DADOS_GERAIS', ENDERECO: 'DADOS_GERAIS', LICENCA: 'DADOS_GERAIS', IDIOMAS: 'DADOS_GERAIS',
    PREMIO: 'DADOS_GERAIS', RESUMO_CV: 'DADOS_GERAIS', OUTRAS_INFO: 'DADOS_GERAIS',
    FORMACAO_ACADEMICA: 'FORMACAO', POS_DOUTORADO: 'FORMACAO', FORMACAO_COMPLEMENTAR: 'FORMACAO',
    VINCULO_PROFISSIONAL: 'ATUACAO', LINHA_PESQUISA: 'ATUACAO', CORPO_EDITORIAL: 'ATUACAO', COMITE_ASSESSORAMENTO: 'ATUACAO', REVISOR_PERIODICO: 'ATUACAO', REVISOR_FOMENTO: 'ATUACAO', AREA_ATUACAO: 'ATUACAO',
    ATIV_ENSINO: 'ATUACAO', ATIV_DIRECAO: 'ATUACAO', ATIV_CONSELHO: 'ATUACAO', ATIV_EXTENSAO: 'ATUACAO', ATIV_SERVICO: 'ATUACAO', ATIV_OUTRA: 'ATUACAO',
    PROJETO_PESQUISA: 'PROJETOS', PROJETO_DESENVOLVIMENTO: 'PROJETOS', PROJETO_EXTENSAO: 'PROJETOS', PROJETO_ENSINO: 'PROJETOS', PROJETO_OUTRO: 'PROJETOS',
    ARTIGO_PERIODICO: 'PRODUCOES', ARTIGO_ACEITO: 'PRODUCOES', LIVRO_CAPITULO: 'PRODUCOES', TEXTO_JORNAL: 'PRODUCOES', TRABALHO_EVENTO: 'PRODUCOES', APRESENTACAO: 'PRODUCOES', PARTITURA: 'PRODUCOES', TRADUCAO: 'PRODUCOES', PREFACIO: 'PRODUCOES', OUTRA_BIBLIOGRAFICA: 'PRODUCOES',
    ASSESSORIA_CONSULTORIA: 'PRODUCOES', EXTENSAO_TECNOLOGICA: 'PRODUCOES', SOFTWARE_SEM_REGISTRO: 'PRODUCOES', PRODUTO_TECNOLOGICO: 'PRODUCOES', PROCESSO_TECNICA: 'PRODUCOES', TRABALHO_TECNICO: 'PRODUCOES', CARTA_MAPA: 'PRODUCOES', CURSO_MINISTRADO: 'PRODUCOES', MATERIAL_DIDATICO: 'PRODUCOES', EDITORACAO: 'PRODUCOES', MANUTENCAO_OBRA: 'PRODUCOES', MAQUETE: 'PRODUCOES', MIDIA: 'PRODUCOES', RELATORIO_PESQUISA: 'PRODUCOES', MIDIA_SOCIAL: 'PRODUCOES', OUTRA_TECNICA: 'PRODUCOES',
    ARTES_CENICAS: 'PRODUCOES', MUSICA: 'PRODUCOES', ARTES_VISUAIS: 'PRODUCOES', OUTRA_ARTISTICA: 'PRODUCOES',
    PATENTE: 'PATENTES_REGISTROS', SOFTWARE_REGISTRADO: 'PATENTES_REGISTROS', CULTIVAR_PROTEGIDA: 'PATENTES_REGISTROS', CULTIVAR_REGISTRADA: 'PATENTES_REGISTROS', DESENHO_INDUSTRIAL: 'PATENTES_REGISTROS', MARCA: 'PATENTES_REGISTROS', TOPOGRAFIA_CI: 'PATENTES_REGISTROS',
    PARTICIPACAO_EVENTO: 'EVENTOS', ORGANIZACAO_EVENTO: 'EVENTOS',
    ORIENTACAO_CONCLUIDA: 'ORIENTACOES', ORIENTACAO_ANDAMENTO: 'ORIENTACOES',
    BANCA_CONCLUSAO: 'BANCAS', BANCA_JULGADORA: 'BANCAS',
    // chaves legadas (compatibilidade com dados antigos)
    LIVRO: 'PRODUCOES', CAPITULO_LIVRO: 'PRODUCOES', SOFTWARE: 'PRODUCOES', ORIENTACAO: 'ORIENTACOES', BANCA: 'BANCAS', PROJETO: 'PROJETOS',
};
AL_KEYS.forEach(k => { PRIMARY_CATEGORY[k] = 'ATIVIDADES_LIVRES'; });
['CONEXAO_SOCIAL', 'CONEXAO_ACADEMICA', 'CONEXAO_PROFISSIONAL'].forEach(k => { PRIMARY_CATEGORY[k] = 'CONEXOES'; });
['RSC_COMISSAO', 'RSC_CONCURSO', 'RSC_CONTRATO', 'RSC_LICITACAO', 'RSC_SISTEMA', 'RSC_CARGO_FUNCAO', 'RSC_RESP_SETOR', 'RSC_APOIO_TECNICO', 'RSC_ADMIN_OUTRA'].forEach(k => { PRIMARY_CATEGORY[k] = 'RSC_ADMIN'; });
const LEGACY_TYPE = { LIVRO: 'LIVRO_CAPITULO', CAPITULO_LIVRO: 'LIVRO_CAPITULO', SOFTWARE: 'SOFTWARE_SEM_REGISTRO', ORIENTACAO: 'ORIENTACAO_ANDAMENTO', BANCA: 'BANCA_CONCLUSAO' };

/* ---- Categoria/tipo especial: itens NÃO LATTES ---- */
window.NAO_LATTES_TYPE = {
    key: 'NAO_LATTES', label: 'Item não-Lattes (pessoal)',
    fields: [F_TITULO, { key: 'categoria', label: 'Categoria', type: 'select', options: ['Hobby', 'Atividade pessoal', 'Voluntariado', 'Certificado avulso', 'Curso livre', 'Outro'] }, F_ANO, { key: 'descricao', label: 'Descrição', type: 'textarea' }, F_URL],
};

/* ---- Enums do schema Lattes: normalização rótulo↔token ----
   Muitos atributos do XSD são enumerados (NATUREZA, TIPO, NÍVEL, SITUAÇÃO…).
   O lattesZen usa rótulos legíveis; o Lattes usa tokens em CAIXA_ALTA. Estas
   funções convertem nos dois sentidos, garantindo ida-e-volta sem perdas. */
function _tok(s) {
    return String(s == null ? '' : s).trim().toUpperCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')   // remove acentos
        .replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
// Aliases onde o rótulo não normaliza exatamente para o token do XSD.
const ENUM_ALIAS = {
    'LIVRO_ORGANIZADO': 'LIVRO_ORGANIZADO_OU_EDICAO',
    'CONFERENCIA_OU_PALESTRA': 'CONFERENCIA',
};
function enumToken(value) {
    const t = _tok(value);
    return ENUM_ALIAS[t] || t;
}
window.LattesEnums = { tok: _tok, token: enumToken };

/* ---- API pública ---- */
window.LattesTypes = (function () {
    const catByKey = {};
    LATTES_CATEGORIES.forEach(c => { catByKey[c.key] = c; });
    catByKey['NAO_LATTES'] = { num: '00', key: 'NAO_LATTES', label: 'Não-Lattes', icon: 'fa-heart' };

    const BACKUP_FOLDER = '00 Backup';

    function slugFolder(cat) {
        // Nome de pasta seguro para o sistema de arquivos, legível e ordenável
        // Padrão: "NN Nome" (número + espaço + nome, sem hífen)
        const safe = (cat.label || cat.key).replace(/[\\/:*?"<>|]/g, '').trim();
        return `${cat.num || '00'} ${safe}`;
    }

    // Title Case pt-BR (iniciais maiúsculas, conectores em minúsculas)
    const TC_MINOR = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'ao', 'aos', 'à', 'às', 'com', 'por', 'para', 'sem', 'sob', 'entre', 'no', 'na', 'nos', 'nas', 'ou']);
    function titleCasePt(s) {
        const toks = String(s == null ? '' : s).toLowerCase().split(/(\s+|\/|-)/);
        let first = true;
        return toks.map(t => {
            if (t === '' || /^\s+$/.test(t) || t === '-') return t;
            if (t === '/') { first = true; return t; }
            const res = (!first && TC_MINOR.has(t)) ? t : t.replace(/\p{L}/u, c => c.toUpperCase());
            first = false;
            return res;
        }).join('');
    }

    return {
        categories: LATTES_CATEGORIES,
        naoLattes: NAO_LATTES_TYPE,
        backupFolder() { return BACKUP_FOLDER; },
        getType(typeKey) { return TYPES[typeKey] || (typeKey === 'NAO_LATTES' ? NAO_LATTES_TYPE : null); },
        // compat: get() devolve o tipo (independe de categoria)
        get(typeKey) { return this.getType(typeKey); },
        label(typeKey) { const t = this.getType(typeKey); return t ? t.label : typeKey; },
        categoryByKey(catKey) { return catByKey[catKey] || null; },
        categoryLabel(catKey) { const c = catByKey[catKey]; return c ? c.label : (catKey || ''); },
        categoryNumLabel(catKey) { const c = catByKey[catKey]; return c ? `${c.num ? c.num + '. ' : ''}${c.label}` : (catKey || ''); },
        // Itens legados 'NAO_LATTES' vão para a pasta de Atividades livres (99)
        categoryFolder(catKey) {
            if (catKey === 'NAO_LATTES') return slugFolder(catByKey['ATIVIDADES_LIVRES']);
            const c = catByKey[catKey]; return c ? slugFolder(c) : '99 Outros';
        },
        primaryCategory(typeKey) { return PRIMARY_CATEGORY[typeKey] || 'PRODUCOES'; },
        normalizeType(typeKey) { return LEGACY_TYPE[typeKey] || typeKey; },
        isNaoLattesCategory(catKey) { return catKey === 'NAO_LATTES' || !!(catByKey[catKey] && catByKey[catKey].naoLattes); },
        isSingleton(typeKey) { const t = this.getType(typeKey); return !!(t && t.singleton); },
        // Tipos de "perfil" (Dados gerais) editados em Configurações, não em Catalogar
        isPerfilType(typeKey) { const t = this.getType(typeKey); return !!(t && t.perfil); },
        perfilTypes() { return Object.keys(TYPES).filter(k => TYPES[k].perfil); },
        // Pastas criadas no diretório: as 12 categorias + a pasta de Backup
        allFolders() { return LATTES_CATEGORIES.map(slugFolder).concat(BACKUP_FOLDER); },
        itemTitle(item) {
            const f = item.fields || {};
            // Formação acadêmica/titulação: exibe "anoInicio-anoFim Nível · Curso"
            // (o campo "titulo" guarda o TCC/dissertação/tese, não serve de rótulo).
            if (item.typeKey === 'FORMACAO_ACADEMICA') {
                const ini = String(f.anoInicio || '').trim();
                const fim = String(f.anoFim || '').trim();
                const periodo = (ini && fim) ? `${ini}-${fim}` : (ini || fim || '');
                const resto = [f.nivel, f.curso].map(x => String(x || '').trim()).filter(Boolean).join(' · ');
                const t = [periodo, resto].filter(Boolean).join(' ');
                if (t) return t;
            }
            // Áreas de atuação: hierarquia CNPq/CAPES (Grande área › Área › Subárea › Especialidade)
            if (item.typeKey === 'AREA_ATUACAO') {
                const partes = [f.grandeArea, f.area, f.subarea, f.especialidade].map(x => String(x || '').trim()).filter(Boolean);
                if (partes.length) return partes.map(titleCasePt).join(' › ');
                if (f.areaConhecimento) return titleCasePt(f.areaConhecimento);
            }
            return f.titulo || f.curso || f.orientando || f.candidato || f.instituicao || f.nome || '(sem título)';
        },
    };
})();
