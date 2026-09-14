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
   ========================================================================== */
import { F_TITULO, F_URL, F_CIDADE } from './lattes-types-campos.js';

export const TYPES_01_DADOS_GERAIS = {
    // 01 Dados gerais
    IDENTIFICACAO: { label: 'Identificação', noEvidence: true, singleton: true, perfil: true, fields: [
        { key: 'titulo', label: 'Nome completo (nome civil)', type: 'text', required: true },
        { key: 'usaNomeSocial', label: 'Deseja utilizar o nome social?', type: 'select', options: ['Não', 'Sim'], help: 'De acordo com o Decreto 8.727/2016, pessoa travesti ou transexual pode optar pela exibição apenas do nome social nas buscas públicas do Currículo Lattes.' },
        { key: 'nomeSocial', label: 'Nome social', type: 'text', disabledWhen: { field: 'usaNomeSocial', in: ['', 'Não'] } },
        { key: 'citacoes', label: 'Nome em citações bibliográficas', type: 'repeater', addLabel: 'Adicionar variação', help: 'Cada variação do seu nome usada em publicações (ex.: CARVALHO, Alexsandro Cardoso).', columns: [
            { key: 'nome', label: 'Variação do nome', type: 'text', required: true }] },
        { key: 'cpf', label: 'CPF', type: 'text', placeholder: '000.000.000-00' },
        { key: 'corRaca', label: 'Cor ou raça', type: 'select', options: ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não desejo declarar'] },
        { key: 'sexo', label: 'Sexo', type: 'select', options: ['Masculino', 'Feminino'], help: 'Exigido pelo Lattes na importação do XML.' },
        { key: 'nacionalidade', label: 'Nacionalidade', type: 'text', placeholder: 'Brasileira' },
        { key: 'paisNacionalidade', label: 'País de nacionalidade', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' },
        { key: 'pais', label: 'País de nascimento', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' },
        { key: 'ufNascimento', label: 'UF de nascimento', type: 'text', placeholder: 'ex.: RS', disabledWhen: { field: 'pais', notEquals: 'Brasil' } },
        { key: 'cidadeNascimento', label: 'Cidade de nascimento', type: 'text' },
        { key: 'dataNascimento', label: 'Data de nascimento', type: 'datebr' },
        { key: 'orcid', label: 'ORCID', type: 'text' },
        F_URL,
        { key: 'pcd', label: 'Você é uma pessoa com Deficiência?', type: 'select', options: ['Não', 'Sim'] },
        { key: 'deficiencias', label: 'Deficiência(s)', type: 'checkboxes', disabledWhen: { field: 'pcd', in: ['', 'Não'] }, options: ['Auditiva', 'Física', 'Intelectual', 'Visual', 'Transtorno do Espectro Autista (TEA)', 'Múltipla'], descriptions: {
            'Auditiva': 'Perda bilateral, parcial ou total, de quarenta e um decibéis (dB) ou mais, aferida por audiograma nas frequências de 500Hz, 1.000Hz, 2.000Hz e 3.000Hz (Decreto nº 3.298/1999); limitação de longo prazo da audição, uni ou bilateral, que, em interação com uma ou mais barreiras, obstrui a participação plena e efetiva da pessoa na sociedade em igualdade de condições com as demais pessoas (Lei nº 14.768/2023).',
            'Física': 'Alteração completa ou parcial de um ou mais segmentos do corpo humano, acarretando o comprometimento da função física, apresentando-se sob a forma de paraplegia, paraparesia, monoplegia, monoparesia, tetraplegia, tetraparesia, triplegia, triparesia, hemiplegia, hemiparesia, ostomia, amputação ou ausência de membro, paralisia cerebral, nanismo, membros com deformidade congênita ou adquirida, exceto as deformidades estéticas e as que não produzam dificuldades para o desempenho de funções (Decreto nº 3.298/1999).',
            'Intelectual': 'Funcionamento intelectual significativamente inferior à média, com manifestação antes dos dezoito anos e limitações associadas a duas ou mais áreas de habilidades adaptativas, tais como: comunicação; cuidado pessoal; habilidades sociais; utilização dos recursos da comunidade; saúde e segurança; habilidades acadêmicas; lazer; e trabalho (Decreto nº 3.298/1999).',
            'Visual': 'Cegueira, na qual a acuidade visual é igual ou menor que 0,05 no melhor olho, com a melhor correção óptica; baixa visão, que significa acuidade visual entre 0,3 e 0,05 no melhor olho, com a melhor correção óptica; os casos nos quais a somatória da medida do campo visual em ambos os olhos for igual ou menor que 60°; ou a ocorrência simultânea de quaisquer das condições anteriores (Decreto nº 3.298/1999); visão monocular, classificada como deficiência sensorial do tipo visual (Lei nº 14.126/2021).',
            'Transtorno do Espectro Autista (TEA)': 'Síndrome clínica caracterizada pela deficiência persistente e clinicamente significativa da comunicação e da interação sociais, manifestada por deficiência marcada de comunicação verbal e não verbal usada para interação social; ausência de reciprocidade social; falência em desenvolver e manter relações apropriadas ao seu nível de desenvolvimento; padrões restritivos e repetitivos de comportamentos, interesses e atividades; excessiva aderência a rotinas e padrões de comportamento ritualizados; e interesses restritos e fixos (Lei nº 12.764/2012).',
            'Múltipla': 'Associação de duas ou mais deficiências (Decreto nº 3.298/1999).',
        } },
    ] },
    // Antes noEvidence (widget de foto próprio em Configurações); agora usa
    // o bloco padrão de evidências do Catalogar, igual aos demais tipos —
    // accept já restringe a imagem, e singleton mantém só uma foto vigente.
    // Sem campo de Descrição (a pedido do usuário) — a foto em si já é o
    // conteúdo do item, um campo de texto era supérfluo aqui.
    FOTO_PERFIL: { label: 'Foto de perfil', noExport: true, singleton: true, perfil: true, accept: 'image/jpeg,image/png', fields: [] },
    DOCUMENTO_PESSOAL: { label: 'Documentos pessoais', noExport: true, perfil: true, accept: 'application/pdf,image/jpeg,image/png', fields: [
        { key: 'tipoDoc', label: 'Tipo de documento', type: 'select', required: true, options: [
            'Carteira de Identidade Nacional (CIN)', 'Carteira profissional', 'Certidão de casamento', 'Certidão de nascimento', 'Certificado de reservista',
            'CNH', 'Conselho de classe', 'Documento de Identidade (RG)', 'Identidade Funcional', 'Passaporte', 'PIS/PASEP', 'Título de eleitor', 'Outro'] },
        { key: 'titulo', label: 'Descrição / Nº do documento', type: 'text', required: true },
        { key: 'orgao', label: 'Órgão emissor', type: 'text' },
        { key: 'data', label: 'Data de emissão / validade', type: 'datebr' },
        { key: 'observacoes', label: 'Observações', type: 'textarea' }] },
    DOC_IDENTIDADE: { label: 'Identidade (RG)', singleton: true, perfil: true, accept: 'application/pdf,image/jpeg,image/png', fields: [
        { key: 'numero', label: 'Número', type: 'text', required: true },
        { key: 'orgao', label: 'Órgão emissor', type: 'text' },
        { key: 'uf', label: 'Unidade Federativa (UF)', type: 'text', placeholder: 'ex.: RS' },
        { key: 'dataEmissao', label: 'Data de emissão', type: 'datebr' }] },
    DOC_PASSAPORTE: { label: 'Passaporte', singleton: true, perfil: true, accept: 'application/pdf,image/jpeg,image/png', fields: [
        { key: 'numero', label: 'Número do passaporte', type: 'text', required: true },
        { key: 'dataValidade', label: 'Data de validade', type: 'datebr' },
        { key: 'dataEmissao', label: 'Data de emissão', type: 'datebr' },
        { key: 'paisEmissao', label: 'País de emissão', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' }] },
    // Dois registros persistentes (1 Residencial + 1 Profissional, a pedido
    // do usuário) — não é singleton global, é "singleton por Tipo"
    // (singletonBy), ver onSubmitForm e wireSingletonScope() em
    // tab-catalogar.js. Evidência habilitada (comprovante de endereço).
    // Tipo não tem opção em branco (noBlankOption) — só há 2 valores
    // possíveis, então sempre vem um dos dois pré-selecionado (default);
    // abrir a tela já mostra o Tipo com dados salvos, se houver (ver
    // itemSingleton em renderDynFields, tab-catalogar.js).
    ENDERECO: { label: 'Endereço', singletonBy: 'tipo', perfil: true, accept: 'application/pdf,image/jpeg,image/png', fields: [
        { key: 'tipo', label: 'Tipo', type: 'select', required: true, noBlankOption: true, default: 'Residencial', options: ['Residencial', 'Profissional'] },
        { key: 'titulo', label: 'Endereço', type: 'text', required: true }, F_CIDADE, { key: 'uf', label: 'UF', type: 'text' }, { key: 'cep', label: 'CEP', type: 'text' }] },
    LICENCA: { label: 'Licença maternidade, paternidade e adoção', noExport: true, fields: [{ key: 'titulo', label: 'Descrição', type: 'text', required: true }, { key: 'tipo', label: 'Tipo', type: 'select', options: ['Maternidade', 'Paternidade', 'Adoção'] }, { key: 'dataInicio', label: 'Data de início', type: 'datebr', row: 'periodo' }, { key: 'dataFim', label: 'Data de fim', type: 'datebr', row: 'periodo' }] },
    IDIOMAS: { label: 'Idiomas', fields: [{ key: 'titulo', label: 'Idioma', type: 'select', options: window.IDIOMAS_LATTES || [], required: true }, { key: 'habilidades', label: 'Proficiência (nível por habilidade)', type: 'skilllevels', options: ['Leitura', 'Fala', 'Escrita', 'Compreensão'], levels: ['Bom', 'Razoável', 'Pouco'] }] },
    PREMIO: { label: 'Prêmios e títulos', fields: [F_TITULO, { key: 'ano', label: 'Data da premiação', type: 'datebr', required: true }, { key: 'entidade', label: 'Entidade promotora', type: 'text', required: true }] },
    RESUMO_CV: { label: 'Texto inicial do Currículo Lattes', singleton: true, noEvidence: true, perfil: true, fields: [{ key: 'descricao', label: 'Texto', type: 'textarea', required: true }] },
    OUTRAS_INFO: { label: 'Outras informações relevantes', singleton: true, noEvidence: true, perfil: true, fields: [{ key: 'descricao', label: 'Descrição', type: 'textarea' }] },
};
