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
   lattesZen — Taxonomia de Categorias e Tipos (espelha a Plataforma Lattes)
   --------------------------------------------------------------------------
   11 categorias numeradas, cada uma com sua lista de tipos (algumas com
   subgrupos, como Produções). Um mesmo TIPO pode aparecer em mais de uma
   categoria (ex.: Patente em "Patentes e Registros" e "Inovação"); por isso
   o item catalogado guarda SEMPRE categoryKey + typeKey.

   Campo: { key, label, type, required?, options?, placeholder? }
   type: 'text' | 'textarea' | 'number' | 'datebr' | 'date' | 'url' | 'select'
   'datebr': aceita aaaa, mm/aaaa ou dd/mm/aaaa; na exportação XML Lattes
   apenas o ANO é mantido (usado em todo campo de ano da aplicação).

   i18n (preparação): label/note (categorias, subgrupos, NAO_LATTES_TYPE)
   passam por t(). As constantes de PASTA (BACKUP_FOLDER, EVIDENCIAS_FOLDER,
   RSC_PCCTAE_FOLDER etc.) ficam de propósito FORA do t() — não são texto de
   exibição, são NOMES DE DIRETÓRIO gravados/lidos de verdade no disco (ou
   Google Drive) da pessoa; traduzir isso quebraria a leitura de pastas já
   criadas em sessões anteriores. `titleCasePt`/`TC_MINOR` (regra de Title
   Case com conectores em minúsculas) é lógica gramatical específica do
   português — fica como está, sem tentativa de generalizar pra outro
   idioma agora. O fallback 'Outra' em itemTitle() (Redes acadêmicas)
   também fica fora: precisa bater exatamente com o valor da opção
   'Outra' do campo (ver nota de arquitetura em lattes-types-campos.js).
   ========================================================================== */
import { F_TITULO, F_ANO, F_URL, F_AFIM } from './lattes-types-campos.js';
import { t } from './i18n.js';
import { TYPES_01_DADOS_GERAIS } from './lattes-types-01-dados-gerais.js';
import { TYPES_02_FORMACAO } from './lattes-types-02-formacao.js';
import { TYPES_03_ATUACAO } from './lattes-types-03-atuacao.js';
import { TYPES_04_PROJETOS } from './lattes-types-04-projetos.js';
import { TYPES_05_PRODUCAO_BIBLIOGRAFICA } from './lattes-types-05-producao-bibliografica.js';
import { TYPES_05_PRODUCAO_TECNICA } from './lattes-types-05-producao-tecnica.js';
import { TYPES_05_PRODUCAO_ARTISTICA } from './lattes-types-05-producao-artistica.js';
import { TYPES_06_07_PATENTES_REGISTROS } from './lattes-types-06-07-patentes-registros.js';
import { TYPES_09_EVENTOS } from './lattes-types-09-eventos.js';
import { TYPES_10_ORIENTACOES } from './lattes-types-10-orientacoes.js';
import { TYPES_11_BANCAS } from './lattes-types-11-bancas.js';
import { TYPES_12_15_ALEM_LATTES } from './lattes-types-12-15-alem-lattes.js';
import { TYPES_20_REGISTROS } from './lattes-types-20-registros.js';

/* ---- Definição global dos TIPOS (por chave) ---- */
const TYPES = Object.assign({}, TYPES_01_DADOS_GERAIS, TYPES_02_FORMACAO, TYPES_03_ATUACAO, TYPES_04_PROJETOS, TYPES_05_PRODUCAO_BIBLIOGRAFICA, TYPES_05_PRODUCAO_TECNICA, TYPES_05_PRODUCAO_ARTISTICA, TYPES_06_07_PATENTES_REGISTROS, TYPES_09_EVENTOS, TYPES_10_ORIENTACOES, TYPES_11_BANCAS, TYPES_12_15_ALEM_LATTES, TYPES_20_REGISTROS);

// Garante que cada tipo conheça a própria chave
Object.keys(TYPES).forEach(k => TYPES[k].key = k);

