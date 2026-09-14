/* ==========================================================================
   lattesZen — Definições de tipo: 06/07 Patentes e Registros / Inovação
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "06/07 Patentes e Registros / Inovação"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.
   ========================================================================== */
import { F_TITULO, F_ANO, F_URL, F_FINAL, F_NATUREZA, F_AFIM, F_PAIS, PROD_AUTORES_LISTA, PROD_PALAVRAS_AREA_SETORES_OUTRAS, CULTIVAR_FIELDS, PI_FIELDS, TOPOGRAFIA_FIELDS } from './lattes-types-campos.js';

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
    PATENTE: { label: 'Patente', fields: [
        { key: 'categoria', label: 'Categoria', type: 'select', options: ['Produto', 'Processo', 'Produto e Processo', 'Outra'] },
        { key: 'registro', label: 'Número do registro', type: 'text' },
        { key: 'instituicao', label: 'Instituição onde foi depositada', type: 'text' }, F_PAIS,
        { key: 'natureza', label: 'Natureza', type: 'select', options: ['Patente de Invenção', 'Patente de Modelo de Utilidade'] },
        F_TITULO,
        { key: 'numeroPCT', label: 'Número do depósito PCT (caso exista)', type: 'text' },
        { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
        { key: 'titular', label: 'Depositante/Titular (pessoas e instituições)', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' },
        { ...PROD_AUTORES_LISTA, label: 'Inventores' },
        { key: 'outrasInfo', label: 'Resumo', type: 'textarea' },
        F_URL,
        { ...F_FINAL, label: 'Finalidade' },
        { key: 'instituicaoFinanceira', label: 'Instituição(ões) financiadora(s)', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS.slice(0, 3),
    ] },
    // Diferente de Programa de computador sem registro (5.13), esta tela não
    // tem Meio de divulgação, Home page nem Idioma (doc 6.2).
    SOFTWARE_REGISTRADO: { label: 'Programa de Computador Registrado', fields: [
        F_NATUREZA(['Computacional', 'Multimídia', 'Outro']),
        { key: 'registro', label: 'Número do registro', type: 'text' },
        { key: 'instituicaoRegistro', label: 'Instituição de registro', type: 'text' },
        F_PAIS, F_TITULO,
        { key: 'dataDeposito', label: 'Data do registro', type: 'date' },
        { key: 'dataConcessao', label: 'Data do certificado de registro', type: 'date' },
        { ...F_FINAL, label: 'Finalidade' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'instituicao', label: 'Instituição(ões) financiadora(s)', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' },
        { key: 'plataforma', label: 'Plataforma / Ambiente', type: 'text' },
        PROD_AUTORES_LISTA,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS.slice(0, 3),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    CULTIVAR_PROTEGIDA: { label: 'Cultivar protegida', fields: CULTIVAR_FIELDS },
    CULTIVAR_REGISTRADA: { label: 'Cultivar registrada', fields: CULTIVAR_FIELDS },
    DESENHO_INDUSTRIAL: { label: 'Desenho industrial registrado', fields: PI_FIELDS },
    // "Tipo" (de Produto/de Serviço/Coletiva/Certificação) consta na tela
    // real (doc 6.6.6), mas DADOS-BASICOS-DA-MARCA/DETALHAMENTO-DA-MARCA não
    // tem atributo correspondente no XSD/DTD (só NATUREZA, livre) — mantido
    // na UI como referência do usuário, mas sem exportação no XML. Sem
    // Finalidade/Depositante-Titular: não constam na tela real deste tipo.
    MARCA: { label: 'Marca registrada', fields: [
        { key: 'registro', label: 'Número do registro', type: 'text' },
        { key: 'instituicaoRegistro', label: 'Instituição de registro', type: 'text' }, F_PAIS,
        { key: 'tipo', label: 'Tipo', type: 'select', options: ['de Produto', 'de Serviço', 'Coletiva', 'Certificação'] },
        { key: 'natureza', label: 'Natureza', type: 'select', options: ['Figurativa', 'Nominativa', 'Mista', 'Tridimensional'] },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM,
        { key: 'dataDeposito', label: 'Data do depósito', type: 'date' },
        { key: 'dataConcessao', label: 'Data da concessão', type: 'date' },
        { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
        { ...PROD_AUTORES_LISTA, label: 'Inventores' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    TOPOGRAFIA_CI: { label: 'Topografia de circuito integrado registrada', fields: TOPOGRAFIA_FIELDS },
};
