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
   lattesZen — Definições de tipo: 01 Dados gerais
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "01 Dados gerais"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.

   i18n (preparação): label/help/addLabel e o TEXTO (valor) do mapa
   `descriptions` passam por t(); os arrays de `options` viram
   `{ value, label }` via opcoes() — `default` e as CHAVES do mapa
   `descriptions` continuam literais, batendo com `value` — ver nota de
   arquitetura no topo de lattes-types-campos.js.
   ========================================================================== */
import { F_TITULO, F_URL, F_CIDADE, opcoes } from './lattes-types-campos.js';
import { t } from './i18n.js';

export const TYPES_01_DADOS_GERAIS = {
    // 01 Dados gerais
    IDENTIFICACAO: { label: t('lattes.tipo.IDENTIFICACAO.label', 'Identificação'), noEvidence: true, singleton: true, perfil: true, fields: [
        { key: 'titulo', label: t('lattes.tipo.IDENTIFICACAO.campo.titulo.label', 'Nome completo (nome civil)'), type: 'text', required: true },
        { key: 'usaNomeSocial', label: t('lattes.tipo.IDENTIFICACAO.campo.usa_nome_social.label', 'Deseja utilizar o nome social?'), type: 'select', options: opcoes('identificacao_usa_nome_social', ['Não', 'Sim']), help: t('lattes.tipo.IDENTIFICACAO.campo.usa_nome_social.help', 'De acordo com o Decreto 8.727/2016, pessoa travesti ou transexual pode optar pela exibição apenas do nome social nas buscas públicas do Currículo Lattes.') },
        { key: 'nomeSocial', label: t('lattes.tipo.IDENTIFICACAO.campo.nome_social.label', 'Nome social'), type: 'text', disabledWhen: { field: 'usaNomeSocial', in: ['', 'Não'] } },
        { key: 'citacoes', label: t('lattes.tipo.IDENTIFICACAO.campo.citacoes.label', 'Nome em citações bibliográficas'), type: 'repeater', addLabel: t('lattes.tipo.IDENTIFICACAO.campo.citacoes.add_label', 'Adicionar variação'), help: t('lattes.tipo.IDENTIFICACAO.campo.citacoes.help', 'Cada variação do seu nome usada em publicações (ex.: CARVALHO, Alexsandro Cardoso).'), columns: [
            { key: 'nome', label: t('lattes.tipo.IDENTIFICACAO.campo.citacoes.coluna_nome', 'Variação do nome'), type: 'text', required: true }] },
        { key: 'cpf', label: t('lattes.tipo.IDENTIFICACAO.campo.cpf.label', 'CPF'), type: 'text', placeholder: '000.000.000-00' },
        { key: 'corRaca', label: t('lattes.tipo.IDENTIFICACAO.campo.cor_raca.label', 'Cor ou raça'), type: 'select', options: opcoes('identificacao_cor_raca', ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não desejo declarar']) },
        { key: 'sexo', label: t('lattes.tipo.IDENTIFICACAO.campo.sexo.label', 'Sexo'), type: 'select', options: opcoes('identificacao_sexo', ['Masculino', 'Feminino']), help: t('lattes.tipo.IDENTIFICACAO.campo.sexo.help', 'Exigido pelo Lattes na importação do XML.') },
        { key: 'nacionalidade', label: t('lattes.tipo.IDENTIFICACAO.campo.nacionalidade.label', 'Nacionalidade'), type: 'text', placeholder: t('lattes.tipo.IDENTIFICACAO.campo.nacionalidade.placeholder', 'Brasileira') },
        { key: 'paisNacionalidade', label: t('lattes.tipo.IDENTIFICACAO.campo.pais_nacionalidade.label', 'País de nacionalidade'), type: 'select', options: window.PAISES, default: 'Brasil' },
        { key: 'pais', label: t('lattes.tipo.IDENTIFICACAO.campo.pais.label', 'País de nascimento'), type: 'select', options: window.PAISES, default: 'Brasil' },
        { key: 'ufNascimento', label: t('lattes.tipo.IDENTIFICACAO.campo.uf_nascimento.label', 'UF de nascimento'), type: 'text', placeholder: 'ex.: RS', disabledWhen: { field: 'pais', notEquals: 'Brasil' } },
        { key: 'cidadeNascimento', label: t('lattes.tipo.IDENTIFICACAO.campo.cidade_nascimento.label', 'Cidade de nascimento'), type: 'text' },
        { key: 'dataNascimento', label: t('lattes.tipo.IDENTIFICACAO.campo.data_nascimento.label', 'Data de nascimento'), type: 'datebr' },
        { key: 'orcid', label: t('lattes.tipo.IDENTIFICACAO.campo.orcid.label', 'ORCID'), type: 'text' },
        F_URL,
        // Usados na capa do Relatório completo (PDF) — Configurações →
        // Exportar — só aparecem lá quando preenchidos; opcionais aqui
        // também (não fazem parte do XML do Lattes).
        { key: 'telefone', label: t('lattes.tipo.IDENTIFICACAO.campo.telefone.label', 'Telefone'), type: 'text', placeholder: '(11) 1234-5678' },
        { key: 'email', label: t('lattes.tipo.IDENTIFICACAO.campo.email.label', 'E-mail'), type: 'text', placeholder: 'nome@email.com' },
        { key: 'pcd', label: t('lattes.tipo.IDENTIFICACAO.campo.pcd.label', 'Você é uma pessoa com Deficiência?'), type: 'select', options: opcoes('identificacao_pcd', ['Não', 'Sim']) },
        { key: 'deficiencias', label: t('lattes.tipo.IDENTIFICACAO.campo.deficiencias.label', 'Deficiência(s)'), type: 'checkboxes', disabledWhen: { field: 'pcd', in: ['', 'Não'] }, options: opcoes('identificacao_deficiencias', ['Auditiva', 'Física', 'Intelectual', 'Visual', 'Transtorno do Espectro Autista (TEA)', 'Múltipla']), descriptions: {
            'Auditiva': t('lattes.tipo.IDENTIFICACAO.campo.deficiencias.desc.auditiva', 'Perda bilateral, parcial ou total, de quarenta e um decibéis (dB) ou mais, aferida por audiograma nas frequências de 500Hz, 1.000Hz, 2.000Hz e 3.000Hz (Decreto nº 3.298/1999); limitação de longo prazo da audição, uni ou bilateral, que, em interação com uma ou mais barreiras, obstrui a participação plena e efetiva da pessoa na sociedade em igualdade de condições com as demais pessoas (Lei nº 14.768/2023).'),
            'Física': t('lattes.tipo.IDENTIFICACAO.campo.deficiencias.desc.fisica', 'Alteração completa ou parcial de um ou mais segmentos do corpo humano, acarretando o comprometimento da função física, apresentando-se sob a forma de paraplegia, paraparesia, monoplegia, monoparesia, tetraplegia, tetraparesia, triplegia, triparesia, hemiplegia, hemiparesia, ostomia, amputação ou ausência de membro, paralisia cerebral, nanismo, membros com deformidade congênita ou adquirida, exceto as deformidades estéticas e as que não produzam dificuldades para o desempenho de funções (Decreto nº 3.298/1999).'),
            'Intelectual': t('lattes.tipo.IDENTIFICACAO.campo.deficiencias.desc.intelectual', 'Funcionamento intelectual significativamente inferior à média, com manifestação antes dos dezoito anos e limitações associadas a duas ou mais áreas de habilidades adaptativas, tais como: comunicação; cuidado pessoal; habilidades sociais; utilização dos recursos da comunidade; saúde e segurança; habilidades acadêmicas; lazer; e trabalho (Decreto nº 3.298/1999).'),
            'Visual': t('lattes.tipo.IDENTIFICACAO.campo.deficiencias.desc.visual', 'Cegueira, na qual a acuidade visual é igual ou menor que 0,05 no melhor olho, com a melhor correção óptica; baixa visão, que significa acuidade visual entre 0,3 e 0,05 no melhor olho, com a melhor correção óptica; os casos nos quais a somatória da medida do campo visual em ambos os olhos for igual ou menor que 60°; ou a ocorrência simultânea de quaisquer das condições anteriores (Decreto nº 3.298/1999); visão monocular, classificada como deficiência sensorial do tipo visual (Lei nº 14.126/2021).'),
            'Transtorno do Espectro Autista (TEA)': t('lattes.tipo.IDENTIFICACAO.campo.deficiencias.desc.tea', 'Síndrome clínica caracterizada pela deficiência persistente e clinicamente significativa da comunicação e da interação sociais, manifestada por deficiência marcada de comunicação verbal e não verbal usada para interação social; ausência de reciprocidade social; falência em desenvolver e manter relações apropriadas ao seu nível de desenvolvimento; padrões restritivos e repetitivos de comportamentos, interesses e atividades; excessiva aderência a rotinas e padrões de comportamento ritualizados; e interesses restritos e fixos (Lei nº 12.764/2012).'),
            'Múltipla': t('lattes.tipo.IDENTIFICACAO.campo.deficiencias.desc.multipla', 'Associação de duas ou mais deficiências (Decreto nº 3.298/1999).'),
        } },
    ] },
    // Antes noEvidence (widget de foto próprio em Configurações); agora usa
    // o bloco padrão de evidências do Catalogar, igual aos demais tipos —
    // accept já restringe a imagem, e singleton mantém só uma foto vigente.
    // Sem campo de Descrição (a pedido do usuário) — a foto em si já é o
    // conteúdo do item, um campo de texto era supérfluo aqui.
    FOTO_PERFIL: { label: t('lattes.tipo.FOTO_PERFIL.label', 'Foto de perfil'), noExport: true, singleton: true, perfil: true, accept: 'image/jpeg,image/png', fields: [] },
    DOCUMENTO_PESSOAL: { label: t('lattes.tipo.DOCUMENTO_PESSOAL.label', 'Documentos pessoais'), noExport: true, perfil: true, accept: 'application/pdf,image/jpeg,image/png', fields: [
        { key: 'tipoDoc', label: t('lattes.tipo.DOCUMENTO_PESSOAL.campo.tipo_doc.label', 'Tipo de documento'), type: 'select', required: true, options: opcoes('documento_pessoal_tipo_doc', [
            'Carteira de Identidade Nacional (CIN)', 'Carteira profissional', 'Certidão de casamento', 'Certidão de nascimento', 'Certificado de reservista',
            'CNH', 'Conselho de classe', 'Documento de Identidade (RG)', 'Identidade Funcional', 'Passaporte', 'PIS/PASEP', 'Título de eleitor', 'Outro']) },
        { key: 'titulo', label: t('lattes.tipo.DOCUMENTO_PESSOAL.campo.titulo.label', 'Descrição / Nº do documento'), type: 'text', required: true },
        { key: 'orgao', label: t('lattes.tipo.DOCUMENTO_PESSOAL.campo.orgao.label', 'Órgão emissor'), type: 'text' },
        { key: 'data', label: t('lattes.tipo.DOCUMENTO_PESSOAL.campo.data.label', 'Data de emissão / validade'), type: 'datebr' },
        { key: 'observacoes', label: t('lattes.tipo.DOCUMENTO_PESSOAL.campo.observacoes.label', 'Observações'), type: 'textarea' }] },
    DOC_IDENTIDADE: { label: t('lattes.tipo.DOC_IDENTIDADE.label', 'Identidade (RG)'), singleton: true, perfil: true, accept: 'application/pdf,image/jpeg,image/png', fields: [
        { key: 'numero', label: t('lattes.tipo.DOC_IDENTIDADE.campo.numero.label', 'Número'), type: 'text', required: true },
        { key: 'orgao', label: t('lattes.tipo.DOC_IDENTIDADE.campo.orgao.label', 'Órgão emissor'), type: 'text' },
        { key: 'uf', label: t('lattes.tipo.DOC_IDENTIDADE.campo.uf.label', 'Unidade Federativa (UF)'), type: 'text', placeholder: 'ex.: RS' },
        { key: 'dataEmissao', label: t('lattes.tipo.DOC_IDENTIDADE.campo.data_emissao.label', 'Data de emissão'), type: 'datebr' }] },
    DOC_PASSAPORTE: { label: t('lattes.tipo.DOC_PASSAPORTE.label', 'Passaporte'), singleton: true, perfil: true, accept: 'application/pdf,image/jpeg,image/png', fields: [
        { key: 'numero', label: t('lattes.tipo.DOC_PASSAPORTE.campo.numero.label', 'Número do passaporte'), type: 'text', required: true },
        { key: 'dataValidade', label: t('lattes.tipo.DOC_PASSAPORTE.campo.data_validade.label', 'Data de validade'), type: 'datebr' },
        { key: 'dataEmissao', label: t('lattes.tipo.DOC_PASSAPORTE.campo.data_emissao.label', 'Data de emissão'), type: 'datebr' },
        { key: 'paisEmissao', label: t('lattes.tipo.DOC_PASSAPORTE.campo.pais_emissao.label', 'País de emissão'), type: 'select', options: window.PAISES, default: 'Brasil' }] },
    // Dois registros persistentes (1 Residencial + 1 Profissional, a pedido
    // do usuário) — não é singleton global, é "singleton por Tipo"
    // (singletonBy), ver onSubmitForm e wireSingletonScope() em
    // tab-catalogar.js. Evidência habilitada (comprovante de endereço).
    // Tipo não tem opção em branco (noBlankOption) — só há 2 valores
    // possíveis, então sempre vem um dos dois pré-selecionado (default);
    // abrir a tela já mostra o Tipo com dados salvos, se houver (ver
    // itemSingleton em renderDynFields, tab-catalogar.js).
    ENDERECO: { label: t('lattes.tipo.ENDERECO.label', 'Endereço'), singletonBy: 'tipo', perfil: true, accept: 'application/pdf,image/jpeg,image/png', fields: [
        { key: 'tipo', label: t('lattes.tipo.ENDERECO.campo.tipo.label', 'Tipo'), type: 'select', required: true, noBlankOption: true, default: 'Residencial', options: opcoes('endereco_tipo', ['Residencial', 'Profissional']) },
        { key: 'titulo', label: t('lattes.tipo.ENDERECO.campo.titulo.label', 'Endereço'), type: 'text', required: true }, F_CIDADE, { key: 'uf', label: t('lattes.tipo.ENDERECO.campo.uf.label', 'UF'), type: 'text' }, { key: 'cep', label: t('lattes.tipo.ENDERECO.campo.cep.label', 'CEP'), type: 'text' }] },
    LICENCA: { label: t('lattes.tipo.LICENCA.label', 'Licença maternidade, paternidade e adoção'), noExport: true, fields: [{ key: 'titulo', label: t('lattes.tipo.LICENCA.campo.titulo.label', 'Descrição'), type: 'text', required: true }, { key: 'tipo', label: t('lattes.tipo.LICENCA.campo.tipo.label', 'Tipo'), type: 'select', options: opcoes('licenca_tipo', ['Maternidade', 'Paternidade', 'Adoção']) }, { key: 'dataInicio', label: t('lattes.tipo.LICENCA.campo.data_inicio.label', 'Data de início'), type: 'datebr', row: 'periodo' }, { key: 'dataFim', label: t('lattes.tipo.LICENCA.campo.data_fim.label', 'Data de fim'), type: 'datebr', row: 'periodo' }] },
    IDIOMAS: { label: t('lattes.tipo.IDIOMAS.label', 'Idiomas'), fields: [{ key: 'titulo', label: t('lattes.tipo.IDIOMAS.campo.titulo.label', 'Idioma'), type: 'select', options: window.IDIOMAS, required: true }, { key: 'habilidades', label: t('lattes.tipo.IDIOMAS.campo.habilidades.label', 'Proficiência (nível por habilidade)'), type: 'skilllevels', options: opcoes('idiomas_habilidades', ['Leitura', 'Fala', 'Escrita', 'Compreensão']), levels: ['Bom', 'Razoável', 'Pouco'] }] },
    PREMIO: { label: t('lattes.tipo.PREMIO.label', 'Prêmios e títulos'), fields: [F_TITULO, { key: 'ano', label: t('lattes.tipo.PREMIO.campo.ano.label', 'Data da premiação'), type: 'datebr', required: true }, { key: 'entidade', label: t('lattes.tipo.PREMIO.campo.entidade.label', 'Entidade promotora'), type: 'text', required: true }] },
    RESUMO_CV: { label: t('lattes.tipo.RESUMO_CV.label', 'Texto inicial do Currículo Lattes'), singleton: true, noEvidence: true, perfil: true, fields: [{ key: 'descricao', label: t('lattes.tipo.RESUMO_CV.campo.descricao.label', 'Texto'), type: 'textarea', required: true }] },
    // Texto narrativo (memorial descritivo, comum em processos de progressão/
    // concurso) usado como abertura do "Relatório completo (PDF)" — ver
    // Configurações → Exportar. Distinto do "Texto
    // inicial do Currículo Lattes" acima (mais curto, também exportado no
    // XML do Lattes): o Memorial não é um campo do Lattes (noExport) e não
    // aparece na página pública (Publicar na Web).
    MEMORIAL: { label: t('lattes.tipo.MEMORIAL.label', 'Memorial descritivo'), singleton: true, noEvidence: true, noExport: true, perfil: true, fields: [{ key: 'descricao', label: t('lattes.tipo.MEMORIAL.campo.descricao.label', 'Texto do memorial'), type: 'textarea', help: t('lattes.tipo.MEMORIAL.campo.descricao.help', 'Texto narrativo usado como abertura do "Relatório completo (PDF)" (Configurações → Exportar). Deixe em branco para não incluir essa seção no relatório.') }] },
    OUTRAS_INFO: { label: t('lattes.tipo.OUTRAS_INFO.label', 'Outras informações relevantes'), singleton: true, noEvidence: true, perfil: true, fields: [{ key: 'descricao', label: t('lattes.tipo.OUTRAS_INFO.campo.descricao.label', 'Descrição'), type: 'textarea' }] },
};