/* ---- As 11 categorias do menu Lattes (com subgrupos onde há) ---- */
const PROD_BIBLIO = ['ARTIGO_PERIODICO', 'ARTIGO_ACEITO', 'LIVROS', 'CAPITULOS_LIVRO', 'TEXTO_JORNAL', 'TRABALHO_EVENTO', 'APRESENTACAO', 'PARTITURA', 'TRADUCAO', 'PREFACIO', 'OUTRA_BIBLIOGRAFICA'];
const PROD_TECNICA = ['ASSESSORIA_CONSULTORIA', 'EXTENSAO_TECNOLOGICA', 'SOFTWARE_SEM_REGISTRO', 'PRODUTO_TECNOLOGICO', 'PROCESSO_TECNICA', 'TRABALHO_TECNICO', 'CARTA_MAPA', 'CURSO_MINISTRADO', 'MATERIAL_DIDATICO', 'EDITORACAO', 'MANUTENCAO_OBRA', 'MAQUETE', 'MIDIA', 'RELATORIO_PESQUISA', 'MIDIA_SOCIAL', 'OUTRA_TECNICA'];
const PROD_ARTISTICA = ['ARTES_CENICAS', 'MUSICA', 'ARTES_VISUAIS', 'OUTRA_ARTISTICA'];
const PI_TYPES = ['PATENTE', 'SOFTWARE_REGISTRADO', 'CULTIVAR_PROTEGIDA', 'CULTIVAR_REGISTRADA', 'DESENHO_INDUSTRIAL', 'MARCA', 'TOPOGRAFIA_CI'];
const AL_NOTE = t('lattes.categoria.al_note', 'Os itens registrados nesta categoria não são vinculados ao Currículo Lattes e não serão exportados, mas serão exibidos na página pessoal do módulo Publicar na Web.');

