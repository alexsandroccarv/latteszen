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
   lattesZen — Campos e construtores reutilizados pelas definições de tipo
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração): átomos de campo
   (F_TITULO, F_ANO...) e construtores de bloco (projetoFieldsPadrao,
   alImprensaFields...) compartilhados entre as definições de tipo dos
   arquivos lattes-types-*.js. Nenhuma mudança de conteúdo — só saiu do
   arquivo único original.

   i18n (preparação — app ainda só em português, ver i18n.js): todo texto
   de EXIBIÇÃO (label/help/addLabel/placeholder instrucional) passa por
   t(). Os arrays de OPTIONS da própria taxonomia (NIVEIS_FORMACAO,
   NATUREZA_PROJETO_OPTIONS etc., e todo `options: [...]` inline nos
   arquivos lattes-types-NN-*.js) viram `{ value, label }` via opcoes()
   abaixo: `value` continua o MESMO literal de sempre (armazenado no
   item, comparado em disabledWhen/enabledWhenCol/forceValueWhen/
   labelWhen, mapeado na exportação XML Lattes) — só `label` passa a ser
   traduzível. Isso preserva 100% a compatibilidade com item já salvo e
   com o XML, sem exigir nenhuma migração de dado. `default: 'Brasil'` e
   as CHAVES dos mapas `disabledWhen.in`/`enabledWhenCol.equals`/
   `forceValueWhen.map`/`labelWhen.map`/`descriptions` continuam
   literais (precisam bater com `value`, não com `label`).

   Listas GRANDES ainda não convertidas nesta fase (país/idioma/CNAE —
   window.PAISES_LATTES/IDIOMAS_LATTES/CNAE_SETORES, ver
   paises.js/idiomas.js/cnae.js) continuam string[] simples — os pontos
   que leem `field.options` (tab-catalogar.js, lattes-xml.js) aceitam os
   dois formatos ao mesmo tempo (ver optVal/optLabel em tab-catalogar.js),
   então nada quebra; só ainda não ficaram traduzíveis.
   ========================================================================== */
import { t } from './i18n.js';

