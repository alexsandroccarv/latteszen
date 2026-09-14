/* ==========================================================================
   lattesZen — Campos e construtores reutilizados pelas definições de tipo
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração): átomos de campo
   (F_TITULO, F_ANO...) e construtores de bloco (projetoFieldsPadrao,
   alImprensaFields...) compartilhados entre as definições de tipo dos
   arquivos lattes-types-*.js. Nenhuma mudança de conteúdo — só saiu do
   arquivo único original.
   ========================================================================== */
// Átomos de campo reutilizados
const F_TITULO  = { key: 'titulo', label: 'Título', type: 'text', required: true };
const F_ANO     = { key: 'ano', label: 'Ano de início', type: 'datebr', required: true };
const F_DOI     = { key: 'doi', label: 'DOI', type: 'text', placeholder: '10.xxxx/xxxxx' };
const F_URL     = { key: 'url', label: 'URL / Link', type: 'url' };
const F_AUTORES = { key: 'autores', label: 'Autores', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' };
const F_INST    = { key: 'instituicao', label: 'Instituição', type: 'text' };
const F_FINAL   = { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' };
const F_CIDADE  = { key: 'cidade', label: 'Cidade', type: 'text' };
const F_NATUREZA = (options) => ({ key: 'natureza', label: 'Natureza', type: 'select', options });
const F_AINI = { key: 'anoInicio', label: 'Ano de início', type: 'datebr' };
const F_AFIM = { key: 'anoFim', label: 'Ano de fim', type: 'datebr', row: 'periodo' };
// Datas completas (dd/mm/aaaa) usadas na categoria Atuação. Na exportação XML
// Lattes apenas o ANO é mantido (o schema só aceita ANO-INICIO/ANO-FIM).
const F_DINI = { key: 'anoInicio', label: 'Data de início', type: 'datebr' };
const F_DFIM = { key: 'anoFim', label: 'Data de fim (vazio = atual)', type: 'datebr' };
const F_PAIS = { key: 'pais', label: 'País', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' };
const F_IDIOMA = { key: 'idioma', label: 'Idioma', type: 'select', options: window.IDIOMAS_LATTES || [] };
// Opções de "Meio de divulgação" (Livros/Capítulos) — enum MEIO-DE-DIVULGACAO
// do schema Lattes, exceto WEB (não usada na tela real para estes tipos).
const MEIO_DIVULGACAO_OPTIONS = ['Impresso', 'Meio magnético', 'Meio digital', 'Filme', 'Hipertexto', 'Outro', 'Impresso e mídia eletrônica'];
// Período usado nos itens de Atuação (Vínculo, Corpo editorial, Comitê,
// Revisor...): Início, Situação (Atual/Anterior) e Fim — o Fim só aparece
// quando a Situação é "Anterior (finalizado)", como na tela real do Lattes.
const periodoComSituacao = () => [
    { key: 'anoInicio', label: 'Início (mês/ano)', type: 'datebr', row: 'periodo' },
    { key: 'situacao', label: 'Situação', type: 'select', options: ['Atual (não finalizado)', 'Anterior (finalizado)'], row: 'periodo' },
    { key: 'anoFim', label: 'Fim (mês/ano)', type: 'datebr', row: 'periodo', disabledWhen: { field: 'situacao', in: ['', 'Atual (não finalizado)'] } },
];

// Níveis de Formação acadêmica/titulação (espelha FORMACAO-ACADEMICA-TITULACAO
// do schema Lattes) e um atalho para "todos os níveis, exceto os informados"
// — usado nos `disabledWhen` dos campos específicos de cada nível abaixo.
// Inclui '' (nenhum Nível escolhido ainda) na lista de exclusão: assim, antes
// de escolher o Nível, nenhum campo específico de um nível aparece.
const NIVEIS_FORMACAO = ['Ensino fundamental', 'Ensino médio', 'Curso técnico', 'Graduação', 'Aperfeiçoamento',
    'Especialização', 'Mestrado', 'Mestrado profissional', 'Doutorado', 'Residência médica'];
const nivelExcept = (...keep) => [...NIVEIS_FORMACAO.filter(n => !keep.includes(n)), ''];

// Conjuntos de campos reutilizáveis
// Projetos (Dados gerais + Equipe/Financiadores/Produção C&T/Orientações, na
// ordem e com os campos das telas reais do Lattes). Os blocos em tabela
// (Equipe, Instituições envolvidas, Financiamento, Produção C&T, Orientações)
// usam o tipo `repeater` (lista com adicionar/editar/remover linha).
const NATUREZA_PROJETO_OPTIONS = ['Desenvolvimento', 'Extensão', 'Pesquisa', 'Ensino', 'Outra'];
const SITUACAO_PROJETO_OPTIONS = ['Em andamento', 'Concluído', 'Desativado'];
const FINANCIADOR_NATUREZA_OPTIONS = ['Bolsa', 'Auxílio financeiro', 'Remuneração', 'Outro', 'Cooperação', 'Não informado'];
const QTD_ALUNOS_BASE = [
    { key: 'qtdGraduacao', label: 'Graduação', type: 'number', row: 'qtdAlunos' },
    { key: 'qtdEspecializacao', label: 'Especialização', type: 'number', row: 'qtdAlunos' },
    { key: 'qtdMestradoAcademico', label: 'Mestrado acadêmico', type: 'number', row: 'qtdAlunos' },
    { key: 'qtdMestradoProfissional', label: 'Mestrado profissionalizante', type: 'number', row: 'qtdAlunos' },
    { key: 'qtdDoutorado', label: 'Doutorado', type: 'number', row: 'qtdAlunos' },
];
const QTD_TECNICO = { key: 'qtdTecnicoNivelMedio', label: 'Técnico de nível médio', type: 'number', row: 'qtdAlunos' };
const QTD_FUNDAMENTAL = { key: 'qtdEnsinoFundamental', label: 'Ensino Fundamental (1º grau)', type: 'number', row: 'qtdAlunos' };
const QTD_MEDIO = { key: 'qtdEnsinoMedio', label: 'Ensino Médio (2º grau)', type: 'number', row: 'qtdAlunos' };

const projetoEquipeField = (label, addLabel) => ({ key: 'equipe', label: label || 'Equipe', type: 'repeater',
    addLabel: addLabel || 'Adicionar integrante da equipe', columns: [
        { key: 'nome', label: 'Nome', type: 'text', required: true },
        { key: 'coordenador', label: 'Coordenação', type: 'checkbox' }] });
// "Informe os dados da instituição": Nome, Sigla, País, UF — UF só habilita
// quando País = Brasil (comparação sem acento/maiúscula, via enabledWhenCol).
// Reutilizado em toda coluna/campo "instituição" da categoria Projetos.
const institucaoColumns = () => [
    { key: 'nome', label: 'Nome da instituição', type: 'text', required: true },
    { key: 'sigla', label: 'Sigla', type: 'text' },
    F_PAIS,
    { key: 'uf', label: 'UF', type: 'text', enabledWhenCol: { key: 'pais', equals: 'Brasil' } },
];
const projetoInstituicoesEnvolvidasField = () => ({ key: 'instituicoesEnvolvidas', label: 'Instituições envolvidas no projeto', type: 'repeater',
    addLabel: 'Adicionar instituição', columns: institucaoColumns() });
const projetoFinanciadoresField = () => ({ key: 'financiadores', label: 'Instituição de financiamento', type: 'repeater',
    addLabel: 'Adicionar financiador', help: 'O valor financiado não será exibido na internet.', columns: [
        ...institucaoColumns(),
        { key: 'codigoProjeto', label: 'Código do projeto', type: 'text' },
        { key: 'valor', label: 'Valor financiado', type: 'number' },
        { key: 'natureza', label: 'Natureza', type: 'select', options: FINANCIADOR_NATUREZA_OPTIONS }] });
// "Instituição de execução": mesmos 4 campos (Nome/Sigla/País/UF), mas como
// valor único (não é uma lista) — UF via disabledWhen.notEquals (só habilita
// quando País = Brasil).
const projetoInstituicaoExecucaoFields = () => [
    { key: 'instituicaoExecucaoNome', label: 'Instituição de execução', type: 'text' },
    { key: 'instituicaoExecucaoSigla', label: 'Sigla', type: 'text', row: 'instExecucao' },
    { key: 'instituicaoExecucaoPais', label: 'País', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil', row: 'instExecucao' },
    { key: 'instituicaoExecucaoUf', label: 'UF', type: 'text', row: 'instExecucao', disabledWhen: { field: 'instituicaoExecucaoPais', notEquals: 'Brasil' } },
];
const projetoProducoesField = () => ({ key: 'producoesCT', label: 'Produção C&T', type: 'repeater',
    addLabel: 'Adicionar produção', columns: [
        { key: 'titulo', label: 'Título da produção', type: 'text', required: true },
        { key: 'ano', label: 'Ano', type: 'datebr' },
        { key: 'tipo', label: 'Tipo', type: 'text' }] });
const projetoOrientacoesField = () => ({ key: 'orientacoesProjeto', label: 'Orientações', type: 'repeater',
    addLabel: 'Adicionar orientação', columns: [
        { key: 'titulo', label: 'Título da orientação', type: 'text', required: true },
        { key: 'ano', label: 'Ano', type: 'datebr' },
        { key: 'tipo', label: 'Tipo', type: 'text' }] });

// Bloco comum de Dados gerais + rodapé (Equipe...Orientações), usado pelas
// 4 naturezas "simples" de projeto (Pesquisa, Desenvolvimento, Extensão, Outro).
// `extraQtd` insere campos extras na "Quantidade de alunos envolvidos" (ex.:
// Técnico de nível médio, só em Desenvolvimento). `tituloLabel`/`natSitRow`
// são particularidades só de Projetos de pesquisa (ver PROJETO_PESQUISA).
const projetoFieldsPadrao = (extraQtdAntes, tituloLabel, natSitRow) => [
    { ...F_TITULO, label: tituloLabel || 'Título' },
    { key: 'descricao', label: 'Descrição', type: 'textarea' },
    { ...F_NATUREZA(NATUREZA_PROJETO_OPTIONS), row: natSitRow ? 'naturezaSituacao' : undefined },
    { key: 'situacao', label: 'Situação', type: 'select', options: SITUACAO_PROJETO_OPTIONS, row: natSitRow ? 'naturezaSituacao' : undefined },
    { key: 'anoInicio', label: 'Ano início', type: 'datebr', required: true, row: 'periodo' },
    { ...F_AFIM, label: 'Ano fim', row: 'periodo' },
    { key: 'cooperacaoEmpresa', label: 'É um projeto de cooperação entre uma instituição de pesquisa e uma empresa?', type: 'checkbox' },
    { key: 'empresaCnpj', label: 'CNPJ da empresa', type: 'text', placeholder: '00.000.000/0000-00', disabledWhen: { field: 'cooperacaoEmpresa', in: ['', 'Não'] } },
    { key: 'empresaNome', label: 'Nome da empresa', type: 'text', disabledWhen: { field: 'cooperacaoEmpresa', in: ['', 'Não'] } },
    { key: 'empresaEmail', label: 'E-mail Institucional', type: 'text', placeholder: 'nome@empresa.com.br', disabledWhen: { field: 'cooperacaoEmpresa', in: ['', 'Não'] } },
    { key: 'empresaSetor', label: 'Setor', type: 'select', options: window.CNAE_SETORES || [], disabledWhen: { field: 'cooperacaoEmpresa', in: ['', 'Não'] } },
    { key: 'potencialInovacao', label: 'O projeto possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
    { key: 'potencialInovacaoDescricao', label: 'Qual o potencial de inovação do projeto?', type: 'textarea', disabledWhen: { field: 'potencialInovacao', in: ['', 'Não'] } },
    ...projetoInstituicaoExecucaoFields(),
    { key: 'orgaoUnidade', label: 'Órgão/Unidade', type: 'text' },
    projetoEquipeField('Equipe', 'Adicionar integrante da equipe'),
    projetoInstituicoesEnvolvidasField(),
    ...(extraQtdAntes || []), ...QTD_ALUNOS_BASE,
    projetoFinanciadoresField(), projetoProducoesField(), projetoOrientacoesField(),
];
// Projeto de ensino: cooperação/inovação/temática são específicos dessa
// natureza na tela do Lattes e não têm atributo correspondente no schema
// (ficam só na interface — ver comentário em buildAtuacoes).
const ACOES_INOVADORAS_NIVEIS = ['Ensino Fundamental (1º grau)', 'Ensino Médio (2º grau)', 'Graduação', 'Especialização', 'Mestrado', 'Mestrado Profissional', 'Doutorado'];
const TEMATICA_PROJETO_ENSINO = ['Ensino e aprendizagem', 'Aprendizagem por projetos', 'Projetos de curso', 'Formação inicial ou continuada de professores',
    'Inserção de tecnologias no ensino', 'Ação inclusiva', 'Integração social (escola, família, comunidade)', 'Projeto de intervenção',
    'Mobilidade e internacionalização', 'Avaliação', 'Gestão', 'Outra'];
const PROJETO_ENSINO_FIELDS = [
    F_TITULO,
    { key: 'descricao', label: 'Descrição', type: 'textarea' },
    F_NATUREZA(NATUREZA_PROJETO_OPTIONS),
    { key: 'situacao', label: 'Situação', type: 'select', options: SITUACAO_PROJETO_OPTIONS },
    { key: 'anoInicio', label: 'Ano início', type: 'datebr', required: true, row: 'periodo' },
    { ...F_AFIM, label: 'Ano fim', row: 'periodo' },
    { key: 'cooperacaoTipos', label: 'É um projeto em cooperação com', type: 'checkboxes', options: ['Instituição de ensino', 'Agência de fomento', 'Empresa'] },
    { key: 'acoesInovadoras', label: 'O projeto possui ações inovadoras e produtos, processos ou serviços?', type: 'checkbox' },
    { key: 'acoesInovadorasNiveis', label: 'O projeto possui ações inovadoras na', type: 'checkboxes', options: ACOES_INOVADORAS_NIVEIS, disabledWhen: { field: 'acoesInovadoras', in: ['', 'Não'] } },
    { key: 'tematica', label: 'Em relação à temática', type: 'checkboxes', options: TEMATICA_PROJETO_ENSINO },
    { key: 'tematicaOutra', label: 'Especifique (se marcou "Outra" na temática)', type: 'text' },
    { key: 'objetivosMetas', label: 'Objetivos e metas', type: 'textarea' },
    ...projetoInstituicaoExecucaoFields(),
    { key: 'orgaoUnidade', label: 'Órgão/Unidade', type: 'text' },
    projetoEquipeField('Participantes', 'Adicionar participante'),
    projetoInstituicoesEnvolvidasField(),
    QTD_FUNDAMENTAL, QTD_MEDIO, ...QTD_ALUNOS_BASE,
    projetoFinanciadoresField(), projetoProducoesField(), projetoOrientacoesField(),
];
// Átomos para a categoria 20 (Registros pessoais)
const AL_ENT   = { key: 'entidade', label: 'Entidade', type: 'text' };
const AL_PAPEL = { key: 'papel', label: 'Papel / Atuação', type: 'text' };
const AL_FREQ  = { key: 'frequencia', label: 'Carga horária / Frequência', type: 'text' };
const AL_IMP   = { key: 'descricao', label: 'Conquistas / Impacto', type: 'textarea' };
const AL_LOCAL = { key: 'local', label: 'Local / Cidade', type: 'text' };
const AL_ANO   = { key: 'ano', label: 'Ano de início', type: 'datebr' };
const alNome = (label) => ({ key: 'titulo', label, type: 'text', required: true });
// Campos padrão de uma certificação (nome+sigla, instituição emissora,
// obtenção/validade, código/link de verificação) — usados pelos 4 tipos de
// Certificações abaixo.
const alCertificacaoFields = () => [
    alNome('Nome completo da certificação'),
    { key: 'sigla', label: 'Sigla', type: 'text', row: 'certSiglaEnt' },
    { key: 'entidade', label: 'Instituição emissora', type: 'text', placeholder: 'ex.: PMI, ANBIMA, Scrum.org', row: 'certSiglaEnt' },
    { key: 'anoInicio', label: 'Ano de obtenção', type: 'datebr', row: 'certAnoVal' },
    { key: 'anoFim', label: 'Validade até', type: 'datebr', row: 'certAnoVal' },
    { key: 'codigoVerificacao', label: 'Código de verificação', type: 'text', row: 'certCodLink' },
    { key: 'url', label: 'Link de verificação', type: 'url', row: 'certCodLink' },
];
// Campos padrão de uma filiação (entidade, categoria/cargo, nº de sócio,
// período) — usados pelos 5 tipos de Filiações abaixo.
const alFiliacaoFields = () => [
    alNome('Entidade'),
    { key: 'categoria', label: 'Categoria', type: 'text', row: 'filCatSocio' },
    { key: 'numeroSocio', label: 'Número de sócio', type: 'text', row: 'filCatSocio' },
    { ...F_AINI, row: 'periodo' }, F_AFIM,
];
// Campos padrão de uma menção na imprensa (título, veículo, data) — usados
// pelos 3 tipos de Imprensa abaixo. "Tipo de participação" tem opções
// diferentes por tipo (por isso `opcoesParticipacao` é parâmetro — cada um
// dos 3 tipos já É o "Tipo de item" que restringe as opções relevantes,
// sem precisar de lógica condicional em tempo de execução). "Formato da
// aparição" é a mesma lista pros 3.
const FORMATO_APARICAO_OPCOES = ['Texto (Aspas/Declaração)', 'Vídeo ao vivo', 'Vídeo gravado', 'Áudio (Podcast/Rádio)', 'Foto', 'Nota Oficial'];
const alImprensaFields = (opcoesParticipacao) => [
    alNome('Título da matéria'),
    { key: 'tipoParticipacao', label: 'Tipo de participação', type: 'select', options: opcoesParticipacao, row: 'impParticipacaoFormato' },
    { key: 'formatoAparicao', label: 'Formato da aparição', type: 'select', options: FORMATO_APARICAO_OPCOES, row: 'impParticipacaoFormato' },
    { key: 'entidade', label: 'Nome do veículo', type: 'text', required: true, row: 'impVeicData' },
    { key: 'ano', label: 'Data de veiculação', type: 'datebr', required: true, row: 'impVeicData' },
];

// Campos padrão de um concurso/processo seletivo — usados pelos 7 tipos
// de "18. Concursos e processos seletivos" (um por "Tipo de item"; a
// classificação já está no próprio Tipo do item, sem campo duplicado
// dentro do formulário).
const alConcursoFields = () => [
    alNome('Nome do concurso / processo seletivo'),
    { key: 'local', label: 'Local', type: 'text' },
    { key: 'banca', label: 'Banca', type: 'text' },
    { key: 'cargo', label: 'Cargo', type: 'text' },
    { ...F_AINI, row: 'periodo' }, F_AFIM,
    { key: 'colocacao', label: 'Colocação', type: 'text' },
    { key: 'situacao', label: 'Situação final', type: 'select', options: ['Em andamento', 'Aprovado', 'Reprovado'] },
];

// Autores como lista (Nome completo/Nome como citado) — mesmo padrão dos
// demais tipos de Produção bibliográfica (issue de auditoria vs. Lattes real).
const PROD_AUTORES_LISTA = { key: 'autoresLista', label: 'Autores', type: 'repeater', addLabel: 'Adicionar autor', columns: [
    { key: 'nomeCompleto', label: 'Nome completo', type: 'text', required: true, datalist: 'dl-autor' },
    { key: 'nomeCitacao', label: 'Nome como citado', type: 'text' },
] };
// Palavras-chave/Área/Setores/Outras informações — mesmo bloco final usado
// pelos demais tipos de Produção bibliográfica.
const PROD_PALAVRAS_AREA_SETORES_OUTRAS = [
    { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
    { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
    { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
    { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
];
// A tela real (doc 6.3/6.4) tem Nome comum/científico da espécie, Autoridade
// Nacional e Número do processo E do certificado (separados) — nenhum desses
// tem atributo correspondente em DADOS-BASICOS-DA-CULTIVAR/DETALHAMENTO-DA-
// CULTIVAR no XSD/DTD, limitação genuína do schema, por isso não entraram na
// UI. "Melhoristas" é o equivalente de Autores para este tipo (upgrade pra
// lista, mesmo padrão dos demais tipos de Produções).
const CULTIVAR_FIELDS = [{ key: 'titulo', label: 'Denominação', type: 'text', required: true }, { ...F_ANO, row: 'periodo' }, F_AFIM,
    F_FINAL, { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
    { key: 'registro', label: 'Nº do registro / solicitação', type: 'text' },
    { key: 'dataConcessao', label: 'Data da concessão / registro', type: 'date' }, F_PAIS,
    { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
    { ...PROD_AUTORES_LISTA, label: 'Melhoristas' },
    ...PROD_PALAVRAS_AREA_SETORES_OUTRAS];
// Desenho industrial registrado (doc 6.5). `instituicao` = Instituição(ões)
// financiadora(s), distinta de `instituicaoRegistro` (mesmo padrão de
// Programa de Computador Registrado, issue #63).
const PI_FIELDS = [
    { key: 'registro', label: 'Número do registro', type: 'text' },
    { key: 'instituicaoRegistro', label: 'Instituição de registro', type: 'text' }, F_PAIS,
    F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM,
    { key: 'dataDeposito', label: 'Data do registro', type: 'date' },
    { key: 'dataConcessao', label: 'Data de concessão', type: 'date' },
    { ...F_FINAL, label: 'Finalidade' },
    { key: 'instituicao', label: 'Instituição(ões) financiadora(s)', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' },
    { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
    { key: 'titular', label: 'Depositante/Titular (pessoas e instituições)', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' },
    { ...PROD_AUTORES_LISTA, label: 'Inventores' },
    ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
];
// Topografia de circuito integrado registrada (doc 6.7) — mesma estrutura de
// PI_FIELDS, mas sem Depositante/Titular nem Data do registro/concessão
// (não constam na tela real deste tipo específico).
const TOPOGRAFIA_FIELDS = [
    { key: 'registro', label: 'Número do registro', type: 'text' },
    { key: 'instituicaoRegistro', label: 'Instituição de registro', type: 'text' }, F_PAIS,
    F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM,
    { ...F_FINAL, label: 'Finalidade' },
    { key: 'instituicao', label: 'Instituição(ões) financiadora(s)', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' },
    { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
    { ...PROD_AUTORES_LISTA, label: 'Inventores' },
    ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
];

/* ---- Definição global dos TIPOS (por chave) ---- */

export { F_TITULO, F_ANO, F_DOI, F_URL, F_AUTORES, F_INST, F_FINAL, F_CIDADE, F_NATUREZA, F_AINI, F_AFIM, F_DINI, F_DFIM, F_PAIS, F_IDIOMA, MEIO_DIVULGACAO_OPTIONS, periodoComSituacao, NIVEIS_FORMACAO, nivelExcept, NATUREZA_PROJETO_OPTIONS, SITUACAO_PROJETO_OPTIONS, FINANCIADOR_NATUREZA_OPTIONS, QTD_ALUNOS_BASE, QTD_TECNICO, QTD_FUNDAMENTAL, QTD_MEDIO, projetoEquipeField, institucaoColumns, projetoInstituicoesEnvolvidasField, projetoFinanciadoresField, projetoInstituicaoExecucaoFields, projetoProducoesField, projetoOrientacoesField, projetoFieldsPadrao, ACOES_INOVADORAS_NIVEIS, TEMATICA_PROJETO_ENSINO, PROJETO_ENSINO_FIELDS, AL_ENT, AL_PAPEL, AL_FREQ, AL_IMP, AL_LOCAL, AL_ANO, alNome, alCertificacaoFields, alFiliacaoFields, FORMATO_APARICAO_OPCOES, alImprensaFields, alConcursoFields, PROD_AUTORES_LISTA, PROD_PALAVRAS_AREA_SETORES_OUTRAS, CULTIVAR_FIELDS, PI_FIELDS, TOPOGRAFIA_FIELDS };