window.LATTES_CATEGORIES = [
    { num: '01', key: 'DADOS_GERAIS', label: t('lattes.categoria.DADOS_GERAIS.label', 'Dados gerais'), icon: 'fa-id-card',
      // Antes editados só em Configurações (perfil); mesclados aqui pra
      // cadastrar/editar tudo pelo mesmo fluxo do Catalogar, como qualquer
      // outro item (a pedido do usuário). Fotos/Documentos deixam de ter
      // subpasta própria (01.1/01.2) — ver migração em app.js.
      // Identidade (RG) e Passaporte saíram desta lista (a pedido do
      // usuário) — os tipos (DOC_IDENTIDADE/DOC_PASSAPORTE) continuam
      // definidos em TYPES pra não quebrar itens já cadastrados, só não
      // aparecem mais como opção pra criar um item novo.
      // Texto inicial do CV, Memorial descritivo e Outras informações ficam
      // ao final da lista.
      types: ['IDENTIFICACAO', 'ENDERECO', 'FOTO_PERFIL', 'DOCUMENTO_PESSOAL',
          'LICENCA', 'IDIOMAS', 'PREMIO', 'CONEXAO_SOCIAL', 'CONEXAO_ACADEMICA', 'CONEXAO_PROFISSIONAL', 'RESUMO_CV', 'MEMORIAL', 'OUTRAS_INFO'] },
    { num: '02', key: 'FORMACAO', label: t('lattes.categoria.FORMACAO.label', 'Formação'), icon: 'fa-user-graduate',
      types: ['FORMACAO_ACADEMICA', 'POS_DOUTORADO', 'FORMACAO_COMPLEMENTAR'] },
    { num: '03', key: 'ATUACAO', label: t('lattes.categoria.ATUACAO.label', 'Atuação'), icon: 'fa-briefcase',
      groups: [
          { label: null, types: ['AREA_ATUACAO', 'VINCULO_PROFISSIONAL', 'LINHA_PESQUISA', 'CORPO_EDITORIAL', 'COMITE_ASSESSORAMENTO', 'REVISOR_PERIODICO', 'REVISOR_FOMENTO'] },
          { label: t('lattes.categoria.ATUACAO.grupo.atividades', 'Atividades de Atuação profissional'), types: ['ATIV_DIRECAO', 'ATIV_PESQUISA', 'ATIV_ENSINO', 'ATIV_ESTAGIO', 'ATIV_SERVICO', 'ATIV_EXTENSAO', 'ATIV_TREINAMENTO', 'ATIV_OUTRA', 'ATIV_CONSELHO'] },
      ] },
    { num: '04', key: 'PROJETOS', label: t('lattes.categoria.PROJETOS.label', 'Projetos'), icon: 'fa-diagram-project',
      types: ['PROJETO_PESQUISA', 'PROJETO_DESENVOLVIMENTO', 'PROJETO_EXTENSAO', 'PROJETO_ENSINO', 'PROJETO_OUTRO'] },
    { num: '05', key: 'PRODUCOES', label: t('lattes.categoria.PRODUCOES.label', 'Produções'), icon: 'fa-book',
      groups: [
          { label: t('lattes.categoria.PRODUCOES.grupo.bibliografica', 'Produção Bibliográfica'), types: PROD_BIBLIO },
          { label: t('lattes.categoria.PRODUCOES.grupo.tecnica', 'Produção Técnica'), types: PROD_TECNICA },
          { label: t('lattes.categoria.PRODUCOES.grupo.artistica', 'Outra produção artística/cultural'), types: PROD_ARTISTICA },
      ] },
    { num: '06', key: 'PATENTES_REGISTROS', label: t('lattes.categoria.PATENTES_REGISTROS.label', 'Patentes e Registros'), icon: 'fa-certificate', types: PI_TYPES },
    { num: '07', key: 'INOVACAO', label: t('lattes.categoria.INOVACAO.label', 'Inovação'), icon: 'fa-lightbulb',
      types: ['SOFTWARE_SEM_REGISTRO', 'PRODUTO_TECNOLOGICO', 'PROCESSO_TECNICA', 'PROJETO_PESQUISA', 'PROJETO_DESENVOLVIMENTO', 'PROJETO_EXTENSAO', 'PROJETO_ENSINO', 'PROJETO_OUTRO'] },
    { num: '08', key: 'EDUCACAO_CT', label: t('lattes.categoria.EDUCACAO_CT.label', 'Educação e Popularização de C&T'), icon: 'fa-chalkboard-user',
      types: ['ARTIGO_PERIODICO', 'ARTIGO_ACEITO', 'LIVROS', 'CAPITULOS_LIVRO', 'TEXTO_JORNAL', 'TRABALHO_EVENTO', 'APRESENTACAO', 'SOFTWARE_SEM_REGISTRO', 'CURSO_MINISTRADO', 'MATERIAL_DIDATICO', 'MIDIA', 'SOFTWARE_REGISTRADO', 'ORGANIZACAO_EVENTO', 'PARTICIPACAO_EVENTO', 'MIDIA_SOCIAL', 'ARTES_VISUAIS', 'ARTES_CENICAS', 'MUSICA', 'OUTRA_BIBLIOGRAFICA', 'OUTRA_TECNICA', 'OUTRA_ARTISTICA'] },
    { num: '09', key: 'EVENTOS', label: t('lattes.categoria.EVENTOS.label', 'Eventos'), icon: 'fa-calendar-days', types: ['PARTICIPACAO_EVENTO', 'ORGANIZACAO_EVENTO'] },
    { num: '10', key: 'ORIENTACOES', label: t('lattes.categoria.ORIENTACOES.label', 'Orientações'), icon: 'fa-user-group', types: ['ORIENTACAO_CONCLUIDA', 'ORIENTACAO_ANDAMENTO'] },
    { num: '11', key: 'BANCAS', label: t('lattes.categoria.BANCAS.label', 'Bancas'), icon: 'fa-gavel', types: ['BANCA_CONCLUSAO', 'BANCA_JULGADORA'] },
    // Categorias 12-21 reordenadas e renumeradas (pedido do Alexsandro):
    // Grupos de Pesquisa/Atuação em Crise de Saúde Pública (antes as 2
    // categorias exclusivas do RSC) e as 8 categorias de "Outras
    // atividades" (naoLattes) passam a intercalar por ordem alfabética de
    // rótulo em vez da ordem histórica de criação — só num/posição no
    // array mudam aqui; key/types/ícone de cada categoria continuam os
    // mesmos (ver migração de pastas de evidências em app.js, que move os
    // arquivos já existentes pra bater com os novos números).
    // "Grupos de Pesquisa" perdeu o rscOnly (pedido do Alexsandro): passa a
    // aparecer sempre, com ou sem o módulo RSC habilitado — faz sentido
    // como credencial acadêmica geral, não só como critério do RSC-PCCTAE
    // (itens dela continuam podendo ser contabilizados no RSC, via
    // "usar para RSC" no item, igual a qualquer outra categoria). "Atuação
    // em Crise de Saúde Pública" (21, abaixo) CONTINUA exclusiva do RSC.
    { num: '12', key: 'RSC_GRUPO', label: t('lattes.categoria.RSC_GRUPO.label', 'Grupos de Pesquisa'), icon: 'fa-microscope', naoLattes: true,
      note: AL_NOTE, types: ['RSC_GRUPO_PESQUISA'] },
    { num: '13', key: 'AL_CERTIFICACAO_CAT', label: t('lattes.categoria.AL_CERTIFICACAO_CAT.label', 'Certificações'), icon: 'fa-certificate', naoLattes: true,
      note: AL_NOTE, types: ['AL_CERT_PROF_GESTAO', 'AL_CERT_TI', 'AL_CERT_FINANCEIRA', 'AL_CERT_OUTRA'] },
    { num: '14', key: 'AL_FILIACAO_CAT', label: t('lattes.categoria.AL_FILIACAO_CAT.label', 'Filiações'), icon: 'fa-id-badge', naoLattes: true,
      note: AL_NOTE, types: ['AL_FILIACAO_CONSELHO', 'AL_FILIACAO_CIENTIFICA', 'AL_FILIACAO_ASSOC_PROF', 'AL_FILIACAO_SINDICATO', 'AL_FILIACAO_OUTRA'] },
    { num: '15', key: 'AL_IMPRENSA_CAT', label: t('lattes.categoria.AL_IMPRENSA_CAT.label', 'Imprensa'), icon: 'fa-newspaper', naoLattes: true,
      note: AL_NOTE, types: ['AL_IMPRENSA_CITACAO', 'AL_IMPRENSA_ENTREVISTADO', 'AL_IMPRENSA_OUTRA'] },
    { num: '16', key: 'AL_CONCURSO_CAT', label: t('lattes.categoria.AL_CONCURSO_CAT.label', 'Concursos e Processos seletivos'), icon: 'fa-list-check', naoLattes: true,
      note: AL_NOTE, types: ['AL_CONCURSO_PUBLICO', 'AL_CONCURSO_PSS', 'AL_CONCURSO_ACADEMICO', 'AL_CONCURSO_CULTURAL', 'AL_CONCURSO_CHAMADA_PUBLICA', 'AL_CONCURSO_HACKATHON', 'AL_CONCURSO_INTERNA'] },
    { num: '17', key: 'AL_DESENVOLVIMENTO', label: t('lattes.categoria.AL_DESENVOLVIMENTO.label', 'Desenvolvimento Pessoal e Habilidades'), icon: 'fa-seedling', naoLattes: true,
      note: AL_NOTE, types: ['AL_CURSO_LIVRE', 'AL_MENTORIA', 'AL_PROJETO_PESSOAL'] },
    { num: '18', key: 'AL_ENGAJAMENTO', label: t('lattes.categoria.AL_ENGAJAMENTO.label', 'Engajamento Comunitário e Cidadania'), icon: 'fa-people-group', naoLattes: true,
      note: AL_NOTE, types: ['AL_ATIVISMO', 'AL_LIDERANCA', 'AL_ORG_EVENTO_COM', 'AL_VOLUNTARIADO'] },
    { num: '19', key: 'AL_SAUDE_ESPORTE', label: t('lattes.categoria.AL_SAUDE_ESPORTE.label', 'Saúde, Esporte e Bem-Estar'), icon: 'fa-heart-pulse', naoLattes: true,
      note: AL_NOTE, types: ['AL_EXPEDICAO', 'AL_COMPETICAO', 'AL_ESPORTE', 'AL_BEMESTAR'] },
    { num: '20', key: 'AL_INTERESSES', label: t('lattes.categoria.AL_INTERESSES.label', 'Interesses, Cultura e Lazer'), icon: 'fa-palette', naoLattes: true,
      note: AL_NOTE, types: ['AL_ESPECTADOR_ESPORTE', 'AL_CINEMA', 'AL_COLECIONISMO', 'AL_ARTES_CENICAS', 'AL_GASTRONOMIA',
          'AL_EXPOSICOES', 'AL_FEIRAS_CULTURAIS', 'AL_HOBBY', 'AL_JOGOS', 'AL_LEITURA', 'AL_MUSICA', 'AL_VIAGENS'] },
    { num: '21', key: 'RSC_CRISE_SAUDE', label: t('lattes.categoria.RSC_CRISE_SAUDE.label', 'Atuação em Crise de Saúde Pública'), icon: 'fa-virus', naoLattes: true, rscOnly: true,
      types: ['RSC_CRISE_SAUDE_ATUACAO'] },
];

