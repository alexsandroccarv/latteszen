/* Teste de ramos: força TODOS os subtipos (níveis de formação, tipos de
   orientação/banca/participação, capítulo de livro) e valida contra o XSD. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src', 'js');
const XSD = join(root, 'docs', 'CurriculoLattes.xsd');
const OUT = join(root, 'tools', '_branches-export.xml');
const win = {};
const load = (f) => new Function('window', 'document', 'with(window){' + readFileSync(join(SRC, f), 'utf8') + '\n}')(win, undefined);
load('lattes-types.js'); load('encoding.js'); load('lattes-xml-export.js');
const { LattesXMLExport, LzEncoding } = win;

let n = 0; const mk = (typeKey, categoryKey, fields) => ({ id: 'b' + (++n), typeKey, categoryKey, fields, inLattes: true });
const items = [];
// Identificação
items.push(mk('IDENTIFICACAO', 'DADOS_GERAIS', { titulo: 'Fulano de Tal', citacoes: 'TAL, F.', nacionalidade: 'Brasileira', pais: 'Brasil', orcid: '0000-0002-1825-0097' }));
// Formação — todos os níveis
['Graduação', 'Especialização', 'Aperfeiçoamento', 'Mestrado', 'Doutorado', 'Curso técnico', 'Ensino fundamental', 'Ensino médio', 'Residência médica'].forEach(nivel =>
    items.push(mk('FORMACAO_ACADEMICA', 'FORMACAO', { nivel, curso: 'Curso ' + nivel, instituicao: 'UNIFESP', anoInicio: '2010', anoFim: '2014', titulo: 'Trabalho', orientador: 'Orientador X', coorientador: 'Co Y', bolsa: 'CAPES' })));
items.push(mk('POS_DOUTORADO', 'FORMACAO', { tipo: 'Pós-Doutorado', instituicao: 'USP', anoInicio: '2015', anoFim: '2016', titulo: 'PD', bolsa: 'FAPESP' }));
items.push(mk('POS_DOUTORADO', 'FORMACAO', { tipo: 'Livre-docência', instituicao: 'USP', anoFim: '2018', titulo: 'LD' }));
// Formação complementar — todos os níveis (só MBA tem bolsa/orientador/monografia/áreas/palavras-chave/setores)
['Curso de curta duração', 'Extensão universitária', 'Outros'].forEach(nivel =>
    items.push(mk('FORMACAO_COMPLEMENTAR', 'FORMACAO', { nivel, titulo: 'Curso ' + nivel, instituicao: 'UNIFESP', cargaHoraria: '40', anoInicio: '2021', anoFim: '2021' })));
items.push(mk('FORMACAO_COMPLEMENTAR', 'FORMACAO', {
    nivel: 'MBA', titulo: 'MBA em Gestão', instituicao: 'FGV', cargaHoraria: '360', anoInicio: '2019', anoFim: '2020',
    anoObtencaoTitulo: '2020', comBolsa: 'Sim', bolsa: 'CAPES', tituloMonografia: 'Gestão pública aplicada',
    orientador: 'Orientador MBA', palavrasChave: 'gestão; pública', grandeArea: 'Ciências Sociais Aplicadas', area: 'Administração',
}));
// Produção Técnica: Assessoria/consultoria, Extensão tecnológica, Trabalhos
// técnicos (mesmo elemento TRABALHO-TECNICO), Produtos, Processos ou técnicas
// — todos com os campos que faltavam (auditoria vs. Lattes real). "Extensão
// tecnológica" tanto como TIPO (EXTENSAO_TECNOLOGICA) quanto como valor de
// Natureza em Trabalhos técnicos deve degradar pra "Outra" no XML (o DTD real
// não aceita o token EXTENSAO_TECNOLOGICA nesse enum, só o XSD).
items.push(mk('ASSESSORIA_CONSULTORIA', 'PRODUCOES', {
    natureza: 'Consultoria', titulo: 'Consultoria em TI', ano: '2022', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Meio digital', url: 'https://example.org/assessoria', relevante: 'Sim',
    autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    finalidade: 'Modernização de sistemas', duracaoMeses: '6', paginas: '30', disponibilidade: 'Sob solicitação',
    cidade: 'São Paulo', instituicao: 'Banco X', palavrasChave: 'ti; consultoria',
    grandeArea: 'Ciências Sociais Aplicadas', area: 'Administração', outrasInfo: 'Observação livre.',
}));
items.push(mk('EXTENSAO_TECNOLOGICA', 'PRODUCOES', {
    titulo: 'Extensão em manejo agrícola', ano: '2021', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Impresso', relevante: 'Não', autoresLista: [{ nomeCompleto: 'Beltrano', nomeCitacao: 'B.' }],
    finalidade: 'Capacitação rural', duracaoMeses: '3', cidade: 'Ribeirão Preto', instituicao: 'EMBRAPA',
}));
items.push(mk('TRABALHO_TECNICO', 'PRODUCOES', {
    natureza: 'Extensão tecnológica', titulo: 'Trabalho técnico ET', ano: '2020', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Outro', relevante: 'Sim', autoresLista: [{ nomeCompleto: 'Ciclana', nomeCitacao: 'C.' }],
    finalidade: 'Diagnóstico técnico', duracaoMeses: '2', paginas: '15', disponibilidade: 'Publicado',
    cidade: 'Campinas', instituicao: 'UNICAMP',
}));
items.push(mk('PRODUTO_TECNOLOGICO', 'PRODUCOES', {
    natureza: 'Protótipo', naturezaProduto: 'Instrumento', titulo: 'Sensor de umidade', ano: '2023', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Meio digital', url: 'https://example.org/produto', relevante: 'Sim', potencialInovacao: 'Sim',
    autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    finalidade: 'Monitoramento agrícola', disponibilidade: 'Comercial', cidade: 'Piracicaba', instituicao: 'FAPESP',
    palavrasChave: 'sensor; agricultura', grandeArea: 'Engenharias', area: 'Engenharia Agrícola',
}));
items.push(mk('PROCESSO_TECNICA', 'PRODUCOES', {
    natureza: 'Instrumental', titulo: 'Técnica de extração', ano: '2022', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Hipertexto', url: 'https://example.org/processo', relevante: 'Não', potencialInovacao: 'Sim',
    autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    finalidade: 'Extração de compostos', disponibilidade: 'Restrita', cidade: 'São Carlos', instituicao: 'CNPq',
}));
// Produção Técnica sub-lote 2: Programa de computador sem registro, Cartas/
// mapas ou similares, Curso de curta duração ministrado, Desenvolvimento de
// material didático ou instrucional, Editoração — campos que faltavam.
items.push(mk('SOFTWARE_SEM_REGISTRO', 'PRODUCOES', {
    natureza: 'Computacional', titulo: 'Sistema de gestão acadêmica', ano: '2021', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Meio digital', url: 'https://example.org/software', relevante: 'Sim', divulgacaoCT: 'Sim', potencialInovacao: 'Sim',
    autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    finalidade: 'Gestão de matrículas', plataforma: 'Web', disponibilidade: 'Irrestrita', instituicao: 'UNIFESP',
    palavrasChave: 'software; gestão', grandeArea: 'Ciências Exatas e da Terra', area: 'Ciência da Computação', outrasInfo: 'Resumo livre.',
}));
items.push(mk('CARTA_MAPA', 'PRODUCOES', {
    natureza: 'Mapa', titulo: 'Mapa geológico da bacia X', ano: '2019', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Impresso', relevante: 'Sim', autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    finalidade: 'Mapeamento geológico', tema: 'Geologia estrutural', tecnica: 'Sensoriamento remoto',
    areaRepresentada: 'Bacia sedimentar X', instituicao: 'CNPq',
}));
items.push(mk('CURSO_MINISTRADO', 'PRODUCOES', {
    nivel: 'Extensão', titulo: 'Curso de introdução a Python', ano: '2022', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Meio digital', relevante: 'Sim', divulgacaoCT: 'Sim', participacaoAutores: 'Docente',
    autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    cargaHoraria: '20', unidade: 'horas', instituicao: 'UNIFESP', local: 'Auditório Central', cidade: 'São Paulo',
}));
items.push(mk('MATERIAL_DIDATICO', 'PRODUCOES', {
    natureza: 'Apostila impressa', titulo: 'Apostila de cálculo I', ano: '2020', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Impresso', relevante: 'Não', divulgacaoCT: 'Sim',
    autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    finalidade: 'Apoio didático',
}));
items.push(mk('EDITORACAO', 'PRODUCOES', {
    natureza: 'Anais', titulo: 'Anais do congresso X', ano: '2018', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Impresso e mídia eletrônica', relevante: 'Sim',
    autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    paginas: '300', instituicao: 'Universidade Y', editora: 'Editora Universitária', cidade: 'São Paulo',
}));
// Produção Técnica sub-lote 3 (final): Manutenção de obra artística, Maquete,
// Entrevistas/mesas redondas/mídia, Relatório de pesquisa, Redes sociais/
// websites/blogs (Natureza x Tema — antes um único campo alimentava os dois
// atributos de exportação), Outra produção técnica.
items.push(mk('MANUTENCAO_OBRA', 'PRODUCOES', {
    tipo: 'Restauração', natureza: 'Escultura', titulo: 'Restauro de escultura sacra', ano: '2021', pais: 'Brasil', idioma: 'Português',
    relevante: 'Sim', autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    nomeObra: 'Nossa Senhora Aparecida', autorObra: 'Artista Anônimo', anoObra: '1850', acervo: 'Público',
    finalidade: 'Igreja Matriz', cidade: 'Aparecida', palavrasChave: 'restauro; escultura',
}));
items.push(mk('MAQUETE', 'PRODUCOES', {
    titulo: 'Maquete do campus novo', ano: '2020', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Meio digital', url: 'https://example.org/maquete', relevante: 'Sim',
    autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    finalidade: 'Apresentação do projeto', objetoRepresentado: 'Campus universitário', materialUtilizado: 'Isopor e MDF', instituicao: 'UNIFESP',
}));
items.push(mk('MIDIA', 'PRODUCOES', {
    tipo: 'Outra', titulo: 'Entrevista sobre mudanças climáticas', ano: '2022', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Meio digital', relevante: 'Sim', divulgacaoCT: 'Sim',
    autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    veiculo: 'Rádio X', tema: 'Aquecimento global', dataRealizacao: '15/03/2022', duracaoMinutos: '30', cidade: 'São Paulo',
}));
items.push(mk('RELATORIO_PESQUISA', 'PRODUCOES', {
    titulo: 'Relatório final do projeto X', ano: '2021', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Impresso', relevante: 'Sim', autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    nomeProjeto: 'Projeto X', paginas: '80', disponibilidade: 'Restrita', instituicao: 'FAPESP',
}));
items.push(mk('MIDIA_SOCIAL', 'PRODUCOES', {
    natureza: 'Blog', titulo: 'Blog de divulgação científica', ano: '2020', pais: 'Brasil', idioma: 'Português',
    url: 'https://example.org/blog', relevante: 'Sim', divulgacaoCT: 'Sim', plataforma: 'Divulgação científica',
    autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
}));
items.push(mk('OUTRA_TECNICA', 'PRODUCOES', {
    natureza: 'Vistoria técnica', titulo: 'Consultoria técnica avulsa', ano: '2019', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Impresso', relevante: 'Não', divulgacaoCT: 'Sim',
    autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    finalidade: 'Vistoria predial', instituicao: 'Prefeitura Municipal', local: 'Sede administrativa', cidade: 'Campinas',
}));
// Outra produção artística/cultural: Artes cênicas e Música — campos que
// faltavam (Natureza como select real, Meio de divulgação, estreia,
// premiação, obra de referência, autores em lista). Música soma Formação
// instrumental e Ineditismo da obra (ausente em Artes cênicas por limitação
// genuína do schema — DETALHAMENTO-DE-ARTES-CENICAS não tem o atributo).
items.push(mk('ARTES_CENICAS', 'PRODUCOES', {
    natureza: 'Teatral', titulo: 'Espetáculo Auto da Compadecida', ano: '2019', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Meio digital', url: 'https://example.org/espetaculo', relevante: 'Sim', divulgacaoCT: 'Sim',
    tipoEvento: 'Festival', atividadeAutores: 'Direção', autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    dataEstreia: '10/05/2019', localEstreia: 'Teatro Municipal', premiacao: 'Prêmio Shell', instituicaoPremio: 'Fundação Shell',
    duracaoMinutos: '90', temporada: '2019/1', evento: 'Festival de Teatro de Curitiba', localEvento: 'Teatro Guaíra', cidade: 'Curitiba',
}));
items.push(mk('MUSICA', 'PRODUCOES', {
    natureza: 'Composição', titulo: 'Concerto para violino e orquestra', ano: '2021', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Filme', relevante: 'Sim', formacaoInstrumental: 'Violino solo e orquestra de cordas', ineditismo: 'Sim',
    autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    obraReferencia: 'Concerto em Ré Maior', autorObraReferencia: 'Compositor X', anoObraReferencia: '1900',
}));
// Outra produção artística/cultural (parte 2 final): Artes visuais e Outra
// produção artística/cultural — esta última é a maior limitação de schema da
// seção 5: a tela real tem ~15 campos de detalhamento, o XSD/DTD só suporta 5.
items.push(mk('ARTES_VISUAIS', 'PRODUCOES', {
    natureza: 'Instalação', titulo: 'Instalação sobre memória urbana', ano: '2022', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Meio digital', url: 'https://example.org/instalacao', relevante: 'Sim', divulgacaoCT: 'Sim',
    atividadeAutores: 'Curadoria', autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    premiacao: 'Prêmio Marcantonio Vilaça', temporada: '2022/2', evento: 'Bienal de São Paulo', localEvento: 'Pavilhão Ciccillo Matarazzo', cidade: 'São Paulo',
}));
items.push(mk('OUTRA_ARTISTICA', 'PRODUCOES', {
    natureza: 'Intervenção coletiva', titulo: 'Performance urbana coletiva', ano: '2020', pais: 'Brasil', idioma: 'Português',
    meioDivulgacao: 'Hipertexto', relevante: 'Sim', divulgacaoCT: 'Sim',
    autoresLista: [{ nomeCompleto: 'Fulano de Tal', nomeCitacao: 'TAL, F.' }],
    premiacao: 'Menção honrosa', evento: 'Coletivo Arte Urbana', localEvento: 'Praça Central', cidade: 'Belo Horizonte',
}));
// Livro e capítulo
items.push(mk('LIVRO_CAPITULO', 'PRODUCOES', { tipoObra: 'Livro publicado', titulo: 'Meu Livro', ano: '2020', autores: 'TAL, F.', editora: 'Ed', cidade: 'SP', isbn: '978-1', paginas: '200' }));
items.push(mk('LIVRO_CAPITULO', 'PRODUCOES', { tipoObra: 'Capítulo de livro', titulo: 'Meu Capítulo', ano: '2021', autores: 'TAL, F.; X, Y', tituloLivro: 'Coletânea', organizadores: 'Org Z', editora: 'Ed', paginas: '10-30', isbn: '978-2' }));
// Orientações concluídas — todas as naturezas + campos novos (modalidade só em
// Mestrado, idioma, home page, palavras-chave, área do conhecimento, outras informações)
['Mestrado', 'Doutorado', 'Pós-Doutorado', 'Especialização / Monografia', 'TCC / Graduação', 'Iniciação científica', 'Outra'].forEach(tipo =>
    items.push(mk('ORIENTACAO_CONCLUIDA', 'ORIENTACOES', {
        orientando: 'Aluno ' + tipo, tipo, modalidade: tipo === 'Mestrado' ? 'Profissionalizante' : '',
        natureza: 'Orientador principal', titulo: 'Tese ' + tipo, curso: 'PPG', instituicao: 'UNIFESP', bolsa: 'CNPq',
        ano: '2019', pais: 'Brasil', idioma: 'Português', url: 'https://example.org/orientacao',
        palavrasChave: 'clima; saúde', grandeArea: 'Ciências da Saúde', area: 'Medicina', subarea: 'Clínica Médica',
        especialidade: 'Cardiologia', outrasInfo: 'Observação livre.',
    })));
// Orientações em andamento — todas as naturezas + mesmos campos novos
['Mestrado', 'Doutorado', 'Pós-Doutorado', 'Especialização / Monografia', 'TCC / Graduação', 'Iniciação científica', 'Outra'].forEach(tipo =>
    items.push(mk('ORIENTACAO_ANDAMENTO', 'ORIENTACOES', {
        orientando: 'And ' + tipo, tipo, modalidade: tipo === 'Mestrado' ? 'Acadêmico' : '',
        natureza: 'Coorientador', titulo: 'Trab ' + tipo, curso: 'PPG', instituicao: 'UNIFESP',
        ano: '2024', pais: 'Brasil', idioma: 'Português', url: 'https://example.org/orientacao-andamento',
        palavrasChave: 'clima; saúde', grandeArea: 'Ciências da Saúde', area: 'Medicina', subarea: 'Clínica Médica',
        especialidade: 'Cardiologia', outrasInfo: 'Observação livre.',
    })));
// Bancas de conclusão — todas as naturezas + campos novos (modalidade só em
// Mestrado, país/idioma/home page, palavras-chave, área do conhecimento, outras informações)
[
    { tipo: 'Mestrado', modalidade: 'Acadêmico' },
    { tipo: 'Doutorado' },
    { tipo: 'Exame de qualificação de mestrado' },
    { tipo: 'Exame de qualificação de doutorado' },
    { tipo: 'Curso de aperfeiçoamento/especialização' },
    { tipo: 'Graduação' },
].forEach(({ tipo, modalidade }) => items.push(mk('BANCA_CONCLUSAO', 'BANCAS', {
    tipo, modalidade, candidato: 'Cand ' + tipo, titulo: 'Banca ' + tipo, curso: 'PPG', instituicao: 'UNIFESP',
    membros: 'Prof A; Prof B', ano: '2022', pais: 'Brasil', idioma: 'Português', url: 'https://example.org/banca',
    palavrasChave: 'chuva; seca; clima', grandeArea: 'Ciências da Saúde', area: 'Medicina', subarea: 'Clínica Médica',
    especialidade: 'Cardiologia', outrasInfo: 'Observação livre.',
})));
// Bancas julgadoras — todas as naturezas + campos novos
['Concurso público', 'Professor titular', 'Livre-docência', 'Avaliação de cursos', 'Outra'].forEach(tipo =>
    items.push(mk('BANCA_JULGADORA', 'BANCAS', {
        tipo, titulo: 'Julg ' + tipo, instituicao: 'UNIFESP', membros: 'Prof A; Prof B', ano: '2023',
        pais: 'Brasil', idioma: 'Português', url: 'https://example.org/banca-julgadora',
        palavrasChave: 'gestão; avaliação', grandeArea: 'Ciências Sociais Aplicadas', area: 'Administração',
        outrasInfo: 'Observação livre.',
    })));
// Participação em eventos — todas as naturezas
['Congresso', 'Seminário', 'Simpósio', 'Oficina', 'Encontro', 'Olimpíada', 'Feira', 'Exposição', 'Outra'].forEach(natureza =>
    items.push(mk('PARTICIPACAO_EVENTO', 'EVENTOS', { titulo: 'Evento ' + natureza, natureza, formaParticipacao: 'Participante', tipoParticipacao: 'Conferencista', tituloApresentacao: 'Palestra', classificacao: 'Nacional', ano: '2023', pais: 'Brasil', cidade: 'SP' })));
// Licenças
items.push(mk('LICENCA', 'DADOS_GERAIS', { titulo: 'Licença', tipo: 'Maternidade', anoInicio: '2020', anoFim: '2020' }));
items.push(mk('LICENCA', 'DADOS_GERAIS', { titulo: 'Licença', tipo: 'Paternidade' }));
// Patente com datas
items.push(mk('PATENTE', 'PATENTES_REGISTROS', { titulo: 'Invento', ano: '2020', autores: 'TAL, F.', categoria: 'Nacional', finalidade: 'X', registro: 'BR123', dataDeposito: '2019-05-10', dataConcessao: '2022-08-01', situacao: 'Concedida', instituicao: 'UNIFESP', pais: 'Brasil' }));
// Atuação com atividades
items.push(mk('VINCULO_PROFISSIONAL', 'ATUACAO', { instituicao: 'UNIFESP', vinculo: 'Servidor', vinculoEmpregaticio: 'Sim', cargo: 'Professor', dedicacaoExclusiva: 'Sim', cargaHoraria: '40', anoInicio: '2010', situacao: 'Atual (não finalizado)', anoFim: '' }));
items.push(mk('VINCULO_PROFISSIONAL', 'ATUACAO', { instituicao: 'UNIFESP', vinculo: 'Colaborador', vinculoEmpregaticio: 'Não', cargo: 'Pesquisador visitante', dedicacaoExclusiva: 'Não', cargaHoraria: '10', anoInicio: '2005', situacao: 'Anterior (finalizado)', anoFim: '2009' }));
items.push(mk('ATIV_ENSINO', 'ATUACAO', { instituicao: 'UNIFESP', nivel: 'Graduação', curso: 'Medicina', anoInicio: '2011', situacao: 'Anterior (finalizado)', anoFim: '2020', disciplinas: 'Anatomia; Fisiologia' }));
items.push(mk('ATIV_DIRECAO', 'ATUACAO', { titulo: 'Coordenador', orgao: 'Departamento', instituicao: 'UNIFESP', anoInicio: '2015', situacao: 'Anterior (finalizado)', anoFim: '2017' }));
items.push(mk('ATIV_CONSELHO', 'ATUACAO', { titulo: 'Membro', orgao: 'Conselho X', instituicao: 'UNIFESP', anoInicio: '2016', situacao: 'Atual (não finalizado)', anoFim: '' }));
items.push(mk('ATIV_PESQUISA', 'ATUACAO', { instituicao: 'UNIFESP', orgao: 'Laboratório de Genética', anoInicio: '2018', situacao: 'Atual (não finalizado)', anoFim: '', titulo: 'Genética molecular; Bioinformática' }));
items.push(mk('ATIV_ESTAGIO', 'ATUACAO', { instituicao: 'UNIFESP', orgao: 'Ambulatório', anoInicio: '2012', situacao: 'Anterior (finalizado)', anoFim: '2013', titulo: 'Estágio em Clínica Médica' }));
items.push(mk('ATIV_TREINAMENTO', 'ATUACAO', { instituicao: 'UNIFESP', orgao: 'Núcleo de Ensino', anoInicio: '2019', situacao: 'Atual (não finalizado)', anoFim: '', titulo: 'Treinamento em Bioestatística; Treinamento em Metodologia Científica' }));
items.push(mk('ATIV_TREINAMENTO', 'ATUACAO', { instituicao: 'UNIFESP', orgao: 'Sem tags', anoInicio: '2019', titulo: '' }));
// Projetos com blocos "repeater" (Equipe, Instituições envolvidas, Financiadores, Produção C&T, Orientações)
items.push(mk('PROJETO_PESQUISA', 'PROJETOS', {
    titulo: 'Genômica aplicada', descricao: 'Estudo X', natureza: 'Pesquisa', situacao: 'Em andamento',
    anoInicio: '2020', anoFim: '', cooperacaoEmpresa: 'Sim', potencialInovacao: 'Sim',
    instituicaoExecucaoNome: 'UNIFESP', instituicaoExecucaoSigla: 'UNIFESP', instituicaoExecucaoPais: 'Brasil', instituicaoExecucaoUf: 'SP',
    orgaoUnidade: 'Depto. de Genética',
    equipe: [{ nome: 'Fulano de Tal', coordenador: true }, { nome: 'Beltrano', coordenador: false }],
    instituicoesEnvolvidas: [{ nome: 'USP', sigla: 'USP', pais: 'Brasil', uf: 'SP' }, { nome: 'Fiocruz', sigla: '', pais: 'Brasil', uf: 'RJ' }],
    qtdGraduacao: '3', qtdEspecializacao: '0', qtdMestradoAcademico: '2', qtdMestradoProfissional: '0', qtdDoutorado: '1',
    financiadores: [{ nome: 'CNPq', sigla: '', pais: 'Brasil', uf: 'DF', codigoProjeto: 'ABC-123', valor: '50000', natureza: 'Bolsa' }, { nome: 'FAPESP', sigla: '', pais: 'Brasil', uf: 'SP', codigoProjeto: '', valor: '', natureza: 'Auxílio financeiro' }],
    producoesCT: [{ titulo: 'Protocolo de sequenciamento', ano: '2022', tipo: 'Produto técnico' }],
    orientacoesProjeto: [{ titulo: 'Estudo de caso em genômica', ano: '2023', tipo: 'Mestrado' }],
}));
items.push(mk('PROJETO_DESENVOLVIMENTO', 'PROJETOS', {
    titulo: 'Sensor de baixo custo', natureza: 'Desenvolvimento', situacao: 'Concluído', anoInicio: '2018', anoFim: '2019',
    qtdTecnicoNivelMedio: '2', qtdGraduacao: '1',
    equipe: [{ nome: 'Cicrano', coordenador: true }],
    financiadores: [], producoesCT: [], orientacoesProjeto: [],
}));
items.push(mk('PROJETO_ENSINO', 'PROJETOS', {
    titulo: 'Ensino híbrido', natureza: 'Ensino', situacao: 'Em andamento', anoInicio: '2021',
    cooperacaoTipos: 'Instituição de ensino; Empresa', acoesInovadoras: 'Sim',
    acoesInovadorasNiveis: 'Graduação; Especialização', tematica: 'Ensino e aprendizagem; Outra', tematicaOutra: 'Gamificação',
    objetivosMetas: 'Melhorar engajamento', equipe: [{ nome: 'Fulana', coordenador: true }],
    qtdEnsinoFundamental: '0', qtdEnsinoMedio: '0', qtdGraduacao: '5',
}));
// Sem nenhuma linha nos repeaters (equipe/financiadores/produções/orientações
// vazios) — não deve gerar EQUIPE-DO-PROJETO/FINANCIADORES-DO-PROJETO/etc.
items.push(mk('PROJETO_OUTRO', 'PROJETOS', { titulo: 'Projeto mínimo', anoInicio: '2024' }));

const xml = LattesXMLExport.build(items, { numeroIdentificador: '1234567890123456' });
const bytes = LzEncoding.encodeLatin1Xml(xml);
writeFileSync(OUT, Buffer.from(bytes));
console.log(`Itens: ${items.length} — XML ${bytes.length} bytes`);
try {
    execFileSync('xmllint', ['--noout', '--schema', XSD, OUT], { stdio: 'pipe' });
    console.log('✅ VÁLIDO no XSD (todos os ramos)');
} catch (e) {
    console.error('❌ INVÁLIDO (XSD):\n' + ((e.stderr || '') + (e.stdout || '')).toString().split('\n').slice(0, 40).join('\n'));
    process.exit(1);
}
// DTD LMPL (importação Lattes) — ignora só ORCID-ID (extensão que o DTD 2004 predata)
const DTD = join(root, 'docs', 'LMPLCurriculo.DTD');
try {
    execFileSync('xmllint', ['--noout', '--dtdvalid', DTD, OUT], { stdio: 'pipe' });
    console.log('✅ VÁLIDO no DTD LMPL (todos os ramos)');
} catch (e) {
    const reais = ((e.stderr || '') + (e.stdout || '')).toString().split('\n').filter(l => /validity error/.test(l) && !/ORCID-ID/.test(l));
    if (reais.length) { console.error('❌ INVÁLIDO (DTD LMPL):\n' + reais.slice(0, 40).join('\n')); process.exit(1); }
    console.log('✅ VÁLIDO no DTD LMPL (todos os ramos) — só ORCID-ID (aceito)');
}
