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
   lattesZen — Definições de tipo: 06/07 Patentes e Registros / Inovação
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "06/07 Patentes e Registros / Inovação"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.

   i18n (preparação): label/placeholder passam por t(); os arrays de
   `options` ficam de fora — ver nota de arquitetura no topo de
   lattes-types-campos.js (value vs. label ainda em aberto).
   ========================================================================== */
import { F_TITULO, F_ANO, F_URL, F_FINAL, F_NATUREZA, F_AFIM, F_PAIS, PROD_AUTORES_LISTA, PROD_PALAVRAS_AREA_SETORES_OUTRAS, CULTIVAR_FIELDS, PI_FIELDS, TOPOGRAFIA_FIELDS } from './lattes-types-campos.js';
import { t } from './i18n.js';

export const TYPES_06_07_PATENTES_REGISTROS = {
    // 06/07 Patentes e Registros / Inovação
    // "Situação do Depósito/Patente" (grupo repetível) usa o elemento
    // HISTORICO-SITUACOES-PATENTE, que existe no XSD mas NÃO no DTD (ainda
    // usado pela importação real do Lattes) — exportar quebraria a
    // importação, por isso não entrou na UI (campo `situacao` antigo,
    // texto livre sem exportação real, foi removido). "Depositante/Titular"
    // tem colunas separadas de Pessoas e Instituições na tela real, mas
    // REGISTRO-OU-PATENTE só tem o atributo NOME-DO-TITULAR no DTD
    // (NOME-DO-DEPOSITANTE existe só no XSD) — por isso os dois grupos
    // viram um único campo de texto livre aqui.
    PATENTE: { label: t('lattes.tipo.PATENTE.label', 'Patente'), fields: [
        { key: 'categoria', label: t('lattes.tipo.PATENTE.campo.categoria.label', 'Categoria'), type: 'select', options: ['Produto', 'Processo', 'Produto e Processo', 'Outra'] },
        { key: 'registro', label: t('lattes.tipo.PATENTE.campo.registro.label', 'Número do registro'), type: 'text' },
        { key: 'instituicao', label: t('lattes.tipo.PATENTE.campo.instituicao.label', 'Instituição onde foi depositada'), type: 'text' }, F_PAIS,
        { key: 'natureza', label: t('lattes.tipo.PATENTE.campo.natureza.label', 'Natureza'), type: 'select', options: ['Patente de Invenção', 'Patente de Modelo de Utilidade'] },
        F_TITULO,
        { key: 'numeroPCT', label: t('lattes.tipo.PATENTE.campo.numero_pct.label', 'Número do depósito PCT (caso exista)'), type: 'text' },
        { key: 'potencialInovacao', label: t('lattes.tipo.PATENTE.campo.potencial_inovacao.label', 'Possui potencial de inovação de produtos, processos ou serviços?'), type: 'checkbox' },
        { key: 'titular', label: t('lattes.tipo.PATENTE.campo.titular.label', 'Depositante/Titular (pessoas e instituições)'), type: 'textarea', placeholder: t('lattes.tipo.PATENTE.campo.titular.placeholder', 'Separe por ponto e vírgula (;)') },
        { ...PROD_AUTORES_LISTA, label: t('lattes.tipo.PATENTE.campo.inventores', 'Inventores') },
        { key: 'outrasInfo', label: t('lattes.tipo.PATENTE.campo.outras_info.label', 'Resumo'), type: 'textarea' },
        F_URL,
        { ...F_FINAL, label: t('lattes.tipo.PATENTE.campo.finalidade', 'Finalidade') },
        { key: 'instituicaoFinanceira', label: t('lattes.tipo.PATENTE.campo.instituicao_financeira.label', 'Instituição(ões) financiadora(s)'), type: 'textarea', placeholder: t('lattes.tipo.PATENTE.campo.instituicao_financeira.placeholder', 'Separe por ponto e vírgula (;)') },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS.slice(0, 3),
    ] },
    // Diferente de Programa de computador sem registro (5.13), esta tela não
    // tem Meio de divulgação, Home page nem Idioma (doc 6.2).
    SOFTWARE_REGISTRADO: { label: t('lattes.tipo.SOFTWARE_REGISTRADO.label', 'Programa de Computador Registrado'), fields: [
        F_NATUREZA(['Computacional', 'Multimídia', 'Outro']),
        { key: 'registro', label: t('lattes.tipo.SOFTWARE_REGISTRADO.campo.registro.label', 'Número do registro'), type: 'text' },
        { key: 'instituicaoRegistro', label: t('lattes.tipo.SOFTWARE_REGISTRADO.campo.instituicao_registro.label', 'Instituição de registro'), type: 'text' },
        F_PAIS, F_TITULO,
        { key: 'dataDeposito', label: t('lattes.tipo.SOFTWARE_REGISTRADO.campo.data_deposito.label', 'Data do registro'), type: 'date' },
        { key: 'dataConcessao', label: t('lattes.tipo.SOFTWARE_REGISTRADO.campo.data_concessao.label', 'Data do certificado de registro'), type: 'date' },
        { ...F_FINAL, label: t('lattes.tipo.SOFTWARE_REGISTRADO.campo.finalidade', 'Finalidade') },
        { key: 'divulgacaoCT', label: t('lattes.tipo.SOFTWARE_REGISTRADO.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        { key: 'potencialInovacao', label: t('lattes.tipo.SOFTWARE_REGISTRADO.campo.potencial_inovacao.label', 'Possui potencial de inovação de produtos, processos ou serviços?'), type: 'checkbox' },
        { key: 'relevante', label: t('lattes.tipo.SOFTWARE_REGISTRADO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'instituicao', label: t('lattes.tipo.SOFTWARE_REGISTRADO.campo.instituicao.label', 'Instituição(ões) financiadora(s)'), type: 'textarea', placeholder: t('lattes.tipo.SOFTWARE_REGISTRADO.campo.instituicao.placeholder', 'Separe por ponto e vírgula (;)') },
        { key: 'plataforma', label: t('lattes.tipo.SOFTWARE_REGISTRADO.campo.plataforma.label', 'Plataforma / Ambiente'), type: 'text' },
        PROD_AUTORES_LISTA,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS.slice(0, 3),
        { key: 'outrasInfo', label: t('lattes.tipo.SOFTWARE_REGISTRADO.campo.outras_info.label', 'Outras informações'), type: 'textarea' },
    ] },
    CULTIVAR_PROTEGIDA: { label: t('lattes.tipo.CULTIVAR_PROTEGIDA.label', 'Cultivar protegida'), fields: CULTIVAR_FIELDS },
    CULTIVAR_REGISTRADA: { label: t('lattes.tipo.CULTIVAR_REGISTRADA.label', 'Cultivar registrada'), fields: CULTIVAR_FIELDS },
    DESENHO_INDUSTRIAL: { label: t('lattes.tipo.DESENHO_INDUSTRIAL.label', 'Desenho industrial registrado'), fields: PI_FIELDS },
    // "Tipo" (de Produto/de Serviço/Coletiva/Certificação) consta na tela
    // real (doc 6.6.6), mas DADOS-BASICOS-DA-MARCA/DETALHAMENTO-DA-MARCA não
    // tem atributo correspondente no XSD/DTD (só NATUREZA, livre) — mantido
    // na UI como referência do usuário, mas sem exportação no XML. Sem
    // Finalidade/Depositante-Titular: não constam na tela real deste tipo.
    MARCA: { label: t('lattes.tipo.MARCA.label', 'Marca registrada'), fields: [
        { key: 'registro', label: t('lattes.tipo.MARCA.campo.registro.label', 'Número do registro'), type: 'text' },
        { key: 'instituicaoRegistro', label: t('lattes.tipo.MARCA.campo.instituicao_registro.label', 'Instituição de registro'), type: 'text' }, F_PAIS,
        { key: 'tipo', label: t('lattes.tipo.MARCA.campo.tipo.label', 'Tipo'), type: 'select', options: ['de Produto', 'de Serviço', 'Coletiva', 'Certificação'] },
        { key: 'natureza', label: t('lattes.tipo.MARCA.campo.natureza.label', 'Natureza'), type: 'select', options: ['Figurativa', 'Nominativa', 'Mista', 'Tridimensional'] },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM,
        { key: 'dataDeposito', label: t('lattes.tipo.MARCA.campo.data_deposito.label', 'Data do depósito'), type: 'date' },
        { key: 'dataConcessao', label: t('lattes.tipo.MARCA.campo.data_concessao.label', 'Data da concessão'), type: 'date' },
        { key: 'potencialInovacao', label: t('lattes.tipo.MARCA.campo.potencial_inovacao.label', 'Possui potencial de inovação de produtos, processos ou serviços?'), type: 'checkbox' },
        { ...PROD_AUTORES_LISTA, label: t('lattes.tipo.MARCA.campo.inventores', 'Inventores') },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    TOPOGRAFIA_CI: { label: t('lattes.tipo.TOPOGRAFIA_CI.label', 'Topografia de circuito integrado registrada'), fields: TOPOGRAFIA_FIELDS },
};