// Categoria "primária" de cada tipo (usada pelo importador do XML)
const PRIMARY_CATEGORY = {
    IDENTIFICACAO: 'DADOS_GERAIS', FOTO_PERFIL: 'DADOS_GERAIS', DOCUMENTO_PESSOAL: 'DADOS_GERAIS', DOC_IDENTIDADE: 'DADOS_GERAIS', DOC_PASSAPORTE: 'DADOS_GERAIS', ENDERECO: 'DADOS_GERAIS', LICENCA: 'DADOS_GERAIS', IDIOMAS: 'DADOS_GERAIS',
    PREMIO: 'DADOS_GERAIS', RESUMO_CV: 'DADOS_GERAIS', OUTRAS_INFO: 'DADOS_GERAIS',
    FORMACAO_ACADEMICA: 'FORMACAO', POS_DOUTORADO: 'FORMACAO', FORMACAO_COMPLEMENTAR: 'FORMACAO',
    VINCULO_PROFISSIONAL: 'ATUACAO', LINHA_PESQUISA: 'ATUACAO', CORPO_EDITORIAL: 'ATUACAO', COMITE_ASSESSORAMENTO: 'ATUACAO', REVISOR_PERIODICO: 'ATUACAO', REVISOR_FOMENTO: 'ATUACAO', AREA_ATUACAO: 'ATUACAO',
    ATIV_ENSINO: 'ATUACAO', ATIV_DIRECAO: 'ATUACAO', ATIV_CONSELHO: 'ATUACAO', ATIV_EXTENSAO: 'ATUACAO', ATIV_SERVICO: 'ATUACAO', ATIV_OUTRA: 'ATUACAO',
    ATIV_PESQUISA: 'ATUACAO', ATIV_ESTAGIO: 'ATUACAO', ATIV_TREINAMENTO: 'ATUACAO',
    PROJETO_PESQUISA: 'PROJETOS', PROJETO_DESENVOLVIMENTO: 'PROJETOS', PROJETO_EXTENSAO: 'PROJETOS', PROJETO_ENSINO: 'PROJETOS', PROJETO_OUTRO: 'PROJETOS',
    ARTIGO_PERIODICO: 'PRODUCOES', ARTIGO_ACEITO: 'PRODUCOES', LIVRO_CAPITULO: 'PRODUCOES', LIVROS: 'PRODUCOES', CAPITULOS_LIVRO: 'PRODUCOES', TEXTO_JORNAL: 'PRODUCOES', TRABALHO_EVENTO: 'PRODUCOES', APRESENTACAO: 'PRODUCOES', PARTITURA: 'PRODUCOES', TRADUCAO: 'PRODUCOES', PREFACIO: 'PRODUCOES', OUTRA_BIBLIOGRAFICA: 'PRODUCOES',
    ASSESSORIA_CONSULTORIA: 'PRODUCOES', EXTENSAO_TECNOLOGICA: 'PRODUCOES', SOFTWARE_SEM_REGISTRO: 'PRODUCOES', PRODUTO_TECNOLOGICO: 'PRODUCOES', PROCESSO_TECNICA: 'PRODUCOES', TRABALHO_TECNICO: 'PRODUCOES', CARTA_MAPA: 'PRODUCOES', CURSO_MINISTRADO: 'PRODUCOES', MATERIAL_DIDATICO: 'PRODUCOES', EDITORACAO: 'PRODUCOES', MANUTENCAO_OBRA: 'PRODUCOES', MAQUETE: 'PRODUCOES', MIDIA: 'PRODUCOES', RELATORIO_PESQUISA: 'PRODUCOES', MIDIA_SOCIAL: 'PRODUCOES', OUTRA_TECNICA: 'PRODUCOES',
    ARTES_CENICAS: 'PRODUCOES', MUSICA: 'PRODUCOES', ARTES_VISUAIS: 'PRODUCOES', OUTRA_ARTISTICA: 'PRODUCOES',
    PATENTE: 'PATENTES_REGISTROS', SOFTWARE_REGISTRADO: 'PATENTES_REGISTROS', CULTIVAR_PROTEGIDA: 'PATENTES_REGISTROS', CULTIVAR_REGISTRADA: 'PATENTES_REGISTROS', DESENHO_INDUSTRIAL: 'PATENTES_REGISTROS', MARCA: 'PATENTES_REGISTROS', TOPOGRAFIA_CI: 'PATENTES_REGISTROS',
    PARTICIPACAO_EVENTO: 'EVENTOS', ORGANIZACAO_EVENTO: 'EVENTOS',
    ORIENTACAO_CONCLUIDA: 'ORIENTACOES', ORIENTACAO_ANDAMENTO: 'ORIENTACOES',
    BANCA_CONCLUSAO: 'BANCAS', BANCA_JULGADORA: 'BANCAS',
    // chaves legadas (compatibilidade com dados antigos)
    LIVRO: 'PRODUCOES', CAPITULO_LIVRO: 'PRODUCOES', SOFTWARE: 'PRODUCOES', ORIENTACAO: 'ORIENTACOES', BANCA: 'BANCAS', PROJETO: 'PROJETOS',
};
['AL_CURSO_LIVRE', 'AL_IDIOMAS', 'AL_TREINAMENTO', 'AL_MENTORIA', 'AL_PROJETO_PESSOAL'].forEach(k => { PRIMARY_CATEGORY[k] = 'AL_DESENVOLVIMENTO'; });
['AL_ATIVISMO', 'AL_VOLUNTARIADO', 'AL_LIDERANCA', 'AL_ORG_EVENTO_COM'].forEach(k => { PRIMARY_CATEGORY[k] = 'AL_ENGAJAMENTO'; });
['AL_ESPORTE', 'AL_COMPETICAO', 'AL_EXPEDICAO', 'AL_BEMESTAR'].forEach(k => { PRIMARY_CATEGORY[k] = 'AL_SAUDE_ESPORTE'; });
['AL_HOBBY', 'AL_COLECIONISMO', 'AL_CULTURAL', 'AL_GASTRONOMIA', 'AL_ESPECTADOR_ESPORTE', 'AL_CINEMA', 'AL_ARTES_CENICAS',
    'AL_EXPOSICOES', 'AL_FEIRAS_CULTURAIS', 'AL_JOGOS', 'AL_LEITURA', 'AL_MUSICA', 'AL_VIAGENS'].forEach(k => { PRIMARY_CATEGORY[k] = 'AL_INTERESSES'; });
