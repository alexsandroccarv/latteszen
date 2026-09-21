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
   lattesZen — Definições de tipo: 05.2 Produção técnica
   --------------------------------------------------------------------------
   Extraído de lattes-types.js (issue de refatoração) — seção "05.2 Produção técnica"
   da taxonomia Lattes, sem nenhuma mudança de conteúdo.

   i18n (preparação): label passa por t(); os arrays de `options` ficam de
   fora — ver nota de arquitetura no topo de lattes-types-campos.js (value
   vs. label ainda em aberto).
   ========================================================================== */
import { F_TITULO, F_ANO, F_URL, F_INST, F_FINAL, F_CIDADE, F_NATUREZA, F_AFIM, F_PAIS, F_IDIOMA, MEIO_DIVULGACAO_OPTIONS, PROD_AUTORES_LISTA, PROD_PALAVRAS_AREA_SETORES_OUTRAS } from './lattes-types-campos.js';
import { t } from './i18n.js';

export const TYPES_05_PRODUCAO_TECNICA = {
    // 05.2 Produção técnica
    ASSESSORIA_CONSULTORIA: { label: t('lattes.tipo.ASSESSORIA_CONSULTORIA.label', 'Assessoria e consultoria'), fields: [
        F_NATUREZA(['Assessoria', 'Consultoria']), F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.ASSESSORIA_CONSULTORIA.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.ASSESSORIA_CONSULTORIA.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'duracaoMeses', label: t('lattes.tipo.ASSESSORIA_CONSULTORIA.campo.duracao_meses.label', 'Duração (meses)'), type: 'number' }, { key: 'paginas', label: t('lattes.tipo.ASSESSORIA_CONSULTORIA.campo.paginas.label', 'Número de páginas'), type: 'text' },
        { key: 'disponibilidade', label: t('lattes.tipo.ASSESSORIA_CONSULTORIA.campo.disponibilidade.label', 'Disponibilidade'), type: 'text' }, F_CIDADE, F_INST,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    EXTENSAO_TECNOLOGICA: { label: t('lattes.tipo.EXTENSAO_TECNOLOGICA.label', 'Extensão tecnológica'), fields: [
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.EXTENSAO_TECNOLOGICA.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.EXTENSAO_TECNOLOGICA.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'duracaoMeses', label: t('lattes.tipo.EXTENSAO_TECNOLOGICA.campo.duracao_meses.label', 'Duração (meses)'), type: 'number' }, { key: 'paginas', label: t('lattes.tipo.EXTENSAO_TECNOLOGICA.campo.paginas.label', 'Número de páginas'), type: 'text' },
        { key: 'disponibilidade', label: t('lattes.tipo.EXTENSAO_TECNOLOGICA.campo.disponibilidade.label', 'Disponibilidade'), type: 'text' }, F_CIDADE, F_INST,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    // "Tipo de programa" e "Depositante/Titular" (Pessoas/Instituições) são
    // grupos repetíveis da tela real sem elemento correspondente no XSD —
    // limitação genuína do schema, não têm como ser exportados. "Linguagens"
    // e "Qual o potencial de inovação?" (texto longo) também não têm atributo
    // correspondente. Nenhum dos quatro foi adicionado à UI por esse motivo.
    SOFTWARE_SEM_REGISTRO: { label: t('lattes.tipo.SOFTWARE_SEM_REGISTRO.label', 'Programa de computador sem registro'), fields: [
        F_NATUREZA(['Computacional', 'Multimídia', 'Outro']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.SOFTWARE_SEM_REGISTRO.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.SOFTWARE_SEM_REGISTRO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.SOFTWARE_SEM_REGISTRO.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        { key: 'potencialInovacao', label: t('lattes.tipo.SOFTWARE_SEM_REGISTRO.campo.potencial_inovacao.label', 'Possui potencial de inovação de produtos, processos ou serviços?'), type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'plataforma', label: t('lattes.tipo.SOFTWARE_SEM_REGISTRO.campo.plataforma.label', 'Plataforma / Ambiente'), type: 'text' },
        { key: 'disponibilidade', label: t('lattes.tipo.SOFTWARE_SEM_REGISTRO.campo.disponibilidade.label', 'Disponibilidade'), type: 'select', options: ['Restrita', 'Irrestrita'] },
        { key: 'instituicao', label: t('lattes.tipo.SOFTWARE_SEM_REGISTRO.campo.instituicao.label', 'Instituição financiadora'), type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS.slice(0, 3),
        { key: 'outrasInfo', label: t('lattes.tipo.SOFTWARE_SEM_REGISTRO.campo.outras_info.label', 'Resumo'), type: 'textarea' },
    ] },
    PRODUTO_TECNOLOGICO: { label: t('lattes.tipo.PRODUTO_TECNOLOGICO.label', 'Produtos'), fields: [
        { key: 'natureza', label: t('lattes.tipo.PRODUTO_TECNOLOGICO.campo.natureza.label', 'Tipo'), type: 'select', options: ['Piloto', 'Projeto', 'Protótipo', 'Outro'] },
        // "Natureza" real do schema (APARELHO/EQUIPAMENTO/FARMACOS_E_SIMILARES/
        // INSTRUMENTO/OUTRA) — distinta do "Tipo" acima (chave `natureza`
        // herdada do átomo F_NATUREZA original, mapeado pra TIPO-PRODUTO).
        { key: 'naturezaProduto', label: t('lattes.tipo.PRODUTO_TECNOLOGICO.campo.natureza_produto.label', 'Natureza'), type: 'select', options: ['Aparelho', 'Equipamento', 'Fármacos e similares', 'Instrumento', 'Outra'] },
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.PRODUTO_TECNOLOGICO.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.PRODUTO_TECNOLOGICO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'potencialInovacao', label: t('lattes.tipo.PRODUTO_TECNOLOGICO.campo.potencial_inovacao.label', 'Possui potencial de inovação de produtos, processos ou serviços?'), type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'disponibilidade', label: t('lattes.tipo.PRODUTO_TECNOLOGICO.campo.disponibilidade.label', 'Disponibilidade'), type: 'text' }, F_CIDADE,
        { key: 'instituicao', label: t('lattes.tipo.PRODUTO_TECNOLOGICO.campo.instituicao.label', 'Instituição financiadora'), type: 'text' },
        { key: 'registro', label: t('lattes.tipo.PRODUTO_TECNOLOGICO.campo.registro.label', 'Registro (se houver)'), type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    PROCESSO_TECNICA: { label: t('lattes.tipo.PROCESSO_TECNICA.label', 'Processos ou técnicas'), fields: [
        F_NATUREZA(['Analítica', 'Instrumental', 'Pedagógica', 'Processual', 'Terapêutica', 'Outra']),
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.PROCESSO_TECNICA.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.PROCESSO_TECNICA.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'potencialInovacao', label: t('lattes.tipo.PROCESSO_TECNICA.campo.potencial_inovacao.label', 'Possui potencial de inovação de produtos, processos ou serviços?'), type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'disponibilidade', label: t('lattes.tipo.PROCESSO_TECNICA.campo.disponibilidade.label', 'Disponibilidade'), type: 'text' }, F_CIDADE,
        { key: 'instituicao', label: t('lattes.tipo.PROCESSO_TECNICA.campo.instituicao.label', 'Instituição financiadora'), type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    TRABALHO_TECNICO: { label: t('lattes.tipo.TRABALHO_TECNICO.label', 'Trabalhos técnicos'), fields: [
        F_NATUREZA(['Parecer', 'Elaboração de projeto', 'Relatório técnico', 'Serviços na área da saúde', 'Extensão tecnológica', 'Outra']),
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.TRABALHO_TECNICO.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.TRABALHO_TECNICO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'duracaoMeses', label: t('lattes.tipo.TRABALHO_TECNICO.campo.duracao_meses.label', 'Duração (meses)'), type: 'number' }, { key: 'paginas', label: t('lattes.tipo.TRABALHO_TECNICO.campo.paginas.label', 'Número de páginas'), type: 'text' },
        { key: 'disponibilidade', label: t('lattes.tipo.TRABALHO_TECNICO.campo.disponibilidade.label', 'Disponibilidade'), type: 'text' }, F_CIDADE, F_INST,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    CARTA_MAPA: { label: t('lattes.tipo.CARTA_MAPA.label', 'Cartas, mapas ou similares'), fields: [
        F_NATUREZA(['Aerofotograma', 'Carta', 'Fotograma', 'Mapa', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.CARTA_MAPA.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.CARTA_MAPA.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'tema', label: t('lattes.tipo.CARTA_MAPA.campo.tema.label', 'Tema'), type: 'text' },
        { key: 'tecnica', label: t('lattes.tipo.CARTA_MAPA.campo.tecnica.label', 'Técnica'), type: 'text' },
        { key: 'areaRepresentada', label: t('lattes.tipo.CARTA_MAPA.campo.area_representada.label', 'Área representada'), type: 'text' },
        { key: 'instituicao', label: t('lattes.tipo.CARTA_MAPA.campo.instituicao.label', 'Instituição financiadora'), type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    CURSO_MINISTRADO: { label: t('lattes.tipo.CURSO_MINISTRADO.label', 'Curso de curta duração ministrado'), fields: [
        { key: 'nivel', label: t('lattes.tipo.CURSO_MINISTRADO.campo.nivel.label', 'Nível do curso'), type: 'select', options: ['Extensão', 'Aperfeiçoamento', 'Especialização', 'Outra'] },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.CURSO_MINISTRADO.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.CURSO_MINISTRADO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.CURSO_MINISTRADO.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        { key: 'participacaoAutores', label: t('lattes.tipo.CURSO_MINISTRADO.campo.participacao_autores.label', 'Participação dos autores'), type: 'select', options: ['Docente', 'Organizador', 'Outra'] },
        PROD_AUTORES_LISTA,
        { key: 'cargaHoraria', label: t('lattes.tipo.CURSO_MINISTRADO.campo.carga_horaria.label', 'Duração (carga horária)'), type: 'number', na: true },
        { key: 'unidade', label: t('lattes.tipo.CURSO_MINISTRADO.campo.unidade.label', 'Unidade da duração (h, dias, meses...)'), type: 'text' },
        { key: 'instituicao', label: t('lattes.tipo.CURSO_MINISTRADO.campo.instituicao.label', 'Instituição promotora'), type: 'text' },
        { key: 'local', label: t('lattes.tipo.CURSO_MINISTRADO.campo.local.label', 'Local do curso'), type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    MATERIAL_DIDATICO: { label: t('lattes.tipo.MATERIAL_DIDATICO.label', 'Desenvolvimento de material didático ou instrucional'), fields: [
        { key: 'natureza', label: t('lattes.tipo.MATERIAL_DIDATICO.campo.natureza.label', 'Natureza'), type: 'text' },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.MATERIAL_DIDATICO.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.MATERIAL_DIDATICO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.MATERIAL_DIDATICO.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    EDITORACAO: { label: t('lattes.tipo.EDITORACAO.label', 'Editoração'), fields: [
        F_NATUREZA(['Livro', 'Anais', 'Catálogo', 'Coletânea', 'Enciclopédia', 'Periódico', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.EDITORACAO.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.EDITORACAO.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'paginas', label: t('lattes.tipo.EDITORACAO.campo.paginas.label', 'Nº de páginas'), type: 'text' },
        // Editoração: o principal aqui é a Editora, não a instituição — nem
        // sempre há uma instituição promotora por trás (ex.: editora
        // comercial independente), por isso o N/A.
        { key: 'instituicao', label: t('lattes.tipo.EDITORACAO.campo.instituicao.label', 'Instituição promotora'), type: 'text', na: true },
        { key: 'editora', label: t('lattes.tipo.EDITORACAO.campo.editora.label', 'Editora'), type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    // Meio de divulgação e Home page NÃO têm atributo correspondente no XSD/DTD
    // para Manutenção de obra artística (ao contrário dos demais tipos da
    // seção) — limitação genuína do schema, por isso não entraram na UI. O
    // campo `finalidade` (chave antiga, atrás rotulada "Finalidade /
    // Descrição") já era exportado como LOCAL — relabeled pra bater com o
    // campo real da tela ("Local"), sem trocar a chave nem os dados salvos.
    MANUTENCAO_OBRA: { label: t('lattes.tipo.MANUTENCAO_OBRA.label', 'Manutenção de obra artística'), fields: [
        { key: 'tipo', label: t('lattes.tipo.MANUTENCAO_OBRA.campo.tipo.label', 'Tipo'), type: 'select', options: ['Conservação', 'Restauração', 'Outro'] },
        F_NATUREZA(['Arquitetura', 'Desenho', 'Escultura', 'Fotografia', 'Gravura', 'Pintura', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'relevante', label: t('lattes.tipo.MANUTENCAO_OBRA.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'nomeObra', label: t('lattes.tipo.MANUTENCAO_OBRA.campo.nome_obra.label', 'Nome da obra'), type: 'text' },
        { key: 'autorObra', label: t('lattes.tipo.MANUTENCAO_OBRA.campo.autor_obra.label', 'Autor da obra'), type: 'text' },
        { key: 'anoObra', label: t('lattes.tipo.MANUTENCAO_OBRA.campo.ano_obra.label', 'Ano da obra'), type: 'text' },
        { key: 'acervo', label: t('lattes.tipo.MANUTENCAO_OBRA.campo.acervo.label', 'Acervo'), type: 'select', options: ['Público', 'Privado'] },
        { ...F_FINAL, label: t('lattes.tipo.MANUTENCAO_OBRA.campo.local', 'Local') }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    MAQUETE: { label: t('lattes.tipo.MAQUETE.label', 'Maquete'), fields: [
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.MAQUETE.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.MAQUETE.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'objetoRepresentado', label: t('lattes.tipo.MAQUETE.campo.objeto_representado.label', 'Objeto representado'), type: 'text' },
        { key: 'materialUtilizado', label: t('lattes.tipo.MAQUETE.campo.material_utilizado.label', 'Material utilizado'), type: 'text' },
        { key: 'instituicao', label: t('lattes.tipo.MAQUETE.campo.instituicao.label', 'Instituição financiadora'), type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    MIDIA: { label: t('lattes.tipo.MIDIA.label', 'Entrevistas, mesas redondas, programas e comentários na mídia'), fields: [
        { key: 'tipo', label: t('lattes.tipo.MIDIA.campo.tipo.label', 'Natureza'), type: 'select', options: ['Entrevista', 'Mesa redonda', 'Comentário', 'Programa', 'Outra'] },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.MIDIA.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.MIDIA.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.MIDIA.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        { key: 'veiculo', label: t('lattes.tipo.MIDIA.campo.veiculo.label', 'Veículo de divulgação'), type: 'text' },
        { key: 'tema', label: t('lattes.tipo.MIDIA.campo.tema.label', 'Tema'), type: 'text' },
        { key: 'dataRealizacao', label: t('lattes.tipo.MIDIA.campo.data_realizacao.label', 'Data de realização'), type: 'datebr' },
        { key: 'duracaoMinutos', label: t('lattes.tipo.MIDIA.campo.duracao_minutos.label', 'Duração (minutos)'), type: 'number' },
        PROD_AUTORES_LISTA, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    RELATORIO_PESQUISA: { label: t('lattes.tipo.RELATORIO_PESQUISA.label', 'Relatório de pesquisa'), fields: [
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.RELATORIO_PESQUISA.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.RELATORIO_PESQUISA.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'nomeProjeto', label: t('lattes.tipo.RELATORIO_PESQUISA.campo.nome_projeto.label', 'Nome do projeto'), type: 'text' },
        { key: 'paginas', label: t('lattes.tipo.RELATORIO_PESQUISA.campo.paginas.label', 'Número de páginas'), type: 'text' },
        { key: 'disponibilidade', label: t('lattes.tipo.RELATORIO_PESQUISA.campo.disponibilidade.label', 'Disponibilidade'), type: 'text' },
        { key: 'instituicao', label: t('lattes.tipo.RELATORIO_PESQUISA.campo.instituicao.label', 'Instituição financiadora'), type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    // A tela real tem "Natureza" (select) e "Tema" (texto) como campos
    // distintos; o campo `plataforma` já existente (antes rotulado
    // "Plataforma / Tema" e, no export antigo, usado tanto como Natureza
    // quanto como Tema — bug de conflação) só correspondia de fato ao Tema —
    // relabeled, mantendo a chave e os dados salvos. `natureza` é campo novo.
    MIDIA_SOCIAL: { label: t('lattes.tipo.MIDIA_SOCIAL.label', 'Redes sociais, websites e blogs'), fields: [
        F_NATUREZA(['Rede Social', 'Fórum', 'Blog', 'Site']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA, F_URL,
        { key: 'relevante', label: t('lattes.tipo.MIDIA_SOCIAL.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.MIDIA_SOCIAL.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        { key: 'plataforma', label: t('lattes.tipo.MIDIA_SOCIAL.campo.plataforma.label', 'Tema'), type: 'text' },
        PROD_AUTORES_LISTA,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    OUTRA_TECNICA: { label: t('lattes.tipo.OUTRA_TECNICA.label', 'Outra produção técnica'), fields: [
        { key: 'natureza', label: t('lattes.tipo.OUTRA_TECNICA.campo.natureza.label', 'Natureza'), type: 'text' },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: t('lattes.tipo.OUTRA_TECNICA.campo.meio_divulgacao.label', 'Meio de divulgação'), type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: t('lattes.tipo.OUTRA_TECNICA.campo.relevante.label', 'É um dos 10 trabalhos mais relevantes de sua produção?'), type: 'checkbox' },
        { key: 'divulgacaoCT', label: t('lattes.tipo.OUTRA_TECNICA.campo.divulgacao_ct.label', 'É uma produção para educação e popularização de C&T?'), type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'instituicao', label: t('lattes.tipo.OUTRA_TECNICA.campo.instituicao.label', 'Instituição promotora'), type: 'text' },
        { key: 'local', label: t('lattes.tipo.OUTRA_TECNICA.campo.local.label', 'Local'), type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
};