// Gera uma chave i18n estável a partir do valor da própria opção
// (minúsculas, sem acento, não-alfanumérico vira "_") — usada por
// opcoes() abaixo, sob um namespace por lista (evita colisão entre
// listas diferentes que compartilham um valor, ex. duas listas com
// "Outra").
function slugOpcao(v) {
    return String(v).toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
// Converte uma lista de valores literais (formato antigo de `options`)
// numa lista de pares { value, label }: `value` continua o MESMO
// literal (comparado/armazenado/exportado sem mudança), `label` passa
// por t() com chave derivada automaticamente do próprio valor.
function opcoes(namespace, valores) {
    return valores.map(v => ({ value: v, label: t(`lattes.opcao.${namespace}.${slugOpcao(v)}`, v) }));
}

// Átomos de campo reutilizados
const F_TITULO  = { key: 'titulo', label: t('campos.f_titulo.label', 'Título'), type: 'text', required: true };
const F_ANO     = { key: 'ano', label: t('campos.f_ano.label', 'Ano de início'), type: 'datebr', required: true };
const F_DOI     = { key: 'doi', label: t('campos.f_doi.label', 'DOI'), type: 'text', placeholder: '10.xxxx/xxxxx' };
const F_URL     = { key: 'url', label: t('campos.f_url.label', 'URL / Link'), type: 'url' };
const F_AUTORES = { key: 'autores', label: t('campos.f_autores.label', 'Autores'), type: 'textarea', placeholder: t('campos.f_autores.placeholder', 'Separe por ponto e vírgula (;)') };
const F_INST    = { key: 'instituicao', label: t('campos.f_inst.label', 'Instituição'), type: 'text' };
const F_FINAL   = { key: 'finalidade', label: t('campos.f_final.label', 'Finalidade / Descrição'), type: 'textarea' };
const F_CIDADE  = { key: 'cidade', label: t('campos.f_cidade.label', 'Cidade'), type: 'text' };
const F_NATUREZA = (options) => ({ key: 'natureza', label: t('campos.f_natureza.label', 'Natureza'), type: 'select', options });
const F_AINI = { key: 'anoInicio', label: t('campos.f_aini.label', 'Ano de início'), type: 'datebr' };
const F_AFIM = { key: 'anoFim', label: t('campos.f_afim.label', 'Ano de fim'), type: 'datebr', row: 'periodo' };
// Datas completas (dd/mm/aaaa) usadas na categoria Atuação. Na exportação XML
// Lattes apenas o ANO é mantido (o schema só aceita ANO-INICIO/ANO-FIM).
const F_DINI = { key: 'anoInicio', label: t('campos.f_dini.label', 'Data de início'), type: 'datebr' };
const F_DFIM = { key: 'anoFim', label: t('campos.f_dfim.label', 'Data de fim (vazio = atual)'), type: 'datebr' };
const F_PAIS = { key: 'pais', label: t('campos.f_pais.label', 'País'), type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' };
const F_IDIOMA = { key: 'idioma', label: t('campos.f_idioma.label', 'Idioma'), type: 'select', options: window.IDIOMAS_LATTES || [] };
// Opções de "Meio de divulgação" (Livros/Capítulos) — enum MEIO-DE-DIVULGACAO
// do schema Lattes, exceto WEB (não usada na tela real para estes tipos).
const MEIO_DIVULGACAO_OPTIONS = opcoes('meio_divulgacao', ['Impresso', 'Meio magnético', 'Meio digital', 'Filme', 'Hipertexto', 'Outro', 'Impresso e mídia eletrônica']);
// Período usado nos itens de Atuação (Vínculo, Corpo editorial, Comitê,
// Revisor...): Início, Situação (Atual/Anterior) e Fim — o Fim só aparece
// quando a Situação é "Anterior (finalizado)", como na tela real do Lattes.
const periodoComSituacao = () => [
    { key: 'anoInicio', label: t('campos.periodo_com_situacao.ano_inicio', 'Início (mês/ano)'), type: 'datebr', row: 'periodo' },
    { key: 'situacao', label: t('campos.periodo_com_situacao.situacao', 'Situação'), type: 'select', options: opcoes('periodo_situacao', ['Atual (não finalizado)', 'Anterior (finalizado)']), row: 'periodo' },
    { key: 'anoFim', label: t('campos.periodo_com_situacao.ano_fim', 'Fim (mês/ano)'), type: 'datebr', row: 'periodo', disabledWhen: { field: 'situacao', in: ['', 'Atual (não finalizado)'] } },
];

// Níveis de Formação acadêmica/titulação (espelha FORMACAO-ACADEMICA-TITULACAO
// do schema Lattes) e um atalho para "todos os níveis, exceto os informados"
// — usado nos `disabledWhen` dos campos específicos de cada nível abaixo
// (que comparam contra VALOR, por isso nivelExcept() extrai .value antes de
// filtrar — devolve strings simples, nunca os pares {value,label}).
// Inclui '' (nenhum Nível escolhido ainda) na lista de exclusão: assim, antes
// de escolher o Nível, nenhum campo específico de um nível aparece.
const NIVEIS_FORMACAO = opcoes('nivel_formacao', ['Ensino fundamental', 'Ensino médio', 'Curso técnico', 'Graduação', 'Aperfeiçoamento',
    'Especialização', 'Mestrado', 'Mestrado profissional', 'Doutorado', 'Residência médica']);
const nivelExcept = (...keep) => [...NIVEIS_FORMACAO.map(o => o.value).filter(n => !keep.includes(n)), ''];

// Conjuntos de campos reutilizáveis
// Projetos (Dados gerais + Equipe/Financiadores/Produção C&T/Orientações, na
// ordem e com os campos das telas reais do Lattes). Os blocos em tabela
// (Equipe, Instituições envolvidas, Financiamento, Produção C&T, Orientações)
// usam o tipo `repeater` (lista com adicionar/editar/remover linha).
const NATUREZA_PROJETO_OPTIONS = opcoes('natureza_projeto', ['Desenvolvimento', 'Extensão', 'Pesquisa', 'Ensino', 'Outra']);
const SITUACAO_PROJETO_OPTIONS = opcoes('situacao_projeto', ['Em andamento', 'Concluído', 'Desativado']);
const FINANCIADOR_NATUREZA_OPTIONS = opcoes('financiador_natureza', ['Bolsa', 'Auxílio financeiro', 'Remuneração', 'Outro', 'Cooperação', 'Não informado']);
const QTD_ALUNOS_BASE = [
    { key: 'qtdGraduacao', label: t('campos.qtd_alunos.graduacao', 'Graduação'), type: 'number', row: 'qtdAlunos' },
    { key: 'qtdEspecializacao', label: t('campos.qtd_alunos.especializacao', 'Especialização'), type: 'number', row: 'qtdAlunos' },
    { key: 'qtdMestradoAcademico', label: t('campos.qtd_alunos.mestrado_academico', 'Mestrado acadêmico'), type: 'number', row: 'qtdAlunos' },
    { key: 'qtdMestradoProfissional', label: t('campos.qtd_alunos.mestrado_profissional', 'Mestrado profissionalizante'), type: 'number', row: 'qtdAlunos' },
    { key: 'qtdDoutorado', label: t('campos.qtd_alunos.doutorado', 'Doutorado'), type: 'number', row: 'qtdAlunos' },
];
const QTD_TECNICO = { key: 'qtdTecnicoNivelMedio', label: t('campos.qtd_tecnico.label', 'Técnico de nível médio'), type: 'number', row: 'qtdAlunos' };
const QTD_FUNDAMENTAL = { key: 'qtdEnsinoFundamental', label: t('campos.qtd_fundamental.label', 'Ensino Fundamental (1º grau)'), type: 'number', row: 'qtdAlunos' };
const QTD_MEDIO = { key: 'qtdEnsinoMedio', label: t('campos.qtd_medio.label', 'Ensino Médio (2º grau)'), type: 'number', row: 'qtdAlunos' };

const projetoEquipeField = (label, addLabel) => ({ key: 'equipe', label: label || t('campos.projeto_equipe.label', 'Equipe'), type: 'repeater',
    addLabel: addLabel || t('campos.projeto_equipe.add_label', 'Adicionar integrante da equipe'), columns: [
        { key: 'nome', label: t('campos.projeto_equipe.coluna_nome', 'Nome'), type: 'text', required: true },
        { key: 'coordenador', label: t('campos.projeto_equipe.coluna_coordenador', 'Coordenação'), type: 'checkbox' }] });
// "Informe os dados da instituição": Nome, Sigla, País, UF — UF só habilita
// quando País = Brasil (comparação sem acento/maiúscula, via enabledWhenCol).
// Reutilizado em toda coluna/campo "instituição" da categoria Projetos.
const institucaoColumns = () => [
    { key: 'nome', label: t('campos.instituicao_columns.nome', 'Nome da instituição'), type: 'text', required: true },
    { key: 'sigla', label: t('campos.instituicao_columns.sigla', 'Sigla'), type: 'text' },
    F_PAIS,
    { key: 'uf', label: t('campos.instituicao_columns.uf', 'UF'), type: 'text', enabledWhenCol: { key: 'pais', equals: 'Brasil' } },
];
const projetoInstituicoesEnvolvidasField = () => ({ key: 'instituicoesEnvolvidas', label: t('campos.projeto_instituicoes_envolvidas.label', 'Instituições envolvidas no projeto'), type: 'repeater',
    addLabel: t('campos.projeto_instituicoes_envolvidas.add_label', 'Adicionar instituição'), columns: institucaoColumns() });
const projetoFinanciadoresField = () => ({ key: 'financiadores', label: t('campos.projeto_financiadores.label', 'Instituição de financiamento'), type: 'repeater',
    addLabel: t('campos.projeto_financiadores.add_label', 'Adicionar financiador'), help: t('campos.projeto_financiadores.help', 'O valor financiado não será exibido na internet.'), columns: [
        ...institucaoColumns(),
        { key: 'codigoProjeto', label: t('campos.projeto_financiadores.coluna_codigo_projeto', 'Código do projeto'), type: 'text' },
        { key: 'valor', label: t('campos.projeto_financiadores.coluna_valor', 'Valor financiado'), type: 'number' },
        { key: 'natureza', label: t('campos.projeto_financiadores.coluna_natureza', 'Natureza'), type: 'select', options: FINANCIADOR_NATUREZA_OPTIONS }] });
// "Instituição de execução": mesmos 4 campos (Nome/Sigla/País/UF), mas como
// valor único (não é uma lista) — UF via disabledWhen.notEquals (só habilita
// quando País = Brasil).
const projetoInstituicaoExecucaoFields = () => [
    { key: 'instituicaoExecucaoNome', label: t('campos.projeto_instituicao_execucao.nome', 'Instituição de execução'), type: 'text' },
    { key: 'instituicaoExecucaoSigla', label: t('campos.projeto_instituicao_execucao.sigla', 'Sigla'), type: 'text', row: 'instExecucao' },
    { key: 'instituicaoExecucaoPais', label: t('campos.projeto_instituicao_execucao.pais', 'País'), type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil', row: 'instExecucao' },
    { key: 'instituicaoExecucaoUf', label: t('campos.projeto_instituicao_execucao.uf', 'UF'), type: 'text', row: 'instExecucao', disabledWhen: { field: 'instituicaoExecucaoPais', notEquals: 'Brasil' } },
];
const projetoProducoesField = () => ({ key: 'producoesCT', label: t('campos.projeto_producoes.label', 'Produção C&T'), type: 'repeater',
    addLabel: t('campos.projeto_producoes.add_label', 'Adicionar produção'), columns: [
        { key: 'titulo', label: t('campos.projeto_producoes.coluna_titulo', 'Título da produção'), type: 'text', required: true },
        { key: 'ano', label: t('campos.projeto_producoes.coluna_ano', 'Ano'), type: 'datebr' },
        { key: 'tipo', label: t('campos.projeto_producoes.coluna_tipo', 'Tipo'), type: 'text' }] });
const projetoOrientacoesField = () => ({ key: 'orientacoesProjeto', label: t('campos.projeto_orientacoes.label', 'Orientações'), type: 'repeater',
    addLabel: t('campos.projeto_orientacoes.add_label', 'Adicionar orientação'), columns: [
        { key: 'titulo', label: t('campos.projeto_orientacoes.coluna_titulo', 'Título da orientação'), type: 'text', required: true },
        { key: 'ano', label: t('campos.projeto_orientacoes.coluna_ano', 'Ano'), type: 'datebr' },
        { key: 'tipo', label: t('campos.projeto_orientacoes.coluna_tipo', 'Tipo'), type: 'text' }] });

// Bloco comum de Dados gerais + rodapé (Equipe...Orientações), usado pelas
// 4 naturezas "simples" de projeto (Pesquisa, Desenvolvimento, Extensão, Outro).
// `extraQtd` insere campos extras na "Quantidade de alunos envolvidos" (ex.:
// Técnico de nível médio, só em Desenvolvimento). `tituloLabel`/`natSitRow`
// são particularidades só de Projetos de pesquisa (ver PROJETO_PESQUISA).
const projetoFieldsPadrao = (extraQtdAntes, tituloLabel, natSitRow) => [
    { ...F_TITULO, label: tituloLabel || t('campos.projeto_fields_padrao.titulo', 'Título') },
    { key: 'descricao', label: t('campos.projeto_fields_padrao.descricao', 'Descrição'), type: 'textarea' },
    { ...F_NATUREZA(NATUREZA_PROJETO_OPTIONS), row: natSitRow ? 'naturezaSituacao' : undefined },
    { key: 'situacao', label: t('campos.projeto_fields_padrao.situacao', 'Situação'), type: 'select', options: SITUACAO_PROJETO_OPTIONS, row: natSitRow ? 'naturezaSituacao' : undefined },
    { key: 'anoInicio', label: t('campos.projeto_fields_padrao.ano_inicio', 'Ano início'), type: 'datebr', required: true, row: 'periodo' },
    { ...F_AFIM, label: t('campos.projeto_fields_padrao.ano_fim', 'Ano fim'), row: 'periodo' },
    { key: 'cooperacaoEmpresa', label: t('campos.projeto_fields_padrao.cooperacao_empresa', 'É um projeto de cooperação entre uma instituição de pesquisa e uma empresa?'), type: 'checkbox' },
    { key: 'empresaCnpj', label: t('campos.projeto_fields_padrao.empresa_cnpj', 'CNPJ da empresa'), type: 'text', placeholder: '00.000.000/0000-00', disabledWhen: { field: 'cooperacaoEmpresa', in: ['', 'Não'] } },
    { key: 'empresaNome', label: t('campos.projeto_fields_padrao.empresa_nome', 'Nome da empresa'), type: 'text', disabledWhen: { field: 'cooperacaoEmpresa', in: ['', 'Não'] } },
    { key: 'empresaEmail', label: t('campos.projeto_fields_padrao.empresa_email', 'E-mail Institucional'), type: 'text', placeholder: 'nome@empresa.com.br', disabledWhen: { field: 'cooperacaoEmpresa', in: ['', 'Não'] } },
    { key: 'empresaSetor', label: t('campos.projeto_fields_padrao.empresa_setor', 'Setor'), type: 'select', options: window.CNAE_SETORES || [], disabledWhen: { field: 'cooperacaoEmpresa', in: ['', 'Não'] } },
    { key: 'potencialInovacao', label: t('campos.projeto_fields_padrao.potencial_inovacao', 'O projeto possui potencial de inovação de produtos, processos ou serviços?'), type: 'checkbox' },
    { key: 'potencialInovacaoDescricao', label: t('campos.projeto_fields_padrao.potencial_inovacao_descricao', 'Qual o potencial de inovação do projeto?'), type: 'textarea', disabledWhen: { field: 'potencialInovacao', in: ['', 'Não'] } },
    ...projetoInstituicaoExecucaoFields(),
    { key: 'orgaoUnidade', label: t('campos.projeto_fields_padrao.orgao_unidade', 'Órgão/Unidade'), type: 'text' },
    projetoEquipeField(t('campos.projeto_fields_padrao.equipe_label', 'Equipe'), t('campos.projeto_fields_padrao.equipe_add_label', 'Adicionar integrante da equipe')),
    projetoInstituicoesEnvolvidasField(),
    ...(extraQtdAntes || []), ...QTD_ALUNOS_BASE,
    projetoFinanciadoresField(), projetoProducoesField(), projetoOrientacoesField(),
];
// Projeto de ensino: cooperação/inovação/temática são específicos dessa
// natureza na tela do Lattes e não têm atributo correspondente no schema
// (ficam só na interface — ver comentário em buildAtuacoes).
const ACOES_INOVADORAS_NIVEIS = opcoes('acoes_inovadoras_niveis', ['Ensino Fundamental (1º grau)', 'Ensino Médio (2º grau)', 'Graduação', 'Especialização', 'Mestrado', 'Mestrado Profissional', 'Doutorado']);
const TEMATICA_PROJETO_ENSINO = opcoes('tematica_projeto_ensino', ['Ensino e aprendizagem', 'Aprendizagem por projetos', 'Projetos de curso', 'Formação inicial ou continuada de professores',
    'Inserção de tecnologias no ensino', 'Ação inclusiva', 'Integração social (escola, família, comunidade)', 'Projeto de intervenção',
    'Mobilidade e internacionalização', 'Avaliação', 'Gestão', 'Outra']);
const PROJETO_ENSINO_FIELDS = [
    F_TITULO,
    { key: 'descricao', label: t('campos.projeto_ensino.descricao', 'Descrição'), type: 'textarea' },
    F_NATUREZA(NATUREZA_PROJETO_OPTIONS),
    { key: 'situacao', label: t('campos.projeto_ensino.situacao', 'Situação'), type: 'select', options: SITUACAO_PROJETO_OPTIONS },
    { key: 'anoInicio', label: t('campos.projeto_ensino.ano_inicio', 'Ano início'), type: 'datebr', required: true, row: 'periodo' },
    { ...F_AFIM, label: t('campos.projeto_ensino.ano_fim', 'Ano fim'), row: 'periodo' },
    { key: 'cooperacaoTipos', label: t('campos.projeto_ensino.cooperacao_tipos', 'É um projeto em cooperação com'), type: 'checkboxes', options: opcoes('projeto_ensino_cooperacao_tipos', ['Instituição de ensino', 'Agência de fomento', 'Empresa']) },
    { key: 'acoesInovadoras', label: t('campos.projeto_ensino.acoes_inovadoras', 'O projeto possui ações inovadoras e produtos, processos ou serviços?'), type: 'checkbox' },
    { key: 'acoesInovadorasNiveis', label: t('campos.projeto_ensino.acoes_inovadoras_niveis', 'O projeto possui ações inovadoras na'), type: 'checkboxes', options: ACOES_INOVADORAS_NIVEIS, disabledWhen: { field: 'acoesInovadoras', in: ['', 'Não'] } },
    { key: 'tematica', label: t('campos.projeto_ensino.tematica', 'Em relação à temática'), type: 'checkboxes', options: TEMATICA_PROJETO_ENSINO },
    { key: 'tematicaOutra', label: t('campos.projeto_ensino.tematica_outra', 'Especifique (se marcou "Outra" na temática)'), type: 'text' },
    { key: 'objetivosMetas', label: t('campos.projeto_ensino.objetivos_metas', 'Objetivos e metas'), type: 'textarea' },
    ...projetoInstituicaoExecucaoFields(),
    { key: 'orgaoUnidade', label: t('campos.projeto_ensino.orgao_unidade', 'Órgão/Unidade'), type: 'text' },
    projetoEquipeField(t('campos.projeto_ensino.participantes_label', 'Participantes'), t('campos.projeto_ensino.participantes_add_label', 'Adicionar participante')),
    projetoInstituicoesEnvolvidasField(),
    QTD_FUNDAMENTAL, QTD_MEDIO, ...QTD_ALUNOS_BASE,
    projetoFinanciadoresField(), projetoProducoesField(), projetoOrientacoesField(),
];
// Átomos para a categoria 20 (Registros pessoais)
const AL_ENT   = { key: 'entidade', label: t('campos.al_ent.label', 'Entidade'), type: 'text' };
const AL_PAPEL = { key: 'papel', label: t('campos.al_papel.label', 'Papel / Atuação'), type: 'text' };
const AL_FREQ  = { key: 'frequencia', label: t('campos.al_freq.label', 'Carga horária / Frequência'), type: 'text' };
const AL_IMP   = { key: 'descricao', label: t('campos.al_imp.label', 'Conquistas / Impacto'), type: 'textarea' };
const AL_LOCAL = { key: 'local', label: t('campos.al_local.label', 'Local / Cidade'), type: 'text' };
const AL_ANO   = { key: 'ano', label: t('campos.al_ano.label', 'Ano de início'), type: 'datebr' };
const alNome = (label) => ({ key: 'titulo', label, type: 'text', required: true });
// Campos padrão de uma certificação (nome+sigla, instituição emissora,
// obtenção/validade, código/link de verificação) — usados pelos 4 tipos de
// Certificações abaixo.
const alCertificacaoFields = () => [
    alNome(t('campos.al_certificacao.nome', 'Nome completo da certificação')),
    { key: 'sigla', label: t('campos.al_certificacao.sigla', 'Sigla'), type: 'text', row: 'certSiglaEnt' },
    { key: 'entidade', label: t('campos.al_certificacao.entidade', 'Instituição emissora'), type: 'text', placeholder: t('campos.al_certificacao.entidade_placeholder', 'ex.: PMI, ANBIMA, Scrum.org'), row: 'certSiglaEnt' },
    { key: 'anoInicio', label: t('campos.al_certificacao.ano_obtencao', 'Ano de obtenção'), type: 'datebr', row: 'certAnoVal' },
    { key: 'anoFim', label: t('campos.al_certificacao.validade_ate', 'Validade até'), type: 'datebr', row: 'certAnoVal' },
    { key: 'codigoVerificacao', label: t('campos.al_certificacao.codigo_verificacao', 'Código de verificação'), type: 'text', row: 'certCodLink' },
    { key: 'url', label: t('campos.al_certificacao.link_verificacao', 'Link de verificação'), type: 'url', row: 'certCodLink' },
];
// Campos padrão de uma filiação (entidade, categoria/cargo, nº de sócio,
// período) — usados pelos 5 tipos de Filiações abaixo.
const alFiliacaoFields = () => [
    alNome(t('campos.al_filiacao.entidade', 'Entidade')),
    { key: 'categoria', label: t('campos.al_filiacao.categoria', 'Categoria'), type: 'text', row: 'filCatSocio' },
    { key: 'numeroSocio', label: t('campos.al_filiacao.numero_socio', 'Número de sócio'), type: 'text', row: 'filCatSocio' },
    { ...F_AINI, row: 'periodo' }, F_AFIM,
];
// Campos padrão de uma menção na imprensa (título, veículo, data) — usados
// pelos 3 tipos de Imprensa abaixo. "Tipo de participação" tem opções
// diferentes por tipo (por isso `opcoesParticipacao` é parâmetro — cada um
// dos 3 tipos já É o "Tipo de item" que restringe as opções relevantes,
// sem precisar de lógica condicional em tempo de execução). "Formato da
// aparição" é a mesma lista pros 3.
const FORMATO_APARICAO_OPCOES = opcoes('formato_aparicao', ['Texto (Aspas/Declaração)', 'Vídeo ao vivo', 'Vídeo gravado', 'Áudio (Podcast/Rádio)', 'Foto', 'Nota Oficial']);
const alImprensaFields = (opcoesParticipacao) => [
    alNome(t('campos.al_imprensa.titulo', 'Título da matéria')),
    { key: 'tipoParticipacao', label: t('campos.al_imprensa.tipo_participacao', 'Tipo de participação'), type: 'select', options: opcoesParticipacao, row: 'impParticipacaoFormato' },
    { key: 'formatoAparicao', label: t('campos.al_imprensa.formato_aparicao', 'Formato da aparição'), type: 'select', options: FORMATO_APARICAO_OPCOES, row: 'impParticipacaoFormato' },
    { key: 'entidade', label: t('campos.al_imprensa.nome_veiculo', 'Nome do veículo'), type: 'text', required: true, row: 'impVeicData' },
    { key: 'ano', label: t('campos.al_imprensa.data_veiculacao', 'Data de veiculação'), type: 'datebr', required: true, row: 'impVeicData' },
];

// Campos padrão de um concurso/processo seletivo — usados pelos 7 tipos
// de "18. Concursos e processos seletivos" (um por "Tipo de item"; a
// classificação já está no próprio Tipo do item, sem campo duplicado
// dentro do formulário).
const alConcursoFields = () => [
    alNome(t('campos.al_concurso.nome', 'Nome do concurso / processo seletivo')),
    { key: 'local', label: t('campos.al_concurso.local', 'Local'), type: 'text' },
    { key: 'banca', label: t('campos.al_concurso.banca', 'Banca'), type: 'text' },
    { key: 'cargo', label: t('campos.al_concurso.cargo', 'Cargo'), type: 'text' },
    { ...F_AINI, row: 'periodo' }, F_AFIM,
    { key: 'colocacao', label: t('campos.al_concurso.colocacao', 'Colocação'), type: 'text' },
    { key: 'situacao', label: t('campos.al_concurso.situacao_final', 'Situação final'), type: 'select', options: opcoes('al_concurso_situacao_final', ['Em andamento', 'Aprovado', 'Reprovado']) },
];

// Autores como lista (Nome completo/Nome como citado) — mesmo padrão dos
// demais tipos de Produção bibliográfica (issue de auditoria vs. Lattes real).
const PROD_AUTORES_LISTA = { key: 'autoresLista', label: t('campos.prod_autores_lista.label', 'Autores'), type: 'repeater', addLabel: t('campos.prod_autores_lista.add_label', 'Adicionar autor'), columns: [
    { key: 'nomeCompleto', label: t('campos.prod_autores_lista.nome_completo', 'Nome completo'), type: 'text', required: true, datalist: 'dl-autor' },
    { key: 'nomeCitacao', label: t('campos.prod_autores_lista.nome_citacao', 'Nome como citado'), type: 'text' },
] };
// Palavras-chave/Área/Setores/Outras informações — mesmo bloco final usado
// pelos demais tipos de Produção bibliográfica.
const PROD_PALAVRAS_AREA_SETORES_OUTRAS = [
    { key: 'palavrasChave', label: t('campos.prod_palavras_area_setores_outras.palavras_chave', 'Palavras-chave'), type: 'textarea', placeholder: t('campos.prod_palavras_area_setores_outras.palavras_chave_placeholder', 'Separe por ponto e vírgula (;)'), help: t('campos.prod_palavras_area_setores_outras.palavras_chave_help', 'Até 6 palavras-chave (limite da Plataforma Lattes).') },
    { key: 'areaConhecimento', label: t('campos.prod_palavras_area_setores_outras.area_conhecimento', 'Área do conhecimento (CNPq/CAPES)'), type: 'areatree', help: t('campos.prod_palavras_area_setores_outras.area_conhecimento_help', 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.') },
    { key: 'setores', label: t('campos.prod_palavras_area_setores_outras.setores', 'Setores de atividade'), type: 'cnaeSetores', help: t('campos.prod_palavras_area_setores_outras.setores_help', 'Até 3 setores (lista CNAE).') },
    { key: 'outrasInfo', label: t('campos.prod_palavras_area_setores_outras.outras_info', 'Outras informações'), type: 'textarea' },
];
// A tela real (doc 6.3/6.4) tem Nome comum/científico da espécie, Autoridade
// Nacional e Número do processo E do certificado (separados) — nenhum desses
// tem atributo correspondente em DADOS-BASICOS-DA-CULTIVAR/DETALHAMENTO-DA-
// CULTIVAR no XSD/DTD, limitação genuína do schema, por isso não entraram na
// UI. "Melhoristas" é o equivalente de Autores para este tipo (upgrade pra
// lista, mesmo padrão dos demais tipos de Produções).
const CULTIVAR_FIELDS = [{ key: 'titulo', label: t('campos.cultivar.denominacao', 'Denominação'), type: 'text', required: true }, { ...F_ANO, row: 'periodo' }, F_AFIM,
    F_FINAL, { key: 'instituicao', label: t('campos.cultivar.instituicao_financiadora', 'Instituição financiadora'), type: 'text' },
    { key: 'registro', label: t('campos.cultivar.registro', 'Nº do registro / solicitação'), type: 'text' },
    { key: 'dataConcessao', label: t('campos.cultivar.data_concessao', 'Data da concessão / registro'), type: 'date' }, F_PAIS,
    { key: 'potencialInovacao', label: t('campos.cultivar.potencial_inovacao', 'Possui potencial de inovação de produtos, processos ou serviços?'), type: 'checkbox' },
    { ...PROD_AUTORES_LISTA, label: t('campos.cultivar.melhoristas', 'Melhoristas') },
    ...PROD_PALAVRAS_AREA_SETORES_OUTRAS];
// Desenho industrial registrado (doc 6.5). `instituicao` = Instituição(ões)
// financiadora(s), distinta de `instituicaoRegistro` (mesmo padrão de
// Programa de Computador Registrado, issue #63).
const PI_FIELDS = [
    { key: 'registro', label: t('campos.pi.numero_registro', 'Número do registro'), type: 'text' },
    { key: 'instituicaoRegistro', label: t('campos.pi.instituicao_registro', 'Instituição de registro'), type: 'text' }, F_PAIS,
    F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM,
    { key: 'dataDeposito', label: t('campos.pi.data_registro', 'Data do registro'), type: 'date' },
    { key: 'dataConcessao', label: t('campos.pi.data_concessao', 'Data de concessão'), type: 'date' },
    { ...F_FINAL, label: t('campos.pi.finalidade', 'Finalidade') },
    { key: 'instituicao', label: t('campos.pi.instituicao_financiadora', 'Instituição(ões) financiadora(s)'), type: 'textarea', placeholder: t('campos.pi.instituicao_financiadora_placeholder', 'Separe por ponto e vírgula (;)') },
    { key: 'potencialInovacao', label: t('campos.pi.potencial_inovacao', 'Possui potencial de inovação de produtos, processos ou serviços?'), type: 'checkbox' },
    { key: 'titular', label: t('campos.pi.titular', 'Depositante/Titular (pessoas e instituições)'), type: 'textarea', placeholder: t('campos.pi.titular_placeholder', 'Separe por ponto e vírgula (;)') },
    { ...PROD_AUTORES_LISTA, label: t('campos.pi.inventores', 'Inventores') },
    ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
];
// Topografia de circuito integrado registrada (doc 6.7) — mesma estrutura de
// PI_FIELDS, mas sem Depositante/Titular nem Data do registro/concessão
// (não constam na tela real deste tipo específico).
const TOPOGRAFIA_FIELDS = [
    { key: 'registro', label: t('campos.topografia.numero_registro', 'Número do registro'), type: 'text' },
    { key: 'instituicaoRegistro', label: t('campos.topografia.instituicao_registro', 'Instituição de registro'), type: 'text' }, F_PAIS,
    F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM,
    { ...F_FINAL, label: t('campos.topografia.finalidade', 'Finalidade') },
    { key: 'instituicao', label: t('campos.topografia.instituicao_financiadora', 'Instituição(ões) financiadora(s)'), type: 'textarea', placeholder: t('campos.topografia.instituicao_financiadora_placeholder', 'Separe por ponto e vírgula (;)') },
    { key: 'potencialInovacao', label: t('campos.topografia.potencial_inovacao', 'Possui potencial de inovação de produtos, processos ou serviços?'), type: 'checkbox' },
    { ...PROD_AUTORES_LISTA, label: t('campos.topografia.inventores', 'Inventores') },
    ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
];

/* ---- Definição global dos TIPOS (por chave) ---- */

export { opcoes, F_TITULO, F_ANO, F_DOI, F_URL, F_AUTORES, F_INST, F_FINAL, F_CIDADE, F_NATUREZA, F_AINI, F_AFIM, F_DINI, F_DFIM, F_PAIS, F_IDIOMA, MEIO_DIVULGACAO_OPTIONS, periodoComSituacao, NIVEIS_FORMACAO, nivelExcept, NATUREZA_PROJETO_OPTIONS, SITUACAO_PROJETO_OPTIONS, FINANCIADOR_NATUREZA_OPTIONS, QTD_ALUNOS_BASE, QTD_TECNICO, QTD_FUNDAMENTAL, QTD_MEDIO, projetoEquipeField, institucaoColumns, projetoInstituicoesEnvolvidasField, projetoFinanciadoresField, projetoInstituicaoExecucaoFields, projetoProducoesField, projetoOrientacoesField, projetoFieldsPadrao, ACOES_INOVADORAS_NIVEIS, TEMATICA_PROJETO_ENSINO, PROJETO_ENSINO_FIELDS, AL_ENT, AL_PAPEL, AL_FREQ, AL_IMP, AL_LOCAL, AL_ANO, alNome, alCertificacaoFields, alFiliacaoFields, FORMATO_APARICAO_OPCOES, alImprensaFields, alConcursoFields, PROD_AUTORES_LISTA, PROD_PALAVRAS_AREA_SETORES_OUTRAS, CULTIVAR_FIELDS, PI_FIELDS, TOPOGRAFIA_FIELDS };