PRIMARY_CATEGORY.AL_CERTIFICACAO = 'AL_CERTIFICACAO_CAT';
['AL_CERT_PROF_GESTAO', 'AL_CERT_TI', 'AL_CERT_FINANCEIRA', 'AL_CERT_OUTRA'].forEach(k => { PRIMARY_CATEGORY[k] = 'AL_CERTIFICACAO_CAT'; });
PRIMARY_CATEGORY.AL_FILIACAO = 'AL_FILIACAO_CAT';
['AL_FILIACAO_CONSELHO', 'AL_FILIACAO_CIENTIFICA', 'AL_FILIACAO_ASSOC_PROF', 'AL_FILIACAO_SINDICATO', 'AL_FILIACAO_OUTRA'].forEach(k => { PRIMARY_CATEGORY[k] = 'AL_FILIACAO_CAT'; });
['AL_CONCURSO', 'AL_CONCURSO_PUBLICO', 'AL_CONCURSO_PSS', 'AL_CONCURSO_ACADEMICO', 'AL_CONCURSO_CULTURAL', 'AL_CONCURSO_CHAMADA_PUBLICA', 'AL_CONCURSO_HACKATHON', 'AL_CONCURSO_INTERNA'].forEach(k => { PRIMARY_CATEGORY[k] = 'AL_CONCURSO_CAT'; });
PRIMARY_CATEGORY.AL_IMPRENSA = 'AL_IMPRENSA_CAT';
['AL_IMPRENSA_CITACAO', 'AL_IMPRENSA_ENTREVISTADO', 'AL_IMPRENSA_OUTRA'].forEach(k => { PRIMARY_CATEGORY[k] = 'AL_IMPRENSA_CAT'; });
['CONEXAO_SOCIAL', 'CONEXAO_ACADEMICA', 'CONEXAO_PROFISSIONAL'].forEach(k => { PRIMARY_CATEGORY[k] = 'DADOS_GERAIS'; });
PRIMARY_CATEGORY.RSC_GRUPO_PESQUISA = 'RSC_GRUPO';
PRIMARY_CATEGORY.RSC_CRISE_SAUDE_ATUACAO = 'RSC_CRISE_SAUDE';
const LEGACY_TYPE = { LIVRO: 'LIVRO_CAPITULO', CAPITULO_LIVRO: 'LIVRO_CAPITULO', SOFTWARE: 'SOFTWARE_SEM_REGISTRO', ORIENTACAO: 'ORIENTACAO_ANDAMENTO', BANCA: 'BANCA_CONCLUSAO' };

/* ---- Categoria/tipo especial: itens NÃO LATTES ---- */
window.NAO_LATTES_TYPE = {
    key: 'NAO_LATTES', label: t('lattes.tipo.NAO_LATTES.label', 'Item não-Lattes (pessoal)'),
    fields: [F_TITULO, { key: 'categoria', label: t('lattes.tipo.NAO_LATTES.campo.categoria.label', 'Categoria'), type: 'select', options: ['Hobby', 'Atividade pessoal', 'Voluntariado', 'Certificado avulso', 'Curso livre', 'Outro'] }, { ...F_ANO, row: 'periodo' }, F_AFIM, { key: 'descricao', label: t('lattes.tipo.NAO_LATTES.campo.descricao.label', 'Descrição'), type: 'textarea' }, F_URL],
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
    const tok = _tok(value);
    return ENUM_ALIAS[tok] || tok;
}
window.LattesEnums = { tok: _tok, token: enumToken };

/* ---- API pública ---- */
window.LattesTypes = (function () {
    const catByKey = {};
    LATTES_CATEGORIES.forEach(c => { catByKey[c.key] = c; });
    catByKey['NAO_LATTES'] = { num: '00', key: 'NAO_LATTES', label: t('lattes.categoria.NAO_LATTES.label', 'Não-Lattes'), icon: 'fa-heart' };

    const BACKUP_FOLDER = 'Cópia de segurança';
    const INBOX_FOLDER = 'Caixa de Entrada';
    const EVIDENCIAS_FOLDER = 'Evidências';
    const LATTES_XML_FOLDER = 'Exportação/Lattes XML';
    const RSC_PCCTAE_FOLDER = 'Exportação/RSC-PCCTAE';
    const SUMULA_FAPESP_FOLDER = 'Exportação/Súmula Curricular FAPESP';
    const EXPORT_FOLDERS = [RSC_PCCTAE_FOLDER, 'Exportação/Progressão Docentes', SUMULA_FAPESP_FOLDER, LATTES_XML_FOLDER];
    const PUBLICACAO_FOLDER = 'Publicação para Web';
    const RELATORIOS_FOLDER = 'Relatórios';
    const LIXEIRA_FOLDER = 'Lixeira';
    const EXTRA_FOLDERS = [PUBLICACAO_FOLDER, RELATORIOS_FOLDER, LIXEIRA_FOLDER];

    // Nome de pasta seguro para o sistema de arquivos, legível e ordenável
    // Padrão: "NN Nome" (número + espaço + nome, sem hífen)
    function folderName(cat) {
        const safe = (cat.label || cat.key).replace(/[\\/:*?"<>|]/g, '').trim();
        return `${cat.num || '00'} ${safe}`;
    }
    function slugFolder(cat) {
        // subOf: fica como subpasta da categoria indicada, não solta em
        // "Evidências" (ex.: Fotos de Perfil/Documentos pessoais dentro de
        // "01 Dados Gerais").
        if (cat.subOf) return `${EVIDENCIAS_FOLDER}/${folderName(catByKey[cat.subOf])}/${folderName(cat)}`;
        return `${EVIDENCIAS_FOLDER}/${folderName(cat)}`;
    }
    // Pasta de itens sem categoria reconhecida (fallback de categoryFolder) —
    // também uma subpasta de "01 Dados Gerais" (01.3 Outros).
    const OUTROS_FOLDER = `${EVIDENCIAS_FOLDER}/${folderName(catByKey['DADOS_GERAIS'])}/01.3 Outros`;

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
        publicacaoFolder() { return PUBLICACAO_FOLDER; },
        relatoriosFolder() { return RELATORIOS_FOLDER; },
        lattesXmlFolder() { return LATTES_XML_FOLDER; },
        rscFolder() { return RSC_PCCTAE_FOLDER; },
        sumulaFapespFolder() { return SUMULA_FAPESP_FOLDER; },
        lixeiraFolder() { return LIXEIRA_FOLDER; },
        getType(typeKey) { return TYPES[typeKey] || (typeKey === 'NAO_LATTES' ? NAO_LATTES_TYPE : null); },
        // compat: get() devolve o tipo (independe de categoria)
        get(typeKey) { return this.getType(typeKey); },
        label(typeKey) { const def = this.getType(typeKey); return def ? def.label : typeKey; },
        categoryByKey(catKey) { return catByKey[catKey] || null; },
        categoryLabel(catKey) { const c = catByKey[catKey]; return c ? c.label : (catKey || ''); },
        categoryNumLabel(catKey) { const c = catByKey[catKey]; return c ? `${c.num ? c.num + '. ' : ''}${c.label}` : (catKey || ''); },
        // Itens legados 'NAO_LATTES' (e a antiga categoria 'ATIVIDADES_LIVRES',
        // dividida em categorias próprias) caem na primeira delas por padrão.
        categoryFolder(catKey) {
            if (catKey === 'NAO_LATTES' || catKey === 'ATIVIDADES_LIVRES') return slugFolder(catByKey['AL_DESENVOLVIMENTO']);
            const c = catByKey[catKey]; return c ? slugFolder(c) : OUTROS_FOLDER;
        },
        outrosFolder() { return OUTROS_FOLDER; },
        primaryCategory(typeKey) { return PRIMARY_CATEGORY[typeKey] || 'PRODUCOES'; },
        normalizeType(typeKey) { return LEGACY_TYPE[typeKey] || typeKey; },
        isNaoLattesCategory(catKey) { return catKey === 'NAO_LATTES' || !!(catByKey[catKey] && catByKey[catKey].naoLattes); },
        // Tipos "não-Lattes" por si só (ex.: Conexões), mesmo dentro de uma
        // categoria que normalmente é Lattes (Dados gerais).
        isNaoLattesType(typeKey) { const def = this.getType(typeKey); return !!(def && def.naoLattes); },
        isSingleton(typeKey) { const def = this.getType(typeKey); return !!(def && def.singleton); },
        // "Singleton por campo": no máximo 1 item por valor do campo indicado
        // (ex.: Endereço — 1 Residencial + 1 Profissional). Salvar de novo o
        // mesmo valor atualiza o existente em vez de duplicar; ver onSubmitForm.
        singletonScopeField(typeKey) { const def = this.getType(typeKey); return (def && def.singletonBy) || null; },
        // Tipos de "perfil" (Dados gerais) editados em Configurações, não em Catalogar
        isPerfilType(typeKey) { const def = this.getType(typeKey); return !!(def && def.perfil); },
        perfilTypes() { return Object.keys(TYPES).filter(k => TYPES[k].perfil); },
        // Estrutura de pastas criada ao configurar o diretório: Caixa de
        // Entrada e Cópia de segurança na raiz (a Caixa ganha a subpasta
        // "Processados" à parte, por Storage.ensureInbox); Exportação
        // (RSC-PCCTAE, Progressão Docentes, Súmula Curricular FAPESP e
        // Lattes XML); Evidências (uma subpasta por categoria); Publicação
        // para Web (uso manual, o app não grava nela automaticamente); e
        // Relatórios, onde cada "Relatório completo (PDF)" gerado é salvo
        // automaticamente (ver tab-config-pdf-report.js), além do download.
        allFolders() {
            return [INBOX_FOLDER, BACKUP_FOLDER, ...EXPORT_FOLDERS, ...LATTES_CATEGORIES.map(slugFolder), ...EXTRA_FOLDERS];
        },
        itemTitle(item) {
            const f = item.fields || {};
            // Formação acadêmica/titulação: exibe "anoInicio-anoFim Nível · Curso"
            // (o campo "titulo" guarda o TCC/dissertação/tese, não serve de rótulo).
            if (item.typeKey === 'FORMACAO_ACADEMICA') {
                const ini = String(f.anoInicio || '').trim();
                const fim = String(f.anoFim || '').trim();
                const periodo = (ini && fim) ? `${ini}-${fim}` : (ini || fim || '');
                const resto = [f.nivel, f.curso].map(x => String(x || '').trim()).filter(Boolean).join(' · ');
                const res = [periodo, resto].filter(Boolean).join(' ');
                if (res) return res;
            }
            // Redes acadêmicas: com "Outra" escolhida, mostra o nome digitado
            // em "Nome da rede" em vez do rótulo genérico "Outra". 'Outra'
            // aqui precisa bater exatamente com o valor da opção do campo
            // `titulo` (ver nota de arquitetura no topo do arquivo) — fica
            // fora do t().
            if (item.typeKey === 'CONEXAO_ACADEMICA' && f.titulo === 'Outra') {
                return String(f.outraNome || '').trim() || 'Outra';
            }
            // Áreas de atuação: hierarquia CNPq/CAPES (Grande área > Área > Subárea > Especialidade)
            if (item.typeKey === 'AREA_ATUACAO') {
                const partes = [f.grandeArea, f.area, f.subarea, f.especialidade].map(x => String(x || '').trim()).filter(Boolean);
                if (partes.length) return partes.map(titleCasePt).join(' > '); // separador ASCII (compatível com ISO-8859-1)
                if (f.areaConhecimento) return titleCasePt(f.areaConhecimento);
            }
            // Atuação profissional: "Cargo/Função" (o ano já aparece à parte no
            // card; o campo "titulo" é só "outras informações", raramente
            // preenchido — sem isso o fallback caía em "instituicao", que se
            // repete em várias atuações na mesma entidade e não diferencia
            // uma da outra).
            if (item.typeKey === 'VINCULO_PROFISSIONAL' && String(f.cargo || '').trim()) return String(f.cargo).trim();
            // Concursos e processos seletivos: "Cargo (Colocação)" (o ano já
            // aparece à parte no card; o campo "titulo" é o nome do concurso,
            // que se repete pouco mas não diz qual foi o cargo/resultado).
            // Cobre a chave legada (AL_CONCURSO) e os 7 tipos específicos
            // (AL_CONCURSO_*) que a substituem.
            if (item.typeKey.indexOf('AL_CONCURSO') === 0) {
                const cargo = String(f.cargo || '').trim(), coloc = String(f.colocacao || '').trim();
                const res = coloc ? `${cargo || f.titulo || ''} (${coloc})`.trim() : cargo;
                if (res) return res;
            }
            // Orientações: "Nome do orientando | Título do trabalho" (o ano já
            // aparece à parte no card).
            if (item.typeKey === 'ORIENTACAO_CONCLUIDA' || item.typeKey === 'ORIENTACAO_ANDAMENTO') {
                const res = [f.orientando, f.titulo].map(x => String(x || '').trim()).filter(Boolean).join(' | ');
                if (res) return res;
            }
            // Documentos pessoais: "Tipo de documento · Descrição/Nº do documento"
            if (item.typeKey === 'DOCUMENTO_PESSOAL') {
                const res = [f.tipoDoc, f.titulo].map(x => String(x || '').trim()).filter(Boolean).join(' · ');
                if (res) return res;
            }
            // Identidade (RG) / Passaporte: não têm campo "titulo" — usam "numero"
            if (item.typeKey === 'DOC_IDENTIDADE') {
                const res = [f.numero, f.orgao].map(x => String(x || '').trim()).filter(Boolean).join(' · ');
                if (res) return res;
            }
            if (item.typeKey === 'DOC_PASSAPORTE' && String(f.numero || '').trim()) return String(f.numero).trim();
            // Atuação em crise de saúde pública: "Tipo de situação — Ato que
            // decretou" (não tem campo "titulo" próprio).
            if (item.typeKey === 'RSC_CRISE_SAUDE_ATUACAO') {
                const res = [f.tipoSituacao, f.ato].map(x => String(x || '').trim()).filter(Boolean).join(' — ');
                if (res) return res;
            }
            // Texto inicial do CV / Memorial descritivo / Outras informações:
            // não têm campo "titulo" — mostram um trecho do próprio texto
            // (evita repetir o rótulo do card).
            if (item.typeKey === 'RESUMO_CV' || item.typeKey === 'MEMORIAL' || item.typeKey === 'OUTRAS_INFO') {
                const d = String(f.descricao || '').trim().replace(/\s+/g, ' ');
                if (d) return d.length > 60 ? d.slice(0, 60) + '…' : d;
            }
            return f.titulo || f.curso || f.orientando || f.candidato || f.instituicao || f.nome || t('lattes.item.sem_titulo', '(sem título)');
        },
    };
})();
